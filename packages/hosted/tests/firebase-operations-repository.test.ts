import { describe, expect, it } from 'vitest';
import {
  FirestoreHostedOperationsRepository,
  type FirestoreOperationsDocumentReferenceLike,
  type FirestoreOperationsLike,
  type FirestoreOperationsTransactionLike,
} from '../src/index.js';

describe('FirestoreHostedOperationsRepository', () => {
  it('keeps reads and atomic activation, signal, and restore writes in one Firestore transaction', async () => {
    const calls: string[] = [];
    const documents = new Map<string, Record<string, unknown>>([
      ['operationsActivation/current', {id: 'current'}],
    ]);
    const firestore: FirestoreOperationsLike = {
      doc: (path) => ({path}),
      runTransaction: async (operation) => {
        let wrote = false;
        const transaction: FirestoreOperationsTransactionLike = {
          get: async (reference: FirestoreOperationsDocumentReferenceLike) => {
            if (wrote) throw new Error('READ_AFTER_WRITE');
            calls.push(`get:${reference.path}`);
            return {
              exists: documents.has(reference.path),
              data: () => documents.get(reference.path),
            };
          },
          create: (reference, value) => {
            wrote = true;
            calls.push(`create:${reference.path}`);
            documents.set(reference.path, structuredClone(value));
          },
          set: (reference, value) => {
            wrote = true;
            calls.push(`set:${reference.path}`);
            documents.set(reference.path, structuredClone(value));
          },
        };
        return operation(transaction);
      },
    };
    const repository = new FirestoreHostedOperationsRepository(firestore);
    await repository.runTransaction(async (transaction) => {
      expect(await transaction.get('operationsActivation/current')).toEqual({id: 'current'});
      expect(await transaction.get('operationsBudgetSignals/signal-1')).toBeNull();
      transaction.create('operationsBudgetSignals/signal-1', {id: 'signal-1'});
      transaction.set('operationsBudgetState/current', {id: 'current'});
    });
    expect(calls).toEqual([
      'get:operationsActivation/current',
      'get:operationsBudgetSignals/signal-1',
      'create:operationsBudgetSignals/signal-1',
      'set:operationsBudgetState/current',
    ]);
  });
});
