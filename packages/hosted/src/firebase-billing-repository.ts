import type {
  BillingRepository,
  BillingTransaction,
} from './billing-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';

export interface FirestoreBillingDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreBillingDocumentReferenceLike {
  readonly path: string;
}

export interface FirestoreBillingQueryDocumentSnapshotLike {
  data(): unknown;
}

export interface FirestoreBillingQuerySnapshotLike {
  readonly docs: ReadonlyArray<FirestoreBillingQueryDocumentSnapshotLike>;
}

export interface FirestoreBillingQueryLike {
  readonly path: string;
  limit(value: number): FirestoreBillingQueryLike;
}

export interface FirestoreBillingTransactionLike {
  get(
    reference: FirestoreBillingDocumentReferenceLike | FirestoreBillingQueryLike,
  ): Promise<FirestoreBillingDocumentSnapshotLike | FirestoreBillingQuerySnapshotLike>;
  create(
    reference: FirestoreBillingDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
  set(
    reference: FirestoreBillingDocumentReferenceLike,
    value: Record<string, unknown>,
  ): unknown;
}

export interface FirestoreBillingLike {
  doc(path: string): FirestoreBillingDocumentReferenceLike;
  collection(path: string): FirestoreBillingQueryLike;
  runTransaction<Value>(
    operation: (transaction: FirestoreBillingTransactionLike) => Promise<Value>,
  ): Promise<Value>;
}

function documentSnapshot(
  value: FirestoreBillingDocumentSnapshotLike | FirestoreBillingQuerySnapshotLike,
): FirestoreBillingDocumentSnapshotLike {
  if (!('exists' in value) || typeof value.data !== 'function') {
    throw new Error('FIRESTORE_BILLING_DOCUMENT_RESPONSE_INVALID');
  }
  return value;
}

function querySnapshot(
  value: FirestoreBillingDocumentSnapshotLike | FirestoreBillingQuerySnapshotLike,
): FirestoreBillingQuerySnapshotLike {
  if (!('docs' in value) || !Array.isArray(value.docs)) {
    throw new Error('FIRESTORE_BILLING_QUERY_RESPONSE_INVALID');
  }
  return value;
}

class FirestoreBillingTransaction implements BillingTransaction {
  constructor(
    private readonly firestore: FirestoreBillingLike,
    private readonly transaction: FirestoreBillingTransactionLike,
    private readonly maximumTransactionListRecords: number,
  ) {}

  async get(path: string): Promise<unknown | null> {
    const snapshot = documentSnapshot(await this.transaction.get(this.firestore.doc(path)));
    return snapshot.exists ? snapshot.data() : null;
  }

  async list(collectionPath: string): Promise<unknown[]> {
    const snapshot = querySnapshot(await this.transaction.get(
      this.firestore.collection(collectionPath).limit(this.maximumTransactionListRecords + 1),
    ));
    if (snapshot.docs.length > this.maximumTransactionListRecords) {
      throw new Error('FIRESTORE_BILLING_QUERY_BUDGET_EXCEEDED');
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

export class FirestoreBillingRepository implements BillingRepository {
  readonly #maximumTransactionListRecords: number;

  constructor(
    private readonly firestore: FirestoreBillingLike,
    maximumTransactionListRecords = hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
  ) {
    if (!Number.isSafeInteger(maximumTransactionListRecords)
      || maximumTransactionListRecords < 1
      || maximumTransactionListRecords
        > hostedOperationsPolicyV1.queries.maximumTransactionListRecords) {
      throw new Error('FIRESTORE_BILLING_QUERY_LIMIT_INVALID');
    }
    this.#maximumTransactionListRecords = maximumTransactionListRecords;
  }

  runTransaction<Value>(
    operation: (transaction: BillingTransaction) => Promise<Value>,
  ): Promise<Value> {
    return this.firestore.runTransaction((transaction) => operation(
      new FirestoreBillingTransaction(
        this.firestore,
        transaction,
        this.#maximumTransactionListRecords,
      ),
    ));
  }
}
