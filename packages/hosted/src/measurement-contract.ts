export const hostedMeasurementSchemaVersion = 'openlinear.hosted-measurement.v1' as const;

export const hostedEventNames = [
  'owner.google_sign_in.completed',
  'workspace.bootstrap.completed',
  'workspace.bootstrap.failed',
  'project.created',
  'issue.created',
  'invitation.sent',
  'membership.accepted',
  'issue.assigned',
  'issue.member_action.completed',
  'comment.created',
  'trial.ended',
  'subscription.activated',
  'automation.task.completed',
  'authorization.checked',
] as const;

export type HostedEventName = (typeof hostedEventNames)[number];
export type HostedEventSource = 'web' | 'rest' | 'mcp' | 'system' | 'stripe' | 'creem';
export type HostedActorKind = 'user' | 'personal_token' | 'system' | 'stripe' | 'creem';
export type HostedMemberRole = 'owner' | 'member';

export interface HostedEventAttributes {
  'owner.google_sign_in.completed': { eligible: boolean };
  'workspace.bootstrap.completed': { trialStartedAt: string; trialEndsAt: string };
  'workspace.bootstrap.failed': {
    attemptId: string;
    reasonCode: string;
    disposition: 'recoverable' | 'terminal';
  };
  'project.created': { projectId: string };
  'issue.created': { issueId: string };
  'invitation.sent': {
    invitationId: string;
    eligibleTrialWorkspace: boolean;
    auditId: string;
  };
  'membership.accepted': {
    invitationId: string;
    memberUserId: string;
    emailMatched: boolean;
    validInvitation: boolean;
    firstAcceptance: boolean;
    auditId: string;
  };
  'issue.assigned': { issueId: string; assigneeUserId: string; actorRole: HostedMemberRole };
  'issue.member_action.completed': {
    issueId: string;
    memberUserId: string;
    action: 'status_changed' | 'priority_changed' | 'title_changed';
  };
  'comment.created': { issueId: string; authorUserId: string; actorRole: HostedMemberRole };
  'trial.ended': { eligible: boolean };
  'subscription.activated': {
    plan: 'monthly' | 'annual';
    activeSeats: number;
    amountMicrousd: number;
  };
  'automation.task.completed': {
    runId: string;
    taskId: string;
    surface: 'rest' | 'mcp';
    role: HostedMemberRole;
    environment: 'uat' | 'production';
    succeeded: boolean;
  };
  'authorization.checked': {
    operation: string;
    principalWorkspaceId: string;
    targetWorkspaceId: string;
    targetEntityType: string;
    targetEntityId: string;
    authorized: boolean;
    operationSucceeded: boolean;
    protectedReadDisclosed: boolean;
    protectedStateChanged: boolean;
    auditId: string;
  };
}

interface HostedProductEventBase<Name extends HostedEventName> {
  schemaVersion: typeof hostedMeasurementSchemaVersion;
  id: string;
  name: Name;
  source: HostedEventSource;
  occurredAt: string;
  receivedAt: string;
  workspaceId: string;
  actor: { kind: HostedActorKind; id: string };
  requestId: string;
  correlationId: string;
  attributes: HostedEventAttributes[Name];
}

export type HostedProductEvent = {
  [Name in HostedEventName]: HostedProductEventBase<Name>;
}[HostedEventName];

export interface HostedAuditChange {
  field: string;
  beforeSha256: string | null;
  afterSha256: string | null;
}

export interface HostedMutationAuditRecord {
  schemaVersion: typeof hostedMeasurementSchemaVersion;
  id: string;
  workspaceId: string;
  actor: { kind: HostedActorKind; id: string };
  source: HostedEventSource;
  occurredAt: string;
  requestId: string;
  entity: {
    type: string;
    id: string;
    revisionBefore: number | null;
    revisionAfter: number | null;
  };
  action: string;
  result: 'succeeded' | 'denied' | 'conflict';
  changes: HostedAuditChange[];
}

export interface HostedEconomicsRecord {
  schemaVersion: typeof hostedMeasurementSchemaVersion;
  id: string;
  workspaceId: string;
  provider: 'firebase' | 'stripe' | 'creem';
  kind: 'variable_cost' | 'recognized_revenue';
  category: string;
  periodStart: string;
  periodEnd: string;
  amountMicrousd: number;
  activePaidSeats: number;
  sourceRef: string;
  retrievedAt: string;
}

export class HostedMeasurementError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HostedMeasurementError';
  }
}

function record(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HostedMeasurementError('INVALID_RECORD', `${label} must be an object.`);
  }
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new HostedMeasurementError('UNSUPPORTED_FIELD', `${label} contains an unsupported or missing field.`);
  }
}

function text(value: unknown, label: string, maximum = 160): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum
    || !/^[A-Za-z0-9][A-Za-z0-9:._/@+-]*$/u.test(value)) {
    throw new HostedMeasurementError('INVALID_TEXT', `${label} is invalid.`);
  }
  const secretPatterns = [
    /(?:^|[:._/@+-])sk_(?:live|test)_[A-Za-z0-9]/iu,
    /(?:^|[:._/@+-])(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9]/iu,
    /(?:^|[:._/@+-])xox[baprs]-[A-Za-z0-9-]/iu,
    /(?:^|[:._/@+-])AIza[A-Za-z0-9_-]{12,}/u,
    /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/u,
  ];
  if (secretPatterns.some((pattern) => pattern.test(value))) {
    throw new HostedMeasurementError('CREDENTIAL_SHAPED_TEXT', `${label} must contain a reference, never a credential.`);
  }
}

function timestamp(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value) {
    throw new HostedMeasurementError('INVALID_TIMESTAMP', `${label} must be a canonical ISO timestamp.`);
  }
}

function boolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    throw new HostedMeasurementError('INVALID_BOOLEAN', `${label} must be boolean.`);
  }
}

function nonNegativeInteger(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new HostedMeasurementError('INVALID_INTEGER', `${label} must be a non-negative safe integer.`);
  }
}

function nullableRevision(value: unknown, label: string): asserts value is number | null {
  if (value !== null && (!Number.isSafeInteger(value) || (value as number) < 1)) {
    throw new HostedMeasurementError('INVALID_REVISION', `${label} must be null or a positive integer.`);
  }
}

function sha256(value: unknown, label: string): asserts value is string | null {
  if (value !== null && (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))) {
    throw new HostedMeasurementError('INVALID_DIGEST', `${label} must be null or a lowercase SHA-256 digest.`);
  }
}

const actorPrefixes: Record<HostedActorKind, string> = {
  user: 'user:',
  personal_token: 'patref:',
  system: 'system:',
  stripe: 'stripe:event:',
  creem: 'creem:event:',
};

function actor(value: unknown, label: string): asserts value is HostedProductEvent['actor'] {
  record(value, label);
  exactKeys(value, ['kind', 'id'], label);
  if (!['user', 'personal_token', 'system', 'stripe', 'creem'].includes(String(value.kind))) {
    throw new HostedMeasurementError('INVALID_ACTOR', `${label}.kind is invalid.`);
  }
  text(value.id, `${label}.id`, 128);
  const expectedPrefix = actorPrefixes[value.kind as HostedActorKind];
  if (!(value.id as string).startsWith(expectedPrefix)
    || (value.id as string).length <= expectedPrefix.length) {
    throw new HostedMeasurementError(
      'INVALID_ACTOR_REFERENCE',
      `${label}.id must be an opaque ${value.kind as string} reference, never a credential.`,
    );
  }
}

function assertSourceActorConsistency(
  source: HostedEventSource,
  value: HostedProductEvent['actor'],
  label: string,
): void {
  const allowed: Record<HostedEventSource, readonly HostedActorKind[]> = {
    web: ['user'],
    rest: ['user', 'personal_token'],
    mcp: ['user', 'personal_token'],
    system: ['system'],
    stripe: ['stripe'],
    creem: ['creem'],
  };
  if (!allowed[source].includes(value.kind)) {
    throw new HostedMeasurementError(
      'SOURCE_ACTOR_MISMATCH',
      `${label} source and actor kind are inconsistent.`,
    );
  }
}

function validateEventAttributes(name: HostedEventName, value: unknown): void {
  record(value, `${name}.attributes`);
  if (name === 'owner.google_sign_in.completed') {
    exactKeys(value, ['eligible'], `${name}.attributes`);
    boolean(value.eligible, `${name}.attributes.eligible`);
  } else if (name === 'workspace.bootstrap.completed') {
    exactKeys(value, ['trialStartedAt', 'trialEndsAt'], `${name}.attributes`);
    timestamp(value.trialStartedAt, `${name}.attributes.trialStartedAt`);
    timestamp(value.trialEndsAt, `${name}.attributes.trialEndsAt`);
    const duration = Date.parse(value.trialEndsAt) - Date.parse(value.trialStartedAt);
    if (duration !== 30 * 24 * 60 * 60 * 1_000) {
      throw new HostedMeasurementError('INVALID_TRIAL_WINDOW', 'The Pro trial must be exactly 30 consecutive days.');
    }
  } else if (name === 'workspace.bootstrap.failed') {
    exactKeys(value, ['attemptId', 'reasonCode', 'disposition'], `${name}.attributes`);
    text(value.attemptId, `${name}.attributes.attemptId`, 128);
    text(value.reasonCode, `${name}.attributes.reasonCode`, 80);
    if (value.disposition !== 'recoverable' && value.disposition !== 'terminal') {
      throw new HostedMeasurementError('INVALID_DISPOSITION', `${name}.attributes.disposition is invalid.`);
    }
  } else if (name === 'project.created') {
    exactKeys(value, ['projectId'], `${name}.attributes`);
    text(value.projectId, `${name}.attributes.projectId`, 128);
  } else if (name === 'issue.created') {
    exactKeys(value, ['issueId'], `${name}.attributes`);
    text(value.issueId, `${name}.attributes.issueId`, 128);
  } else if (name === 'invitation.sent') {
    exactKeys(value, ['invitationId', 'eligibleTrialWorkspace', 'auditId'], `${name}.attributes`);
    text(value.invitationId, `${name}.attributes.invitationId`, 128);
    boolean(value.eligibleTrialWorkspace, `${name}.attributes.eligibleTrialWorkspace`);
    text(value.auditId, `${name}.attributes.auditId`, 128);
  } else if (name === 'membership.accepted') {
    exactKeys(
      value,
      ['invitationId', 'memberUserId', 'emailMatched', 'validInvitation', 'firstAcceptance', 'auditId'],
      `${name}.attributes`,
    );
    text(value.invitationId, `${name}.attributes.invitationId`, 128);
    text(value.memberUserId, `${name}.attributes.memberUserId`, 128);
    boolean(value.emailMatched, `${name}.attributes.emailMatched`);
    boolean(value.validInvitation, `${name}.attributes.validInvitation`);
    boolean(value.firstAcceptance, `${name}.attributes.firstAcceptance`);
    text(value.auditId, `${name}.attributes.auditId`, 128);
  } else if (name === 'issue.assigned') {
    exactKeys(value, ['issueId', 'assigneeUserId', 'actorRole'], `${name}.attributes`);
    text(value.issueId, `${name}.attributes.issueId`, 128);
    text(value.assigneeUserId, `${name}.attributes.assigneeUserId`, 128);
    if (value.actorRole !== 'owner' && value.actorRole !== 'member') {
      throw new HostedMeasurementError('INVALID_ROLE', `${name}.attributes.actorRole is invalid.`);
    }
  } else if (name === 'issue.member_action.completed') {
    exactKeys(value, ['issueId', 'memberUserId', 'action'], `${name}.attributes`);
    text(value.issueId, `${name}.attributes.issueId`, 128);
    text(value.memberUserId, `${name}.attributes.memberUserId`, 128);
    if (!['status_changed', 'priority_changed', 'title_changed'].includes(String(value.action))) {
      throw new HostedMeasurementError('INVALID_MEMBER_ACTION', `${name}.attributes.action is invalid.`);
    }
  } else if (name === 'comment.created') {
    exactKeys(value, ['issueId', 'authorUserId', 'actorRole'], `${name}.attributes`);
    text(value.issueId, `${name}.attributes.issueId`, 128);
    text(value.authorUserId, `${name}.attributes.authorUserId`, 128);
    if (value.actorRole !== 'owner' && value.actorRole !== 'member') {
      throw new HostedMeasurementError('INVALID_ROLE', `${name}.attributes.actorRole is invalid.`);
    }
  } else if (name === 'trial.ended') {
    exactKeys(value, ['eligible'], `${name}.attributes`);
    boolean(value.eligible, `${name}.attributes.eligible`);
  } else if (name === 'subscription.activated') {
    exactKeys(value, ['plan', 'activeSeats', 'amountMicrousd'], `${name}.attributes`);
    if (value.plan !== 'monthly' && value.plan !== 'annual') {
      throw new HostedMeasurementError('INVALID_PLAN', `${name}.attributes.plan is invalid.`);
    }
    nonNegativeInteger(value.activeSeats, `${name}.attributes.activeSeats`);
    if (value.activeSeats < 1) {
      throw new HostedMeasurementError('INVALID_SEAT_COUNT', 'A paid subscription must contain at least one active seat.');
    }
    nonNegativeInteger(value.amountMicrousd, `${name}.attributes.amountMicrousd`);
  } else if (name === 'automation.task.completed') {
    exactKeys(value, ['runId', 'taskId', 'surface', 'role', 'environment', 'succeeded'], `${name}.attributes`);
    text(value.runId, `${name}.attributes.runId`, 128);
    text(value.taskId, `${name}.attributes.taskId`, 128);
    if (value.surface !== 'rest' && value.surface !== 'mcp') {
      throw new HostedMeasurementError('INVALID_SURFACE', `${name}.attributes.surface is invalid.`);
    }
    if (value.role !== 'owner' && value.role !== 'member') {
      throw new HostedMeasurementError('INVALID_ROLE', `${name}.attributes.role is invalid.`);
    }
    if (value.environment !== 'uat' && value.environment !== 'production') {
      throw new HostedMeasurementError('INVALID_ENVIRONMENT', `${name}.attributes.environment is invalid.`);
    }
    boolean(value.succeeded, `${name}.attributes.succeeded`);
  } else {
    exactKeys(
      value,
      [
        'operation',
        'principalWorkspaceId',
        'targetWorkspaceId',
        'targetEntityType',
        'targetEntityId',
        'authorized',
        'operationSucceeded',
        'protectedReadDisclosed',
        'protectedStateChanged',
        'auditId',
      ],
      `${name}.attributes`,
    );
    text(value.operation, `${name}.attributes.operation`, 128);
    text(value.principalWorkspaceId, `${name}.attributes.principalWorkspaceId`, 128);
    text(value.targetWorkspaceId, `${name}.attributes.targetWorkspaceId`, 128);
    text(value.targetEntityType, `${name}.attributes.targetEntityType`, 80);
    text(value.targetEntityId, `${name}.attributes.targetEntityId`, 128);
    boolean(value.authorized, `${name}.attributes.authorized`);
    boolean(value.operationSucceeded, `${name}.attributes.operationSucceeded`);
    boolean(value.protectedReadDisclosed, `${name}.attributes.protectedReadDisclosed`);
    boolean(value.protectedStateChanged, `${name}.attributes.protectedStateChanged`);
    text(value.auditId, `${name}.attributes.auditId`, 128);
    if (!value.operationSucceeded && (value.protectedReadDisclosed || value.protectedStateChanged)) {
      throw new HostedMeasurementError(
        'INVALID_AUTHORIZATION_OUTCOME',
        'A failed operation cannot report protected disclosure or state change.',
      );
    }
  }
}

export function assertHostedProductEvent(value: unknown): asserts value is HostedProductEvent {
  record(value, 'event');
  exactKeys(
    value,
    [
      'schemaVersion',
      'id',
      'name',
      'source',
      'occurredAt',
      'receivedAt',
      'workspaceId',
      'actor',
      'requestId',
      'correlationId',
      'attributes',
    ],
    'event',
  );
  if (value.schemaVersion !== hostedMeasurementSchemaVersion) {
    throw new HostedMeasurementError('INVALID_SCHEMA_VERSION', 'The event schema version is unsupported.');
  }
  text(value.id, 'event.id', 128);
  if (!hostedEventNames.includes(value.name as HostedEventName)) {
    throw new HostedMeasurementError('INVALID_EVENT_NAME', 'The event name is unsupported.');
  }
  if (!['web', 'rest', 'mcp', 'system', 'stripe', 'creem'].includes(String(value.source))) {
    throw new HostedMeasurementError('INVALID_SOURCE', 'The event source is unsupported.');
  }
  timestamp(value.occurredAt, 'event.occurredAt');
  timestamp(value.receivedAt, 'event.receivedAt');
  if (Date.parse(value.occurredAt) > Date.parse(value.receivedAt) + 5 * 60 * 1_000) {
    throw new HostedMeasurementError('INVALID_EVENT_CLOCK', 'The event is too far ahead of its receipt time.');
  }
  text(value.workspaceId, 'event.workspaceId', 128);
  actor(value.actor, 'event.actor');
  assertSourceActorConsistency(value.source as HostedEventSource, value.actor, 'event');
  text(value.requestId, 'event.requestId', 128);
  text(value.correlationId, 'event.correlationId', 128);
  validateEventAttributes(value.name as HostedEventName, value.attributes);
  if (value.name === 'automation.task.completed'
    && value.source !== (value.attributes as HostedEventAttributes['automation.task.completed']).surface) {
    throw new HostedMeasurementError('SOURCE_SURFACE_MISMATCH', 'Automation event source and surface must match.');
  }
  if (value.name === 'issue.member_action.completed') {
    const attributes = value.attributes as HostedEventAttributes['issue.member_action.completed'];
    if (value.actor.kind !== 'user' || value.actor.id !== attributes.memberUserId) {
      throw new HostedMeasurementError(
        'MEMBER_ACTION_ACTOR_MISMATCH',
        'A member action must be attributed to the same user reference.',
      );
    }
  }
  if (value.name === 'authorization.checked') {
    const attributes = value.attributes as HostedEventAttributes['authorization.checked'];
    if (value.workspaceId !== attributes.targetWorkspaceId) {
      throw new HostedMeasurementError(
        'AUTHORIZATION_TARGET_MISMATCH',
        'Authorization event workspace must equal its target workspace.',
      );
    }
  }
}

export function assertHostedMutationAuditRecord(value: unknown): asserts value is HostedMutationAuditRecord {
  record(value, 'audit');
  exactKeys(value, ['schemaVersion', 'id', 'workspaceId', 'actor', 'source', 'occurredAt', 'requestId', 'entity', 'action', 'result', 'changes'], 'audit');
  if (value.schemaVersion !== hostedMeasurementSchemaVersion) {
    throw new HostedMeasurementError('INVALID_SCHEMA_VERSION', 'The audit schema version is unsupported.');
  }
  text(value.id, 'audit.id', 128);
  text(value.workspaceId, 'audit.workspaceId', 128);
  actor(value.actor, 'audit.actor');
  if (!['web', 'rest', 'mcp', 'system', 'stripe', 'creem'].includes(String(value.source))) {
    throw new HostedMeasurementError('INVALID_SOURCE', 'The audit source is unsupported.');
  }
  assertSourceActorConsistency(value.source as HostedEventSource, value.actor, 'audit');
  timestamp(value.occurredAt, 'audit.occurredAt');
  text(value.requestId, 'audit.requestId', 128);
  record(value.entity, 'audit.entity');
  exactKeys(value.entity, ['type', 'id', 'revisionBefore', 'revisionAfter'], 'audit.entity');
  text(value.entity.type, 'audit.entity.type', 80);
  text(value.entity.id, 'audit.entity.id', 128);
  nullableRevision(value.entity.revisionBefore, 'audit.entity.revisionBefore');
  nullableRevision(value.entity.revisionAfter, 'audit.entity.revisionAfter');
  text(value.action, 'audit.action', 120);
  if (!['succeeded', 'denied', 'conflict'].includes(String(value.result))) {
    throw new HostedMeasurementError('INVALID_RESULT', 'The audit result is unsupported.');
  }
  if (!Array.isArray(value.changes) || value.changes.length > 100) {
    throw new HostedMeasurementError('INVALID_CHANGES', 'Audit changes must be a bounded array.');
  }
  for (const [index, change] of value.changes.entries()) {
    record(change, `audit.changes[${index}]`);
    exactKeys(change, ['field', 'beforeSha256', 'afterSha256'], `audit.changes[${index}]`);
    text(change.field, `audit.changes[${index}].field`, 80);
    sha256(change.beforeSha256, `audit.changes[${index}].beforeSha256`);
    sha256(change.afterSha256, `audit.changes[${index}].afterSha256`);
  }
}

export function assertHostedEconomicsRecord(value: unknown): asserts value is HostedEconomicsRecord {
  record(value, 'economics');
  exactKeys(value, ['schemaVersion', 'id', 'workspaceId', 'provider', 'kind', 'category', 'periodStart', 'periodEnd', 'amountMicrousd', 'activePaidSeats', 'sourceRef', 'retrievedAt'], 'economics');
  if (value.schemaVersion !== hostedMeasurementSchemaVersion) {
    throw new HostedMeasurementError('INVALID_SCHEMA_VERSION', 'The economics schema version is unsupported.');
  }
  text(value.id, 'economics.id', 128);
  text(value.workspaceId, 'economics.workspaceId', 128);
  if (value.provider !== 'firebase' && value.provider !== 'stripe' && value.provider !== 'creem') {
    throw new HostedMeasurementError('INVALID_PROVIDER', 'The economics provider is unsupported.');
  }
  if (value.kind !== 'variable_cost' && value.kind !== 'recognized_revenue') {
    throw new HostedMeasurementError('INVALID_ECONOMICS_KIND', 'The economics record kind is unsupported.');
  }
  text(value.category, 'economics.category', 100);
  timestamp(value.periodStart, 'economics.periodStart');
  timestamp(value.periodEnd, 'economics.periodEnd');
  if (Date.parse(value.periodEnd) <= Date.parse(value.periodStart)) {
    throw new HostedMeasurementError('INVALID_PERIOD', 'The economics period must end after it starts.');
  }
  nonNegativeInteger(value.amountMicrousd, 'economics.amountMicrousd');
  nonNegativeInteger(value.activePaidSeats, 'economics.activePaidSeats');
  text(value.sourceRef, 'economics.sourceRef', 240);
  timestamp(value.retrievedAt, 'economics.retrievedAt');
}

function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonical(entry)).join(',')}]`;
  record(value, 'canonical value');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function deduplicate<T extends { id: string }>(
  values: readonly T[],
  validate: (value: unknown) => void,
  conflictCode: string,
): T[] {
  const records = new Map<string, { canonical: string; value: T }>();
  for (const value of values) {
    validate(value);
    const serialized = canonical(value);
    const existing = records.get(value.id);
    if (existing && existing.canonical !== serialized) {
      throw new HostedMeasurementError(conflictCode, `Record ${value.id} has conflicting payloads.`);
    }
    if (!existing) records.set(value.id, { canonical: serialized, value: clone(value) });
  }
  return [...records.values()].map((entry) => entry.value).sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

export function deduplicateHostedEvents(values: readonly HostedProductEvent[]): HostedProductEvent[] {
  return deduplicate(values, assertHostedProductEvent, 'EVENT_ID_CONFLICT');
}

export function deduplicateHostedAudits(values: readonly HostedMutationAuditRecord[]): HostedMutationAuditRecord[] {
  return deduplicate(values, assertHostedMutationAuditRecord, 'AUDIT_ID_CONFLICT');
}

export function deduplicateHostedEconomics(values: readonly HostedEconomicsRecord[]): HostedEconomicsRecord[] {
  return deduplicate(values, assertHostedEconomicsRecord, 'ECONOMICS_ID_CONFLICT');
}
