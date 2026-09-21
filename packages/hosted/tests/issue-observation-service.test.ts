import {describe, expect, it} from 'vitest';
import {
  CollaborationService,
  IssueObservationService,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
} from '../src/index.js';
import {proEntitlementPolicyForTests} from './fixtures/entitlement.js';

const workspaceId = 'ws_observation';
const ownerId = 'owner_observation';
const memberId = 'member_observation';
const secret = 'observation-test-secret-at-least-32-bytes-long';
const principal = (userId: string) => ({kind: 'user' as const, userId, source: 'web' as const});

function setup() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  let now = new Date('2026-12-03T00:00:00.000Z');
  let sequence = 1;
  for (const [userId, role] of [[ownerId, 'owner'], [memberId, 'member']] as const) {
    memberships.set({schemaVersion: 1, workspaceId, userId, role, status: 'active', revision: 1});
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, {
      schemaVersion: 1, id: `mem_${userId}`, workspaceId, userId, role,
      status: 'active', createdAt: '2026-12-01T00:00:00.000Z', revision: 1,
    });
  }
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    {clock: () => now, idFactory: () => (sequence++).toString(16).padStart(32, '0')},
  );
  return {
    repository,
    collaboration: new CollaborationService(repository, authorization, {
      secret, entitlementPolicy: proEntitlementPolicyForTests,
      clock: () => now, idFactory: () => (sequence++).toString(16).padStart(32, '0'),
    }),
    observation: new IssueObservationService(repository, authorization, {secret, clock: () => now}),
    setNow(value: string) { now = new Date(value); },
  };
}

describe('IssueObservationService', () => {
  it('matches the Linear subscribe journey and produces durable assignee/comment notifications', async () => {
    const context = setup();
    const issue = await context.collaboration.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_observation_create',
      idempotencyKey: 'observation-create-key-0001', title: 'Verify observation flow',
    });
    context.setNow('2026-12-03T00:01:00.000Z');
    const assigned = await context.collaboration.assignIssue({
      principal: principal(ownerId), workspaceId, issueId: issue.id, expectedRevision: 1,
      assigneeUserId: memberId, requestId: 'request_observation_assign',
      idempotencyKey: 'observation-assign-key-0001',
    });
    const memberObservation = await context.observation.getIssueObservation({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      requestId: 'request_observation_member_get',
    });
    expect(memberObservation).toMatchObject({subscribed: true, mode: 'automatic'});
    expect(memberObservation.subscriberUserIds).toEqual([memberId, ownerId]);

    context.setNow('2026-12-03T00:02:00.000Z');
    await context.collaboration.createComment({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      requestId: 'request_observation_comment', idempotencyKey: 'observation-comment-key-0001',
      body: 'The second account can collaborate.',
    });
    const notifications = await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_observation_notifications',
    });
    expect(notifications).toEqual([expect.objectContaining({
      issueId: issue.id, issueTitle: issue.title, action: 'comment.created',
      actorUserId: memberId, unread: true,
    })]);

    context.setNow('2026-12-03T00:03:00.000Z');
    const readCommand = {
      principal: principal(ownerId), workspaceId, issueId: issue.id,
      requestId: 'request_observation_read', idempotencyKey: 'observation-read-key-0001',
    };
    const read = await context.observation.markIssueNotificationsRead(readCommand);
    expect(await context.observation.markIssueNotificationsRead(readCommand)).toEqual(read);
    expect((await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_observation_after_read',
    }))[0]?.unread).toBe(false);

    context.setNow('2026-12-03T00:04:00.000Z');
    const unsubscribed = await context.observation.setIssueSubscription({
      principal: principal(ownerId), workspaceId, issueId: assigned.id,
      requestId: 'request_observation_unsubscribe', idempotencyKey: 'observation-unsubscribe-key-0001',
      subscribed: false,
    });
    expect(unsubscribed).toMatchObject({subscribed: false, mode: 'explicit'});
    expect(unsubscribed.subscriberUserIds).toEqual([memberId]);
  });

  it('emits an unread reminder exactly at a task due time and suppresses it after completion', async () => {
    const context = setup();
    const dueAt = '2026-12-03T00:05:00.000Z';
    const issue = await context.collaboration.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_due_create',
      idempotencyKey: 'observation-due-create-key-0001',
      title: 'Deliver the due-time reminder',
      dueAt,
    });

    context.setNow('2026-12-03T00:04:59.999Z');
    expect(await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_due_before',
    })).toEqual([]);

    context.setNow(dueAt);
    expect(await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_due_exact',
    })).toEqual([{
      id: `${issue.id}:due:${dueAt}`,
      issueId: issue.id,
      issueTitle: issue.title,
      action: 'issue.due',
      actorUserId: null,
      occurredAt: dueAt,
      unread: true,
    }]);

    await context.observation.markIssueNotificationsRead({
      principal: principal(ownerId), workspaceId, issueId: issue.id,
      requestId: 'request_due_read', idempotencyKey: 'observation-due-read-key-0001',
    });
    expect((await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_due_after_read',
    }))[0]?.unread).toBe(false);

    context.setNow('2026-12-03T00:06:00.000Z');
    await context.collaboration.updateIssue({
      principal: principal(ownerId), workspaceId, issueId: issue.id,
      expectedRevision: issue.revision, requestId: 'request_due_complete',
      idempotencyKey: 'observation-due-complete-key-0001',
      patch: {status: 'done'},
    });
    expect((await context.observation.listNotifications({
      principal: principal(ownerId), workspaceId, requestId: 'request_due_completed',
    })).some((notification) => notification.action === 'issue.due')).toBe(false);
  });
});
