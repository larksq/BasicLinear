import type {
  OwnerBootstrapCandidate,
  OwnerBootstrapRecord,
  OwnerBootstrapRepository,
  OwnerBootstrapResult,
} from './owner-bootstrap.js';

export interface FirestoreDocumentReferenceLike {
  readonly path: string;
}

export interface FirestoreDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreTransactionLike {
  get(reference: FirestoreDocumentReferenceLike): Promise<FirestoreDocumentSnapshotLike>;
  create(reference: FirestoreDocumentReferenceLike, data: Record<string, unknown>): unknown;
  set(
    reference: FirestoreDocumentReferenceLike,
    data: Record<string, unknown>,
    options: {merge: true},
  ): unknown;
}

export interface FirestoreLike {
  doc(path: string): FirestoreDocumentReferenceLike;
  runTransaction<T>(operation: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T>;
}

const recordKeys = [
  'schemaVersion',
  'uid',
  'email',
  'displayName',
  'workspaceId',
  'workspaceName',
  'membershipId',
  'role',
  'trialId',
  'trialPlan',
  'trialStatus',
  'trialStartedAt',
  'trialEndsAt',
  'createdAt',
  'idempotencyDigest',
] as const;

function storedRecord(value: unknown, expectedUid: string): OwnerBootstrapRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('OWNER_BOOTSTRAP_RECORD_INVALID');
  }
  const candidate = value as Record<string, unknown>;
  const record = candidate.record;
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('OWNER_BOOTSTRAP_RECORD_INVALID');
  }
  const fields = record as Record<string, unknown>;
  if (
    fields.schemaVersion !== 1
    || fields.uid !== expectedUid
    || fields.displayName !== null && typeof fields.displayName !== 'string'
    || recordKeys.some((key) => key !== 'displayName' && typeof fields[key] !== (key === 'schemaVersion' ? 'number' : 'string'))
    || fields.role !== 'owner'
    || fields.trialPlan !== 'pro'
    || fields.trialStatus !== 'active'
  ) {
    throw new Error('OWNER_BOOTSTRAP_RECORD_INVALID');
  }
  return { ...(fields as unknown as OwnerBootstrapRecord) };
}

export class FirestoreOwnerBootstrapRepository implements OwnerBootstrapRepository {
  readonly #firestore: FirestoreLike;

  constructor(firestore: FirestoreLike) {
    this.#firestore = firestore;
  }

  bootstrapOnce(candidate: OwnerBootstrapCandidate): Promise<OwnerBootstrapResult> {
    const eligibility = this.#firestore.doc(`_ownerTrialEligibility/${candidate.uid}`);
    return this.#firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eligibility);
      if (snapshot.exists) {
        return { created: false, record: storedRecord(snapshot.data(), candidate.uid) };
      }

      const user = this.#firestore.doc(`hostedUsers/${candidate.uid}`);
      const workspace = this.#firestore.doc(`workspaces/${candidate.workspaceId}`);
      const membership = this.#firestore.doc(
        `workspaces/${candidate.workspaceId}/memberships/${candidate.uid}`,
      );
      const entitlement = this.#firestore.doc(
        `workspaces/${candidate.workspaceId}/entitlements/current`,
      );

      transaction.set(user, {
        schemaVersion: 1,
        uid: candidate.uid,
        email: candidate.email,
        displayName: candidate.displayName,
        authProvider: 'google.com',
        updatedAt: candidate.createdAt,
      }, { merge: true });
      transaction.create(workspace, {
        schemaVersion: 1,
        id: candidate.workspaceId,
        workspaceId: candidate.workspaceId,
        name: candidate.workspaceName,
        ownerUid: candidate.uid,
        authority: 'firebase-hosted',
        createdAt: candidate.createdAt,
        revision: 1,
      });
      transaction.create(membership, {
        schemaVersion: 1,
        id: candidate.membershipId,
        workspaceId: candidate.workspaceId,
        userId: candidate.uid,
        role: candidate.role,
        status: 'active',
        createdAt: candidate.createdAt,
        revision: 1,
      });
      transaction.create(entitlement, {
        schemaVersion: 1,
        id: candidate.trialId,
        workspaceId: candidate.workspaceId,
        plan: candidate.trialPlan,
        status: candidate.trialStatus,
        trialStartedAt: candidate.trialStartedAt,
        trialEndsAt: candidate.trialEndsAt,
        source: 'owner_bootstrap',
        revision: 1,
      });
      transaction.create(eligibility, {
        schemaVersion: 1,
        uid: candidate.uid,
        workspaceId: candidate.workspaceId,
        trialConsumed: true,
        idempotencyDigest: candidate.idempotencyDigest,
        createdAt: candidate.createdAt,
        record: { ...candidate },
      });
      return { created: true, record: { ...candidate } };
    });
  }
}
