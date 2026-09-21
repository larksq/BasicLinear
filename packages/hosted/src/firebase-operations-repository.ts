import type {
  HostedOperationsRepository,
  HostedOperationsTransaction,
} from './operations-service.js';

export interface FirestoreOperationsDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreOperationsDocumentReferenceLike {
  readonly path: string;
}

export interface FirestoreOperationsTransactionLike {
  get(
    reference: FirestoreOperationsDocumentReferenceLike,
  ): Promise<FirestoreOperationsDocumentSnapshotLike>;
  create(
    reference: FirestoreOperationsDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
  set(
    reference: FirestoreOperationsDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
}

export interface FirestoreOperationsLike {
  doc(path: string): FirestoreOperationsDocumentReferenceLike;
  runTransaction<Value>(
    operation: (transaction: FirestoreOperationsTransactionLike) => Promise<Value>,
  ): Promise<Value>;
}

class FirestoreOperationsTransaction implements HostedOperationsTransaction {
  constructor(
    private readonly firestore: FirestoreOperationsLike,
    private readonly transaction: FirestoreOperationsTransactionLike,
  ) {}

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.transaction.get(this.firestore.doc(path));
    if (typeof snapshot.exists !== 'boolean' || typeof snapshot.data !== 'function') {
      throw new Error('FIRESTORE_OPERATIONS_DOCUMENT_RESPONSE_INVALID');
    }
    return snapshot.exists ? snapshot.data() : null;
  }

  create(path: string, value: Record<string, unknown>): void {
    this.transaction.create(this.firestore.doc(path), value);
  }

  set(path: string, value: Record<string, unknown>): void {
    this.transaction.set(this.firestore.doc(path), value);
  }
}

export class FirestoreHostedOperationsRepository implements HostedOperationsRepository {
  constructor(private readonly firestore: FirestoreOperationsLike) {}

  runTransaction<Value>(
    operation: (transaction: HostedOperationsTransaction) => Promise<Value>,
  ): Promise<Value> {
    return this.firestore.runTransaction((transaction) => operation(
      new FirestoreOperationsTransaction(this.firestore, transaction),
    ));
  }
}
