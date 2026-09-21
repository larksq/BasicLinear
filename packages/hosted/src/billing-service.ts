import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { PRO_TRIAL_DURATION_MS } from './owner-bootstrap.js';
import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  hostedMeasurementSchemaVersion,
  type HostedProductEvent,
  type HostedMutationAuditRecord,
} from './measurement-contract.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationGrant,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from './workspace-authorization.js';
import type { BillingActivationPolicy } from './operations-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';

export const billingPlans = ['monthly', 'annual'] as const;
export type BillingPlan = (typeof billingPlans)[number];
export type EffectiveEntitlementMode = 'trial_pro' | 'paid_pro' | 'free';
export const VERIFICATION_ACCESS_ENDS_AT = '9999-12-31T23:59:59.999Z';

export const billingPrices = {
  monthly: { amountCents: 200, amountMicrousd: 2_000_000, interval: 'month' },
  annual: { amountCents: 1_200, amountMicrousd: 12_000_000, interval: 'year' },
} as const;

const CHECKOUT_MAX_DURATION_MS = 24 * 60 * 60 * 1_000 + 5 * 60 * 1_000;

export type BillingProviderSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused';

export interface BillingProviderCheckoutSession {
  id: string;
  checkoutReference: string;
  url: string | null;
  state: 'open' | 'complete' | 'expired';
  workspaceId: string;
  ownerUserId: string;
  plan: BillingPlan;
  priceId: string;
  quantity: number;
  customerId: string | null;
  subscriptionId: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface BillingProviderSubscription {
  id: string;
  customerId: string;
  workspaceId: string;
  ownerUserId: string;
  plan: BillingPlan;
  priceId: string;
  quantity: number;
  status: BillingProviderSubscriptionStatus;
  automaticTaxEnabled: true;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  providerUpdatedAt: string;
}

export interface BillingProviderSubscriptionUpdateExpectation {
  customerId: string;
  workspaceId: string;
  ownerUserId: string;
  plan: BillingPlan;
  priceId: string;
  quantity: number;
  status: 'active';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface VerifiedBillingNotice {
  provider: 'stripe' | 'creem';
  eventId: string;
  eventCreatedAt: string;
  subscriptionId: string | null;
  checkoutSessionId: string | null;
}

export interface BillingProvider {
  createCheckoutSession(input: {
    checkoutReference: string;
    workspaceId: string;
    ownerUserId: string;
    plan: BillingPlan;
    priceId: string;
    quantity: number;
    idempotencyReference: string;
    attemptedAt?: string;
  }): Promise<BillingProviderCheckoutSession>;
  recoverCheckoutSessions(input: {
    checkoutReference: string;
    createdAt: string;
    attemptedAt: string;
  }): Promise<BillingProviderCheckoutSession[]>;
  retrieveCheckoutSession(sessionId: string): Promise<BillingProviderCheckoutSession>;
  expireCheckoutSession(sessionId: string): Promise<void>;
  retrieveSubscription(subscriptionId: string): Promise<BillingProviderSubscription>;
  updateSubscriptionQuantity(input: {
    subscriptionId: string;
    expected: BillingProviderSubscriptionUpdateExpectation;
    quantity: number;
    idempotencyReference: string;
    prorationBehavior: 'create_prorations';
  }): Promise<BillingProviderSubscription>;
}

export interface BillingSeatReconciler {
  reconcileWorkspaceSeats(workspaceId: string): Promise<void>;
}

export interface BillingTransaction {
  get(path: string): Promise<unknown | null>;
  list(collectionPath: string): Promise<unknown[]>;
  create(path: string, value: Record<string, unknown>): void;
  set(path: string, value: Record<string, unknown>): void;
}

export interface BillingRepository {
  runTransaction<Value>(operation: (transaction: BillingTransaction) => Promise<Value>): Promise<Value>;
}

export interface BillingEntitlementTransaction {
  get(path: string): Promise<unknown | null>;
  list(collectionPath: string): Promise<unknown[]>;
}

export type EntitledMutationOperation =
  | 'team.create'
  | 'team.update'
  | 'workflow_status.create'
  | 'workflow_status.update'
  | 'cycle.create'
  | 'cycle.update'
  | 'saved_view.create'
  | 'saved_view.update'
  | 'project.create'
  | 'project.update'
  | 'milestone.create'
  | 'milestone.update'
  | 'issue.create'
  | 'issue.update'
  | 'issue.assign'
  | 'comment.create'
  | 'comment.edit'
  | 'comment.delete'
  | 'invitation.create'
  | 'invitation.resend'
  | 'invitation.revoke'
  | 'invitation.accept'
  | 'token.create'
  | 'token.revoke'
  | 'automation.execute';

export interface WorkspaceMutationEntitlementPolicy {
  assertMutation(input: {
    transaction: BillingEntitlementTransaction;
    workspaceId: string;
    principal: WorkspacePrincipal;
    grant: WorkspaceAuthorizationGrant;
    operation: EntitledMutationOperation;
    now: string;
    assigneeUserId?: string | null;
  }): Promise<EffectiveEntitlementMode>;
}

export interface BillingSummary {
  workspaceId: string;
  mode: EffectiveEntitlementMode;
  trial: {startedAt: string; endsAt: string; active: boolean};
  seats: {active: number; pendingInvitations: number};
  prices: {
    currency: 'usd';
    monthlyPerSeatCents: 200;
    annualPerSeatCents: 1200;
    monthlyTotalCents: number;
    annualTotalCents: number;
  };
  subscription: null | {
    plan: BillingPlan;
    status: BillingProviderSubscriptionStatus;
    activeSeats: number;
    paidThrough: string;
    cancelAtPeriodEnd: boolean;
  };
  verificationAccess?: {
    source: 'operator_allowlist';
    endsAt: typeof VERIFICATION_ACCESS_ENDS_AT;
    noCharge: true;
  };
  free: {
    writerUserId: string;
    dataReadable: true;
    exportEligible: true;
    exportAvailable: true;
    extraMemberWritesPaused: true;
    automationWritesPaused: true;
  };
}

export interface BillingCheckoutResult {
  checkoutSessionId: string;
  checkoutUrl: string;
  plan: BillingPlan;
  activeSeats: number;
  totalCents: number;
  currency: 'usd';
  expiresAt: string;
}

export interface BillingMemberRemovalResult {
  changed: boolean;
  userId: string;
  activeSeats: number;
}

export interface BillingServiceOptions {
  secret: string | Uint8Array;
  monthlyPriceId: string;
  annualPriceId: string;
  activationPolicy: BillingActivationPolicy;
  clock?: () => Date;
}

export class BillingServiceError extends Error {
  readonly code:
    | 'INVALID_BILLING_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'BILLING_CONFLICT'
    | 'BILLING_FORBIDDEN'
    | 'BILLING_UNAVAILABLE';

  constructor(code: BillingServiceError['code'], message: string) {
    super(message);
    this.name = 'BillingServiceError';
    this.code = code;
  }
}

interface WorkspaceRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  ownerUid: string;
  authority: 'firebase-hosted';
  createdAt: string;
  revision: number;
}

interface TrialRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  plan: 'pro';
  status: 'active';
  trialStartedAt: string;
  trialEndsAt: string;
  source: 'owner_bootstrap';
  revision: 1;
}

interface ActiveMembership {
  userId: string;
  role: 'owner' | 'member';
  createdAt: string;
  updatedAt: string | null;
}

interface StoredBillingMembership extends ActiveMembership {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  status: 'active' | 'removed';
  removedAt: string | null;
  revision: number;
}

interface BillingRecordUnsigned {
  schemaVersion: 1;
  id: 'current';
  workspaceId: string;
  customerId: string;
  subscriptionId: string;
  plan: BillingPlan;
  status: BillingProviderSubscriptionStatus;
  priceId: string;
  activeSeats: number;
  paidThrough: string;
  cancelAtPeriodEnd: boolean;
  providerUpdatedAt: string;
  reconciledAt: string;
  revision: number;
}

interface BillingRecord extends BillingRecordUnsigned { binding: string }

interface CheckoutRecordUnsigned {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  ownerUserId: string;
  plan: BillingPlan;
  priceId: string;
  activeSeats: number;
  membershipDigest: string;
  providerAttempt: number;
  providerAttemptedAt: string;
  providerSessionId: string | null;
  providerCreatedAt: string | null;
  untrustedProviderChronologyDigest: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  state: 'prepared' | 'ready' | 'completed';
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

interface CheckoutRecord extends CheckoutRecordUnsigned { binding: string }

type CheckoutPreparation =
  | {kind: 'checkout'; checkout: CheckoutRecord}
  | {kind: 'blocked'; checkout: CheckoutRecord};

interface CheckoutSessionRecordUnsigned {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  checkoutId: string;
  providerSessionId: string;
  createdAt: string;
}

interface CheckoutLockRecordUnsigned {
  schemaVersion: 1;
  id: 'current';
  workspaceId: string;
  ownerUserId: string;
  checkoutId: string;
  createdAt: string;
}

interface WebhookRecordUnsigned {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  eventReference: string;
  eventCreatedAt: string;
  subscriptionId: string;
  providerUpdatedAt: string;
  reconciledAt: string;
  billingRevision: number;
}

interface BillingIdempotencyRecordUnsigned {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  ownerUserId: string;
  operation: 'membership.remove';
  targetUserId: string;
  outcomeRevision: number;
  source: WorkspacePrincipal['source'];
  requestReference: string;
  auditId: string;
  createdAt: string;
}

interface VerificationAccessRecordUnsigned {
  schemaVersion: 1;
  id: 'current';
  workspaceId: string;
  ownerUserId: string;
  ownerEmailSha256: string;
  source: 'operator_allowlist';
  endsAt: typeof VERIFICATION_ACCESS_ENDS_AT;
  createdAt: string;
  revision: 1;
}

interface VerificationAccessRecord extends VerificationAccessRecordUnsigned { binding: string }

const paths = {
  workspace: (workspaceId: string) => `workspaces/${workspaceId}`,
  trial: (workspaceId: string) => `workspaces/${workspaceId}/entitlements/current`,
  billing: (workspaceId: string) => `workspaces/${workspaceId}/billing/current`,
  verificationAccess: (workspaceId: string) => `workspaces/${workspaceId}/verificationAccess/current`,
  memberships: (workspaceId: string) => `workspaces/${workspaceId}/memberships`,
  invitations: (workspaceId: string) => `workspaces/${workspaceId}/invitations`,
  checkout: (workspaceId: string, id: string) => `workspaces/${workspaceId}/billingCheckouts/${id}`,
  checkoutSession: (workspaceId: string, id: string) => `workspaces/${workspaceId}/billingCheckoutSessions/${id}`,
  checkoutLock: (workspaceId: string) => `workspaces/${workspaceId}/billingCheckoutLocks/current`,
  webhook: (workspaceId: string, id: string) => `workspaces/${workspaceId}/billingWebhooks/${id}`,
  idempotency: (workspaceId: string, id: string) => `workspaces/${workspaceId}/billingIdempotency/${id}`,
  event: (workspaceId: string, id: string) => `workspaces/${workspaceId}/productEvents/${id}`,
  audit: (workspaceId: string, id: string) => `workspaces/${workspaceId}/mutationAudits/${id}`,
};

const workspaceKeys = ['schemaVersion', 'id', 'workspaceId', 'name', 'ownerUid', 'authority', 'createdAt', 'revision'] as const;
const trialKeys = ['schemaVersion', 'id', 'workspaceId', 'plan', 'status', 'trialStartedAt', 'trialEndsAt', 'source', 'revision'] as const;
const billingKeys = [
  'schemaVersion', 'id', 'workspaceId', 'customerId', 'subscriptionId', 'plan', 'status',
  'priceId', 'activeSeats', 'paidThrough', 'cancelAtPeriodEnd', 'providerUpdatedAt',
  'reconciledAt', 'revision', 'binding',
] as const;
const checkoutKeys = [
  'schemaVersion', 'id', 'workspaceId', 'ownerUserId', 'plan', 'priceId', 'activeSeats',
  'membershipDigest', 'providerAttempt', 'providerAttemptedAt', 'providerSessionId',
  'providerCreatedAt', 'untrustedProviderChronologyDigest', 'providerCustomerId', 'state', 'createdAt',
  'providerSubscriptionId', 'expiresAt', 'completedAt', 'binding',
] as const;
const checkoutSessionKeys = [
  'schemaVersion', 'id', 'workspaceId', 'checkoutId', 'providerSessionId', 'createdAt', 'binding',
] as const;
const checkoutLockKeys = [
  'schemaVersion', 'id', 'workspaceId', 'ownerUserId', 'checkoutId', 'createdAt', 'binding',
] as const;
const webhookKeys = [
  'schemaVersion', 'id', 'workspaceId', 'eventReference', 'eventCreatedAt', 'subscriptionId',
  'providerUpdatedAt', 'reconciledAt', 'billingRevision', 'binding',
] as const;
const invitationKeys = [
  'schemaVersion', 'id', 'workspaceId', 'invitedEmail', 'inviterUserId',
  'inviterDisplayName', 'workspaceName', 'role', 'status', 'createdAt', 'updatedAt',
  'lastSentAt', 'expiresAt', 'acceptedAt', 'acceptedUserId', 'revokedAt',
  'currentTokenDigest', 'sendCount', 'activeSeatApplied', 'revision',
] as const;
const billingIdempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'ownerUserId', 'operation', 'targetUserId',
  'outcomeRevision', 'source', 'requestReference', 'auditId', 'createdAt', 'binding',
] as const;
const verificationAccessKeys = [
  'schemaVersion', 'id', 'workspaceId', 'ownerUserId', 'ownerEmailSha256', 'source',
  'endsAt', 'createdAt', 'revision', 'binding',
] as const;

const clone = <Value>(value: Value): Value => structuredClone(value);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function canonicalTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function safeReference(value: unknown, maximum = 160): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= maximum
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function safeDisplayText(value: unknown, maximum = 160): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length >= 1
    && value.length <= maximum
    && !/[\u0000-\u001F\u007F]/u.test(value);
}

function safeWorkspaceId(value: string): string {
  const normalized = value.trim();
  if (!safeReference(normalized, 128) || normalized.includes(':') || normalized.includes('@')) {
    throw invalidRequest();
  }
  return normalized;
}

function safeIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 16 || normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/u.test(normalized)) {
    throw new BillingServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
  }
  return normalized;
}

function trustedNow(clock: () => Date): string {
  const value = clock();
  if (!Number.isFinite(value.getTime())) throw unavailable();
  return value.toISOString();
}

function invalidRequest(): BillingServiceError {
  return new BillingServiceError('INVALID_BILLING_REQUEST', 'The billing request is invalid.');
}

function unavailable(): BillingServiceError {
  return new BillingServiceError('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.');
}

function conflict(): BillingServiceError {
  return new BillingServiceError('BILLING_CONFLICT', 'Workspace seats changed. Review the total and try again.');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stable(candidate[key])}`).join(',')}}`;
}

function hmac(secret: string | Uint8Array, label: string, value: unknown): string {
  return createHmac('sha256', secret).update(`${label}:${stable(value)}`, 'utf8').digest('hex');
}

function normalizedProviderExpiry(providerAttemptedAt: string): string {
  return new Date(Date.parse(providerAttemptedAt) + CHECKOUT_MAX_DURATION_MS).toISOString();
}

function untrustedProviderChronologyDigest(value: BillingProviderCheckoutSession): string {
  return sha256(stable({
    schemaVersion: 1,
    providerSessionId: value.id,
    providerCreatedAt: value.createdAt,
    providerExpiresAt: value.expiresAt,
  }));
}

function equalDigest(left: unknown, right: string): boolean {
  if (typeof left !== 'string' || !/^[a-f0-9]{64}$/u.test(left)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function workspaceRecord(value: unknown, workspaceId: string): WorkspaceRecord {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, workspaceKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== workspaceId
    || candidate.workspaceId !== workspaceId || !safeDisplayText(candidate.name)
    || !safeReference(candidate.ownerUid, 128) || candidate.authority !== 'firebase-hosted'
    || !canonicalTimestamp(candidate.createdAt) || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) throw unavailable();
  return candidate as unknown as WorkspaceRecord;
}

function trialRecord(value: unknown, workspaceId: string, workspaceCreatedAt: string): TrialRecord {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, trialKeys)
    || candidate.schemaVersion !== 1 || !safeReference(candidate.id)
    || candidate.workspaceId !== workspaceId || candidate.plan !== 'pro'
    || candidate.status !== 'active' || candidate.source !== 'owner_bootstrap'
    || candidate.revision !== 1 || !canonicalTimestamp(candidate.trialStartedAt)
    || !canonicalTimestamp(candidate.trialEndsAt)
    || candidate.trialStartedAt !== workspaceCreatedAt
    || Date.parse(candidate.trialEndsAt) - Date.parse(candidate.trialStartedAt) !== PRO_TRIAL_DURATION_MS) {
    throw unavailable();
  }
  return candidate as unknown as TrialRecord;
}

function storedMembershipRecord(value: unknown, workspaceId: string): StoredBillingMembership {
  const candidate = record(value);
  if (candidate === null) throw unavailable();
  const baseKeys = ['schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt', 'revision'];
  const expandedKeys = [...baseKeys, 'updatedAt', 'removedAt'];
  if ((!exactKeys(candidate, baseKeys) && !exactKeys(candidate, expandedKeys))
    || candidate.schemaVersion !== 1 || !safeReference(candidate.id)
    || candidate.workspaceId !== workspaceId || !safeReference(candidate.userId, 128)
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (candidate.status !== 'active' && candidate.status !== 'removed')
    || !canonicalTimestamp(candidate.createdAt) || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) throw unavailable();
  const updatedAt = 'updatedAt' in candidate ? candidate.updatedAt : null;
  const removedAt = 'removedAt' in candidate ? candidate.removedAt : null;
  if (updatedAt !== null && !canonicalTimestamp(updatedAt)) throw unavailable();
  if (removedAt !== null && !canonicalTimestamp(removedAt)) throw unavailable();
  if (updatedAt !== null && Date.parse(updatedAt) < Date.parse(candidate.createdAt)) throw unavailable();
  if (candidate.status === 'active' && removedAt !== null) throw unavailable();
  if (candidate.status === 'removed' && (
    updatedAt === null
    || removedAt === null
    || updatedAt !== removedAt
    || (candidate.revision as number) < 2
  )) throw unavailable();
  return {
    schemaVersion: 1,
    id: candidate.id as string,
    workspaceId,
    userId: candidate.userId as string,
    role: candidate.role,
    status: candidate.status as 'active' | 'removed',
    createdAt: candidate.createdAt,
    updatedAt: updatedAt as string | null,
    removedAt: removedAt as string | null,
    revision: candidate.revision as number,
  };
}

function membershipRecord(value: unknown, workspaceId: string): ActiveMembership | null {
  const candidate = storedMembershipRecord(value, workspaceId);
  return candidate.status === 'active'
    ? {userId: candidate.userId, role: candidate.role, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt}
    : null;
}

function activeMemberships(values: unknown[], workspaceId: string, now: string): ActiveMembership[] {
  const result = values.map((value) => membershipRecord(value, workspaceId)).filter((value): value is ActiveMembership => value !== null);
  if (result.length < 1 || result.length > 10_000) throw unavailable();
  const seen = new Set<string>();
  let owners = 0;
  for (const value of result) {
    if (seen.has(value.userId) || Date.parse(value.createdAt) > Date.parse(now)
      || value.updatedAt !== null && Date.parse(value.updatedAt) > Date.parse(now)) throw unavailable();
    seen.add(value.userId);
    if (value.role === 'owner') owners += 1;
  }
  if (owners !== 1) throw unavailable();
  return result.sort((left, right) => left.userId.localeCompare(right.userId));
}

function membershipFingerprint(values: ActiveMembership[]): string {
  return sha256(stable(values.map(({userId, role, createdAt, updatedAt}) => ({userId, role, createdAt, updatedAt}))));
}

function validInvitationKeys(candidate: Record<string, unknown>): boolean {
  if (exactKeys(candidate, invitationKeys)) return true;
  if (!exactKeys(candidate, [...invitationKeys, 'teamIds'])) return false;
  const teamIds = candidate.teamIds;
  return Array.isArray(teamIds) && teamIds.length <= 20
    && teamIds.every((teamId, index) => typeof teamId === 'string'
      && /^team_[a-f0-9]{32}$/u.test(teamId)
      && (index === 0 || teamIds[index - 1] < teamId));
}

function pendingInvitations(values: unknown[], workspaceId: string, now: string): number {
  let count = 0;
  const seen = new Set<string>();
  for (const value of values) {
    const candidate = record(value);
    if (candidate === null || !validInvitationKeys(candidate)
      || candidate.schemaVersion !== 1 || candidate.workspaceId !== workspaceId
      || !safeReference(candidate.id) || !safeReference(candidate.inviterUserId, 128)
      || !safeDisplayText(candidate.inviterDisplayName) || !safeDisplayText(candidate.workspaceName)
      || typeof candidate.invitedEmail !== 'string' || candidate.invitedEmail.length > 254
      || candidate.invitedEmail !== candidate.invitedEmail.toLowerCase()
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(candidate.invitedEmail)
      || candidate.role !== 'member'
      || !['pending', 'revoked', 'accepted'].includes(String(candidate.status))
      || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
      || !canonicalTimestamp(candidate.lastSentAt) || !canonicalTimestamp(candidate.expiresAt)
      || candidate.acceptedAt !== null && !canonicalTimestamp(candidate.acceptedAt)
      || candidate.acceptedUserId !== null && !safeReference(candidate.acceptedUserId, 128)
      || candidate.revokedAt !== null && !canonicalTimestamp(candidate.revokedAt)
      || typeof candidate.currentTokenDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.currentTokenDigest)
      || !Number.isSafeInteger(candidate.sendCount) || (candidate.sendCount as number) < 1
      || (candidate.sendCount as number) > 10 || typeof candidate.activeSeatApplied !== 'boolean'
      || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
      || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
      || Date.parse(candidate.updatedAt) > Date.parse(now)
      || Date.parse(candidate.lastSentAt) > Date.parse(candidate.updatedAt)
      || Date.parse(candidate.expiresAt) - Date.parse(candidate.lastSentAt) !== 7 * 24 * 60 * 60 * 1_000
      || candidate.status === 'pending' && (candidate.acceptedAt !== null || candidate.acceptedUserId !== null || candidate.revokedAt !== null)
      || candidate.status === 'accepted' && (candidate.acceptedAt !== candidate.updatedAt || candidate.acceptedUserId === null || candidate.revokedAt !== null)
      || candidate.status === 'revoked' && (candidate.revokedAt !== candidate.updatedAt || candidate.acceptedAt !== null || candidate.acceptedUserId !== null)
      || candidate.status !== 'accepted' && candidate.activeSeatApplied !== false
      || seen.has(candidate.id as string)) {
      throw unavailable();
    }
    seen.add(candidate.id as string);
    if (candidate.status === 'pending' && Date.parse(candidate.expiresAt) > Date.parse(now)) count += 1;
  }
  return count;
}

function validPlan(value: unknown): value is BillingPlan {
  return typeof value === 'string' && (billingPlans as readonly string[]).includes(value);
}

function validProviderStatus(value: unknown): value is BillingProviderSubscriptionStatus {
  return typeof value === 'string' && [
    'trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused',
  ].includes(value);
}

function billingBinding(secret: string | Uint8Array, value: BillingRecordUnsigned): string {
  return hmac(secret, 'billing-record:v1', value);
}

function checkoutBinding(secret: string | Uint8Array, value: CheckoutRecordUnsigned): string {
  return hmac(secret, 'billing-checkout:v1', value);
}

function checkoutSessionBinding(secret: string | Uint8Array, value: CheckoutSessionRecordUnsigned): string {
  return hmac(secret, 'billing-checkout-session:v1', value);
}

function checkoutLockBinding(secret: string | Uint8Array, value: CheckoutLockRecordUnsigned): string {
  return hmac(secret, 'billing-checkout-lock:v1', value);
}

function webhookBinding(secret: string | Uint8Array, value: WebhookRecordUnsigned): string {
  return hmac(secret, 'billing-webhook:v1', value);
}

function billingIdempotencyBinding(
  secret: string | Uint8Array,
  value: BillingIdempotencyRecordUnsigned,
): string {
  return hmac(secret, 'billing-idempotency:v1', value);
}

function verificationAccessBinding(
  secret: string | Uint8Array,
  value: VerificationAccessRecordUnsigned,
): string {
  return hmac(secret, 'verification-access:v1', value);
}

function verificationAccessRecord(
  value: unknown,
  expected: {workspaceId: string; ownerUserId: string},
  secret: string | Uint8Array,
  now: string,
): VerificationAccessRecord | null {
  if (value === null) return null;
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, verificationAccessKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== 'current'
    || candidate.workspaceId !== expected.workspaceId
    || candidate.ownerUserId !== expected.ownerUserId
    || typeof candidate.ownerEmailSha256 !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.ownerEmailSha256)
    || candidate.source !== 'operator_allowlist'
    || candidate.endsAt !== VERIFICATION_ACCESS_ENDS_AT
    || !canonicalTimestamp(candidate.createdAt)
    || Date.parse(candidate.createdAt) > Date.parse(now)
    || candidate.revision !== 1) throw unavailable();
  const unsigned: VerificationAccessRecordUnsigned = {
    schemaVersion: 1,
    id: 'current',
    workspaceId: candidate.workspaceId,
    ownerUserId: candidate.ownerUserId,
    ownerEmailSha256: candidate.ownerEmailSha256,
    source: 'operator_allowlist',
    endsAt: VERIFICATION_ACCESS_ENDS_AT,
    createdAt: candidate.createdAt,
    revision: 1,
  };
  const binding = verificationAccessBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function activeVerificationAccess(
  value: VerificationAccessRecord | null,
  now: string,
): value is VerificationAccessRecord {
  return value !== null && Date.parse(value.endsAt) > Date.parse(now);
}

function billingRecord(
  value: unknown,
  workspaceId: string,
  secret: string | Uint8Array,
  priceIds: Record<BillingPlan, string>,
): BillingRecord | null {
  if (value === null) return null;
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, billingKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== 'current'
    || candidate.workspaceId !== workspaceId || !safeReference(candidate.customerId)
    || !safeReference(candidate.subscriptionId) || !validPlan(candidate.plan)
    || !validProviderStatus(candidate.status) || candidate.priceId !== priceIds[candidate.plan]
    || !Number.isSafeInteger(candidate.activeSeats) || (candidate.activeSeats as number) < 1
    || !canonicalTimestamp(candidate.paidThrough) || typeof candidate.cancelAtPeriodEnd !== 'boolean'
    || !canonicalTimestamp(candidate.providerUpdatedAt) || !canonicalTimestamp(candidate.reconciledAt)
    || Date.parse(candidate.providerUpdatedAt) > Date.parse(candidate.reconciledAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  const unsigned: BillingRecordUnsigned = {
    schemaVersion: 1, id: 'current', workspaceId,
    customerId: candidate.customerId, subscriptionId: candidate.subscriptionId,
    plan: candidate.plan, status: candidate.status, priceId: candidate.priceId,
    activeSeats: candidate.activeSeats as number, paidThrough: candidate.paidThrough,
    cancelAtPeriodEnd: candidate.cancelAtPeriodEnd,
    providerUpdatedAt: candidate.providerUpdatedAt, reconciledAt: candidate.reconciledAt,
    revision: candidate.revision as number,
  };
  const binding = billingBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function checkoutRecord(
  value: unknown,
  expected: {id: string; workspaceId: string; ownerUserId: string},
  secret: string | Uint8Array,
  now: string,
): CheckoutRecord {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, checkoutKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== expected.id
    || candidate.workspaceId !== expected.workspaceId || candidate.ownerUserId !== expected.ownerUserId
    || !validPlan(candidate.plan) || !safeReference(candidate.priceId)
    || !Number.isSafeInteger(candidate.activeSeats) || (candidate.activeSeats as number) < 1
    || typeof candidate.membershipDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.membershipDigest)
    || !Number.isSafeInteger(candidate.providerAttempt) || (candidate.providerAttempt as number) < 1
    || !canonicalTimestamp(candidate.providerAttemptedAt)
    || candidate.providerSessionId !== null && !safeReference(candidate.providerSessionId)
    || candidate.providerCreatedAt !== null && !canonicalTimestamp(candidate.providerCreatedAt)
    || candidate.untrustedProviderChronologyDigest !== null
      && (typeof candidate.untrustedProviderChronologyDigest !== 'string'
        || !/^[a-f0-9]{64}$/u.test(candidate.untrustedProviderChronologyDigest))
    || candidate.providerCustomerId !== null && !safeReference(candidate.providerCustomerId)
    || candidate.providerSubscriptionId !== null && !safeReference(candidate.providerSubscriptionId)
    || !['prepared', 'ready', 'completed'].includes(String(candidate.state))
    || !canonicalTimestamp(candidate.createdAt)
    || candidate.expiresAt !== null && !canonicalTimestamp(candidate.expiresAt)
    || candidate.completedAt !== null && !canonicalTimestamp(candidate.completedAt)
    || Date.parse(candidate.createdAt) > Date.parse(now)) throw unavailable();
  const unsigned: CheckoutRecordUnsigned = {
    schemaVersion: 1, id: candidate.id, workspaceId: candidate.workspaceId,
    ownerUserId: candidate.ownerUserId, plan: candidate.plan as BillingPlan,
    priceId: candidate.priceId, activeSeats: candidate.activeSeats as number,
    membershipDigest: candidate.membershipDigest,
    providerAttempt: candidate.providerAttempt as number,
    providerAttemptedAt: candidate.providerAttemptedAt,
    providerSessionId: candidate.providerSessionId as string | null,
    providerCreatedAt: candidate.providerCreatedAt as string | null,
    untrustedProviderChronologyDigest: candidate.untrustedProviderChronologyDigest as string | null,
    providerCustomerId: candidate.providerCustomerId as string | null,
    providerSubscriptionId: candidate.providerSubscriptionId as string | null,
    state: candidate.state as CheckoutRecordUnsigned['state'], createdAt: candidate.createdAt,
    expiresAt: candidate.expiresAt as string | null, completedAt: candidate.completedAt as string | null,
  };
  if (Date.parse(unsigned.providerAttemptedAt) < Date.parse(unsigned.createdAt)
    || Date.parse(unsigned.providerAttemptedAt) > Date.parse(now)
    || (unsigned.state === 'prepared') !== (unsigned.providerSessionId === null)
    || (unsigned.state === 'prepared') !== (unsigned.providerCreatedAt === null)
    || (unsigned.state === 'prepared') !== (unsigned.expiresAt === null)
    || unsigned.state === 'prepared' && unsigned.untrustedProviderChronologyDigest !== null
    || unsigned.state === 'prepared' && (unsigned.providerCustomerId !== null
      || unsigned.providerSubscriptionId !== null || unsigned.completedAt !== null)
    || unsigned.state === 'ready' && (unsigned.providerSubscriptionId !== null || unsigned.completedAt !== null)
    || unsigned.state === 'completed' && (unsigned.providerCustomerId === null
      || unsigned.providerSubscriptionId === null || unsigned.completedAt === null)
    || unsigned.state !== 'prepared'
      && Date.parse(unsigned.providerCreatedAt as string) + 5 * 60 * 1_000 < Date.parse(unsigned.createdAt)
    || unsigned.state !== 'prepared'
      && Date.parse(unsigned.providerCreatedAt as string) > Date.parse(now) + 5 * 60 * 1_000
    || unsigned.state !== 'prepared' && Date.parse(unsigned.expiresAt as string) <= Date.parse(unsigned.providerCreatedAt as string)
    || unsigned.state !== 'prepared'
      && Date.parse(unsigned.expiresAt as string) - Date.parse(unsigned.providerCreatedAt as string) > CHECKOUT_MAX_DURATION_MS
    || unsigned.untrustedProviderChronologyDigest !== null && (
      unsigned.state === 'prepared'
      || unsigned.providerCustomerId === null
      || unsigned.providerCreatedAt !== unsigned.providerAttemptedAt
      || unsigned.expiresAt !== normalizedProviderExpiry(unsigned.providerAttemptedAt)
    )
    || unsigned.completedAt !== null && (Date.parse(unsigned.completedAt) < Date.parse(unsigned.providerCreatedAt as string)
      || Date.parse(unsigned.completedAt) > Date.parse(now))) throw unavailable();
  const binding = checkoutBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function checkoutSessionRecord(
  value: unknown,
  expected: {id: string; workspaceId: string; providerSessionId: string},
  secret: string | Uint8Array,
  now: string,
): CheckoutSessionRecordUnsigned & {binding: string} {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, checkoutSessionKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== expected.id
    || candidate.workspaceId !== expected.workspaceId || candidate.providerSessionId !== expected.providerSessionId
    || typeof candidate.checkoutId !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.checkoutId)
    || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)) throw unavailable();
  const unsigned: CheckoutSessionRecordUnsigned = {
    schemaVersion: 1, id: candidate.id, workspaceId: candidate.workspaceId,
    checkoutId: candidate.checkoutId, providerSessionId: candidate.providerSessionId,
    createdAt: candidate.createdAt,
  };
  const binding = checkoutSessionBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function checkoutLockRecord(
  value: unknown,
  expected: {workspaceId: string; ownerUserId: string},
  secret: string | Uint8Array,
  now: string,
): CheckoutLockRecordUnsigned & {binding: string} {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, checkoutLockKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== 'current'
    || candidate.workspaceId !== expected.workspaceId || candidate.ownerUserId !== expected.ownerUserId
    || typeof candidate.checkoutId !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.checkoutId)
    || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)) {
    throw unavailable();
  }
  const unsigned: CheckoutLockRecordUnsigned = {
    schemaVersion: 1, id: 'current', workspaceId: candidate.workspaceId,
    ownerUserId: candidate.ownerUserId, checkoutId: candidate.checkoutId,
    createdAt: candidate.createdAt,
  };
  const binding = checkoutLockBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function billingIdempotencyRecord(
  value: unknown,
  expected: {
    id: string;
    workspaceId: string;
    ownerUserId: string;
    targetUserId: string;
    source: WorkspacePrincipal['source'];
    auditId: string;
  },
  secret: string | Uint8Array,
  now: string,
): BillingIdempotencyRecordUnsigned & {binding: string} {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, billingIdempotencyKeys)
    || candidate.schemaVersion !== 1 || candidate.id !== expected.id
    || candidate.workspaceId !== expected.workspaceId || candidate.ownerUserId !== expected.ownerUserId
    || candidate.operation !== 'membership.remove' || candidate.targetUserId !== expected.targetUserId
    || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 2
    || candidate.source !== expected.source || candidate.auditId !== expected.auditId
    || typeof candidate.requestReference !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.requestReference)
    || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)) throw unavailable();
  const unsigned: BillingIdempotencyRecordUnsigned = {
    schemaVersion: 1, id: candidate.id, workspaceId: candidate.workspaceId,
    ownerUserId: candidate.ownerUserId, operation: 'membership.remove',
    targetUserId: candidate.targetUserId, outcomeRevision: candidate.outcomeRevision as number,
    source: candidate.source as WorkspacePrincipal['source'],
    requestReference: candidate.requestReference,
    auditId: candidate.auditId,
    createdAt: candidate.createdAt,
  };
  const binding = billingIdempotencyBinding(secret, unsigned);
  if (!equalDigest(candidate.binding, binding)) throw unavailable();
  return {...unsigned, binding};
}

function memberRemovalAudit(input: {
  workspaceId: string;
  ownerUserId: string;
  targetUserId: string;
  source: WorkspacePrincipal['source'];
  requestId: string;
  revisionBefore: number;
  revisionAfter: number;
  now: string;
  opaque: string;
}): HostedMutationAuditRecord {
  const audit: HostedMutationAuditRecord = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `audit:billing-member:${input.opaque}`,
    workspaceId: input.workspaceId,
    actor: {kind: 'user', id: `user:${input.ownerUserId}`},
    source: input.source,
    occurredAt: input.now,
    requestId: input.requestId,
    entity: {
      type: 'membership', id: input.targetUserId,
      revisionBefore: input.revisionBefore, revisionAfter: input.revisionAfter,
    },
    action: 'membership.remove',
    result: 'succeeded',
    changes: [{
      field: 'status',
      beforeSha256: sha256('active'),
      afterSha256: sha256('removed'),
    }],
  };
  assertHostedMutationAuditRecord(audit);
  return audit;
}

function assertMemberRemovalAudit(
  value: unknown,
  expected: {
    auditId: string;
    workspaceId: string;
    ownerUserId: string;
    targetUserId: string;
    source: WorkspacePrincipal['source'];
    outcomeRevision: number;
    createdAt: string;
    requestReference: string;
  },
  secret: string | Uint8Array,
): void {
  assertHostedMutationAuditRecord(value);
  const change = value.changes[0];
  if (value.id !== expected.auditId
    || value.workspaceId !== expected.workspaceId
    || value.actor.kind !== 'user' || value.actor.id !== `user:${expected.ownerUserId}`
    || value.source !== expected.source || value.occurredAt !== expected.createdAt
    || value.entity.type !== 'membership' || value.entity.id !== expected.targetUserId
    || value.entity.revisionBefore !== expected.outcomeRevision - 1
    || value.entity.revisionAfter !== expected.outcomeRevision
    || value.action !== 'membership.remove' || value.result !== 'succeeded'
    || value.changes.length !== 1 || change === undefined || change.field !== 'status'
    || change.beforeSha256 !== sha256('active') || change.afterSha256 !== sha256('removed')
    || !equalDigest(
      expected.requestReference,
      hmac(secret, 'billing-request-reference:v1', value.requestId),
    )) throw unavailable();
}

function isPaid(recordValue: BillingRecord | null, now: string): boolean {
  return recordValue !== null
    && recordValue.status === 'active'
    && Date.parse(recordValue.paidThrough) > Date.parse(now);
}

function isTerminalSubscriptionStatus(status: BillingProviderSubscriptionStatus): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}

function seatUpdateIdempotencyReference(
  secret: string | Uint8Array,
  input: {
    workspaceId: string;
    subscriptionId: string;
    billingRevision: number;
    membershipDigest: string;
  },
): string {
  return `seats:${hmac(secret, 'billing-provider-seat-update:v1', input)}`;
}

function entitlementMode(
  trial: TrialRecord,
  billing: BillingRecord | null,
  now: string,
  verificationAccess = false,
): EffectiveEntitlementMode {
  if (isPaid(billing, now)) return 'paid_pro';
  if (verificationAccess) return 'trial_pro';
  if (Date.parse(trial.trialEndsAt) > Date.parse(now)) return 'trial_pro';
  return 'free';
}

function assertBillingChronology(
  billing: BillingRecord | null,
  workspace: WorkspaceRecord,
  trial: TrialRecord,
  now: string,
): void {
  if (Date.parse(now) < Date.parse(workspace.createdAt)) throw unavailable();
  if (billing === null) return;
  if (Date.parse(billing.providerUpdatedAt) < Date.parse(workspace.createdAt)
    || Date.parse(billing.reconciledAt) < Date.parse(trial.trialStartedAt)
    || Date.parse(billing.reconciledAt) > Date.parse(now)) throw unavailable();
}

function validateProviderCheckoutIdentity(
  value: BillingProviderCheckoutSession,
  expected: CheckoutRecord,
): BillingProviderCheckoutSession {
  if (!safeReference(value.id) || value.checkoutReference !== expected.id
    || value.workspaceId !== expected.workspaceId
    || value.ownerUserId !== expected.ownerUserId || value.plan !== expected.plan
    || value.priceId !== expected.priceId || value.quantity !== expected.activeSeats
    || !['open', 'complete', 'expired'].includes(value.state)
    || value.url !== null && (!value.url.startsWith('https://') || value.url.length > 2_048)
    || value.customerId !== null && !safeReference(value.customerId)
    || value.subscriptionId !== null && !safeReference(value.subscriptionId)
    || !canonicalTimestamp(value.createdAt)
    || !canonicalTimestamp(value.expiresAt)
    || Date.parse(value.createdAt) + 5 * 60 * 1_000 < Date.parse(expected.createdAt)
    || Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
    || Date.parse(value.expiresAt) - Date.parse(value.createdAt) > CHECKOUT_MAX_DURATION_MS) throw unavailable();
  return clone(value);
}

function validateProviderCheckout(
  value: BillingProviderCheckoutSession,
  expected: CheckoutRecord,
): BillingProviderCheckoutSession {
  const validated = validateProviderCheckoutIdentity(value, expected);
  if (expected.untrustedProviderChronologyDigest === null) {
    if (expected.providerCreatedAt !== null && (
      validated.createdAt !== expected.providerCreatedAt
      || validated.expiresAt !== expected.expiresAt
    )) throw unavailable();
  } else if (validated.state !== 'complete'
    || validated.customerId === null
    || validated.subscriptionId === null
    || expected.providerCreatedAt !== expected.providerAttemptedAt
    || expected.expiresAt !== normalizedProviderExpiry(expected.providerAttemptedAt)
    || untrustedProviderChronologyDigest(validated) !== expected.untrustedProviderChronologyDigest) {
    throw unavailable();
  }
  return validated;
}

function validateProviderSubscription(
  value: BillingProviderSubscription,
  priceIds: Record<BillingPlan, string>,
): BillingProviderSubscription {
  if (!safeReference(value.id) || !safeReference(value.customerId)
    || !safeReference(value.workspaceId, 128) || !safeReference(value.ownerUserId, 128)
    || !validPlan(value.plan) || value.priceId !== priceIds[value.plan]
    || !Number.isSafeInteger(value.quantity) || value.quantity < 1
    || !validProviderStatus(value.status) || value.automaticTaxEnabled !== true
    || !canonicalTimestamp(value.currentPeriodEnd)
    || typeof value.cancelAtPeriodEnd !== 'boolean' || !canonicalTimestamp(value.providerUpdatedAt)
    || value.status === 'active'
      && Date.parse(value.currentPeriodEnd) <= Date.parse(value.providerUpdatedAt)) throw unavailable();
  return clone(value);
}

function subscriptionUpdateExpectation(
  value: BillingProviderSubscription,
): BillingProviderSubscriptionUpdateExpectation {
  if (value.status !== 'active') throw unavailable();
  return {
    customerId: value.customerId,
    workspaceId: value.workspaceId,
    ownerUserId: value.ownerUserId,
    plan: value.plan,
    priceId: value.priceId,
    quantity: value.quantity,
    status: 'active',
    currentPeriodEnd: value.currentPeriodEnd,
    cancelAtPeriodEnd: value.cancelAtPeriodEnd,
  };
}

function assertSubscriptionUpdateResult(
  expected: BillingProviderSubscription,
  actual: BillingProviderSubscription,
  quantity: number,
): void {
  if (expected.status !== 'active'
    || actual.id !== expected.id
    || actual.customerId !== expected.customerId
    || actual.workspaceId !== expected.workspaceId
    || actual.ownerUserId !== expected.ownerUserId
    || actual.plan !== expected.plan
    || actual.priceId !== expected.priceId
    || actual.status !== 'active'
    || actual.quantity !== quantity
    || actual.currentPeriodEnd !== expected.currentPeriodEnd
    || actual.cancelAtPeriodEnd !== expected.cancelAtPeriodEnd) throw conflict();
}

function assertProviderCheckoutWriteChronology(
  value: BillingProviderCheckoutSession,
  now: string,
): void {
  if (Date.parse(value.createdAt) > Date.parse(now) + 5 * 60 * 1_000) throw conflict();
}

function providerCheckoutPersistenceChronology(
  value: BillingProviderCheckoutSession,
  checkout: CheckoutRecord,
  now: string,
): Pick<CheckoutRecordUnsigned, 'providerCreatedAt' | 'expiresAt' | 'untrustedProviderChronologyDigest'> {
  if (Date.parse(value.createdAt) <= Date.parse(now) + 5 * 60 * 1_000) {
    assertProviderCheckoutWriteChronology(value, now);
    return {
      providerCreatedAt: value.createdAt,
      expiresAt: value.expiresAt,
      untrustedProviderChronologyDigest: null,
    };
  }
  if (value.state !== 'complete' || value.customerId === null || value.subscriptionId === null) throw conflict();
  return {
    providerCreatedAt: checkout.providerAttemptedAt,
    expiresAt: normalizedProviderExpiry(checkout.providerAttemptedAt),
    untrustedProviderChronologyDigest: untrustedProviderChronologyDigest(value),
  };
}

function trialEndedEvent(
  workspaceId: string,
  occurredAt: string,
  receivedAt: string,
  opaque: string,
): HostedProductEvent {
  const event: HostedProductEvent = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `event:trial-ended:${opaque}`,
    name: 'trial.ended',
    source: 'system',
    occurredAt,
    receivedAt,
    workspaceId,
    actor: {kind: 'system', id: 'system:billing'},
    requestId: `billing:${opaque}`,
    correlationId: `billing:${sha256(workspaceId).slice(0, 32)}`,
    attributes: {eligible: true},
  };
  assertHostedProductEvent(event);
  return event;
}

function assertMatchingTrialEndedEvent(value: unknown, expected: HostedProductEvent): void {
  assertHostedProductEvent(value);
  if (value.name !== 'trial.ended'
    || value.id !== expected.id
    || value.workspaceId !== expected.workspaceId
    || value.occurredAt !== expected.occurredAt
    || value.source !== 'system'
    || Date.parse(value.receivedAt) > Date.parse(expected.receivedAt)
    || value.actor.kind !== 'system'
    || value.actor.id !== 'system:billing'
    || value.requestId !== expected.requestId
    || value.correlationId !== expected.correlationId
    || value.attributes.eligible !== true) throw unavailable();
}

function subscriptionActivatedEvent(
  provider: VerifiedBillingNotice['provider'],
  workspaceId: string,
  plan: BillingPlan,
  seats: number,
  eventId: string,
  now: string,
  opaque: string,
): HostedProductEvent {
  const eventReference = sha256(eventId).slice(0, 64);
  const event: HostedProductEvent = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `event:subscription:${opaque}`,
    name: 'subscription.activated',
    source: provider,
    occurredAt: now,
    receivedAt: now,
    workspaceId,
    actor: {kind: provider, id: `${provider}:event:${eventReference}`},
    requestId: `${provider}:${eventReference}`,
    correlationId: `billing:${sha256(workspaceId).slice(0, 32)}`,
    attributes: {plan, activeSeats: seats, amountMicrousd: billingPrices[plan].amountMicrousd * seats},
  };
  assertHostedProductEvent(event);
  return event;
}

function assertMatchingSubscriptionActivatedEvent(
  value: unknown,
  expected: HostedProductEvent,
): void {
  assertHostedProductEvent(value);
  if (value.name !== 'subscription.activated'
    || expected.name !== 'subscription.activated'
    || value.id !== expected.id
    || value.workspaceId !== expected.workspaceId
    || value.source !== expected.source
    || value.actor.kind !== expected.actor.kind
    || value.actor.id !== expected.actor.id
    || value.requestId !== expected.requestId
    || value.correlationId !== expected.correlationId
    || Date.parse(value.receivedAt) > Date.parse(expected.receivedAt)
    || value.attributes.amountMicrousd
      !== billingPrices[value.attributes.plan].amountMicrousd * value.attributes.activeSeats) {
    throw unavailable();
  }
}

function sameBillingState(
  value: BillingRecord | null,
  subscription: BillingProviderSubscription,
): boolean {
  return value !== null
    && value.customerId === subscription.customerId
    && value.subscriptionId === subscription.id
    && value.plan === subscription.plan
    && value.status === subscription.status
    && value.priceId === subscription.priceId
    && value.activeSeats === subscription.quantity
    && value.paidThrough === subscription.currentPeriodEnd
    && value.cancelAtPeriodEnd === subscription.cancelAtPeriodEnd;
}

export class BillingEntitlementPolicy implements WorkspaceMutationEntitlementPolicy {
  readonly #secret: string | Uint8Array;
  readonly #priceIds: Record<BillingPlan, string>;

  constructor(options: Pick<BillingServiceOptions, 'secret' | 'monthlyPriceId' | 'annualPriceId'>) {
    this.#secret = validSecret(options.secret);
    this.#priceIds = validPriceIds(options.monthlyPriceId, options.annualPriceId);
  }

  async assertMutation(input: {
    transaction: BillingEntitlementTransaction;
    workspaceId: string;
    principal: WorkspacePrincipal;
    grant: WorkspaceAuthorizationGrant;
    operation: EntitledMutationOperation;
    now: string;
    assigneeUserId?: string | null;
  }): Promise<EffectiveEntitlementMode> {
    try {
      const expectedAction: Record<EntitledMutationOperation, WorkspaceAuthorizationGrant['action']> = {
        'team.create': 'workspace.settings.manage',
        'team.update': 'workspace.settings.manage',
        'workflow_status.create': 'workspace.settings.manage',
        'workflow_status.update': 'workspace.settings.manage',
        'cycle.create': 'milestone.write',
        'cycle.update': 'milestone.write',
        'saved_view.create': 'issue.write',
        'saved_view.update': 'issue.write',
        'project.create': 'project.write',
        'project.update': 'project.write',
        'milestone.create': 'milestone.write',
        'milestone.update': 'milestone.write',
        'issue.create': 'issue.write',
        'issue.update': 'issue.write',
        'issue.assign': 'issue.write',
        'comment.create': 'comment.write',
        'comment.edit': 'comment.write',
        'comment.delete': 'comment.write',
        'invitation.create': 'invitation.manage',
        'invitation.resend': 'invitation.manage',
        'invitation.revoke': 'invitation.manage',
        'invitation.accept': 'invitation.manage',
        'token.create': 'token.manage',
        'token.revoke': 'token.manage',
        'automation.execute': 'automation.execute',
      };
      if (!canonicalTimestamp(input.now) || input.grant.workspaceId !== input.workspaceId
        || input.grant.userId !== input.principal.userId
        || input.grant.action !== expectedAction[input.operation]
        || Object.hasOwn(input, 'assigneeUserId') !== (input.operation === 'issue.assign')) throw unavailable();
      const [rawWorkspace, rawTrial, rawBilling, rawVerificationAccess, rawMemberships] = await Promise.all([
        input.transaction.get(paths.workspace(input.workspaceId)),
        input.transaction.get(paths.trial(input.workspaceId)),
        input.transaction.get(paths.billing(input.workspaceId)),
        input.transaction.get(paths.verificationAccess(input.workspaceId)),
        input.transaction.list(paths.memberships(input.workspaceId)),
      ]);
      const workspace = workspaceRecord(rawWorkspace, input.workspaceId);
      const trial = trialRecord(rawTrial, input.workspaceId, workspace.createdAt);
      if (Date.parse(input.now) < Date.parse(workspace.createdAt)) throw unavailable();
      const members = activeMemberships(rawMemberships, input.workspaceId, input.now);
      if (members.find((member) => member.role === 'owner')?.userId !== workspace.ownerUid) throw unavailable();
      const billing = billingRecord(rawBilling, input.workspaceId, this.#secret, this.#priceIds);
      const verificationAccess = verificationAccessRecord(
        rawVerificationAccess,
        {workspaceId: input.workspaceId, ownerUserId: workspace.ownerUid},
        this.#secret,
        input.now,
      );
      assertBillingChronology(billing, workspace, trial, input.now);
      const mode = entitlementMode(
        trial,
        billing,
        input.now,
        activeVerificationAccess(verificationAccess, input.now),
      );
      if (mode === 'paid_pro' && billing?.activeSeats !== members.length) {
        throw new BillingServiceError(
          'BILLING_FORBIDDEN',
          'Paid writes are paused until the trusted active-seat quantity is reconciled.',
        );
      }
      if (mode !== 'free') return mode;
      const ownerInteractive = input.principal.kind === 'user'
        && input.grant.role === 'owner'
        && input.grant.userId === workspace.ownerUid;
      const recoveryAssignment = input.operation === 'issue.assign'
        && (input.assigneeUserId === null || input.assigneeUserId === workspace.ownerUid);
      const allowed = ownerInteractive && (
        input.operation === 'project.create'
        || input.operation === 'project.update'
        || input.operation === 'milestone.create'
        || input.operation === 'milestone.update'
        || input.operation === 'issue.create'
        || input.operation === 'issue.update'
        || input.operation === 'comment.create'
        || input.operation === 'comment.edit'
        || input.operation === 'comment.delete'
        || input.operation === 'invitation.revoke'
        || input.operation === 'token.revoke'
        || recoveryAssignment
      );
      if (!allowed) {
        throw new BillingServiceError(
          'BILLING_FORBIDDEN',
          'This workspace is on Free. Subscribe or reduce the workspace to continue this write.',
        );
      }
      return mode;
    } catch (error) {
      if (error instanceof BillingServiceError) throw error;
      throw unavailable();
    }
  }
}

function validSecret(value: string | Uint8Array): string | Uint8Array {
  const length = typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.byteLength;
  if (length < 32 || length > 512) throw new Error('Billing secret must contain 32 to 512 bytes.');
  return value;
}

function validPriceIds(monthly: string, annual: string): Record<BillingPlan, string> {
  if (!safeReference(monthly) || !safeReference(annual) || monthly === annual) {
    throw new Error('Distinct server-owned billing price references are required.');
  }
  return {monthly, annual};
}

export class BillingService implements BillingSeatReconciler {
  readonly #repository: BillingRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #provider: BillingProvider;
  readonly #secret: string | Uint8Array;
  readonly #priceIds: Record<BillingPlan, string>;
  readonly #activationPolicy: BillingActivationPolicy;
  readonly #clock: () => Date;

  async #assertCheckoutAllowedForWorkspace(workspaceId: string, ownerUserId: string): Promise<void> {
    const verificationActive = await this.#repository.runTransaction(async (transaction) => {
      const now = trustedNow(this.#clock);
      const rawWorkspace = await transaction.get(paths.workspace(workspaceId));
      const workspace = workspaceRecord(rawWorkspace, workspaceId);
      if (workspace.ownerUid !== ownerUserId) throw unavailable();
      const value = verificationAccessRecord(
        await transaction.get(paths.verificationAccess(workspaceId)),
        {workspaceId, ownerUserId},
        this.#secret,
        now,
      );
      return activeVerificationAccess(value, now);
    });
    if (verificationActive) {
      throw new BillingServiceError(
        'BILLING_FORBIDDEN',
        'This verification workspace already has no-charge Pro access. Checkout is disabled.',
      );
    }
  }

  async #assertPaidActivationAllowed(input: {
    workspaceId: string;
    ownerUserId: string;
    requestId: string;
  }): Promise<void> {
    try {
      await this.#activationPolicy.assertBillingActivationAllowed(input);
    } catch {
      throw unavailable();
    }
  }

  constructor(
    repository: BillingRepository,
    authorization: WorkspaceAuthorizationService,
    provider: BillingProvider,
    options: BillingServiceOptions,
  ) {
    this.#repository = repository;
    this.#authorization = authorization;
    this.#provider = provider;
    this.#secret = validSecret(options.secret);
    this.#priceIds = validPriceIds(options.monthlyPriceId, options.annualPriceId);
    this.#activationPolicy = options.activationPolicy;
    this.#clock = options.clock ?? (() => new Date());
  }

  entitlementPolicy(): BillingEntitlementPolicy {
    return new BillingEntitlementPolicy({
      secret: this.#secret,
      monthlyPriceId: this.#priceIds.monthly,
      annualPriceId: this.#priceIds.annual,
    });
  }

  async ensureVerificationAccess(input: {
    workspaceId: string;
    ownerUserId: string;
    ownerEmail: string;
  }): Promise<{endsAt: typeof VERIFICATION_ACCESS_ENDS_AT; created: boolean}> {
    const workspaceId = safeWorkspaceId(input.workspaceId);
    const ownerUserId = input.ownerUserId.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    if (!safeReference(ownerUserId, 128)
      || ownerEmail.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(ownerEmail)) throw invalidRequest();
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const [rawWorkspace, rawTrial, rawBilling, rawOwner, rawVerificationAccess] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)),
          transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)),
          transaction.get(`workspaces/${workspaceId}/memberships/${ownerUserId}`),
          transaction.get(paths.verificationAccess(workspaceId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        const owner = storedMembershipRecord(rawOwner, workspaceId);
        assertBillingChronology(billing, workspace, trial, now);
        if (workspace.ownerUid !== ownerUserId || owner.userId !== ownerUserId
          || owner.role !== 'owner' || owner.status !== 'active'
          || Date.parse(owner.createdAt) > Date.parse(now)
          || billing !== null) throw unavailable();
        const ownerEmailSha256 = sha256(ownerEmail);
        const existing = verificationAccessRecord(
          rawVerificationAccess,
          {workspaceId, ownerUserId},
          this.#secret,
          now,
        );
        if (existing !== null) {
          if (existing.ownerEmailSha256 !== ownerEmailSha256) throw unavailable();
          return {endsAt: VERIFICATION_ACCESS_ENDS_AT, created: false};
        }
        const unsigned: VerificationAccessRecordUnsigned = {
          schemaVersion: 1,
          id: 'current',
          workspaceId,
          ownerUserId,
          ownerEmailSha256,
          source: 'operator_allowlist',
          endsAt: VERIFICATION_ACCESS_ENDS_AT,
          createdAt: now,
          revision: 1,
        };
        transaction.create(paths.verificationAccess(workspaceId), {
          ...unsigned,
          binding: verificationAccessBinding(this.#secret, unsigned),
        });
        return {endsAt: VERIFICATION_ACCESS_ENDS_AT, created: true};
      });
    } catch (error) {
      if (error instanceof BillingServiceError) throw error;
      throw unavailable();
    }
  }

  async summary(input: {principal: WorkspacePrincipal; workspaceId: string; requestId: string}): Promise<BillingSummary> {
    const workspaceId = safeWorkspaceId(input.workspaceId);
    await this.#authorizeOwner(input.principal, workspaceId, input.requestId);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const trialEventOpaque = sha256(`trial-ended:${workspaceId}`).slice(0, 32);
        const trialEventId = `event:trial-ended:${trialEventOpaque}`;
        const [
          rawWorkspace,
          rawTrial,
          rawBilling,
          rawVerificationAccess,
          rawMemberships,
          rawInvitations,
          rawTrialEvent,
        ] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)), transaction.get(paths.verificationAccess(workspaceId)),
          transaction.list(paths.memberships(workspaceId)),
          transaction.list(paths.invitations(workspaceId)), transaction.get(paths.event(workspaceId, trialEventId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const members = activeMemberships(rawMemberships, workspaceId, now);
        const owner = members.find((value) => value.role === 'owner');
        if (owner?.userId !== workspace.ownerUid) throw unavailable();
        const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        const verificationAccess = verificationAccessRecord(
          rawVerificationAccess,
          {workspaceId, ownerUserId: workspace.ownerUid},
          this.#secret,
          now,
        );
        assertBillingChronology(billing, workspace, trial, now);
        const verificationActive = activeVerificationAccess(verificationAccess, now);
        const mode = entitlementMode(trial, billing, now, verificationActive);
        if (Date.parse(trial.trialEndsAt) <= Date.parse(now)) {
          const event = trialEndedEvent(workspaceId, trial.trialEndsAt, now, trialEventOpaque);
          if (rawTrialEvent === null) transaction.create(paths.event(workspaceId, event.id), {...event});
          else assertMatchingTrialEndedEvent(rawTrialEvent, event);
        } else if (rawTrialEvent !== null) {
          throw unavailable();
        }
        return {
          workspaceId,
          mode,
          trial: {startedAt: trial.trialStartedAt, endsAt: trial.trialEndsAt, active: Date.parse(trial.trialEndsAt) > Date.parse(now)},
          seats: {active: members.length, pendingInvitations: pendingInvitations(rawInvitations, workspaceId, now)},
          prices: {
            currency: 'usd', monthlyPerSeatCents: 200, annualPerSeatCents: 1200,
            monthlyTotalCents: billingPrices.monthly.amountCents * members.length,
            annualTotalCents: billingPrices.annual.amountCents * members.length,
          },
          subscription: billing === null ? null : {
            plan: billing.plan, status: billing.status, activeSeats: billing.activeSeats,
            paidThrough: billing.paidThrough, cancelAtPeriodEnd: billing.cancelAtPeriodEnd,
          },
          ...(verificationActive ? {verificationAccess: {
            source: 'operator_allowlist' as const,
            endsAt: VERIFICATION_ACCESS_ENDS_AT,
            noCharge: true as const,
          }} : {}),
          free: {
            writerUserId: workspace.ownerUid, dataReadable: true,
            exportEligible: true, exportAvailable: true,
            extraMemberWritesPaused: true, automationWritesPaused: true,
          },
        };
      });
    } catch (error) {
      if (error instanceof BillingServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async createCheckout(input: {
    principal: WorkspacePrincipal;
    workspaceId: string;
    requestId: string;
    idempotencyKey: string;
    plan: BillingPlan;
  }): Promise<BillingCheckoutResult> {
    const workspaceId = safeWorkspaceId(input.workspaceId);
    if (!validPlan(input.plan)) throw invalidRequest();
    const idempotencyKey = safeIdempotencyKey(input.idempotencyKey);
    const grant = await this.#authorizeOwner(input.principal, workspaceId, input.requestId);
    await this.#assertCheckoutAllowedForWorkspace(workspaceId, grant.userId);
    await this.#assertPaidActivationAllowed({
      workspaceId,
      ownerUserId: grant.userId,
      requestId: input.requestId,
    });
    const checkoutId = hmac(this.#secret, 'billing-checkout-id:v1', {
      workspaceId,
      ownerUserId: grant.userId,
      idempotencyKey,
    });
    const checkoutPath = paths.checkout(workspaceId, checkoutId);
    let preparation: CheckoutRecord;
    try {
      await this.reconcileWorkspaceSeats(workspaceId);
      const prepare = (replaceCheckoutId: string | null): Promise<CheckoutPreparation> => (
        this.#repository.runTransaction(async (transaction) => {
          const now = trustedNow(this.#clock);
          const [rawWorkspace, rawTrial, rawBilling, rawMemberships, rawCheckout, rawLock] = await Promise.all([
            transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
            transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
            transaction.get(checkoutPath), transaction.get(paths.checkoutLock(workspaceId)),
          ]);
          const workspace = workspaceRecord(rawWorkspace, workspaceId);
          const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
          if (workspace.ownerUid !== grant.userId || Date.parse(now) < Date.parse(workspace.createdAt)) throw unavailable();
          const currentBilling = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
          assertBillingChronology(currentBilling, workspace, trial, now);
          if (isPaid(currentBilling, now)) {
            throw new BillingServiceError('BILLING_CONFLICT', 'This workspace already has active paid Pro access.');
          }
          if (currentBilling !== null && !isTerminalSubscriptionStatus(currentBilling.status)) {
            throw new BillingServiceError(
              'BILLING_CONFLICT',
              'Resolve or cancel the existing provider subscription before starting another Checkout.',
            );
          }
          const members = activeMemberships(rawMemberships, workspaceId, now);
          const fingerprint = membershipFingerprint(members);
          const existing = rawCheckout === null ? null : checkoutRecord(
            rawCheckout,
            {id: checkoutId, workspaceId, ownerUserId: grant.userId},
            this.#secret,
            now,
          );
          let lock: ReturnType<typeof checkoutLockRecord> | null = null;
          if (rawLock !== null) {
            lock = checkoutLockRecord(rawLock, {workspaceId, ownerUserId: grant.userId}, this.#secret, now);
          }
          if (existing !== null && lock?.checkoutId !== existing.id) throw unavailable();
          if (lock === null && existing !== null) throw unavailable();
          if (lock !== null && lock.checkoutId !== checkoutId) {
            if (existing !== null) throw unavailable();
            const locked = checkoutRecord(
              await transaction.get(paths.checkout(workspaceId, lock.checkoutId)),
              {id: lock.checkoutId, workspaceId, ownerUserId: grant.userId},
              this.#secret,
              now,
            );
            if (locked.createdAt !== lock.createdAt) throw unavailable();
            if (locked.state !== 'completed' && replaceCheckoutId !== locked.id) {
              return {kind: 'blocked', checkout: locked};
            }
            if (locked.state !== 'completed' && (
              locked.state !== 'ready'
              || locked.providerSessionId === null
              || replaceCheckoutId !== locked.id
            )) throw conflict();
          } else if (replaceCheckoutId !== null) {
            throw conflict();
          }
          if (existing !== null) {
            if (existing.plan !== input.plan || existing.priceId !== this.#priceIds[input.plan]) {
              throw new BillingServiceError('BILLING_CONFLICT', 'The idempotency key is already in use.');
            }
            if (existing.state !== 'prepared'
              && (existing.membershipDigest !== fingerprint || existing.activeSeats !== members.length)) throw conflict();
            return {kind: 'checkout', checkout: existing};
          }
          const unsigned: CheckoutRecordUnsigned = {
            schemaVersion: 1, id: checkoutId, workspaceId, ownerUserId: grant.userId,
            plan: input.plan, priceId: this.#priceIds[input.plan], activeSeats: members.length,
            membershipDigest: fingerprint, providerAttempt: 1, providerAttemptedAt: now,
            providerSessionId: null, providerCreatedAt: null, untrustedProviderChronologyDigest: null,
            providerCustomerId: null,
            providerSubscriptionId: null, state: 'prepared', createdAt: now, expiresAt: null,
            completedAt: null,
          };
          const value = {...unsigned, binding: checkoutBinding(this.#secret, unsigned)};
          const lockUnsigned: CheckoutLockRecordUnsigned = {
            schemaVersion: 1, id: 'current', workspaceId, ownerUserId: grant.userId,
            checkoutId, createdAt: now,
          };
          transaction.create(checkoutPath, value);
          transaction.set(paths.checkoutLock(workspaceId), {
            ...lockUnsigned,
            binding: checkoutLockBinding(this.#secret, lockUnsigned),
          });
          return {kind: 'checkout', checkout: value};
        })
      );
      let prepared = await prepare(null);
      if (prepared.kind === 'blocked') {
        const blocked = prepared.checkout;
        if (blocked.state !== 'ready' || blocked.providerSessionId === null) {
          throw new BillingServiceError(
            'BILLING_CONFLICT',
            'Another Checkout is already being prepared for this workspace.',
          );
        }
        let blockedSession = validateProviderCheckout(
          await this.#provider.retrieveCheckoutSession(blocked.providerSessionId),
          blocked,
        );
        if (blockedSession.state === 'complete') {
          throw new BillingServiceError(
            'BILLING_CONFLICT',
            'A completed Checkout is awaiting signed provider confirmation.',
          );
        }
        if (blockedSession.state === 'open') {
          if (Date.parse(blockedSession.expiresAt) > Date.parse(trustedNow(this.#clock))) {
            throw new BillingServiceError(
              'BILLING_CONFLICT',
              'Another Checkout is still open for this workspace.',
            );
          }
          await this.#provider.expireCheckoutSession(blockedSession.id);
          blockedSession = validateProviderCheckout(
            await this.#provider.retrieveCheckoutSession(blocked.providerSessionId),
            blocked,
          );
        }
        if (blockedSession.state !== 'expired') throw conflict();
        prepared = await prepare(blocked.id);
        if (prepared.kind !== 'checkout') throw conflict();
      }
      preparation = prepared.checkout;

      const rearmPreparedCheckout = (expected: CheckoutRecord): Promise<CheckoutRecord> => (
        this.#repository.runTransaction(async (transaction) => {
          const now = trustedNow(this.#clock);
          const [rawWorkspace, rawTrial, rawBilling, rawMemberships, rawCheckout, rawLock] = await Promise.all([
            transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
            transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
            transaction.get(checkoutPath), transaction.get(paths.checkoutLock(workspaceId)),
          ]);
          const workspace = workspaceRecord(rawWorkspace, workspaceId);
          const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
          const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
          assertBillingChronology(billing, workspace, trial, now);
          if (workspace.ownerUid !== grant.userId || isPaid(billing, now)
            || billing !== null && !isTerminalSubscriptionStatus(billing.status)) throw conflict();
          const current = checkoutRecord(
            rawCheckout,
            {id: checkoutId, workspaceId, ownerUserId: grant.userId},
            this.#secret,
            now,
          );
          const lock = checkoutLockRecord(rawLock, {workspaceId, ownerUserId: grant.userId}, this.#secret, now);
          if (lock.checkoutId !== current.id || lock.createdAt !== current.createdAt
            || current.plan !== input.plan || current.priceId !== this.#priceIds[input.plan]) throw unavailable();
          if (current.state !== 'prepared'
            || current.providerAttempt !== expected.providerAttempt
            || current.providerAttemptedAt !== expected.providerAttemptedAt) return current;
          if (Date.parse(now) - Date.parse(current.providerAttemptedAt) < CHECKOUT_MAX_DURATION_MS) return current;
          const members = activeMemberships(rawMemberships, workspaceId, now);
          const unsigned: CheckoutRecordUnsigned = {
            ...current,
            activeSeats: members.length,
            membershipDigest: membershipFingerprint(members),
            providerAttempt: current.providerAttempt + 1,
            providerAttemptedAt: now,
          };
          const {binding: _binding, ...withoutBinding} = unsigned as CheckoutRecord;
          const rearmed = {...withoutBinding, binding: checkoutBinding(this.#secret, withoutBinding)};
          transaction.set(checkoutPath, rearmed);
          return rearmed;
        })
      );

      let recoveredSession: BillingProviderCheckoutSession | null = null;
      if (preparation.state === 'prepared'
        && Date.parse(trustedNow(this.#clock)) - Date.parse(preparation.providerAttemptedAt) >= CHECKOUT_MAX_DURATION_MS) {
        const recovered = await this.#provider.recoverCheckoutSessions({
          checkoutReference: checkoutId,
          createdAt: preparation.createdAt,
          attemptedAt: preparation.providerAttemptedAt,
        });
        if (new Set(recovered.map((session) => session.id)).size !== recovered.length) throw unavailable();
        const completed: BillingProviderCheckoutSession[] = [];
        for (const rawSession of recovered) {
          let candidate = validateProviderCheckoutIdentity(rawSession, preparation);
          if (candidate.state === 'open') {
            await this.#provider.expireCheckoutSession(candidate.id);
            candidate = validateProviderCheckoutIdentity(
              await this.#provider.retrieveCheckoutSession(candidate.id),
              preparation,
            );
          }
          if (candidate.state === 'complete') completed.push(candidate);
          else if (candidate.state !== 'expired') throw unavailable();
        }
        if (completed.length > 1) throw unavailable();
        if (completed.length === 1) recoveredSession = completed[0] as BillingProviderCheckoutSession;
        else preparation = await rearmPreparedCheckout(preparation);
      }

      let providerSession: BillingProviderCheckoutSession;
      if (recoveredSession !== null) {
        providerSession = recoveredSession;
      } else if (preparation.providerSessionId === null) {
        await this.#assertPaidActivationAllowed({
          workspaceId,
          ownerUserId: grant.userId,
          requestId: input.requestId,
        });
        providerSession = await this.#provider.createCheckoutSession({
          attemptedAt: preparation.providerAttemptedAt,
          checkoutReference: checkoutId,
          workspaceId, ownerUserId: grant.userId, plan: preparation.plan,
          priceId: preparation.priceId, quantity: preparation.activeSeats,
          idempotencyReference: `checkout:${hmac(this.#secret, 'billing-provider-attempt:v1', {
            checkoutId,
            providerAttempt: preparation.providerAttempt,
            providerAttemptedAt: preparation.providerAttemptedAt,
          })}`,
        });
      } else {
        providerSession = await this.#provider.retrieveCheckoutSession(preparation.providerSessionId);
      }
      providerSession = validateProviderCheckout(providerSession, preparation);

      if (preparation.state === 'prepared') {
        if ((providerSession.state === 'open' && providerSession.url === null)
          || (providerSession.state === 'complete'
            && (providerSession.customerId === null || providerSession.subscriptionId === null))) throw unavailable();
        const providerSessionBindingId = sha256(providerSession.id);
        try {
          preparation = await this.#repository.runTransaction(async (transaction) => {
            const now = trustedNow(this.#clock);
            const [rawCheckout, rawMemberships, rawSessionBinding, rawLock] = await Promise.all([
              transaction.get(checkoutPath), transaction.list(paths.memberships(workspaceId)),
              transaction.get(paths.checkoutSession(workspaceId, providerSessionBindingId)),
              transaction.get(paths.checkoutLock(workspaceId)),
            ]);
            const current = checkoutRecord(rawCheckout, {id: checkoutId, workspaceId, ownerUserId: grant.userId}, this.#secret, now);
            const lock = checkoutLockRecord(rawLock, {workspaceId, ownerUserId: grant.userId}, this.#secret, now);
            const members = activeMemberships(rawMemberships, workspaceId, now);
            const persistenceChronology = providerCheckoutPersistenceChronology(providerSession, current, now);
            const seatsChanged = current.membershipDigest !== membershipFingerprint(members)
              || current.activeSeats !== members.length;
            if (current.plan !== input.plan
              || current.providerAttempt !== preparation.providerAttempt
              || current.providerAttemptedAt !== preparation.providerAttemptedAt
              || seatsChanged && providerSession.state !== 'complete'
              || lock.checkoutId !== current.id || lock.createdAt !== current.createdAt) throw conflict();
            if (current.state === 'ready') {
              if (current.providerSessionId !== providerSession.id) throw unavailable();
              const storedBinding = checkoutSessionRecord(rawSessionBinding, {
                id: providerSessionBindingId, workspaceId, providerSessionId: providerSession.id,
              }, this.#secret, now);
              if (storedBinding.checkoutId !== current.id || storedBinding.createdAt !== current.createdAt) throw unavailable();
              return current;
            }
            if (current.state !== 'prepared') throw conflict();
            if (rawSessionBinding !== null) throw unavailable();
            const unsigned: CheckoutRecordUnsigned = {
              ...current,
              providerSessionId: providerSession.id,
              providerCreatedAt: persistenceChronology.providerCreatedAt,
              untrustedProviderChronologyDigest: persistenceChronology.untrustedProviderChronologyDigest,
              providerCustomerId: providerSession.customerId,
              providerSubscriptionId: null,
              state: 'ready',
              expiresAt: persistenceChronology.expiresAt,
              completedAt: null,
            };
            const {binding: _discarded, ...withoutBinding} = unsigned as CheckoutRecord;
            const ready = {...withoutBinding, binding: checkoutBinding(this.#secret, withoutBinding)};
            const sessionBindingUnsigned: CheckoutSessionRecordUnsigned = {
              schemaVersion: 1, id: providerSessionBindingId, workspaceId,
              checkoutId: current.id, providerSessionId: providerSession.id,
              createdAt: current.createdAt,
            };
            transaction.set(checkoutPath, ready);
            transaction.create(paths.checkoutSession(workspaceId, providerSessionBindingId), {
              ...sessionBindingUnsigned,
              binding: checkoutSessionBinding(this.#secret, sessionBindingUnsigned),
            });
            return ready;
          });
        } catch (error) {
          try {
            await this.#provider.expireCheckoutSession(providerSession.id);
            const expiredSession = validateProviderCheckout(
              await this.#provider.retrieveCheckoutSession(providerSession.id),
              preparation,
            );
            if (expiredSession.state !== 'expired') throw conflict();
            const expiredSessionBindingId = sha256(expiredSession.id);
            await this.#repository.runTransaction(async (transaction) => {
              const now = trustedNow(this.#clock);
              const [rawCheckout, rawLock, rawSessionBinding] = await Promise.all([
                transaction.get(checkoutPath), transaction.get(paths.checkoutLock(workspaceId)),
                transaction.get(paths.checkoutSession(workspaceId, expiredSessionBindingId)),
              ]);
              const current = checkoutRecord(
                rawCheckout,
                {id: checkoutId, workspaceId, ownerUserId: grant.userId},
                this.#secret,
                now,
              );
              const lock = checkoutLockRecord(rawLock, {workspaceId, ownerUserId: grant.userId}, this.#secret, now);
              const persistenceChronology = providerCheckoutPersistenceChronology(expiredSession, current, now);
              if (current.state !== 'prepared' || rawSessionBinding !== null
                || current.providerAttempt !== preparation.providerAttempt
                || current.providerAttemptedAt !== preparation.providerAttemptedAt
                || lock.checkoutId !== current.id || lock.createdAt !== current.createdAt) throw conflict();
              const expiredUnsigned: CheckoutRecordUnsigned = {
                ...current,
                providerSessionId: expiredSession.id,
                providerCreatedAt: persistenceChronology.providerCreatedAt,
                untrustedProviderChronologyDigest: persistenceChronology.untrustedProviderChronologyDigest,
                providerCustomerId: expiredSession.customerId,
                providerSubscriptionId: null,
                state: 'ready',
                expiresAt: persistenceChronology.expiresAt,
                completedAt: null,
              };
              const {binding: _expiredBinding, ...expiredWithoutBinding} = expiredUnsigned as CheckoutRecord;
              const sessionBindingUnsigned: CheckoutSessionRecordUnsigned = {
                schemaVersion: 1, id: expiredSessionBindingId, workspaceId,
                checkoutId: current.id, providerSessionId: expiredSession.id,
                createdAt: current.createdAt,
              };
              transaction.set(checkoutPath, {
                ...expiredWithoutBinding,
                binding: checkoutBinding(this.#secret, expiredWithoutBinding),
              });
              transaction.create(paths.checkoutSession(workspaceId, expiredSessionBindingId), {
                ...sessionBindingUnsigned,
                binding: checkoutSessionBinding(this.#secret, sessionBindingUnsigned),
              });
            });
          } catch {
            // The original failure remains authoritative and is returned redacted below.
          }
          throw error;
        }
      }

      if (preparation.providerSessionId === null || preparation.expiresAt === null) throw unavailable();
      providerSession = validateProviderCheckout(
        await this.#provider.retrieveCheckoutSession(preparation.providerSessionId),
        preparation,
      );
      if (providerSession.state !== 'open' || providerSession.url === null
        || providerSession.expiresAt !== preparation.expiresAt
        || Date.parse(providerSession.expiresAt) <= Date.parse(trustedNow(this.#clock))) throw conflict();
      return {
        checkoutSessionId: providerSession.id,
        checkoutUrl: providerSession.url,
        plan: preparation.plan,
        activeSeats: preparation.activeSeats,
        totalCents: billingPrices[preparation.plan].amountCents * preparation.activeSeats,
        currency: 'usd',
        expiresAt: preparation.expiresAt,
      };
    } catch (error) {
      if (error instanceof BillingServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async removeMember(input: {
    principal: WorkspacePrincipal;
    workspaceId: string;
    requestId: string;
    idempotencyKey: string;
    userId: string;
  }): Promise<BillingMemberRemovalResult> {
    const workspaceId = safeWorkspaceId(input.workspaceId);
    const userId = input.userId.trim();
    const requestId = input.requestId.trim();
    const idempotencyKey = safeIdempotencyKey(input.idempotencyKey);
    if (!safeReference(userId, 128) || !safeReference(requestId, 128)) {
      throw invalidRequest();
    }
    const grant = await this.#authorization.authorize({
      principal: input.principal,
      workspaceId,
      action: 'membership.manage',
      targetEntityType: 'membership',
      targetEntityId: userId,
      requestId,
    });
    if (grant.role !== 'owner' || grant.userId === userId) throw invalidRequest();
    const id = hmac(this.#secret, 'billing-idempotency-id:v1', {
      workspaceId, ownerUserId: grant.userId, operation: 'membership.remove', idempotencyKey,
    });
    const auditId = `audit:billing-member:${id.slice(0, 32)}`;
    try {
      const result = await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const [
          rawWorkspace,
          rawTrial,
          rawBilling,
          rawVerificationAccess,
          rawOwner,
          rawTarget,
          rawIdempotency,
          rawMemberships,
          rawAudit,
        ] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)),
          transaction.get(paths.verificationAccess(workspaceId)),
          transaction.get(`workspaces/${workspaceId}/memberships/${grant.userId}`),
          transaction.get(`workspaces/${workspaceId}/memberships/${userId}`),
          transaction.get(paths.idempotency(workspaceId, id)),
          transaction.list(paths.memberships(workspaceId)),
          transaction.get(paths.audit(workspaceId, auditId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        const verificationAccess = verificationAccessRecord(
          rawVerificationAccess,
          {workspaceId, ownerUserId: workspace.ownerUid},
          this.#secret,
          now,
        );
        assertBillingChronology(billing, workspace, trial, now);
        if (input.principal.kind === 'personal_token'
          && entitlementMode(
            trial,
            billing,
            now,
            activeVerificationAccess(verificationAccess, now),
          ) === 'free') {
          throw new BillingServiceError(
            'BILLING_FORBIDDEN',
            'Automation writes are paused while this workspace is on Free.',
          );
        }
        const owner = storedMembershipRecord(rawOwner, workspaceId);
        const target = storedMembershipRecord(rawTarget, workspaceId);
        const members = activeMemberships(rawMemberships, workspaceId, now);
        if (workspace.ownerUid !== grant.userId || owner.userId !== grant.userId
          || owner.role !== 'owner' || owner.status !== 'active'
          || target.userId !== userId || target.role !== 'member'
          || Date.parse(owner.createdAt) > Date.parse(now)
          || Date.parse(target.createdAt) > Date.parse(now)) throw unavailable();
        if (rawIdempotency !== null) {
          const replay = billingIdempotencyRecord(rawIdempotency, {
            id, workspaceId, ownerUserId: grant.userId, targetUserId: userId,
            source: input.principal.source, auditId,
          }, this.#secret, now);
          if (target.status !== 'removed' || target.updatedAt !== replay.createdAt
            || target.removedAt !== replay.createdAt || target.revision !== replay.outcomeRevision) throw unavailable();
          assertMemberRemovalAudit(rawAudit, {
            auditId: replay.auditId,
            workspaceId,
            ownerUserId: grant.userId,
            targetUserId: userId,
            source: replay.source,
            outcomeRevision: replay.outcomeRevision,
            createdAt: replay.createdAt,
            requestReference: replay.requestReference,
          }, this.#secret);
          return {changed: false, userId, activeSeats: members.length};
        }
        if (rawAudit !== null) throw unavailable();
        if (target.status === 'removed') return {changed: false, userId, activeSeats: members.length};
        const after = {
          ...target,
          status: 'removed' as const,
          updatedAt: now,
          removedAt: now,
          revision: target.revision + 1,
        };
        const idempotencyUnsigned: BillingIdempotencyRecordUnsigned = {
          schemaVersion: 1, id, workspaceId, ownerUserId: grant.userId,
          operation: 'membership.remove', targetUserId: userId,
          outcomeRevision: after.revision, source: input.principal.source,
          requestReference: hmac(this.#secret, 'billing-request-reference:v1', requestId),
          auditId,
          createdAt: now,
        };
        const audit = memberRemovalAudit({
          workspaceId, ownerUserId: grant.userId, targetUserId: userId,
          source: input.principal.source, requestId,
          revisionBefore: target.revision, revisionAfter: after.revision,
          now, opaque: id.slice(0, 32),
        });
        transaction.set(`workspaces/${workspaceId}/memberships/${userId}`, after);
        transaction.create(paths.idempotency(workspaceId, id), {
          ...idempotencyUnsigned,
          binding: billingIdempotencyBinding(this.#secret, idempotencyUnsigned),
        });
        transaction.create(paths.audit(workspaceId, auditId), {...audit});
        return {changed: true, userId, activeSeats: members.length - 1};
      });
      await this.reconcileWorkspaceSeats(workspaceId);
      return result;
    } catch (error) {
      if (error instanceof BillingServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async reconcileNotice(notice: VerifiedBillingNotice): Promise<BillingSummary> {
    if (!['stripe', 'creem'].includes(notice.provider) || !safeReference(notice.eventId, 180)
      || !canonicalTimestamp(notice.eventCreatedAt)
      || notice.subscriptionId === null && notice.checkoutSessionId === null
      || notice.subscriptionId !== null && !safeReference(notice.subscriptionId)
      || notice.checkoutSessionId !== null && !safeReference(notice.checkoutSessionId)) throw invalidRequest();
    try {
      let subscriptionId = notice.subscriptionId;
      let completedSession: BillingProviderCheckoutSession | null = null;
      if (notice.checkoutSessionId !== null) {
        completedSession = await this.#provider.retrieveCheckoutSession(notice.checkoutSessionId);
        if (completedSession.state !== 'complete' || completedSession.subscriptionId === null
          || completedSession.customerId === null
          || subscriptionId !== null && subscriptionId !== completedSession.subscriptionId) throw unavailable();
        subscriptionId = completedSession.subscriptionId;
      }
      if (subscriptionId === null) throw unavailable();
      let subscription = validateProviderSubscription(
        await this.#provider.retrieveSubscription(subscriptionId),
        this.#priceIds,
      );
      const workspaceId = safeWorkspaceId(subscription.workspaceId);
      const preflight = await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const [rawWorkspace, rawTrial, rawBilling, rawMemberships] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        trialRecord(rawTrial, workspaceId, workspace.createdAt);
        if (workspace.ownerUid !== subscription.ownerUserId
          || Date.parse(subscription.providerUpdatedAt) > Date.parse(now)
          || subscription.status === 'active'
            && Date.parse(subscription.currentPeriodEnd) <= Date.parse(now)) throw unavailable();
        const current = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        assertBillingChronology(current, workspace, trialRecord(rawTrial, workspaceId, workspace.createdAt), now);
        const replacingSubscription = current !== null
          && (current.subscriptionId !== subscription.id || current.customerId !== subscription.customerId);
        if (replacingSubscription && (isPaid(current, now) || completedSession === null)) throw unavailable();
        if (current === null && completedSession === null) throw unavailable();
        const checkout = completedSession === null ? null : await this.#checkoutForCompletedSession(
          transaction,
          workspaceId,
          subscription.ownerUserId,
          completedSession,
          subscription,
          notice.eventCreatedAt,
          now,
          false,
        );
        if (replacingSubscription && (checkout === null
          || current === null
          || Date.parse(checkout.createdAt) < Date.parse(current.reconciledAt))) throw unavailable();
        const members = activeMemberships(rawMemberships, workspaceId, now);
        return {
          activeSeats: members.length,
          fingerprint: membershipFingerprint(members),
          checkoutId: checkout?.id ?? null,
          billingRevision: current?.revision ?? 0,
        };
      });
      const reconcileQuantity = subscription.status === 'active';
      if (reconcileQuantity && subscription.quantity !== preflight.activeSeats) {
        const expectedSubscription = subscription;
        subscription = validateProviderSubscription(await this.#provider.updateSubscriptionQuantity({
          subscriptionId: subscription.id,
          expected: subscriptionUpdateExpectation(expectedSubscription),
          quantity: preflight.activeSeats,
          idempotencyReference: seatUpdateIdempotencyReference(this.#secret, {
            workspaceId,
            subscriptionId: subscription.id,
            billingRevision: preflight.billingRevision,
            membershipDigest: preflight.fingerprint,
          }),
          prorationBehavior: 'create_prorations',
        }), this.#priceIds);
        assertSubscriptionUpdateResult(expectedSubscription, subscription, preflight.activeSeats);
      }
      if (subscription.workspaceId !== workspaceId
        || (reconcileQuantity && subscription.quantity !== preflight.activeSeats)) throw conflict();

      const eventReference = hmac(this.#secret, `${notice.provider}-event:v1`, notice.eventId);
      const webhookId = sha256(eventReference);
      const activationOpaque = sha256(`${notice.eventId}:${workspaceId}`).slice(0, 32);
      const activationEventId = `event:subscription:${activationOpaque}`;
      await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const trialEventOpaque = sha256(`trial-ended:${workspaceId}`).slice(0, 32);
        const trialEventId = `event:trial-ended:${trialEventOpaque}`;
        const [
          rawWorkspace,
          rawTrial,
          rawBilling,
          rawMemberships,
          rawWebhook,
          rawTrialEvent,
          rawActivationEvent,
        ] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
          transaction.get(paths.webhook(workspaceId, webhookId)),
          transaction.get(paths.event(workspaceId, trialEventId)),
          transaction.get(paths.event(workspaceId, activationEventId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const before = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        assertBillingChronology(before, workspace, trial, now);
        const members = activeMemberships(rawMemberships, workspaceId, now);
        if (workspace.ownerUid !== subscription.ownerUserId || subscription.workspaceId !== workspaceId
          || (reconcileQuantity && subscription.quantity !== members.length)
          || subscription.priceId !== this.#priceIds[subscription.plan]) {
          throw unavailable();
        }
        if (before === null && completedSession === null) throw unavailable();
        const checkout = completedSession === null ? null : await this.#checkoutForCompletedSession(
          transaction,
          workspaceId,
          subscription.ownerUserId,
          completedSession,
          subscription,
          notice.eventCreatedAt,
          now,
          true,
        );
        const replacingSubscription = before !== null
          && (before.subscriptionId !== subscription.id || before.customerId !== subscription.customerId);
        if (replacingSubscription && (isPaid(before, now) || checkout === null
          || Date.parse(checkout.createdAt) < Date.parse(before.reconciledAt))) throw unavailable();
        if ((checkout?.id ?? null) !== preflight.checkoutId) throw unavailable();
        if (Date.parse(subscription.providerUpdatedAt) > Date.parse(now)
          || Date.parse(subscription.providerUpdatedAt) < Date.parse(workspace.createdAt)
          || subscription.status === 'active'
            && Date.parse(subscription.currentPeriodEnd) <= Date.parse(now)
          || Date.parse(notice.eventCreatedAt) < Date.parse(workspace.createdAt)
          || Date.parse(notice.eventCreatedAt) > Date.parse(now) + 5 * 60 * 1_000
          || before !== null && Date.parse(subscription.providerUpdatedAt) < Date.parse(before.providerUpdatedAt)) {
          throw unavailable();
        }
        if (rawWebhook !== null) {
          const candidate = record(rawWebhook);
          if (candidate === null || !exactKeys(candidate, webhookKeys)
            || candidate.schemaVersion !== 1
            || candidate.id !== webhookId || candidate.workspaceId !== workspaceId
            || candidate.eventReference !== eventReference || candidate.subscriptionId !== subscription.id
            || candidate.eventCreatedAt !== notice.eventCreatedAt
            || !canonicalTimestamp(candidate.eventCreatedAt)
            || !canonicalTimestamp(candidate.providerUpdatedAt) || !canonicalTimestamp(candidate.reconciledAt)
            || Date.parse(candidate.providerUpdatedAt) > Date.parse(candidate.reconciledAt)
            || Date.parse(candidate.eventCreatedAt) > Date.parse(candidate.reconciledAt) + 5 * 60 * 1_000
            || Date.parse(candidate.reconciledAt) > Date.parse(now)
            || !Number.isSafeInteger(candidate.billingRevision)
            || (candidate.billingRevision as number) < 1
            || before === null
            || (candidate.billingRevision as number) > before.revision) throw unavailable();
          const unsigned: WebhookRecordUnsigned = {
            schemaVersion: 1, id: webhookId, workspaceId, eventReference,
            eventCreatedAt: candidate.eventCreatedAt,
            subscriptionId: subscription.id, providerUpdatedAt: candidate.providerUpdatedAt,
            reconciledAt: candidate.reconciledAt, billingRevision: candidate.billingRevision as number,
          };
          if (!equalDigest(candidate.binding, webhookBinding(this.#secret, unsigned))) throw unavailable();
        }
        const after: BillingRecord = before !== null && sameBillingState(before, subscription) ? before : (() => {
          const unsigned: BillingRecordUnsigned = {
            schemaVersion: 1, id: 'current', workspaceId,
            customerId: subscription.customerId, subscriptionId: subscription.id,
            plan: subscription.plan, status: subscription.status, priceId: subscription.priceId,
            activeSeats: subscription.quantity, paidThrough: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            providerUpdatedAt: subscription.providerUpdatedAt, reconciledAt: now,
            revision: (before?.revision ?? 0) + 1,
          };
          return {...unsigned, binding: billingBinding(this.#secret, unsigned)};
        })();
        if (after !== before) transaction.set(paths.billing(workspaceId), {...after});
        if (checkout !== null && checkout.state === 'ready') {
          const completedUnsigned: CheckoutRecordUnsigned = {
            ...checkout,
            providerCustomerId: subscription.customerId,
            providerSubscriptionId: subscription.id,
            state: 'completed',
            completedAt: now,
          };
          const {binding: _checkoutBinding, ...withoutBinding} = completedUnsigned as CheckoutRecord;
          transaction.set(paths.checkout(workspaceId, checkout.id), {
            ...withoutBinding,
            binding: checkoutBinding(this.#secret, withoutBinding),
          });
        }
        if (rawWebhook === null) {
          const webhookUnsigned: WebhookRecordUnsigned = {
            schemaVersion: 1, id: webhookId, workspaceId, eventReference,
            eventCreatedAt: notice.eventCreatedAt,
            subscriptionId: subscription.id, providerUpdatedAt: subscription.providerUpdatedAt,
            reconciledAt: now, billingRevision: after.revision,
          };
          transaction.create(paths.webhook(workspaceId, webhookId), {
            ...webhookUnsigned, binding: webhookBinding(this.#secret, webhookUnsigned),
          });
        }
        const beforePaid = isPaid(before, now);
        const afterPaid = isPaid(after, now);
        if (!beforePaid && afterPaid) {
          const event = subscriptionActivatedEvent(
            notice.provider,
            workspaceId,
            after.plan,
            after.activeSeats,
            notice.eventId,
            now,
            activationOpaque,
          );
          if (rawActivationEvent === null) transaction.create(paths.event(workspaceId, event.id), {...event});
          else assertMatchingSubscriptionActivatedEvent(rawActivationEvent, event);
        } else if (rawActivationEvent !== null) {
          const event = subscriptionActivatedEvent(
            notice.provider,
            workspaceId,
            after.plan,
            after.activeSeats,
            notice.eventId,
            now,
            activationOpaque,
          );
          assertMatchingSubscriptionActivatedEvent(rawActivationEvent, event);
        }
        if (Date.parse(trial.trialEndsAt) <= Date.parse(now)) {
          const event = trialEndedEvent(workspaceId, trial.trialEndsAt, now, trialEventOpaque);
          if (rawTrialEvent === null) transaction.create(paths.event(workspaceId, event.id), {...event});
          else assertMatchingTrialEndedEvent(rawTrialEvent, event);
        } else if (rawTrialEvent !== null) {
          throw unavailable();
        }
      });

      return this.#systemSummary(workspaceId);
    } catch (error) {
      if (error instanceof BillingServiceError) throw error;
      throw unavailable();
    }
  }

  async reconcileWorkspaceSeats(workspaceIdInput: string): Promise<void> {
    const workspaceId = safeWorkspaceId(workspaceIdInput);
    try {
      const preflight = await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const [rawWorkspace, rawTrial, rawBilling, rawMemberships] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        assertBillingChronology(billing, workspace, trial, now);
        const members = activeMemberships(rawMemberships, workspaceId, now);
        return billing === null ? null : {
          workspace,
          billing,
          activeSeats: members.length,
          fingerprint: membershipFingerprint(members),
          checkedAt: now,
        };
      });
      if (preflight === null) return;
      let subscription = validateProviderSubscription(
        await this.#provider.retrieveSubscription(preflight.billing.subscriptionId),
        this.#priceIds,
      );
      const providerCheckedAt = trustedNow(this.#clock);
      if (subscription.id !== preflight.billing.subscriptionId
        || subscription.customerId !== preflight.billing.customerId
        || subscription.workspaceId !== workspaceId
        || subscription.ownerUserId !== preflight.workspace.ownerUid
        || subscription.plan !== preflight.billing.plan
        || subscription.priceId !== preflight.billing.priceId
        || Date.parse(providerCheckedAt) < Date.parse(preflight.checkedAt)
        || Date.parse(subscription.providerUpdatedAt) > Date.parse(providerCheckedAt)
        || subscription.status === 'active'
          && Date.parse(subscription.currentPeriodEnd) <= Date.parse(providerCheckedAt)) throw unavailable();
      const reconcileQuantity = subscription.status === 'active';
      if (reconcileQuantity && subscription.quantity !== preflight.activeSeats) {
        const expectedSubscription = subscription;
        subscription = validateProviderSubscription(await this.#provider.updateSubscriptionQuantity({
          subscriptionId: subscription.id,
          expected: subscriptionUpdateExpectation(expectedSubscription),
          quantity: preflight.activeSeats,
          idempotencyReference: seatUpdateIdempotencyReference(this.#secret, {
            workspaceId,
            subscriptionId: subscription.id,
            billingRevision: preflight.billing.revision,
            membershipDigest: preflight.fingerprint,
          }),
          prorationBehavior: 'create_prorations',
        }), this.#priceIds);
        assertSubscriptionUpdateResult(expectedSubscription, subscription, preflight.activeSeats);
      }
      if (reconcileQuantity && subscription.quantity !== preflight.activeSeats) throw conflict();
      await this.#repository.runTransaction(async (transaction) => {
        const now = trustedNow(this.#clock);
        const [rawWorkspace, rawTrial, rawBilling, rawMemberships] = await Promise.all([
          transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
          transaction.get(paths.billing(workspaceId)), transaction.list(paths.memberships(workspaceId)),
        ]);
        const workspace = workspaceRecord(rawWorkspace, workspaceId);
        const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
        const before = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
        assertBillingChronology(before, workspace, trial, now);
        const members = activeMemberships(rawMemberships, workspaceId, now);
        if (before === null || before.revision !== preflight.billing.revision
          || before.subscriptionId !== subscription.id || before.customerId !== subscription.customerId
          || subscription.workspaceId !== workspaceId
          || workspace.ownerUid !== subscription.ownerUserId
          || subscription.plan !== preflight.billing.plan
          || subscription.priceId !== preflight.billing.priceId
          || reconcileQuantity && subscription.status !== 'active'
          || reconcileQuantity && (
            membershipFingerprint(members) !== preflight.fingerprint
            || members.length !== subscription.quantity
          )
          || Date.parse(now) < Date.parse(providerCheckedAt)
          || Date.parse(subscription.providerUpdatedAt) > Date.parse(now)
          || subscription.status === 'active'
            && Date.parse(subscription.currentPeriodEnd) <= Date.parse(now)
          || Date.parse(subscription.providerUpdatedAt) < Date.parse(before.providerUpdatedAt)) throw conflict();
        if (!sameBillingState(before, subscription)) {
          const unsigned: BillingRecordUnsigned = {
            schemaVersion: 1, id: 'current', workspaceId,
            customerId: subscription.customerId, subscriptionId: subscription.id,
            plan: subscription.plan, status: subscription.status, priceId: subscription.priceId,
            activeSeats: subscription.quantity, paidThrough: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            providerUpdatedAt: subscription.providerUpdatedAt, reconciledAt: now,
            revision: before.revision + 1,
          };
          transaction.set(paths.billing(workspaceId), {
            ...unsigned,
            binding: billingBinding(this.#secret, unsigned),
          });
        }
      });
    } catch (error) {
      if (error instanceof BillingServiceError) throw error;
      throw unavailable();
    }
  }

  async #systemSummary(workspaceId: string): Promise<BillingSummary> {
    return this.#repository.runTransaction(async (transaction) => {
      const now = trustedNow(this.#clock);
      const [rawWorkspace, rawTrial, rawBilling, rawVerificationAccess, rawMemberships, rawInvitations] = await Promise.all([
        transaction.get(paths.workspace(workspaceId)), transaction.get(paths.trial(workspaceId)),
        transaction.get(paths.billing(workspaceId)), transaction.get(paths.verificationAccess(workspaceId)),
        transaction.list(paths.memberships(workspaceId)),
        transaction.list(paths.invitations(workspaceId)),
      ]);
      const workspace = workspaceRecord(rawWorkspace, workspaceId);
      const trial = trialRecord(rawTrial, workspaceId, workspace.createdAt);
      const billing = billingRecord(rawBilling, workspaceId, this.#secret, this.#priceIds);
      const verificationAccess = verificationAccessRecord(
        rawVerificationAccess,
        {workspaceId, ownerUserId: workspace.ownerUid},
        this.#secret,
        now,
      );
      assertBillingChronology(billing, workspace, trial, now);
      const members = activeMemberships(rawMemberships, workspaceId, now);
      const verificationActive = activeVerificationAccess(verificationAccess, now);
      return {
        workspaceId, mode: entitlementMode(trial, billing, now, verificationActive),
        trial: {startedAt: trial.trialStartedAt, endsAt: trial.trialEndsAt, active: Date.parse(trial.trialEndsAt) > Date.parse(now)},
        seats: {active: members.length, pendingInvitations: pendingInvitations(rawInvitations, workspaceId, now)},
        prices: {currency: 'usd', monthlyPerSeatCents: 200, annualPerSeatCents: 1200,
          monthlyTotalCents: 200 * members.length, annualTotalCents: 1200 * members.length},
        subscription: billing === null ? null : {plan: billing.plan, status: billing.status,
          activeSeats: billing.activeSeats, paidThrough: billing.paidThrough, cancelAtPeriodEnd: billing.cancelAtPeriodEnd},
        ...(verificationActive ? {verificationAccess: {
          source: 'operator_allowlist' as const,
          endsAt: VERIFICATION_ACCESS_ENDS_AT,
          noCharge: true as const,
        }} : {}),
        free: {writerUserId: workspace.ownerUid, dataReadable: true,
          exportEligible: true, exportAvailable: true,
          extraMemberWritesPaused: true, automationWritesPaused: true},
      };
    });
  }

  async #authorizeOwner(
    principal: WorkspacePrincipal,
    workspaceId: string,
    requestIdInput: string,
  ): Promise<WorkspaceAuthorizationGrant> {
    const requestId = requestIdInput.trim();
    if (!safeReference(requestId, 128)) throw invalidRequest();
    const grant = await this.#authorization.authorize({
      principal, workspaceId, action: 'billing.manage', targetEntityType: 'billing',
      targetEntityId: 'current', requestId,
    });
    if (grant.role !== 'owner') throw new BillingServiceError('BILLING_FORBIDDEN', 'Billing access is unavailable.');
    return grant;
  }

  async #checkoutForCompletedSession(
    transaction: BillingTransaction,
    workspaceId: string,
    ownerUserId: string,
    session: BillingProviderCheckoutSession,
    subscription: BillingProviderSubscription,
    eventCreatedAt: string,
    now: string,
    persistRecoveredBinding: boolean,
  ): Promise<CheckoutRecord> {
    const bindingId = sha256(session.id);
    const rawSessionBinding = await transaction.get(paths.checkoutSession(workspaceId, bindingId));
    let sessionBinding: CheckoutSessionRecordUnsigned & {binding: string};
    let checkout: CheckoutRecord;
    let recoveredBinding: {
      checkout: CheckoutRecord;
      sessionBinding: CheckoutSessionRecordUnsigned & {binding: string};
    } | null = null;
    if (rawSessionBinding === null) {
      if (!/^[a-f0-9]{64}$/u.test(session.checkoutReference)) throw unavailable();
      const [rawCheckout, rawLock] = await Promise.all([
        transaction.get(paths.checkout(workspaceId, session.checkoutReference)),
        transaction.get(paths.checkoutLock(workspaceId)),
      ]);
      const prepared = checkoutRecord(
        rawCheckout,
        {id: session.checkoutReference, workspaceId, ownerUserId},
        this.#secret,
        now,
      );
      const lock = checkoutLockRecord(rawLock, {workspaceId, ownerUserId}, this.#secret, now);
      validateProviderCheckoutIdentity(session, prepared);
      if (prepared.state !== 'prepared'
        || lock.checkoutId !== prepared.id
        || lock.createdAt !== prepared.createdAt
        || session.state !== 'complete'
        || session.customerId === null
        || session.subscriptionId === null) throw unavailable();
      const persistenceChronology = providerCheckoutPersistenceChronology(session, prepared, now);
      const readyUnsigned: CheckoutRecordUnsigned = {
        ...prepared,
        providerSessionId: session.id,
        providerCreatedAt: persistenceChronology.providerCreatedAt,
        untrustedProviderChronologyDigest: persistenceChronology.untrustedProviderChronologyDigest,
        providerCustomerId: session.customerId,
        providerSubscriptionId: null,
        state: 'ready',
        expiresAt: persistenceChronology.expiresAt,
        completedAt: null,
      };
      const {binding: _preparedBinding, ...withoutBinding} = readyUnsigned as CheckoutRecord;
      checkout = {...withoutBinding, binding: checkoutBinding(this.#secret, withoutBinding)};
      const sessionBindingUnsigned: CheckoutSessionRecordUnsigned = {
        schemaVersion: 1,
        id: bindingId,
        workspaceId,
        checkoutId: checkout.id,
        providerSessionId: session.id,
        createdAt: checkout.createdAt,
      };
      sessionBinding = {
        ...sessionBindingUnsigned,
        binding: checkoutSessionBinding(this.#secret, sessionBindingUnsigned),
      };
      recoveredBinding = {checkout, sessionBinding};
    } else {
      sessionBinding = checkoutSessionRecord(rawSessionBinding, {
        id: bindingId, workspaceId, providerSessionId: session.id,
      }, this.#secret, now);
      checkout = checkoutRecord(
        await transaction.get(paths.checkout(workspaceId, sessionBinding.checkoutId)),
        {id: sessionBinding.checkoutId, workspaceId, ownerUserId},
        this.#secret,
        now,
      );
      validateProviderCheckout(session, checkout);
    }
    const eventAfterTrustedExpiry = checkout.untrustedProviderChronologyDigest === null
      && Date.parse(eventCreatedAt) > Date.parse(checkout.expiresAt as string) + 5 * 60 * 1_000;
    if ((checkout.state !== 'ready' && checkout.state !== 'completed')
      || checkout.providerSessionId !== session.id
      || session.state !== 'complete'
      || session.customerId !== subscription.customerId
      || session.subscriptionId !== subscription.id
      || checkout.state === 'ready' && (
        session.plan !== subscription.plan
        || session.priceId !== subscription.priceId
      )
      || sessionBinding.checkoutId !== checkout.id
      || sessionBinding.createdAt !== checkout.createdAt
      || Date.parse(eventCreatedAt) < Date.parse(checkout.createdAt)
      || Date.parse(eventCreatedAt) > Date.parse(now) + 5 * 60 * 1_000
      || eventAfterTrustedExpiry
      || checkout.state === 'completed' && (
        checkout.providerCustomerId !== subscription.customerId
        || checkout.providerSubscriptionId !== subscription.id
        || checkout.completedAt === null
      )) throw unavailable();
    if (recoveredBinding !== null && persistRecoveredBinding) {
      transaction.set(paths.checkout(workspaceId, recoveredBinding.checkout.id), {...recoveredBinding.checkout});
      transaction.create(paths.checkoutSession(workspaceId, bindingId), {...recoveredBinding.sessionBinding});
    }
    return checkout;
  }
}

export class MemoryBillingRepository implements BillingRepository {
  readonly #documents: Map<string, unknown>;
  #queue: Promise<void> = Promise.resolve();

  constructor(seed: Record<string, unknown> = {}) {
    this.#documents = new Map(Object.entries(seed).map(([path, value]) => [path, clone(value)]));
  }

  runTransaction<Value>(operation: (transaction: BillingTransaction) => Promise<Value>): Promise<Value> {
    const result = this.#queue.then(async () => {
      const working = new Map([...this.#documents.entries()].map(([path, value]) => [path, clone(value)]));
      const transaction: BillingTransaction = {
        get: async (path) => working.has(path) ? clone(working.get(path)) : null,
        list: async (collectionPath) => {
          const prefix = `${collectionPath}/`;
          const values = [...working.entries()]
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([, value]) => clone(value));
          if (values.length > hostedOperationsPolicyV1.queries.maximumTransactionListRecords) {
            throw new Error('BILLING_QUERY_BUDGET_EXCEEDED');
          }
          return values;
        },
        create: (path, value) => {
          if (working.has(path)) throw new Error('ALREADY_EXISTS');
          working.set(path, clone(value));
        },
        set: (path, value) => { working.set(path, clone(value)); },
      };
      const value = await operation(transaction);
      this.#documents.clear();
      for (const [path, document] of working) this.#documents.set(path, clone(document));
      return clone(value);
    });
    this.#queue = result.then(() => undefined, () => undefined);
    return result;
  }

  seedDocument(path: string, value: Record<string, unknown>): void {
    this.#documents.set(path, clone(value));
  }

  readDocument(path: string): unknown | null {
    return this.#documents.has(path) ? clone(this.#documents.get(path)) : null;
  }

  snapshot(): Record<string, unknown> {
    return Object.fromEntries([...this.#documents.entries()].map(([path, value]) => [path, clone(value)]));
  }
}
