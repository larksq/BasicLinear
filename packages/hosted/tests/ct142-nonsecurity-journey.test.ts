import { describe, expect, it } from 'vitest';
import {
  BillingService,
  CollaborationService,
  InvitationService,
  MemoryBillingRepository,
  MemoryCollaborationRepository,
  MemoryInvitationRepository,
  MemoryOwnerBootstrapRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  OwnerBootstrapService,
  WorkspaceAuthorizationService,
  type BillingProvider,
  type BillingProviderCheckoutSession,
  type BillingProviderSubscription,
  type WorkspacePrincipal,
} from '../src/index.js';
import {
  noopBillingSeatReconcilerForTests,
  proEntitlementPolicyForTests,
} from './fixtures/entitlement.js';

const ownerId = 'ct142-owner-google';
const memberId = 'ct142-member-google';
const ownerEmail = 'owner.ct142@example.com';
const memberEmail = 'member.ct142@example.com';
const monthlyPriceId = 'price_ct142_monthly';
const annualPriceId = 'price_ct142_annual';

const userPrincipal = (userId: string): WorkspacePrincipal => ({
  kind: 'user',
  userId,
  source: 'web',
});

class JourneyBillingProvider implements BillingProvider {
  readonly sessions = new Map<string, BillingProviderCheckoutSession>();
  readonly subscriptions = new Map<string, BillingProviderSubscription>();

  constructor(private readonly clock: () => Date) {}

  async createCheckoutSession(input: Parameters<BillingProvider['createCheckoutSession']>[0]) {
    const session: BillingProviderCheckoutSession = {
      id: 'cs_ct142_1',
      checkoutReference: input.checkoutReference,
      url: 'https://checkout.stripe.test/ct142',
      state: 'open',
      workspaceId: input.workspaceId,
      ownerUserId: input.ownerUserId,
      plan: input.plan,
      priceId: input.priceId,
      quantity: input.quantity,
      customerId: null,
      subscriptionId: null,
      createdAt: this.clock().toISOString(),
      expiresAt: new Date(this.clock().getTime() + 60 * 60 * 1_000).toISOString(),
    };
    this.sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }

  async retrieveCheckoutSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session === undefined) throw new Error('missing checkout');
    return structuredClone(session);
  }

  async recoverCheckoutSessions(input: Parameters<BillingProvider['recoverCheckoutSessions']>[0]) {
    return [...this.sessions.values()]
      .filter((session) => session.checkoutReference === input.checkoutReference)
      .map((session) => structuredClone(session));
  }

  async expireCheckoutSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session !== undefined) {
      this.sessions.set(sessionId, {...session, state: 'expired', url: null});
    }
  }

  async retrieveSubscription(subscriptionId: string) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription === undefined) throw new Error('missing subscription');
    return structuredClone(subscription);
  }

  async updateSubscriptionQuantity(input: Parameters<BillingProvider['updateSubscriptionQuantity']>[0]) {
    const subscription = await this.retrieveSubscription(input.subscriptionId);
    const updated = {
      ...subscription,
      quantity: input.quantity,
      providerUpdatedAt: this.clock().toISOString(),
    };
    this.subscriptions.set(updated.id, structuredClone(updated));
    return updated;
  }
}

describe('CT-142 non-security integrated acceptance journey', () => {
  it('completes the synthetic owner/member collaboration, paid plan, and Free downgrade path', async () => {
    let now = new Date('2026-12-01T00:00:00.000Z');
    let sequence = 1;
    const idFactory = () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`;

    const bootstrapRepository = new MemoryOwnerBootstrapRepository();
    const bootstrap = new OwnerBootstrapService(bootstrapRepository, {
      clock: () => new Date(now),
      idFactory,
    });
    const identity = {
      uid: ownerId,
      email: ownerEmail,
      emailVerified: true as const,
      displayName: 'CT-142 Owner',
      provider: 'google.com' as const,
    };
    const firstBootstrap = await bootstrap.bootstrap(identity, 'ct142-bootstrap-key-0001');
    const bootstrapRetry = await bootstrap.bootstrap(identity, 'ct142-bootstrap-key-0001');
    expect(firstBootstrap.created).toBe(true);
    expect(bootstrapRetry).toEqual({...firstBootstrap, created: false});
    expect(Date.parse(firstBootstrap.record.trialEndsAt) - Date.parse(firstBootstrap.record.trialStartedAt))
      .toBe(30 * 24 * 60 * 60 * 1_000);

    const {workspaceId, trialId, membershipId, trialStartedAt, trialEndsAt} = firstBootstrap.record;
    const workspace = {
      schemaVersion: 1,
      id: workspaceId,
      workspaceId,
      name: firstBootstrap.record.workspaceName,
      ownerUid: ownerId,
      authority: 'firebase-hosted',
      createdAt: trialStartedAt,
      revision: 1,
    };
    const ownerMembership = {
      schemaVersion: 1,
      id: membershipId,
      workspaceId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      createdAt: trialStartedAt,
      revision: 1,
    };
    const trial = {
      schemaVersion: 1,
      id: trialId,
      workspaceId,
      plan: 'pro',
      status: 'active',
      trialStartedAt,
      trialEndsAt,
      source: 'owner_bootstrap',
      revision: 1,
    };

    now = new Date('2026-12-02T00:00:00.000Z');
    const invitationRepository = new MemoryInvitationRepository();
    invitationRepository.seedDocument(`hostedUsers/${ownerId}`, {
      schemaVersion: 1,
      uid: ownerId,
      email: ownerEmail,
      displayName: identity.displayName,
      authProvider: 'google.com',
      updatedAt: trialStartedAt,
    });
    invitationRepository.seedDocument(`workspaces/${workspaceId}`, workspace);
    invitationRepository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, trial);
    invitationRepository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, ownerMembership);
    const invitationAuthorization = new WorkspaceAuthorizationService(
      invitationRepository,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => new Date(now), idFactory},
    );
    const invitations = new InvitationService(invitationRepository, invitationAuthorization, {
      secret: 'ct142-invitation-secret-at-least-thirty-two-bytes',
      entitlementPolicy: proEntitlementPolicyForTests,
      seatReconciler: noopBillingSeatReconcilerForTests,
      clock: () => new Date(now),
      idFactory,
    });
    const invitation = await invitations.createOwnerInvitation({
      principal: userPrincipal(ownerId),
      workspaceId,
      requestId: 'ct142-invite-create',
      idempotencyKey: 'ct142-invite-create-key-0001',
      invitedEmail: memberEmail,
      inviterEmail: ownerEmail,
      inviterDisplayName: identity.displayName,
    });
    expect(invitationRepository.activeMembershipCount(workspaceId)).toBe(1);
    const acceptance = await invitations.acceptInvitation({
      token: invitation.shareToken as string,
      identity: {uid: memberId, email: memberEmail, displayName: 'CT-142 Member'},
      requestId: 'ct142-invite-accept',
      idempotencyKey: 'ct142-invite-accept-key-0001',
    });
    expect(acceptance).toMatchObject({
      state: 'accepted',
      firstAcceptance: true,
      activeSeatAdded: true,
      membership: {userId: memberId, role: 'member', status: 'active'},
    });
    expect(invitationRepository.activeMembershipCount(workspaceId)).toBe(2);

    const memberMembership = invitationRepository.readDocument(
      `workspaces/${workspaceId}/memberships/${memberId}`,
    ) as Record<string, unknown>;
    const collaborationRepository = new MemoryCollaborationRepository();
    collaborationRepository.seedDocument(`workspaces/${workspaceId}`, workspace);
    collaborationRepository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, trial);
    collaborationRepository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, ownerMembership);
    collaborationRepository.seedDocument(
      `workspaces/${workspaceId}/memberships/${memberId}`,
      memberMembership,
    );
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({
      schemaVersion: 1,
      workspaceId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      revision: 1,
    });
    memberships.set({
      schemaVersion: 1,
      workspaceId,
      userId: memberId,
      role: 'member',
      status: 'active',
      revision: 1,
    });
    const collaborationAuthorization = new WorkspaceAuthorizationService(
      memberships,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => new Date(now), idFactory},
    );
    const collaboration = new CollaborationService(
      collaborationRepository,
      collaborationAuthorization,
      {
        secret: 'ct142-collaboration-secret-at-least-thirty-two-bytes',
        entitlementPolicy: proEntitlementPolicyForTests,
        clock: () => new Date(now),
        idFactory,
      },
    );
    const issue = await collaboration.createIssue({
      principal: userPrincipal(ownerId),
      workspaceId,
      requestId: 'ct142-issue-create',
      idempotencyKey: 'ct142-issue-create-key-0001',
      title: 'Ship the hosted product-management release',
    });
    const assigned = await collaboration.assignIssue({
      principal: userPrincipal(ownerId),
      workspaceId,
      requestId: 'ct142-issue-assign',
      idempotencyKey: 'ct142-issue-assign-key-0001',
      issueId: issue.id,
      expectedRevision: issue.revision,
      assigneeUserId: memberId,
    });
    const updated = await collaboration.updateIssue({
      principal: userPrincipal(memberId),
      workspaceId,
      requestId: 'ct142-issue-update',
      idempotencyKey: 'ct142-issue-update-key-0001',
      issueId: issue.id,
      expectedRevision: assigned.revision,
      patch: {status: 'in_progress'},
    });
    const comment = await collaboration.createComment({
      principal: userPrincipal(memberId),
      workspaceId,
      requestId: 'ct142-comment-create',
      idempotencyKey: 'ct142-comment-create-key-0001',
      issueId: issue.id,
      body: 'The assigned product-management task is in progress.',
    });
    expect(updated).toMatchObject({assigneeUserId: memberId, status: 'in_progress'});
    expect(comment).toMatchObject({authorUserId: memberId, revision: 1});

    now = new Date('2027-01-01T00:00:00.000Z');
    const billingRepository = new MemoryBillingRepository({
      [`workspaces/${workspaceId}`]: workspace,
      [`workspaces/${workspaceId}/entitlements/current`]: trial,
      [`workspaces/${workspaceId}/memberships/${ownerId}`]: ownerMembership,
      [`workspaces/${workspaceId}/memberships/${memberId}`]: memberMembership,
    });
    const billingAuthorization = new WorkspaceAuthorizationService(
      memberships,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => new Date(now), idFactory},
    );
    const provider = new JourneyBillingProvider(() => new Date(now));
    const billing = new BillingService(billingRepository, billingAuthorization, provider, {
      secret: 'ct142-billing-secret-at-least-thirty-two-bytes',
      monthlyPriceId,
      annualPriceId,
      activationPolicy: {assertBillingActivationAllowed: async () => {}},
      clock: () => new Date(now),
    });
    const checkout = await billing.createCheckout({
      principal: userPrincipal(ownerId),
      workspaceId,
      requestId: 'ct142-checkout-create',
      idempotencyKey: 'ct142-checkout-create-key-0001',
      plan: 'monthly',
    });
    expect(checkout).toMatchObject({
      plan: 'monthly',
      activeSeats: 2,
      totalCents: 400,
      currency: 'usd',
    });
    const checkoutSession = provider.sessions.get(checkout.checkoutSessionId) as BillingProviderCheckoutSession;
    provider.sessions.set(checkoutSession.id, {
      ...checkoutSession,
      state: 'complete',
      url: null,
      customerId: 'cus_ct142',
      subscriptionId: 'sub_ct142',
    });
    provider.subscriptions.set('sub_ct142', {
      id: 'sub_ct142',
      customerId: 'cus_ct142',
      workspaceId,
      ownerUserId: ownerId,
      plan: 'monthly',
      priceId: monthlyPriceId,
      quantity: 2,
      status: 'active',
      automaticTaxEnabled: true,
      currentPeriodEnd: '2027-02-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      providerUpdatedAt: now.toISOString(),
    });
    const paid = await billing.reconcileNotice({
      provider: 'stripe',
      eventId: 'evt_ct142_paid',
      eventCreatedAt: '2027-01-01T00:00:01.000Z',
      subscriptionId: 'sub_ct142',
      checkoutSessionId: checkoutSession.id,
    });
    expect(paid).toMatchObject({
      mode: 'paid_pro',
      prices: {monthlyPerSeatCents: 200, annualPerSeatCents: 1200},
      subscription: {plan: 'monthly', activeSeats: 2, status: 'active'},
    });

    now = new Date('2027-01-02T00:00:00.000Z');
    provider.subscriptions.set('sub_ct142', {
      ...(provider.subscriptions.get('sub_ct142') as BillingProviderSubscription),
      status: 'unpaid',
      providerUpdatedAt: now.toISOString(),
    });
    const downgraded = await billing.reconcileNotice({
      provider: 'stripe',
      eventId: 'evt_ct142_unpaid',
      eventCreatedAt: now.toISOString(),
      subscriptionId: 'sub_ct142',
      checkoutSessionId: null,
    });
    expect(downgraded).toMatchObject({
      mode: 'free',
      free: {
        writerUserId: ownerId,
        dataReadable: true,
        exportEligible: true,
        extraMemberWritesPaused: true,
        automationWritesPaused: true,
      },
      subscription: {status: 'unpaid'},
    });
  });
});
