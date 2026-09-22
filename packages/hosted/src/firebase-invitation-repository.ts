import type {
  InvitationRepository,
  InvitationTransaction,
} from './invitation-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';

export interface FirestoreInvitationDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreInvitationDocumentReferenceLike {
  readonly path: string;
}

export interface FirestoreInvitationTransactionLike {
  get(
    reference: FirestoreInvitationDocumentReferenceLike | FirestoreInvitationQueryLike,
  ): Promise<FirestoreInvitationDocumentSnapshotLike | FirestoreInvitationQuerySnapshotLike>;
  create(
    reference: FirestoreInvitationDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
  set(
    reference: FirestoreInvitationDocumentReferenceLike,
    value: Record<string, unknown>,
    options?: {merge: true},
  ): unknown;
}

export interface FirestoreInvitationQuerySnapshotLike {
  readonly docs: ReadonlyArray<{data(): unknown}>;
}

export interface FirestoreInvitationQueryLike {
  readonly path: string;
  orderBy(field: string, direction: 'desc'): FirestoreInvitationQueryLike;
  limit(value: number): FirestoreInvitationQueryLike;
  get(): Promise<FirestoreInvitationQuerySnapshotLike>;
}

export interface FirestoreInvitationLike {
  doc(path: string): FirestoreInvitationDocumentReferenceLike;
  collection(path: string): FirestoreInvitationQueryLike;
  runTransaction<Value>(
    operation: (transaction: FirestoreInvitationTransactionLike) => Promise<Value>,
  ): Promise<Value>;
}

class FirestoreInvitationTransaction implements InvitationTransaction {
  readonly #firestore: FirestoreInvitationLike;
  readonly #transaction: FirestoreInvitationTransactionLike;

  constructor(
    firestore: FirestoreInvitationLike,
    transaction: FirestoreInvitationTransactionLike,
    private readonly maximumTransactionListRecords: number,
  ) {
    this.#firestore = firestore;
    this.#transaction = transaction;
  }

  async get(path: string): Promise<unknown | null> {
    const snapshot = await this.#transaction.get(this.#firestore.doc(path));
    if (!('exists' in snapshot)) throw new Error('FIRESTORE_INVITATION_DOCUMENT_RESPONSE_INVALID');
    return snapshot.exists ? snapshot.data() : null;
  }

  async list(collectionPath: string, maximumRecords?: number): Promise<unknown[]> {
    const maximum = Math.min(
      maximumRecords ?? this.maximumTransactionListRecords,
      this.maximumTransactionListRecords,
    );
    if (!Number.isSafeInteger(maximum) || maximum < 1) {
      throw new Error('FIRESTORE_INVITATION_QUERY_LIMIT_INVALID');
    }
    const snapshot = await this.#transaction.get(
      this.#firestore.collection(collectionPath).limit(maximum + 1),
    );
    if (!('docs' in snapshot) || !Array.isArray(snapshot.docs)) {
      throw new Error('FIRESTORE_INVITATION_QUERY_RESPONSE_INVALID');
    }
    if (snapshot.docs.length > maximum) {
      throw new Error('FIRESTORE_INVITATION_QUERY_BUDGET_EXCEEDED');
    }
    return snapshot.docs.map((document) => document.data());
  }

  create(path: string, value: Record<string, unknown>): void {
    this.#transaction.create(this.#firestore.doc(path), value);
  }

  set(path: string, value: Record<string, unknown>): void {
    this.#transaction.set(this.#firestore.doc(path), value);
  }

  merge(path: string, value: Record<string, unknown>): void {
    this.#transaction.set(this.#firestore.doc(path), value, { merge: true });
  }
}

export class FirestoreInvitationRepository implements InvitationRepository {
  readonly #firestore: FirestoreInvitationLike;
  readonly #maximumTransactionListRecords: number;

  constructor(
    firestore: FirestoreInvitationLike,
    maximumTransactionListRecords = hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
  ) {
    this.#firestore = firestore;
    if (!Number.isSafeInteger(maximumTransactionListRecords)
      || maximumTransactionListRecords < 1
      || maximumTransactionListRecords
        > hostedOperationsPolicyV1.queries.maximumTransactionListRecords) {
      throw new Error('FIRESTORE_INVITATION_QUERY_LIMIT_INVALID');
    }
    this.#maximumTransactionListRecords = maximumTransactionListRecords;
  }

  runTransaction<Value>(
    operation: (transaction: InvitationTransaction) => Promise<Value>,
  ): Promise<Value> {
    return this.#firestore.runTransaction((transaction) => operation(
      new FirestoreInvitationTransaction(
        this.#firestore,
        transaction,
        this.#maximumTransactionListRecords,
      ),
    ));
  }

  async listDocuments(
    collectionPath: string,
    orderByField: string,
    limit: number,
  ): Promise<unknown[]> {
    const snapshot = await this.#firestore
      .collection(collectionPath)
      .orderBy(orderByField, 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => document.data());
  }
}
