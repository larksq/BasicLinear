import { MemoryCreemCheckoutAttemptStore } from '../src/creem-checkout-attempts.js';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CreemBillingProvider } from '../src/creem-billing.js';

const now = '2026-09-14T00:00:00.000Z';
const secret = 'test-webhook-secret-at-least-32-bytes';
const metadata = {basiclinear_checkout_reference: 'a'.repeat(64), basiclinear_workspace_id: 'ws_creem_test',
  basiclinear_owner_user_id: 'owner_creem_test', basiclinear_plan: 'monthly', basiclinear_attempted_at: now};
const product = {id: 'prod_monthly123', mode: 'test', currency: 'USD', price: 200,
  billing_type: 'recurring', billing_period: 'every-month', tax_mode: 'exclusive'};
const checkout = {id: 'ch_checkout123', mode: 'test', status: 'pending', metadata, product, units: 2,
  checkout_url: 'https://www.creem.io/checkout/prod_monthly123/ch_checkout123'};
const subscription = {id: 'sub_subscription123', mode: 'test', status: 'active', metadata, product,
  customer: 'cust_customer123', current_period_end_date: '2026-10-14T00:00:00.000Z',
  items: [{id: 'sitem_seats123', product_id: product.id, units: 2}]};
function fixture(responses: unknown[]) {
  const calls: Array<{url: string; init: RequestInit}> = [];
  const provider = new CreemBillingProvider({checkoutAttemptStore: new MemoryCreemCheckoutAttemptStore(), apiKey: 'creem_test_fake_key_for_unit_tests', webhookSecret: secret,
    mode: 'test', monthlyProductId: product.id, annualProductId: 'prod_annual123',
    publicOrigin: 'https://online.example.com', clock: () => new Date(now),
    fetchImpl: (async (url, init) => {
      calls.push({url: String(url), init: init!});
      if (!responses.length) throw new Error('Unexpected provider call');
      return new Response(JSON.stringify(responses.shift()), {status: 200});
    }) as typeof fetch});
  return {provider, calls};
}
const input = {workspaceId: metadata.basiclinear_workspace_id, ownerUserId: metadata.basiclinear_owner_user_id,
  checkoutReference: metadata.basiclinear_checkout_reference, plan: 'monthly' as const, priceId: product.id,
  quantity: 2, idempotencyReference: 'trusted-idempotency-key', attemptedAt: now};

describe('Creem billing provider', () => {
  it('creates bound per-seat checkout using the sandbox and accepts the real www checkout URL', async () => {
    const {provider, calls} = fixture([product, checkout]);
    expect(await provider.createCheckoutSession(input)).toMatchObject({id: checkout.id, state: 'open',
      url: checkout.checkout_url, quantity: 2, createdAt: now, expiresAt: '2026-09-15T00:00:00.000Z'});
    expect(calls.map(c => c.url)).toEqual(['https://test-api.creem.io/v1/products?product_id=prod_monthly123',
      'https://test-api.creem.io/v1/checkouts']);
    expect(JSON.parse(calls[1]!.init.body as string)).toMatchObject({product_id: product.id, units: 2,
      metadata, success_url: 'https://online.example.com/?app&billing=success'});
    expect(calls[1]!.init.redirect).toBe('error');
  });
  it('accepts the observed Creem sandbox checkout path', async () => {
    const value = {...checkout, checkout_url: `https://creem.io/test/checkout/${product.id}/${checkout.id}`};
    expect((await fixture([value]).provider.retrieveCheckoutSession(checkout.id)).url).toBe(value.checkout_url);
  });
  it.each([
    {...checkout, mode: 'prod'}, {...checkout, product: {...product, price: 1}},
    {...checkout, product: {...product, currency: 'EUR'}},
    {...checkout, checkout_url: 'https://www.creem.io.attacker.example/checkout/prod_monthly123/ch_checkout123'},
    {...checkout, checkout_url: 'https://www.creem.io/checkout/prod_other123/ch_checkout123'},
    {...checkout, units: 0}, {...checkout, status: 'completed'},
    {...checkout, metadata: {...metadata, basiclinear_plan: 'unknown'}},
  ])('rejects invalid provider state %#', async value => {
    await expect(fixture([value]).provider.retrieveCheckoutSession(checkout.id)).rejects.toThrow();
  });
  it('rejects returned cross-workspace checkout before returning the payment link', async () => {
    await expect(fixture([product, {...checkout, metadata: {...metadata, basiclinear_workspace_id: 'ws_foreign'}}])
      .provider.createCheckoutSession(input)).rejects.toThrow('CREEM_CHECKOUT_BINDING_INVALID');
  });
  it('verifies raw-body signatures and extracts provider references', () => {
    const {provider} = fixture([]);
    const raw = Buffer.from(JSON.stringify({id: 'evt_event123', created_at: Date.parse(now), eventType: 'checkout.completed',
      object: {...checkout, status: 'completed', subscription: subscription.id}}));
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    expect(provider.verifyWebhook(raw, signature)).toEqual({provider: 'creem', eventId: 'evt_event123',
      eventCreatedAt: now, subscriptionId: subscription.id, checkoutSessionId: checkout.id});
    expect(() => provider.verifyWebhook(Buffer.concat([raw, Buffer.from(' ')]), signature)).toThrow('CREEM_SIGNATURE_INVALID');
    expect(() => provider.verifyWebhook(raw, 'bad')).toThrow('CREEM_SIGNATURE_INVALID');
  });
  it.each(['active', 'paid', 'canceled', 'scheduled_cancel', 'expired', 'past_due'])('accepts signed subscription.%s notices', event => {
    const raw = Buffer.from(JSON.stringify({id: 'evt_event123', created_at: Date.parse(now),
      eventType: `subscription.${event}`, object: subscription}));
    expect(fixture([]).provider.verifyWebhook(raw, createHmac('sha256', secret).update(raw).digest('hex')))
      .toMatchObject({provider: 'creem', subscriptionId: subscription.id, checkoutSessionId: null});
  });
  it('retains access through scheduled cancellation and maps expired subscriptions to canceled', async () => {
    const {provider} = fixture([{...subscription, status: 'scheduled_cancel'}, {...subscription, status: 'expired'}]);
    expect(await provider.retrieveSubscription(subscription.id)).toMatchObject({status: 'active', cancelAtPeriodEnd: true});
    expect(await provider.retrieveSubscription(subscription.id)).toMatchObject({status: 'canceled', cancelAtPeriodEnd: false});
  });
  it('changes seats with proration and avoids reapplying an already-completed update', async () => {
    const changed = {...subscription, items: [{...subscription.items[0], units: 3}]};
    const {provider, calls} = fixture([subscription, subscription, changed, changed]);
    const current = await provider.retrieveSubscription(subscription.id);
    const {id: _id, providerUpdatedAt: _time, automaticTaxEnabled: _tax, ...expected} = current;
    const update = {subscriptionId: subscription.id, expected, quantity: 3,
      idempotencyReference: 'seat-change-1', prorationBehavior: 'create_prorations' as const};
    expect((await provider.updateSubscriptionQuantity(update)).quantity).toBe(3);
    expect((await provider.updateSubscriptionQuantity(update)).quantity).toBe(3);
    const posts = calls.filter(c => c.init.method === 'POST');
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0]!.init.body as string)).toEqual({items: [{id: 'sitem_seats123', product_id: product.id, units: 3}],
      update_behavior: 'proration-charge'});
  });
  it('fails closed when an unresolved checkout cannot be expired or recovered', async () => {
    const {provider} = fixture([checkout]);
    await expect(provider.expireCheckoutSession(checkout.id)).rejects.toThrow('CREEM_CHECKOUT_STILL_PAYABLE');
    await expect(provider.recoverCheckoutSessions()).rejects.toThrow('CREEM_CHECKOUT_RECOVERY_REQUIRES_RECONCILIATION');
  });
});

it('reuses a persisted checkout instead of relying on Creem request_id deduplication', async () => {
  const {provider, calls} = fixture([product, checkout, product, checkout]);
  const first = await provider.createCheckoutSession(input);
  expect((await provider.createCheckoutSession(input)).id).toBe(first.id);
  expect(calls.filter(call => call.init.method === 'POST')).toHaveLength(1);
});
it('does not resend an uncertain checkout attempt', async () => {
  const {provider, calls} = fixture([product, null, product]);
  await expect(provider.createCheckoutSession(input)).rejects.toThrow();
  await expect(provider.createCheckoutSession(input)).rejects.toThrow('CREEM_CHECKOUT_RECOVERY_REQUIRES_RECONCILIATION');
  expect(calls.filter(call => call.init.method === 'POST')).toHaveLength(1);
});
