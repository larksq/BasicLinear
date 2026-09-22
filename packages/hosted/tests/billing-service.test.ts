import { describe, expect, it } from 'vitest';
import {
  BillingEntitlementPolicy,
  BillingService,
  BillingServiceError,
  MemoryBillingRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  type BillingProvider,
  type BillingProviderCheckoutSession,
  type BillingProviderSubscription,
  type BillingTransaction,
  type WorkspacePrincipal,
} from '../src/index.js';

const workspaceId = 'ws_billingexample000000000000000001';
const ownerUserId = 'owner_google_123';
const memberUserId = 'member_google_456';
const startedAt = '2026-08-01T00:00:00.000Z';
const trialEndsAt = '2026-08-31T00:00:00.000Z';
const secret = 'billing-secret-that-is-at-least-thirty-two-bytes';
const monthlyPriceId = 'price_basiclinear_monthly';
const annualPriceId = 'price_basiclinear_annual';
const principal: WorkspacePrincipal = {kind: 'user', userId: ownerUserId, source: 'web'};

function seed(activeMember = true): Record<string, unknown> {
  return {
    [`workspaces/${workspaceId}`]: {
      schemaVersion: 1, id: workspaceId, workspaceId, name: 'BasicLinear workspace',
      ownerUid: ownerUserId, authority: 'firebase-hosted', createdAt: startedAt, revision: 1,
    },
    [`workspaces/${workspaceId}/entitlements/current`]: {
      schemaVersion: 1, id: 'trial_billingexample', workspaceId, plan: 'pro', status: 'active',
      trialStartedAt: startedAt, trialEndsAt, source: 'owner_bootstrap', revision: 1,
    },
    [`workspaces/${workspaceId}/memberships/${ownerUserId}`]: {
      schemaVersion: 1, id: 'mem_owner_billingexample', workspaceId, userId: ownerUserId,
      role: 'owner', status: 'active', createdAt: startedAt, revision: 1,
    },
    ...(activeMember ? {
      [`workspaces/${workspaceId}/memberships/${memberUserId}`]: {
        schemaVersion: 1, id: 'mem_member_billingexample', workspaceId, userId: memberUserId,
        role: 'member', status: 'active', createdAt: '2026-08-02T00:00:00.000Z',
        updatedAt: '2026-08-02T00:00:00.000Z', removedAt: null, revision: 1,
      },
    } : {}),
    [`workspaces/${workspaceId}/invitations/inv_pending`]: {
      schemaVersion: 1, id: 'inv_pending', workspaceId, invitedEmail: 'pending@example.com',
      inviterUserId: ownerUserId, inviterDisplayName: 'Owner', workspaceName: 'BasicLinear workspace',
      role: 'member', status: 'pending', createdAt: '2026-08-19T00:00:00.000Z',
      updatedAt: '2026-08-19T00:00:00.000Z', lastSentAt: '2026-08-19T00:00:00.000Z',
      expiresAt: '2026-08-26T00:00:00.000Z', acceptedAt: null, acceptedUserId: null,
      revokedAt: null, currentTokenDigest: 'a'.repeat(64), sendCount: 1,
      activeSeatApplied: false, revision: 1,
    },
  };
}

class MemoryProvider implements BillingProvider {
  readonly sessions = new Map<string, BillingProviderCheckoutSession>();
  readonly subscriptions = new Map<string, BillingProviderSubscription>();
  readonly creates: Array<Parameters<BillingProvider['createCheckoutSession']>[0]> = [];
  readonly quantityUpdates: Array<Parameters<BillingProvider['updateSubscriptionQuantity']>[0]> = [];
  readonly checkoutIdempotency = new Map<string, string>();

  constructor(private readonly clock: () => Date) {}

  async createCheckoutSession(input: Parameters<BillingProvider['createCheckoutSession']>[0]) {
    this.creates.push(structuredClone(input));
    const existingId = this.checkoutIdempotency.get(input.idempotencyReference);
    const existing = existingId === undefined ? undefined : this.sessions.get(existingId);
    if (existing !== undefined) return structuredClone(existing);
    const value: BillingProviderCheckoutSession = {
      id: `cs_test_${this.sessions.size + 1}`, checkoutReference: input.checkoutReference,
      url: `https://checkout.stripe.test/session/${this.sessions.size + 1}`,
      state: 'open', workspaceId: input.workspaceId, ownerUserId: input.ownerUserId,
      plan: input.plan, priceId: input.priceId, quantity: input.quantity,
      customerId: null, subscriptionId: null,
      createdAt: this.clock().toISOString(),
      expiresAt: new Date(this.clock().getTime() + 60 * 60 * 1_000).toISOString(),
    };
    this.sessions.set(value.id, structuredClone(value));
    this.checkoutIdempotency.set(input.idempotencyReference, value.id);
    return value;
  }

  async retrieveCheckoutSession(sessionId: string) {
    const value = this.sessions.get(sessionId);
    if (value === undefined) throw new Error('missing');
    return structuredClone(value);
  }

  async recoverCheckoutSessions(input: Parameters<BillingProvider['recoverCheckoutSessions']>[0]) {
    return [...this.sessions.values()]
      .filter((value) => value.checkoutReference === input.checkoutReference
        && Date.parse(value.createdAt) >= Date.parse(input.createdAt) - 5 * 60 * 1_000
        && Date.parse(value.createdAt) <= Date.parse(input.attemptedAt)
          + 24 * 60 * 60 * 1_000 + 10 * 60 * 1_000)
      .map((value) => structuredClone(value));
  }

  async expireCheckoutSession(sessionId: string) {
    const value = this.sessions.get(sessionId);
    if (value !== undefined) this.sessions.set(sessionId, {...value, state: 'expired', url: null});
  }

  async retrieveSubscription(subscriptionId: string) {
    const value = this.subscriptions.get(subscriptionId);
    if (value === undefined) throw new Error('missing');
    return structuredClone(value);
  }

  async updateSubscriptionQuantity(input: Parameters<BillingProvider['updateSubscriptionQuantity']>[0]) {
    const value = await this.retrieveSubscription(input.subscriptionId);
    if (value.customerId !== input.expected.customerId
      || value.workspaceId !== input.expected.workspaceId
      || value.ownerUserId !== input.expected.ownerUserId
      || value.plan !== input.expected.plan
      || value.priceId !== input.expected.priceId
      || value.quantity !== input.expected.quantity
      || value.status !== input.expected.status
      || value.currentPeriodEnd !== input.expected.currentPeriodEnd
      || value.cancelAtPeriodEnd !== input.expected.cancelAtPeriodEnd) {
      throw new Error('provider subscription changed before mutation');
    }
    this.quantityUpdates.push(structuredClone(input));
    const updated = {...value, quantity: input.quantity, providerUpdatedAt: this.clock().toISOString()};
    this.subscriptions.set(input.subscriptionId, structuredClone(updated));
    return updated;
  }
}

class FaultInjectingBillingRepository extends MemoryBillingRepository {
  failNextTransactions = 0;

  override runTransaction<Value>(
    operation: (transaction: BillingTransaction) => Promise<Value>,
  ): Promise<Value> {
    if (this.failNextTransactions > 0) {
      this.failNextTransactions -= 1;
      return Promise.reject(new Error('injected billing repository outage'));
    }
    return super.runTransaction(operation);
  }
}

function fixture(
  now = '2026-08-20T00:00:00.000Z',
  activeMember = true,
  repository: MemoryBillingRepository = new MemoryBillingRepository(seed(activeMember)),
  activationPolicy: {assertBillingActivationAllowed(input: {
    workspaceId: string;
    ownerUserId: string;
    requestId: string;
  }): Promise<void>} = {assertBillingActivationAllowed: async () => {}},
) {
  let current = new Date(now);
  const memberships = new MemoryWorkspaceMembershipReader();
  memberships.set({schemaVersion: 1, workspaceId, userId: ownerUserId, role: 'owner', status: 'active', revision: 1});
  if (activeMember) {
    memberships.set({schemaVersion: 1, workspaceId, userId: memberUserId, role: 'member', status: 'active', revision: 1});
  }
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    {clock: () => current, idFactory: () => 'auth-billing-00000000000000000001'},
  );
  const provider = new MemoryProvider(() => current);
  const service = new BillingService(repository, authorization, provider, {
    secret, monthlyPriceId, annualPriceId, activationPolicy, clock: () => current,
  });
  return {repository, provider, service, setNow(value: string) { current = new Date(value); }};
}

describe('BillingService', () => {
  it('reports exact server-owned totals, trial dates, active seats, and non-seat pending invitations', async () => {
    const {service} = fixture();
    await expect(service.summary({principal, workspaceId, requestId: 'request_billing_summary'})).resolves.toEqual({
      workspaceId,
      mode: 'trial_pro',
      trial: {startedAt, endsAt: trialEndsAt, active: true},
      seats: {active: 2, pendingInvitations: 1},
      prices: {
        currency: 'usd', monthlyPerSeatCents: 200, annualPerSeatCents: 1200,
        monthlyTotalCents: 400, annualTotalCents: 2400,
      },
      subscription: null,
      free: {
        writerUserId: ownerUserId, dataReadable: true,
        exportEligible: true, exportAvailable: true,
        extraMemberWritesPaused: true, automationWritesPaused: true,
      },
    });
  });

  it.each(['pending', 'accepted', 'revoked'] as const)('reads %s invitations with team assignments without changing seat totals', async (status) => {
    const data = seed();
    const path = `workspaces/${workspaceId}/invitations/inv_pending`;
    data[path] = {
      ...(data[path] as Record<string, unknown>), status,
      teamIds: ['team_' + 'a'.repeat(32)],
      acceptedAt: status === 'accepted' ? '2026-08-19T00:00:00.000Z' : null,
      acceptedUserId: status === 'accepted' ? memberUserId : null,
      activeSeatApplied: status === 'accepted',
      revokedAt: status === 'revoked' ? '2026-08-19T00:00:00.000Z' : null,
    };
    const {service} = fixture(undefined, true, new MemoryBillingRepository(data));
    await expect(service.summary({principal, workspaceId, requestId: 'team_invitation_summary'}))
      .resolves.toMatchObject({seats: {active: 2, pendingInvitations: status === 'pending' ? 1 : 0}});
  });

  it.each([null, ['invalid'], ['team_' + 'a'.repeat(32), 'team_' + 'a'.repeat(32)],
    ['team_' + 'b'.repeat(32), 'team_' + 'a'.repeat(32)],
    Array.from({length: 21}, (_, i) => 'team_' + i.toString(16).padStart(32, '0')),
  ].map((teamIds) => ({teamIds})))('rejects malformed invitation team assignments: $teamIds', async ({teamIds}) => {
    const data = seed();
    const path = `workspaces/${workspaceId}/invitations/inv_pending`;
    data[path] = {...(data[path] as Record<string, unknown>), teamIds};
    const {service} = fixture(undefined, true, new MemoryBillingRepository(data));
    await expect(service.summary({principal, workspaceId, requestId: 'invalid_team_invitation'}))
      .rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
  });

  it('provisions one no-charge allowlisted verification grant without changing the 30-day trial', async () => {
    const {service, provider, setNow} = fixture();
    await expect(service.ensureVerificationAccess({
      workspaceId,
      ownerUserId,
      ownerEmail: ' LarksQ@gmail.com ',
    })).resolves.toEqual({endsAt: '9999-12-31T23:59:59.999Z', created: true});
    await expect(service.ensureVerificationAccess({
      workspaceId,
      ownerUserId,
      ownerEmail: 'larksq@gmail.com',
    })).resolves.toEqual({endsAt: '9999-12-31T23:59:59.999Z', created: false});

    setNow('2027-08-20T00:00:00.000Z');
    await expect(service.summary({
      principal,
      workspaceId,
      requestId: 'request_verification_summary',
    })).resolves.toMatchObject({
      mode: 'trial_pro',
      trial: {endsAt: trialEndsAt, active: false},
      subscription: null,
      verificationAccess: {
        source: 'operator_allowlist',
        endsAt: '9999-12-31T23:59:59.999Z',
        noCharge: true,
      },
    });
    await expect(service.createCheckout({
      principal,
      workspaceId,
      requestId: 'request_verification_checkout',
      idempotencyKey: 'verification-checkout-key-0001',
      plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'} satisfies Partial<BillingServiceError>);
    expect(provider.creates).toHaveLength(0);
  });

  it('creates and replays checkout from trusted price and active-seat state only', async () => {
    const {service, provider} = fixture();
    const command = {
      principal, workspaceId, requestId: 'request_billing_checkout',
      idempotencyKey: 'checkout-key-0000000001', plan: 'annual' as const,
    };
    const first = await service.createCheckout(command);
    const replay = await service.createCheckout(command);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({plan: 'annual', activeSeats: 2, totalCents: 2400, currency: 'usd'});
    expect(provider.creates).toHaveLength(1);
    expect(provider.creates[0]).toMatchObject({priceId: annualPriceId, quantity: 2, plan: 'annual'});
    await expect(service.createCheckout({
      ...command,
      requestId: 'request_parallel_checkout',
      idempotencyKey: 'checkout-key-0000000002',
      plan: 'monthly',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.creates).toHaveLength(1);
    expect(provider.sessions.get('cs_test_1')).toMatchObject({state: 'open', plan: 'annual'});
  });

  it('blocks paid activation before checkout preparation when operations evidence is unavailable', async () => {
    const repository = new MemoryBillingRepository(seed());
    const before = repository.snapshot();
    const {service, provider} = fixture(
      '2026-08-20T00:00:00.000Z',
      true,
      repository,
      {assertBillingActivationAllowed: async () => { throw new Error('operations blocked'); }},
    );
    await expect(service.createCheckout({
      principal,
      workspaceId,
      requestId: 'request_operations_blocked_checkout',
      idempotencyKey: 'checkout-operations-blocked-01',
      plan: 'monthly',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.snapshot()).toEqual(before);
    expect(provider.creates).toHaveLength(0);
    expect(provider.quantityUpdates).toHaveLength(0);
  });

  it('rechecks operations immediately before provider creation and safely resumes a prepared checkout', async () => {
    let activationChecks = 0;
    const activationPolicy = {
      assertBillingActivationAllowed: async () => {
        activationChecks += 1;
        if (activationChecks === 2) throw new Error('budget changed before provider call');
      },
    };
    const {service, provider, repository} = fixture(
      '2026-08-20T00:00:00.000Z',
      true,
      new MemoryBillingRepository(seed()),
      activationPolicy,
    );
    const command = {
      principal,
      workspaceId,
      requestId: 'request_operations_race_checkout',
      idempotencyKey: 'checkout-operations-race-0001',
      plan: 'annual' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(provider.creates).toHaveLength(0);
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {state?: string}
    ).state === 'prepared')).toBeDefined();
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`)).toBeNull();

    await expect(service.createCheckout({...command, requestId: 'request_operations_race_retry'}))
      .resolves.toMatchObject({plan: 'annual', activeSeats: 2});
    expect(provider.creates).toHaveLength(1);
    expect(activationChecks).toBe(4);
  });

  it('releases one provider-confirmed expired Checkout before allowing a new plan', async () => {
    const {service, provider, setNow} = fixture();
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_expiring_checkout',
      idempotencyKey: 'checkout-expiring-00001', plan: 'monthly',
    });
    provider.sessions.set('cs_test_1', {
      ...(provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession),
      state: 'expired', url: null,
    });
    setNow('2026-08-20T00:10:00.000Z');
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_after_expired_checkout',
      idempotencyKey: 'checkout-after-expired-01', plan: 'annual',
    })).resolves.toMatchObject({checkoutSessionId: 'cs_test_2', plan: 'annual', activeSeats: 2});
    expect(provider.creates).toHaveLength(2);
  });

  it('expires a provider session and fails when seats drift before checkout finalization', async () => {
    const {service, provider, repository} = fixture();
    const originalCreate = provider.createCheckoutSession.bind(provider);
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      repository.seedDocument(`workspaces/${workspaceId}/memberships/late_member`, {
        schemaVersion: 1, id: 'mem_late_member', workspaceId, userId: 'late_member', role: 'member',
        status: 'active', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z',
        removedAt: null, revision: 1,
      });
      return session;
    };
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_checkout_drift',
      idempotencyKey: 'checkout-drift-0000001', plan: 'monthly',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.sessions.get('cs_test_1')?.state).toBe('expired');
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_checkout_after_drift',
      idempotencyKey: 'checkout-after-drift-001', plan: 'annual',
    })).resolves.toMatchObject({checkoutSessionId: 'cs_test_2', activeSeats: 3, plan: 'annual'});
  });

  it('recovers a prepared Checkout lock after provider creation and two persistence failures', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider} = fixture('2026-08-20T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    let injectFailures = true;
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      if (injectFailures) {
        repository.failNextTransactions = 2;
        injectFailures = false;
      }
      return session;
    };
    const command = {
      principal, workspaceId, requestId: 'request_checkout_dual_persistence_failure',
      idempotencyKey: 'checkout-dual-failure-0001', plan: 'monthly' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(provider.sessions.get('cs_test_1')).toMatchObject({state: 'expired'});
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {state?: string}
    ).state === 'prepared')).toBeDefined();

    await expect(service.createCheckout({...command, requestId: 'request_checkout_dual_failure_retry'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1')).toMatchObject({state: 'ready'});

    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_checkout_after_dual_failure',
      idempotencyKey: 'checkout-after-dual-failure-01', plan: 'annual',
    })).resolves.toMatchObject({checkoutSessionId: 'cs_test_2', plan: 'annual'});
  });

  it('binds a completed provider recovery despite membership drift and lets its signed notice converge', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider} = fixture('2026-09-01T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    let injectFailure = true;
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      if (injectFailure) {
        injectFailure = false;
        repository.seedDocument(`workspaces/${workspaceId}/memberships/member_after_provider`, {
          schemaVersion: 1, id: 'mem_member_after_provider', workspaceId,
          userId: 'member_after_provider', role: 'member', status: 'active',
          createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
          removedAt: null, revision: 1,
        });
        repository.failNextTransactions = 1;
      }
      return session;
    };
    provider.expireCheckoutSession = async (sessionId) => {
      const session = provider.sessions.get(sessionId);
      if (session !== undefined) {
        provider.sessions.set(sessionId, {
          ...session, state: 'complete', url: null,
          customerId: 'cus_completed_recovery', subscriptionId: 'sub_completed_recovery',
        });
      }
    };
    const command = {
      principal, workspaceId, requestId: 'request_completed_recovery',
      idempotencyKey: 'checkout-completed-recovery-01', plan: 'monthly' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    await expect(service.createCheckout({...command, requestId: 'request_completed_recovery_retry'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1')).toMatchObject({state: 'ready'});

    provider.subscriptions.set('sub_completed_recovery', {
      id: 'sub_completed_recovery', customerId: 'cus_completed_recovery', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:00.000Z',
    });
    await expect(service.reconcileNotice({
      provider: 'stripe', eventId: 'evt_completed_recovery',
      eventCreatedAt: '2026-09-01T00:00:01.000Z',
      subscriptionId: 'sub_completed_recovery', checkoutSessionId: 'cs_test_1',
    })).resolves.toMatchObject({mode: 'paid_pro', subscription: {activeSeats: 3}});
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({subscriptionId: 'sub_completed_recovery', activeSeats: 3});
  });

  it('recovers provider sessions before retrying after the provider idempotency window', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider, setNow} = fixture('2026-08-20T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    let injectFailures = true;
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      if (injectFailures) {
        injectFailures = false;
        repository.failNextTransactions = 2;
      }
      return session;
    };
    const command = {
      principal, workspaceId, requestId: 'request_delayed_provider_recovery',
      idempotencyKey: 'checkout-delayed-recovery-001', plan: 'monthly' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(provider.sessions.get('cs_test_1')).toMatchObject({state: 'expired'});
    provider.checkoutIdempotency.clear();
    setNow('2026-08-21T01:00:00.000Z');
    await expect(service.createCheckout({...command, requestId: 'request_delayed_provider_retry'}))
      .resolves.toMatchObject({checkoutSessionId: 'cs_test_2', activeSeats: 2, plan: 'monthly'});
    expect(provider.sessions.get('cs_test_1')).toMatchObject({state: 'expired'});
    expect(provider.sessions.get('cs_test_2')).toMatchObject({state: 'open'});
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_2')).toMatchObject({state: 'ready', providerAttempt: 2});
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_parallel_after_delayed_recovery',
      idempotencyKey: 'checkout-parallel-delayed-01', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
  });

  it('discovers and binds a delayed completed session before provider idempotency reuse', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider, setNow} = fixture('2026-08-20T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    let injectFailure = true;
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      if (injectFailure) {
        injectFailure = false;
        repository.failNextTransactions = 1;
      }
      return session;
    };
    provider.expireCheckoutSession = async (sessionId) => {
      const session = provider.sessions.get(sessionId);
      if (session !== undefined) {
        provider.sessions.set(sessionId, {
          ...session, state: 'complete', url: null,
          customerId: 'cus_delayed_completed', subscriptionId: 'sub_delayed_completed',
        });
      }
    };
    const command = {
      principal, workspaceId, requestId: 'request_delayed_completed',
      idempotencyKey: 'checkout-delayed-completed-01', plan: 'annual' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    provider.checkoutIdempotency.clear();
    setNow('2026-08-21T01:00:00.000Z');
    await expect(service.createCheckout({...command, requestId: 'request_delayed_completed_retry'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.creates).toHaveLength(1);
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1')).toMatchObject({
      state: 'ready', providerCustomerId: 'cus_delayed_completed', providerAttempt: 1,
    });
  });

  it('never signs a future-created provider session in primary or fallback persistence', async () => {
    const {service, provider, repository, setNow} = fixture('2026-09-01T00:00:00.000Z');
    const originalCreate = provider.createCheckoutSession.bind(provider);
    let injectFuture = true;
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      if (!injectFuture) return session;
      injectFuture = false;
      const future = {
        ...session,
        createdAt: '2027-09-01T00:00:00.000Z',
        expiresAt: '2027-09-01T01:00:00.000Z',
      };
      provider.sessions.set(future.id, future);
      return future;
    };
    const command = {
      principal, workspaceId, requestId: 'request_future_provider_time',
      idempotencyKey: 'checkout-future-provider-001', plan: 'monthly' as const,
    };
    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.sessions.get('cs_test_1')).toMatchObject({state: 'expired'});
    const failedSnapshot = repository.snapshot();
    expect(Object.keys(failedSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(0);
    expect(Object.values(failedSnapshot).find((value) => (
      value as {providerSessionId?: string | null}
    ).providerSessionId === null)).toMatchObject({state: 'prepared', providerCreatedAt: null});

    await expect(service.createCheckout({...command, requestId: 'request_future_provider_same_key'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_future_provider_other_key',
      idempotencyKey: 'checkout-future-provider-002', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(0);
    expect(provider.sessions).toHaveLength(1);

    setNow('2026-09-02T01:00:00.000Z');
    await expect(service.createCheckout({...command, requestId: 'request_future_provider_rearmed'}))
      .resolves.toMatchObject({checkoutSessionId: 'cs_test_2', activeSeats: 2, plan: 'monthly'});
    expect(provider.sessions.get('cs_test_2')).toMatchObject({state: 'open'});
  });

  it('binds one far-future completed Checkout as untrusted chronology and converges its signed notice', async () => {
    const {service, provider, repository, setNow} = fixture('2026-09-01T00:00:00.000Z');
    const originalCreate = provider.createCheckoutSession.bind(provider);
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      const completed = {
        ...session,
        state: 'complete' as const,
        url: null,
        customerId: 'cus_future_completed',
        subscriptionId: 'sub_future_completed',
        createdAt: '2027-09-01T00:00:00.000Z',
        expiresAt: '2027-09-01T01:00:00.000Z',
      };
      provider.sessions.set(completed.id, completed);
      return completed;
    };
    let expiryCalls = 0;
    provider.expireCheckoutSession = async () => { expiryCalls += 1; };
    const command = {
      principal, workspaceId, requestId: 'request_future_completed_provider',
      idempotencyKey: 'checkout-future-completed-001', plan: 'monthly' as const,
    };

    await expect(service.createCheckout(command)).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    const firstSnapshot = repository.snapshot();
    const storedCheckout = Object.values(firstSnapshot).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1') as Record<string, unknown>;
    expect(storedCheckout).toMatchObject({
      state: 'ready', providerAttempt: 1,
      providerCreatedAt: '2026-09-01T00:00:00.000Z',
      expiresAt: '2026-09-02T00:05:00.000Z',
      untrustedProviderChronologyDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(firstSnapshot)).not.toContain('2027-09-01T00:00:00.000Z');
    expect(Object.keys(firstSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);

    const originalProviderSession = provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
    provider.sessions.set('cs_test_1', {
      ...originalProviderSession,
      createdAt: '2027-09-02T00:00:00.000Z',
      expiresAt: '2027-09-02T01:00:00.000Z',
    });
    await expect(service.createCheckout({...command, requestId: 'request_future_completed_tampered'}))
      .rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.snapshot()).toEqual(firstSnapshot);
    provider.sessions.set('cs_test_1', originalProviderSession);

    await expect(service.createCheckout({...command, requestId: 'request_future_completed_same'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_future_completed_other',
      idempotencyKey: 'checkout-future-completed-002', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    setNow('2026-09-02T01:00:00.000Z');
    await expect(service.createCheckout({...command, requestId: 'request_future_completed_25h'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    await expect(service.createCheckout({...command, requestId: 'request_future_completed_repeat'}))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.creates).toHaveLength(1);
    expect(provider.sessions).toHaveLength(1);
    expect(expiryCalls).toBe(0);

    provider.subscriptions.set('sub_future_completed', {
      id: 'sub_future_completed', customerId: 'cus_future_completed', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:01.000Z',
    });
    const notice = {
      provider: 'stripe' as const,
      eventId: 'evt_future_completed',
      eventCreatedAt: '2026-09-01T00:00:01.000Z',
      subscriptionId: 'sub_future_completed',
      checkoutSessionId: 'cs_test_1',
    };
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({
      mode: 'paid_pro', subscription: {plan: 'monthly', activeSeats: 2},
    });
    const billingAfterFirstNotice = repository.readDocument(`workspaces/${workspaceId}/billing/current`);
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'paid_pro'});
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`)).toEqual(billingAfterFirstNotice);
    expect(Object.values(repository.snapshot()).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1')).toMatchObject({
      state: 'completed', providerSubscriptionId: 'sub_future_completed',
    });
    expect(provider.creates).toHaveLength(1);
    expect(provider.sessions).toHaveLength(1);
  });

  it('lets a signed notice recover a far-future completion after primary persistence fails and expiry is a no-op', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider, setNow} = fixture('2026-09-01T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      const completed = {
        ...session,
        state: 'complete' as const,
        url: null,
        customerId: 'cus_notice_recovery',
        subscriptionId: 'sub_notice_recovery',
        createdAt: '2027-09-01T00:00:00.000Z',
        expiresAt: '2027-09-01T01:00:00.000Z',
      };
      provider.sessions.set(completed.id, completed);
      repository.failNextTransactions = 1;
      return completed;
    };
    let expiryCalls = 0;
    provider.expireCheckoutSession = async () => { expiryCalls += 1; };
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_future_notice_outage',
      idempotencyKey: 'checkout-future-notice-0001', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    const failedSnapshot = repository.snapshot();
    expect(Object.keys(failedSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(0);
    expect(Object.values(failedSnapshot).find((value) => (
      value as {providerSessionId?: string | null}
    ).providerSessionId === null)).toMatchObject({state: 'prepared', providerAttempt: 1});
    expect(expiryCalls).toBe(1);

    provider.subscriptions.set('sub_notice_recovery', {
      id: 'sub_notice_recovery', customerId: 'cus_notice_recovery', workspaceId, ownerUserId,
      plan: 'annual', priceId: annualPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2027-09-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:01.000Z',
    });
    setNow('2026-09-01T00:00:02.000Z');
    const notice = {
      provider: 'stripe' as const,
      eventId: 'evt_future_notice_recovery',
      eventCreatedAt: '2026-09-01T00:00:01.000Z',
      subscriptionId: 'sub_notice_recovery',
      checkoutSessionId: 'cs_test_1',
    };
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({
      mode: 'paid_pro', subscription: {plan: 'annual', activeSeats: 2},
    });
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'paid_pro'});
    const recoveredSnapshot = repository.snapshot();
    expect(Object.keys(recoveredSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);
    const recoveredCheckout = Object.values(recoveredSnapshot).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1') as Record<string, unknown>;
    expect(recoveredCheckout).toMatchObject({
      state: 'completed', providerSubscriptionId: 'sub_notice_recovery',
      providerCreatedAt: '2026-09-01T00:00:00.000Z',
      untrustedProviderChronologyDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(JSON.stringify(recoveredCheckout)).not.toContain('2027-09-01T00:00:00.000Z');
    expect(provider.creates).toHaveLength(1);
    expect(provider.sessions).toHaveLength(1);
  });

  it('commits a notice-recovered binding only with Checkout completion and the paid ledger', async () => {
    const repository = new FaultInjectingBillingRepository(seed());
    const {service, provider, setNow} = fixture('2026-09-01T00:00:00.000Z', true, repository);
    const originalCreate = provider.createCheckoutSession.bind(provider);
    provider.createCheckoutSession = async (input) => {
      const session = await originalCreate(input);
      const completed = {
        ...session,
        state: 'complete' as const,
        url: null,
        customerId: 'cus_atomic_notice_recovery',
        subscriptionId: 'sub_atomic_notice_recovery',
        createdAt: '2027-09-01T00:00:00.000Z',
        expiresAt: '2027-09-01T01:00:00.000Z',
      };
      provider.sessions.set(completed.id, completed);
      repository.failNextTransactions = 1;
      return completed;
    };
    provider.expireCheckoutSession = async () => undefined;
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_atomic_notice_outage',
      idempotencyKey: 'checkout-atomic-notice-0001', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    const preparedSnapshot = repository.snapshot();
    expect(Object.keys(preparedSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(0);
    expect(Object.values(preparedSnapshot).find((value) => (
      value as {providerSessionId?: string | null}
    ).providerSessionId === null)).toMatchObject({state: 'prepared', providerAttempt: 1});

    provider.subscriptions.set('sub_atomic_notice_recovery', {
      id: 'sub_atomic_notice_recovery', customerId: 'cus_atomic_notice_recovery',
      workspaceId, ownerUserId, plan: 'annual', priceId: annualPriceId, quantity: 1,
      status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2027-09-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:01.000Z',
    });
    const originalUpdate = provider.updateSubscriptionQuantity.bind(provider);
    provider.updateSubscriptionQuantity = async (input) => {
      const result = await originalUpdate(input);
      repository.failNextTransactions = 1;
      return result;
    };
    setNow('2026-09-01T00:00:02.000Z');
    const notice = {
      provider: 'stripe' as const,
      eventId: 'evt_atomic_notice_failure',
      eventCreatedAt: '2026-09-01T00:00:01.000Z',
      subscriptionId: 'sub_atomic_notice_recovery',
      checkoutSessionId: 'cs_test_1',
    };
    await expect(service.reconcileNotice(notice))
      .rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.snapshot()).toEqual(preparedSnapshot);
    expect(provider.quantityUpdates).toHaveLength(1);
    expect(provider.creates).toHaveLength(1);

    const retryNotice = {...notice, eventId: 'evt_atomic_notice_retry'};
    await expect(service.reconcileNotice(retryNotice)).resolves.toMatchObject({
      mode: 'paid_pro', subscription: {plan: 'annual', activeSeats: 2},
    });
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'paid_pro'});
    const recoveredSnapshot = repository.snapshot();
    expect(Object.keys(recoveredSnapshot).filter((path) => path.includes('/billingCheckoutSessions/')))
      .toHaveLength(1);
    expect(Object.values(recoveredSnapshot).filter((value) => (
      value as {name?: string}
    ).name === 'subscription.activated')).toHaveLength(1);
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`)).toMatchObject({
      subscriptionId: 'sub_atomic_notice_recovery', activeSeats: 2, revision: 1,
    });
    expect(Object.values(recoveredSnapshot).find((value) => (
      value as {providerSessionId?: string}
    ).providerSessionId === 'cs_test_1')).toMatchObject({
      state: 'completed', providerSubscriptionId: 'sub_atomic_notice_recovery',
    });
    expect(provider.creates).toHaveLength(1);
    expect(provider.sessions).toHaveLength(1);
  });

  it('lets only the owner remove an active member idempotently while preserving workspace data', async () => {
    const {service, repository} = fixture('2026-09-01T00:00:00.000Z');
    const issuePath = `workspaces/${workspaceId}/issues/issue_preserved`;
    const commentPath = `${issuePath}/comments/comment_preserved`;
    repository.seedDocument(issuePath, {workspaceId, title: 'Preserve me'});
    repository.seedDocument(commentPath, {workspaceId, body: 'Still here'});
    const command = {
      principal, workspaceId, requestId: 'request_remove_member',
      idempotencyKey: 'remove-member-key-000001', userId: memberUserId,
    };
    await expect(service.removeMember(command)).resolves.toEqual({
      changed: true, userId: memberUserId, activeSeats: 1,
    });
    await expect(service.removeMember({...command, requestId: 'request_remove_member_replay'})).resolves.toEqual({
      changed: false, userId: memberUserId, activeSeats: 1,
    });
    expect(repository.readDocument(`workspaces/${workspaceId}/memberships/${memberUserId}`)).toMatchObject({
      userId: memberUserId, status: 'removed', revision: 2,
      updatedAt: '2026-09-01T00:00:00.000Z', removedAt: '2026-09-01T00:00:00.000Z',
    });
    expect(repository.readDocument(issuePath)).toEqual({workspaceId, title: 'Preserve me'});
    expect(repository.readDocument(commentPath)).toEqual({workspaceId, body: 'Still here'});
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingIdempotency/'))).toHaveLength(1);
    expect(Object.values(repository.snapshot()).filter((value) => (
      value as {action?: string}
    ).action === 'membership.remove')).toHaveLength(1);
    await expect(service.summary({principal, workspaceId, requestId: 'request_after_remove'}))
      .resolves.toMatchObject({mode: 'free', seats: {active: 1}});

    const memberFixture = fixture('2026-09-01T00:00:00.000Z');
    await expect(memberFixture.service.removeMember({
      ...command,
      principal: {kind: 'user', userId: memberUserId, source: 'web'},
      userId: ownerUserId,
    })).rejects.toMatchObject({code: 'WORKSPACE_ACCESS_DENIED'});
    await expect(memberFixture.service.removeMember({
      ...command,
      userId: ownerUserId,
    })).rejects.toMatchObject({code: 'INVALID_BILLING_REQUEST'});
  });

  it('fails closed when member-removal idempotency and audit evidence diverge on replay', async () => {
    const {service, repository} = fixture('2026-09-01T00:00:00.000Z');
    const command = {
      principal, workspaceId, requestId: 'request_remove_integrity',
      idempotencyKey: 'remove-integrity-key-0001', userId: memberUserId,
    };
    await service.removeMember(command);
    const [auditPath, audit] = Object.entries(repository.snapshot()).find(([, value]) => (
      value as {action?: string}
    ).action === 'membership.remove') as [string, Record<string, unknown>];
    repository.seedDocument(auditPath, {...audit, requestId: 'request_tampered_but_valid'});
    const before = repository.snapshot();
    await expect(service.removeMember({...command, requestId: 'request_remove_integrity_replay'}))
      .rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.snapshot()).toEqual(before);

    const sourceFixture = fixture('2026-09-01T00:00:00.000Z');
    await sourceFixture.service.removeMember(command);
    await expect(sourceFixture.service.removeMember({
      ...command,
      requestId: 'request_remove_other_surface',
      principal: {...principal, source: 'rest'},
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
  });

  it.each(['stripe', 'creem'] as const)('retrieves current subscription state, reconciles server seats with explicit proration, and deduplicates %s notices', async (billingProvider) => {
    const {service, provider, repository, setNow} = fixture('2026-09-01T00:05:00.000Z');
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_billing_webhook_checkout',
      idempotencyKey: 'checkout-webhook-000001', plan: 'monthly',
    });
    provider.subscriptions.set('sub_basiclinear_1', {
      id: 'sub_basiclinear_1', customerId: 'cus_basiclinear_1', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 1, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:00.000Z',
    });
    const checkout = provider.sessions.get('cs_test_1');
    provider.sessions.set('cs_test_1', {
      ...(checkout as BillingProviderCheckoutSession), state: 'complete', url: null,
      customerId: 'cus_basiclinear_1', subscriptionId: 'sub_basiclinear_1',
    });
    const notice = {
      provider: billingProvider, eventId: 'evt_basiclinear_1',
      eventCreatedAt: '2026-09-01T00:05:01.000Z', subscriptionId: 'sub_basiclinear_1',
      checkoutSessionId: 'cs_test_1',
    };
    const first = await service.reconcileNotice(notice);
    setNow('2026-09-01T00:06:00.000Z');
    const second = await service.reconcileNotice(notice);
    expect(first.mode).toBe('paid_pro');
    expect(second.mode).toBe('paid_pro');
    expect(provider.quantityUpdates).toEqual([expect.objectContaining({
      quantity: 2, prorationBehavior: 'create_prorations',
    })]);
    const snapshot = repository.snapshot();
    expect(Object.keys(snapshot).filter((path) => path.includes('/billingWebhooks/'))).toHaveLength(1);
    expect(Object.values(snapshot).filter((value) => (value as {name?: string}).name === 'subscription.activated')).toHaveLength(1);
    expect(Object.values(snapshot).filter((value) => (value as {name?: string}).name === 'trial.ended')).toHaveLength(1);

    repository.seedDocument(`workspaces/${workspaceId}/memberships/member_google_789`, {
      schemaVersion: 1, id: 'mem_member_google_789', workspaceId, userId: 'member_google_789',
      role: 'member', status: 'active', createdAt: '2026-09-01T00:05:30.000Z',
      updatedAt: '2026-09-01T00:05:30.000Z', removedAt: null, revision: 1,
    });
    await service.reconcileWorkspaceSeats(workspaceId);
    expect(provider.quantityUpdates).toEqual([
      expect.objectContaining({quantity: 2, prorationBehavior: 'create_prorations'}),
      expect.objectContaining({quantity: 3, prorationBehavior: 'create_prorations'}),
    ]);
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({activeSeats: 3, status: 'active'});

    const removed = await service.removeMember({
      principal, workspaceId, requestId: 'request_paid_member_removal',
      idempotencyKey: 'remove-paid-member-0001', userId: memberUserId,
    });
    expect(removed).toEqual({changed: true, userId: memberUserId, activeSeats: 2});
    expect(provider.quantityUpdates).toEqual([
      expect.objectContaining({quantity: 2, prorationBehavior: 'create_prorations'}),
      expect.objectContaining({quantity: 3, prorationBehavior: 'create_prorations'}),
      expect.objectContaining({quantity: 2, prorationBehavior: 'create_prorations'}),
    ]);
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({activeSeats: 2, status: 'active'});

    provider.subscriptions.set('sub_basiclinear_1', {
      ...(provider.subscriptions.get('sub_basiclinear_1') as BillingProviderSubscription),
      status: 'unpaid', providerUpdatedAt: '2026-09-01T00:06:00.000Z',
    });
    const unpaid = await service.reconcileNotice({
      provider: billingProvider, eventId: 'evt_basiclinear_2',
      eventCreatedAt: '2026-09-01T00:06:00.000Z', subscriptionId: 'sub_basiclinear_1',
      checkoutSessionId: null,
    });
    expect(unpaid.mode).toBe('free');
    setNow('2026-09-01T00:07:00.000Z');
    const outOfOrder = await service.reconcileNotice({
      provider: billingProvider, eventId: 'evt_basiclinear_older',
      eventCreatedAt: '2026-08-31T23:59:59.000Z', subscriptionId: 'sub_basiclinear_1',
      checkoutSessionId: null,
    });
    expect(outOfOrder.mode).toBe('free');
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({activeSeats: 2, status: 'unpaid'});

    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_billing_recovery_checkout',
      idempotencyKey: 'checkout-recovery-00001', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(provider.sessions).toHaveLength(1);

    provider.subscriptions.set('sub_basiclinear_1', {
      ...(provider.subscriptions.get('sub_basiclinear_1') as BillingProviderSubscription),
      status: 'canceled', quantity: 1, providerUpdatedAt: '2026-09-01T00:07:00.000Z',
    });
    const quantityUpdatesBeforeCancellation = provider.quantityUpdates.length;
    const canceled = await service.reconcileNotice({
      provider: billingProvider, eventId: 'evt_basiclinear_canceled',
      eventCreatedAt: '2026-09-01T00:07:00.000Z', subscriptionId: 'sub_basiclinear_1',
      checkoutSessionId: null,
    });
    expect(canceled).toMatchObject({mode: 'free', subscription: {status: 'canceled', activeSeats: 1}});
    expect(provider.quantityUpdates).toHaveLength(quantityUpdatesBeforeCancellation);

    setNow('2026-09-01T00:08:00.000Z');
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_billing_terminal_recovery_checkout',
      idempotencyKey: 'checkout-terminal-recovery-01', plan: 'annual',
    });
    provider.subscriptions.set('sub_basiclinear_2', {
      id: 'sub_basiclinear_2', customerId: 'cus_basiclinear_2', workspaceId, ownerUserId,
      plan: 'annual', priceId: annualPriceId, quantity: 1, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2027-09-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:08:00.000Z',
    });
    const recoveryCheckout = provider.sessions.get('cs_test_2');
    provider.sessions.set('cs_test_2', {
      ...(recoveryCheckout as BillingProviderCheckoutSession), state: 'complete', url: null,
      customerId: 'cus_basiclinear_2', subscriptionId: 'sub_basiclinear_2',
    });
    setNow('2026-09-01T00:08:02.000Z');
    const recovered = await service.reconcileNotice({
      provider: billingProvider, eventId: 'evt_basiclinear_recovered',
      eventCreatedAt: '2026-09-01T00:08:01.000Z', subscriptionId: 'sub_basiclinear_2',
      checkoutSessionId: 'cs_test_2',
    });
    expect(recovered).toMatchObject({mode: 'paid_pro', subscription: {plan: 'annual', activeSeats: 2}});
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({subscriptionId: 'sub_basiclinear_2', customerId: 'cus_basiclinear_2', plan: 'annual'});
    expect(provider.quantityUpdates.at(-1)).toMatchObject({subscriptionId: 'sub_basiclinear_2', quantity: 2});
    expect(new Set(provider.quantityUpdates.map((value) => value.idempotencyReference)).size)
      .toBe(provider.quantityUpdates.length);

    setNow('2026-09-01T00:09:00.000Z');
    provider.subscriptions.set('sub_basiclinear_2', {
      ...(provider.subscriptions.get('sub_basiclinear_2') as BillingProviderSubscription),
      cancelAtPeriodEnd: true, providerUpdatedAt: '2026-09-01T00:09:00.000Z',
    });
    const scheduled = await service.reconcileNotice({
      provider: billingProvider, eventId: 'evt_basiclinear_cancel_scheduled',
      eventCreatedAt: '2026-09-01T00:09:00.000Z', subscriptionId: 'sub_basiclinear_2',
      checkoutSessionId: null,
    });
    expect(scheduled).toMatchObject({mode: 'paid_pro', subscription: {cancelAtPeriodEnd: true}});
    setNow('2027-09-01T00:00:00.000Z');
    await expect(service.summary({principal, workspaceId, requestId: 'request_after_paid_boundary'}))
      .resolves.toMatchObject({mode: 'free', subscription: {cancelAtPeriodEnd: true}});
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_before_provider_cancel_confirmation',
      idempotencyKey: 'checkout-before-cancel-confirmation', plan: 'monthly',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
  });

  it('makes no seat mutation when exact provider binding changes between service and adapter reads', async () => {
    const prepare = async () => {
      const context = fixture('2026-09-01T00:05:00.000Z');
      await context.service.createCheckout({
        principal, workspaceId, requestId: 'request_toctou_checkout',
        idempotencyKey: 'checkout-toctou-binding-01', plan: 'monthly',
      });
      context.provider.subscriptions.set('sub_toctou', {
        id: 'sub_toctou', customerId: 'cus_toctou', workspaceId, ownerUserId,
        plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active',
        automaticTaxEnabled: true, currentPeriodEnd: '2026-10-01T00:00:00.000Z',
        cancelAtPeriodEnd: false, providerUpdatedAt: '2026-09-01T00:05:00.000Z',
      });
      const checkout = context.provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
      context.provider.sessions.set(checkout.id, {
        ...checkout, state: 'complete', url: null,
        customerId: 'cus_toctou', subscriptionId: 'sub_toctou',
      });
      await context.service.reconcileNotice({
        provider: 'stripe', eventId: 'evt_toctou_activation',
        eventCreatedAt: '2026-09-01T00:05:00.000Z',
        subscriptionId: 'sub_toctou', checkoutSessionId: checkout.id,
      });
      context.repository.seedDocument(`workspaces/${workspaceId}/memberships/member_toctou`, {
        schemaVersion: 1, id: 'mem_member_toctou', workspaceId,
        userId: 'member_toctou', role: 'member', status: 'active',
        createdAt: '2026-09-01T00:05:00.000Z', updatedAt: '2026-09-01T00:05:00.000Z',
        removedAt: null, revision: 1,
      });
      return context;
    };

    const changes: Array<(value: BillingProviderSubscription) => BillingProviderSubscription> = [
      (value) => ({...value, status: 'canceled'}),
      (value) => ({...value, workspaceId: 'ws_provider_foreign000000000000001'}),
    ];
    for (const change of changes) {
      const {service, provider, repository} = await prepare();
      const originalUpdate = provider.updateSubscriptionQuantity.bind(provider);
      provider.updateSubscriptionQuantity = async (input) => {
        const current = provider.subscriptions.get(input.subscriptionId) as BillingProviderSubscription;
        provider.subscriptions.set(input.subscriptionId, change(current));
        return originalUpdate(input);
      };
      const before = repository.snapshot();
      await expect(service.reconcileWorkspaceSeats(workspaceId))
        .rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
      expect(provider.quantityUpdates).toHaveLength(0);
      expect(repository.snapshot()).toEqual(before);
    }
  });

  it('does not persist an adapter result whose post-update subscription binding changed', async () => {
    const context = fixture('2026-09-01T00:05:00.000Z');
    await context.service.createCheckout({
      principal, workspaceId, requestId: 'request_post_update_checkout',
      idempotencyKey: 'checkout-post-update-001', plan: 'monthly',
    });
    context.provider.subscriptions.set('sub_post_update', {
      id: 'sub_post_update', customerId: 'cus_post_update', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active',
      automaticTaxEnabled: true, currentPeriodEnd: '2026-10-01T00:00:00.000Z',
      cancelAtPeriodEnd: false, providerUpdatedAt: '2026-09-01T00:05:00.000Z',
    });
    const checkout = context.provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
    context.provider.sessions.set(checkout.id, {
      ...checkout, state: 'complete', url: null,
      customerId: 'cus_post_update', subscriptionId: 'sub_post_update',
    });
    await context.service.reconcileNotice({
      provider: 'stripe', eventId: 'evt_post_update_activation',
      eventCreatedAt: '2026-09-01T00:05:00.000Z',
      subscriptionId: 'sub_post_update', checkoutSessionId: checkout.id,
    });
    context.repository.seedDocument(`workspaces/${workspaceId}/memberships/member_post_update`, {
      schemaVersion: 1, id: 'mem_member_post_update', workspaceId,
      userId: 'member_post_update', role: 'member', status: 'active',
      createdAt: '2026-09-01T00:05:00.000Z', updatedAt: '2026-09-01T00:05:00.000Z',
      removedAt: null, revision: 1,
    });
    context.provider.updateSubscriptionQuantity = async (input) => {
      context.provider.quantityUpdates.push(structuredClone(input));
      const current = context.provider.subscriptions.get(input.subscriptionId) as BillingProviderSubscription;
      return {
        ...current,
        workspaceId: 'ws_provider_foreign000000000000001',
        quantity: input.quantity,
      };
    };
    const before = context.repository.snapshot();
    await expect(context.service.reconcileWorkspaceSeats(workspaceId))
      .rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    expect(context.repository.snapshot()).toEqual(before);
  });

  it('rejects idempotency reuse for another plan and fails closed on signed-record tampering', async () => {
    const {service, repository} = fixture();
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_key_reuse_a',
      idempotencyKey: 'checkout-reuse-0000001', plan: 'monthly',
    });
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_key_reuse_b',
      idempotencyKey: 'checkout-reuse-0000001', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_CONFLICT'});
    const [path, raw] = Object.entries(repository.snapshot()).find(([candidate]) => candidate.includes('/billingCheckouts/')) as [string, Record<string, unknown>];
    repository.seedDocument(path, {...raw, activeSeats: 99});
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_key_reuse_c',
      idempotencyKey: 'checkout-reuse-0000001', plan: 'monthly',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
  });

  it('authenticates the singleton Checkout lock before any second provider session is created', async () => {
    const {service, provider, repository} = fixture();
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_checkout_lock',
      idempotencyKey: 'checkout-lock-key-00001', plan: 'monthly',
    });
    const [path, raw] = Object.entries(repository.snapshot()).find(([candidate]) => (
      candidate.endsWith('/billingCheckoutLocks/current')
    )) as [string, Record<string, unknown>];
    repository.seedDocument(path, {...raw, checkoutId: '0'.repeat(64)});
    const before = repository.snapshot();
    await expect(service.createCheckout({
      principal, workspaceId, requestId: 'request_checkout_lock_tampered',
      idempotencyKey: 'checkout-lock-key-00002', plan: 'annual',
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(provider.creates).toHaveLength(1);
    expect(repository.snapshot()).toEqual(before);
  });

  it('cannot establish the first paid entitlement from subscription metadata without a completed trusted checkout', async () => {
    const {service, provider, repository} = fixture('2026-09-01T00:05:00.000Z');
    provider.subscriptions.set('sub_unbound', {
      id: 'sub_unbound', customerId: 'cus_unbound', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:00:00.000Z',
    });
    await expect(service.reconcileNotice({
      provider: 'stripe', eventId: 'evt_unbound', eventCreatedAt: '2026-09-01T00:00:01.000Z',
      subscriptionId: 'sub_unbound', checkoutSessionId: null,
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`)).toBeNull();
  });

  it('fails closed when a provider subscription readback disables automatic tax', async () => {
    const {service, provider, repository} = fixture('2026-09-01T00:05:00.000Z');
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_tax_binding_checkout',
      idempotencyKey: 'checkout-tax-binding-0001', plan: 'monthly',
    });
    provider.subscriptions.set('sub_tax_binding', {
      id: 'sub_tax_binding', customerId: 'cus_tax_binding', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active',
      automaticTaxEnabled: false,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:05:00.000Z',
    } as unknown as BillingProviderSubscription);
    const session = provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
    provider.sessions.set(session.id, {
      ...session, state: 'complete', url: null,
      customerId: 'cus_tax_binding', subscriptionId: 'sub_tax_binding',
    });
    await expect(service.reconcileNotice({
      provider: 'stripe', eventId: 'evt_tax_binding',
      eventCreatedAt: '2026-09-01T00:05:00.000Z',
      subscriptionId: 'sub_tax_binding', checkoutSessionId: session.id,
    })).rejects.toMatchObject({code: 'BILLING_UNAVAILABLE'});
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`)).toBeNull();
  });

  it('reuses one webhook receipt while a duplicate notice converges to current provider state', async () => {
    const {service, provider, repository, setNow} = fixture('2026-09-01T00:05:00.000Z');
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_duplicate_convergence_checkout',
      idempotencyKey: 'duplicate-convergence-0001', plan: 'monthly',
    });
    provider.subscriptions.set('sub_duplicate_convergence', {
      id: 'sub_duplicate_convergence', customerId: 'cus_duplicate_convergence', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:05:00.000Z',
    });
    const session = provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
    provider.sessions.set(session.id, {
      ...session, state: 'complete', url: null,
      customerId: 'cus_duplicate_convergence', subscriptionId: 'sub_duplicate_convergence',
    });
    const notice = {
      provider: 'stripe' as const, eventId: 'evt_duplicate_convergence',
      eventCreatedAt: '2026-09-01T00:05:00.000Z', subscriptionId: 'sub_duplicate_convergence',
      checkoutSessionId: 'cs_test_1',
    };
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'paid_pro'});

    setNow('2026-09-01T00:06:00.000Z');
    provider.subscriptions.set('sub_duplicate_convergence', {
      ...(provider.subscriptions.get('sub_duplicate_convergence') as BillingProviderSubscription),
      status: 'unpaid', providerUpdatedAt: '2026-09-01T00:06:00.000Z',
    });
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'free'});

    setNow('2026-09-01T00:07:00.000Z');
    provider.subscriptions.set('sub_duplicate_convergence', {
      ...(provider.subscriptions.get('sub_duplicate_convergence') as BillingProviderSubscription),
      status: 'active', providerUpdatedAt: '2026-09-01T00:07:00.000Z',
    });
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({mode: 'paid_pro'});
    expect(Object.keys(repository.snapshot()).filter((path) => path.includes('/billingWebhooks/'))).toHaveLength(1);
    expect(Object.values(repository.snapshot()).filter((value) => (
      value as {name?: string}
    ).name === 'subscription.activated')).toHaveLength(1);
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({status: 'active', revision: 3});

    setNow('2026-09-01T00:08:00.000Z');
    provider.subscriptions.set('sub_duplicate_convergence', {
      ...(provider.subscriptions.get('sub_duplicate_convergence') as BillingProviderSubscription),
      plan: 'annual', priceId: annualPriceId,
      currentPeriodEnd: '2027-09-01T00:00:00.000Z',
      providerUpdatedAt: '2026-09-01T00:08:00.000Z',
    });
    await expect(service.reconcileNotice(notice)).resolves.toMatchObject({
      mode: 'paid_pro', subscription: {plan: 'annual'},
    });
    expect(repository.readDocument(`workspaces/${workspaceId}/billing/current`))
      .toMatchObject({plan: 'annual', priceId: annualPriceId, revision: 4});
  });
});

describe('BillingEntitlementPolicy', () => {
  it('uses the exact trial boundary and leaves one owner writer on Free', async () => {
    const repository = new MemoryBillingRepository(seed());
    const policy = new BillingEntitlementPolicy({secret, monthlyPriceId, annualPriceId});
    const grant = {workspaceId, userId: ownerUserId, role: 'owner' as const, action: 'issue.write' as const};
    const transaction = {
      get: async (path: string) => repository.readDocument(path),
      list: async (collectionPath: string) => Object.entries(repository.snapshot())
        .filter(([path]) => path.startsWith(`${collectionPath}/`)
          && !path.slice(collectionPath.length + 1).includes('/'))
        .map(([, value]) => value),
    };
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.create', now: '2026-08-30T23:59:59.999Z',
    })).resolves.toBe('trial_pro');
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.create', now: trialEndsAt,
    })).resolves.toBe('free');
    await expect(policy.assertMutation({
      transaction, workspaceId, principal: {kind: 'user', userId: memberUserId, source: 'web'},
      grant: {...grant, userId: memberUserId, role: 'member'}, operation: 'issue.update', now: trialEndsAt,
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'});
    await expect(policy.assertMutation({
      transaction, workspaceId,
      principal: {kind: 'personal_token', userId: ownerUserId, source: 'rest',
        tokenReference: 'tokref_0123456789abcdef0123456789abcdef', credentialWorkspaceId: workspaceId},
      grant: {...grant, action: 'automation.execute'}, operation: 'automation.execute', now: trialEndsAt,
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'});
    await expect(policy.assertMutation({
      transaction, workspaceId, principal,
      grant: {...grant, action: 'project.write'}, operation: 'project.create', now: trialEndsAt,
    })).resolves.toBe('free');
    await expect(policy.assertMutation({
      transaction, workspaceId, principal,
      grant: {...grant, action: 'milestone.write'}, operation: 'milestone.update', now: trialEndsAt,
    })).resolves.toBe('free');
    await expect(policy.assertMutation({
      transaction, workspaceId,
      principal: {kind: 'personal_token', userId: ownerUserId, source: 'rest',
        tokenReference: 'tokref_0123456789abcdef0123456789abcdef', credentialWorkspaceId: workspaceId},
      grant: {...grant, action: 'project.write'}, operation: 'project.create', now: trialEndsAt,
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'});
    await expect(policy.assertMutation({
      transaction, workspaceId, principal,
      grant: {...grant, action: 'token.manage'}, operation: 'token.create', now: trialEndsAt,
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'});
    await expect(policy.assertMutation({
      transaction, workspaceId, principal,
      grant: {...grant, action: 'token.manage'}, operation: 'token.revoke', now: trialEndsAt,
    })).resolves.toBe('free');
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.assign', assigneeUserId: null, now: trialEndsAt,
    })).resolves.toBe('free');
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.assign', assigneeUserId: memberUserId, now: trialEndsAt,
    })).rejects.toBeInstanceOf(BillingServiceError);
  });

  it('pauses paid writes while live membership quantity is ahead of the provider seat ledger', async () => {
    const {service, provider, repository} = fixture('2026-09-01T00:05:00.000Z');
    await service.createCheckout({
      principal, workspaceId, requestId: 'request_paid_gate_checkout',
      idempotencyKey: 'paid-gate-checkout-0001', plan: 'monthly',
    });
    provider.subscriptions.set('sub_paid_gate', {
      id: 'sub_paid_gate', customerId: 'cus_paid_gate', workspaceId, ownerUserId,
      plan: 'monthly', priceId: monthlyPriceId, quantity: 2, status: 'active', automaticTaxEnabled: true,
      currentPeriodEnd: '2026-10-01T00:00:00.000Z', cancelAtPeriodEnd: false,
      providerUpdatedAt: '2026-09-01T00:05:00.000Z',
    });
    const session = provider.sessions.get('cs_test_1') as BillingProviderCheckoutSession;
    provider.sessions.set(session.id, {
      ...session, state: 'complete', url: null,
      customerId: 'cus_paid_gate', subscriptionId: 'sub_paid_gate',
    });
    await service.reconcileNotice({
      provider: 'stripe', eventId: 'evt_paid_gate', eventCreatedAt: '2026-09-01T00:05:00.000Z',
      subscriptionId: 'sub_paid_gate', checkoutSessionId: session.id,
    });
    repository.seedDocument(`workspaces/${workspaceId}/memberships/member_pending_reconcile`, {
      schemaVersion: 1, id: 'mem_pending_reconcile', workspaceId,
      userId: 'member_pending_reconcile', role: 'member', status: 'active',
      createdAt: '2026-09-01T00:05:00.000Z', updatedAt: '2026-09-01T00:05:00.000Z',
      removedAt: null, revision: 1,
    });
    const transaction = {
      get: async (path: string) => repository.readDocument(path),
      list: async (collectionPath: string) => Object.entries(repository.snapshot())
        .filter(([path]) => path.startsWith(`${collectionPath}/`)
          && !path.slice(collectionPath.length + 1).includes('/'))
        .map(([, value]) => value),
    };
    const policy = service.entitlementPolicy();
    const grant = {workspaceId, userId: ownerUserId, role: 'owner' as const, action: 'issue.write' as const};
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.create',
      now: '2026-09-01T00:05:00.000Z',
    })).rejects.toMatchObject({code: 'BILLING_FORBIDDEN'});
    await service.reconcileWorkspaceSeats(workspaceId);
    await expect(policy.assertMutation({
      transaction, workspaceId, principal, grant, operation: 'issue.create',
      now: '2026-09-01T00:05:00.000Z',
    })).resolves.toBe('paid_pro');
    expect(provider.quantityUpdates.at(-1)).toMatchObject({quantity: 3, prorationBehavior: 'create_prorations'});
  });
});
