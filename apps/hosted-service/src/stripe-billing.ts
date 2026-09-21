import Stripe from 'stripe';
import {
  billingPrices,
  type BillingPlan,
  type BillingProvider,
  type BillingProviderCheckoutSession,
  type BillingProviderSubscription,
  type BillingProviderSubscriptionUpdateExpectation,
  type BillingProviderSubscriptionStatus,
  type VerifiedBillingNotice,
} from '@openlinear/hosted';

interface StripeBillingProviderOptions {
  secretKey: string;
  webhookSecret: string;
  monthlyPriceId: string;
  annualPriceId: string;
  publicOrigin: string;
  clock?: () => Date;
  client?: Stripe;
}

const metadataKeys = [
  'openlinear_checkout_reference',
  'openlinear_owner_user_id',
  'openlinear_plan',
  'openlinear_workspace_id',
] as const;

function canonicalNow(clock: () => Date): string {
  const value = clock();
  if (!Number.isFinite(value.getTime())) throw new Error('STRIPE_CLOCK_INVALID');
  return value.toISOString();
}

function objectId(value: {id: string} | string | null): string | null {
  if (value === null) return null;
  return typeof value === 'string' ? value : value.id;
}

function timestamp(value: number): string {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('STRIPE_TIMESTAMP_INVALID');
  const date = new Date(value * 1_000);
  if (!Number.isFinite(date.getTime())) throw new Error('STRIPE_TIMESTAMP_INVALID');
  return date.toISOString();
}

function metadata(value: Stripe.Metadata | null): {
  workspaceId: string;
  ownerUserId: string;
  plan: BillingPlan;
  checkoutReference: string;
} {
  if (value === null || Object.keys(value).sort().join(':') !== [...metadataKeys].sort().join(':')) {
    throw new Error('STRIPE_METADATA_INVALID');
  }
  const workspaceId = value.openlinear_workspace_id;
  const ownerUserId = value.openlinear_owner_user_id;
  const plan = value.openlinear_plan;
  const checkoutReference = value.openlinear_checkout_reference;
  if (typeof workspaceId !== 'string' || typeof ownerUserId !== 'string'
    || typeof checkoutReference !== 'string' || !/^[a-f0-9]{64}$/u.test(checkoutReference)
    || (plan !== 'monthly' && plan !== 'annual')) throw new Error('STRIPE_METADATA_INVALID');
  return {workspaceId, ownerUserId, plan, checkoutReference};
}

function subscriptionStatus(value: Stripe.Subscription.Status): BillingProviderSubscriptionStatus {
  if (!['trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']
    .includes(value)) throw new Error('STRIPE_SUBSCRIPTION_STATUS_UNSUPPORTED');
  return value as BillingProviderSubscriptionStatus;
}

function assertSubscriptionUpdateBinding(
  value: BillingProviderSubscription,
  expected: BillingProviderSubscriptionUpdateExpectation,
  quantity: number,
): void {
  if (value.customerId !== expected.customerId
    || value.workspaceId !== expected.workspaceId
    || value.ownerUserId !== expected.ownerUserId
    || value.plan !== expected.plan
    || value.priceId !== expected.priceId
    || value.quantity !== quantity
    || value.status !== expected.status
    || value.currentPeriodEnd !== expected.currentPeriodEnd
    || value.cancelAtPeriodEnd !== expected.cancelAtPeriodEnd) {
    throw new Error('STRIPE_SUBSCRIPTION_BINDING_CHANGED');
  }
}

export class StripeBillingProvider implements BillingProvider {
  readonly #client: Stripe;
  readonly #webhookSecret: string;
  readonly #priceIds: Record<BillingPlan, string>;
  readonly #publicOrigin: string;
  readonly #clock: () => Date;

  constructor(options: StripeBillingProviderOptions) {
    this.#client = options.client ?? new Stripe(options.secretKey);
    this.#webhookSecret = options.webhookSecret;
    this.#priceIds = {monthly: options.monthlyPriceId, annual: options.annualPriceId};
    this.#publicOrigin = options.publicOrigin;
    this.#clock = options.clock ?? (() => new Date());
  }

  async createCheckoutSession(input: {
    checkoutReference: string;
    workspaceId: string;
    ownerUserId: string;
    plan: BillingPlan;
    priceId: string;
    quantity: number;
    idempotencyReference: string;
  }): Promise<BillingProviderCheckoutSession> {
    if (input.priceId !== this.#priceIds[input.plan]) throw new Error('STRIPE_PRICE_BINDING_INVALID');
    if (!/^[a-f0-9]{64}$/u.test(input.checkoutReference)) throw new Error('STRIPE_CHECKOUT_REFERENCE_INVALID');
    const metadataValue = {
      openlinear_checkout_reference: input.checkoutReference,
      openlinear_workspace_id: input.workspaceId,
      openlinear_owner_user_id: input.ownerUserId,
      openlinear_plan: input.plan,
    };
    const session = await this.#client.checkout.sessions.create({
      mode: 'subscription',
      client_reference_id: input.workspaceId,
      line_items: [{price: input.priceId, quantity: input.quantity}],
      allow_promotion_codes: false,
      automatic_tax: {enabled: true},
      success_url: `${this.#publicOrigin}/?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.#publicOrigin}/?billing=cancelled`,
      metadata: metadataValue,
      subscription_data: {metadata: metadataValue},
    }, {idempotencyKey: input.idempotencyReference});
    return this.#checkoutSession(await this.#retrieveExpandedSession(session.id));
  }

  async retrieveCheckoutSession(sessionId: string): Promise<BillingProviderCheckoutSession> {
    return this.#checkoutSession(await this.#retrieveExpandedSession(sessionId));
  }

  async recoverCheckoutSessions(input: {
    checkoutReference: string;
    createdAt: string;
    attemptedAt: string;
  }): Promise<BillingProviderCheckoutSession[]> {
    if (!/^[a-f0-9]{64}$/u.test(input.checkoutReference)) throw new Error('STRIPE_CHECKOUT_REFERENCE_INVALID');
    const createdAt = new Date(input.createdAt);
    const attemptedAt = new Date(input.attemptedAt);
    if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(attemptedAt.getTime())
      || attemptedAt.getTime() < createdAt.getTime()) throw new Error('STRIPE_TIMESTAMP_INVALID');
    const lowerBound = Math.max(1, Math.floor(createdAt.getTime() / 1_000) - 5 * 60);
    const upperBound = Math.ceil((attemptedAt.getTime() + 24 * 60 * 60 * 1_000 + 10 * 60 * 1_000) / 1_000);
    const matches: Stripe.Checkout.Session[] = [];
    let startingAfter: string | undefined;
    const visitedCursors = new Set<string>();
    do {
      const page = await this.#client.checkout.sessions.list({
        created: {gte: lowerBound, lte: upperBound},
        expand: ['data.line_items.data.price', 'data.subscription'],
        limit: 100,
        ...(startingAfter === undefined ? {} : {starting_after: startingAfter}),
      });
      for (const session of page.data) {
        if (session.metadata?.openlinear_checkout_reference === input.checkoutReference) matches.push(session);
      }
      if (!page.has_more) break;
      const last = page.data.at(-1);
      if (last === undefined || visitedCursors.has(last.id)) {
        throw new Error('STRIPE_CHECKOUT_RECOVERY_INVALID');
      }
      visitedCursors.add(last.id);
      startingAfter = last.id;
    } while (true);
    return matches.map((session) => this.#checkoutSession(session));
  }

  async expireCheckoutSession(sessionId: string): Promise<void> {
    const current = await this.#client.checkout.sessions.retrieve(sessionId);
    if (current.status === 'open') await this.#client.checkout.sessions.expire(sessionId);
  }

  async retrieveSubscription(subscriptionId: string): Promise<BillingProviderSubscription> {
    const value = await this.#client.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });
    return this.#subscription(value);
  }

  async updateSubscriptionQuantity(input: {
    subscriptionId: string;
    expected: BillingProviderSubscriptionUpdateExpectation;
    quantity: number;
    idempotencyReference: string;
    prorationBehavior: 'create_prorations';
  }): Promise<BillingProviderSubscription> {
    const current = await this.#client.subscriptions.retrieve(input.subscriptionId, {
      expand: ['items.data.price'],
    });
    const validatedCurrent = this.#subscription(current);
    if (validatedCurrent.id !== input.subscriptionId) throw new Error('STRIPE_SUBSCRIPTION_BINDING_CHANGED');
    assertSubscriptionUpdateBinding(validatedCurrent, input.expected, input.expected.quantity);
    if (current.items.data.length !== 1) throw new Error('STRIPE_SUBSCRIPTION_ITEMS_INVALID');
    const item = current.items.data[0];
    if (item === undefined) throw new Error('STRIPE_SUBSCRIPTION_ITEMS_INVALID');
    const updated = await this.#client.subscriptions.update(input.subscriptionId, {
      automatic_tax: {enabled: true},
      items: [{id: item.id, quantity: input.quantity}],
      proration_behavior: input.prorationBehavior,
      expand: ['items.data.price'],
    }, {idempotencyKey: input.idempotencyReference});
    const validatedUpdated = this.#subscription(updated);
    if (validatedUpdated.id !== input.subscriptionId) throw new Error('STRIPE_SUBSCRIPTION_BINDING_CHANGED');
    assertSubscriptionUpdateBinding(validatedUpdated, input.expected, input.quantity);
    return validatedUpdated;
  }

  verifyWebhook(rawBody: Buffer, signature: string): VerifiedBillingNotice | null {
    const event = this.#client.webhooks.constructEvent(rawBody, signature, this.#webhookSecret);
    const eventCreatedAt = timestamp(event.created);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = objectId(session.subscription);
      if (session.object !== 'checkout.session' || subscriptionId === null) throw new Error('STRIPE_EVENT_INVALID');
      return {
        provider: 'stripe', eventId: event.id, eventCreatedAt,
        subscriptionId, checkoutSessionId: session.id,
      };
    }
    if (event.type === 'customer.subscription.created'
      || event.type === 'customer.subscription.updated'
      || event.type === 'customer.subscription.deleted'
      || event.type === 'customer.subscription.paused'
      || event.type === 'customer.subscription.resumed') {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.object !== 'subscription') throw new Error('STRIPE_EVENT_INVALID');
      return {
        provider: 'stripe', eventId: event.id, eventCreatedAt,
        subscriptionId: subscription.id, checkoutSessionId: null,
      };
    }
    return null;
  }

  async #retrieveExpandedSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.#client.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price', 'subscription'],
    });
  }

  #checkoutSession(session: Stripe.Checkout.Session): BillingProviderCheckoutSession {
    const binding = metadata(session.metadata);
    const lineItems = session.line_items?.data ?? [];
    if (session.mode !== 'subscription' || session.client_reference_id !== binding.workspaceId
      || session.automatic_tax.enabled !== true
      || session.status === null || lineItems.length !== 1) throw new Error('STRIPE_CHECKOUT_SESSION_INVALID');
    const line = lineItems[0];
    if (line === undefined || line.price === null || line.quantity === null
      || line.price.id !== this.#priceIds[binding.plan]
      || line.price.currency !== 'usd'
      || line.price.unit_amount !== billingPrices[binding.plan].amountCents
      || line.price.recurring?.interval !== billingPrices[binding.plan].interval
      || line.adjustable_quantity?.enabled === true) throw new Error('STRIPE_CHECKOUT_LINE_ITEM_INVALID');
    return {
      id: session.id,
      checkoutReference: binding.checkoutReference,
      url: session.url,
      state: session.status,
      workspaceId: binding.workspaceId,
      ownerUserId: binding.ownerUserId,
      plan: binding.plan,
      priceId: line.price.id,
      quantity: line.quantity,
      customerId: objectId(session.customer),
      subscriptionId: objectId(session.subscription),
      createdAt: timestamp(session.created),
      expiresAt: timestamp(session.expires_at),
    };
  }

  #subscription(value: Stripe.Subscription): BillingProviderSubscription {
    const binding = metadata(value.metadata);
    if (value.items.data.length !== 1 || value.currency !== 'usd'
      || value.automatic_tax.enabled !== true) {
      throw new Error('STRIPE_SUBSCRIPTION_ITEMS_INVALID');
    }
    const item = value.items.data[0];
    if (item === undefined || item.quantity === undefined
      || item.price.id !== this.#priceIds[binding.plan]
      || item.price.currency !== 'usd'
      || item.price.unit_amount !== billingPrices[binding.plan].amountCents
      || item.price.recurring?.interval !== billingPrices[binding.plan].interval) {
      throw new Error('STRIPE_SUBSCRIPTION_PRICE_INVALID');
    }
    const customerId = objectId(value.customer);
    if (customerId === null) throw new Error('STRIPE_SUBSCRIPTION_CUSTOMER_INVALID');
    return {
      id: value.id,
      customerId,
      workspaceId: binding.workspaceId,
      ownerUserId: binding.ownerUserId,
      plan: binding.plan,
      priceId: item.price.id,
      quantity: item.quantity,
      status: subscriptionStatus(value.status),
      automaticTaxEnabled: true,
      currentPeriodEnd: timestamp(item.current_period_end),
      cancelAtPeriodEnd: value.cancel_at_period_end,
      providerUpdatedAt: canonicalNow(this.#clock),
    };
  }
}
