import { describe, expect, it } from 'vitest';
import {
  FirestoreInvitationRepository,
  type FirestoreInvitationDocumentReferenceLike,
  type FirestoreInvitationLike,
  type FirestoreInvitationQueryLike,
  type FirestoreInvitationTransactionLike,
} from '../src/index.js';

class FakeFirestore implements FirestoreInvitationLike {
  readonly documents = new Map<string, Record<string, unknown>>();
  readonly operations: string[] = [];

  doc(path: string): FirestoreInvitationDocumentReferenceLike {
    return { path };
  }

  collection(path: string): FirestoreInvitationQueryLike {
    let orderByField = '';
    let limitValue = 100;
    const query: FirestoreInvitationQueryLike = {
      path,
      orderBy: (field) => {
        orderByField = field;
        return query;
      },
      limit: (value) => {
        limitValue = value;
        return query;
      },
      get: async () => {
        const prefix = `${path}/`;
        const values = [...this.documents.entries()]
          .filter(([candidate]) => (
            candidate.startsWith(prefix) && !candidate.slice(prefix.length).includes('/')
          ))
          .map(([, value]) => value)
          .sort((left, right) => String(right[orderByField]).localeCompare(String(left[orderByField])))
          .slice(0, limitValue);
        return { docs: values.map((value) => ({ data: () => structuredClone(value) })) };
      },
    };
    return query;
  }

  async runTransaction<Value>(
    operation: (transaction: FirestoreInvitationTransactionLike) => Promise<Value>,
  ): Promise<Value> {
    const working = new Map(
      [...this.documents.entries()].map(([path, value]) => [path, structuredClone(value)]),
    );
    let wrote = false;
    const transaction: FirestoreInvitationTransactionLike = {
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
        return {
          exists: value !== undefined,
          data: () => structuredClone(value),
        };
      },
      create: (reference, value) => {
        wrote = true;
        this.operations.push(`create:${reference.path}`);
        if (working.has(reference.path)) throw new Error('ALREADY_EXISTS');
        working.set(reference.path, structuredClone(value));
      },
      set: (reference, value, options) => {
        wrote = true;
        this.operations.push(`${options?.merge === true ? 'merge' : 'set'}:${reference.path}`);
        const existing = options?.merge === true ? working.get(reference.path) ?? {} : {};
        working.set(reference.path, structuredClone({ ...existing, ...value }));
      },
    };
    const result = await operation(transaction);
    this.documents.clear();
    for (const [path, value] of working) this.documents.set(path, value);
    return result;
  }
}

describe('Firestore invitation repository adapter', () => {
  it('maps reads, create, replacement, and merge into one transaction', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter', { name: 'Before', revision: 1 });
    const repository = new FirestoreInvitationRepository(firestore);
    const result = await repository.runTransaction(async (transaction) => {
      const before = await transaction.get('workspaces/ws_adapter');
      transaction.set('workspaces/ws_adapter', { name: 'After', revision: 2 });
      transaction.create('workspaces/ws_adapter/invitations/invite_one', {
        id: 'invite_one', createdAt: '2026-12-01T00:00:00.000Z',
      });
      transaction.merge('hostedUsers/member_one', { uid: 'member_one' });
      return before;
    });
    expect(result).toEqual({ name: 'Before', revision: 1 });
    expect(firestore.documents.get('workspaces/ws_adapter')).toEqual({ name: 'After', revision: 2 });
    expect(firestore.documents.get('hostedUsers/member_one')).toEqual({ uid: 'member_one' });
    expect(firestore.operations).toEqual([
      'get:workspaces/ws_adapter',
      'set:workspaces/ws_adapter',
      'create:workspaces/ws_adapter/invitations/invite_one',
      'merge:hostedUsers/member_one',
    ]);
  });

  it('lists direct membership children inside the same read-before-write transaction', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter/memberships/owner', {userId: 'owner'});
    firestore.documents.set('workspaces/ws_adapter/memberships/member', {userId: 'member'});
    firestore.documents.set('workspaces/ws_adapter/memberships/member/private/child', {userId: 'child'});
    const repository = new FirestoreInvitationRepository(firestore);
    await expect(repository.runTransaction((transaction) => (
      transaction.list('workspaces/ws_adapter/memberships')
    ))).resolves.toEqual([{userId: 'member'}, {userId: 'owner'}]);
    expect(firestore.operations).toEqual(['list:workspaces/ws_adapter/memberships']);
  });

  it('lists only direct collection children in descending bounded order', async () => {
    const firestore = new FakeFirestore();
    firestore.documents.set('workspaces/ws_adapter/invitations/invite_old', {
      id: 'invite_old', createdAt: '2026-12-01T00:00:00.000Z',
    });
    firestore.documents.set('workspaces/ws_adapter/invitations/invite_new', {
      id: 'invite_new', createdAt: '2026-12-02T00:00:00.000Z',
    });
    firestore.documents.set('workspaces/ws_adapter/invitations/invite_new/private/child', {
      id: 'child', createdAt: '2026-12-03T00:00:00.000Z',
    });
    const repository = new FirestoreInvitationRepository(firestore);
    const results = await repository.listDocuments(
      'workspaces/ws_adapter/invitations',
      'createdAt',
      1,
    );
    expect(results).toEqual([{ id: 'invite_new', createdAt: '2026-12-02T00:00:00.000Z' }]);
  });

  it('fails closed when a transactional roster scan exceeds its configured budget', async () => {
    const firestore = new FakeFirestore();
    for (const id of ['one', 'two', 'three']) {
      firestore.documents.set(`workspaces/ws_adapter/memberships/${id}`, {userId: id});
    }
    const repository = new FirestoreInvitationRepository(firestore, 2);
    await expect(repository.runTransaction((transaction) => (
      transaction.list('workspaces/ws_adapter/memberships')
    ))).rejects.toThrow(/QUERY_BUDGET_EXCEEDED/u);
  });
});
