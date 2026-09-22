import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  assertHostedEconomicsRecord,
  deduplicateHostedEconomics,
  type HostedEconomicsRecord,
} from './measurement-contract.js';
import {
  hostedOperationsPolicyDigest,
  hostedOperationsPolicyV1,
  sealedHostedOperationsPolicy,
  type HostedOperationsPolicy,
} from './operations-control.js';

export const hostedCostReportSchemaVersion = 'basiclinear.hosted-cost-per-paid-seat.v1' as const;
export const hostedRestoreDrillSchemaVersion = 'basiclinear.hosted-restore-drill.v1' as const;

export interface HostedOperationsTransaction {
  get(path: string): Promise<unknown | null>;
  create(path: string, value: Record<string, unknown>): void;
  set(path: string, value: Record<string, unknown>): void;
}

export interface HostedOperationsRepository {
  runTransaction<Value>(
    operation: (transaction: HostedOperationsTransaction) => Promise<Value>,
  ): Promise<Value>;
}

export class MemoryHostedOperationsRepository implements HostedOperationsRepository {
  readonly #documents = new Map<string, Record<string, unknown>>();
  #queue: Promise<void> = Promise.resolve();

  runTransaction<Value>(
    operation: (transaction: HostedOperationsTransaction) => Promise<Value>,
  ): Promise<Value> {
    const pending = this.#queue.then(async () => {
      const staged = new Map<string, {mode: 'create' | 'set'; value: Record<string, unknown>}>();
      const transaction: HostedOperationsTransaction = {
        get: async (path) => {
          const stagedValue = staged.get(path);
          if (stagedValue !== undefined) return structuredClone(stagedValue.value);
          const value = this.#documents.get(path);
          return value === undefined ? null : structuredClone(value);
        },
        create: (path, value) => {
          if (this.#documents.has(path) || staged.has(path)) {
            throw new Error('DOCUMENT_ALREADY_EXISTS');
          }
          staged.set(path, {mode: 'create', value: structuredClone(value)});
        },
        set: (path, value) => {
          staged.set(path, {mode: 'set', value: structuredClone(value)});
        },
      };
      const result = await operation(transaction);
      for (const [path, entry] of staged) {
        this.#documents.set(path, structuredClone(entry.value));
      }
      return structuredClone(result);
    });
    this.#queue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  seed(path: string, value: Record<string, unknown>): void {
    this.#documents.set(path, structuredClone(value));
  }

  snapshot(): Readonly<Record<string, Record<string, unknown>>> {
    return Object.fromEntries([...this.#documents.entries()].map(([path, value]) => (
      [path, structuredClone(value)]
    )));
  }
}

export class HostedOperationsServiceError extends Error {
  constructor(
    readonly code:
      | 'OPERATIONS_ACTIVATION_BLOCKED'
      | 'OPERATIONS_UNAVAILABLE'
      | 'INVALID_BUDGET_NOTICE'
      | 'INVALID_OPERATIONS_REVIEW'
      | 'INVALID_COST_REPORT'
      | 'INVALID_RESTORE_DRILL',
    message: string,
  ) {
    super(message);
    this.name = 'HostedOperationsServiceError';
  }
}

export interface BillingActivationPolicy {
  assertBillingActivationAllowed(input: {
    workspaceId: string;
    ownerUserId: string;
    requestId: string;
  }): Promise<void>;
}

export interface HostedCostPerPaidSeatReport {
  schemaVersion: typeof hostedCostReportSchemaVersion;
  id: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  evidenceClass: 'synthetic_fixture' | 'production_baseline';
  claimBoundary: 'guardrail_only_no_outcome_claim';
  workspaceCount: number;
  activePaidSeats: number;
  variableCostMicrousd: number;
  recognizedRevenueMicrousd: number;
  variableCostPerPaidSeatMicrousd: number | null;
  recognizedRevenuePerPaidSeatMicrousd: number | null;
  variableCostShareBasisPoints: number | null;
  maximumVariableCostShareBasisPoints: number;
  decision: 'allow' | 'stop';
  workspaceSetDigest: string;
  economicsDigest: string;
  reportDigest: string;
}

export interface HostedOperationsProviderReferences {
  budgetDisplayName: string;
  billingAccountId: string;
  budgetId: string;
  pubsubSubscription: string;
  cloudRunService: string;
  cloudArmorPolicy: string;
  billingExportDataset: string;
  backupBucket: string;
  restoreProject: string;
}

export interface HostedOperationsActivationReviewInput {
  reviewId: string;
  environment: 'uat' | 'production';
  reviewedAt: string;
  expiresAt: string;
  budgetIntervalStart: string;
  providerReferences: HostedOperationsProviderReferences;
  paidWorkspaceIds: readonly string[];
  economics: readonly HostedEconomicsRecord[];
  costReport: HostedCostPerPaidSeatReport;
}

export interface HostedBudgetNoticeInput {
  messageId: string;
  publishTime: string;
  subscription: string;
  billingAccountId: string;
  budgetId: string;
  schemaVersion: '1.0';
  budgetDisplayName: string;
  costAmount: number;
  costIntervalStart: string;
  budgetAmount: number;
  budgetAmountType: 'SPECIFIED_AMOUNT';
  currencyCode: 'USD';
  alertThresholdExceeded: number | null;
  forecastThresholdExceeded: number | null;
}

export interface HostedBudgetNoticeResult {
  changed: boolean;
  currentUpdated: boolean;
  severity: 'healthy' | 'notice' | 'warning' | 'critical';
}

interface ActivationRecordUnsigned {
  schemaVersion: 1;
  id: 'current';
  environment: 'uat' | 'production';
  policyDigest: string;
  reviewIdDigest: string;
  providerReferenceDigests: Record<keyof HostedOperationsProviderReferences, string>;
  costReportDigest: string;
  costReportEvidenceClass: HostedCostPerPaidSeatReport['evidenceClass'];
  costReportDecision: 'allow';
  budgetAmountMicrousd: number;
  reviewedAt: string;
  expiresAt: string;
  revision: number;
}

interface ActivationRecord extends ActivationRecordUnsigned {
  binding: string;
}

interface BudgetStateUnsigned {
  schemaVersion: 1;
  id: 'current';
  environment: 'uat' | 'production';
  policyDigest: string;
  activationRevision: number;
  activationReviewIdDigest: string;
  billingAccountIdDigest: string;
  budgetIdDigest: string;
  pubsubSubscriptionDigest: string;
  budgetDisplayNameDigest: string;
  messageIdDigest: string;
  costIntervalStart: string;
  publishedAt: string;
  observedAt: string;
  costAmountMicrousd: number;
  budgetAmountMicrousd: number;
  actualThresholdBasisPoints: number;
  forecastThresholdBasisPoints: number;
  severity: 'healthy' | 'notice' | 'warning' | 'critical';
  revision: number;
}

interface BudgetState extends BudgetStateUnsigned {
  binding: string;
}

interface BudgetSignalUnsigned {
  schemaVersion: 1;
  id: string;
  policyDigest: string;
  activationRevision: number;
  activationReviewIdDigest: string;
  billingAccountIdDigest: string;
  budgetIdDigest: string;
  pubsubSubscriptionDigest: string;
  budgetDisplayNameDigest: string;
  messageIdDigest: string;
  costIntervalStart: string;
  publishedAt: string;
  observedAt: string;
  costAmountMicrousd: number;
  budgetAmountMicrousd: number;
  actualThresholdBasisPoints: number;
  forecastThresholdBasisPoints: number;
  severity: BudgetState['severity'];
}

interface BudgetSignal extends BudgetSignalUnsigned {
  binding: string;
}

export interface HostedRestoreDrillEvidence {
  schemaVersion: typeof hostedRestoreDrillSchemaVersion;
  id: string;
  evidenceClass: 'synthetic_fixture' | 'provider_drill';
  mode: 'firestore_pitr_entire_database';
  claimBoundary: 'isolated_restore_evidence_no_production_restore';
  sourceProjectDigest: string;
  destinationProjectDigest: string;
  pointInTime: string;
  exportRequestedAt: string;
  exportCompletedAt: string;
  importStartedAt: string;
  importCompletedAt: string;
  verifiedAt: string;
  destinationDeletionScheduledAt: string;
  collectionGroups: string[];
  sourceDocumentCount: number;
  restoredDocumentCount: number;
  sourceManifestSha256: string;
  restoredManifestSha256: string;
  applicationSmokePassed: true;
  rulesIsolationPassed: true;
  binding: string;
}

const paths = {
  activation: 'operationsActivation/current',
  budgetState: 'operationsBudgetState/current',
  budgetSignal: (id: string) => `operationsBudgetSignals/${id}`,
  restoreDrill: (id: string) => `operationsRestoreDrills/${id}`,
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw invalidOperationsReview();
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (!record(value)) throw invalidOperationsReview();
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function validSecret(value: string | Uint8Array): string | Uint8Array {
  const length = typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.byteLength;
  if (length < 32 || length > 512) throw new Error('Operations secret must contain 32 to 512 bytes.');
  return typeof value === 'string' ? value : Uint8Array.from(value);
}

function hmac(secret: string | Uint8Array, domain: string, value: unknown): string {
  return createHmac('sha256', secret)
    .update(`${domain}\0${canonicalJson(value)}`, 'utf8')
    .digest('hex');
}

function sameDigest(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function safeReference(value: unknown, maximum = 512): value is string {
  return typeof value === 'string'
    && value.length >= 3
    && value.length <= maximum
    && /^[A-Za-z0-9][A-Za-z0-9:._/@+-]*$/u.test(value);
}

function safeDisplayName(value: unknown, maximum = 256): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maximum
    && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function invalidOperationsReview(): HostedOperationsServiceError {
  return new HostedOperationsServiceError(
    'INVALID_OPERATIONS_REVIEW',
    'The operations review evidence is invalid.',
  );
}

function unavailable(): HostedOperationsServiceError {
  return new HostedOperationsServiceError(
    'OPERATIONS_UNAVAILABLE',
    'Hosted operations controls are temporarily unavailable.',
  );
}

function blocked(): HostedOperationsServiceError {
  return new HostedOperationsServiceError(
    'OPERATIONS_ACTIVATION_BLOCKED',
    'Paid activation is temporarily unavailable.',
  );
}

function microusd(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new HostedOperationsServiceError(
    'INVALID_BUDGET_NOTICE',
    'The budget notice is invalid.',
  );
  const scaled = value * 1_000_000;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > 0.000_001) {
    throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
  }
  return rounded;
}

function basisPoints(value: number | null): number {
  if (value === null) return 0;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
  }
  const scaled = Math.round(value * 10_000);
  if (!Number.isSafeInteger(scaled)) {
    throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
  }
  return scaled;
}

function ratioBasisPoints(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  const denominatorValue = BigInt(denominator);
  const scaled = BigInt(numerator) * 10_000n;
  const result = (scaled + denominatorValue - 1n) / denominatorValue;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw invalidOperationsReview();
  return Number(result);
}

function perSeat(value: number, seats: number): number | null {
  if (seats === 0) return null;
  return Number((BigInt(value) + BigInt(Math.floor(seats / 2))) / BigInt(seats));
}

export function buildHostedCostPerPaidSeatReport(input: {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  evidenceClass: HostedCostPerPaidSeatReport['evidenceClass'];
  paidWorkspaceIds: readonly string[];
  economics: readonly HostedEconomicsRecord[];
  policy?: HostedOperationsPolicy;
}): HostedCostPerPaidSeatReport {
  const policy = input.policy ?? hostedOperationsPolicyV1;
  if (!timestamp(input.generatedAt) || !timestamp(input.periodStart) || !timestamp(input.periodEnd)
    || Date.parse(input.periodStart) >= Date.parse(input.periodEnd)
    || Date.parse(input.periodEnd) > Date.parse(input.generatedAt)
    || !['synthetic_fixture', 'production_baseline'].includes(input.evidenceClass)) {
    throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report is invalid.');
  }
  for (const item of input.economics) assertHostedEconomicsRecord(item);
  const economics = deduplicateHostedEconomics(input.economics);
  const paidWorkspaceIds = [...input.paidWorkspaceIds].sort();
  if (paidWorkspaceIds.length === 0
    || new Set(paidWorkspaceIds).size !== paidWorkspaceIds.length
    || paidWorkspaceIds.some((workspaceId) => !safeReference(workspaceId, 128))) {
    throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report is invalid.');
  }
  const dimensions = new Set<string>();
  const sourceReferences = new Set<string>();
  const seatsByWorkspace = new Map<string, number>();
  const kindsByWorkspace = new Map<string, Set<HostedEconomicsRecord['kind']>>();
  for (const item of economics) {
    if (item.periodStart !== input.periodStart || item.periodEnd !== input.periodEnd
      || item.activePaidSeats < 1
      || (item.kind === 'recognized_revenue' && item.provider !== 'stripe' && item.provider !== 'creem')
      || Date.parse(item.retrievedAt) < Date.parse(item.periodEnd)
      || Date.parse(item.retrievedAt) > Date.parse(input.generatedAt)) {
      throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report is invalid.');
    }
    const dimension = canonicalJson([
      item.workspaceId, item.provider, item.kind, item.category, item.periodStart, item.periodEnd,
    ]);
    if (dimensions.has(dimension)) {
      throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report contains a duplicate dimension.');
    }
    dimensions.add(dimension);
    if (sourceReferences.has(item.sourceRef)) {
      throw new HostedOperationsServiceError(
        'INVALID_COST_REPORT',
        'The cost report contains a duplicate source reference.',
      );
    }
    sourceReferences.add(item.sourceRef);
    const existingSeats = seatsByWorkspace.get(item.workspaceId);
    if (existingSeats !== undefined && existingSeats !== item.activePaidSeats) {
      throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report seat ledger is inconsistent.');
    }
    seatsByWorkspace.set(item.workspaceId, item.activePaidSeats);
    const kinds = kindsByWorkspace.get(item.workspaceId) ?? new Set<HostedEconomicsRecord['kind']>();
    kinds.add(item.kind);
    kindsByWorkspace.set(item.workspaceId, kinds);
  }
  for (const kinds of kindsByWorkspace.values()) {
    if (!kinds.has('variable_cost') || !kinds.has('recognized_revenue')) {
      throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report is incomplete.');
    }
  }
  if (canonicalJson([...seatsByWorkspace.keys()].sort()) !== canonicalJson(paidWorkspaceIds)) {
    throw new HostedOperationsServiceError(
      'INVALID_COST_REPORT',
      'The cost report workspace ledger is incomplete.',
    );
  }
  const activePaidSeats = [...seatsByWorkspace.values()].reduce((sum, value) => sum + value, 0);
  const variableCostMicrousd = economics.filter((item) => item.kind === 'variable_cost')
    .reduce((sum, item) => sum + item.amountMicrousd, 0);
  const recognizedRevenueMicrousd = economics.filter((item) => item.kind === 'recognized_revenue')
    .reduce((sum, item) => sum + item.amountMicrousd, 0);
  if (!Number.isSafeInteger(variableCostMicrousd) || !Number.isSafeInteger(recognizedRevenueMicrousd)) {
    throw new HostedOperationsServiceError('INVALID_COST_REPORT', 'The cost report totals are invalid.');
  }
  const variableCostShareBasisPoints = ratioBasisPoints(
    variableCostMicrousd,
    recognizedRevenueMicrousd,
  );
  const economicsDigest = digest(economics);
  const unsigned = {
    schemaVersion: hostedCostReportSchemaVersion,
    generatedAt: input.generatedAt,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    evidenceClass: input.evidenceClass,
    claimBoundary: 'guardrail_only_no_outcome_claim' as const,
    workspaceCount: seatsByWorkspace.size,
    activePaidSeats,
    variableCostMicrousd,
    recognizedRevenueMicrousd,
    variableCostPerPaidSeatMicrousd: perSeat(variableCostMicrousd, activePaidSeats),
    recognizedRevenuePerPaidSeatMicrousd: perSeat(recognizedRevenueMicrousd, activePaidSeats),
    variableCostShareBasisPoints,
    maximumVariableCostShareBasisPoints: policy.economics.maximumVariableCostShareBasisPoints,
    decision: activePaidSeats > 0
      && variableCostShareBasisPoints !== null
      && variableCostShareBasisPoints <= policy.economics.maximumVariableCostShareBasisPoints
      ? 'allow' as const
      : 'stop' as const,
    workspaceSetDigest: digest(paidWorkspaceIds),
    economicsDigest,
  };
  const reportDigest = digest(unsigned);
  return {
    ...unsigned,
    id: `cost-report:${reportDigest.slice(0, 32)}`,
    reportDigest,
  };
}

function assertCostReport(value: HostedCostPerPaidSeatReport, policy: HostedOperationsPolicy): void {
  if (!record(value) || !exactKeys(value, [
    'schemaVersion', 'id', 'generatedAt', 'periodStart', 'periodEnd', 'evidenceClass',
    'claimBoundary', 'workspaceCount', 'activePaidSeats', 'variableCostMicrousd',
    'recognizedRevenueMicrousd', 'variableCostPerPaidSeatMicrousd',
    'recognizedRevenuePerPaidSeatMicrousd', 'variableCostShareBasisPoints',
    'maximumVariableCostShareBasisPoints', 'decision', 'workspaceSetDigest',
    'economicsDigest', 'reportDigest',
  ])) throw invalidOperationsReview();
  const {id, reportDigest, ...unsigned} = value;
  const expectedShare = ratioBasisPoints(
    value.variableCostMicrousd,
    value.recognizedRevenueMicrousd,
  );
  const expectedDecision = value.activePaidSeats > 0
    && expectedShare !== null
    && expectedShare <= policy.economics.maximumVariableCostShareBasisPoints
    ? 'allow'
    : 'stop';
  if (value.schemaVersion !== hostedCostReportSchemaVersion
    || !timestamp(value.generatedAt) || !timestamp(value.periodStart) || !timestamp(value.periodEnd)
    || Date.parse(value.periodStart) >= Date.parse(value.periodEnd)
    || Date.parse(value.periodEnd) > Date.parse(value.generatedAt)
    || !['synthetic_fixture', 'production_baseline'].includes(String(value.evidenceClass))
    || value.claimBoundary !== 'guardrail_only_no_outcome_claim'
    || !positiveInteger(value.workspaceCount) || !positiveInteger(value.activePaidSeats)
    || value.workspaceCount > value.activePaidSeats
    || !nonNegativeInteger(value.variableCostMicrousd)
    || !nonNegativeInteger(value.recognizedRevenueMicrousd)
    || value.variableCostPerPaidSeatMicrousd !== perSeat(
      value.variableCostMicrousd,
      value.activePaidSeats,
    )
    || value.recognizedRevenuePerPaidSeatMicrousd !== perSeat(
      value.recognizedRevenueMicrousd,
      value.activePaidSeats,
    )
    || value.variableCostShareBasisPoints !== expectedShare
    || !sha256(value.workspaceSetDigest) || !sha256(value.economicsDigest)
    || !safeReference(id) || id !== `cost-report:${reportDigest.slice(0, 32)}`
    || !sha256(reportDigest) || !sameDigest(reportDigest, digest(unsigned))
    || value.maximumVariableCostShareBasisPoints !== policy.economics.maximumVariableCostShareBasisPoints
    || value.decision !== expectedDecision || value.decision !== 'allow') {
    throw invalidOperationsReview();
  }
}

function referenceDigests(
  secret: string | Uint8Array,
  values: HostedOperationsProviderReferences,
): Record<keyof HostedOperationsProviderReferences, string> {
  if (!record(values) || !exactKeys(values, [
    'budgetDisplayName', 'billingAccountId', 'budgetId', 'pubsubSubscription',
    'cloudRunService', 'cloudArmorPolicy', 'billingExportDataset', 'backupBucket',
    'restoreProject',
  ])) throw invalidOperationsReview();
  const keys = Object.keys(values) as Array<keyof HostedOperationsProviderReferences>;
  const result = {} as Record<keyof HostedOperationsProviderReferences, string>;
  for (const key of keys) {
    const value = values[key];
    if (key === 'budgetDisplayName' ? !safeDisplayName(value) : !safeReference(value)) {
      throw invalidOperationsReview();
    }
    result[key] = hmac(secret, `operations-reference:${key}:v1`, value);
  }
  return result;
}

const activationKeys = [
  'schemaVersion', 'id', 'environment', 'policyDigest', 'reviewIdDigest',
  'providerReferenceDigests', 'costReportDigest', 'costReportEvidenceClass',
  'costReportDecision', 'budgetAmountMicrousd', 'reviewedAt', 'expiresAt',
  'revision', 'binding',
] as const;

function activationRecord(
  raw: unknown,
  secret: string | Uint8Array,
  policy: HostedOperationsPolicy,
  environment: 'uat' | 'production',
): ActivationRecord {
  if (!record(raw) || !exactKeys(raw, activationKeys)
    || raw.schemaVersion !== 1 || raw.id !== 'current' || raw.environment !== environment
    || raw.policyDigest !== hostedOperationsPolicyDigest(policy) || !sha256(raw.reviewIdDigest)
    || !record(raw.providerReferenceDigests)
    || !exactKeys(raw.providerReferenceDigests, [
      'budgetDisplayName', 'billingAccountId', 'budgetId', 'pubsubSubscription',
      'cloudRunService', 'cloudArmorPolicy', 'billingExportDataset', 'backupBucket',
      'restoreProject',
    ])
    || Object.values(raw.providerReferenceDigests).some((value) => !sha256(value))
    || !sha256(raw.costReportDigest)
    || !['synthetic_fixture', 'production_baseline'].includes(String(raw.costReportEvidenceClass))
    || raw.costReportDecision !== 'allow'
    || raw.budgetAmountMicrousd !== policy.budget.amountMicrousd
    || !timestamp(raw.reviewedAt) || !timestamp(raw.expiresAt)
    || Date.parse(raw.reviewedAt) >= Date.parse(raw.expiresAt)
    || Date.parse(raw.expiresAt) - Date.parse(raw.reviewedAt)
      > policy.budget.activationReviewTtlHours * 60 * 60 * 1_000
    || !positiveInteger(raw.revision) || !sha256(raw.binding)) throw unavailable();
  const {binding, ...unsigned} = raw as unknown as ActivationRecord;
  if (!sameDigest(binding, hmac(secret, 'operations-activation:v1', unsigned))) throw unavailable();
  return raw as unknown as ActivationRecord;
}

const budgetStateKeys = [
  'schemaVersion', 'id', 'environment', 'policyDigest', 'activationRevision',
  'activationReviewIdDigest', 'billingAccountIdDigest',
  'budgetIdDigest', 'pubsubSubscriptionDigest', 'budgetDisplayNameDigest',
  'messageIdDigest', 'costIntervalStart', 'publishedAt', 'observedAt',
  'costAmountMicrousd', 'budgetAmountMicrousd', 'actualThresholdBasisPoints',
  'forecastThresholdBasisPoints', 'severity', 'revision', 'binding',
] as const;

function budgetStateRecord(
  raw: unknown,
  secret: string | Uint8Array,
  policy: HostedOperationsPolicy,
  activation: ActivationRecord,
): BudgetState {
  if (!record(raw) || !exactKeys(raw, budgetStateKeys)
    || raw.schemaVersion !== 1 || raw.id !== 'current'
    || raw.environment !== activation.environment
    || raw.policyDigest !== hostedOperationsPolicyDigest(policy)
    || raw.activationRevision !== activation.revision
    || raw.activationReviewIdDigest !== activation.reviewIdDigest
    || !sha256(raw.billingAccountIdDigest) || !sha256(raw.budgetIdDigest)
    || !sha256(raw.pubsubSubscriptionDigest) || !sha256(raw.budgetDisplayNameDigest)
    || !sha256(raw.messageIdDigest)
    || !timestamp(raw.costIntervalStart) || !timestamp(raw.publishedAt) || !timestamp(raw.observedAt)
    || !nonNegativeInteger(raw.costAmountMicrousd)
    || raw.budgetAmountMicrousd !== policy.budget.amountMicrousd
    || !nonNegativeInteger(raw.actualThresholdBasisPoints)
    || !nonNegativeInteger(raw.forecastThresholdBasisPoints)
    || !['healthy', 'notice', 'warning', 'critical'].includes(String(raw.severity))
    || !positiveInteger(raw.revision) || !sha256(raw.binding)) throw unavailable();
  const state = raw as unknown as BudgetState;
  if (state.billingAccountIdDigest !== activation.providerReferenceDigests.billingAccountId
    || state.budgetIdDigest !== activation.providerReferenceDigests.budgetId
    || state.pubsubSubscriptionDigest !== activation.providerReferenceDigests.pubsubSubscription
    || state.budgetDisplayNameDigest !== activation.providerReferenceDigests.budgetDisplayName) throw unavailable();
  if (Date.parse(state.costIntervalStart) > Date.parse(state.publishedAt)
    || Date.parse(state.publishedAt) > Date.parse(state.observedAt) + 5 * 60 * 1_000
    || state.severity !== budgetSeverity(
      state.actualThresholdBasisPoints,
      state.forecastThresholdBasisPoints,
      policy.budget.thresholdsBasisPoints,
    )) throw unavailable();
  const {binding, ...unsigned} = state;
  if (!sameDigest(binding, hmac(secret, 'operations-budget-state:v1', unsigned))) throw unavailable();
  return state;
}

function budgetSeverity(
  actualBasisPoints: number,
  forecastBasisPoints: number,
  thresholds: readonly [number, number, number],
): BudgetState['severity'] {
  const highest = Math.max(actualBasisPoints, forecastBasisPoints);
  if (highest >= thresholds[2]) return 'critical';
  if (highest >= thresholds[1]) return 'warning';
  if (highest >= thresholds[0]) return 'notice';
  return 'healthy';
}

const budgetSignalKeys = [
  'schemaVersion', 'id', 'policyDigest', 'activationRevision',
  'activationReviewIdDigest', 'billingAccountIdDigest', 'budgetIdDigest',
  'pubsubSubscriptionDigest', 'budgetDisplayNameDigest', 'messageIdDigest',
  'costIntervalStart', 'publishedAt', 'observedAt', 'costAmountMicrousd',
  'budgetAmountMicrousd', 'actualThresholdBasisPoints', 'forecastThresholdBasisPoints',
  'severity', 'binding',
] as const;

function budgetSignalRecord(
  raw: unknown,
  secret: string | Uint8Array,
  policy: HostedOperationsPolicy,
  activation: ActivationRecord,
): BudgetSignal {
  if (!record(raw) || !exactKeys(raw, budgetSignalKeys)
    || raw.schemaVersion !== 1 || !sha256(raw.id)
    || raw.policyDigest !== hostedOperationsPolicyDigest(policy)
    || raw.activationRevision !== activation.revision
    || raw.activationReviewIdDigest !== activation.reviewIdDigest
    || !sha256(raw.billingAccountIdDigest) || !sha256(raw.budgetIdDigest)
    || !sha256(raw.pubsubSubscriptionDigest) || !sha256(raw.budgetDisplayNameDigest)
    || !sha256(raw.messageIdDigest)
    || raw.billingAccountIdDigest !== activation.providerReferenceDigests.billingAccountId
    || raw.budgetIdDigest !== activation.providerReferenceDigests.budgetId
    || raw.pubsubSubscriptionDigest !== activation.providerReferenceDigests.pubsubSubscription
    || raw.budgetDisplayNameDigest !== activation.providerReferenceDigests.budgetDisplayName
    || !timestamp(raw.costIntervalStart) || !timestamp(raw.publishedAt) || !timestamp(raw.observedAt)
    || Date.parse(raw.costIntervalStart) > Date.parse(raw.publishedAt)
    || Date.parse(raw.publishedAt) > Date.parse(raw.observedAt) + 5 * 60 * 1_000
    || !nonNegativeInteger(raw.costAmountMicrousd)
    || raw.budgetAmountMicrousd !== policy.budget.amountMicrousd
    || !nonNegativeInteger(raw.actualThresholdBasisPoints)
    || !nonNegativeInteger(raw.forecastThresholdBasisPoints)
    || !['healthy', 'notice', 'warning', 'critical'].includes(String(raw.severity))
    || raw.severity !== budgetSeverity(
      raw.actualThresholdBasisPoints as number,
      raw.forecastThresholdBasisPoints as number,
      policy.budget.thresholdsBasisPoints,
    )
    || !sha256(raw.binding)) throw unavailable();
  const value = raw as unknown as BudgetSignal;
  const {binding, ...unsigned} = value;
  const expectedId = hmac(secret, 'operations-budget-signal-id:v1', {
    activationReviewIdDigest: value.activationReviewIdDigest,
    messageIdDigest: value.messageIdDigest,
    pubsubSubscriptionDigest: value.pubsubSubscriptionDigest,
  });
  if (value.id !== expectedId
    || !sameDigest(binding, hmac(secret, 'operations-budget-signal:v1', unsigned))) throw unavailable();
  return value;
}

function sameBudgetSignalPayload(left: BudgetSignal, right: BudgetSignal): boolean {
  const {observedAt: _leftObservedAt, binding: _leftBinding, ...leftPayload} = left;
  const {observedAt: _rightObservedAt, binding: _rightBinding, ...rightPayload} = right;
  return canonicalJson(leftPayload) === canonicalJson(rightPayload);
}

function compareSignalOrdering(
  left: Pick<BudgetSignalUnsigned, 'costIntervalStart' | 'publishedAt' | 'costAmountMicrousd' | 'actualThresholdBasisPoints' | 'forecastThresholdBasisPoints' | 'messageIdDigest'>,
  right: Pick<BudgetSignalUnsigned, 'costIntervalStart' | 'publishedAt' | 'costAmountMicrousd' | 'actualThresholdBasisPoints' | 'forecastThresholdBasisPoints' | 'messageIdDigest'>,
): number {
  for (const key of ['costIntervalStart', 'publishedAt'] as const) {
    const compared = left[key].localeCompare(right[key], 'en');
    if (compared !== 0) return compared;
  }
  for (const key of [
    'costAmountMicrousd', 'actualThresholdBasisPoints', 'forecastThresholdBasisPoints',
  ] as const) {
    if (left[key] !== right[key]) return left[key] < right[key] ? -1 : 1;
  }
  return left.messageIdDigest.localeCompare(right.messageIdDigest, 'en');
}

export class HostedOperationsService implements BillingActivationPolicy {
  readonly #repository: HostedOperationsRepository;
  readonly #secret: string | Uint8Array;
  readonly #policy: HostedOperationsPolicy;
  readonly #environment: 'uat' | 'production';
  readonly #clock: () => Date;

  constructor(
    repository: HostedOperationsRepository,
    options: {
      secret: string | Uint8Array;
      environment: 'uat' | 'production';
      policy?: HostedOperationsPolicy;
      clock?: () => Date;
    },
  ) {
    this.#repository = repository;
    this.#secret = validSecret(options.secret);
    this.#environment = options.environment;
    this.#policy = sealedHostedOperationsPolicy(options.policy ?? hostedOperationsPolicyV1);
    this.#clock = options.clock ?? (() => new Date());
  }

  #now(): string {
    const value = this.#clock().toISOString();
    if (!timestamp(value)) throw unavailable();
    return value;
  }

  async installActivationEvidence(input: HostedOperationsActivationReviewInput): Promise<void> {
    if (!record(input) || !exactKeys(input, [
      'reviewId', 'environment', 'reviewedAt', 'expiresAt', 'budgetIntervalStart',
      'providerReferences', 'paidWorkspaceIds', 'economics', 'costReport',
    ]) || !safeReference(input.reviewId, 128)
      || input.environment !== this.#environment
      || !timestamp(input.reviewedAt) || !timestamp(input.expiresAt)
      || !timestamp(input.budgetIntervalStart)
      || Date.parse(input.budgetIntervalStart) > Date.parse(input.reviewedAt)
      || Date.parse(input.reviewedAt) > Date.parse(this.#now())
      || Date.parse(input.expiresAt) <= Date.parse(input.reviewedAt)
      || Date.parse(input.expiresAt) - Date.parse(input.reviewedAt)
        > this.#policy.budget.activationReviewTtlHours * 60 * 60 * 1_000) throw invalidOperationsReview();
    assertCostReport(input.costReport, this.#policy);
    const rebuiltReport = buildHostedCostPerPaidSeatReport({
      generatedAt: input.costReport.generatedAt,
      periodStart: input.costReport.periodStart,
      periodEnd: input.costReport.periodEnd,
      evidenceClass: input.costReport.evidenceClass,
      paidWorkspaceIds: input.paidWorkspaceIds,
      economics: input.economics,
      policy: this.#policy,
    });
    if (canonicalJson(rebuiltReport) !== canonicalJson(input.costReport)
      || (this.#environment === 'production'
        && input.costReport.evidenceClass !== 'production_baseline')
      || Date.parse(input.costReport.generatedAt) > Date.parse(input.reviewedAt)
      || Date.parse(input.reviewedAt) - Date.parse(input.costReport.generatedAt)
      > this.#policy.economics.reportFreshnessHours * 60 * 60 * 1_000) throw invalidOperationsReview();
    const providerReferenceDigests = referenceDigests(this.#secret, input.providerReferences);
    await this.#repository.runTransaction(async (transaction) => {
      const rawActivation = await transaction.get(paths.activation);
      let revision = 1;
      let previousState: BudgetState | null = null;
      if (rawActivation !== null) {
        const previous = activationRecord(
          rawActivation,
          this.#secret,
          this.#policy,
          this.#environment,
        );
        if (Date.parse(input.reviewedAt) <= Date.parse(previous.reviewedAt)) {
          throw invalidOperationsReview();
        }
        previousState = budgetStateRecord(
          await transaction.get(paths.budgetState),
          this.#secret,
          this.#policy,
          previous,
        );
        if (Date.parse(input.budgetIntervalStart) < Date.parse(previousState.costIntervalStart)) {
          throw invalidOperationsReview();
        }
        if (input.budgetIntervalStart === previousState.costIntervalStart
          && (providerReferenceDigests.billingAccountId !== previous.providerReferenceDigests.billingAccountId
            || providerReferenceDigests.budgetId !== previous.providerReferenceDigests.budgetId
            || providerReferenceDigests.pubsubSubscription !== previous.providerReferenceDigests.pubsubSubscription
            || providerReferenceDigests.budgetDisplayName !== previous.providerReferenceDigests.budgetDisplayName)) {
          throw invalidOperationsReview();
        }
        revision = previous.revision + 1;
      }
      const unsigned: ActivationRecordUnsigned = {
        schemaVersion: 1,
        id: 'current',
        environment: this.#environment,
        policyDigest: hostedOperationsPolicyDigest(this.#policy),
        reviewIdDigest: hmac(this.#secret, 'operations-review-id:v1', input.reviewId),
        providerReferenceDigests,
        costReportDigest: input.costReport.reportDigest,
        costReportEvidenceClass: input.costReport.evidenceClass,
        costReportDecision: 'allow',
        budgetAmountMicrousd: this.#policy.budget.amountMicrousd,
        reviewedAt: input.reviewedAt,
        expiresAt: input.expiresAt,
        revision,
      };
      const activation: ActivationRecord = {
        ...unsigned,
        binding: hmac(this.#secret, 'operations-activation:v1', unsigned),
      };
      const preserveCurrentInterval = previousState !== null
        && input.budgetIntervalStart === previousState.costIntervalStart;
      const initialStateUnsigned: BudgetStateUnsigned = {
        schemaVersion: 1,
        id: 'current',
        environment: this.#environment,
        policyDigest: hostedOperationsPolicyDigest(this.#policy),
        activationRevision: activation.revision,
        activationReviewIdDigest: activation.reviewIdDigest,
        billingAccountIdDigest: providerReferenceDigests.billingAccountId,
        budgetIdDigest: providerReferenceDigests.budgetId,
        pubsubSubscriptionDigest: providerReferenceDigests.pubsubSubscription,
        budgetDisplayNameDigest: providerReferenceDigests.budgetDisplayName,
        messageIdDigest: preserveCurrentInterval
          ? previousState!.messageIdDigest
          : hmac(this.#secret, 'operations-initial-budget-state:v1', input.reviewId),
        costIntervalStart: input.budgetIntervalStart,
        publishedAt: preserveCurrentInterval ? previousState!.publishedAt : input.reviewedAt,
        observedAt: preserveCurrentInterval ? previousState!.observedAt : input.reviewedAt,
        costAmountMicrousd: preserveCurrentInterval ? previousState!.costAmountMicrousd : 0,
        budgetAmountMicrousd: this.#policy.budget.amountMicrousd,
        actualThresholdBasisPoints: preserveCurrentInterval
          ? previousState!.actualThresholdBasisPoints : 0,
        forecastThresholdBasisPoints: preserveCurrentInterval
          ? previousState!.forecastThresholdBasisPoints : 0,
        severity: preserveCurrentInterval ? previousState!.severity : 'healthy',
        revision: previousState === null ? revision : Math.max(revision, previousState.revision + 1),
      };
      const state: BudgetState = {
        ...initialStateUnsigned,
        binding: hmac(this.#secret, 'operations-budget-state:v1', initialStateUnsigned),
      };
      transaction.set(paths.activation, activation as unknown as Record<string, unknown>);
      transaction.set(paths.budgetState, state as unknown as Record<string, unknown>);
    });
  }

  async assertBillingActivationAllowed(input: {
    workspaceId: string;
    ownerUserId: string;
    requestId: string;
  }): Promise<void> {
    if (!safeReference(input.workspaceId, 128)
      || !safeReference(input.ownerUserId, 128)
      || !safeReference(input.requestId, 128)) throw blocked();
    try {
      await this.#repository.runTransaction(async (transaction) => {
        const now = this.#now();
        const activation = activationRecord(
          await transaction.get(paths.activation),
          this.#secret,
          this.#policy,
          this.#environment,
        );
        const state = budgetStateRecord(
          await transaction.get(paths.budgetState),
          this.#secret,
          this.#policy,
          activation,
        );
        if (Date.parse(now) < Date.parse(activation.reviewedAt)
          || Date.parse(now) >= Date.parse(activation.expiresAt)
          || Date.parse(now) < Date.parse(state.observedAt)
          || Date.parse(now) - Date.parse(state.observedAt)
            > this.#policy.budget.signalFreshnessHours * 60 * 60 * 1_000
          || state.severity === 'warning' || state.severity === 'critical') throw blocked();
      });
    } catch (error) {
      if (error instanceof HostedOperationsServiceError
        && error.code === 'OPERATIONS_ACTIVATION_BLOCKED') throw error;
      throw blocked();
    }
  }

  async acceptBudgetNotice(input: HostedBudgetNoticeInput): Promise<HostedBudgetNoticeResult> {
    if (!record(input) || !exactKeys(input, [
      'messageId', 'publishTime', 'subscription', 'billingAccountId', 'budgetId',
      'schemaVersion', 'budgetDisplayName', 'costAmount', 'costIntervalStart',
      'budgetAmount', 'budgetAmountType', 'currencyCode', 'alertThresholdExceeded',
      'forecastThresholdExceeded',
    ]) || !safeReference(input.messageId, 256)
      || !timestamp(input.publishTime) || !timestamp(input.costIntervalStart)
      || !safeReference(input.subscription) || !safeReference(input.billingAccountId, 128)
      || !safeReference(input.budgetId, 128) || input.schemaVersion !== '1.0'
      || !safeDisplayName(input.budgetDisplayName, 256)
      || input.budgetAmountType !== 'SPECIFIED_AMOUNT' || input.currencyCode !== 'USD'
      || Date.parse(input.costIntervalStart) > Date.parse(input.publishTime)) {
      throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
    }
    const now = this.#now();
    if (Date.parse(input.publishTime) > Date.parse(now) + 5 * 60 * 1_000) {
      throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
    }
    const costAmountMicrousd = microusd(input.costAmount);
    const budgetAmountMicrousd = microusd(input.budgetAmount);
    const providerActualThresholdBasisPoints = basisPoints(input.alertThresholdExceeded);
    const forecastThresholdBasisPoints = basisPoints(input.forecastThresholdExceeded);
    if (budgetAmountMicrousd !== this.#policy.budget.amountMicrousd) {
      throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
    }
    return this.#repository.runTransaction(async (transaction) => {
      const activation = activationRecord(
        await transaction.get(paths.activation),
        this.#secret,
        this.#policy,
        this.#environment,
      );
      const current = budgetStateRecord(
        await transaction.get(paths.budgetState),
        this.#secret,
        this.#policy,
        activation,
      );
      const refs = {
        billingAccountIdDigest: hmac(this.#secret, 'operations-reference:billingAccountId:v1', input.billingAccountId),
        budgetIdDigest: hmac(this.#secret, 'operations-reference:budgetId:v1', input.budgetId),
        pubsubSubscriptionDigest: hmac(this.#secret, 'operations-reference:pubsubSubscription:v1', input.subscription),
        budgetDisplayNameDigest: hmac(this.#secret, 'operations-reference:budgetDisplayName:v1', input.budgetDisplayName),
      };
      if (refs.billingAccountIdDigest !== activation.providerReferenceDigests.billingAccountId
        || refs.budgetIdDigest !== activation.providerReferenceDigests.budgetId
        || refs.pubsubSubscriptionDigest !== activation.providerReferenceDigests.pubsubSubscription
        || refs.budgetDisplayNameDigest !== activation.providerReferenceDigests.budgetDisplayName) {
        throw new HostedOperationsServiceError('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.');
      }
      const messageIdDigest = hmac(this.#secret, 'operations-budget-message-id:v1', input.messageId);
      const id = hmac(this.#secret, 'operations-budget-signal-id:v1', {
        activationReviewIdDigest: activation.reviewIdDigest,
        messageIdDigest,
        pubsubSubscriptionDigest: refs.pubsubSubscriptionDigest,
      });
      const costRatioBasisPoints = ratioBasisPoints(costAmountMicrousd, budgetAmountMicrousd) ?? 0;
      const actualThresholdBasisPoints = Math.max(
        providerActualThresholdBasisPoints,
        costRatioBasisPoints,
      );
      const severity = budgetSeverity(
        actualThresholdBasisPoints,
        forecastThresholdBasisPoints,
        this.#policy.budget.thresholdsBasisPoints,
      );
      const signalUnsigned: BudgetSignalUnsigned = {
        schemaVersion: 1,
        id,
        policyDigest: hostedOperationsPolicyDigest(this.#policy),
        activationRevision: activation.revision,
        activationReviewIdDigest: activation.reviewIdDigest,
        ...refs,
        messageIdDigest,
        costIntervalStart: input.costIntervalStart,
        publishedAt: input.publishTime,
        observedAt: now,
        costAmountMicrousd,
        budgetAmountMicrousd,
        actualThresholdBasisPoints,
        forecastThresholdBasisPoints,
        severity,
      };
      const signal: BudgetSignal = {
        ...signalUnsigned,
        binding: hmac(this.#secret, 'operations-budget-signal:v1', signalUnsigned),
      };
      const rawSignal = await transaction.get(paths.budgetSignal(id));
      if (rawSignal !== null) {
        const existing = budgetSignalRecord(
          rawSignal,
          this.#secret,
          this.#policy,
          activation,
        );
        if (!sameBudgetSignalPayload(existing, signal)) {
          throw new HostedOperationsServiceError(
            'INVALID_BUDGET_NOTICE',
            'The budget notice is invalid.',
          );
        }
        return {changed: false, currentUpdated: false, severity: current.severity};
      }
      transaction.create(paths.budgetSignal(id), signal as unknown as Record<string, unknown>);
      const currentOrdering = {
        costIntervalStart: current.costIntervalStart,
        publishedAt: current.publishedAt,
        costAmountMicrousd: current.costAmountMicrousd,
        actualThresholdBasisPoints: current.actualThresholdBasisPoints,
        forecastThresholdBasisPoints: current.forecastThresholdBasisPoints,
        messageIdDigest: current.messageIdDigest,
      };
      if (compareSignalOrdering(signal, currentOrdering) <= 0) {
        return {changed: true, currentUpdated: false, severity: current.severity};
      }
      const stateUnsigned: BudgetStateUnsigned = {
        schemaVersion: 1,
        id: 'current',
        environment: this.#environment,
        policyDigest: hostedOperationsPolicyDigest(this.#policy),
        activationRevision: activation.revision,
        activationReviewIdDigest: activation.reviewIdDigest,
        ...refs,
        messageIdDigest,
        costIntervalStart: input.costIntervalStart,
        publishedAt: input.publishTime,
        observedAt: now,
        costAmountMicrousd,
        budgetAmountMicrousd,
        actualThresholdBasisPoints,
        forecastThresholdBasisPoints,
        severity,
        revision: current.revision + 1,
      };
      transaction.set(paths.budgetState, {
        ...stateUnsigned,
        binding: hmac(this.#secret, 'operations-budget-state:v1', stateUnsigned),
      });
      return {changed: true, currentUpdated: true, severity};
    });
  }

  async recordRestoreDrill(evidence: HostedRestoreDrillEvidence): Promise<{changed: boolean}> {
    assertHostedRestoreDrillEvidence(evidence, this.#secret, this.#policy);
    if (Date.parse(evidence.verifiedAt) > Date.parse(this.#now())) {
      throw new HostedOperationsServiceError(
        'INVALID_RESTORE_DRILL',
        'The restore drill evidence is invalid.',
      );
    }
    if (this.#environment === 'production' && evidence.evidenceClass !== 'provider_drill') {
      throw new HostedOperationsServiceError(
        'INVALID_RESTORE_DRILL',
        'The restore drill evidence is invalid.',
      );
    }
    return this.#repository.runTransaction(async (transaction) => {
      const raw = await transaction.get(paths.restoreDrill(evidence.id));
      if (raw === null) {
        transaction.create(
          paths.restoreDrill(evidence.id),
          evidence as unknown as Record<string, unknown>,
        );
        return {changed: true};
      }
      assertHostedRestoreDrillEvidence(raw, this.#secret, this.#policy);
      if (canonicalJson(raw) !== canonicalJson(evidence)) throw unavailable();
      return {changed: false};
    });
  }
}

export function buildHostedRestoreDrillEvidence(
  input: {
    drillId: string;
    evidenceClass: HostedRestoreDrillEvidence['evidenceClass'];
    sourceProject: string;
    destinationProject: string;
    pointInTime: string;
    exportRequestedAt: string;
    exportCompletedAt: string;
    importStartedAt: string;
    importCompletedAt: string;
    verifiedAt: string;
    destinationDeletionScheduledAt: string;
    collectionGroups: readonly string[];
    sourceDocumentCount: number;
    restoredDocumentCount: number;
    sourceManifestSha256: string;
    restoredManifestSha256: string;
    applicationSmokePassed: boolean;
    rulesIsolationPassed: boolean;
  },
  secretValue: string | Uint8Array,
  policy: HostedOperationsPolicy = hostedOperationsPolicyV1,
): HostedRestoreDrillEvidence {
  const secret = validSecret(secretValue);
  if (!safeReference(input.drillId, 128) || !safeReference(input.sourceProject, 256)
    || !['synthetic_fixture', 'provider_drill'].includes(input.evidenceClass)
    || !safeReference(input.destinationProject, 256)
    || input.sourceProject === input.destinationProject
    || !input.destinationProject.startsWith('restore-drill-')
    || !timestamp(input.pointInTime) || !timestamp(input.exportRequestedAt)
    || !timestamp(input.exportCompletedAt) || !timestamp(input.importStartedAt)
    || !timestamp(input.importCompletedAt) || !timestamp(input.verifiedAt)
    || !timestamp(input.destinationDeletionScheduledAt)
    || new Date(input.pointInTime).getUTCSeconds() !== 0
    || new Date(input.pointInTime).getUTCMilliseconds() !== 0
    || Date.parse(input.pointInTime) > Date.parse(input.exportRequestedAt)
    || Date.parse(input.exportRequestedAt) - Date.parse(input.pointInTime) > 7 * 24 * 60 * 60 * 1_000
    || Date.parse(input.exportRequestedAt) > Date.parse(input.exportCompletedAt)
    || Date.parse(input.exportCompletedAt) > Date.parse(input.importStartedAt)
    || Date.parse(input.importStartedAt) > Date.parse(input.importCompletedAt)
    || Date.parse(input.importCompletedAt) > Date.parse(input.verifiedAt)
    || Date.parse(input.destinationDeletionScheduledAt) <= Date.parse(input.verifiedAt)
    || Date.parse(input.destinationDeletionScheduledAt) - Date.parse(input.verifiedAt) > 7 * 24 * 60 * 60 * 1_000
    || !positiveInteger(input.sourceDocumentCount)
    || input.restoredDocumentCount !== input.sourceDocumentCount
    || !sha256(input.sourceManifestSha256)
    || input.restoredManifestSha256 !== input.sourceManifestSha256
    || input.applicationSmokePassed !== true || input.rulesIsolationPassed !== true) {
    throw new HostedOperationsServiceError('INVALID_RESTORE_DRILL', 'The restore drill evidence is invalid.');
  }
  const collectionGroups = [...new Set(input.collectionGroups)].sort();
  if (canonicalJson(collectionGroups) !== canonicalJson([...policy.backup.requiredCollectionGroups].sort())) {
    throw new HostedOperationsServiceError('INVALID_RESTORE_DRILL', 'The restore drill inventory is incomplete.');
  }
  const idDigest = hmac(secret, 'operations-restore-drill-id:v1', input.drillId);
  const unsigned = {
    schemaVersion: hostedRestoreDrillSchemaVersion,
    id: `restore:${idDigest.slice(0, 32)}`,
    evidenceClass: input.evidenceClass,
    mode: 'firestore_pitr_entire_database' as const,
    claimBoundary: 'isolated_restore_evidence_no_production_restore' as const,
    sourceProjectDigest: hmac(secret, 'operations-restore-source:v1', input.sourceProject),
    destinationProjectDigest: hmac(secret, 'operations-restore-destination:v1', input.destinationProject),
    pointInTime: input.pointInTime,
    exportRequestedAt: input.exportRequestedAt,
    exportCompletedAt: input.exportCompletedAt,
    importStartedAt: input.importStartedAt,
    importCompletedAt: input.importCompletedAt,
    verifiedAt: input.verifiedAt,
    destinationDeletionScheduledAt: input.destinationDeletionScheduledAt,
    collectionGroups,
    sourceDocumentCount: input.sourceDocumentCount,
    restoredDocumentCount: input.restoredDocumentCount,
    sourceManifestSha256: input.sourceManifestSha256,
    restoredManifestSha256: input.restoredManifestSha256,
    applicationSmokePassed: true as const,
    rulesIsolationPassed: true as const,
  };
  return {...unsigned, binding: hmac(secret, 'operations-restore-drill:v1', unsigned)};
}

export function assertHostedRestoreDrillEvidence(
  value: unknown,
  secretValue: string | Uint8Array,
  policy: HostedOperationsPolicy = hostedOperationsPolicyV1,
): asserts value is HostedRestoreDrillEvidence {
  const secret = validSecret(secretValue);
  if (!record(value) || !exactKeys(value, [
    'schemaVersion', 'id', 'evidenceClass', 'mode', 'claimBoundary', 'sourceProjectDigest',
    'destinationProjectDigest', 'pointInTime', 'exportRequestedAt', 'exportCompletedAt',
    'importStartedAt', 'importCompletedAt', 'verifiedAt', 'destinationDeletionScheduledAt',
    'collectionGroups', 'sourceDocumentCount', 'restoredDocumentCount',
    'sourceManifestSha256', 'restoredManifestSha256', 'applicationSmokePassed',
    'rulesIsolationPassed', 'binding',
  ]) || value.schemaVersion !== hostedRestoreDrillSchemaVersion
    || !safeReference(value.id, 128) || !/^restore:[a-f0-9]{32}$/u.test(value.id as string)
    || !['synthetic_fixture', 'provider_drill'].includes(String(value.evidenceClass))
    || value.mode !== 'firestore_pitr_entire_database'
    || value.claimBoundary !== 'isolated_restore_evidence_no_production_restore'
    || !sha256(value.sourceProjectDigest) || !sha256(value.destinationProjectDigest)
    || value.sourceProjectDigest === value.destinationProjectDigest
    || !timestamp(value.pointInTime) || !timestamp(value.exportRequestedAt)
    || !timestamp(value.exportCompletedAt) || !timestamp(value.importStartedAt)
    || !timestamp(value.importCompletedAt) || !timestamp(value.verifiedAt)
    || !timestamp(value.destinationDeletionScheduledAt)
    || new Date(value.pointInTime as string).getUTCSeconds() !== 0
    || new Date(value.pointInTime as string).getUTCMilliseconds() !== 0
    || Date.parse(value.pointInTime as string) > Date.parse(value.exportRequestedAt as string)
    || Date.parse(value.exportRequestedAt as string) - Date.parse(value.pointInTime as string)
      > 7 * 24 * 60 * 60 * 1_000
    || Date.parse(value.exportRequestedAt as string) > Date.parse(value.exportCompletedAt as string)
    || Date.parse(value.exportCompletedAt as string) > Date.parse(value.importStartedAt as string)
    || Date.parse(value.importStartedAt as string) > Date.parse(value.importCompletedAt as string)
    || Date.parse(value.importCompletedAt as string) > Date.parse(value.verifiedAt as string)
    || Date.parse(value.destinationDeletionScheduledAt as string) <= Date.parse(value.verifiedAt as string)
    || Date.parse(value.destinationDeletionScheduledAt as string) - Date.parse(value.verifiedAt as string)
      > 7 * 24 * 60 * 60 * 1_000
    || !Array.isArray(value.collectionGroups)
    || value.collectionGroups.some((item) => typeof item !== 'string')
    || canonicalJson(value.collectionGroups) !== canonicalJson([...policy.backup.requiredCollectionGroups].sort())
    || !positiveInteger(value.sourceDocumentCount)
    || value.restoredDocumentCount !== value.sourceDocumentCount
    || !sha256(value.sourceManifestSha256)
    || value.restoredManifestSha256 !== value.sourceManifestSha256
    || value.applicationSmokePassed !== true || value.rulesIsolationPassed !== true
    || !sha256(value.binding)) {
    throw new HostedOperationsServiceError('INVALID_RESTORE_DRILL', 'The restore drill evidence is invalid.');
  }
  const {binding, ...unsigned} = value as unknown as HostedRestoreDrillEvidence;
  if (!sameDigest(binding, hmac(secret, 'operations-restore-drill:v1', unsigned))) {
    throw new HostedOperationsServiceError('INVALID_RESTORE_DRILL', 'The restore drill evidence is invalid.');
  }
}
