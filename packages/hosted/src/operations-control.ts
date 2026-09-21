import { createHash, createHmac } from 'node:crypto';

export const hostedOperationsPolicySchemaVersion = 'openlinear.hosted-operations-policy.v1' as const;
export const hostedOperationsTelemetrySchemaVersion = 'openlinear.hosted-operations-telemetry.v1' as const;

export type HostedOperationsRouteClass =
  | 'health'
  | 'public_read'
  | 'public_write'
  | 'authenticated_read'
  | 'authenticated_write'
  | 'provider_webhook'
  | 'oauth'
  | 'mcp';

export interface HostedOperationsLimitProfile {
  global: number;
  network: number;
  credential: number | null;
  workspace: number | null;
}

export interface HostedOperationsPolicy {
  schemaVersion: typeof hostedOperationsPolicySchemaVersion;
  policyId: 'openlinear-online-initial-guardrails';
  windowSeconds: 60;
  clockRegressionToleranceSeconds: 5;
  maxTrackedBuckets: 20_000;
  runtime: {
    maxInstances: 3;
    concurrency: 40;
    requestTimeoutSeconds: 30;
  };
  limits: Record<HostedOperationsRouteClass, HostedOperationsLimitProfile>;
  queries: {
    maximumPageSize: 100;
    maximumTransactionListRecords: 10_000;
    maximumExportRecords: 25_000;
    maximumExportIssueQueries: 5_000;
    maximumRequestBytes: 65_536;
    maximumStripeWebhookBytes: 262_144;
    maximumBudgetNoticeBytes: 32_768;
  };
  budget: {
    currency: 'USD';
    amountMicrousd: 25_000_000;
    thresholdsBasisPoints: readonly [5_000, 8_000, 10_000];
    activationReviewTtlHours: 24;
    signalFreshnessHours: 36;
    alertsAreHardCap: false;
  };
  economics: {
    maximumVariableCostShareBasisPoints: 5_000;
    reportFreshnessHours: 720;
  };
  retention: {
    structuredTelemetryDays: 30;
    budgetSignalDays: 400;
    restoreEvidenceDays: 400;
  };
  backup: {
    mode: 'entire_database';
    restoreTarget: 'isolated_project_only';
    requirePointInTimeMinute: true;
    requiredCollectionGroups: readonly string[];
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export function sealedHostedOperationsPolicy(policy: HostedOperationsPolicy): HostedOperationsPolicy {
  return deepFreeze(structuredClone(policy));
}

const requiredCollectionGroups = [
  '_invitationTokens',
  '_ownerTrialEligibility',
  'activity',
  'authorizationAudits',
  'authorizationEvents',
  'billing',
  'billingCheckoutLocks',
  'billingCheckoutSessions',
  'billingCheckouts',
  'billingIdempotency',
  'billingWebhooks',
  'collaborationIdempotency',
  'comments',
  'configurationIdempotency',
  'creemCheckoutAttempts',
  'cycles',
  'entitlements',
  'hostedUsers',
  'invitationIdempotency',
  'invitations',
  'issueObservationIdempotency',
  'issueObservers',
  'issueSequences',
  'issues',
  'memberships',
  'milestones',
  'mutationAudits',
  'oauthAccessTokens',
  'oauthAuthorizationCodes',
  'oauthAuthorizationRequests',
  'oauthClients',
  'oauthGrants',
  'oauthRefreshTokens',
  'oauthTokenFamilies',
  'operationsActivation',
  'operationsBudgetSignals',
  'operationsBudgetState',
  'operationsRestoreDrills',
  'personalTokens',
  'pmIdempotency',
  'productEvents',
  'projects',
  'savedViews',
  'teamMemberships',
  'teams',
  'tokenIdempotency',
  'verificationAccess',
  'workflowStatuses',
  'workspaces',
] as const;

export const hostedOperationsPolicyV1: HostedOperationsPolicy = deepFreeze({
  schemaVersion: hostedOperationsPolicySchemaVersion,
  policyId: 'openlinear-online-initial-guardrails',
  windowSeconds: 60,
  clockRegressionToleranceSeconds: 5,
  maxTrackedBuckets: 20_000,
  runtime: {
    maxInstances: 3,
    concurrency: 40,
    requestTimeoutSeconds: 30,
  },
  limits: {
    health: {global: 600, network: 120, credential: null, workspace: null},
    public_read: {global: 300, network: 30, credential: null, workspace: null},
    public_write: {global: 180, network: 20, credential: null, workspace: null},
    authenticated_read: {global: 600, network: 120, credential: 120, workspace: 180},
    authenticated_write: {global: 300, network: 60, credential: 30, workspace: 60},
    provider_webhook: {global: 300, network: 120, credential: 120, workspace: null},
    oauth: {global: 300, network: 60, credential: 60, workspace: null},
    mcp: {global: 300, network: 60, credential: 60, workspace: null},
  },
  queries: {
    maximumPageSize: 100,
    maximumTransactionListRecords: 10_000,
    maximumExportRecords: 25_000,
    maximumExportIssueQueries: 5_000,
    maximumRequestBytes: 65_536,
    maximumStripeWebhookBytes: 262_144,
    maximumBudgetNoticeBytes: 32_768,
  },
  budget: {
    currency: 'USD',
    amountMicrousd: 25_000_000,
    thresholdsBasisPoints: [5_000, 8_000, 10_000],
    activationReviewTtlHours: 24,
    signalFreshnessHours: 36,
    alertsAreHardCap: false,
  },
  economics: {
    maximumVariableCostShareBasisPoints: 5_000,
    reportFreshnessHours: 720,
  },
  retention: {
    structuredTelemetryDays: 30,
    budgetSignalDays: 400,
    restoreEvidenceDays: 400,
  },
  backup: {
    mode: 'entire_database',
    restoreTarget: 'isolated_project_only',
    requirePointInTimeMinute: true,
    requiredCollectionGroups,
  },
} as const);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Operations values must be finite.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (typeof value !== 'object') throw new Error('Operations values must be JSON-compatible.');
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

export function hostedOperationsPolicyDigest(
  policy: HostedOperationsPolicy = hostedOperationsPolicyV1,
): string {
  return createHash('sha256').update(canonicalJson(policy), 'utf8').digest('hex');
}

export class HostedOperationsControlError extends Error {
  constructor(
    readonly code: 'OPERATIONS_RATE_LIMITED' | 'OPERATIONS_UNAVAILABLE',
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'HostedOperationsControlError';
  }
}

export interface HostedOperationsAdmissionInput {
  correlationId: string;
  method: string;
  pathname: string;
  networkAddress: string | null;
  authorization: string | null;
  workspaceId: string | null;
  traceId: string | null;
}

export interface HostedOperationsAdmission {
  correlationId: string;
  routeClass: HostedOperationsRouteClass;
  method: string;
  admittedAt: string;
  startedAtMilliseconds: number;
  networkFingerprint: string;
  credentialFingerprint: string | null;
  workspaceFingerprint: string | null;
  traceId: string | null;
  limit: number;
  remaining: number;
  windowEndsAt: string;
}

export interface HostedOperationsTelemetryEvent {
  schemaVersion: typeof hostedOperationsTelemetrySchemaVersion;
  id: string;
  occurredAt: string;
  correlationId: string;
  routeClass: HostedOperationsRouteClass;
  method: string;
  statusCode: number;
  outcome: 'succeeded' | 'rejected' | 'failed';
  durationMilliseconds: number;
  networkFingerprint: string;
  credentialFingerprint: string | null;
  workspaceFingerprint: string | null;
  traceId: string | null;
  limited: boolean;
}

export interface HostedOperationsTelemetrySink {
  write(event: HostedOperationsTelemetryEvent): void;
}

export class MemoryHostedOperationsTelemetrySink implements HostedOperationsTelemetrySink {
  readonly events: HostedOperationsTelemetryEvent[] = [];

  write(event: HostedOperationsTelemetryEvent): void {
    this.events.push(structuredClone(event));
  }
}

interface BucketState {
  windowStartMilliseconds: number;
  count: number;
}

function validSecret(value: string | Uint8Array): string | Uint8Array {
  const length = typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : value.byteLength;
  if (length < 32 || length > 512) {
    throw new Error('Operations secret must contain between 32 and 512 bytes.');
  }
  return typeof value === 'string' ? value : Uint8Array.from(value);
}

function canonicalTimestamp(milliseconds: number): string {
  const value = new Date(milliseconds);
  if (!Number.isFinite(value.getTime())) throw new Error('Operations clock is invalid.');
  return value.toISOString();
}

function safeMethod(value: string): string {
  const method = value.trim().toUpperCase();
  if (!/^[A-Z]{3,12}$/u.test(method)) return 'UNKNOWN';
  return method;
}

function isWriteMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
}

export function classifyHostedOperationsRoute(
  pathname: string,
  methodValue: string,
): HostedOperationsRouteClass {
  const method = safeMethod(methodValue);
  if (pathname === '/health/ready') return 'health';
  if (pathname === '/api/v1/hosted/billing/stripe/webhook'
    || pathname === '/api/v1/hosted/billing/creem/webhook'
    || pathname === '/api/v1/hosted/operations/budget-notice') return 'provider_webhook';
  if (pathname === '/mcp') return 'mcp';
  if (pathname.startsWith('/oauth/') || pathname.startsWith('/.well-known/')) return 'oauth';
  if (pathname === '/api/v1/hosted/invitations/inspect') return 'public_read';
  if (pathname === '/api/v1/hosted/invitations/accept') return 'public_write';
  return isWriteMethod(method) ? 'authenticated_write' : 'authenticated_read';
}

function bearerCredential(value: string | null): string | null {
  if (value === null || !value.startsWith('Bearer ')) return null;
  const token = value.slice('Bearer '.length).trim();
  if (token.length < 20 || token.length > 8_192 || /\s/u.test(token)) return null;
  return token;
}

function safeCorrelationId(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9:._+-]{7,127}$/u.test(trimmed)) {
    throw new HostedOperationsControlError('OPERATIONS_UNAVAILABLE', 'Operations control is unavailable.', 1);
  }
  return trimmed;
}

function safeTraceId(value: string | null): string | null {
  if (value === null) return null;
  const trace = value.trim().toLowerCase();
  return /^[a-f0-9]{32}$/u.test(trace) ? trace : null;
}

export class HostedOperationsControl {
  readonly #secret: string | Uint8Array;
  readonly #policy: HostedOperationsPolicy;
  readonly #sink: HostedOperationsTelemetrySink;
  readonly #clock: () => Date;
  readonly #buckets = new Map<string, BucketState>();
  #lastObservedMilliseconds = Number.NEGATIVE_INFINITY;

  constructor(options: {
    secret: string | Uint8Array;
    sink: HostedOperationsTelemetrySink;
    policy?: HostedOperationsPolicy;
    clock?: () => Date;
  }) {
    this.#secret = validSecret(options.secret);
    this.#sink = options.sink;
    this.#policy = sealedHostedOperationsPolicy(options.policy ?? hostedOperationsPolicyV1);
    this.#clock = options.clock ?? (() => new Date());
    if (hostedOperationsPolicyDigest(this.#policy).length !== 64) {
      throw new Error('Operations policy digest is invalid.');
    }
  }

  #fingerprint(domain: string, value: string): string {
    return createHmac('sha256', this.#secret)
      .update(`${domain}\0${value}`, 'utf8')
      .digest('hex');
  }

  #writeTelemetry(event: HostedOperationsTelemetryEvent): void {
    try {
      this.#sink.write(event);
    } catch {
      // The HTTP response remains authoritative. Platform stderr reports a sink outage
      // without replaying or exposing request data.
      try {
        console.error(JSON.stringify({
          severity: 'ERROR',
          message: 'OpenLinear structured telemetry sink unavailable.',
          component: 'hosted-operations',
          correlationId: event.correlationId,
        }));
      } catch {
        // Telemetry and its bounded fallback must never reject an authoritative request.
      }
    }
  }

  #nowMilliseconds(): number {
    const milliseconds = this.#clock().getTime();
    if (!Number.isFinite(milliseconds)) {
      throw new HostedOperationsControlError('OPERATIONS_UNAVAILABLE', 'Operations control is unavailable.', 1);
    }
    const tolerance = this.#policy.clockRegressionToleranceSeconds * 1_000;
    if (milliseconds + tolerance < this.#lastObservedMilliseconds) {
      throw new HostedOperationsControlError('OPERATIONS_UNAVAILABLE', 'Operations control is unavailable.', 1);
    }
    this.#lastObservedMilliseconds = Math.max(milliseconds, this.#lastObservedMilliseconds);
    return this.#lastObservedMilliseconds;
  }

  #telemetryMilliseconds(fallbackMilliseconds?: number): number {
    try {
      return this.#nowMilliseconds();
    } catch {
      if (fallbackMilliseconds !== undefined && Number.isFinite(fallbackMilliseconds)) {
        return fallbackMilliseconds;
      }
      if (Number.isFinite(this.#lastObservedMilliseconds)) return this.#lastObservedMilliseconds;
      const emergencyMilliseconds = Date.now();
      return Number.isFinite(emergencyMilliseconds) ? emergencyMilliseconds : 0;
    }
  }

  #pruneExpired(currentWindowStart: number): void {
    for (const [key, value] of this.#buckets) {
      if (value.windowStartMilliseconds < currentWindowStart) this.#buckets.delete(key);
    }
  }

  admit(input: HostedOperationsAdmissionInput): HostedOperationsAdmission {
    const correlationId = safeCorrelationId(input.correlationId);
    const method = safeMethod(input.method);
    const routeClass = classifyHostedOperationsRoute(input.pathname, method);
    const profile = this.#policy.limits[routeClass];
    const now = this.#nowMilliseconds();
    const windowMilliseconds = this.#policy.windowSeconds * 1_000;
    const windowStart = Math.floor(now / windowMilliseconds) * windowMilliseconds;
    const windowEnd = windowStart + windowMilliseconds;
    const networkFingerprint = this.#fingerprint('network:v1', input.networkAddress ?? 'unavailable');
    const rawCredential = bearerCredential(input.authorization);
    const credentialFingerprint = rawCredential === null
      ? null
      : this.#fingerprint('credential:v1', rawCredential);
    const workspaceFingerprint = input.workspaceId === null
      ? null
      : this.#fingerprint('workspace:v1', input.workspaceId);
    const candidates: Array<{key: string; limit: number}> = [
      {key: `${routeClass}:global`, limit: profile.global},
      {key: `${routeClass}:network:${networkFingerprint}`, limit: profile.network},
    ];
    if (profile.credential !== null && credentialFingerprint !== null) {
      candidates.push({key: `${routeClass}:credential:${credentialFingerprint}`, limit: profile.credential});
    }
    if (profile.workspace !== null && workspaceFingerprint !== null) {
      candidates.push({key: `${routeClass}:workspace:${workspaceFingerprint}`, limit: profile.workspace});
    }

    this.#pruneExpired(windowStart);
    const newKeys = candidates.filter(({key}) => !this.#buckets.has(key)).length;
    if (this.#buckets.size + newKeys > this.#policy.maxTrackedBuckets) {
      throw new HostedOperationsControlError(
        'OPERATIONS_RATE_LIMITED',
        'The request rate is temporarily limited.',
        Math.max(1, Math.ceil((windowEnd - now) / 1_000)),
      );
    }
    let mostRestrictiveLimit = Number.POSITIVE_INFINITY;
    let mostRestrictiveRemaining = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const existing = this.#buckets.get(candidate.key);
      if (existing !== undefined && existing.windowStartMilliseconds > windowStart) {
        throw new HostedOperationsControlError('OPERATIONS_UNAVAILABLE', 'Operations control is unavailable.', 1);
      }
      const count = existing?.windowStartMilliseconds === windowStart ? existing.count : 0;
      if (count >= candidate.limit) {
        throw new HostedOperationsControlError(
          'OPERATIONS_RATE_LIMITED',
          'The request rate is temporarily limited.',
          Math.max(1, Math.ceil((windowEnd - now) / 1_000)),
        );
      }
      const remaining = candidate.limit - count - 1;
      if (remaining < mostRestrictiveRemaining
        || (remaining === mostRestrictiveRemaining && candidate.limit < mostRestrictiveLimit)) {
        mostRestrictiveLimit = candidate.limit;
        mostRestrictiveRemaining = remaining;
      }
    }
    for (const candidate of candidates) {
      const existing = this.#buckets.get(candidate.key);
      const count = existing?.windowStartMilliseconds === windowStart ? existing.count : 0;
      this.#buckets.set(candidate.key, {windowStartMilliseconds: windowStart, count: count + 1});
    }
    return {
      correlationId,
      routeClass,
      method,
      admittedAt: canonicalTimestamp(now),
      startedAtMilliseconds: now,
      networkFingerprint,
      credentialFingerprint,
      workspaceFingerprint,
      traceId: safeTraceId(input.traceId),
      limit: mostRestrictiveLimit,
      remaining: mostRestrictiveRemaining,
      windowEndsAt: canonicalTimestamp(windowEnd),
    };
  }

  recordAdmissionFailure(
    input: HostedOperationsAdmissionInput,
    error: HostedOperationsControlError,
  ): void {
    const occurredAtMilliseconds = this.#telemetryMilliseconds();
    const correlationId = safeCorrelationId(input.correlationId);
    const method = safeMethod(input.method);
    const rawCredential = bearerCredential(input.authorization);
    const statusCode = error.code === 'OPERATIONS_RATE_LIMITED' ? 429 : 503;
    this.#writeTelemetry({
      schemaVersion: hostedOperationsTelemetrySchemaVersion,
      id: `request:${correlationId}`,
      occurredAt: canonicalTimestamp(occurredAtMilliseconds),
      correlationId,
      routeClass: classifyHostedOperationsRoute(input.pathname, method),
      method,
      statusCode,
      outcome: statusCode === 429 ? 'rejected' : 'failed',
      durationMilliseconds: 0,
      networkFingerprint: this.#fingerprint('network:v1', input.networkAddress ?? 'unavailable'),
      credentialFingerprint: rawCredential === null
        ? null
        : this.#fingerprint('credential:v1', rawCredential),
      workspaceFingerprint: input.workspaceId === null
        ? null
        : this.#fingerprint('workspace:v1', input.workspaceId),
      traceId: safeTraceId(input.traceId),
      limited: statusCode === 429,
    });
  }

  complete(
    admission: HostedOperationsAdmission,
    input: {statusCode: number; limited?: boolean},
  ): void {
    // Once an HTTP response is authoritative, completion telemetry must not turn a
    // clock anomaly into a rejected handler promise. Admission remains strict; this
    // path uses its already-trusted timestamp as a bounded zero-duration fallback.
    const completedAt = this.#telemetryMilliseconds(admission.startedAtMilliseconds);
    const statusCode = Number.isInteger(input.statusCode)
      && input.statusCode >= 100 && input.statusCode <= 599
      ? input.statusCode
      : 500;
    const event: HostedOperationsTelemetryEvent = {
      schemaVersion: hostedOperationsTelemetrySchemaVersion,
      id: `request:${admission.correlationId}`,
      occurredAt: canonicalTimestamp(completedAt),
      correlationId: admission.correlationId,
      routeClass: admission.routeClass,
      method: admission.method,
      statusCode,
      outcome: statusCode < 400 ? 'succeeded' : statusCode < 500 ? 'rejected' : 'failed',
      durationMilliseconds: Math.max(0, Math.round(completedAt - admission.startedAtMilliseconds)),
      networkFingerprint: admission.networkFingerprint,
      credentialFingerprint: admission.credentialFingerprint,
      workspaceFingerprint: admission.workspaceFingerprint,
      traceId: admission.traceId,
      limited: input.limited ?? statusCode === 429,
    };
    this.#writeTelemetry(event);
  }

  snapshotForTests(): Readonly<Record<string, {windowStartMilliseconds: number; count: number}>> {
    return Object.fromEntries([...this.#buckets.entries()].map(([key, value]) => [key, {...value}]));
  }
}
