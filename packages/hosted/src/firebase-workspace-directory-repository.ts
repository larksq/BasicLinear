import type {WorkspaceDirectoryRepository} from './workspace-directory-service.js';

export interface FirestoreWorkspaceDirectoryDocumentSnapshotLike {
  readonly exists: boolean;
  data(): unknown;
}

export interface FirestoreWorkspaceDirectoryDocumentReferenceLike {
  get(): Promise<FirestoreWorkspaceDirectoryDocumentSnapshotLike>;
}

export interface FirestoreWorkspaceDirectoryQuerySnapshotLike {
  readonly docs: ReadonlyArray<{data(): unknown}>;
}

export interface FirestoreWorkspaceDirectoryQueryLike {
  where(field: string, operator: '==', value: unknown): FirestoreWorkspaceDirectoryQueryLike;
  limit(value: number): FirestoreWorkspaceDirectoryQueryLike;
  get(): Promise<FirestoreWorkspaceDirectoryQuerySnapshotLike>;
}

export interface FirestoreWorkspaceDirectoryLike {
  doc(path: string): FirestoreWorkspaceDirectoryDocumentReferenceLike;
  collectionGroup(name: string): FirestoreWorkspaceDirectoryQueryLike;
}

export class FirestoreWorkspaceDirectoryRepository implements WorkspaceDirectoryRepository {
  constructor(private readonly firestore: FirestoreWorkspaceDirectoryLike) {}

  async listMembershipsForUser(userId: string, limit: number): Promise<unknown[]> {
    const snapshot = await this.firestore
      .collectionGroup('memberships')
      .where('userId', '==', userId)
      .limit(limit)
      .get();
    return snapshot.docs.map((document) => document.data());
  }

  async readDocument(path: string): Promise<unknown | null> {
    const snapshot = await this.firestore.doc(path).get();
    return snapshot.exists ? snapshot.data() : null;
  }
}
