import { describe, expect, it } from 'vitest';
import {
  CollaborationService,
  CollaborationServiceError,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  type WorkspaceRole,
} from '../src/index.js';
import { proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_collaboration';
const ownerId = 'owner_collaboration';
const memberId = 'member_collaboration';
const otherId = 'other_collaboration';

const principal = (userId: string) => ({ kind: 'user' as const, userId, source: 'web' as const });

const storedMembership = (
  userId: string,
  role: WorkspaceRole,
  status: 'active' | 'removed' = 'active',
) => ({
  schemaVersion: 1,
  id: `mem_${userId}`,
  workspaceId,
  userId,
  role,
  status,
  createdAt: '2026-12-01T00:00:00.000Z',
  ...(status === 'removed' ? {
    updatedAt: '2026-12-02T00:00:00.000Z',
    removedAt: '2026-12-02T00:00:00.000Z',
  } : {}),
  revision: status === 'active' ? 1 : 2,
});

function setup() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  let sequence = 1;
  let now = new Date('2026-12-03T00:00:00.000Z');
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  for (const [userId, role] of [[ownerId, 'owner'], [memberId, 'member'], [otherId, 'member']] as const) {
    memberships.set({ schemaVersion: 1, workspaceId, userId, role, status: 'active', revision: 1 });
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, storedMembership(userId, role));
  }
  const authorization = new WorkspaceAuthorizationService(memberships, evidence, {
    clock: () => now,
    idFactory,
  });
  const service = new CollaborationService(repository, authorization, {
    secret: 'collaboration-test-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  return {
    repository,
    memberships,
    evidence,
    service,
    setNow(value: string) { now = new Date(value); },
  };
}

describe('CollaborationService', () => {
  it('creates and lists a task with retry-safe idempotency and privacy-safe evidence', async () => {
    const context = setup();
    const command = {
      principal: principal(ownerId), workspaceId, requestId: 'request_issue_create',
      idempotencyKey: 'issue-create-retry-key-0001', title: 'Prepare launch checklist',
    };
    const created = await context.service.createIssue(command);
    const replayed = await context.service.createIssue(command);
    expect(created.number).toBe(1);
    expect(replayed).toEqual(created);
    expect(await context.service.listIssues({
      principal: principal(ownerId), workspaceId, requestId: 'request_issue_list',
    })).toEqual([created]);

    const snapshot = context.repository.snapshot();
    expect(Object.keys(snapshot).filter((path) => path.includes('/issues/'))).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain('Bearer ');
    expect(JSON.stringify(snapshot)).not.toContain('issue-create-retry-key-0001');
    const events = Object.entries(snapshot).filter(([path]) => path.includes('/productEvents/'));
    expect(events).toHaveLength(1);
    expect(events[0]?.[1]).toMatchObject({ name: 'issue.created', attributes: { issueId: created.id } });
  });

  it('backfills existing issues chronologically and reserves continuous workspace numbers', async () => {
    const context = setup();
    const legacyIssue = (id: string, title: string, createdAt: string) => ({
      schemaVersion: 1,
      id,
      workspaceId,
      title,
      status: 'todo',
      priority: 'no_priority',
      assigneeUserId: null,
      createdByUserId: ownerId,
      createdAt,
      updatedAt: createdAt,
      revision: 1,
    });
    const laterId = 'issue_00000000000000000000000000000022';
    const earlierId = 'issue_00000000000000000000000000000011';
    context.repository.seedDocument(
      `workspaces/${workspaceId}/issues/${laterId}`,
      legacyIssue(laterId, 'Later existing issue', '2026-12-02T00:00:00.000Z'),
    );
    context.repository.seedDocument(
      `workspaces/${workspaceId}/issues/${earlierId}`,
      legacyIssue(earlierId, 'Earlier existing issue', '2026-12-01T00:00:00.000Z'),
    );

    const beforeRead = context.repository.snapshot();
    const listed = await context.service.listIssues({
      principal: principal(ownerId), workspaceId, requestId: 'request_numbered_legacy_list',
    });
    expect(new Map(listed.map((issue) => [issue.id, issue.number]))).toEqual(new Map([
      [earlierId, 1],
      [laterId, 2],
    ]));
    expect(context.repository.snapshot()).toEqual(beforeRead);

    const created = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_numbered_create',
      idempotencyKey: 'numbered-create-key-0001', title: 'Next continuous issue',
    });
    expect(created.number).toBe(3);

    const snapshot = context.repository.snapshot();
    expect(snapshot[`workspaces/${workspaceId}/issueSequences/issues`]).toMatchObject({
      schemaVersion: 1,
      workspaceId,
      nextNumber: 4,
    });
    expect(snapshot[`workspaces/${workspaceId}/issues/${earlierId}`]).toMatchObject({number: 1});
    expect(snapshot[`workspaces/${workspaceId}/issues/${laterId}`]).toMatchObject({number: 2});
  });

  it('persists rich issue content, sub-issue relationships, resources, and readable activity', async () => {
    const context = setup();
    const parent = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_rich_parent',
      idempotencyKey: 'rich-parent-key-0001', title: 'Launch the hosted workspace',
      description: 'Ship a production-ready product-management experience.',
      resources: [{label: 'Launch brief', url: 'https://example.com/launch-brief'}],
    });
    expect(parent).toMatchObject({
      description: 'Ship a production-ready product-management experience.',
      parentIssueId: null,
      resources: [{label: 'Launch brief', url: 'https://example.com/launch-brief'}],
    });

    context.setNow('2026-12-03T00:01:00.000Z');
    const child = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_rich_child',
      idempotencyKey: 'rich-child-key-0001', title: 'Verify the invitation flow',
      parentIssueId: parent.id,
    });
    expect(child.parentIssueId).toBe(parent.id);

    context.setNow('2026-12-03T00:02:00.000Z');
    const updated = await context.service.updateIssue({
      principal: principal(ownerId), workspaceId, issueId: parent.id,
      expectedRevision: parent.revision, requestId: 'request_rich_update',
      idempotencyKey: 'rich-update-key-0001',
      patch: {
        description: 'Ship and verify the complete hosted workspace.',
        resources: [
          {label: 'Launch brief', url: 'https://example.com/launch-brief'},
          {label: 'Verification plan', url: 'https://example.com/verification'},
        ],
      },
    });
    expect(updated).toMatchObject({revision: 2, resources: expect.arrayContaining([
      {label: 'Verification plan', url: 'https://example.com/verification'},
    ])});

    const activity = await context.service.listIssueActivity({
      principal: principal(ownerId), workspaceId, issueId: parent.id, requestId: 'request_rich_activity',
    });
    expect(activity.map((entry) => entry.action)).toEqual([
      'issue.created', 'issue.description.changed', 'issue.resources.changed',
    ]);
  });

  it('assigns only an active same-workspace member and never mutates on a rejected assignment', async () => {
    const context = setup();
    const issue = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_create_assignable',
      idempotencyKey: 'create-assignable-key-0001', title: 'Write onboarding copy',
    });
    context.setNow('2026-12-03T00:01:00.000Z');
    const assigned = await context.service.assignIssue({
      principal: principal(ownerId), workspaceId, issueId: issue.id,
      expectedRevision: 1, assigneeUserId: memberId,
      requestId: 'request_assign_member', idempotencyKey: 'assign-member-key-0001',
    });
    expect(assigned).toMatchObject({ assigneeUserId: memberId, revision: 2 });

    context.repository.seedDocument(
      `workspaces/${workspaceId}/memberships/${otherId}`,
      storedMembership(otherId, 'member', 'removed'),
    );
    const before = context.repository.snapshot();
    await expect(context.service.assignIssue({
      principal: principal(ownerId), workspaceId, issueId: issue.id,
      expectedRevision: 2, assigneeUserId: otherId,
      requestId: 'request_assign_removed', idempotencyKey: 'assign-removed-key-0001',
    })).rejects.toMatchObject({ code: 'ASSIGNEE_UNAVAILABLE' });
    expect(context.repository.snapshot()).toEqual(before);

    const event = Object.values(before).find((value) => (
      typeof value === 'object' && value !== null && (value as {name?: string}).name === 'issue.assigned'
    ));
    expect(event).toMatchObject({ attributes: { issueId: issue.id, assigneeUserId: `user:${memberId}` } });
  });

  it('lets the assigned member update allowed fields with optimistic conflicts and emits the O-202 action', async () => {
    const context = setup();
    const issue = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_create_member_work',
      idempotencyKey: 'create-member-work-key-0001', title: 'Triage customer feedback',
    });
    const assigned = await context.service.assignIssue({
      principal: principal(ownerId), workspaceId, issueId: issue.id, expectedRevision: 1,
      assigneeUserId: memberId, requestId: 'request_assign_work',
      idempotencyKey: 'assign-member-work-key-0001',
    });
    context.setNow('2026-12-03T00:02:00.000Z');
    const updated = await context.service.updateIssue({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      expectedRevision: assigned.revision, patch: { status: 'in_progress' },
      requestId: 'request_member_update', idempotencyKey: 'member-update-key-0001',
    });
    expect(updated).toMatchObject({ status: 'in_progress', revision: 3 });
    const beforeConflict = context.repository.snapshot();
    await expect(context.service.updateIssue({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      expectedRevision: 2, patch: { priority: 'high' },
      requestId: 'request_stale_update', idempotencyKey: 'stale-member-update-key-0001',
    })).rejects.toBeInstanceOf(CollaborationServiceError);
    expect(context.repository.snapshot()).toEqual(beforeConflict);
    expect(Object.values(beforeConflict)).toContainEqual(expect.objectContaining({
      name: 'issue.member_action.completed',
      actor: { kind: 'user', id: `user:${memberId}` },
      attributes: { issueId: issue.id, memberUserId: `user:${memberId}`, action: 'status_changed' },
    }));
  });

  it('keeps comment author and creation time immutable through edit and soft delete', async () => {
    const context = setup();
    const issue = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_create_comment_issue',
      idempotencyKey: 'create-comment-issue-key-0001', title: 'Confirm launch scope',
    });
    context.setNow('2026-12-03T00:03:00.000Z');
    const created = await context.service.createComment({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      body: 'I confirmed the product-management-only scope.',
      requestId: 'request_comment_create', idempotencyKey: 'comment-create-key-0001',
    });
    context.setNow('2026-12-03T00:04:00.000Z');
    const edited = await context.service.editComment({
      principal: principal(memberId), workspaceId, issueId: issue.id, commentId: created.id,
      expectedRevision: 1, body: 'I confirmed the bounded product management scope.',
      requestId: 'request_comment_edit', idempotencyKey: 'comment-edit-key-0001',
    });
    context.setNow('2026-12-03T00:05:00.000Z');
    const deleted = await context.service.deleteComment({
      principal: principal(memberId), workspaceId, issueId: issue.id, commentId: created.id,
      expectedRevision: 2, requestId: 'request_comment_delete',
      idempotencyKey: 'comment-delete-key-0001',
    });
    expect(deleted).toMatchObject({
      authorUserId: memberId, createdAt: created.createdAt, body: null,
      deletedAt: '2026-12-03T00:05:00.000Z', revision: 3,
    });
    const listed = await context.service.listComments({
      principal: principal(ownerId), workspaceId, issueId: issue.id, requestId: 'request_comment_list',
    });
    expect(listed).toEqual([deleted]);
    const snapshotText = JSON.stringify(context.repository.snapshot());
    const auditText = JSON.stringify(Object.entries(context.repository.snapshot())
      .filter(([path]) => path.includes('/mutationAudits/')).map(([, value]) => value));
    expect(snapshotText).toContain('comment.created');
    expect(auditText).not.toContain('bounded product management scope');
  });

  it('fails closed when membership is removed between authorization and the transaction', async () => {
    const context = setup();
    const issue = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_create_race_issue',
      idempotencyKey: 'create-race-issue-key-0001', title: 'Race-safe task',
    });
    context.repository.seedDocument(
      `workspaces/${workspaceId}/memberships/${memberId}`,
      storedMembership(memberId, 'member', 'removed'),
    );
    const before = context.repository.snapshot();
    await expect(context.service.createComment({
      principal: principal(memberId), workspaceId, issueId: issue.id, body: 'Must not persist',
      requestId: 'request_removed_member', idempotencyKey: 'removed-member-key-0001',
    })).rejects.toMatchObject({ code: 'COLLABORATION_FORBIDDEN' });
    expect(context.repository.snapshot()).toEqual(before);
  });

  it('limits assignment and comment moderation authority without exposing foreign records', async () => {
    const context = setup();
    const issue = await context.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_create_authority_issue',
      idempotencyKey: 'create-authority-issue-key-0001', title: 'Authority task',
    });
    await expect(context.service.assignIssue({
      principal: principal(memberId), workspaceId, issueId: issue.id, expectedRevision: 1,
      assigneeUserId: memberId, requestId: 'request_member_assign',
      idempotencyKey: 'member-assign-key-0001',
    })).rejects.toMatchObject({ code: 'COLLABORATION_FORBIDDEN' });
    const comment = await context.service.createComment({
      principal: principal(memberId), workspaceId, issueId: issue.id, body: 'Member-authored comment',
      requestId: 'request_member_comment', idempotencyKey: 'member-comment-key-0001',
    });
    await expect(context.service.editComment({
      principal: principal(otherId), workspaceId, issueId: issue.id, commentId: comment.id,
      expectedRevision: 1, body: 'Unauthorized edit', requestId: 'request_foreign_edit',
      idempotencyKey: 'foreign-comment-edit-key-0001',
    })).rejects.toMatchObject({ code: 'COLLABORATION_FORBIDDEN' });
    const ownerEdit = await context.service.editComment({
      principal: principal(ownerId), workspaceId, issueId: issue.id, commentId: comment.id,
      expectedRevision: 1, body: 'Owner moderation edit', requestId: 'request_owner_edit',
      idempotencyKey: 'owner-comment-edit-key-0001',
    });
    expect(ownerEdit).toMatchObject({ authorUserId: memberId, revision: 2 });
  });

  it('serializes concurrent revisions and converges concurrent retries to one record', async () => {
    const context = setup();
    const command = {
      principal: principal(ownerId), workspaceId, requestId: 'request_concurrent_create',
      idempotencyKey: 'concurrent-create-key-0001', title: 'One concurrent task',
    };
    const [left, right] = await Promise.all([
      context.service.createIssue(command),
      context.service.createIssue(command),
    ]);
    expect(right).toEqual(left);
    const results = await Promise.allSettled([
      context.service.updateIssue({
        principal: principal(ownerId), workspaceId, issueId: left.id, expectedRevision: 1,
        patch: { status: 'in_progress' }, requestId: 'request_concurrent_left',
        idempotencyKey: 'concurrent-update-left-0001',
      }),
      context.service.updateIssue({
        principal: principal(ownerId), workspaceId, issueId: left.id, expectedRevision: 1,
        patch: { priority: 'high' }, requestId: 'request_concurrent_right',
        idempotencyKey: 'concurrent-update-right-0001',
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((results.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'COLLABORATION_CONFLICT' });
  });

  it('binds retry keys to their request and fails closed for signed-record or clock tampering', async () => {
    const context = setup();
    const command = {
      principal: principal(ownerId), workspaceId, requestId: 'request_bound_key',
      idempotencyKey: 'bound-create-key-0001', title: 'Bound request task',
    };
    await context.service.createIssue(command);
    const beforeMismatch = context.repository.snapshot();
    await expect(context.service.createIssue({ ...command, title: 'Different request task' }))
      .rejects.toMatchObject({ code: 'COLLABORATION_CONFLICT' });
    expect(context.repository.snapshot()).toEqual(beforeMismatch);

    const idempotencyPath = Object.keys(beforeMismatch).find((path) => path.includes('/collaborationIdempotency/'));
    expect(idempotencyPath).toBeDefined();
    const idempotency = beforeMismatch[idempotencyPath as string] as Record<string, unknown>;
    context.repository.seedDocument(idempotencyPath as string, { ...idempotency, outcomeRevision: 99 });
    const beforeTamper = context.repository.snapshot();
    await expect(context.service.createIssue(command))
      .rejects.toMatchObject({ code: 'COLLABORATION_SERVICE_UNAVAILABLE' });
    expect(context.repository.snapshot()).toEqual(beforeTamper);

    const fresh = setup();
    fresh.repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
      ...storedMembership(ownerId, 'owner'),
      createdAt: '2026-12-04T00:00:00.000Z',
    });
    const beforeClock = fresh.repository.snapshot();
    await expect(fresh.service.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_regressed_clock',
      idempotencyKey: 'regressed-clock-key-0001', title: 'Must fail closed',
    })).rejects.toMatchObject({ code: 'COLLABORATION_SERVICE_UNAVAILABLE' });
    expect(fresh.repository.snapshot()).toEqual(beforeClock);
  });

  it('fails closed on malformed stored task data instead of partially disclosing a list', async () => {
    const context = setup();
    context.repository.seedDocument(
      `workspaces/${workspaceId}/issues/issue_00000000000000000000000000000099`,
      {
        schemaVersion: 1,
        id: 'issue_00000000000000000000000000000099',
        workspaceId,
        title: 'Poisoned task',
        status: 'pending',
        priority: 'no_priority',
        assigneeUserId: null,
        createdByUserId: ownerId,
        createdAt: '2026-12-03T00:00:00.000Z',
        updatedAt: '2026-12-03T00:00:00.000Z',
        revision: 1,
      },
    );
    await expect(context.service.listIssues({
      principal: principal(ownerId), workspaceId, requestId: 'request_poisoned_list',
    })).rejects.toMatchObject({ code: 'COLLABORATION_SERVICE_UNAVAILABLE' });
  });
});
