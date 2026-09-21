import { describe, expect, it } from 'vitest';
import {
  FirestoreCollaborationRepository,
  type FirestoreCollaborationDocumentReferenceLike,
  type FirestoreCollaborationLike,
  type FirestoreCollaborationQueryLike,
  type FirestoreCollaborationTransactionLike,
} from '../src/index.js';

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
