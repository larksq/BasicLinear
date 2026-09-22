import { describe, expect, it } from 'vitest';
import {
  FirestoreOwnerBootstrapRepository,
  MemoryOwnerBootstrapRepository,
  OwnerBootstrapInputError,
  OwnerBootstrapService,
  PRO_TRIAL_DURATION_MS,
  type FirestoreDocumentReferenceLike,
  type FirestoreDocumentSnapshotLike,
  type FirestoreLike,
  type FirestoreTransactionLike,
  type VerifiedGoogleIdentity,
} from '../src/index.js';

const googleIdentity: VerifiedGoogleIdentity = {
  uid: 'firebase-uid-owner-1',
  email: 'Owner@Example.com',
  emailVerified: true,
  displayName: 'Owner One',
  provider: 'google.com',
};

const idSequence = () => {
  let index = 0;
  return () => `00000000-0000-4000-8000-${String(++index).padStart(12, '0')}`;
};

class TestFirestore implements FirestoreLike {
  readonly documents = new Map<string, Record<string, unknown>>();
  #queue: Promise<void> = Promise.resolve();

  doc(path: string): FirestoreDocumentReferenceLike {
    return { path };
  }

  runTransaction<T>(operation: (transaction: FirestoreTransactionLike) => Promise<T>): Promise<T> {
    const run = this.#queue.then(async () => {
      const writes = new Map<string, {kind: 'create' | 'set'; data: Record<string, unknown>}[]>();
      const transaction: FirestoreTransactionLike = {
        get: async (reference): Promise<FirestoreDocumentSnapshotLike> => {
          const data = this.documents.get(reference.path);
          return { exists: data !== undefined, data: () => data === undefined ? undefined : structuredClone(data) };
        },
        create: (reference, data) => {
          const current = writes.get(reference.path) ?? [];
          current.push({ kind: 'create', data: structuredClone(data) });
          writes.set(reference.path, current);
        },
        set: (reference, data) => {
          const current = writes.get(reference.path) ?? [];
          current.push({ kind: 'set', data: structuredClone(data) });
          writes.set(reference.path, current);
        },
      };
      const result = await operation(transaction);
      for (const [path, entries] of writes) {
        for (const entry of entries) {
          if (entry.kind === 'create' && this.documents.has(path)) throw new Error('ALREADY_EXISTS');
          const existing = this.documents.get(path) ?? {};
          this.documents.set(path, entry.kind === 'set' ? { ...existing, ...entry.data } : entry.data);
        }
      }
      return result;
    });
    this.#queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

describe('owner bootstrap', () => {
  it('creates exactly one owner workspace, membership, and 30-day trial across concurrent tabs', async () => {
    const repository = new MemoryOwnerBootstrapRepository();
    const start = new Date('2026-03-08T01:30:00.000Z');
    const service = new OwnerBootstrapService(repository, {
      clock: () => new Date(start),
      idFactory: idSequence(),
    });

    const [first, second] = await Promise.all([
      service.bootstrap(googleIdentity, 'tab-one-request-0001'),
      service.bootstrap(googleIdentity, 'tab-two-request-0002'),
    ]);

    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.record.workspaceId).toBe(second.record.workspaceId);
    expect(first.record.membershipId).toBe(second.record.membershipId);
    expect(first.record.trialId).toBe(second.record.trialId);
    expect(repository.size).toBe(1);
    expect(first.record.email).toBe('owner@example.com');
    expect(Date.parse(first.record.trialEndsAt) - Date.parse(first.record.trialStartedAt))
      .toBe(PRO_TRIAL_DURATION_MS);
    expect(first.record.trialStartedAt).toBe('2026-03-08T01:30:00.000Z');
    expect(first.record.trialEndsAt).toBe('2026-04-07T01:30:00.000Z');
  });

  it('never grants a second trial when the same UID returns later with a new retry key', async () => {
    const repository = new MemoryOwnerBootstrapRepository();
    let now = new Date('2026-01-01T00:00:00.000Z');
    const service = new OwnerBootstrapService(repository, { clock: () => new Date(now), idFactory: idSequence() });
    const first = await service.bootstrap(googleIdentity, 'first-request-key-0001');
    now = new Date('2027-01-01T00:00:00.000Z');
    const repeated = await service.bootstrap(googleIdentity, 'later-request-key-0002');

    expect(first.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(repeated.record).toEqual(first.record);
    expect(repeated.record.idempotencyDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(repeated.record.idempotencyDigest).not.toContain('first-request-key');
  });

  it('runs the server-owned post-bootstrap grant hook on create and replay', async () => {
    const calls: Array<{email: string; created: boolean}> = [];
    const service = new OwnerBootstrapService(new MemoryOwnerBootstrapRepository(), {
      clock: () => new Date('2026-08-26T00:00:00.000Z'),
      idFactory: idSequence(),
      postBootstrap: async (identity, result) => {
        calls.push({email: identity.email, created: result.created});
      },
    });
    await service.bootstrap(googleIdentity, 'post-bootstrap-key-0001');
    await service.bootstrap(googleIdentity, 'post-bootstrap-key-0002');
    expect(calls).toEqual([
      {email: 'owner@example.com', created: true},
      {email: 'owner@example.com', created: false},
    ]);
  });

  it('rejects non-Google, unverified, malformed, and weakly keyed requests', async () => {
    const service = new OwnerBootstrapService(new MemoryOwnerBootstrapRepository());
    await expect(service.bootstrap(
      { ...googleIdentity, provider: 'password' } as unknown as VerifiedGoogleIdentity,
      'valid-request-key-0001',
    )).rejects.toMatchObject({ code: 'INVALID_GOOGLE_IDENTITY' } satisfies Partial<OwnerBootstrapInputError>);
    await expect(service.bootstrap(
      { ...googleIdentity, emailVerified: false } as unknown as VerifiedGoogleIdentity,
      'valid-request-key-0001',
    )).rejects.toMatchObject({ code: 'INVALID_GOOGLE_IDENTITY' } satisfies Partial<OwnerBootstrapInputError>);
    await expect(service.bootstrap(googleIdentity, 'short')).rejects.toMatchObject({
      code: 'INVALID_IDEMPOTENCY_KEY',
    } satisfies Partial<OwnerBootstrapInputError>);
  });

  it('commits the Firebase document set atomically and reuses it on a concurrent retry', async () => {
    const firestore = new TestFirestore();
    const repository = new FirestoreOwnerBootstrapRepository(firestore);
    const service = new OwnerBootstrapService(repository, {
      clock: () => new Date('2026-11-01T00:00:00.000Z'),
      idFactory: idSequence(),
    });
    const [first, second] = await Promise.all([
      service.bootstrap(googleIdentity, 'firestore-tab-one-0001'),
      service.bootstrap(googleIdentity, 'firestore-tab-two-0002'),
    ]);

    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.record.workspaceId).toBe(second.record.workspaceId);
    expect([...firestore.documents.keys()].sort()).toEqual([
      `_ownerTrialEligibility/${googleIdentity.uid}`,
      `hostedUsers/${googleIdentity.uid}`,
      `workspaces/${first.record.workspaceId}`,
      `workspaces/${first.record.workspaceId}/entitlements/current`,
      `workspaces/${first.record.workspaceId}/memberships/${googleIdentity.uid}`,
    ].sort());
    expect(firestore.documents.get(`_ownerTrialEligibility/${googleIdentity.uid}`))
      .toMatchObject({ trialConsumed: true, workspaceId: first.record.workspaceId });
    expect(firestore.documents.get(`workspaces/${first.record.workspaceId}`))
      .toMatchObject({
        workspaceId: first.record.workspaceId,
        authority: 'firebase-hosted',
        ownerUid: googleIdentity.uid,
      });
  });
});
