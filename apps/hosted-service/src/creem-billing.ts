import type { CreemCheckoutAttemptStore } from './creem-checkout-attempts.js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  billingPrices, type BillingPlan, type BillingProvider,
  type BillingProviderCheckoutSession, type BillingProviderSubscription,
  type BillingProviderSubscriptionUpdateExpectation, type VerifiedBillingNotice,
} from '@basiclinear/hosted';

export interface CreemBillingProviderOptions {
  checkoutAttemptStore: CreemCheckoutAttemptStore;
  apiKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  monthlyProductId: string;
  annualProductId: string;
  publicOrigin: string;
  fetchImpl?: typeof fetch;
  clock?: () => Date;
}

type Json = Record<string, unknown>;
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CREEM_OBJECT_INVALID');
  return value as Json;
}
function reference(value: unknown, prefix: string): string {
  const id = typeof value === 'string' ? value : object(value).id;
  if (typeof id !== 'string' || !new RegExp(`^${prefix}_[A-Za-z0-9]{8,120}$`).test(id)) {
    throw new Error('CREEM_REFERENCE_INVALID');
  }
  return id;
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('CREEM_TIMESTAMP_INVALID');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('CREEM_TIMESTAMP_INVALID');
  return date.toISOString();
}
function seats(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw new Error('CREEM_SEATS_INVALID');
  return value as number;
}
const metadataKeys = ['basiclinear_checkout_reference', 'basiclinear_owner_user_id', 'basiclinear_plan',
  'basiclinear_workspace_id', 'basiclinear_attempted_at'];
function binding(value: unknown) {
  const m = object(value);
  if (Object.keys(m).sort().join(':') !== [...metadataKeys].sort().join(':')
    || typeof m.basiclinear_checkout_reference !== 'string'
    || !/^[a-f0-9]{64}$/.test(m.basiclinear_checkout_reference)
    || typeof m.basiclinear_workspace_id !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]{2,127}$/.test(m.basiclinear_workspace_id)
    || typeof m.basiclinear_owner_user_id !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]{2,127}$/.test(m.basiclinear_owner_user_id)
    || (m.basiclinear_plan !== 'monthly' && m.basiclinear_plan !== 'annual')) throw new Error('CREEM_METADATA_INVALID');
  return {
    checkoutReference: m.basiclinear_checkout_reference,
    workspaceId: m.basiclinear_workspace_id,
    ownerUserId: m.basiclinear_owner_user_id,
    plan: m.basiclinear_plan as BillingPlan,
    attemptedAt: timestamp(m.basiclinear_attempted_at),
  };
}

export class CreemBillingProvider implements BillingProvider {
  readonly #options: CreemBillingProviderOptions;
  readonly #products: Record<BillingPlan, string>;
  readonly #fetch: typeof fetch;
  readonly #clock: () => Date;
  constructor(options: CreemBillingProviderOptions) {
    const origin = new URL(options.publicOrigin);
    if (origin.origin !== options.publicOrigin || origin.protocol !== 'https:') throw new Error('CREEM_ORIGIN_INVALID');
    if ((options.mode !== 'test' && options.mode !== 'live')
      || !options.apiKey.startsWith('creem_')
      || options.apiKey.startsWith('creem_test_') !== (options.mode === 'test')
      || options.webhookSecret.trim().length < 16) throw new Error('CREEM_CONFIGURATION_INVALID');
    this.#products = {monthly: reference(options.monthlyProductId, 'prod'), annual: reference(options.annualProductId, 'prod')};
    if (this.#products.monthly === this.#products.annual) throw new Error('CREEM_PRODUCTS_MUST_DIFFER');
    this.#options = options;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#clock = options.clock ?? (() => new Date());
  }
  #mode(value: unknown): void {
    if (!(this.#options.mode === 'test' ? value === 'test' || value === 'sandbox' : value === 'prod' || value === 'live')) {
      throw new Error('CREEM_MODE_INVALID');
    }
  }
  async #request(path: string, body?: unknown): Promise<Json> {
    const base = this.#options.mode === 'test' ? 'https://test-api.creem.io' : 'https://api.creem.io';
    const response = await this.#fetch(`${base}/v1/${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: {'x-api-key': this.#options.apiKey, 'content-type': 'application/json', accept: 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(15_000),
    });
    // Never include provider payloads, URLs, customer data or credentials in errors.
    if (!response.ok) throw new Error(`CREEM_HTTP_${response.status}`);
    return object(await response.json());
  }
  async #product(value: unknown, plan: BillingPlan): Promise<string> {
    const id = reference(value, 'prod');
    if (id !== this.#products[plan]) throw new Error('CREEM_PRODUCT_BINDING_INVALID');
    const p = typeof value === 'string' ? await this.#request(`products?product_id=${encodeURIComponent(id)}`) : object(value);
    this.#mode(p.mode);
    if (reference(p.id, 'prod') !== id || p.currency !== 'USD'
      || p.price !== billingPrices[plan].amountCents || p.billing_type !== 'recurring'
      || p.billing_period !== (plan === 'monthly' ? 'every-month' : 'every-year')
      || (p.tax_mode !== 'exclusive' && p.tax_mode !== 'inclusive')) throw new Error('CREEM_PRODUCT_PRICE_INVALID');
    return id;
  }
  async createCheckoutSession(input: Parameters<BillingProvider['createCheckoutSession']>[0]): Promise<BillingProviderCheckoutSession> {
    if (input.priceId !== this.#products[input.plan]) throw new Error('CREEM_PRODUCT_BINDING_INVALID');
    seats(input.quantity);
    const metadata = {
      basiclinear_checkout_reference: input.checkoutReference, basiclinear_workspace_id: input.workspaceId,
      basiclinear_owner_user_id: input.ownerUserId, basiclinear_plan: input.plan,
      basiclinear_attempted_at: input.attemptedAt ?? this.#clock().toISOString(),
    };
    binding(metadata);
    await this.#product(input.priceId, input.plan);
    const attemptId = createHash('sha256').update(input.idempotencyReference).digest('hex');
    const attempt = await this.#options.checkoutAttemptStore.claim(attemptId);
    if (attempt.state === 'pending') throw new Error('CREEM_CHECKOUT_RECOVERY_REQUIRES_RECONCILIATION');
    const result = attempt.state === 'created'
      ? await this.#request(`checkouts?checkout_id=${encodeURIComponent(attempt.checkoutId)}`)
      : await this.#request('checkouts', {
      product_id: input.priceId, units: input.quantity,
      request_id: `olm_${createHash('sha256').update(input.idempotencyReference).digest('hex').slice(0, 32)}`,
        success_url: `${this.#options.publicOrigin}/?app&billing=success`, metadata,
    });
    const resultId = reference(result.id, 'ch');
    if (attempt.state === 'new') await this.#options.checkoutAttemptStore.complete(attemptId, resultId);
    else if (resultId !== attempt.checkoutId) throw new Error('CREEM_CHECKOUT_BINDING_INVALID');
    const session = await this.#checkout(result);
    if (session.checkoutReference !== input.checkoutReference || session.workspaceId !== input.workspaceId
      || session.ownerUserId !== input.ownerUserId || session.plan !== input.plan || session.quantity !== input.quantity) {
      throw new Error('CREEM_CHECKOUT_BINDING_INVALID');
    }
    return session;
  }
  async retrieveCheckoutSession(id: string): Promise<BillingProviderCheckoutSession> {
    reference(id, 'ch');
    const result = await this.#checkout(await this.#request(`checkouts?checkout_id=${encodeURIComponent(id)}`));
    if (result.id !== id) throw new Error('CREEM_CHECKOUT_BINDING_INVALID');
    return result;
  }
  async #checkout(value: Json): Promise<BillingProviderCheckoutSession> {
    this.#mode(value.mode);
    const id = reference(value.id, 'ch');
    const m = binding(value.metadata);
    const productId = await this.#product(value.product ?? value.product_id, m.plan);
    const state = value.status === 'completed' ? 'complete' : value.status === 'expired' ? 'expired'
      : value.status === 'pending' ? 'open' : null;
    if (state === null) throw new Error('CREEM_CHECKOUT_STATUS_INVALID');
    let url: string | null = null;
    if (state === 'open') {
      const parsed = new URL(String(value.checkout_url));
      const path = parsed.pathname.replace(/\/$/, '');
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.hash
        || !(parsed.hostname === 'checkout.creem.io' && path === `/${id}`
          || ['creem.io', 'www.creem.io'].includes(parsed.hostname)
            && (path === `/checkout/${productId}/${id}`
              || this.#options.mode === 'test' && path === `/test/checkout/${productId}/${id}`))) {
        throw new Error('CREEM_CHECKOUT_URL_INVALID');
      }
      url = parsed.href;
    }
    const customerId = value.customer == null ? null : reference(value.customer, 'cust');
    const subscriptionId = value.subscription == null ? null : reference(value.subscription, 'sub');
    if (state === 'complete' && (customerId === null || subscriptionId === null)) throw new Error('CREEM_CHECKOUT_UNPAID');
    return {id, checkoutReference: m.checkoutReference, url, state, workspaceId: m.workspaceId,
      ownerUserId: m.ownerUserId, plan: m.plan, priceId: productId, quantity: seats(value.units),
      customerId, subscriptionId, createdAt: m.attemptedAt,
      // This is our return-link validity window, never evidence of provider expiry.
      expiresAt: new Date(Date.parse(m.attemptedAt) + 24 * 60 * 60 * 1_000).toISOString()};
  }
  async recoverCheckoutSessions(): Promise<BillingProviderCheckoutSession[]> {
    // Creem documents retrieval by checkout ID, but no list/search or expiration API.
    // Do not claim an unknown timed-out attempt is absent and risk a second charge.
    throw new Error('CREEM_CHECKOUT_RECOVERY_REQUIRES_RECONCILIATION');
  }
  async expireCheckoutSession(id: string): Promise<void> {
    if ((await this.retrieveCheckoutSession(id)).state !== 'expired') {
      throw new Error('CREEM_CHECKOUT_STILL_PAYABLE');
    }
  }
  async retrieveSubscription(id: string): Promise<BillingProviderSubscription> {
    reference(id, 'sub');
    const result = await this.#subscription(await this.#request(`subscriptions?subscription_id=${encodeURIComponent(id)}`));
    if (result.id !== id) throw new Error('CREEM_SUBSCRIPTION_BINDING_INVALID');
    return result;
  }
  async #subscription(value: Json): Promise<BillingProviderSubscription> {
    this.#mode(value.mode);
    const m = binding(value.metadata);
    const productId = await this.#product(value.product, m.plan);
    if (!Array.isArray(value.items) || value.items.length !== 1) throw new Error('CREEM_SUBSCRIPTION_ITEMS_INVALID');
    const item = object(value.items[0]);
    if (reference(item.product_id, 'prod') !== productId) throw new Error('CREEM_SUBSCRIPTION_ITEMS_INVALID');
    const statuses: Record<string, BillingProviderSubscription['status']> = {
      active: 'active', trialing: 'trialing', canceled: 'canceled', expired: 'canceled',
      scheduled_cancel: 'active', unpaid: 'unpaid', past_due: 'past_due', paused: 'paused',
    };
    const status = statuses[String(value.status)];
    if (status === undefined) throw new Error('CREEM_SUBSCRIPTION_STATUS_INVALID');
    return {id: reference(value.id, 'sub'), customerId: reference(value.customer, 'cust'),
      workspaceId: m.workspaceId, ownerUserId: m.ownerUserId, plan: m.plan, priceId: productId,
      quantity: seats(item.units), status, automaticTaxEnabled: true,
      currentPeriodEnd: timestamp(value.current_period_end_date),
      cancelAtPeriodEnd: value.status === 'scheduled_cancel', providerUpdatedAt: this.#clock().toISOString()};
  }
  async updateSubscriptionQuantity(input: {
    subscriptionId: string; expected: BillingProviderSubscriptionUpdateExpectation; quantity: number;
    idempotencyReference: string; prorationBehavior: 'create_prorations';
  }): Promise<BillingProviderSubscription> {
    seats(input.quantity);
    reference(input.subscriptionId, 'sub');
    const raw = await this.#request(`subscriptions?subscription_id=${encodeURIComponent(input.subscriptionId)}`);
    const current = await this.#subscription(raw);
    const matches = (value: BillingProviderSubscription, quantity: number) => value.id === input.subscriptionId
      && value.quantity === quantity && Object.entries(input.expected)
        .every(([key, expected]) => key === 'quantity' || value[key as keyof BillingProviderSubscription] === expected);
    if (matches(current, input.quantity)) return current; // Retry after an already-applied seat change.
    if (!matches(current, input.expected.quantity)) throw new Error('CREEM_SUBSCRIPTION_BINDING_CHANGED');
    const item = object((raw.items as unknown[])[0]);
    const updated = await this.#subscription(await this.#request(`subscriptions/${encodeURIComponent(input.subscriptionId)}`, {
      items: [{id: reference(item.id, 'sitem'), product_id: current.priceId, units: input.quantity}],
      update_behavior: 'proration-charge',
    }));
    if (!matches(updated, input.quantity)) throw new Error('CREEM_SUBSCRIPTION_BINDING_CHANGED');
    return updated;
  }
  verifyWebhook(rawBody: Buffer, signature: string): VerifiedBillingNotice | null {
    if (!/^[a-fA-F0-9]{64}$/.test(signature)) throw new Error('CREEM_SIGNATURE_INVALID');
    const digest = createHmac('sha256', this.#options.webhookSecret).update(rawBody).digest();
    if (!timingSafeEqual(digest, Buffer.from(signature, 'hex'))) throw new Error('CREEM_SIGNATURE_INVALID');
    const event = object(JSON.parse(rawBody.toString('utf8')));
    const eventId = reference(event.id, 'evt');
    const eventCreatedAt = timestamp(event.created_at);
    const value = object(event.object);
    this.#mode(value.mode);
    if (event.eventType === 'checkout.completed') {
      if (value.status !== 'completed') throw new Error('CREEM_EVENT_INVALID');
      return {provider: 'creem', eventId, eventCreatedAt,
        subscriptionId: reference(value.subscription, 'sub'), checkoutSessionId: reference(value.id, 'ch')};
    }
    if (['subscription.active', 'subscription.paid', 'subscription.trialing', 'subscription.update',
      'subscription.canceled', 'subscription.scheduled_cancel', 'subscription.expired', 'subscription.unpaid',
      'subscription.past_due', 'subscription.paused'].includes(String(event.eventType))) {
      return {provider: 'creem', eventId, eventCreatedAt, subscriptionId: reference(value.id, 'sub'), checkoutSessionId: null};
    }
    return null;
  }
}
