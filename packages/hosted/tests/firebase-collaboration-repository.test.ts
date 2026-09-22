import { describe, expect, it } from 'vitest';
import {
  FirestoreCollaborationRepository,
  CollaborationService,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  type FirestoreCollaborationDocumentReferenceLike,
  type FirestoreCollaborationLike,
  type FirestoreCollaborationQueryLike,
  type FirestoreCollaborationTransactionLike,
} from '../src/index.js';
import {proEntitlementPolicyForTests} from './fixtures/entitlement.js';
import {defaultHostedStatusId} from '../src/workspace-configuration-service.js';

class FakeFirestore implements FirestoreCollaborationLike {
  readonly documents = new Map<string, Record<string, unknown>>();
  readonly operations: string[] = [];

  doc(path: string): FirestoreCollaborationDocumentReferenceLike { return { path }; }

  collection(path: string): FirestoreCollaborationQueryLike {
    let field = '';
    let direction: 'asc' | 'desc' = 'asc';
    let maximum = 100;
    const query: FirestoreCollaborationQueryLike = {
      path,
      orderBy: (nextField, nextDirection) => { field = nextField; direction = nextDirection; return query; },
      limit: (value) => { maximum = value; return query; },
      get: async () => {
        const prefix = `${path}/`;
        const multiplier = direction === 'asc' ? 1 : -1;
        const values = [...this.documents.entries()]
          .filter(([candidate]) => candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes('/'))
          .map(([, value]) => value)
          .sort((left, right) => multiplier * String(left[field]).localeCompare(String(right[field])))
          .slice(0, maximum);
        return { docs: values.map((value) => ({ data: () => structuredClone(value) })) };
      },
    };
    return query;
  }

  async runTransaction<Value>(
    operation: (transaction: FirestoreCollaborationTransactionLike) => Promise<Value>,
  ): Promise<Value> {
    const working = new Map([...this.documents.entries()].map(([path, value]) => [path, structuredClone(value)]));
    let wrote = false;
    const transaction: FirestoreCollaborationTransactionLike = {
      get: async (reference) => {
        if (wrote) throw new Error('READ_AFTER_WRITE');
        if ('get' in reference) {
          this.operations.push(`list:${reference.path}`);
          const prefix = `${reference.path}/`;
          return {docs: [...working.entries()]
            .filter(([candidate]) => candidate.startsWith(prefix)
              && !candidate.slice(prefix.length).includes('/'))
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, value]) => ({data: () => structuredClone(value)}))};
        }
        this.operations.push(`get:${reference.path}`);
        const value = working.get(reference.path);
        return { exists: value !== undefined, data: () => structuredClone(value) };
      },
      create: (reference, value) => {
        wrote = true;
        this.operations.push(`create:${reference.path}`);
        if (working.has(reference.path)) throw new Error('ALREADY_EXISTS');
        working.set(reference.path, structuredClone(value));
      },
      set: (reference, value) => {
        wrote = true;
        this.operations.push(`set:${reference.path}`);
        working.set(reference.path, structuredClone(value));
      },
    };
    const result = await operation(transaction);
    this.documents.clear();
    for (const [path, value] of working) this.documents.set(path, value);
    return result;
  }
}

describe('Firestore collaboration repository adapter', () => {
  function collaboration() {
    const firestore = new FakeFirestore();
    const repository = new FirestoreCollaborationRepository(firestore);
    const workspaceId = 'ws_lazy_defaults';
    const userId = 'owner_lazy_defaults';
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({schemaVersion: 1, workspaceId, userId, role: 'owner', status: 'active', revision: 1});
    firestore.documents.set(`workspaces/${workspaceId}/memberships/${userId}`, {
      schemaVersion: 1, id: 'mem_lazy_defaults', workspaceId, userId, role: 'owner', status: 'active',
      createdAt: '2026-09-01T00:00:00.000Z', revision: 1,
    });
    const clock = () => new Date('2026-09-21T00:00:00.000Z');
    const authorization = new WorkspaceAuthorizationService(memberships, new MemoryWorkspaceAuthorizationEvidenceWriter(), {clock});
    const service = new CollaborationService(repository, authorization, {
      clock, secret: 'lazy-defaults-regression-secret-at-least-32-bytes', entitlementPolicy: proEntitlementPolicyForTests,
    });
    const command = {
      workspaceId, principal: {kind: 'user' as const, userId, source: 'web' as const},
      requestId: 'lazy_defaults_regression', idempotencyKey: 'lazy-defaults-regression-0001', title: 'First task',
    };
    return {firestore, service, command};
  }

  it('creates defaults on the first issue and replays without duplicate writes', async () => {
    const {firestore, service, command} = collaboration();
    const issue = await service.createIssue(command);
    const snapshot = structuredClone([...firestore.documents]);
    expect(issue).toMatchObject({number: 1, status: 'todo'});
    expect(firestore.documents.has(`workspaces/${command.workspaceId}/teams/${issue.teamId}`)).toBe(true);
    expect(firestore.documents.has(`workspaces/${command.workspaceId}/workflowStatuses/${issue.statusId}`)).toBe(true);
    expect(await service.createIssue(command)).toEqual(issue);
    expect([...firestore.documents]).toEqual(snapshot);
  });

  it('finishes parent and membership reads before lazily creating a child status', async () => {
    const {service, command} = collaboration();
    const parent = await service.createIssue(command);
    const child = await service.createIssue({
      ...command, idempotencyKey: 'lazy-child-regression-key-0001', parentIssueId: parent.id,
      statusId: defaultHostedStatusId(command.workspaceId, parent.teamId, 'in_progress'),
    });
    expect(child).toMatchObject({number: 2, parentIssueId: parent.id, status: 'in_progress'});
  });

  it('finishes update placement and parent reads before creating a missing status', async () => {
    const {firestore, service, command} = collaboration();
    const parent = await service.createIssue(command);
    const child = await service.createIssue({...command, idempotencyKey: 'lazy-update-child-key-0001', parentIssueId: parent.id});
    const projectId = `project_${'a'.repeat(32)}`;
    const milestoneId = `milestone_${'b'.repeat(32)}`;
    const timestamps = {createdAt: child.createdAt, updatedAt: child.updatedAt};
    firestore.documents.set(`workspaces/${command.workspaceId}/projects/${projectId}`, {
      schemaVersion: 1, id: projectId, workspaceId: command.workspaceId, archivedAt: null, ...timestamps,
    });
    firestore.documents.set(`workspaces/${command.workspaceId}/milestones/${milestoneId}`, {
      schemaVersion: 1, id: milestoneId, workspaceId: command.workspaceId, projectId, archivedAt: null, ...timestamps,
    });
    const update = {...command, issueId: child.id, expectedRevision: 1, idempotencyKey: 'lazy-update-regression-key-0001',
      patch: {status: 'done' as const, projectId, milestoneId}};
    expect(await service.updateIssue(update)).toMatchObject({status: 'done', revision: 2, parentIssueId: parent.id, projectId, milestoneId});
    expect(await service.updateIssue(update)).toMatchObject({status: 'done', revision: 2});
  });

  it('does not persist defaults if a later parent validation fails', async () => {
    const {firestore, service, command} = collaboration();
    const before = structuredClone([...firestore.documents]);
    await expect(service.createIssue({...command, parentIssueId: `issue_${'f'.repeat(32)}`}))
      .rejects.toMatchObject({code: 'COLLABORATION_NOT_FOUND'});
    expect([...firestore.documents]).toEqual(before);
  });

  it('preserves Firestore read-before-write transaction ordering', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter/issues/issue_one', { id: 'issue_one', revision: 1 });
    const repository = new FirestoreCollaborationRepository(firestore);
    const before = await repository.runTransaction(async (transaction) => {
      const value = await transaction.get('workspaces/ws_adapter/issues/issue_one');
      transaction.set('workspaces/ws_adapter/issues/issue_one', { id: 'issue_one', revision: 2 });
      transaction.create('workspaces/ws_adapter/issues/issue_two', { id: 'issue_two', revision: 1 });
      return value;
    });
    expect(before).toEqual({ id: 'issue_one', revision: 1 });
    expect(firestore.operations).toEqual([
      'get:workspaces/ws_adapter/issues/issue_one',
      'set:workspaces/ws_adapter/issues/issue_one',
      'create:workspaces/ws_adapter/issues/issue_two',
    ]);
  });

  it('lists direct membership children inside the same read-before-write transaction', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter/memberships/owner', {userId: 'owner'});
    firestore.documents.set('workspaces/ws_adapter/memberships/member', {userId: 'member'});
    firestore.documents.set('workspaces/ws_adapter/memberships/member/private/child', {userId: 'child'});
    const repository = new FirestoreCollaborationRepository(firestore);
    await expect(repository.runTransaction((transaction) => (
      transaction.list('workspaces/ws_adapter/memberships')
    ))).resolves.toEqual([{userId: 'member'}, {userId: 'owner'}]);
    expect(firestore.operations).toEqual(['list:workspaces/ws_adapter/memberships']);
  });

  it('lists direct children in the requested deterministic direction and bound', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter/issues/issue_old', { id: 'old', updatedAt: '2026-01-01T00:00:00.000Z' });
    firestore.documents.set('workspaces/ws_adapter/issues/issue_new', { id: 'new', updatedAt: '2026-01-02T00:00:00.000Z' });
    firestore.documents.set('workspaces/ws_adapter/issues/issue_new/comments/child', { id: 'child', updatedAt: '2026-01-03T00:00:00.000Z' });
    const repository = new FirestoreCollaborationRepository(firestore);
    await expect(repository.listDocuments('workspaces/ws_adapter/issues', 'updatedAt', 'desc', 1))
      .resolves.toEqual([{ id: 'new', updatedAt: '2026-01-02T00:00:00.000Z' }]);
  });

  it('fails closed when a transaction collection scan exceeds its configured budget', async () => {
    const firestore = new FakeFirestore();
    for (const id of ['one', 'two', 'three']) {
      firestore.documents.set(`workspaces/ws_adapter/issues/${id}`, {id});
    }
    const repository = new FirestoreCollaborationRepository(firestore, 2);
    await expect(repository.runTransaction((transaction) => (
      transaction.list('workspaces/ws_adapter/issues')
    ))).rejects.toThrow(/QUERY_BUDGET_EXCEEDED/u);
  });
});
