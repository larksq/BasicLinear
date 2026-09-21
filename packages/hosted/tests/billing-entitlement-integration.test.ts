import { describe, expect, it } from 'vitest';
import {
  BillingEntitlementPolicy,
  CollaborationService,
  InvitationService,
  MemoryCollaborationRepository,
  MemoryInvitationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from '../src/index.js';
import { noopBillingSeatReconcilerForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_entitlement_integration';
const ownerId = 'owner_entitlement';
const memberId = 'member_entitlement';
const trialStartedAt = '2026-12-01T00:00:00.000Z';
const trialEndsAt = '2026-12-31T00:00:00.000Z';
const billingSecret = 'entitlement-policy-secret-at-least-thirty-two-bytes';
const policy = () => new BillingEntitlementPolicy({
  secret: billingSecret,
  monthlyPriceId: 'price_entitlement_monthly',
  annualPriceId: 'price_entitlement_annual',
});

const workspace = {
  schemaVersion: 1, id: workspaceId, workspaceId, name: 'Entitlement workspace',
  ownerUid: ownerId, authority: 'firebase-hosted', createdAt: trialStartedAt, revision: 1,
};
const trial = {
  schemaVersion: 1, id: 'trial_entitlement', workspaceId, plan: 'pro', status: 'active',
  trialStartedAt, trialEndsAt, source: 'owner_bootstrap', revision: 1,
};
const membership = (userId: string, role: 'owner' | 'member') => ({
  schemaVersion: 1, id: `mem_${userId}`, workspaceId, userId, role, status: 'active',
  createdAt: trialStartedAt, revision: 1,
});
const userPrincipal = (userId: string): WorkspacePrincipal => ({kind: 'user', userId, source: 'web'});

describe('Free fallback integration', () => {
  it('preserves task/comment reads and retry recovery while pausing member, token, automation, and multi-user writes', async () => {
    const repository = new MemoryCollaborationRepository();
    repository.seedDocument(`workspaces/${workspaceId}`, workspace);
    repository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, trial);
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, membership(ownerId, 'owner'));
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${memberId}`, membership(memberId, 'member'));
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({schemaVersion: 1, workspaceId, userId: ownerId, role: 'owner', status: 'active', revision: 1});
    memberships.set({schemaVersion: 1, workspaceId, userId: memberId, role: 'member', status: 'active', revision: 1});
    let now = new Date('2026-12-03T00:00:00.000Z');
    let sequence = 1;
    const authorization = new WorkspaceAuthorizationService(
      memberships,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => now, idFactory: () => (sequence++).toString(16).padStart(32, '0')},
    );
    const service = new CollaborationService(repository, authorization, {
      secret: 'entitlement-collaboration-secret-at-least-32-bytes',
      entitlementPolicy: policy(),
      seatReconciler: noopBillingSeatReconcilerForTests,
      clock: () => now,
      idFactory: () => (sequence++).toString(16).padStart(32, '0'),
    });
    const issue = await service.createIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_create',
      idempotencyKey: 'entitlement-create-key-0001', title: 'Preserved task',
    });
    const assigned = await service.assignIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_assign',
      idempotencyKey: 'entitlement-assign-key-0001', issueId: issue.id,
      expectedRevision: issue.revision, assigneeUserId: memberId,
    });
    await service.createComment({
      principal: userPrincipal(memberId), workspaceId, requestId: 'entitlement_comment',
      idempotencyKey: 'entitlement-comment-key-0001', issueId: issue.id, body: 'Preserved comment',
    });
    now = new Date('2026-12-30T00:00:00.000Z');
    const retryOnlyIssue = await service.createIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_retry_create',
      idempotencyKey: 'entitlement-retry-key-0001', title: 'Retry-only task',
    });
    now = new Date(trialEndsAt);
    await expect(service.createIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_replay',
      idempotencyKey: 'entitlement-retry-key-0001', title: 'Retry-only task',
    })).resolves.toEqual(retryOnlyIssue);
    await expect(service.createIssue({
      principal: userPrincipal(memberId), workspaceId, requestId: 'entitlement_member_write',
      idempotencyKey: 'entitlement-member-key-0001', title: 'Blocked member task',
    })).rejects.toMatchObject({code: 'COLLABORATION_ENTITLEMENT_REQUIRED'});
    await expect(service.createIssue({
      principal: {
        kind: 'personal_token', userId: ownerId, source: 'rest', workspaceId,
        credentialWorkspaceId: workspaceId, tokenReference: 'tokref_0123456789abcdef0123456789abcdef',
      } as WorkspacePrincipal,
      workspaceId,
      requestId: 'entitlement_token_write', idempotencyKey: 'entitlement-token-key-0001',
      title: 'Blocked token task',
    })).rejects.toMatchObject({code: 'COLLABORATION_ENTITLEMENT_REQUIRED'});
    await expect(service.assignIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_reassign',
      idempotencyKey: 'entitlement-reassign-key-0001', issueId: issue.id,
      expectedRevision: assigned.revision, assigneeUserId: memberId,
    })).rejects.toMatchObject({code: 'COLLABORATION_ENTITLEMENT_REQUIRED'});
    const unassigned = await service.assignIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_unassign',
      idempotencyKey: 'entitlement-unassign-key-0001', issueId: issue.id,
      expectedRevision: assigned.revision, assigneeUserId: null,
    });
    expect(unassigned.assigneeUserId).toBeNull();
    await expect(service.updateIssue({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_owner_update',
      idempotencyKey: 'entitlement-owner-update-0001', issueId: issue.id,
      expectedRevision: unassigned.revision, patch: {status: 'done'},
    })).resolves.toMatchObject({status: 'done'});
    await expect(service.listIssues({
      principal: userPrincipal(memberId), workspaceId, requestId: 'entitlement_member_read',
    })).resolves.toHaveLength(2);
    await expect(service.listComments({
      principal: userPrincipal(memberId), workspaceId, requestId: 'entitlement_comment_read', issueId: issue.id,
    })).resolves.toEqual([expect.objectContaining({body: 'Preserved comment'})]);
    expect(JSON.stringify(repository.snapshot())).not.toContain('Blocked member task');
    expect(JSON.stringify(repository.snapshot())).not.toContain('Blocked token task');
  });

  it('pauses new/resend/accept seat operations on Free, preserves exact retry recovery, and permits revoke', async () => {
    const repository = new MemoryInvitationRepository();
    repository.seedDocument(`workspaces/${workspaceId}`, workspace);
    repository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, trial);
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, membership(ownerId, 'owner'));
    repository.seedDocument(`hostedUsers/${ownerId}`, {
      schemaVersion: 1, uid: ownerId, email: 'owner@example.com', displayName: 'Owner',
      authProvider: 'google.com', updatedAt: trialStartedAt,
    });
    let now = new Date('2026-12-30T00:00:00.000Z');
    let sequence = 100;
    const authorization = new WorkspaceAuthorizationService(
      repository,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => now, idFactory: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`},
    );
    const service = new InvitationService(repository, authorization, {
      secret: 'entitlement-invitation-secret-at-least-32-bytes',
      entitlementPolicy: policy(),
      clock: () => now,
      idFactory: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
    });
    const command = {
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_invite_create',
      idempotencyKey: 'entitlement-invite-key-0001', invitedEmail: 'member@example.com',
      inviterDisplayName: 'Owner',
    };
    const created = await service.createOwnerInvitation(command);
    expect(created.shareToken).not.toBeNull();
    now = new Date(trialEndsAt);
    await expect(service.createOwnerInvitation({...command, requestId: 'entitlement_invite_replay'}))
      .resolves.toMatchObject({changed: false, shareToken: created.shareToken, invitation: {id: created.invitation.id, state: 'pending'}});
    await expect(service.createOwnerInvitation({
      ...command, requestId: 'entitlement_invite_new', idempotencyKey: 'entitlement-invite-key-0002',
      invitedEmail: 'second@example.com',
    })).rejects.toMatchObject({code: 'INVITATION_ENTITLEMENT_REQUIRED'});
    await expect(service.resendOwnerInvitation({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_invite_resend',
      idempotencyKey: 'entitlement-resend-key-0001', invitationId: created.invitation.id,
    })).rejects.toMatchObject({code: 'INVITATION_ENTITLEMENT_REQUIRED'});
    await expect(service.acceptInvitation({
      token: created.shareToken as string,
      identity: {uid: memberId, email: 'member@example.com', displayName: 'Member'},
      requestId: 'entitlement_invite_accept', idempotencyKey: 'entitlement-accept-key-0001',
    })).rejects.toMatchObject({code: 'INVITATION_ENTITLEMENT_REQUIRED'});
    await expect(service.revokeOwnerInvitation({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'entitlement_invite_revoke',
      idempotencyKey: 'entitlement-revoke-key-0001', invitationId: created.invitation.id,
    })).resolves.toMatchObject({changed: true, invitation: {state: 'revoked'}});
    expect(repository.readDocument(`workspaces/${workspaceId}/memberships/${memberId}`)).toBeNull();
  });

  it('durably retries paid-seat reconciliation after membership acceptance without adding a second seat', async () => {
    const repository = new MemoryInvitationRepository();
    repository.seedDocument(`workspaces/${workspaceId}`, workspace);
    repository.seedDocument(`workspaces/${workspaceId}/entitlements/current`, trial);
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, membership(ownerId, 'owner'));
    repository.seedDocument(`hostedUsers/${ownerId}`, {
      schemaVersion: 1, uid: ownerId, email: 'owner@example.com', displayName: 'Owner',
      authProvider: 'google.com', updatedAt: trialStartedAt,
    });
    const now = new Date('2026-12-03T00:00:00.000Z');
    let sequence = 300;
    const authorization = new WorkspaceAuthorizationService(
      repository,
      new MemoryWorkspaceAuthorizationEvidenceWriter(),
      {clock: () => now, idFactory: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`},
    );
    let reconciliationCalls = 0;
    const service = new InvitationService(repository, authorization, {
      secret: 'seat-retry-invitation-secret-at-least-32-bytes',
      entitlementPolicy: policy(),
      seatReconciler: {reconcileWorkspaceSeats: async () => {
        reconciliationCalls += 1;
        if (reconciliationCalls === 1) throw new Error('provider unavailable');
      }},
      clock: () => now,
      idFactory: () => `00000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
    });
    const created = await service.createOwnerInvitation({
      principal: userPrincipal(ownerId), workspaceId, requestId: 'seat_retry_create',
      idempotencyKey: 'seat-retry-create-key-0001', invitedEmail: 'member@example.com',
      inviterDisplayName: 'Owner',
    });
    const accept = {
      token: created.shareToken as string,
      identity: {uid: memberId, email: 'member@example.com', displayName: 'Member'},
      requestId: 'seat_retry_accept', idempotencyKey: 'seat-retry-accept-key-0001',
    };
    await expect(service.acceptInvitation(accept)).rejects.toMatchObject({code: 'INVITATION_SERVICE_UNAVAILABLE'});
    expect(repository.readDocument(`workspaces/${workspaceId}/memberships/${memberId}`))
      .toMatchObject({status: 'active', revision: 1});
    await expect(service.acceptInvitation({...accept, requestId: 'seat_retry_accept_replay'}))
      .resolves.toMatchObject({state: 'accepted', firstAcceptance: false, activeSeatAdded: false});
    expect(reconciliationCalls).toBe(2);
    expect(repository.readDocument(`workspaces/${workspaceId}/memberships/${memberId}`))
      .toMatchObject({status: 'active', revision: 1});
  });
});
