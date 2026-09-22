import { describe, expect, it } from 'vitest';
import {
  INVITATION_DURATION_MS,
  InvitationService,
  InvitationServiceError,
  MemoryInvitationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  WorkspaceAuthorizationError,
  WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from '../src/index.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_invitation_test';
const ownerId = 'firebase-owner-invitation';
const invitedEmail = 'member@example.com';
const secret = 'invitation-service-test-secret-with-at-least-32-bytes';

function seedRepository(repository: MemoryInvitationRepository): void {
  repository.seedDocument(`hostedUsers/${ownerId}`, {
    schemaVersion: 1,
    uid: ownerId,
    email: 'owner@example.com',
    displayName: 'Product Owner',
    authProvider: 'google.com',
    updatedAt: '2026-12-01T00:00:00.000Z',
  });
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1,
    id: workspaceId,
    workspaceId,
    name: 'Product workspace',
    ownerUid: ownerId,
    authority: 'firebase-hosted',
    createdAt: '2026-12-01T00:00:00.000Z',
    revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, {
    schemaVersion: 1,
    id: 'trial_invitation_test',
    workspaceId,
    plan: 'pro',
    status: 'active',
    trialStartedAt: '2026-12-01T00:00:00.000Z',
    trialEndsAt: '2026-12-31T00:00:00.000Z',
    source: 'owner_bootstrap',
    revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
    schemaVersion: 1,
    id: 'mem_owner_invitation',
    workspaceId,
    userId: ownerId,
    role: 'owner',
    status: 'active',
    createdAt: '2026-12-01T00:00:00.000Z',
    revision: 1,
  });
}

function fixture() {
  const repository = new MemoryInvitationRepository();
  seedRepository(repository);
  const authorizationEvidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  const authorization = new WorkspaceAuthorizationService(repository, authorizationEvidence, {
    clock: () => new Date('2026-12-01T00:00:00.000Z'),
    idFactory: (() => {
      let sequence = 0;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    })(),
  });
  let now = new Date('2026-12-01T00:00:00.000Z');
  let clock = () => new Date(now);
  const service = new InvitationService(repository, authorization, {
    secret,
    entitlementPolicy: proEntitlementPolicyForTests,
    seatReconciler: noopBillingSeatReconcilerForTests,
    clock: () => new Date(clock().getTime()),
    idFactory: (() => {
      let sequence = 100;
      return () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    })(),
  });
  return {
    repository,
    authorizationEvidence,
    service,
    setNow: (value: string) => { now = new Date(value); },
    setClock: (value: () => Date) => { clock = value; },
  };
}

const ownerPrincipal = (source: 'web' | 'rest' | 'mcp' = 'web'): WorkspacePrincipal => ({
  kind: 'user',
  userId: ownerId,
  source,
});

async function createInvitation(
  service: InvitationService,
  overrides: Partial<{
    email: string;
    key: string;
    requestId: string;
    principal: WorkspacePrincipal;
    teamIds: string[];
  }> = {},
) {
  return service.createOwnerInvitation({
    principal: overrides.principal ?? ownerPrincipal(),
    workspaceId,
    requestId: overrides.requestId ?? 'request:invite:create:001',
    idempotencyKey: overrides.key ?? 'idempotency-invite-create-0001',
    invitedEmail: overrides.email ?? invitedEmail,
    ...(overrides.teamIds === undefined ? {} : {teamIds: overrides.teamIds}),
    inviterEmail: 'owner@example.com',
    inviterDisplayName: 'Product Owner',
  });
}

function invitationDocuments(repository: MemoryInvitationRepository): Record<string, unknown> {
  return Object.fromEntries(Object.entries(repository.snapshot()).filter(([path]) => (
    path.includes('/invitations/')
    || path.startsWith('_invitationTokens/')
    || path.includes('/invitationIdempotency/')
    || path.includes('/productEvents/')
    || path.includes('/mutationAudits/')
  )));
}

describe('hosted invitation and membership lifecycle', () => {
  it('persists selected teams and assigns them atomically when the invite is accepted', async () => {
    const {repository, service} = fixture();
    const teamId = 'team_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    repository.seedDocument(`workspaces/${workspaceId}/teams/${teamId}`, {
      schemaVersion: 1,
      id: teamId,
      workspaceId,
      name: 'Engineering',
      key: 'ENG',
      color: '#4F8BD6',
      description: 'Build BasicLinear.',
      createdByUserId: ownerId,
      archivedAt: null,
      createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z',
      revision: 1,
    });
    const created = await createInvitation(service, {
      key: 'idempotency-invite-team-create-0001',
      requestId: 'request:invite:team:create',
      teamIds: [teamId],
    });
    expect(created.invitation.teamIds).toEqual([teamId]);
    await service.acceptInvitation({
      token: created.shareToken as string,
      identity: {uid: 'member-team-assigned', email: invitedEmail, displayName: 'Engineering member'},
      requestId: 'request:invite:team:accept',
      idempotencyKey: 'idempotency-invite-team-accept-0001',
    });
    const teamMembership = Object.entries(repository.snapshot()).find(([path]) => (
      path.includes(`/teamMemberships/${teamId}--member-team-assigned`)
    ))?.[1];
    expect(teamMembership).toMatchObject({
      workspaceId,
      teamId,
      userId: 'member-team-assigned',
      role: 'member',
      revision: 1,
    });
  });

  it('creates one retry-safe email-bound invitation without counting a pending seat', async () => {
    const { repository, service } = fixture();
    const first = await createInvitation(service);
    const retry = await createInvitation(service, { requestId: 'request:invite:create:retry' });
    const list = await service.listOwnerInvitations({
      principal: ownerPrincipal(),
      workspaceId,
      requestId: 'request:invite:list:001',
    });

    expect(first.changed).toBe(true);
    expect(retry.changed).toBe(false);
    expect(first.shareToken).toMatch(/^inv_[A-Za-z0-9_-]{43}$/u);
    expect(retry.shareToken).toBe(first.shareToken);
    expect(retry.invitation.id).toBe(first.invitation.id);
    expect(first.invitation.state).toBe('pending');
    expect(first.invitation.role).toBe('member');
    expect(Date.parse(first.invitation.expiresAt) - Date.parse(first.invitation.createdAt))
      .toBe(INVITATION_DURATION_MS);
    expect(list).toHaveLength(1);
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);

    const serialized = JSON.stringify(invitationDocuments(repository));
    expect(serialized).not.toContain(first.shareToken as string);
    const snapshot = repository.snapshot();
    const event = Object.entries(snapshot).find(([path]) => path.includes('/productEvents/'))?.[1] as {
      name: string;
      attributes: {eligibleTrialWorkspace: boolean};
    };
    expect(event).toMatchObject({
      name: 'invitation.sent',
      attributes: { eligibleTrialWorkspace: true },
    });
  });

  it('rotates resend secrets and makes superseded, revoked, and retry states distinct', async () => {
    const { service } = fixture();
    const created = await createInvitation(service);
    const firstToken = created.shareToken as string;
    const resent = await service.resendOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:resend:001',
      idempotencyKey: 'idempotency-invite-resend-0001',
    });
    const resendRetry = await service.resendOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:resend:retry',
      idempotencyKey: 'idempotency-invite-resend-0001',
    });
    const secondToken = resent.shareToken as string;

    expect(secondToken).not.toBe(firstToken);
    expect(resendRetry.changed).toBe(false);
    expect(resendRetry.shareToken).toBe(secondToken);
    expect((await service.inspectInvitation(firstToken)).state).toBe('superseded');
    expect((await service.inspectInvitation(secondToken)).state).toBe('pending');

    const revoked = await service.revokeOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:revoke:001',
      idempotencyKey: 'idempotency-invite-revoke-0001',
    });
    const revokeRetry = await service.revokeOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:revoke:retry',
      idempotencyKey: 'idempotency-invite-revoke-0001',
    });
    expect(revoked.invitation.state).toBe('revoked');
    expect(revokeRetry.changed).toBe(false);
    expect((await service.inspectInvitation(secondToken)).state).toBe('revoked');
    await expect(service.acceptInvitation({
      token: secondToken,
      identity: { uid: 'member-revoked', email: invitedEmail, displayName: 'Member' },
      requestId: 'request:invite:accept:revoked',
      idempotencyKey: 'idempotency-accept-revoked-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_REVOKED' });
  });

  it('does not consume a token for the wrong Google email and accepts the intended account once', async () => {
    const { repository, service } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    await expect(service.acceptInvitation({
      token,
      identity: { uid: 'wrong-member', email: 'wrong@example.com', displayName: 'Wrong Member' },
      requestId: 'request:invite:accept:wrong',
      idempotencyKey: 'idempotency-accept-shared-ui-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    expect((await service.inspectInvitation(token)).state).toBe('pending');
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);

    const accepted = await service.acceptInvitation({
      token,
      identity: { uid: 'member-correct', email: 'MEMBER@example.com', displayName: 'Correct Member' },
      requestId: 'request:invite:accept:correct',
      idempotencyKey: 'idempotency-accept-shared-ui-0001',
    });
    const retry = await service.acceptInvitation({
      token,
      identity: { uid: 'member-correct', email: invitedEmail, displayName: 'Correct Member' },
      requestId: 'request:invite:accept:retry',
      idempotencyKey: 'idempotency-accept-shared-ui-0001',
    });
    const laterReplay = await service.acceptInvitation({
      token,
      identity: { uid: 'member-correct', email: invitedEmail, displayName: 'Correct Member' },
      requestId: 'request:invite:accept:replay',
      idempotencyKey: 'idempotency-accept-correct-0002',
    });

    expect(accepted).toMatchObject({
      state: 'accepted',
      firstAcceptance: true,
      activeSeatAdded: true,
      membership: { userId: 'member-correct', role: 'member', status: 'active', revision: 1 },
    });
    expect(retry.firstAcceptance).toBe(false);
    expect(laterReplay.firstAcceptance).toBe(false);
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
    expect((await service.inspectInvitation(token)).state).toBe('accepted');

    const events = Object.entries(repository.snapshot())
      .filter(([path]) => path.includes('/productEvents/'))
      .map(([, value]) => value as {name: string; attributes: Record<string, unknown>});
    expect(events.filter((event) => event.name === 'membership.accepted')).toHaveLength(2);
    expect(events.filter((event) => (
      event.name === 'membership.accepted'
      && event.attributes.firstAcceptance === true
    ))).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(invitedEmail);
    expect(JSON.stringify(events)).not.toContain('wrong@example.com');
  });

  it('converges concurrent correct acceptances on one membership and one first-acceptance event', async () => {
    const { repository, service } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    const results = await Promise.all([
      service.acceptInvitation({
        token,
        identity: { uid: 'member-concurrent', email: invitedEmail, displayName: null },
        requestId: 'request:invite:accept:concurrent:1',
        idempotencyKey: 'idempotency-accept-concurrent-0001',
      }),
      service.acceptInvitation({
        token,
        identity: { uid: 'member-concurrent', email: invitedEmail, displayName: null },
        requestId: 'request:invite:accept:concurrent:2',
        idempotencyKey: 'idempotency-accept-concurrent-0002',
      }),
    ]);
    expect(results.map((result) => result.firstAcceptance).sort()).toEqual([false, true]);
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
    const acceptanceEvents = Object.entries(repository.snapshot())
      .filter(([path, value]) => (
        path.includes('/productEvents/')
        && (value as {name?: string}).name === 'membership.accepted'
      ));
    expect(acceptanceEvents).toHaveLength(1);
  });

  it('scopes acceptance idempotency across a resent link for the same authenticated UID', async () => {
    const { service } = fixture();
    const created = await createInvitation(service);
    const sharedKey = 'idempotency-accept-link-rotation-0001';
    await expect(service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-link-rotation', email: 'wrong@example.com', displayName: null },
      requestId: 'request:invite:accept:link-old',
      idempotencyKey: sharedKey,
    })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    const resent = await service.resendOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:resend:link-rotation',
      idempotencyKey: 'idempotency-resend-link-rotation-0001',
    });
    const accepted = await service.acceptInvitation({
      token: resent.shareToken as string,
      identity: { uid: 'member-link-rotation', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:link-new',
      idempotencyKey: sharedKey,
    });

    expect(accepted).toMatchObject({ firstAcceptance: true, activeSeatAdded: true });
  });

  it('expires by trusted server time without activating a seat', async () => {
    const { repository, service, setNow } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    setNow('2026-12-08T00:00:00.001Z');
    expect((await service.inspectInvitation(token)).state).toBe('expired');
    await expect(service.acceptInvitation({
      token,
      identity: { uid: 'member-expired', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:expired',
      idempotencyKey: 'idempotency-accept-expired-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);
  });

  it('rejects create when trusted time precedes the authoritative bootstrap lifecycle', async () => {
    const { repository, service, setNow } = fixture();
    const before = invitationDocuments(repository);
    setNow('2026-11-30T23:59:59.000Z');

    await expect(createInvitation(service, {
      requestId: 'request:invite:create:bootstrap-clock-regression',
      key: 'idempotency-create-bootstrap-clock-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });

    expect(invitationDocuments(repository)).toEqual(before);
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);
  });

  it('does not replay a create secret when trusted time regresses below the invitation', async () => {
    const { repository, service, setNow } = fixture();
    setNow('2026-12-01T00:00:02.000Z');
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    const before = invitationDocuments(repository);
    setNow('2026-12-01T00:00:01.000Z');

    let replayError: unknown;
    try {
      await createInvitation(service, { requestId: 'request:invite:create:regressed-replay' });
    } catch (error) {
      replayError = error;
    }

    expect(replayError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(replayError)).not.toContain(token);
    expect(invitationDocuments(repository)).toEqual(before);
  });

  it('does not replay a create secret from a divergent current-token ledger', async () => {
    const { repository, service } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    const tokenEntry = Object.entries(repository.snapshot())
      .find(([path]) => path.startsWith('_invitationTokens/'));
    expect(tokenEntry).toBeDefined();
    const [tokenPath, rawToken] = tokenEntry as [string, Record<string, unknown>];
    repository.seedDocument(tokenPath, { ...rawToken, binding: 'f'.repeat(64) });
    const before = invitationDocuments(repository);

    let replayError: unknown;
    try {
      await createInvitation(service, { requestId: 'request:invite:create:divergent-replay' });
    } catch (error) {
      replayError = error;
    }

    expect(replayError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(replayError)).not.toContain(token);
    expect(invitationDocuments(repository)).toEqual(before);
  });

  it('validates the token ledger before replaying resend or revoke', async () => {
    {
      const { repository, service } = fixture();
      const created = await createInvitation(service);
      const resent = await service.resendOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:resend:ledger-replay',
        idempotencyKey: 'idempotency-resend-ledger-replay-0001',
      });
      const tokenEntry = Object.entries(repository.snapshot()).find(([path, value]) => (
        path.startsWith('_invitationTokens/')
        && (value as {state?: string}).state === 'current'
      ));
      expect(tokenEntry).toBeDefined();
      const [tokenPath, rawToken] = tokenEntry as [string, Record<string, unknown>];
      repository.seedDocument(tokenPath, { ...rawToken, binding: 'e'.repeat(64) });
      const before = invitationDocuments(repository);

      let replayError: unknown;
      try {
        await service.resendOwnerInvitation({
          principal: ownerPrincipal(),
          workspaceId,
          invitationId: created.invitation.id,
          requestId: 'request:invite:resend:ledger-replay:retry',
          idempotencyKey: 'idempotency-resend-ledger-replay-0001',
        });
      } catch (error) {
        replayError = error;
      }
      expect(replayError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
      expect(JSON.stringify(replayError)).not.toContain(resent.shareToken as string);
      expect(invitationDocuments(repository)).toEqual(before);
    }

    {
      const { repository, service } = fixture();
      const created = await createInvitation(service);
      await service.revokeOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:revoke:ledger-replay',
        idempotencyKey: 'idempotency-revoke-ledger-replay-0001',
      });
      const tokenEntry = Object.entries(repository.snapshot()).find(([path]) => (
        path.startsWith('_invitationTokens/')
      ));
      expect(tokenEntry).toBeDefined();
      const [tokenPath, rawToken] = tokenEntry as [string, Record<string, unknown>];
      repository.seedDocument(tokenPath, { ...rawToken, binding: 'd'.repeat(64) });
      const before = invitationDocuments(repository);

      await expect(service.revokeOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:revoke:ledger-replay:retry',
        idempotencyKey: 'idempotency-revoke-ledger-replay-0001',
      })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
      expect(invitationDocuments(repository)).toEqual(before);
    }
  });

  it('rejects an accepted replay whose bound idempotency timestamp was altered', async () => {
    const { repository, service, setNow } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    const identity = {
      uid: 'member-accepted-idempotency-time',
      email: invitedEmail,
      displayName: null,
    };
    const idempotencyKey = 'idempotency-accept-bound-time-0001';
    setNow('2026-12-01T00:00:03.000Z');
    await service.acceptInvitation({
      token,
      identity,
      requestId: 'request:invite:accept:bound-time:first',
      idempotencyKey,
    });
    const idempotencyEntry = Object.entries(repository.snapshot()).find(([path, value]) => (
      path.includes('/invitationIdempotency/')
      && (value as {outcome?: string}).outcome === 'accepted'
    ));
    expect(idempotencyEntry).toBeDefined();
    const [idempotencyPath, idempotency] = idempotencyEntry as [string, Record<string, unknown>];
    repository.seedDocument(idempotencyPath, {
      ...idempotency,
      createdAt: '2026-12-01T00:00:02.000Z',
    });
    const before = invitationDocuments(repository);
    setNow('2026-12-01T00:00:04.000Z');

    let replayError: unknown;
    try {
      await service.acceptInvitation({
        token,
        identity,
        requestId: 'request:invite:accept:bound-time:replay',
        idempotencyKey,
      });
    } catch (error) {
      replayError = error;
    }

    expect(replayError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(replayError)).not.toContain(token);
    expect(invitationDocuments(repository)).toEqual(before);
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
  });

  it('requires an authentic accepted replay to match the accepted lifecycle', async () => {
    const { repository, service, setNow } = fixture();
    const created = await createInvitation(service);
    const token = created.shareToken as string;
    const identity = {
      uid: 'member-accepted-lifecycle',
      email: invitedEmail,
      displayName: null,
    };
    const idempotencyKey = 'idempotency-accept-lifecycle-0001';
    setNow('2026-12-01T00:00:03.000Z');
    await service.acceptInvitation({
      token,
      identity,
      requestId: 'request:invite:accept:lifecycle:first',
      idempotencyKey,
    });
    const invitationPath = `workspaces/${workspaceId}/invitations/${created.invitation.id}`;
    const invitation = repository.readDocument(invitationPath) as Record<string, unknown>;
    repository.seedDocument(invitationPath, {
      ...invitation,
      acceptedAt: '2026-12-01T00:00:04.000Z',
      updatedAt: '2026-12-01T00:00:04.000Z',
    });
    const before = invitationDocuments(repository);
    setNow('2026-12-01T00:00:05.000Z');

    await expect(service.acceptInvitation({
      token,
      identity,
      requestId: 'request:invite:accept:lifecycle:replay',
      idempotencyKey,
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(invitationDocuments(repository)).toEqual(before);
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
  });

  it('replays every authentic non-success acceptance outcome consistently', async () => {
    {
      const { service } = fixture();
      const created = await createInvitation(service);
      const input = {
        token: created.shareToken as string,
        identity: { uid: 'member-replay-mismatch', email: 'wrong@example.com', displayName: null },
        idempotencyKey: 'idempotency-accept-replay-mismatch-0001',
      };
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-mismatch:first',
      })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-mismatch:retry',
      })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' });
    }

    {
      const { service, setNow } = fixture();
      const created = await createInvitation(service);
      const input = {
        token: created.shareToken as string,
        identity: { uid: 'member-replay-expired', email: invitedEmail, displayName: null },
        idempotencyKey: 'idempotency-accept-replay-expired-0001',
      };
      setNow('2026-12-08T00:00:00.001Z');
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-expired:first',
      })).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-expired:retry',
      })).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' });
    }

    {
      const { service } = fixture();
      const created = await createInvitation(service);
      await service.revokeOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:revoke:replay-revoked',
        idempotencyKey: 'idempotency-revoke-replay-revoked-0001',
      });
      const input = {
        token: created.shareToken as string,
        identity: { uid: 'member-replay-revoked', email: invitedEmail, displayName: null },
        idempotencyKey: 'idempotency-accept-replay-revoked-0001',
      };
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-revoked:first',
      })).rejects.toMatchObject({ code: 'INVITATION_REVOKED' });
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-revoked:retry',
      })).rejects.toMatchObject({ code: 'INVITATION_REVOKED' });
    }

    {
      const { service } = fixture();
      const created = await createInvitation(service);
      await service.resendOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:resend:replay-superseded',
        idempotencyKey: 'idempotency-resend-replay-superseded-0001',
      });
      const input = {
        token: created.shareToken as string,
        identity: { uid: 'member-replay-superseded', email: invitedEmail, displayName: null },
        idempotencyKey: 'idempotency-accept-replay-superseded-0001',
      };
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-superseded:first',
      })).rejects.toMatchObject({ code: 'INVITATION_SUPERSEDED' });
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-superseded:retry',
      })).rejects.toMatchObject({ code: 'INVITATION_SUPERSEDED' });
    }

    {
      const { service } = fixture();
      const created = await createInvitation(service);
      const token = created.shareToken as string;
      await service.acceptInvitation({
        token,
        identity: { uid: 'member-replay-accepted', email: invitedEmail, displayName: null },
        requestId: 'request:invite:accept:replay-accepted:first',
        idempotencyKey: 'idempotency-accept-replay-accepted-0001',
      });
      const input = {
        token,
        identity: { uid: 'member-replay-already', email: 'other@example.com', displayName: null },
        idempotencyKey: 'idempotency-accept-replay-already-0001',
      };
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-already:first',
      })).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' });
      await expect(service.acceptInvitation({
        ...input,
        requestId: 'request:invite:accept:replay-already:retry',
      })).rejects.toMatchObject({ code: 'INVITATION_ALREADY_ACCEPTED' });
    }
  });

  it('rechecks active owner authority inside create, resend, and revoke transactions', async () => {
    const racedService = (repository: MemoryInvitationRepository): InvitationService => {
      const racedAuthorization = {
        authorize: async () => {
          repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
            schemaVersion: 1,
            id: 'mem_owner_invitation',
            workspaceId,
            userId: ownerId,
            role: 'owner',
            status: 'removed',
            createdAt: '2026-12-01T00:00:00.000Z',
            updatedAt: '2026-12-01T00:00:01.000Z',
            removedAt: '2026-12-01T00:00:01.000Z',
            revision: 2,
          });
        },
      } as unknown as WorkspaceAuthorizationService;
      return new InvitationService(repository, racedAuthorization, {
        secret,
        entitlementPolicy: proEntitlementPolicyForTests,
        seatReconciler: noopBillingSeatReconcilerForTests,
        clock: () => new Date('2026-12-01T00:00:02.000Z'),
        idFactory: () => '00000000-0000-4000-8000-000000000999',
      });
    };

    {
      const repository = new MemoryInvitationRepository();
      seedRepository(repository);
      const before = invitationDocuments(repository);
      await expect(createInvitation(racedService(repository), {
        requestId: 'request:invite:create:owner-race',
        key: 'idempotency-create-owner-race-0001',
      })).rejects.toMatchObject({
        code: 'WORKSPACE_ACCESS_DENIED',
        reason: 'membership_inactive',
      });
      expect(invitationDocuments(repository)).toEqual(before);
    }

    {
      const { repository, service } = fixture();
      const created = await createInvitation(service);
      const before = invitationDocuments(repository);
      await expect(racedService(repository).resendOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:resend:owner-race',
        idempotencyKey: 'idempotency-resend-owner-race-0001',
      })).rejects.toMatchObject({
        code: 'WORKSPACE_ACCESS_DENIED',
        reason: 'membership_inactive',
      });
      expect(invitationDocuments(repository)).toEqual(before);
    }

    {
      const { repository, service } = fixture();
      const created = await createInvitation(service);
      const before = invitationDocuments(repository);
      await expect(racedService(repository).revokeOwnerInvitation({
        principal: ownerPrincipal(),
        workspaceId,
        invitationId: created.invitation.id,
        requestId: 'request:invite:revoke:owner-race',
        idempotencyKey: 'idempotency-revoke-owner-race-0001',
      })).rejects.toMatchObject({
        code: 'WORKSPACE_ACCESS_DENIED',
        reason: 'membership_inactive',
      });
      expect(invitationDocuments(repository)).toEqual(before);
    }
  });

  it('fails closed on regressed mutation time before changing a seat or lifecycle record', async () => {
    const { repository, service, setNow } = fixture();
    setNow('2026-12-01T00:00:01.000Z');
    const created = await createInvitation(service);
    setNow('2026-12-01T00:00:00.000Z');

    await expect(service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-regressed-clock', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:regressed-clock',
      idempotencyKey: 'idempotency-accept-regressed-clock-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    await expect(service.resendOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:resend:regressed-clock',
      idempotencyKey: 'idempotency-resend-regressed-clock-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    await expect(service.revokeOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: created.invitation.id,
      requestId: 'request:invite:revoke:regressed-clock',
      idempotencyKey: 'idempotency-revoke-regressed-clock-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });

    expect(repository.activeMembershipCount(workspaceId)).toBe(1);
    expect(repository.readDocument(
      `workspaces/${workspaceId}/memberships/member-regressed-clock`,
    )).toBeNull();
    const invitation = repository.readDocument(
      `workspaces/${workspaceId}/invitations/${created.invitation.id}`,
    );
    expect(invitation).toMatchObject({ status: 'pending', revision: 1, sendCount: 1 });
    const acceptanceEvents = Object.entries(repository.snapshot()).filter(([path, value]) => (
      path.includes('/productEvents/')
      && (value as {name?: string}).name === 'membership.accepted'
    ));
    expect(acceptanceEvents).toHaveLength(0);
  });

  it('resamples trusted time inside every transaction retry before accepting', async () => {
    const { repository, service, setClock } = fixture();
    const created = await createInvitation(service);
    const retryTimes = [
      new Date('2026-12-01T00:00:01.000Z'),
      new Date('2026-12-01T00:00:02.000Z'),
    ];
    let clockCalls = 0;
    setClock(() => retryTimes[Math.min(clockCalls++, retryTimes.length - 1)] as Date);
    repository.simulateNextTransactionRetries(1);

    const accepted = await service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-retried-clock', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:retried-clock',
      idempotencyKey: 'idempotency-accept-retried-clock-0001',
    });

    expect(accepted.firstAcceptance).toBe(true);
    expect(clockCalls).toBe(2);
    expect(repository.readDocument(
      `workspaces/${workspaceId}/invitations/${created.invitation.id}`,
    )).toMatchObject({
      status: 'accepted',
      updatedAt: '2026-12-01T00:00:02.000Z',
      acceptedAt: '2026-12-01T00:00:02.000Z',
    });
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
  });

  it('fails closed when the trusted token ledger and invitation revision diverge', async () => {
    const { repository, service } = fixture();
    const created = await createInvitation(service);
    const tokenEntry = Object.entries(repository.snapshot())
      .find(([path]) => path.startsWith('_invitationTokens/'));
    expect(tokenEntry).toBeDefined();
    const [path, rawToken] = tokenEntry as [string, Record<string, unknown>];
    repository.seedDocument(path, { ...rawToken, version: 2 });

    await expect(service.inspectInvitation(created.shareToken as string))
      .rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    await expect(service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-ledger-diverged', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:ledger-diverged',
      idempotencyKey: 'idempotency-accept-ledger-diverged-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);
  });

  it('cryptographically rejects a superseded token rebound to another workspace invitation', async () => {
    const { repository, service } = fixture();
    const createdA = await createInvitation(service);
    await service.resendOwnerInvitation({
      principal: ownerPrincipal(),
      workspaceId,
      invitationId: createdA.invitation.id,
      requestId: 'request:invite:resend:binding-a',
      idempotencyKey: 'idempotency-resend-binding-a-0001',
    });

    const foreignWorkspaceId = 'ws_invitation_foreign';
    const foreignOwnerId = 'firebase-owner-foreign';
    const foreignEmail = 'foreign-member@example.com';
    repository.seedDocument(`hostedUsers/${foreignOwnerId}`, {
      schemaVersion: 1,
      uid: foreignOwnerId,
      email: 'foreign-owner@example.com',
      displayName: 'Foreign Owner',
      authProvider: 'google.com',
      updatedAt: '2026-12-01T00:00:00.000Z',
    });
    repository.seedDocument(`workspaces/${foreignWorkspaceId}`, {
      schemaVersion: 1,
      id: foreignWorkspaceId,
      workspaceId: foreignWorkspaceId,
      name: 'Foreign private workspace',
      ownerUid: foreignOwnerId,
      authority: 'firebase-hosted',
      createdAt: '2026-12-01T00:00:00.000Z',
      revision: 1,
    });
    repository.seedDocument(`workspaces/${foreignWorkspaceId}/entitlements/current`, {
      schemaVersion: 1,
      id: 'trial_invitation_foreign',
      workspaceId: foreignWorkspaceId,
      plan: 'pro',
      status: 'active',
      trialStartedAt: '2026-12-01T00:00:00.000Z',
      trialEndsAt: '2026-12-31T00:00:00.000Z',
      source: 'owner_bootstrap',
      revision: 1,
    });
    repository.seedDocument(`workspaces/${foreignWorkspaceId}/memberships/${foreignOwnerId}`, {
      schemaVersion: 1,
      id: 'mem_owner_foreign',
      workspaceId: foreignWorkspaceId,
      userId: foreignOwnerId,
      role: 'owner',
      status: 'active',
      createdAt: '2026-12-01T00:00:00.000Z',
      revision: 1,
    });
    const foreignPrincipal: WorkspacePrincipal = {
      kind: 'user',
      userId: foreignOwnerId,
      source: 'web',
    };
    const createdB = await service.createOwnerInvitation({
      principal: foreignPrincipal,
      workspaceId: foreignWorkspaceId,
      requestId: 'request:invite:create:binding-b',
      idempotencyKey: 'idempotency-create-binding-b-0001',
      invitedEmail: foreignEmail,
      inviterEmail: 'foreign-owner@example.com',
      inviterDisplayName: 'Foreign Owner',
    });
    await service.resendOwnerInvitation({
      principal: foreignPrincipal,
      workspaceId: foreignWorkspaceId,
      invitationId: createdB.invitation.id,
      requestId: 'request:invite:resend:binding-b',
      idempotencyKey: 'idempotency-resend-binding-b-0001',
    });

    const oldTokenEntry = Object.entries(repository.snapshot()).find(([path, value]) => (
      path.startsWith('_invitationTokens/')
      && (value as {invitationId?: string; state?: string}).invitationId === createdA.invitation.id
      && (value as {state?: string}).state === 'superseded'
    ));
    expect(oldTokenEntry).toBeDefined();
    const [oldTokenPath, oldTokenRecord] = oldTokenEntry as [string, Record<string, unknown>];
    repository.seedDocument(oldTokenPath, {
      ...oldTokenRecord,
      workspaceId: foreignWorkspaceId,
      invitationId: createdB.invitation.id,
    });

    let inspectError: unknown;
    try {
      await service.inspectInvitation(createdA.shareToken as string);
    } catch (error) {
      inspectError = error;
    }
    expect(inspectError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(inspectError)).not.toContain('Foreign private workspace');
    expect(JSON.stringify(inspectError)).not.toContain(foreignEmail);
  });

  it('rejects coordinated expiry extension in trusted invitation and token records', async () => {
    const { repository, service, setNow } = fixture();
    const created = await createInvitation(service);
    const snapshot = repository.snapshot();
    const invitationEntry = Object.entries(snapshot)
      .find(([path]) => path.includes('/invitations/'));
    const tokenEntry = Object.entries(snapshot)
      .find(([path]) => path.startsWith('_invitationTokens/'));
    expect(invitationEntry).toBeDefined();
    expect(tokenEntry).toBeDefined();
    const [invitationPath, rawInvitation] = invitationEntry as [string, Record<string, unknown>];
    const [tokenPath, rawToken] = tokenEntry as [string, Record<string, unknown>];
    repository.seedDocument(invitationPath, {
      ...rawInvitation,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    repository.seedDocument(tokenPath, {
      ...rawToken,
      expiresAt: '2026-12-31T00:00:00.000Z',
    });
    setNow('2026-12-09T00:00:00.000Z');

    await expect(service.inspectInvitation(created.shareToken as string))
      .rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    await expect(service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-extended-expiry', email: invitedEmail, displayName: null },
      requestId: 'request:invite:accept:extended-expiry',
      idempotencyKey: 'idempotency-accept-extended-expiry-0001',
    })).rejects.toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(repository.activeMembershipCount(workspaceId)).toBe(1);
  });

  it('binds stored idempotency identity and workspace to the exact document path', async () => {
    const { repository, service } = fixture();
    const created = await createInvitation(service);
    const idempotencyEntry = Object.entries(repository.snapshot())
      .find(([path]) => path.includes('/invitationIdempotency/'));
    expect(idempotencyEntry).toBeDefined();
    const [path, rawIdempotency] = idempotencyEntry as [string, Record<string, unknown>];
    repository.seedDocument(path, {
      ...rawIdempotency,
      id: 'idem_ffffffffffffffffffffffffffffffff',
      workspaceId: 'ws_foreign_tampered',
    });

    let replayError: unknown;
    try {
      await createInvitation(service, { requestId: 'request:invite:create:tampered-replay' });
    } catch (error) {
      replayError = error;
    }
    expect(replayError).toMatchObject({ code: 'INVITATION_SERVICE_UNAVAILABLE' });
    expect(JSON.stringify(replayError)).not.toContain(created.shareToken as string);
  });

  it('reactivates a removed exact-workspace member atomically and only once', async () => {
    const { repository, service } = fixture();
    repository.seedDocument(`workspaces/${workspaceId}/memberships/member-returning`, {
      schemaVersion: 1,
      id: 'mem_returning',
      workspaceId,
      userId: 'member-returning',
      role: 'member',
      status: 'removed',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      removedAt: '2026-11-20T00:00:00.000Z',
      revision: 2,
    });
    const created = await createInvitation(service, {
      email: 'returning@example.com',
      key: 'idempotency-invite-returning-0001',
    });
    const accepted = await service.acceptInvitation({
      token: created.shareToken as string,
      identity: { uid: 'member-returning', email: 'returning@example.com', displayName: null },
      requestId: 'request:invite:accept:returning',
      idempotencyKey: 'idempotency-accept-returning-0001',
    });
    expect(accepted.activeSeatAdded).toBe(true);
    expect(accepted.membership.revision).toBe(3);
    expect(repository.activeMembershipCount(workspaceId)).toBe(2);
  });

  it('enforces owner authorization across web, REST, MCP, token, and removed-member forms', async () => {
    const { repository, service } = fixture();
    for (const [index, principal] of [
      ownerPrincipal('web'),
      ownerPrincipal('rest'),
      ownerPrincipal('mcp'),
      {
        kind: 'personal_token' as const,
        userId: ownerId,
        tokenReference: 'tokref_0123456789abcdef0123456789abcdef',
        credentialWorkspaceId: workspaceId,
        source: 'rest' as const,
      },
    ].entries()) {
      const created = await createInvitation(service, {
        principal,
        email: `member-${index}@example.com`,
        key: `idempotency-role-source-${index}-0001`,
        requestId: `request:role:source:${index}`,
      });
      expect(created.invitation.state).toBe('pending');
    }

    repository.seedDocument(`workspaces/${workspaceId}/memberships/member-denied`, {
      schemaVersion: 1,
      id: 'mem_member_denied',
      workspaceId,
      userId: 'member-denied',
      role: 'member',
      status: 'active',
      createdAt: '2026-12-01T00:00:00.000Z',
      revision: 1,
    });
    repository.seedDocument(`workspaces/${workspaceId}/memberships/member-removed`, {
      schemaVersion: 1,
      id: 'mem_member_removed',
      workspaceId,
      userId: 'member-removed',
      role: 'member',
      status: 'removed',
      createdAt: '2026-12-01T00:00:00.000Z',
      revision: 2,
    });
    for (const [index, principal] of [
      { kind: 'user' as const, userId: 'member-denied', source: 'web' as const },
      { kind: 'user' as const, userId: 'member-removed', source: 'mcp' as const },
    ].entries()) {
      await expect(createInvitation(service, {
        principal,
        email: `denied-${index}@example.com`,
        key: `idempotency-role-denied-${index}-0001`,
      })).rejects.toBeInstanceOf(WorkspaceAuthorizationError);
    }
  });

  it('keeps malformed tokens generic and rejects self-invites and key reuse safely', async () => {
    const { service } = fixture();
    await expect(service.inspectInvitation('inv_not-a-real-token'))
      .rejects.toEqual(expect.objectContaining({ code: 'INVITATION_UNAVAILABLE' }));
    await expect(createInvitation(service, { email: 'OWNER@example.com' }))
      .rejects.toBeInstanceOf(InvitationServiceError);
    await expect(service.createOwnerInvitation({
      principal: ownerPrincipal('mcp'),
      workspaceId,
      requestId: 'request:invite:self-without-email',
      idempotencyKey: 'idempotency-self-without-email-0001',
      invitedEmail: 'OWNER@example.com',
      inviterDisplayName: 'Product Owner',
    })).rejects.toMatchObject({ code: 'INVALID_INVITATION_REQUEST' });
    await createInvitation(service, { email: 'first@example.com', key: 'same-key-conflict-00000001' });
    await expect(createInvitation(service, {
      email: 'second@example.com',
      key: 'same-key-conflict-00000001',
    })).rejects.toMatchObject({ code: 'INVITATION_CONFLICT' });
  });
});
