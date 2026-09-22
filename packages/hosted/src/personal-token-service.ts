import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  assertHostedMutationAuditRecord,
  hostedMeasurementSchemaVersion,
  type HostedMutationAuditRecord,
} from './measurement-contract.js';
import {
  BillingServiceError,
  type WorkspaceMutationEntitlementPolicy,
} from './billing-service.js';
import type {
  CollaborationRepository,
} from './collaboration-service.js';
import {hostedOperationsPolicyV1} from './operations-control.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAction,
  type WorkspaceAuthorizationGrant,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from './workspace-authorization.js';

export const personalTokenAudience = 'basiclinear-api-v1' as const;
export const personalTokenScopes = [
  'workspace:read',
  'projects:read',
  'projects:write',
  'milestones:read',
  'milestones:write',
  'issues:read',
  'issues:write',
  'comments:read',
  'comments:write',
  'members:read',
  'members:write',
  'invitations:read',
  'invitations:write',
  'billing:read',
  'workspace:export',
] as const;
export type PersonalTokenScope = (typeof personalTokenScopes)[number];

export interface PersonalTokenView {
  id: string;
  workspaceId: string;
  name: string;
  prefix: string;
  scopes: PersonalTokenScope[];
  audience: typeof personalTokenAudience;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revision: number;
}

export interface PersonalTokenCreationResult {
  changed: boolean;
  token: PersonalTokenView;
  rawToken: string | null;
}

export interface PersonalTokenRevocationResult {
  changed: boolean;
  token: PersonalTokenView;
}

export interface PersonalTokenServiceOptions {
  secret: string | Uint8Array;
  entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  clock?: () => Date;
  idFactory?: () => string;
  randomSecret?: () => Uint8Array;
}

export class PersonalTokenServiceError extends Error {
  readonly code:
    | 'INVALID_TOKEN_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'TOKEN_NOT_FOUND'
    | 'TOKEN_CONFLICT'
    | 'TOKEN_AUTHENTICATION_FAILED'
    | 'TOKEN_SCOPE_DENIED'
    | 'TOKEN_ENTITLEMENT_REQUIRED'
    | 'TOKEN_SERVICE_UNAVAILABLE';

  constructor(code: PersonalTokenServiceError['code'], message: string) {
    super(message);
    this.name = 'PersonalTokenServiceError';
    this.code = code;
  }
}

interface StoredPersonalToken {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  creatorUserId: string;
  name: string;
  prefix: string;
  scopes: PersonalTokenScope[];
  audience: typeof personalTokenAudience;
  digest: string;
  durationDays: number;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  revision: number;
  binding: string;
}

interface TokenIdempotencyRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  userId: string;
  operation: 'token.create' | 'token.revoke';
  tokenId: string;
  requestDigest: string;
  outcomeRevision: number;
  createdAt: string;
  binding: string;
}

interface BrowserCommand {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
}

interface BrowserMutationCommand extends BrowserCommand {
  idempotencyKey: string;
}

const tokenKeys = [
  'schemaVersion', 'id', 'workspaceId', 'creatorUserId', 'name', 'prefix', 'scopes',
  'audience', 'digest', 'durationDays', 'createdAt', 'expiresAt', 'lastUsedAt',
  'revokedAt', 'revision', 'binding',
] as const;
const idempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'userId', 'operation', 'tokenId', 'requestDigest',
  'outcomeRevision', 'createdAt', 'binding',
] as const;

const paths = {
  membership: (workspaceId: string, userId: string) => `workspaces/${workspaceId}/memberships/${userId}`,
  token: (workspaceId: string, tokenId: string) => `workspaces/${workspaceId}/personalTokens/${tokenId}`,
  tokens: (workspaceId: string) => `workspaces/${workspaceId}/personalTokens`,
  idempotency: (workspaceId: string, id: string) => `workspaces/${workspaceId}/tokenIdempotency/${id}`,
  audit: (workspaceId: string, id: string) => `workspaces/${workspaceId}/mutationAudits/${id}`,
};

const clone = <Value>(value: Value): Value => structuredClone(value);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stable(candidate[key])}`).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string | Uint8Array, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function equalDigest(left: unknown, right: string): boolean {
  if (typeof left !== 'string' || !/^[a-f0-9]{64}$/u.test(left)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function safeWorkspaceId(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(normalized)) throw invalid();
  return normalized;
}

function safeReference(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(normalized)) throw invalid();
  return normalized;
}

function storedSafeReference(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function storedTokenName(value: unknown): value is string {
  return typeof value === 'string' && value === value.trim()
    && value.length >= 1 && value.length <= 80 && !/[\u0000-\u001F\u007F]/u.test(value);
}

function storedScopes(value: unknown): value is PersonalTokenScope[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > personalTokenScopes.length
    || value.some((scope) => typeof scope !== 'string'
      || !(personalTokenScopes as readonly string[]).includes(scope))) return false;
  const normalized = [...new Set(value)].sort();
  return normalized.length === value.length && normalized.every((scope, index) => scope === value[index]);
}

function safeTokenId(value: string): string {
  const normalized = value.trim();
  if (!/^pat_[a-f0-9]{32}$/u.test(normalized)) throw invalid();
  return normalized;
}

function tokenName(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || normalized.length > 80
    || /[\u0000-\u001F\u007F]/u.test(normalized)) throw invalid();
  return normalized;
}

function normalizedScopes(value: readonly string[]): PersonalTokenScope[] {
  if (value.length < 1 || value.length > personalTokenScopes.length) throw invalid();
  const unique = [...new Set(value)];
  if (unique.length !== value.length
    || unique.some((scope) => !(personalTokenScopes as readonly string[]).includes(scope))) throw invalid();
  return unique.sort() as PersonalTokenScope[];
}

function durationDays(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 365) throw invalid();
  return value;
}

function opaquePart(value: string): string {
  const part = value.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(part)) throw new Error('The personal-token id factory returned an invalid value.');
  return part;
}

function invalid(): PersonalTokenServiceError {
  return new PersonalTokenServiceError('INVALID_TOKEN_REQUEST', 'The personal-token request is invalid.');
}

function unavailable(): PersonalTokenServiceError {
  return new PersonalTokenServiceError('TOKEN_SERVICE_UNAVAILABLE', 'Personal tokens are temporarily unavailable.');
}

function authenticationFailed(): PersonalTokenServiceError {
  return new PersonalTokenServiceError('TOKEN_AUTHENTICATION_FAILED', 'The API credential is invalid or unavailable.');
}

function auditChange(field: string, before: unknown, after: unknown) {
  return {
    field,
    beforeSha256: before === undefined || before === null ? null : sha256(stable(before)),
    afterSha256: after === undefined || after === null ? null : sha256(stable(after)),
  };
}

function tokenUnsigned(token: StoredPersonalToken): Omit<StoredPersonalToken, 'binding'> {
  const {binding: _binding, ...unsigned} = token;
  return unsigned;
}

function tokenBinding(secret: string | Uint8Array, token: Omit<StoredPersonalToken, 'binding'>): string {
  return hmac(secret, stable(token));
}

function trustedToken(
  value: unknown,
  expectedWorkspaceId: string,
  expectedTokenId: string,
  secret: string | Uint8Array,
): StoredPersonalToken {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, tokenKeys) || candidate.schemaVersion !== 1
    || candidate.id !== expectedTokenId || candidate.workspaceId !== expectedWorkspaceId
    || !/^pat_[a-f0-9]{32}$/u.test(expectedTokenId)
    || !storedSafeReference(candidate.creatorUserId)
    || !storedTokenName(candidate.name)
    || typeof candidate.prefix !== 'string'
    || candidate.prefix !== `ol_pat_v1.${expectedTokenId.slice(4, 12)}`
    || !storedScopes(candidate.scopes)
    || candidate.audience !== personalTokenAudience
    || typeof candidate.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.digest)
    || !Number.isSafeInteger(candidate.durationDays) || (candidate.durationDays as number) < 1
    || (candidate.durationDays as number) > 365
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.expiresAt)
    || Date.parse(candidate.expiresAt) - Date.parse(candidate.createdAt)
      !== (candidate.durationDays as number) * 24 * 60 * 60 * 1_000
    || (candidate.lastUsedAt !== null && !canonicalTimestamp(candidate.lastUsedAt))
    || (candidate.revokedAt !== null && !canonicalTimestamp(candidate.revokedAt))
    || (candidate.lastUsedAt !== null && Date.parse(candidate.lastUsedAt) < Date.parse(candidate.createdAt))
    || (candidate.revokedAt !== null && Date.parse(candidate.revokedAt) < Date.parse(candidate.createdAt))
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const token = candidate as unknown as StoredPersonalToken;
  const expectedBinding = tokenBinding(secret, tokenUnsigned(token));
  if (!equalDigest(token.binding, expectedBinding)) throw unavailable();
  return clone({...token, binding: expectedBinding});
}

function publicToken(token: StoredPersonalToken): PersonalTokenView {
  return {
    id: token.id,
    workspaceId: token.workspaceId,
    name: token.name,
    prefix: token.prefix,
    scopes: [...token.scopes],
    audience: token.audience,
    createdAt: token.createdAt,
    expiresAt: token.expiresAt,
    lastUsedAt: token.lastUsedAt,
    revokedAt: token.revokedAt,
    revision: token.revision,
  };
}

function trustedOwnerMembership(
  value: unknown,
  workspaceId: string,
  userId: string,
  now: string,
): void {
  const candidate = record(value);
  const base = ['schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt', 'revision'];
  const expanded = [...base, 'updatedAt', 'removedAt'];
  if (candidate === null || (!exactKeys(candidate, base) && !exactKeys(candidate, expanded))
    || candidate.schemaVersion !== 1 || candidate.workspaceId !== workspaceId || candidate.userId !== userId
    || candidate.role !== 'owner' || candidate.status !== 'active'
    || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)
    || ('updatedAt' in candidate && (!canonicalTimestamp(candidate.updatedAt)
      || Date.parse(candidate.updatedAt) > Date.parse(now)))
    || ('removedAt' in candidate && candidate.removedAt !== null)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
}

function rawToken(workspaceId: string, tokenId: string, random: Uint8Array): string {
  if (random.byteLength !== 32) throw new Error('The personal-token random source must return 32 bytes.');
  const encodedWorkspace = Buffer.from(workspaceId, 'utf8').toString('base64url');
  return `ol_pat_v1.${tokenId.slice(4)}.${encodedWorkspace}.${Buffer.from(random).toString('base64url')}`;
}

function parseRawToken(value: string): {workspaceId: string; tokenId: string} | null {
  const match = /^ol_pat_v1\.([a-f0-9]{32})\.([A-Za-z0-9_-]{4,171})\.([A-Za-z0-9_-]{43})$/u.exec(value);
  if (match === null) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[2] as string, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (Buffer.from(decoded, 'utf8').toString('base64url') !== match[2]) return null;
  try {
    return {workspaceId: safeWorkspaceId(decoded), tokenId: `pat_${match[1] as string}`};
  } catch {
    return null;
  }
}

function idempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 16 || normalized.length > 160 || /\s/u.test(normalized)) {
    throw new PersonalTokenServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
  }
  return normalized;
}

export class PersonalTokenService {
  readonly #repository: CollaborationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: string | Uint8Array;
  readonly #entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #randomSecret: () => Uint8Array;

  constructor(
    repository: CollaborationRepository,
    authorization: WorkspaceAuthorizationService,
    options: PersonalTokenServiceOptions,
  ) {
    const secretLength = typeof options.secret === 'string'
      ? Buffer.byteLength(options.secret, 'utf8')
      : options.secret.byteLength;
    if (secretLength < 32 || secretLength > 512) throw new Error('Personal-token secret must contain 32 to 512 bytes.');
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = options.secret;
    this.#entitlementPolicy = options.entitlementPolicy;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#randomSecret = options.randomSecret ?? (() => randomBytes(32));
  }

  async listTokens(command: BrowserCommand): Promise<PersonalTokenView[]> {
    const context = await this.#browserOwner(command, 'token:list');
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction((transaction) => (
        transaction.list(
          paths.tokens(context.workspaceId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )
      ));
      return values.map((value) => {
        const candidate = record(value);
        if (candidate === null || typeof candidate.id !== 'string') throw unavailable();
        const token = trustedToken(value, context.workspaceId, candidate.id, this.#secret);
        if (Date.parse(token.createdAt) > Date.parse(now)
          || (token.lastUsedAt !== null && Date.parse(token.lastUsedAt) > Date.parse(now))
          || (token.revokedAt !== null && Date.parse(token.revokedAt) > Date.parse(now))) throw unavailable();
        return publicToken(token);
      }).sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof PersonalTokenServiceError) throw error;
      throw unavailable();
    }
  }

  async createToken(command: BrowserMutationCommand & {
    name: string;
    scopes: readonly string[];
    expiresInDays: number;
  }): Promise<PersonalTokenCreationResult> {
    const normalizedName = tokenName(command.name);
    const scopes = normalizedScopes(command.scopes);
    const days = durationDays(command.expiresInDays);
    const key = idempotencyKey(command.idempotencyKey);
    const context = await this.#browserOwner(command, 'token:create');
    const id = `pat_${opaquePart(this.#idFactory())}`;
    const credential = rawToken(context.workspaceId, id, this.#randomSecret());
    const requestDigest = hmac(this.#secret, stable({name: normalizedName, scopes, days}));
    const idempotencyId = sha256(`${context.userId}:token.create:${key}`);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        trustedOwnerMembership(
          await transaction.get(paths.membership(context.workspaceId, context.userId)),
          context.workspaceId,
          context.userId,
          now,
        );
        const rawIdempotency = await transaction.get(paths.idempotency(context.workspaceId, idempotencyId));
        if (rawIdempotency !== null) {
          const replay = this.#trustedIdempotency(
            rawIdempotency,
            idempotencyId,
            context.workspaceId,
            context.userId,
            'token.create',
            requestDigest,
            now,
          );
          const existing = trustedToken(
            await transaction.get(paths.token(context.workspaceId, replay.tokenId)),
            context.workspaceId,
            replay.tokenId,
            this.#secret,
          );
          if (replay.outcomeRevision !== 1 || existing.revision !== replay.outcomeRevision
            || existing.createdAt !== replay.createdAt || existing.lastUsedAt !== null
            || existing.revokedAt !== null || Date.parse(existing.createdAt) > Date.parse(now)) {
            throw new PersonalTokenServiceError(
              'TOKEN_CONFLICT',
              'The idempotency key no longer represents the token creation outcome.',
            );
          }
          return {changed: false, token: publicToken(existing), rawToken: null};
        }
        try {
          await this.#entitlementPolicy.assertMutation({
            transaction,
            workspaceId: context.workspaceId,
            principal: context.principal,
            grant: context.grant,
            operation: 'token.create',
            now,
          });
        } catch (error) {
          if (error instanceof BillingServiceError && error.code === 'BILLING_FORBIDDEN') {
            throw new PersonalTokenServiceError(
              'TOKEN_ENTITLEMENT_REQUIRED',
              'This workspace is on Free. Subscribe before creating an automation token.',
            );
          }
          throw unavailable();
        }
        const expiresAt = new Date(Date.parse(now) + days * 24 * 60 * 60 * 1_000).toISOString();
        const unsigned: Omit<StoredPersonalToken, 'binding'> = {
          schemaVersion: 1,
          id,
          workspaceId: context.workspaceId,
          creatorUserId: context.userId,
          name: normalizedName,
          prefix: `ol_pat_v1.${id.slice(4, 12)}`,
          scopes,
          audience: personalTokenAudience,
          digest: sha256(credential),
          durationDays: days,
          createdAt: now,
          expiresAt,
          lastUsedAt: null,
          revokedAt: null,
          revision: 1,
        };
        const token: StoredPersonalToken = {...unsigned, binding: tokenBinding(this.#secret, unsigned)};
        const idempotency = this.#idempotency({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId: context.workspaceId,
          userId: context.userId,
          operation: 'token.create',
          tokenId: id,
          requestDigest,
          outcomeRevision: 1,
          createdAt: now,
        });
        const audit = this.#audit(context, 'token.create', id, null, 1, now, [
          auditChange('name', undefined, token.name),
          auditChange('scopes', undefined, token.scopes),
          auditChange('audience', undefined, token.audience),
          auditChange('expiresAt', undefined, token.expiresAt),
          auditChange('credentialDigest', undefined, token.digest),
        ]);
        transaction.create(paths.token(context.workspaceId, id), {...token});
        transaction.create(paths.idempotency(context.workspaceId, idempotencyId), {...idempotency});
        transaction.create(paths.audit(context.workspaceId, audit.id), {...audit});
        return {changed: true, token: publicToken(token), rawToken: credential};
      });
    } catch (error) {
      if (error instanceof PersonalTokenServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async revokeToken(command: BrowserMutationCommand & {tokenId: string}): Promise<PersonalTokenRevocationResult> {
    const tokenId = safeTokenId(command.tokenId);
    const key = idempotencyKey(command.idempotencyKey);
    const context = await this.#browserOwner(command, tokenId);
    const requestDigest = hmac(this.#secret, stable({tokenId}));
    const idempotencyId = sha256(`${context.userId}:token.revoke:${key}`);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        trustedOwnerMembership(
          await transaction.get(paths.membership(context.workspaceId, context.userId)),
          context.workspaceId,
          context.userId,
          now,
        );
        const rawTokenRecord = await transaction.get(paths.token(context.workspaceId, tokenId));
        if (rawTokenRecord === null) {
          throw new PersonalTokenServiceError('TOKEN_NOT_FOUND', 'The personal token was not found.');
        }
        const before = trustedToken(
          rawTokenRecord,
          context.workspaceId,
          tokenId,
          this.#secret,
        );
        if (Date.parse(before.createdAt) > Date.parse(now)
          || (before.lastUsedAt !== null && Date.parse(before.lastUsedAt) > Date.parse(now))
          || (before.revokedAt !== null && Date.parse(before.revokedAt) > Date.parse(now))) throw unavailable();
        const rawIdempotency = await transaction.get(paths.idempotency(context.workspaceId, idempotencyId));
        if (rawIdempotency !== null) {
          const replay = this.#trustedIdempotency(
            rawIdempotency,
            idempotencyId,
            context.workspaceId,
            context.userId,
            'token.revoke',
            requestDigest,
            now,
          );
          if (replay.tokenId !== tokenId || before.revision !== replay.outcomeRevision
            || before.revokedAt !== replay.createdAt) throw unavailable();
          return {changed: false, token: publicToken(before)};
        }
        if (before.revokedAt !== null) {
          const idempotency = this.#idempotency({
            schemaVersion: 1,
            id: idempotencyId,
            workspaceId: context.workspaceId,
            userId: context.userId,
            operation: 'token.revoke',
            tokenId,
            requestDigest,
            outcomeRevision: before.revision,
            createdAt: before.revokedAt,
          });
          transaction.create(paths.idempotency(context.workspaceId, idempotencyId), {...idempotency});
          return {changed: false, token: publicToken(before)};
        }
        try {
          await this.#entitlementPolicy.assertMutation({
            transaction,
            workspaceId: context.workspaceId,
            principal: context.principal,
            grant: context.grant,
            operation: 'token.revoke',
            now,
          });
        } catch (error) {
          if (error instanceof BillingServiceError && error.code === 'BILLING_FORBIDDEN') {
            throw new PersonalTokenServiceError('TOKEN_ENTITLEMENT_REQUIRED', 'Token revocation is unavailable.');
          }
          throw unavailable();
        }
        const unsigned: Omit<StoredPersonalToken, 'binding'> = {
          ...tokenUnsigned(before),
          revokedAt: now,
          revision: before.revision + 1,
        };
        const after: StoredPersonalToken = {...unsigned, binding: tokenBinding(this.#secret, unsigned)};
        const idempotency = this.#idempotency({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId: context.workspaceId,
          userId: context.userId,
          operation: 'token.revoke',
          tokenId,
          requestDigest,
          outcomeRevision: after.revision,
          createdAt: now,
        });
        const audit = this.#audit(
          context,
          'token.revoke',
          tokenId,
          before.revision,
          after.revision,
          now,
          [auditChange('revokedAt', before.revokedAt, after.revokedAt)],
        );
        transaction.set(paths.token(context.workspaceId, tokenId), {...after});
        transaction.create(paths.idempotency(context.workspaceId, idempotencyId), {...idempotency});
        transaction.create(paths.audit(context.workspaceId, audit.id), {...audit});
        return {changed: true, token: publicToken(after)};
      });
    } catch (error) {
      if (error instanceof PersonalTokenServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async authenticate(input: {
    rawToken: string;
    workspaceId: string;
    requiredScope: PersonalTokenScope;
    action: WorkspaceAction;
    targetEntityType: string;
    targetEntityId: string;
    requestId: string;
  }): Promise<WorkspacePrincipal> {
    const expectedWorkspaceId = safeWorkspaceId(input.workspaceId);
    const normalizedRequestId = safeReference(input.requestId);
    if (!(personalTokenScopes as readonly string[]).includes(input.requiredScope)) throw authenticationFailed();
    const parsed = parseRawToken(input.rawToken);
    const lookupWorkspaceId = parsed?.workspaceId ?? expectedWorkspaceId;
    const lookupTokenId = parsed?.tokenId ?? `pat_${'0'.repeat(32)}`;
    const presentedDigest = sha256(input.rawToken);
    let token: StoredPersonalToken | null = null;
    try {
      token = await this.#repository.runTransaction(async (transaction) => {
        const value = await transaction.get(paths.token(lookupWorkspaceId, lookupTokenId));
        if (value === null) {
          timingSafeEqual(Buffer.from(presentedDigest, 'hex'), Buffer.from('0'.repeat(64), 'hex'));
          return null;
        }
        const trusted = trustedToken(value, lookupWorkspaceId, lookupTokenId, this.#secret);
        if (!equalDigest(trusted.digest, presentedDigest)) return null;
        return trusted;
      });
    } catch (error) {
      if (error instanceof PersonalTokenServiceError) throw error;
      throw unavailable();
    }
    const now = this.#trustedNow();
    if (parsed === null || token === null || token.workspaceId !== expectedWorkspaceId
      || token.audience !== personalTokenAudience || token.revokedAt !== null
      || Date.parse(token.createdAt) > Date.parse(now) || Date.parse(token.expiresAt) <= Date.parse(now)) {
      throw authenticationFailed();
    }
    if (!token.scopes.includes(input.requiredScope)) {
      throw new PersonalTokenServiceError('TOKEN_SCOPE_DENIED', 'The API credential does not allow this operation.');
    }
    const principal: WorkspacePrincipal = {
      kind: 'personal_token',
      userId: token.creatorUserId,
      tokenReference: `tokref_${token.id.slice(4)}`,
      credentialWorkspaceId: token.workspaceId,
      source: 'rest',
    };
    await this.#authorization.authorize({
      principal,
      workspaceId: expectedWorkspaceId,
      action: input.action,
      targetEntityType: safeReference(input.targetEntityType),
      targetEntityId: safeReference(input.targetEntityId),
      requestId: normalizedRequestId,
    });
    await this.#touchAfterAuthorizedUse(token, presentedDigest, now, normalizedRequestId, principal);
    return principal;
  }

  async #touchAfterAuthorizedUse(
    token: StoredPersonalToken,
    presentedDigest: string,
    now: string,
    requestId: string,
    principal: Extract<WorkspacePrincipal, {kind: 'personal_token'}>,
  ): Promise<void> {
    try {
      await this.#repository.runTransaction(async (transaction) => {
        const current = trustedToken(
          await transaction.get(paths.token(token.workspaceId, token.id)),
          token.workspaceId,
          token.id,
          this.#secret,
        );
        if (!equalDigest(current.digest, presentedDigest) || current.revokedAt !== null
          || Date.parse(current.createdAt) > Date.parse(now) || Date.parse(current.expiresAt) <= Date.parse(now)
          || (current.lastUsedAt !== null && Date.parse(current.lastUsedAt) > Date.parse(now))) {
          throw authenticationFailed();
        }
        const unsigned: Omit<StoredPersonalToken, 'binding'> = {
          ...tokenUnsigned(current),
          lastUsedAt: now,
          revision: current.revision + 1,
        };
        const audit: HostedMutationAuditRecord = {
          schemaVersion: hostedMeasurementSchemaVersion,
          id: `audit:token-use:${opaquePart(this.#idFactory())}`,
          workspaceId: token.workspaceId,
          actor: {kind: 'personal_token', id: `patref:${principal.tokenReference}`},
          source: 'rest',
          occurredAt: now,
          requestId,
          entity: {
            type: 'personal_token', id: token.id,
            revisionBefore: current.revision, revisionAfter: unsigned.revision,
          },
          action: 'token.use',
          result: 'succeeded',
          changes: [{
            field: 'lastUsedAt',
            beforeSha256: current.lastUsedAt === null ? null : sha256(stable(current.lastUsedAt)),
            afterSha256: sha256(stable(now)),
          }],
        };
        assertHostedMutationAuditRecord(audit);
        transaction.set(paths.token(token.workspaceId, token.id), {
          ...unsigned,
          binding: tokenBinding(this.#secret, unsigned),
        });
        transaction.create(paths.audit(token.workspaceId, audit.id), {...audit});
      });
    } catch (error) {
      if (error instanceof PersonalTokenServiceError) throw error;
      throw unavailable();
    }
  }

  async #browserOwner(
    command: BrowserCommand,
    targetEntityId: string,
  ): Promise<{
      principal: Extract<WorkspacePrincipal, {kind: 'user'}>;
      workspaceId: string;
      requestId: string;
      userId: string;
      grant: WorkspaceAuthorizationGrant;
    }> {
    if (command.principal.kind !== 'user' || command.principal.source !== 'web') throw invalid();
    const workspaceId = safeWorkspaceId(command.workspaceId);
    const normalizedRequestId = safeReference(command.requestId);
    const userId = safeReference(command.principal.userId);
    const grant = await this.#authorization.authorize({
      principal: command.principal,
      workspaceId,
      action: 'token.manage',
      targetEntityType: 'personal_token',
      targetEntityId,
      requestId: normalizedRequestId,
    });
    if (grant.role !== 'owner' || grant.userId !== userId) throw invalid();
    return {
      principal: command.principal,
      workspaceId,
      requestId: normalizedRequestId,
      userId,
      grant,
    };
  }

  #trustedIdempotency(
    value: unknown,
    expectedId: string,
    workspaceId: string,
    userId: string,
    operation: TokenIdempotencyRecord['operation'],
    requestDigest: string,
    now: string,
  ): TokenIdempotencyRecord {
    const candidate = record(value);
    if (candidate === null || !exactKeys(candidate, idempotencyKeys) || candidate.schemaVersion !== 1
      || candidate.id !== expectedId || candidate.workspaceId !== workspaceId || candidate.userId !== userId
      || candidate.operation !== operation || typeof candidate.tokenId !== 'string'
      || !/^pat_[a-f0-9]{32}$/u.test(candidate.tokenId) || candidate.requestDigest !== requestDigest
      || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 1
      || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)
      || typeof candidate.binding !== 'string') {
      throw new PersonalTokenServiceError('TOKEN_CONFLICT', 'The idempotency key is already in use.');
    }
    const unsigned: Omit<TokenIdempotencyRecord, 'binding'> = {
      schemaVersion: 1,
      id: expectedId,
      workspaceId,
      userId,
      operation,
      tokenId: candidate.tokenId,
      requestDigest,
      outcomeRevision: candidate.outcomeRevision as number,
      createdAt: candidate.createdAt,
    };
    const expectedBinding = hmac(this.#secret, stable(unsigned));
    if (!equalDigest(candidate.binding, expectedBinding)) throw unavailable();
    return {...unsigned, binding: expectedBinding};
  }

  #idempotency(value: Omit<TokenIdempotencyRecord, 'binding'>): TokenIdempotencyRecord {
    return {...value, binding: hmac(this.#secret, stable(value))};
  }

  #audit(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    action: 'token.create' | 'token.revoke',
    tokenId: string,
    revisionBefore: number | null,
    revisionAfter: number,
    now: string,
    changes: ReturnType<typeof auditChange>[],
  ): HostedMutationAuditRecord {
    const audit: HostedMutationAuditRecord = {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `audit:token:${opaquePart(this.#idFactory())}`,
      workspaceId: context.workspaceId,
      actor: {kind: 'user', id: `user:${context.principal.userId}`},
      source: 'web',
      occurredAt: now,
      requestId: context.requestId,
      entity: {type: 'personal_token', id: tokenId, revisionBefore, revisionAfter},
      action,
      result: 'succeeded',
      changes: [auditChange('revision', revisionBefore, revisionAfter), ...changes],
    };
    assertHostedMutationAuditRecord(audit);
    return audit;
  }

  #trustedNow(): string {
    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw unavailable();
    return now.toISOString();
  }
}
