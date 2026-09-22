import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CollaborationService,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  ProjectManagementService,
  WorkspaceAuthorizationService,
  type WorkspaceRole,
} from '../src/index.js';
import { proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_pm_contract';
const ownerId = 'owner_pm_contract';
const memberId = 'member_pm_contract';
const principal = (userId: string) => ({kind: 'user' as const, userId, source: 'web' as const});

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function storedMembership(userId: string, role: WorkspaceRole) {
  return {
    schemaVersion: 1, id: `mem_${userId}`, workspaceId, userId, role, status: 'active',
    createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  };
}

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  let now = new Date('2027-01-02T00:00:00.000Z');
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  for (const [userId, role] of [[ownerId, 'owner'], [memberId, 'member']] as const) {
    memberships.set({schemaVersion: 1, workspaceId, userId, role, status: 'active', revision: 1});
    repository.seedDocument(
      `workspaces/${workspaceId}/memberships/${userId}`,
      storedMembership(userId, role),
    );
  }
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1,
    id: workspaceId,
    workspaceId,
    name: 'PM contract workspace',
    ownerUid: ownerId,
    authority: 'firebase-hosted',
    createdAt: '2027-01-01T00:00:00.000Z',
    revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(memberships, evidence, {
    clock: () => now,
    idFactory,
  });
  const service = new ProjectManagementService(repository, authorization, {
    secret: 'pm-contract-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  const collaboration = new CollaborationService(repository, authorization, {
    secret: 'pm-collaboration-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  return {
    repository,
    memberships,
    service,
    collaboration,
    setNow(value: string) { now = new Date(value); },
  };
}

describe('ProjectManagementService', () => {
  it('creates and revises projects and milestones with retry, audit, and stale-revision safety', async () => {
    const context = fixture();
    const createProject = {
      principal: principal(ownerId), workspaceId, requestId: 'request_pm_project_create',
      idempotencyKey: 'pm-project-create-key-0001', name: 'Hosted launch',
      summary: 'Product-management API readiness', status: 'in_progress' as const,
    };
    const project = await context.service.createProject(createProject);
    expect(await context.service.createProject(createProject)).toEqual(project);

    context.setNow('2027-01-02T00:01:00.000Z');
    const updated = await context.service.updateProject({
      principal: principal(memberId), workspaceId, projectId: project.id,
      requestId: 'request_pm_project_update', idempotencyKey: 'pm-project-update-key-0001',
      expectedRevision: 1, patch: {status: 'completed'},
    });
    expect(updated).toMatchObject({status: 'completed', revision: 2});
    await expect(context.service.updateProject({
      principal: principal(ownerId), workspaceId, projectId: project.id,
      requestId: 'request_pm_project_stale', idempotencyKey: 'pm-project-stale-key-0001',
      expectedRevision: 1, patch: {summary: 'stale private value'},
    })).rejects.toMatchObject({code: 'PM_CONFLICT'});

    context.setNow('2027-01-02T00:02:00.000Z');
    const milestone = await context.service.createMilestone({
      principal: principal(ownerId), workspaceId, projectId: project.id,
      requestId: 'request_pm_milestone_create', idempotencyKey: 'pm-milestone-create-key-0001',
      name: 'API qualification', description: 'Independent evidence', targetDate: '2027-02-28',
    });
    expect(milestone).toMatchObject({projectId: project.id, targetDate: '2027-02-28', revision: 1});

    const snapshot = context.repository.snapshot();
    const audits = Object.entries(snapshot)
      .filter(([path]) => path.includes('/mutationAudits/'))
      .map(([, value]) => value as {action?: string; changes?: Array<{field: string}>});
    expect(audits.find((audit) => audit.action === 'project.update')?.changes)
      .toEqual(expect.arrayContaining([expect.objectContaining({field: 'revision'}), expect.objectContaining({field: 'status'})]));
    expect(JSON.stringify(audits)).not.toContain('stale private value');
    expect(JSON.stringify(snapshot)).not.toContain('pm-project-create-key-0001');
  });

  it('exports one canonical workspace snapshot without credentials, billing internals, or foreign data', async () => {
    const context = fixture();
    const project = await context.service.createProject({
      principal: principal(ownerId), workspaceId, requestId: 'request_export_project',
      idempotencyKey: 'export-project-key-0001', name: 'Exported product',
    });
    const milestone = await context.service.createMilestone({
      principal: principal(ownerId), workspaceId, projectId: project.id,
      requestId: 'request_export_milestone', idempotencyKey: 'export-milestone-key-0001',
      name: 'Export checkpoint',
    });
    const issue = await context.collaboration.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'request_export_issue',
      idempotencyKey: 'export-issue-key-0001', title: 'Verify portable data',
      projectId: project.id, milestoneId: milestone.id,
    });
    await context.collaboration.createComment({
      principal: principal(memberId), workspaceId, issueId: issue.id,
      requestId: 'request_export_comment', idempotencyKey: 'export-comment-key-0001',
      body: 'Canonical comment',
    });
    context.repository.seedDocument(`workspaces/${workspaceId}/invitations/invite_${'c'.repeat(32)}`, {
      schemaVersion: 1,
      id: `invite_${'c'.repeat(32)}`,
      workspaceId,
      invitedEmail: 'invitee@example.com',
      inviterUserId: ownerId,
      inviterDisplayName: 'PM owner',
      workspaceName: 'PM contract workspace',
      role: 'member',
      status: 'pending',
      createdAt: '2027-01-01T12:00:00.000Z',
      updatedAt: '2027-01-01T12:00:00.000Z',
      lastSentAt: '2027-01-01T12:00:00.000Z',
      expiresAt: '2027-01-08T12:00:00.000Z',
      acceptedAt: null,
      acceptedUserId: null,
      revokedAt: null,
      currentTokenDigest: 'c'.repeat(64),
      sendCount: 1,
      activeSeatApplied: false,
      revision: 1,
    });
    context.repository.seedDocument(`workspaces/${workspaceId}/personalTokens/pat_${'a'.repeat(32)}`, {
      rawToken: 'must-never-export', digest: 'sensitive-digest',
    });
    context.repository.seedDocument('workspaces/ws_foreign/projects/project_ffffffffffffffffffffffffffffffff', {
      private: 'foreign-private-data',
    });

    const first = await context.service.exportWorkspace({
      principal: principal(ownerId), workspaceId, requestId: 'request_export_first',
    });
    const second = await context.service.exportWorkspace({
      principal: principal(ownerId), workspaceId, requestId: 'request_export_second',
    });
    expect(second).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.data).toMatchObject({
      schemaVersion: 'basiclinear.workspace-export.v1',
      invitations: [{id: `invite_${'c'.repeat(32)}`, state: 'pending'}],
      projects: [{id: project.id}], milestones: [{id: milestone.id}], issues: [{id: issue.id}],
    });
    expect(first.sha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.sha256).toBe(createHash('sha256').update(canonical(first.data)).digest('hex'));
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('must-never-export');
    expect(serialized).not.toContain('sensitive-digest');
    expect(serialized).not.toContain('c'.repeat(64));
    expect(serialized).not.toContain('foreign-private-data');
    expect(serialized).not.toContain('mutationAudits');
  });

  it('fails closed when any exported user reference is absent from the membership ledger', async () => {
    const corruptions = [
      ['project', 'createdByUserId'],
      ['milestone', 'createdByUserId'],
      ['issue', 'createdByUserId'],
      ['issue', 'assigneeUserId'],
      ['comment', 'authorUserId'],
    ] as const;
    for (const [entity, field] of corruptions) {
      const context = fixture();
      const project = await context.service.createProject({
        principal: principal(ownerId), workspaceId, requestId: `request_ref_${entity}_project`,
        idempotencyKey: `reference-${entity}-${field}-project-key`, name: 'Reference project',
      });
      const milestone = await context.service.createMilestone({
        principal: principal(ownerId), workspaceId, projectId: project.id,
        requestId: `request_ref_${entity}_milestone`,
        idempotencyKey: `reference-${entity}-${field}-milestone-key`, name: 'Reference milestone',
      });
      const issue = await context.collaboration.createIssue({
        principal: principal(ownerId), workspaceId, requestId: `request_ref_${entity}_issue`,
        idempotencyKey: `reference-${entity}-${field}-issue-key`, title: 'Reference issue',
        projectId: project.id, milestoneId: milestone.id,
      });
      const comment = await context.collaboration.createComment({
        principal: principal(memberId), workspaceId, issueId: issue.id,
        requestId: `request_ref_${entity}_comment`,
        idempotencyKey: `reference-${entity}-${field}-comment-key`, body: 'Reference comment',
      });
      const paths = {
        project: `workspaces/${workspaceId}/projects/${project.id}`,
        milestone: `workspaces/${workspaceId}/milestones/${milestone.id}`,
        issue: `workspaces/${workspaceId}/issues/${issue.id}`,
        comment: `workspaces/${workspaceId}/issues/${issue.id}/comments/${comment.id}`,
      } as const;
      const path = paths[entity];
      context.repository.seedDocument(path, {
        ...context.repository.snapshot()[path],
        [field]: 'foreign_user_reference',
      });
      const before = context.repository.snapshot();
      await expect(context.service.exportWorkspace({
        principal: principal(ownerId), workspaceId, requestId: `request_ref_${entity}_${field}`,
      })).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
      expect(context.repository.snapshot()).toEqual(before);
    }
  });

  it('fails closed for malformed stored dates and removed membership without mutating storage', async () => {
    const context = fixture();
    const project = await context.service.createProject({
      principal: principal(ownerId), workspaceId, requestId: 'request_bad_date_project',
      idempotencyKey: 'bad-date-project-key-0001', name: 'Tamper target',
    });
    const milestone = await context.service.createMilestone({
      principal: principal(ownerId), workspaceId, projectId: project.id,
      requestId: 'request_bad_date_milestone', idempotencyKey: 'bad-date-milestone-key-0001',
      name: 'Valid date first', targetDate: '2027-02-28',
    });
    const path = `workspaces/${workspaceId}/milestones/${milestone.id}`;
    context.repository.seedDocument(path, {...context.repository.snapshot()[path], targetDate: '2027-02-31'});
    const before = context.repository.snapshot();
    await expect(context.service.getMilestone({
      principal: principal(ownerId), workspaceId, milestoneId: milestone.id,
      requestId: 'request_bad_date_read',
    })).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
    expect(context.repository.snapshot()).toEqual(before);

    context.memberships.set({
      schemaVersion: 1, workspaceId, userId: memberId, role: 'member', status: 'removed', revision: 2,
    });
    await expect(context.service.listProjects({
      principal: principal(memberId), workspaceId, requestId: 'request_removed_pm_read',
    })).rejects.toMatchObject({code: 'WORKSPACE_ACCESS_DENIED'});
  });
});
