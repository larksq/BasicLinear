import { createHash, randomUUID } from 'node:crypto';

export const PRO_TRIAL_DAYS = 30;
export const PRO_TRIAL_DURATION_MS = PRO_TRIAL_DAYS * 24 * 60 * 60 * 1_000;

export interface VerifiedGoogleIdentity {
  uid: string;
  email: string;
  emailVerified: true;
  displayName: string | null;
  provider: 'google.com';
}

export interface OwnerBootstrapRecord {
  schemaVersion: 1;
  uid: string;
  email: string;
  displayName: string | null;
  workspaceId: string;
  workspaceName: string;
  membershipId: string;
  role: 'owner';
  trialId: string;
  trialPlan: 'pro';
  trialStatus: 'active';
  trialStartedAt: string;
  trialEndsAt: string;
  createdAt: string;
  idempotencyDigest: string;
}

export interface OwnerBootstrapCandidate extends OwnerBootstrapRecord {}

export interface OwnerBootstrapResult {
  created: boolean;
  record: OwnerBootstrapRecord;
}

export interface OwnerBootstrapRepository {
  bootstrapOnce(candidate: OwnerBootstrapCandidate): Promise<OwnerBootstrapResult>;
}

export interface OwnerBootstrapServiceOptions {
  clock?: () => Date;
  idFactory?: () => string;
  postBootstrap?: (
    identity: VerifiedGoogleIdentity,
    result: OwnerBootstrapResult,
  ) => Promise<void>;
}

export class OwnerBootstrapInputError extends Error {
  readonly code: 'INVALID_GOOGLE_IDENTITY' | 'INVALID_IDEMPOTENCY_KEY';

  constructor(code: OwnerBootstrapInputError['code'], message: string) {
    super(message);
    this.name = 'OwnerBootstrapInputError';
    this.code = code;
  }
}

const safeOpaquePart = (value: string): string => value.replaceAll('-', '').toLowerCase();

const cloneRecord = (record: OwnerBootstrapRecord): OwnerBootstrapRecord => ({ ...record });

function normalizeIdentity(identity: VerifiedGoogleIdentity): VerifiedGoogleIdentity {
  const uid = identity.uid.trim();
  const email = identity.email.trim().toLowerCase();
  const displayName = identity.displayName?.trim() || null;
  if (
    identity.provider !== 'google.com'
    || identity.emailVerified !== true
    || uid.length < 3
    || uid.length > 128
    || uid.includes('/')
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || (displayName !== null && displayName.length > 160)
  ) {
    throw new OwnerBootstrapInputError(
      'INVALID_GOOGLE_IDENTITY',
      'A verified Google identity is required.',
    );
  }
  return { uid, email, displayName, emailVerified: true, provider: 'google.com' };
}

function digestIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new OwnerBootstrapInputError(
      'INVALID_IDEMPOTENCY_KEY',
      'A valid idempotency key is required.',
    );
  }
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export class OwnerBootstrapService {
  readonly #repository: OwnerBootstrapRepository;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #postBootstrap: OwnerBootstrapServiceOptions['postBootstrap'];

  constructor(repository: OwnerBootstrapRepository, options: OwnerBootstrapServiceOptions = {}) {
    this.#repository = repository;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#postBootstrap = options.postBootstrap;
  }

  async bootstrap(identityInput: VerifiedGoogleIdentity, idempotencyKey: string): Promise<OwnerBootstrapResult> {
    const identity = normalizeIdentity(identityInput);
    const idempotencyDigest = digestIdempotencyKey(idempotencyKey);
    const startedAt = this.#clock();
    if (!Number.isFinite(startedAt.getTime())) {
      throw new OwnerBootstrapInputError('INVALID_GOOGLE_IDENTITY', 'The trusted server clock is invalid.');
    }
    const trialStartedAt = startedAt.toISOString();
    const trialEndsAt = new Date(startedAt.getTime() + PRO_TRIAL_DURATION_MS).toISOString();
    const workspaceId = `ws_${safeOpaquePart(this.#idFactory())}`;
    const membershipId = `mem_${safeOpaquePart(this.#idFactory())}`;
    const trialId = `trial_${safeOpaquePart(this.#idFactory())}`;
    const candidate: OwnerBootstrapCandidate = {
      schemaVersion: 1,
      uid: identity.uid,
      email: identity.email,
      displayName: identity.displayName,
      workspaceId,
      workspaceName: 'BasicLinear workspace',
      membershipId,
      role: 'owner',
      trialId,
      trialPlan: 'pro',
      trialStatus: 'active',
      trialStartedAt,
      trialEndsAt,
      createdAt: trialStartedAt,
      idempotencyDigest,
    };
    const result = await this.#repository.bootstrapOnce(candidate);
    const response = { created: result.created, record: cloneRecord(result.record) };
    await this.#postBootstrap?.(identity, response);
    return response;
  }
}

export class MemoryOwnerBootstrapRepository implements OwnerBootstrapRepository {
  readonly #records = new Map<string, OwnerBootstrapRecord>();
  #queue: Promise<void> = Promise.resolve();

  bootstrapOnce(candidate: OwnerBootstrapCandidate): Promise<OwnerBootstrapResult> {
    const operation = this.#queue.then(() => {
      const existing = this.#records.get(candidate.uid);
      if (existing !== undefined) return { created: false, record: cloneRecord(existing) };
      const record = cloneRecord(candidate);
      this.#records.set(candidate.uid, record);
      return { created: true, record: cloneRecord(record) };
    });
    this.#queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  get size(): number {
    return this.#records.size;
  }

  read(uid: string): OwnerBootstrapRecord | null {
    const record = this.#records.get(uid);
    return record === undefined ? null : cloneRecord(record);
  }
}
