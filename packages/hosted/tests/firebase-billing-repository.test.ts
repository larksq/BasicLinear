import { describe, expect, it } from 'vitest';
import {
  FirestoreBillingRepository,
  type FirestoreBillingDocumentReferenceLike,
  type FirestoreBillingLike,
  type FirestoreBillingQueryLike,
  type FirestoreBillingTransactionLike,
} from '../src/index.js';

describe('FirestoreBillingRepository', () => {
  it('keeps all document and seat-query reads inside the transaction before writes', async () => {
    const calls: string[] = [];
    const documents = new Map<string, unknown>([['workspaces/ws_1', {id: 'ws_1'}]]);
    const collections = new Map<string, unknown[]>([[
      'workspaces/ws_1/memberships', [{id: 'mem_1'}, {id: 'mem_2'}],
    ]]);
    const firestore: FirestoreBillingLike = {
      doc: (path) => ({path}),
      collection: (path) => {
        const query: FirestoreBillingQueryLike = {
          path,
          limit: () => query,
        };
        return query;
      },
      runTransaction: async (operation) => {
        let wrote = false;
        const transaction: FirestoreBillingTransactionLike = {
          get: async (reference: FirestoreBillingDocumentReferenceLike | FirestoreBillingQueryLike) => {
            if (wrote) throw new Error('READ_AFTER_WRITE');
            if (collections.has(reference.path)) {
              calls.push(`query:${reference.path}`);
              return {docs: (collections.get(reference.path) as unknown[]).map((value) => ({data: () => value}))};
            }
            calls.push(`get:${reference.path}`);
            return {exists: documents.has(reference.path), data: () => documents.get(reference.path)};
          },
          create: (reference, value) => {
            wrote = true;
            calls.push(`create:${reference.path}`);
            documents.set(reference.path, value);
          },
          set: (reference, value) => {
            wrote = true;
            calls.push(`set:${reference.path}`);
            documents.set(reference.path, value);
          },
        };
        return operation(transaction);
      },
    };
    const repository = new FirestoreBillingRepository(firestore);
    await repository.runTransaction(async (transaction) => {
      expect(await transaction.get('workspaces/ws_1')).toEqual({id: 'ws_1'});
      expect(await transaction.list('workspaces/ws_1/memberships')).toEqual([{id: 'mem_1'}, {id: 'mem_2'}]);
      transaction.create('workspaces/ws_1/billingCheckouts/check_1', {id: 'check_1'});
      transaction.set('workspaces/ws_1/billing/current', {id: 'current'});
    });
    expect(calls).toEqual([
      'get:workspaces/ws_1',
      'query:workspaces/ws_1/memberships',
      'create:workspaces/ws_1/billingCheckouts/check_1',
      'set:workspaces/ws_1/billing/current',
    ]);
  });

  it('fails closed when an active-seat scan exceeds its configured budget', async () => {
    const values = [{id: 'one'}, {id: 'two'}, {id: 'three'}];
    const firestore: FirestoreBillingLike = {
      doc: (path) => ({path}),
      collection: (path) => {
        const query: FirestoreBillingQueryLike = {path, limit: () => query};
        return query;
      },
      runTransaction: async (operation) => operation({
        get: async (reference) => ('limit' in reference
          ? {docs: values.map((value) => ({data: () => value}))}
          : {exists: false, data: () => undefined}),
        create: () => undefined,
        set: () => undefined,
      }),
    };
    const repository = new FirestoreBillingRepository(firestore, 2);
    await expect(repository.runTransaction((transaction) => (
      transaction.list('workspaces/ws_1/memberships')
    ))).rejects.toThrow(/QUERY_BUDGET_EXCEEDED/u);
  });
});
