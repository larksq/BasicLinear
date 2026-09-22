import type {
  CollaborationRepository,
  CollaborationTransaction,
} from './collaboration-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';

export interface FirestoreCollaborationDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreCollaborationDocumentReferenceLike {
  readonly path: string;
}

export interface FirestoreCollaborationTransactionLike {
  get(
    reference: FirestoreCollaborationDocumentReferenceLike | FirestoreCollaborationQueryLike,
  ): Promise<FirestoreCollaborationDocumentSnapshotLike | FirestoreCollaborationQuerySnapshotLike>;
  create(
    reference: FirestoreCollaborationDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
  set(
    reference: FirestoreCollaborationDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
}

export interface FirestoreCollaborationQuerySnapshotLike {
  readonly docs: ReadonlyArray<{data(): unknown}>;
}

export interface FirestoreCollaborationQueryLike {
  readonly path: string;
  orderBy(
    field: string,
    direction: 'asc' | 'desc',
  ): FirestoreCollaborationQueryLike;
  limit(value: number): FirestoreCollaborationQueryLike;
  get(): Promise<FirestoreCollaborationQuerySnapshotLike>;
}

export interface FirestoreCollaborationLike {
  doc(path: string): FirestoreCollaborationDocumentReferenceLike;
  collection(path: string): FirestoreCollaborationQueryLike;
  runTransaction<Value>(
    operation: (transaction: FirestoreCollaborationTransactionLike) => Promise<Value>,
  ): Promise<Value>;
}

class FirestoreCollaborationTransaction implements CollaborationTransaction {
  constructor(
    private readonly firestore: FirestoreCollaborationLike,
    private readonly transaction: FirestoreCollaborationTransactionLike,
    private readonly maximumTransactionListRecords: number,
  ) {}

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.transaction.get(this.firestore.doc(path));
    if (!('exists' in snapshot)) throw new Error('FIRESTORE_COLLABORATION_DOCUMENT_RESPONSE_INVALID');
    return snapshot.exists ? snapshot.data() : null;
  }

  async list(collectionPath: string, maximumRecords?: number): Promise<unknown[]> {
    const maximum = Math.min(
      maximumRecords ?? this.maximumTransactionListRecords,
      this.maximumTransactionListRecords,
    );
    if (!Number.isSafeInteger(maximum) || maximum < 1) {
      throw new Error('FIRESTORE_COLLABORATION_QUERY_LIMIT_INVALID');
    }
    const snapshot = await this.transaction.get(
      this.firestore.collection(collectionPath).limit(maximum + 1),
    );
    if (!('docs' in snapshot) || !Array.isArray(snapshot.docs)) {
      throw new Error('FIRESTORE_COLLABORATION_QUERY_RESPONSE_INVALID');
    }
    if (snapshot.docs.length > maximum) {
      throw new Error('FIRESTORE_COLLABORATION_QUERY_BUDGET_EXCEEDED');
    }
    return snapshot.docs.map((document) => document.data());
  }

  create(path: string, value: Record<string, unknown>): void {
    this.transaction.create(this.firestore.doc(path), value);
  }

  set(path: string, value: Record<string, unknown>): void {
    this.transaction.set(this.firestore.doc(path), value);
  }
}

export class FirestoreCollaborationRepository implements CollaborationRepository {
  readonly #maximumTransactionListRecords: number;

  constructor(
    private readonly firestore: FirestoreCollaborationLike,
    maximumTransactionListRecords = hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
  ) {
    if (!Number.isSafeInteger(maximumTransactionListRecords)
      || maximumTransactionListRecords < 1
      || maximumTransactionListRecords
        > hostedOperationsPolicyV1.queries.maximumTransactionListRecords) {
      throw new Error('FIRESTORE_COLLABORATION_QUERY_LIMIT_INVALID');
    }
    this.#maximumTransactionListRecords = maximumTransactionListRecords;
  }

  runTransaction<Value>(
    operation: (transaction: CollaborationTransaction) => Promise<Value>,
  ): Promise<Value> {
    return this.firestore.runTransaction((transaction) => operation(
      new FirestoreCollaborationTransaction(
        this.firestore,
        transaction,
        this.#maximumTransactionListRecords,
      ),
    ));
  }

  async listDocuments(
    collectionPath: string,
    orderByField: string,
    direction: 'asc' | 'desc',
    limit: number,
  ): Promise<unknown[]> {
    const snapshot = await this.firestore
      .collection(collectionPath)
      .orderBy(orderByField, direction)
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => document.data());
  }
}
