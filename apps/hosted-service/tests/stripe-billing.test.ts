import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { StripeBillingProvider } from '../src/stripe-billing.js';

const metadata = {
  openlinear_checkout_reference: 'a'.repeat(64),
  openlinear_workspace_id: 'ws_stripe_test',
  openlinear_owner_user_id: 'owner_stripe_test',
  openlinear_plan: 'monthly',
};

const expectedSubscription = {
  customerId: 'cus_openlinear',
  workspaceId: 'ws_stripe_test',
  ownerUserId: 'owner_stripe_test',
  plan: 'monthly' as const,
  priceId: 'price_monthly123',
  quantity: 2,
  status: 'active' as const,
  currentPeriodEnd: '2026-10-02T01:46:40.000Z',
  cancelAtPeriodEnd: false,
};

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test_openlinear', object: 'checkout.session', mode: 'subscription',
    client_reference_id: 'ws_stripe_test', status: 'open', url: 'https://checkout.stripe.test/openlinear',
    metadata, expires_at: 1_788_227_200, customer: null, subscription: null,
    created: 1_788_220_800,
    automatic_tax: {enabled: true, liability: null, provider: null, status: null},
    line_items: {data: [{
      id: 'li_openlinear', object: 'item', price: {
        id: 'price_monthly123', currency: 'usd', unit_amount: 200, recurring: {interval: 'month'},
      }, quantity: 2, adjustable_quantity: null,
    }]},
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_openlinear', object: 'subscription', customer: 'cus_openlinear', currency: 'usd',
    metadata, status: 'active', cancel_at_period_end: false,
    automatic_tax: {enabled: true, liability: null, disabled_reason: null},
    items: {data: [{
      id: 'si_openlinear', quantity: 2, current_period_end: 1_790_905_600,
      price: {id: 'price_monthly123', currency: 'usd', unit_amount: 200, recurring: {interval: 'month'}},
    }]},
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function fixture() {
  const calls: Array<{name: string; args: unknown[]}> = [];
  let currentSession = session();
  let currentSubscription = subscription();
  let checkoutListHandler: ((...args: unknown[]) => Promise<unknown>) | null = null;
  let webhookEvent: Stripe.Event = {
    id: 'evt_openlinear', object: 'event', api_version: '2026-08-01', created: 1_788_220_800,
    data: {object: {...currentSession, status: 'complete', subscription: 'sub_openlinear'}},
    livemode: false, pending_webhooks: 1, request: null, type: 'checkout.session.completed',
  } as unknown as Stripe.Event;
  const client = {
    checkout: {sessions: {
      create: async (...args: unknown[]) => { calls.push({name: 'checkout.create', args}); return currentSession; },
      retrieve: async (...args: unknown[]) => { calls.push({name: 'checkout.retrieve', args}); return currentSession; },
      expire: async (...args: unknown[]) => { calls.push({name: 'checkout.expire', args}); return {...currentSession, status: 'expired'}; },
      list: async (...args: unknown[]) => {
        calls.push({name: 'checkout.list', args});
        if (checkoutListHandler !== null) return checkoutListHandler(...args);
        return {object: 'list', data: [currentSession], has_more: false, url: '/v1/checkout/sessions'};
      },
    }},
    subscriptions: {
      retrieve: async (...args: unknown[]) => { calls.push({name: 'subscription.retrieve', args}); return currentSubscription; },
      update: async (...args: unknown[]) => {
        calls.push({name: 'subscription.update', args});
        const params = args[1] as {items?: Array<{quantity?: number}>};
        const quantity = params.items?.[0]?.quantity;
        currentSubscription = subscription({
          ...currentSubscription,
          items: {data: currentSubscription.items.data.map((item, index) => (
            index === 0 && quantity !== undefined ? {...item, quantity} : item
          ))},
        });
        return currentSubscription;
      },
    },
    webhooks: {
      constructEvent: (...args: unknown[]) => { calls.push({name: 'webhook.verify', args}); return webhookEvent; },
    },
  } as unknown as Stripe;
  const provider = new StripeBillingProvider({
    secretKey: `sk_test_${'a'.repeat(24)}`,
    webhookSecret: `whsec_${'b'.repeat(24)}`,
    monthlyPriceId: 'price_monthly123', annualPriceId: 'price_annual1234',
    publicOrigin: 'https://online.example.com',
    clock: () => new Date('2026-09-01T00:00:00.000Z'), client,
  });
  return {
    provider, calls,
    setSession(value: Stripe.Checkout.Session) { currentSession = value; },
    setSubscription(value: Stripe.Subscription) { currentSubscription = value; },
    setWebhookEvent(value: Stripe.Event) { webhookEvent = value; },
    setCheckoutListHandler(value: (...args: unknown[]) => Promise<unknown>) {
      checkoutListHandler = value;
    },
  };
}

describe('StripeBillingProvider', () => {
  it('creates one fixed-quantity recurring line item with exact same-origin returns and server metadata', async () => {
    const {provider, calls} = fixture();
    const result = await provider.createCheckoutSession({
      checkoutReference: 'a'.repeat(64),
      workspaceId: 'ws_stripe_test', ownerUserId: 'owner_stripe_test', plan: 'monthly',
      priceId: 'price_monthly123', quantity: 2, idempotencyReference: 'checkout:opaque',
    });
    expect(result).toMatchObject({plan: 'monthly', priceId: 'price_monthly123', quantity: 2});
    const create = calls.find((value) => value.name === 'checkout.create');
    expect(create?.args).toEqual([
      expect.objectContaining({
        mode: 'subscription', line_items: [{price: 'price_monthly123', quantity: 2}],
        allow_promotion_codes: false,
        automatic_tax: {enabled: true},
        success_url: 'https://online.example.com/?app&billing=success&session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://online.example.com/?app&billing=cancelled',
        metadata, subscription_data: {metadata},
      }),
      {idempotencyKey: 'checkout:opaque'},
    ]);
    expect((create?.args[0] as Record<string, unknown>).adjustable_quantity).toBeUndefined();
    expect((create?.args[0] as Record<string, unknown>).trial_period_days).toBeUndefined();
  });

  it('uses explicit proration and the existing single subscription item for seat changes', async () => {
    const {provider, calls} = fixture();
    await provider.updateSubscriptionQuantity({
      subscriptionId: 'sub_openlinear', quantity: 3,
      expected: expectedSubscription,
      idempotencyReference: 'seats:opaque', prorationBehavior: 'create_prorations',
    });
    expect(calls.find((value) => value.name === 'subscription.update')?.args).toEqual([
      'sub_openlinear',
      expect.objectContaining({
        automatic_tax: {enabled: true},
        items: [{id: 'si_openlinear', quantity: 3}],
        proration_behavior: 'create_prorations',
      }),
      {idempotencyKey: 'seats:opaque'},
    ]);
  });

  it('validates automatic tax before any prorated quantity mutation', async () => {
    const {provider, calls, setSubscription} = fixture();
    setSubscription(subscription({
      automatic_tax: {enabled: false, liability: null, disabled_reason: null},
    }));
    await expect(provider.updateSubscriptionQuantity({
      subscriptionId: 'sub_openlinear', quantity: 3,
      expected: expectedSubscription,
      idempotencyReference: 'seats:tax-disabled', prorationBehavior: 'create_prorations',
    })).rejects.toThrow(/ITEMS/u);
    expect(calls.filter((value) => value.name === 'subscription.update')).toHaveLength(0);
  });

  it('recovers only Checkout sessions carrying the exact opaque checkout reference', async () => {
    const {provider, calls} = fixture();
    await expect(provider.recoverCheckoutSessions({
      checkoutReference: 'a'.repeat(64),
      createdAt: '2026-09-01T00:00:00.000Z',
      attemptedAt: '2026-09-01T00:00:00.000Z',
    })).resolves.toEqual([expect.objectContaining({
      id: 'cs_test_openlinear', checkoutReference: 'a'.repeat(64),
      createdAt: '2026-09-01T00:00:00.000Z',
    })]);
    expect(calls.find((value) => value.name === 'checkout.list')?.args[0]).toEqual(expect.objectContaining({
      created: {gte: 1_788_220_500, lte: 1_788_307_800},
      limit: 100,
    }));
  });

  it('enumerates beyond 1,000 unrelated Checkout sessions before returning an exact reference', async () => {
    const {provider, calls, setCheckoutListHandler} = fixture();
    const unrelatedMetadata = {...metadata, openlinear_checkout_reference: 'b'.repeat(64)};
    const pages = Array.from({length: 11}, (_, pageIndex) => ({
      object: 'list' as const,
      data: pageIndex === 10
        ? [session({id: 'cs_exact_after_1000'})]
        : Array.from({length: 100}, (_, itemIndex) => ({
          id: `cs_unrelated_${pageIndex}_${itemIndex}`,
          metadata: unrelatedMetadata,
        } as unknown as Stripe.Checkout.Session)),
      has_more: pageIndex < 10,
      url: '/v1/checkout/sessions',
    }));
    let pageIndex = 0;
    setCheckoutListHandler(async () => pages[pageIndex++]);

    await expect(provider.recoverCheckoutSessions({
      checkoutReference: 'a'.repeat(64),
      createdAt: '2026-09-01T00:00:00.000Z',
      attemptedAt: '2026-09-01T00:00:00.000Z',
    })).resolves.toEqual([expect.objectContaining({id: 'cs_exact_after_1000'})]);
    expect(calls.filter((value) => value.name === 'checkout.list')).toHaveLength(11);
  });

  it('fails closed when provider pagination does not advance its cursor', async () => {
    const {provider, calls, setCheckoutListHandler} = fixture();
    setCheckoutListHandler(async () => ({
      object: 'list',
      data: [{id: 'cs_repeated_cursor', metadata: {
        ...metadata, openlinear_checkout_reference: 'b'.repeat(64),
      }}],
      has_more: true,
      url: '/v1/checkout/sessions',
    }));
    await expect(provider.recoverCheckoutSessions({
      checkoutReference: 'a'.repeat(64),
      createdAt: '2026-09-01T00:00:00.000Z',
      attemptedAt: '2026-09-01T00:00:00.000Z',
    })).rejects.toThrow(/RECOVERY_INVALID/u);
    expect(calls.filter((value) => value.name === 'checkout.list')).toHaveLength(2);
  });

  it('makes no quantity mutation after any exact subscription binding changes', async () => {
    const annual = subscription({
      metadata: {...metadata, openlinear_plan: 'annual'},
      items: {data: [{
        id: 'si_openlinear', quantity: 2, current_period_end: 1_790_905_600,
        price: {id: 'price_annual1234', currency: 'usd', unit_amount: 1200, recurring: {interval: 'year'}},
      }]},
    });
    const changedSubscriptions = [
      subscription({customer: 'cus_foreign'}),
      subscription({metadata: {...metadata, openlinear_workspace_id: 'ws_foreign_test'}}),
      subscription({metadata: {...metadata, openlinear_owner_user_id: 'owner_foreign_test'}}),
      annual,
      subscription({status: 'canceled'}),
      subscription({items: {data: [{
        id: 'si_openlinear', quantity: 4, current_period_end: 1_790_905_600,
        price: {id: 'price_monthly123', currency: 'usd', unit_amount: 200, recurring: {interval: 'month'}},
      }]}}),
    ];
    for (const changed of changedSubscriptions) {
      const {provider, calls, setSubscription} = fixture();
      setSubscription(changed);
      await expect(provider.updateSubscriptionQuantity({
        subscriptionId: 'sub_openlinear', expected: expectedSubscription, quantity: 3,
        idempotencyReference: 'seats:changed-binding', prorationBehavior: 'create_prorations',
      })).rejects.toThrow();
      expect(calls.filter((value) => value.name === 'subscription.update')).toHaveLength(0);
    }
  });

  it('verifies the raw webhook before returning a minimal notice and ignores unsupported events', () => {
    const {provider, calls, setWebhookEvent} = fixture();
    const body = Buffer.from('{"private":"provider payload"}', 'utf8');
    expect(provider.verifyWebhook(body, 't=123,v1=signed')).toEqual({
      provider: 'stripe', eventId: 'evt_openlinear', eventCreatedAt: '2026-09-01T00:00:00.000Z',
      subscriptionId: 'sub_openlinear', checkoutSessionId: 'cs_test_openlinear',
    });
    expect(calls[0]).toEqual({name: 'webhook.verify', args: [body, 't=123,v1=signed', `whsec_${'b'.repeat(24)}`]});
    setWebhookEvent({
      id: 'evt_ignored', object: 'event', api_version: '2026-08-01', created: 1_788_220_800,
      data: {object: {}}, livemode: false, pending_webhooks: 1, request: null,
      type: 'charge.succeeded',
    } as unknown as Stripe.Event);
    expect(provider.verifyWebhook(body, 't=123,v1=signed')).toBeNull();
    setWebhookEvent({
      id: 'evt_refund_ignored', object: 'event', api_version: '2026-08-01', created: 1_788_220_800,
      data: {object: {}}, livemode: false, pending_webhooks: 1, request: null,
      type: 'charge.refunded',
    } as unknown as Stripe.Event);
    expect(provider.verifyWebhook(body, 't=123,v1=signed')).toBeNull();
  });

  it('fails closed for amount, interval, metadata, item-count, or quantity binding changes', async () => {
    const {provider, setSession, setSubscription} = fixture();
    setSession(session({line_items: {data: [{
      id: 'li_bad', object: 'item', price: {
        id: 'price_monthly123', currency: 'usd', unit_amount: 999, recurring: {interval: 'month'},
      }, quantity: 2, adjustable_quantity: null,
    }]}}));
    await expect(provider.retrieveCheckoutSession('cs_test_openlinear')).rejects.toThrow(/LINE_ITEM/u);
    setSubscription(subscription({metadata: {...metadata, attacker: 'value'}}));
    await expect(provider.retrieveSubscription('sub_openlinear')).rejects.toThrow(/METADATA/u);
    setSubscription(subscription({automatic_tax: {enabled: false, liability: null, disabled_reason: null}}));
    await expect(provider.retrieveSubscription('sub_openlinear')).rejects.toThrow(/ITEMS/u);
  });
});
