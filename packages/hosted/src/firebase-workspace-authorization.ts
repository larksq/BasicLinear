import type {
  WorkspaceAuthorizationEvidence,
  WorkspaceAuthorizationEvidenceWriter,
  WorkspaceMembershipReader,
} from './workspace-authorization.js';

export interface FirestoreAuthorizationDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreAuthorizationDocumentReferenceLike {
  readonly path: string;
  get(): Promise<FirestoreAuthorizationDocumentSnapshotLike>;
}

export interface FirestoreAuthorizationBatchLike {
  create(
    reference: FirestoreAuthorizationDocumentReferenceLike,
    data: Record<string, unknown>,
  ): unknown;
  commit(): Promise<unknown>;
}

export interface FirestoreAuthorizationLike {
  doc(path: string): FirestoreAuthorizationDocumentReferenceLike;
  batch(): FirestoreAuthorizationBatchLike;
}

export class FirestoreWorkspaceMembershipReader implements WorkspaceMembershipReader {
  readonly #firestore: FirestoreAuthorizationLike;

  constructor(firestore: FirestoreAuthorizationLike) {
    this.#firestore = firestore;
  }

  async readMembership(workspaceId: string, userId: string): Promise<unknown | null> {
    const snapshot = await this.#firestore
      .doc(`workspaces/${workspaceId}/memberships/${userId}`)
      .get();
    return snapshot.exists ? snapshot.data() : null;
  }
}

export class FirestoreWorkspaceAuthorizationEvidenceWriter
implements WorkspaceAuthorizationEvidenceWriter {
  readonly #firestore: FirestoreAuthorizationLike;

  constructor(firestore: FirestoreAuthorizationLike) {
    this.#firestore = firestore;
  }

  async writeAuthorizationEvidence(evidence: WorkspaceAuthorizationEvidence): Promise<void> {
    const workspaceId = evidence.event.workspaceId;
    const event = this.#firestore.doc(
      `workspaces/${workspaceId}/authorizationEvents/${evidence.event.id}`,
    );
    const audit = this.#firestore.doc(
      `workspaces/${workspaceId}/authorizationAudits/${evidence.audit.id}`,
    );
    const batch = this.#firestore.batch();
    batch.create(event, { ...evidence.event });
    batch.create(audit, {
      ...evidence.audit,
      denialReason: evidence.denialReason,
    });
    await batch.commit();
  }
}
