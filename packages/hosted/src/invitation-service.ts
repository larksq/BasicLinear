import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  hostedMeasurementSchemaVersion,
  type HostedMutationAuditRecord,
  type HostedProductEvent,
} from './measurement-contract.js';
import { PRO_TRIAL_DURATION_MS } from './owner-bootstrap.js';
import {
  isOpaquePersonalTokenReference,
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationService,
  type WorkspaceAuthorizationGrant,
  type WorkspacePrincipal,
} from './workspace-authorization.js';
import {
  BillingServiceError,
  type BillingSeatReconciler,
  type EntitledMutationOperation,
  type WorkspaceMutationEntitlementPolicy,
} from './billing-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';
import {
  defaultHostedTeamId,
  hostedTeamMembershipId,
  trustedHostedTeamMembershipRecord,
  trustedHostedTeamRecord,
  type HostedTeamMembership,
} from './workspace-configuration-service.js';

export const INVITATION_DURATION_DAYS = 7;
export const INVITATION_DURATION_MS = INVITATION_DURATION_DAYS * 24 * 60 * 60 * 1_000;
export const MAX_INVITATION_SENDS = 10;

export type StoredInvitationStatus = 'pending' | 'revoked' | 'accepted';
export type InvitationViewState = StoredInvitationStatus | 'expired';
export type InvitationPreviewState = InvitationViewState | 'superseded';
type InvitationTokenState = 'current' | 'superseded' | 'revoked' | 'used';
type InvitationIdempotencyOperation = 'create' | 'resend' | 'revoke' | 'accept';
type InvitationAcceptanceOutcome =
  | 'accepted'
  | 'email_mismatch'
  | 'expired'
  | 'revoked'
  | 'superseded'
  | 'already_accepted';

export interface InvitationRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  invitedEmail: string;
  inviterUserId: string;
  inviterDisplayName: string;
  workspaceName: string;
  role: 'member';
  teamIds?: string[];
  status: StoredInvitationStatus;
  createdAt: string;
  updatedAt: string;
  lastSentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedUserId: string | null;
  revokedAt: string | null;
  currentTokenDigest: string;
  sendCount: number;
  activeSeatApplied: boolean;
  revision: number;
}

interface InvitationTokenRecord {
  schemaVersion: 1;
  digest: string;
  workspaceId: string;
  invitationId: string;
  version: number;
  state: InvitationTokenState;
  createdAt: string;
  expiresAt: string;
  binding: string;
}

interface InvitationIdempotencyRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  operation: InvitationIdempotencyOperation;
  requestReference: string;
  invitationId: string;
  tokenDigest: string | null;
  outcome: InvitationAcceptanceOutcome | 'completed';
  createdAt: string;
  binding: string;
}

interface InvitationWorkspaceRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  ownerUid: string;
  authority: 'firebase-hosted';
  createdAt: string;
  revision: number;
}

interface InvitationHostedUserRecord {
  schemaVersion: 1;
  uid: string;
  email: string;
  updatedAt: string;
}

interface InvitationEntitlementRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  plan: string;
  status: string;
  trialStartedAt: string;
  trialEndsAt: string;
  source: string;
  revision: number;
}

export interface InvitationMembershipRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'member';
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt?: string;
  removedAt?: string | null;
  revision: number;
}

export interface InvitationTransaction {
  get(path: string): Promise<unknown | null>;
  list(collectionPath: string, maximumRecords?: number): Promise<unknown[]>;
  create(path: string, value: Record<string, unknown>): void;
  set(path: string, value: Record<string, unknown>): void;
  merge(path: string, value: Record<string, unknown>): void;
}

export interface InvitationRepository {
  runTransaction<Value>(operation: (transaction: InvitationTransaction) => Promise<Value>): Promise<Value>;
  listDocuments(collectionPath: string, orderByField: string, limit: number): Promise<unknown[]>;
}

export interface InvitationOwnerView {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  inviterDisplayName: string;
  workspaceName: string;
  role: 'member';
  teamIds?: string[];
  state: InvitationViewState;
  createdAt: string;
  lastSentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  sendCount: number;
  activeSeatApplied: boolean;
  revision: number;
}

export interface InvitationPreview {
  invitationId: string;
  workspaceId: string;
  invitedEmail: string;
  inviterDisplayName: string;
  workspaceName: string;
  role: 'member';
  state: InvitationPreviewState;
  expiresAt: string;
}

export interface InvitationMutationResult {
  changed: boolean;
  invitation: InvitationOwnerView;
  shareToken: string | null;
}

export interface InvitationAcceptanceResult {
  state: 'accepted';
  firstAcceptance: boolean;
  activeSeatAdded: boolean;
  workspace: {id: string; name: string};
  membership: {
    userId: string;
    role: 'owner' | 'member';
    status: 'active';
    revision: number;
  };
}

export interface InvitationServiceOptions {
  secret: string | Uint8Array;
  entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  seatReconciler: BillingSeatReconciler;
  clock?: () => Date;
  idFactory?: () => string;
}

export class InvitationServiceError extends Error {
  readonly code:
    | 'INVALID_INVITATION_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'INVITATION_NOT_FOUND'
    | 'INVITATION_UNAVAILABLE'
    | 'INVITATION_EMAIL_MISMATCH'
    | 'INVITATION_EXPIRED'
    | 'INVITATION_REVOKED'
    | 'INVITATION_SUPERSEDED'
    | 'INVITATION_ALREADY_ACCEPTED'
    | 'INVITATION_FINALIZED'
    | 'INVITATION_SEND_LIMIT'
    | 'INVITATION_CONFLICT'
    | 'INVITATION_ENTITLEMENT_REQUIRED'
    | 'INVITATION_SERVICE_UNAVAILABLE';

  constructor(code: InvitationServiceError['code'], message: string) {
    super(message);
    this.name = 'InvitationServiceError';
    this.code = code;
  }
}

interface OwnerCommandContext {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
  idempotencyKey: string;
}

interface CreateInvitationInput extends OwnerCommandContext {
  invitedEmail: string;
  teamIds?: string[];
  inviterEmail?: string;
  inviterDisplayName?: string | null;
}

interface OwnerInvitationCommandInput extends OwnerCommandContext {
  invitationId: string;
}

interface ListInvitationInput {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
}

interface AcceptInvitationInput {
  token: string;
  identity: {
    uid: string;
    email: string;
    displayName: string | null;
  };
  requestId: string;
  idempotencyKey: string;
}

interface InternalAcceptanceResult {
  outcome: InvitationAcceptanceOutcome;
  invitation: InvitationRecord;
  membership: InvitationMembershipRecord | null;
  firstAcceptance: boolean;
  activeSeatAdded: boolean;
}

const invitationKeys = [
  'schemaVersion',
  'id',
  'workspaceId',
  'invitedEmail',
  'inviterUserId',
  'inviterDisplayName',
  'workspaceName',
  'role',
  'teamIds',
  'status',
  'createdAt',
  'updatedAt',
  'lastSentAt',
  'expiresAt',
  'acceptedAt',
  'acceptedUserId',
  'revokedAt',
  'currentTokenDigest',
  'sendCount',
  'activeSeatApplied',
  'revision',
] as const;

const legacyInvitationKeys = invitationKeys.filter((key) => key !== 'teamIds');

const tokenKeys = [
  'schemaVersion',
  'digest',
  'workspaceId',
  'invitationId',
  'version',
  'state',
  'createdAt',
  'expiresAt',
  'binding',
] as const;

const idempotencyKeys = [
  'schemaVersion',
  'id',
  'workspaceId',
  'operation',
  'requestReference',
  'invitationId',
  'tokenDigest',
  'outcome',
  'createdAt',
  'binding',
] as const;

const workspaceKeys = [
  'schemaVersion',
  'id',
  'workspaceId',
  'name',
  'ownerUid',
  'authority',
  'createdAt',
  'revision',
] as const;

const entitlementKeys = [
  'schemaVersion',
  'id',
  'workspaceId',
  'plan',
  'status',
  'trialStartedAt',
  'trialEndsAt',
  'source',
  'revision',
] as const;

const clone = <Value>(value: Value): Value => structuredClone(value);

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function canonicalTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || canonicalTimestamp(value);
}

function timestampAtOrBefore(left: unknown, right: unknown): boolean {
  return canonicalTimestamp(left)
    && canonicalTimestamp(right)
    && Date.parse(left) <= Date.parse(right);
}

function timestampBefore(left: unknown, right: unknown): boolean {
  return canonicalTimestamp(left)
    && canonicalTimestamp(right)
    && Date.parse(left) < Date.parse(right);
}

function exactTimestampDuration(start: unknown, end: unknown, durationMs: number): boolean {
  return canonicalTimestamp(start)
    && canonicalTimestamp(end)
    && Date.parse(end) - Date.parse(start) === durationMs;
}

function equalSha256(left: string, right: string): boolean {
  return /^[a-f0-9]{64}$/u.test(left)
    && /^[a-f0-9]{64}$/u.test(right)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function storedSafeReference(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function safeReference(value: unknown, label: string, maximum = 128): string {
  if (
    typeof value !== 'string'
    || value.length < 3
    || value.length > maximum
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value)
  ) {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', `${label} is invalid.`);
  }
  return value;
}

function safeWorkspaceReference(value: unknown): string {
  if (
    typeof value !== 'string'
    || value.length < 3
    || value.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(value)
  ) {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'workspaceId is invalid.');
  }
  return value;
}

function normalizeTeamIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'The invited teams are invalid.');
  }
  const values = value.map((teamId) => {
    if (typeof teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(teamId)) {
      throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'The invited teams are invalid.');
    }
    return teamId;
  });
  return [...new Set(values)].sort();
}

function storedTeamIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const normalized = value.every((teamId) => typeof teamId === 'string' && /^team_[a-f0-9]{32}$/u.test(teamId))
    ? [...new Set(value as string[])].sort()
    : null;
  return normalized !== null && normalized.length === value.length
    && normalized.every((teamId, index) => teamId === value[index]) ? normalized : null;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'A valid invited email is required.');
  }
  const email = value.trim().toLowerCase();
  if (
    email.length < 3
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'A valid invited email is required.');
  }
  return email;
}

function isNormalizedEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return normalizeEmail(value) === value;
  } catch {
    return false;
  }
}

function displayName(value: string | null | undefined): string {
  const normalized = value?.trim() ?? '';
  if (normalized === '') return 'Workspace owner';
  if (normalized.length > 160 || /[\u0000-\u001F\u007F]/u.test(normalized)) {
    throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'The inviter display name is invalid.');
  }
  return normalized;
}

function validSecret(value: string | Uint8Array): Uint8Array {
  const secret = typeof value === 'string' ? Buffer.from(value, 'utf8') : new Uint8Array(value);
  if (secret.byteLength < 32 || secret.byteLength > 512) {
    throw new Error('The invitation secret must contain between 32 and 512 bytes.');
  }
  return secret;
}

function digestIdempotencyKey(value: string): string {
  const key = value.trim();
  if (key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/u.test(key)) {
    throw new InvitationServiceError(
      'INVALID_IDEMPOTENCY_KEY',
      'A valid idempotency key is required.',
    );
  }
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function tokenDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function normalizeInvitationToken(value: unknown): string {
  if (typeof value !== 'string' || !/^inv_[A-Za-z0-9_-]{43}$/u.test(value)) {
    throw new InvitationServiceError(
      'INVITATION_UNAVAILABLE',
      'This invitation is unavailable.',
    );
  }
  return value;
}

function dateFromClock(clock: () => Date): Date {
  const value = clock();
  if (!Number.isFinite(value.getTime())) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return value;
}

function invitationRecord(value: unknown, workspaceId?: string, invitationId?: string): InvitationRecord {
  const candidate = record(value);
  const resolvedWorkspaceId = typeof candidate?.workspaceId === 'string' ? candidate.workspaceId : workspaceId;
  const isLegacy = candidate !== null && exactKeys(candidate, legacyInvitationKeys);
  const teamIds = resolvedWorkspaceId === undefined
    ? null
    : (isLegacy ? [] : storedTeamIds(candidate?.teamIds));
  if (
    candidate === null
    || (!exactKeys(candidate, invitationKeys) && !isLegacy)
    || candidate.schemaVersion !== 1
    || !storedSafeReference(candidate.id)
    || !storedSafeReference(candidate.workspaceId)
    || (workspaceId !== undefined && candidate.workspaceId !== workspaceId)
    || (invitationId !== undefined && candidate.id !== invitationId)
    || !isNormalizedEmail(candidate.invitedEmail)
    || !storedSafeReference(candidate.inviterUserId)
    || typeof candidate.inviterDisplayName !== 'string'
    || candidate.inviterDisplayName.length === 0
    || candidate.inviterDisplayName.length > 160
    || typeof candidate.workspaceName !== 'string'
    || candidate.workspaceName.length === 0
    || candidate.workspaceName.length > 160
    || candidate.role !== 'member'
    || teamIds === null
    || (candidate.status !== 'pending'
      && candidate.status !== 'revoked'
      && candidate.status !== 'accepted')
    || !canonicalTimestamp(candidate.createdAt)
    || !canonicalTimestamp(candidate.updatedAt)
    || !canonicalTimestamp(candidate.lastSentAt)
    || !canonicalTimestamp(candidate.expiresAt)
    || !nullableTimestamp(candidate.acceptedAt)
    || (candidate.acceptedUserId !== null && !storedSafeReference(candidate.acceptedUserId))
    || !nullableTimestamp(candidate.revokedAt)
    || typeof candidate.currentTokenDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.currentTokenDigest)
    || !Number.isSafeInteger(candidate.sendCount)
    || (candidate.sendCount as number) < 1
    || (candidate.sendCount as number) > MAX_INVITATION_SENDS
    || typeof candidate.activeSeatApplied !== 'boolean'
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1
    || !timestampAtOrBefore(candidate.createdAt, candidate.lastSentAt)
    || !timestampAtOrBefore(candidate.lastSentAt, candidate.updatedAt)
    || !exactTimestampDuration(candidate.lastSentAt, candidate.expiresAt, INVITATION_DURATION_MS)
    || (candidate.sendCount === 1 && candidate.createdAt !== candidate.lastSentAt)
    || candidate.revision !== (
      candidate.status === 'pending'
        ? candidate.sendCount
        : (candidate.sendCount as number) + 1
    )
    || (candidate.status === 'pending'
      && (candidate.acceptedAt !== null
        || candidate.acceptedUserId !== null
        || candidate.revokedAt !== null
        || candidate.activeSeatApplied !== false
        || candidate.updatedAt !== candidate.lastSentAt))
    || (candidate.status === 'revoked'
      && (candidate.revokedAt === null
        || candidate.acceptedAt !== null
        || candidate.acceptedUserId !== null
        || candidate.activeSeatApplied !== false
        || candidate.revokedAt !== candidate.updatedAt
        || !timestampAtOrBefore(candidate.lastSentAt, candidate.revokedAt)))
    || (candidate.status === 'accepted'
      && (candidate.acceptedAt === null
        || candidate.acceptedUserId === null
        || candidate.revokedAt !== null
        || candidate.acceptedAt !== candidate.updatedAt
        || !timestampAtOrBefore(candidate.lastSentAt, candidate.acceptedAt)
        || !timestampBefore(candidate.acceptedAt, candidate.expiresAt)))
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return clone((isLegacy ? candidate : {...candidate, teamIds}) as unknown as InvitationRecord);
}

function invitationTokenRecord(value: unknown, digest?: string): InvitationTokenRecord {
  const candidate = record(value);
  if (
    candidate === null
    || !exactKeys(candidate, tokenKeys)
    || candidate.schemaVersion !== 1
    || typeof candidate.digest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.digest)
    || (digest !== undefined && candidate.digest !== digest)
    || !storedSafeReference(candidate.workspaceId)
    || !storedSafeReference(candidate.invitationId)
    || !Number.isSafeInteger(candidate.version)
    || (candidate.version as number) < 1
    || (candidate.version as number) > MAX_INVITATION_SENDS
    || (candidate.state !== 'current'
      && candidate.state !== 'superseded'
      && candidate.state !== 'revoked'
      && candidate.state !== 'used')
    || !canonicalTimestamp(candidate.createdAt)
    || !canonicalTimestamp(candidate.expiresAt)
    || !exactTimestampDuration(candidate.createdAt, candidate.expiresAt, INVITATION_DURATION_MS)
    || typeof candidate.binding !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.binding)
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return clone(candidate as unknown as InvitationTokenRecord);
}

function assertTokenInvitationConsistency(
  token: InvitationTokenRecord,
  invitation: InvitationRecord,
  expectedBinding: string,
): void {
  const isLatest = token.digest === invitation.currentTokenDigest;
  const hasLatestVersion = token.version === invitation.sendCount;
  const hasLatestExpiry = token.expiresAt === invitation.expiresAt;
  const hasLatestCreation = token.createdAt === invitation.lastSentAt;
  const consistent = equalSha256(token.binding, expectedBinding)
    && token.workspaceId === invitation.workspaceId
    && token.invitationId === invitation.id
    && (
      (token.state === 'current'
        && invitation.status === 'pending'
        && isLatest
        && hasLatestVersion
        && hasLatestExpiry
        && hasLatestCreation)
      || (token.state === 'revoked'
        && invitation.status === 'revoked'
        && isLatest
        && hasLatestVersion
        && hasLatestExpiry
        && hasLatestCreation)
      || (token.state === 'used'
        && invitation.status === 'accepted'
        && isLatest
        && hasLatestVersion
        && hasLatestExpiry
        && hasLatestCreation)
      || (token.state === 'superseded'
        && !isLatest
        && token.version < invitation.sendCount)
    );
  if (!consistent) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
}

function assertMutationTime(
  now: string,
  ...priorTimestamps: Array<string | null | undefined>
): void {
  if (
    !canonicalTimestamp(now)
    || priorTimestamps.some((timestamp) => (
      timestamp !== null
      && timestamp !== undefined
      && !timestampAtOrBefore(timestamp, now)
    ))
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
}

function idempotencyRecord(
  value: unknown,
  expected: Pick<InvitationIdempotencyRecord,
    'id' | 'workspaceId' | 'operation'>,
): InvitationIdempotencyRecord {
  const candidate = record(value);
  const outcomes: readonly InvitationIdempotencyRecord['outcome'][] = [
    'accepted',
    'email_mismatch',
    'expired',
    'revoked',
    'superseded',
    'already_accepted',
    'completed',
  ];
  if (
    candidate === null
    || !exactKeys(candidate, idempotencyKeys)
    || candidate.schemaVersion !== 1
    || candidate.id !== expected.id
    || candidate.workspaceId !== expected.workspaceId
    || !/^idem_[a-f0-9]{32}$/u.test(expected.id)
    || !['create', 'resend', 'revoke', 'accept'].includes(String(candidate.operation))
    || candidate.operation !== expected.operation
    || typeof candidate.requestReference !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.requestReference)
    || !storedSafeReference(candidate.invitationId)
    || (candidate.tokenDigest !== null
      && (typeof candidate.tokenDigest !== 'string'
        || !/^[a-f0-9]{64}$/u.test(candidate.tokenDigest)))
    || !outcomes.includes(candidate.outcome as InvitationIdempotencyRecord['outcome'])
    || ((candidate.operation === 'create' || candidate.operation === 'resend')
      && (candidate.outcome !== 'completed' || candidate.tokenDigest === null))
    || (candidate.operation === 'revoke'
      && (candidate.outcome !== 'completed' || candidate.tokenDigest !== null))
    || (candidate.operation === 'accept'
      && (candidate.outcome === 'completed' || candidate.tokenDigest === null))
    || !canonicalTimestamp(candidate.createdAt)
    || typeof candidate.binding !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.binding)
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return clone(candidate as unknown as InvitationIdempotencyRecord);
}

function assertAcceptanceReplayConsistency(input: {
  idempotency: InvitationIdempotencyRecord;
  token: InvitationTokenRecord;
  invitation: InvitationRecord;
  membership: InvitationMembershipRecord | null;
  userId: string;
  email: string;
}): void {
  const { idempotency, token, invitation, membership, userId, email } = input;
  const replayedAt = idempotency.createdAt;
  const beforeCurrentTransition = (
    token.state === 'current'
      ? invitation.status === 'pending'
      : token.state === 'superseded'
        ? token.version < invitation.sendCount
          && timestampAtOrBefore(replayedAt, invitation.lastSentAt)
        : token.state === 'revoked'
          ? invitation.revokedAt !== null
            && timestampAtOrBefore(replayedAt, invitation.revokedAt)
          : invitation.acceptedAt !== null
            && timestampAtOrBefore(replayedAt, invitation.acceptedAt)
  );
  const chronologyValid = timestampAtOrBefore(token.createdAt, replayedAt);
  let consistent = false;

  if (chronologyValid) {
    switch (idempotency.outcome) {
      case 'accepted': {
        const membershipLifecycleValid = membership !== null
          && membership.status === 'active'
          && timestampAtOrBefore(membership.createdAt, replayedAt)
          && (
            invitation.activeSeatApplied === false
            || membership.updatedAt === replayedAt
          );
        consistent = token.state === 'used'
          && invitation.status === 'accepted'
          && invitation.acceptedAt === replayedAt
          && invitation.updatedAt === replayedAt
          && invitation.acceptedUserId === userId
          && invitation.invitedEmail === email
          && membershipLifecycleValid;
        break;
      }
      case 'email_mismatch':
        consistent = invitation.invitedEmail !== email
          && timestampBefore(replayedAt, token.expiresAt)
          && beforeCurrentTransition;
        break;
      case 'expired':
        consistent = timestampAtOrBefore(token.expiresAt, replayedAt)
          && beforeCurrentTransition;
        break;
      case 'revoked':
        consistent = token.state === 'revoked'
          && invitation.status === 'revoked'
          && invitation.revokedAt !== null
          && timestampAtOrBefore(invitation.revokedAt, replayedAt);
        break;
      case 'superseded':
        consistent = token.state === 'superseded'
          && token.version < invitation.sendCount;
        break;
      case 'already_accepted':
        consistent = token.state === 'used'
          && invitation.status === 'accepted'
          && invitation.acceptedAt !== null
          && timestampAtOrBefore(invitation.acceptedAt, replayedAt);
        break;
      case 'completed':
        consistent = false;
        break;
    }
  }

  if (!consistent) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
}

function workspaceRecord(value: unknown, expectedWorkspaceId: string): InvitationWorkspaceRecord {
  const candidate = record(value);
  if (
    candidate === null
    || !exactKeys(candidate, workspaceKeys)
    || candidate.schemaVersion !== 1
    || candidate.id !== expectedWorkspaceId
    || candidate.workspaceId !== expectedWorkspaceId
    || typeof candidate.name !== 'string'
    || candidate.name.length === 0
    || candidate.name.length > 160
    || !storedSafeReference(candidate.ownerUid)
    || candidate.authority !== 'firebase-hosted'
    || !canonicalTimestamp(candidate.createdAt)
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return {
    schemaVersion: 1,
    id: expectedWorkspaceId,
    workspaceId: expectedWorkspaceId,
    name: candidate.name,
    ownerUid: candidate.ownerUid,
    authority: 'firebase-hosted',
    createdAt: candidate.createdAt,
    revision: candidate.revision as number,
  };
}

function hostedUserRecord(value: unknown, expectedUserId: string): InvitationHostedUserRecord {
  const candidate = record(value);
  const expectedKeys = [
    'schemaVersion',
    'uid',
    'email',
    'displayName',
    'authProvider',
    'updatedAt',
  ] as const;
  if (
    candidate === null
    || !exactKeys(candidate, expectedKeys)
    || candidate.schemaVersion !== 1
    || candidate.uid !== expectedUserId
    || !isNormalizedEmail(candidate.email)
    || (candidate.displayName !== null
      && (typeof candidate.displayName !== 'string' || candidate.displayName.length > 160))
    || candidate.authProvider !== 'google.com'
    || !canonicalTimestamp(candidate.updatedAt)
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return {
    schemaVersion: 1,
    uid: expectedUserId,
    email: candidate.email,
    updatedAt: candidate.updatedAt,
  };
}

function membershipRecord(
  value: unknown,
  workspaceId: string,
  userId: string,
): InvitationMembershipRecord | null {
  if (value === null) return null;
  const candidate = record(value);
  const allowed = new Set([
    'schemaVersion',
    'id',
    'workspaceId',
    'userId',
    'role',
    'status',
    'createdAt',
    'updatedAt',
    'removedAt',
    'revision',
  ]);
  if (
    candidate === null
    || Object.keys(candidate).some((key) => !allowed.has(key))
    || candidate.schemaVersion !== 1
    || !storedSafeReference(candidate.id)
    || candidate.workspaceId !== workspaceId
    || candidate.userId !== userId
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (candidate.status !== 'active' && candidate.status !== 'removed')
    || !canonicalTimestamp(candidate.createdAt)
    || (candidate.updatedAt !== undefined && !canonicalTimestamp(candidate.updatedAt))
    || (candidate.removedAt !== undefined && !nullableTimestamp(candidate.removedAt))
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1
    || (candidate.updatedAt !== undefined
      && !timestampAtOrBefore(candidate.createdAt, candidate.updatedAt))
    || (candidate.status === 'active' && typeof candidate.removedAt === 'string')
    || (candidate.status === 'removed'
      && (typeof candidate.removedAt !== 'string'
        || candidate.updatedAt !== candidate.removedAt))
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  const membership: InvitationMembershipRecord = {
    schemaVersion: 1,
    id: candidate.id,
    workspaceId,
    userId,
    role: candidate.role,
    status: candidate.status,
    createdAt: candidate.createdAt,
    revision: candidate.revision as number,
  };
  if (typeof candidate.updatedAt === 'string') membership.updatedAt = candidate.updatedAt;
  if (candidate.removedAt === null || typeof candidate.removedAt === 'string') {
    membership.removedAt = candidate.removedAt;
  }
  return membership;
}

function entitlementRecord(
  value: unknown,
  expectedWorkspaceId: string,
): InvitationEntitlementRecord {
  const candidate = record(value);
  if (
    candidate === null
    || !exactKeys(candidate, entitlementKeys)
    || candidate.schemaVersion !== 1
    || !storedSafeReference(candidate.id)
    || candidate.workspaceId !== expectedWorkspaceId
    || !storedSafeReference(candidate.plan)
    || !storedSafeReference(candidate.status)
    || !canonicalTimestamp(candidate.trialStartedAt)
    || !canonicalTimestamp(candidate.trialEndsAt)
    || !exactTimestampDuration(
      candidate.trialStartedAt,
      candidate.trialEndsAt,
      PRO_TRIAL_DURATION_MS,
    )
    || !storedSafeReference(candidate.source)
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return clone(candidate as unknown as InvitationEntitlementRecord);
}

function requireActiveWorkspaceOwner(
  workspace: InvitationWorkspaceRecord,
  value: unknown,
  userId: string,
): InvitationMembershipRecord {
  const membership = membershipRecord(value, workspace.workspaceId, userId);
  if (membership === null) {
    throw new WorkspaceAuthorizationError('WORKSPACE_ACCESS_DENIED', 'membership_missing');
  }
  if (membership.status !== 'active') {
    throw new WorkspaceAuthorizationError('WORKSPACE_ACCESS_DENIED', 'membership_inactive');
  }
  if (membership.role !== 'owner' || workspace.ownerUid !== userId) {
    throw new WorkspaceAuthorizationError('WORKSPACE_ACCESS_DENIED', 'role_forbidden');
  }
  if (membership.createdAt !== workspace.createdAt) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return membership;
}

function assertBootstrapLifecycle(
  workspace: InvitationWorkspaceRecord,
  entitlement: InvitationEntitlementRecord,
  owner: InvitationMembershipRecord,
  hostedUser?: InvitationHostedUserRecord,
): void {
  if (
    owner.createdAt !== workspace.createdAt
    || entitlement.trialStartedAt !== workspace.createdAt
    || (hostedUser !== undefined
      && !timestampAtOrBefore(workspace.createdAt, hostedUser.updatedAt))
  ) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
}

function eligibleTrial(value: InvitationEntitlementRecord, now: Date): boolean {
  return value.plan === 'pro'
    && value.status === 'active'
    && Date.parse(value.trialStartedAt) <= now.getTime()
    && now.getTime() < Date.parse(value.trialEndsAt);
}

function viewState(invitation: InvitationRecord, now: Date): InvitationViewState {
  if (invitation.status !== 'pending') return invitation.status;
  return now.getTime() >= Date.parse(invitation.expiresAt) ? 'expired' : 'pending';
}

function ownerView(invitation: InvitationRecord, now: Date): InvitationOwnerView {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    invitedEmail: invitation.invitedEmail,
    inviterDisplayName: invitation.inviterDisplayName,
    workspaceName: invitation.workspaceName,
    role: 'member',
    ...((invitation.teamIds?.length ?? 0) === 0 ? {} : {teamIds: [...(invitation.teamIds ?? [])]}),
    state: viewState(invitation, now),
    createdAt: invitation.createdAt,
    lastSentAt: invitation.lastSentAt,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
    sendCount: invitation.sendCount,
    activeSeatApplied: invitation.activeSeatApplied,
    revision: invitation.revision,
  };
}

export function trustedInvitationOwnerView(
  value: unknown,
  workspaceId: string,
  trustedNow: string,
): InvitationOwnerView {
  const now = new Date(trustedNow);
  if (!canonicalTimestamp(trustedNow) || !Number.isFinite(now.getTime())) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  const invitation = invitationRecord(value, workspaceId);
  if (Date.parse(invitation.createdAt) > now.getTime()
    || Date.parse(invitation.updatedAt) > now.getTime()
    || Date.parse(invitation.lastSentAt) > now.getTime()
    || (invitation.acceptedAt !== null && Date.parse(invitation.acceptedAt) > now.getTime())
    || (invitation.revokedAt !== null && Date.parse(invitation.revokedAt) > now.getTime())) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return ownerView(invitation, now);
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function auditChange(field: string, before: unknown, after: unknown) {
  return {
    field,
    beforeSha256: before === null ? null : sha256(JSON.stringify(before)),
    afterSha256: after === null ? null : sha256(JSON.stringify(after)),
  };
}

function actorForPrincipal(principal: WorkspacePrincipal): HostedProductEvent['actor'] {
  if (principal.kind === 'user') {
    return { kind: 'user', id: `user:${safeReference(principal.userId, 'userId')}` };
  }
  if (!isOpaquePersonalTokenReference(principal.tokenReference)) {
    throw new InvitationServiceError(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
    );
  }
  return { kind: 'personal_token', id: `patref:${principal.tokenReference}` };
}

function invitationSentEvidence(input: {
  invitation: InvitationRecord;
  before: InvitationRecord | null;
  actor: HostedProductEvent['actor'];
  source: 'web' | 'rest' | 'mcp';
  requestId: string;
  now: string;
  eligibleTrialWorkspace: boolean;
  opaqueId: string;
}): {event: HostedProductEvent; audit: HostedMutationAuditRecord} {
  const opaqueId = safeReference(input.opaqueId.replaceAll('-', ''), 'opaqueId');
  const auditId = `audit:invitation:${opaqueId}`;
  const event: HostedProductEvent = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `event:invitation:${opaqueId}`,
    name: 'invitation.sent',
    source: input.source,
    occurredAt: input.now,
    receivedAt: input.now,
    workspaceId: input.invitation.workspaceId,
    actor: input.actor,
    requestId: input.requestId,
    correlationId: input.requestId,
    attributes: {
      invitationId: input.invitation.id,
      eligibleTrialWorkspace: input.eligibleTrialWorkspace,
      auditId,
    },
  };
  const audit: HostedMutationAuditRecord = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: auditId,
    workspaceId: input.invitation.workspaceId,
    actor: input.actor,
    source: input.source,
    occurredAt: input.now,
    requestId: input.requestId,
    entity: {
      type: 'invitation',
      id: input.invitation.id,
      revisionBefore: input.before?.revision ?? null,
      revisionAfter: input.invitation.revision,
    },
    action: 'invitation.send',
    result: 'succeeded',
    changes: [
      auditChange('status', input.before?.status ?? null, input.invitation.status),
      auditChange('sendCount', input.before?.sendCount ?? null, input.invitation.sendCount),
      auditChange('expiresAt', input.before?.expiresAt ?? null, input.invitation.expiresAt),
    ],
  };
  assertHostedProductEvent(event);
  assertHostedMutationAuditRecord(audit);
  return { event, audit };
}

function invitationRevokedAudit(input: {
  before: InvitationRecord;
  after: InvitationRecord;
  actor: HostedProductEvent['actor'];
  source: 'web' | 'rest' | 'mcp';
  requestId: string;
  now: string;
  opaqueId: string;
}): HostedMutationAuditRecord {
  const opaqueId = safeReference(input.opaqueId.replaceAll('-', ''), 'opaqueId');
  const audit: HostedMutationAuditRecord = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `audit:invitation:${opaqueId}`,
    workspaceId: input.after.workspaceId,
    actor: input.actor,
    source: input.source,
    occurredAt: input.now,
    requestId: input.requestId,
    entity: {
      type: 'invitation',
      id: input.after.id,
      revisionBefore: input.before.revision,
      revisionAfter: input.after.revision,
    },
    action: 'invitation.revoke',
    result: 'succeeded',
    changes: [
      auditChange('status', input.before.status, input.after.status),
      auditChange('revokedAt', input.before.revokedAt, input.after.revokedAt),
    ],
  };
  assertHostedMutationAuditRecord(audit);
  return audit;
}

function membershipAcceptanceEvidence(input: {
  invitation: InvitationRecord;
  actorUserId: string;
  requestId: string;
  now: string;
  emailMatched: boolean;
  validInvitation: boolean;
  firstAcceptance: boolean;
  succeeded: boolean;
  revisionBefore: number;
  revisionAfter: number;
  activeSeatAdded: boolean;
  opaqueId: string;
}): {event: HostedProductEvent; audit: HostedMutationAuditRecord} {
  const opaqueId = safeReference(input.opaqueId.replaceAll('-', ''), 'opaqueId');
  const actorId = `user:${safeReference(input.actorUserId, 'userId')}`;
  const auditId = `audit:acceptance:${opaqueId}`;
  const event: HostedProductEvent = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `event:acceptance:${opaqueId}`,
    name: 'membership.accepted',
    source: 'web',
    occurredAt: input.now,
    receivedAt: input.now,
    workspaceId: input.invitation.workspaceId,
    actor: { kind: 'user', id: actorId },
    requestId: input.requestId,
    correlationId: input.requestId,
    attributes: {
      invitationId: input.invitation.id,
      memberUserId: actorId,
      emailMatched: input.emailMatched,
      validInvitation: input.validInvitation,
      firstAcceptance: input.firstAcceptance,
      auditId,
    },
  };
  const audit: HostedMutationAuditRecord = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: auditId,
    workspaceId: input.invitation.workspaceId,
    actor: { kind: 'user', id: actorId },
    source: 'web',
    occurredAt: input.now,
    requestId: input.requestId,
    entity: {
      type: 'invitation',
      id: input.invitation.id,
      revisionBefore: input.revisionBefore,
      revisionAfter: input.revisionAfter,
    },
    action: 'membership.accept',
    result: input.succeeded ? 'succeeded' : 'denied',
    changes: input.succeeded ? [
      auditChange('status', 'pending', 'accepted'),
      auditChange('activeSeatApplied', false, input.activeSeatAdded),
    ] : [],
  };
  assertHostedProductEvent(event);
  assertHostedMutationAuditRecord(audit);
  return { event, audit };
}

const paths = {
  workspace: (workspaceId: string) => `workspaces/${workspaceId}`,
  entitlement: (workspaceId: string) => `workspaces/${workspaceId}/entitlements/current`,
  invitations: (workspaceId: string) => `workspaces/${workspaceId}/invitations`,
  invitation: (workspaceId: string, invitationId: string) => (
    `workspaces/${workspaceId}/invitations/${invitationId}`
  ),
  token: (digest: string) => `_invitationTokens/${digest}`,
  membership: (workspaceId: string, userId: string) => (
    `workspaces/${workspaceId}/memberships/${userId}`
  ),
  team: (workspaceId: string, teamId: string) => `workspaces/${workspaceId}/teams/${teamId}`,
  teamMembership: (workspaceId: string, teamId: string, userId: string) => (
    `workspaces/${workspaceId}/teamMemberships/${teamId}--${userId}`
  ),
  hostedUser: (userId: string) => `hostedUsers/${userId}`,
  idempotency: (workspaceId: string, id: string) => (
    `workspaces/${workspaceId}/invitationIdempotency/${id}`
  ),
  event: (workspaceId: string, eventId: string) => (
    `workspaces/${workspaceId}/productEvents/${eventId}`
  ),
  audit: (workspaceId: string, auditId: string) => (
    `workspaces/${workspaceId}/mutationAudits/${auditId}`
  ),
};

function createEvidence(
  transaction: InvitationTransaction,
  evidence: {event: HostedProductEvent; audit: HostedMutationAuditRecord},
): void {
  transaction.create(paths.event(evidence.event.workspaceId, evidence.event.id), { ...evidence.event });
  transaction.create(paths.audit(evidence.audit.workspaceId, evidence.audit.id), { ...evidence.audit });
}

function createAudit(transaction: InvitationTransaction, audit: HostedMutationAuditRecord): void {
  transaction.create(paths.audit(audit.workspaceId, audit.id), { ...audit });
}

export class InvitationService {
  readonly #repository: InvitationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: Uint8Array;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  readonly #seatReconciler: BillingSeatReconciler;

  constructor(
    repository: InvitationRepository,
    authorization: WorkspaceAuthorizationService,
    options: InvitationServiceOptions,
  ) {
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = validSecret(options.secret);
    this.#entitlementPolicy = options.entitlementPolicy;
    this.#seatReconciler = options.seatReconciler;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  #hmac(label: string): string {
    return createHmac('sha256', this.#secret).update(label, 'utf8').digest('hex');
  }

  #opaqueId(prefix: string, label: string): string {
    return `${prefix}_${this.#hmac(label).slice(0, 32)}`;
  }

  #rawToken(label: string): string {
    const value = createHmac('sha256', this.#secret).update(`token:${label}`, 'utf8').digest('base64url');
    return `inv_${value}`;
  }

  #requestReference(label: string): string {
    return this.#hmac(`request:${label}`);
  }

  #idempotencyRecordBinding(
    idempotency: Omit<InvitationIdempotencyRecord, 'binding'>,
  ): string {
    return this.#hmac(`idempotency-record:v1:${JSON.stringify([
      idempotency.schemaVersion,
      idempotency.id,
      idempotency.workspaceId,
      idempotency.operation,
      idempotency.requestReference,
      idempotency.invitationId,
      idempotency.tokenDigest,
      idempotency.outcome,
      idempotency.createdAt,
    ])}`);
  }

  #boundIdempotencyRecord(
    idempotency: Omit<InvitationIdempotencyRecord, 'binding'>,
  ): InvitationIdempotencyRecord {
    return {
      ...idempotency,
      binding: this.#idempotencyRecordBinding(idempotency),
    };
  }

  #trustedIdempotencyRecord(
    value: unknown,
    expected: Pick<InvitationIdempotencyRecord, 'id' | 'workspaceId' | 'operation'>,
  ): InvitationIdempotencyRecord {
    const idempotency = idempotencyRecord(value, expected);
    const { binding, ...unsigned } = idempotency;
    if (!equalSha256(binding, this.#idempotencyRecordBinding(unsigned))) {
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
    return idempotency;
  }

  #tokenRecordBinding(token: Pick<InvitationTokenRecord,
    'digest' | 'workspaceId' | 'invitationId' | 'version' | 'createdAt' | 'expiresAt'>): string {
    return this.#hmac(`token-record:v1:${JSON.stringify([
      token.digest,
      token.workspaceId,
      token.invitationId,
      token.version,
      token.createdAt,
      token.expiresAt,
    ])}`);
  }

  #currentTokenRecord(token: Pick<InvitationTokenRecord,
    'digest' | 'workspaceId' | 'invitationId' | 'version' | 'createdAt' | 'expiresAt'>): InvitationTokenRecord {
    return {
      schemaVersion: 1,
      ...token,
      state: 'current',
      binding: this.#tokenRecordBinding(token),
    };
  }

  #assertTokenInvitationConsistency(
    token: InvitationTokenRecord,
    invitation: InvitationRecord,
  ): void {
    assertTokenInvitationConsistency(token, invitation, this.#tokenRecordBinding(token));
  }

  async #authorizeOwner(
    context: Pick<OwnerCommandContext, 'principal' | 'workspaceId' | 'requestId'>,
    targetEntityId: string,
  ): Promise<WorkspaceAuthorizationGrant> {
    return this.#authorization.authorize({
      principal: context.principal,
      workspaceId: context.workspaceId,
      action: 'invitation.manage',
      targetEntityType: 'invitation',
      targetEntityId,
      requestId: context.requestId,
    });
  }

  async #assertEntitled(
    transaction: InvitationTransaction,
    principal: WorkspacePrincipal,
    grant: WorkspaceAuthorizationGrant,
    operation: Extract<EntitledMutationOperation, 'invitation.create' | 'invitation.resend' | 'invitation.revoke' | 'invitation.accept'>,
    now: string,
  ): Promise<void> {
    try {
      await this.#entitlementPolicy.assertMutation({
        transaction,
        workspaceId: grant.workspaceId,
        principal,
        grant,
        operation,
        now,
      });
    } catch (error) {
      if (error instanceof BillingServiceError && error.code === 'BILLING_FORBIDDEN') {
        throw new InvitationServiceError(
          'INVITATION_ENTITLEMENT_REQUIRED',
          'This workspace is on Free. Subscribe before adding or resending a member invitation.',
        );
      }
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async listOwnerInvitations(input: ListInvitationInput): Promise<InvitationOwnerView[]> {
    const workspaceId = safeWorkspaceReference(input.workspaceId);
    const requestId = safeReference(input.requestId, 'requestId', 96);
    await this.#authorizeOwner({ ...input, workspaceId, requestId }, 'invitation:list');
    const now = dateFromClock(this.#clock);
    try {
      const values = await this.#repository.runTransaction((transaction) => (
        transaction.list(
          paths.invitations(workspaceId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )
      ));
      return values.map((value) => trustedInvitationOwnerView(value, workspaceId, now.toISOString()))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof InvitationServiceError) throw error;
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async createOwnerInvitation(input: CreateInvitationInput): Promise<InvitationMutationResult> {
    const workspaceId = safeWorkspaceReference(input.workspaceId);
    const requestId = safeReference(input.requestId, 'requestId', 96);
    const invitedEmail = normalizeEmail(input.invitedEmail);
    const teamIds = normalizeTeamIds(input.teamIds);
    if (input.inviterEmail !== undefined && normalizeEmail(input.inviterEmail) === invitedEmail) {
      throw new InvitationServiceError(
        'INVALID_INVITATION_REQUEST',
        'Invite a different Google account.',
      );
    }
    const inviterUserId = safeReference(input.principal.userId, 'userId');
    const grant = await this.#authorizeOwner({ ...input, workspaceId, requestId }, 'invitation:create');
    const idempotencyDigest = digestIdempotencyKey(input.idempotencyKey);
    const teamReference = input.teamIds === undefined ? '' : `:${teamIds.join(',')}`;
    const requestReference = this.#requestReference(
      `create:${workspaceId}:${inviterUserId}:${invitedEmail}${teamReference}:${idempotencyDigest}`,
    );
    const idempotencyId = this.#opaqueId('idem', `create:${workspaceId}:${idempotencyDigest}`);
    const invitationId = this.#opaqueId('invite', `create:${workspaceId}:${requestReference}`);
    const rawToken = this.#rawToken(`create:${workspaceId}:${invitationId}:${idempotencyDigest}`);
    const digest = tokenDigest(rawToken);
    const actor = actorForPrincipal(input.principal);

    try {
      const result = await this.#repository.runTransaction(async (transaction) => {
        const [
          rawWorkspace,
          rawEntitlement,
          rawInviter,
          rawOwnerMembership,
          rawIdempotency,
          rawInvitation,
          rawTokenRecord,
        ] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)),
          transaction.get(paths.entitlement(workspaceId)),
          transaction.get(paths.hostedUser(inviterUserId)),
          transaction.get(paths.membership(workspaceId, inviterUserId)),
          transaction.get(paths.idempotency(workspaceId, idempotencyId)),
          transaction.get(paths.invitation(workspaceId, invitationId)),
          transaction.get(paths.token(digest)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const entitlement = entitlementRecord(rawEntitlement, workspaceId);
        const trustedInviter = hostedUserRecord(rawInviter, inviterUserId);
        const ownerMembership = requireActiveWorkspaceOwner(
          workspace,
          rawOwnerMembership,
          inviterUserId,
        );
        assertBootstrapLifecycle(workspace, entitlement, ownerMembership, trustedInviter);
        const nowDate = dateFromClock(this.#clock);
        const now = nowDate.toISOString();
        assertMutationTime(
          now,
          workspace.createdAt,
          trustedInviter.updatedAt,
          ownerMembership.createdAt,
          ownerMembership.updatedAt,
          ownerMembership.removedAt,
          entitlement.trialStartedAt,
        );
        if (trustedInviter.email === invitedEmail) {
          throw new InvitationServiceError(
            'INVALID_INVITATION_REQUEST',
            'Invite a different Google account.',
          );
        }
        if (rawIdempotency !== null) {
          const idempotency = this.#trustedIdempotencyRecord(rawIdempotency, {
            id: idempotencyId,
            workspaceId,
            operation: 'create',
          });
          if (
            idempotency.operation !== 'create'
            || idempotency.outcome !== 'completed'
            || idempotency.requestReference !== requestReference
            || idempotency.invitationId !== invitationId
            || idempotency.tokenDigest !== digest
          ) {
            throw new InvitationServiceError('INVITATION_CONFLICT', 'The idempotency key is already in use.');
          }
          const existing = invitationRecord(rawInvitation, workspaceId, invitationId);
          const existingToken = invitationTokenRecord(rawTokenRecord, digest);
          this.#assertTokenInvitationConsistency(existingToken, existing);
          if (idempotency.createdAt !== existing.createdAt) {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          assertMutationTime(
            now,
            idempotency.createdAt,
            existing.createdAt,
            existing.updatedAt,
            existingToken.createdAt,
          );
          return {
            changed: false,
            invitation: existing,
            shareToken: existing.status === 'pending' && existing.currentTokenDigest === digest
              ? rawToken
              : null,
          };
        }
        if (rawInvitation !== null || rawTokenRecord !== null) {
          throw new InvitationServiceError(
            'INVITATION_SERVICE_UNAVAILABLE',
            'Invitation service is temporarily unavailable.',
          );
        }
        if (input.teamIds !== undefined) {
          for (const teamId of teamIds) {
            const rawTeam = await transaction.get(paths.team(workspaceId, teamId));
            if (rawTeam === null && teamId === defaultHostedTeamId(workspaceId)) continue;
            trustedHostedTeamRecord(rawTeam, workspaceId, teamId);
          }
        }
        await this.#assertEntitled(transaction, input.principal, grant, 'invitation.create', now);
        const expiresAt = new Date(nowDate.getTime() + INVITATION_DURATION_MS).toISOString();
        const invitation: InvitationRecord = {
          schemaVersion: 1,
          id: invitationId,
          workspaceId,
          invitedEmail,
          inviterUserId,
          inviterDisplayName: displayName(input.inviterDisplayName),
          workspaceName: workspace.name,
          role: 'member',
          ...(input.teamIds === undefined ? {} : {teamIds}),
          status: 'pending',
          createdAt: now,
          updatedAt: now,
          lastSentAt: now,
          expiresAt,
          acceptedAt: null,
          acceptedUserId: null,
          revokedAt: null,
          currentTokenDigest: digest,
          sendCount: 1,
          activeSeatApplied: false,
          revision: 1,
        };
        const token = this.#currentTokenRecord({
          digest,
          workspaceId,
          invitationId,
          version: 1,
          createdAt: now,
          expiresAt,
        });
        const idempotency = this.#boundIdempotencyRecord({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId,
          operation: 'create',
          requestReference,
          invitationId,
          tokenDigest: digest,
          outcome: 'completed',
          createdAt: now,
        });
        const evidence = invitationSentEvidence({
          invitation,
          before: null,
          actor,
          source: input.principal.source,
          requestId,
          now,
          eligibleTrialWorkspace: eligibleTrial(entitlement, nowDate),
          opaqueId: this.#idFactory(),
        });
        transaction.create(paths.invitation(workspaceId, invitationId), { ...invitation });
        transaction.create(paths.token(digest), { ...token });
        transaction.create(paths.idempotency(workspaceId, idempotencyId), { ...idempotency });
        createEvidence(transaction, evidence);
        return { changed: true, invitation, shareToken: rawToken };
      });
      return {
        changed: result.changed,
        invitation: ownerView(result.invitation, dateFromClock(this.#clock)),
        shareToken: result.shareToken,
      };
    } catch (error) {
      if (error instanceof InvitationServiceError || error instanceof WorkspaceAuthorizationError) {
        throw error;
      }
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async resendOwnerInvitation(input: OwnerInvitationCommandInput): Promise<InvitationMutationResult> {
    const workspaceId = safeWorkspaceReference(input.workspaceId);
    const invitationId = safeReference(input.invitationId, 'invitationId');
    const requestId = safeReference(input.requestId, 'requestId', 96);
    const ownerUserId = safeReference(input.principal.userId, 'userId');
    const grant = await this.#authorizeOwner({ ...input, workspaceId, requestId }, invitationId);
    const idempotencyDigest = digestIdempotencyKey(input.idempotencyKey);
    const idempotencyId = this.#opaqueId('idem', `resend:${workspaceId}:${idempotencyDigest}`);
    const requestReference = this.#requestReference(
      `resend:${workspaceId}:${invitationId}:${ownerUserId}:${idempotencyDigest}`,
    );
    const rawToken = this.#rawToken(`resend:${workspaceId}:${invitationId}:${idempotencyDigest}`);
    const digest = tokenDigest(rawToken);
    const actor = actorForPrincipal(input.principal);

    try {
      const result = await this.#repository.runTransaction(async (transaction) => {
        const [
          rawWorkspace,
          rawOwnerMembership,
          rawIdempotency,
          rawInvitation,
          rawEntitlement,
          rawExpectedToken,
        ] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)),
          transaction.get(paths.membership(workspaceId, ownerUserId)),
          transaction.get(paths.idempotency(workspaceId, idempotencyId)),
          transaction.get(paths.invitation(workspaceId, invitationId)),
          transaction.get(paths.entitlement(workspaceId)),
          transaction.get(paths.token(digest)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const ownerMembership = requireActiveWorkspaceOwner(
          workspace,
          rawOwnerMembership,
          ownerUserId,
        );
        const entitlement = entitlementRecord(rawEntitlement, workspaceId);
        assertBootstrapLifecycle(workspace, entitlement, ownerMembership);
        if (rawInvitation === null) {
          throw new InvitationServiceError('INVITATION_NOT_FOUND', 'Invitation not found.');
        }
        const before = invitationRecord(rawInvitation, workspaceId, invitationId);
        const nowDate = dateFromClock(this.#clock);
        const now = nowDate.toISOString();
        assertMutationTime(
          now,
          workspace.createdAt,
          ownerMembership.createdAt,
          ownerMembership.updatedAt,
          ownerMembership.removedAt,
          entitlement.trialStartedAt,
          before.updatedAt,
        );
        if (rawIdempotency !== null) {
          const idempotency = this.#trustedIdempotencyRecord(rawIdempotency, {
            id: idempotencyId,
            workspaceId,
            operation: 'resend',
          });
          if (
            idempotency.operation !== 'resend'
            || idempotency.outcome !== 'completed'
            || idempotency.requestReference !== requestReference
            || idempotency.invitationId !== invitationId
            || idempotency.tokenDigest !== digest
          ) {
            throw new InvitationServiceError('INVITATION_CONFLICT', 'The idempotency key is already in use.');
          }
          const expectedToken = invitationTokenRecord(rawExpectedToken, digest);
          this.#assertTokenInvitationConsistency(expectedToken, before);
          if (idempotency.createdAt !== expectedToken.createdAt) {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          assertMutationTime(now, idempotency.createdAt, expectedToken.createdAt);
          return {
            changed: false,
            invitation: before,
            shareToken: before.status === 'pending' && before.currentTokenDigest === digest
              ? rawToken
              : null,
          };
        }
        if (before.status !== 'pending') {
          throw new InvitationServiceError('INVITATION_FINALIZED', 'A finalized invitation cannot be resent.');
        }
        if (before.sendCount >= MAX_INVITATION_SENDS) {
          throw new InvitationServiceError('INVITATION_SEND_LIMIT', 'The invitation send limit was reached.');
        }
        if (rawExpectedToken !== null) {
          throw new InvitationServiceError(
            'INVITATION_SERVICE_UNAVAILABLE',
            'Invitation service is temporarily unavailable.',
          );
        }
        await this.#assertEntitled(transaction, input.principal, grant, 'invitation.resend', now);
        const rawCurrentToken = await transaction.get(paths.token(before.currentTokenDigest));
        const currentToken = invitationTokenRecord(rawCurrentToken, before.currentTokenDigest);
        this.#assertTokenInvitationConsistency(currentToken, before);
        const expiresAt = new Date(nowDate.getTime() + INVITATION_DURATION_MS).toISOString();
        const invitation: InvitationRecord = {
          ...before,
          updatedAt: now,
          lastSentAt: now,
          expiresAt,
          currentTokenDigest: digest,
          sendCount: before.sendCount + 1,
          revision: before.revision + 1,
        };
        const superseded: InvitationTokenRecord = { ...currentToken, state: 'superseded' };
        const token = this.#currentTokenRecord({
          digest,
          workspaceId,
          invitationId,
          version: invitation.sendCount,
          createdAt: now,
          expiresAt,
        });
        const idempotency = this.#boundIdempotencyRecord({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId,
          operation: 'resend',
          requestReference,
          invitationId,
          tokenDigest: digest,
          outcome: 'completed',
          createdAt: now,
        });
        const evidence = invitationSentEvidence({
          invitation,
          before,
          actor,
          source: input.principal.source,
          requestId,
          now,
          eligibleTrialWorkspace: eligibleTrial(entitlement, nowDate),
          opaqueId: this.#idFactory(),
        });
        transaction.set(paths.token(currentToken.digest), { ...superseded });
        transaction.create(paths.token(digest), { ...token });
        transaction.set(paths.invitation(workspaceId, invitationId), { ...invitation });
        transaction.create(paths.idempotency(workspaceId, idempotencyId), { ...idempotency });
        createEvidence(transaction, evidence);
        return { changed: true, invitation, shareToken: rawToken };
      });
      return {
        changed: result.changed,
        invitation: ownerView(result.invitation, dateFromClock(this.#clock)),
        shareToken: result.shareToken,
      };
    } catch (error) {
      if (error instanceof InvitationServiceError || error instanceof WorkspaceAuthorizationError) {
        throw error;
      }
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async revokeOwnerInvitation(input: OwnerInvitationCommandInput): Promise<InvitationMutationResult> {
    const workspaceId = safeWorkspaceReference(input.workspaceId);
    const invitationId = safeReference(input.invitationId, 'invitationId');
    const requestId = safeReference(input.requestId, 'requestId', 96);
    const ownerUserId = safeReference(input.principal.userId, 'userId');
    const grant = await this.#authorizeOwner({ ...input, workspaceId, requestId }, invitationId);
    const idempotencyDigest = digestIdempotencyKey(input.idempotencyKey);
    const idempotencyId = this.#opaqueId('idem', `revoke:${workspaceId}:${idempotencyDigest}`);
    const requestReference = this.#requestReference(
      `revoke:${workspaceId}:${invitationId}:${ownerUserId}:${idempotencyDigest}`,
    );
    const actor = actorForPrincipal(input.principal);

    try {
      const result = await this.#repository.runTransaction(async (transaction) => {
        const [rawWorkspace, rawOwnerMembership, rawIdempotency, rawInvitation] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)),
          transaction.get(paths.membership(workspaceId, ownerUserId)),
          transaction.get(paths.idempotency(workspaceId, idempotencyId)),
          transaction.get(paths.invitation(workspaceId, invitationId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const ownerMembership = requireActiveWorkspaceOwner(
          workspace,
          rawOwnerMembership,
          ownerUserId,
        );
        if (rawInvitation === null) {
          throw new InvitationServiceError('INVITATION_NOT_FOUND', 'Invitation not found.');
        }
        const before = invitationRecord(rawInvitation, workspaceId, invitationId);
        const now = dateFromClock(this.#clock).toISOString();
        assertMutationTime(
          now,
          workspace.createdAt,
          ownerMembership.createdAt,
          ownerMembership.updatedAt,
          ownerMembership.removedAt,
          before.updatedAt,
        );
        const rawCurrentToken = await transaction.get(paths.token(before.currentTokenDigest));
        const currentToken = invitationTokenRecord(rawCurrentToken, before.currentTokenDigest);
        this.#assertTokenInvitationConsistency(currentToken, before);
        if (rawIdempotency !== null) {
          const idempotency = this.#trustedIdempotencyRecord(rawIdempotency, {
            id: idempotencyId,
            workspaceId,
            operation: 'revoke',
          });
          if (
            idempotency.operation !== 'revoke'
            || idempotency.outcome !== 'completed'
            || idempotency.requestReference !== requestReference
            || idempotency.invitationId !== invitationId
          ) {
            throw new InvitationServiceError('INVITATION_CONFLICT', 'The idempotency key is already in use.');
          }
          if (idempotency.createdAt !== before.updatedAt) {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          assertMutationTime(now, idempotency.createdAt, currentToken.createdAt);
          return { changed: false, invitation: before, shareToken: null };
        }
        await this.#assertEntitled(transaction, input.principal, grant, 'invitation.revoke', now);
        if (before.status === 'accepted') {
          throw new InvitationServiceError('INVITATION_FINALIZED', 'An accepted invitation cannot be revoked.');
        }
        if (before.status === 'revoked') {
          return { changed: false, invitation: before, shareToken: null };
        }
        const invitation: InvitationRecord = {
          ...before,
          status: 'revoked',
          updatedAt: now,
          revokedAt: now,
          revision: before.revision + 1,
        };
        const token: InvitationTokenRecord = { ...currentToken, state: 'revoked' };
        const idempotency = this.#boundIdempotencyRecord({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId,
          operation: 'revoke',
          requestReference,
          invitationId,
          tokenDigest: null,
          outcome: 'completed',
          createdAt: now,
        });
        const audit = invitationRevokedAudit({
          before,
          after: invitation,
          actor,
          source: input.principal.source,
          requestId,
          now,
          opaqueId: this.#idFactory(),
        });
        transaction.set(paths.token(currentToken.digest), { ...token });
        transaction.set(paths.invitation(workspaceId, invitationId), { ...invitation });
        transaction.create(paths.idempotency(workspaceId, idempotencyId), { ...idempotency });
        createAudit(transaction, audit);
        return { changed: true, invitation, shareToken: null };
      });
      return {
        changed: result.changed,
        invitation: ownerView(result.invitation, dateFromClock(this.#clock)),
        shareToken: null,
      };
    } catch (error) {
      if (error instanceof InvitationServiceError || error instanceof WorkspaceAuthorizationError) {
        throw error;
      }
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async inspectInvitation(tokenInput: string): Promise<InvitationPreview> {
    const token = normalizeInvitationToken(tokenInput);
    const digest = tokenDigest(token);
    const now = dateFromClock(this.#clock);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const rawToken = await transaction.get(paths.token(digest));
        if (rawToken === null) {
          throw new InvitationServiceError('INVITATION_UNAVAILABLE', 'This invitation is unavailable.');
        }
        const storedToken = invitationTokenRecord(rawToken, digest);
        const rawInvitation = await transaction.get(
          paths.invitation(storedToken.workspaceId, storedToken.invitationId),
        );
        const invitation = invitationRecord(
          rawInvitation,
          storedToken.workspaceId,
          storedToken.invitationId,
        );
        this.#assertTokenInvitationConsistency(storedToken, invitation);
        let state: InvitationPreviewState;
        if (storedToken.state === 'superseded') state = 'superseded';
        else if (storedToken.state === 'revoked' || invitation.status === 'revoked') {
          if (storedToken.state !== 'revoked' || invitation.status !== 'revoked') {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          state = 'revoked';
        } else if (storedToken.state === 'used' || invitation.status === 'accepted') {
          if (storedToken.state !== 'used' || invitation.status !== 'accepted') {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          state = 'accepted';
        } else state = viewState(invitation, now);
        return {
          invitationId: invitation.id,
          workspaceId: invitation.workspaceId,
          invitedEmail: invitation.invitedEmail,
          inviterDisplayName: invitation.inviterDisplayName,
          workspaceName: invitation.workspaceName,
          role: 'member',
          state,
          expiresAt: invitation.expiresAt,
        };
      });
    } catch (error) {
      if (error instanceof InvitationServiceError) throw error;
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
  }

  async acceptInvitation(input: AcceptInvitationInput): Promise<InvitationAcceptanceResult> {
    const token = normalizeInvitationToken(input.token);
    const digest = tokenDigest(token);
    const userId = safeReference(input.identity.uid, 'userId');
    const email = normalizeEmail(input.identity.email);
    const memberDisplayName = input.identity.displayName?.trim() || null;
    if (memberDisplayName !== null && memberDisplayName.length > 160) {
      throw new InvitationServiceError('INVALID_INVITATION_REQUEST', 'The Google identity is invalid.');
    }
    const requestId = safeReference(input.requestId, 'requestId', 96);
    const idempotencyDigest = digestIdempotencyKey(input.idempotencyKey);

    let internal: InternalAcceptanceResult;
    try {
      internal = await this.#repository.runTransaction(async (transaction) => {
        const rawToken = await transaction.get(paths.token(digest));
        if (rawToken === null) {
          throw new InvitationServiceError('INVITATION_UNAVAILABLE', 'This invitation is unavailable.');
        }
        const storedToken = invitationTokenRecord(rawToken, digest);
        const rawInvitation = await transaction.get(
          paths.invitation(storedToken.workspaceId, storedToken.invitationId),
        );
        const before = invitationRecord(
          rawInvitation,
          storedToken.workspaceId,
          storedToken.invitationId,
        );
        this.#assertTokenInvitationConsistency(storedToken, before);
        const idempotencyId = this.#opaqueId(
          'idem',
          `accept:${storedToken.workspaceId}:${storedToken.invitationId}:${digest}:${userId}:${email}:${idempotencyDigest}`,
        );
        const requestReference = this.#requestReference(
          `accept:${storedToken.workspaceId}:${storedToken.invitationId}:${digest}:${userId}:${email}:${idempotencyDigest}`,
        );
        const [rawIdempotency, rawMembership] = await Promise.all([
          transaction.get(paths.idempotency(storedToken.workspaceId, idempotencyId)),
          transaction.get(paths.membership(storedToken.workspaceId, userId)),
        ]);
        const membership = membershipRecord(rawMembership, storedToken.workspaceId, userId);
        const nowDate = dateFromClock(this.#clock);
        const now = nowDate.toISOString();
        assertMutationTime(
          now,
          before.updatedAt,
          membership?.createdAt,
          membership?.updatedAt,
          membership?.removedAt,
        );
        if (rawIdempotency !== null) {
          const idempotency = this.#trustedIdempotencyRecord(rawIdempotency, {
            id: idempotencyId,
            workspaceId: storedToken.workspaceId,
            operation: 'accept',
          });
          if (
            idempotency.operation !== 'accept'
            || idempotency.outcome === 'completed'
            || idempotency.requestReference !== requestReference
            || idempotency.invitationId !== storedToken.invitationId
            || idempotency.tokenDigest !== digest
          ) {
            throw new InvitationServiceError('INVITATION_CONFLICT', 'The idempotency key is already in use.');
          }
          assertMutationTime(now, idempotency.createdAt);
          assertAcceptanceReplayConsistency({
            idempotency,
            token: storedToken,
            invitation: before,
            membership,
            userId,
            email,
          });
          return {
            outcome: idempotency.outcome as InvitationAcceptanceOutcome,
            invitation: before,
            membership,
            firstAcceptance: false,
            activeSeatAdded: false,
          };
        }
        if (
          before.status === 'accepted'
          && storedToken.state === 'used'
          && before.acceptedUserId === userId
          && before.invitedEmail === email
          && membership?.status === 'active'
        ) {
          return {
            outcome: 'accepted',
            invitation: before,
            membership,
            firstAcceptance: false,
            activeSeatAdded: false,
          };
        }

        const emailMatched = before.invitedEmail === email;
        let outcome: InvitationAcceptanceOutcome | null = null;
        if (storedToken.state === 'superseded') outcome = 'superseded';
        else if (before.status === 'revoked' || storedToken.state === 'revoked') outcome = 'revoked';
        else if (before.status === 'accepted' || storedToken.state === 'used') {
          outcome = 'already_accepted';
        } else if (nowDate.getTime() >= Date.parse(before.expiresAt)) outcome = 'expired';
        else if (!emailMatched) outcome = 'email_mismatch';

        if (outcome !== null) {
          const validInvitation = storedToken.state === 'current'
            && before.status === 'pending'
            && nowDate.getTime() < Date.parse(before.expiresAt);
          const evidence = membershipAcceptanceEvidence({
            invitation: before,
            actorUserId: userId,
            requestId,
            now,
            emailMatched,
            validInvitation,
            firstAcceptance: false,
            succeeded: false,
            revisionBefore: before.revision,
            revisionAfter: before.revision,
            activeSeatAdded: false,
            opaqueId: this.#idFactory(),
          });
          const idempotency = this.#boundIdempotencyRecord({
            schemaVersion: 1,
            id: idempotencyId,
            workspaceId: storedToken.workspaceId,
            operation: 'accept',
            requestReference,
            invitationId: storedToken.invitationId,
            tokenDigest: digest,
            outcome,
            createdAt: now,
          });
          transaction.create(paths.idempotency(storedToken.workspaceId, idempotencyId), { ...idempotency });
          createEvidence(transaction, evidence);
          return {
            outcome,
            invitation: before,
            membership,
            firstAcceptance: false,
            activeSeatAdded: false,
          };
        }

        await this.#assertEntitled(
          transaction,
          {kind: 'user', userId, source: 'web'},
          {workspaceId: storedToken.workspaceId, userId, role: 'member', action: 'invitation.manage'},
          'invitation.accept',
          now,
        );

        const assignedTeamIds = before.teamIds ?? [];
        const assignedTeamRecords = await Promise.all(assignedTeamIds.map(async (teamId) => ({
          teamId,
          team: await transaction.get(paths.team(storedToken.workspaceId, teamId)),
          membership: await transaction.get(paths.teamMembership(storedToken.workspaceId, teamId, userId)),
        })));
        for (const assigned of assignedTeamRecords) {
          if (assigned.team !== null) {
            trustedHostedTeamRecord(assigned.team, storedToken.workspaceId, assigned.teamId);
          } else if (assigned.teamId !== defaultHostedTeamId(storedToken.workspaceId)) {
            throw new InvitationServiceError(
              'INVITATION_SERVICE_UNAVAILABLE',
              'Invitation service is temporarily unavailable.',
            );
          }
          if (assigned.membership !== null) {
            trustedHostedTeamMembershipRecord(
              assigned.membership,
              storedToken.workspaceId,
              assigned.teamId,
              userId,
            );
          }
        }

        let activeSeatAdded = false;
        let activeMembership: InvitationMembershipRecord;
        if (membership === null) {
          activeSeatAdded = true;
          activeMembership = {
            schemaVersion: 1,
            id: this.#opaqueId('mem', `membership:${storedToken.workspaceId}:${userId}`),
            workspaceId: storedToken.workspaceId,
            userId,
            role: 'member',
            status: 'active',
            createdAt: now,
            updatedAt: now,
            removedAt: null,
            revision: 1,
          };
          transaction.create(paths.membership(storedToken.workspaceId, userId), { ...activeMembership });
        } else if (membership.status === 'removed') {
          activeSeatAdded = true;
          activeMembership = {
            ...membership,
            role: 'member',
            status: 'active',
            updatedAt: now,
            removedAt: null,
            revision: membership.revision + 1,
          };
          transaction.set(paths.membership(storedToken.workspaceId, userId), { ...activeMembership });
        } else {
          activeMembership = membership;
        }

        for (const assigned of assignedTeamRecords) {
          const teamMembershipPath = paths.teamMembership(storedToken.workspaceId, assigned.teamId, userId);
          if (assigned.membership === null) {
            const teamMembership: HostedTeamMembership = {
              schemaVersion: 1,
              id: hostedTeamMembershipId(storedToken.workspaceId, assigned.teamId, userId),
              workspaceId: storedToken.workspaceId,
              teamId: assigned.teamId,
              userId,
              role: activeMembership.role,
              status: 'active',
              createdAt: now,
              updatedAt: now,
              revision: 1,
            };
            transaction.create(teamMembershipPath, {...teamMembership});
          } else {
            const teamMembership = trustedHostedTeamMembershipRecord(
              assigned.membership,
              storedToken.workspaceId,
              assigned.teamId,
              userId,
            );
            if (teamMembership.status === 'left') {
              transaction.set(teamMembershipPath, {
                ...teamMembership,
                role: activeMembership.role,
                status: 'active',
                updatedAt: now,
                revision: teamMembership.revision + 1,
              });
            }
          }
        }

        const invitation: InvitationRecord = {
          ...before,
          status: 'accepted',
          updatedAt: now,
          acceptedAt: now,
          acceptedUserId: userId,
          activeSeatApplied: activeSeatAdded,
          revision: before.revision + 1,
        };
        const usedToken: InvitationTokenRecord = { ...storedToken, state: 'used' };
        const evidence = membershipAcceptanceEvidence({
          invitation,
          actorUserId: userId,
          requestId,
          now,
          emailMatched: true,
          validInvitation: true,
          firstAcceptance: true,
          succeeded: true,
          revisionBefore: before.revision,
          revisionAfter: invitation.revision,
          activeSeatAdded,
          opaqueId: this.#idFactory(),
        });
        const idempotency = this.#boundIdempotencyRecord({
          schemaVersion: 1,
          id: idempotencyId,
          workspaceId: storedToken.workspaceId,
          operation: 'accept',
          requestReference,
          invitationId: storedToken.invitationId,
          tokenDigest: digest,
          outcome: 'accepted',
          createdAt: now,
        });
        transaction.set(paths.invitation(storedToken.workspaceId, storedToken.invitationId), { ...invitation });
        transaction.set(paths.token(digest), { ...usedToken });
        transaction.merge(paths.hostedUser(userId), {
          schemaVersion: 1,
          uid: userId,
          email,
          displayName: memberDisplayName,
          authProvider: 'google.com',
          updatedAt: now,
        });
        transaction.create(paths.idempotency(storedToken.workspaceId, idempotencyId), { ...idempotency });
        createEvidence(transaction, evidence);
        return {
          outcome: 'accepted',
          invitation,
          membership: activeMembership,
          firstAcceptance: true,
          activeSeatAdded,
        };
      });
    } catch (error) {
      if (error instanceof InvitationServiceError) throw error;
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }

    if (internal.outcome !== 'accepted') {
      const mapping: Record<Exclude<InvitationAcceptanceOutcome, 'accepted'>, {
        code: InvitationServiceError['code'];
        message: string;
      }> = {
        email_mismatch: {
          code: 'INVITATION_EMAIL_MISMATCH',
          message: 'Sign in with the Google account named on the invitation.',
        },
        expired: { code: 'INVITATION_EXPIRED', message: 'This invitation has expired.' },
        revoked: { code: 'INVITATION_REVOKED', message: 'This invitation was revoked.' },
        superseded: {
          code: 'INVITATION_SUPERSEDED',
          message: 'A newer invitation link is required.',
        },
        already_accepted: {
          code: 'INVITATION_ALREADY_ACCEPTED',
          message: 'This invitation was already accepted.',
        },
      };
      const mapped = mapping[internal.outcome];
      throw new InvitationServiceError(mapped.code, mapped.message);
    }
    try {
      await this.#seatReconciler.reconcileWorkspaceSeats(internal.invitation.workspaceId);
    } catch {
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
    if (internal.membership === null || internal.membership.status !== 'active') {
      throw new InvitationServiceError(
        'INVITATION_SERVICE_UNAVAILABLE',
        'Invitation service is temporarily unavailable.',
      );
    }
    return {
      state: 'accepted',
      firstAcceptance: internal.firstAcceptance,
      activeSeatAdded: internal.activeSeatAdded,
      workspace: {
        id: internal.invitation.workspaceId,
        name: internal.invitation.workspaceName,
      },
      membership: {
        userId: internal.membership.userId,
        role: internal.membership.role,
        status: 'active',
        revision: internal.membership.revision,
      },
    };
  }
}

class MemoryInvitationTransaction implements InvitationTransaction {
  readonly #documents: Map<string, unknown>;

  constructor(documents: Map<string, unknown>) {
    this.#documents = documents;
  }

  async get(path: string): Promise<unknown | null> {
    const value = this.#documents.get(path);
    return value === undefined ? null : clone(value);
  }

  async list(collectionPath: string, maximumRecords?: number): Promise<unknown[]> {
    const prefix = `${collectionPath}/`;
    const values = [...this.#documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => clone(value));
    if (maximumRecords !== undefined && values.length > maximumRecords) {
      throw new Error('INVITATION_QUERY_BUDGET_EXCEEDED');
    }
    return values;
  }

  create(path: string, value: Record<string, unknown>): void {
    if (this.#documents.has(path)) throw new Error('DOCUMENT_ALREADY_EXISTS');
    this.#documents.set(path, clone(value));
  }

  set(path: string, value: Record<string, unknown>): void {
    this.#documents.set(path, clone(value));
  }

  merge(path: string, value: Record<string, unknown>): void {
    const existing = record(this.#documents.get(path)) ?? {};
    this.#documents.set(path, clone({ ...existing, ...value }));
  }
}

export class MemoryInvitationRepository implements InvitationRepository {
  #documents = new Map<string, unknown>();
  #queue: Promise<void> = Promise.resolve();
  #nextTransactionRetries = 0;

  runTransaction<Value>(
    operation: (transaction: InvitationTransaction) => Promise<Value>,
  ): Promise<Value> {
    const pending = this.#queue.then(async () => {
      const retries = this.#nextTransactionRetries;
      this.#nextTransactionRetries = 0;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const working = new Map(
          [...this.#documents.entries()].map(([path, value]) => [path, clone(value)]),
        );
        const value = await operation(new MemoryInvitationTransaction(working));
        if (attempt === retries) {
          this.#documents = working;
          return value;
        }
      }
      throw new Error('The in-memory transaction retry loop did not complete.');
    });
    this.#queue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  simulateNextTransactionRetries(retries = 1): void {
    if (!Number.isSafeInteger(retries) || retries < 1 || retries > 5) {
      throw new Error('Transaction retries must be an integer from 1 through 5.');
    }
    this.#nextTransactionRetries = retries;
  }

  async listDocuments(
    collectionPath: string,
    orderByField: string,
    limit: number,
  ): Promise<unknown[]> {
    await this.#queue;
    const prefix = `${collectionPath}/`;
    return [...this.#documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([, value]) => clone(value))
      .sort((left, right) => {
        const leftValue = record(left)?.[orderByField];
        const rightValue = record(right)?.[orderByField];
        return String(rightValue ?? '').localeCompare(String(leftValue ?? ''));
      })
      .slice(0, limit);
  }

  seedDocument(path: string, value: Record<string, unknown>): void {
    this.#documents.set(path, clone(value));
  }

  readDocument(path: string): unknown | null {
    const value = this.#documents.get(path);
    return value === undefined ? null : clone(value);
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries(
      [...this.#documents.entries()].map(([path, value]) => [path, clone(value)]),
    );
  }

  activeMembershipCount(workspaceId: string): number {
    const prefix = `workspaces/${workspaceId}/memberships/`;
    return [...this.#documents.entries()].filter(([path, value]) => {
      const candidate = record(value);
      return path.startsWith(prefix)
        && !path.slice(prefix.length).includes('/')
        && candidate?.workspaceId === workspaceId
        && candidate.status === 'active';
    }).length;
  }

  async readMembership(workspaceId: string, userId: string): Promise<unknown | null> {
    await this.#queue;
    return this.readDocument(paths.membership(workspaceId, userId));
  }
}
