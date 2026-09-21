import {randomUUID} from 'node:crypto';
import {Firestore} from '@google-cloud/firestore';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  CollaborationService, FirestoreCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter, MemoryWorkspaceMembershipReader,
  ProjectManagementService, WorkspaceAuthorizationService, WorkspaceConfigurationService,
  type FirestoreCollaborationLike,
} from '@openlinear/hosted';
import {defaultHostedStatusId} from '../../../packages/hosted/src/workspace-configuration-service.js';
import {proEntitlementPolicyForTests} from '../../../packages/hosted/tests/fixtures/entitlement.js';

let firestore: Firestore;
beforeAll(() => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/u.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')) {
    throw new Error('These tests require an isolated loopback Firestore emulator.');
  }
  firestore = new Firestore({projectId: 'demo-openlinear'});
});
afterAll(async () => {await firestore?.terminate();});

async function fixture() {
  const workspaceId = `ws_transactions_${randomUUID().replaceAll('-', '')}`;
  const userId = 'owner_transactions';
  const clock = () => new Date('2026-09-21T00:00:00.000Z');
  const memberships = new MemoryWorkspaceMembershipReader();
  memberships.set({schemaVersion: 1, workspaceId, userId, role: 'owner', status: 'active', revision: 1});
  await firestore.doc(`workspaces/${workspaceId}/memberships/${userId}`).set({
    schemaVersion: 1, id: 'mem_transactions', workspaceId, userId, role: 'owner', status: 'active',
    createdAt: '2026-09-01T00:00:00.000Z', revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(memberships, new MemoryWorkspaceAuthorizationEvidenceWriter(), {clock});
  const repository = new FirestoreCollaborationRepository(firestore as unknown as FirestoreCollaborationLike);
  const options = {clock, secret: 'emulator-transaction-regression-secret-at-least-32-bytes', entitlementPolicy: proEntitlementPolicyForTests};
  const service = new CollaborationService(repository, authorization, options);
  const configuration = new WorkspaceConfigurationService(repository, authorization, options);
  const projects = new ProjectManagementService(repository, authorization, options);
  const command = {workspaceId, principal: {kind: 'user' as const, userId, source: 'web' as const},
    requestId: 'emulator_issue_request', idempotencyKey: 'emulator-create-issue-key-0001', title: 'First issue'};
  return {service, configuration, projects, command};
}

describe('Collaboration transactions on the Firestore emulator', () => {
  it('creates the first issue, lazy child status, cycle, and later placement before replaying safely', async () => {
    const {service, configuration, projects, command} = await fixture();
    const parent = await service.createIssue(command);
    expect(await service.createIssue(command)).toEqual(parent);
    const cycle = await configuration.createCycle({...command, teamId: parent.teamId,
      idempotencyKey: 'emulator-create-cycle-key-0001', startDate: '2026-09-21', endDate: '2026-09-30'});
    const child = await service.createIssue({...command, title: 'Child', idempotencyKey: 'emulator-create-child-key-0001',
      parentIssueId: parent.id, cycleId: cycle.id,
      statusId: defaultHostedStatusId(command.workspaceId, parent.teamId, 'in_progress')});
    const project = await projects.createProject({...command, idempotencyKey: 'emulator-create-project-key-0001', name: 'Launch'});
    const milestone = await projects.createMilestone({...command, idempotencyKey: 'emulator-create-milestone-key-0001',
      projectId: project.id, name: 'Ready'});
    const update = {...command, issueId: child.id, expectedRevision: 1, idempotencyKey: 'emulator-update-child-key-0001',
      patch: {status: 'done' as const, projectId: project.id, milestoneId: milestone.id}};
    const changed = await service.updateIssue(update);
    expect(changed).toMatchObject({number: 2, status: 'done', revision: 2, parentIssueId: parent.id, cycleId: cycle.id});
    expect(await service.updateIssue(update)).toEqual(changed);
    expect((await firestore.collection(`workspaces/${command.workspaceId}/teams`).get()).size).toBe(1);
    expect((await firestore.collection(`workspaces/${command.workspaceId}/workflowStatuses`).get()).size).toBe(3);
  });

  it('retries concurrent first issues without duplicate defaults or sequence gaps', async () => {
    const {service, command} = await fixture();
    const issues = await Promise.all(Array.from({length: 4}, (_, index) => service.createIssue({
      ...command, idempotencyKey: `emulator-concurrent-create-key-${index}`, title: `Concurrent ${index}`,
    })));
    expect(issues.map(issue => issue.number).sort()).toEqual([1, 2, 3, 4]);
    expect((await firestore.collection(`workspaces/${command.workspaceId}/teams`).get()).size).toBe(1);
    expect((await firestore.collection(`workspaces/${command.workspaceId}/workflowStatuses`).get()).size).toBe(1);
  }, 30_000);

  it('rolls back all lazy records when a later parent check fails', async () => {
    const {service, command} = await fixture();
    await expect(service.createIssue({...command, parentIssueId: `issue_${'f'.repeat(32)}`}))
      .rejects.toMatchObject({code: 'COLLABORATION_NOT_FOUND'});
    for (const group of ['teams', 'workflowStatuses', 'issues', 'issueSequences', 'collaborationIdempotency']) {
      expect((await firestore.collection(`workspaces/${command.workspaceId}/${group}`).get()).empty).toBe(true);
    }
    expect(await service.createIssue(command)).toMatchObject({number: 1});
  });
});
