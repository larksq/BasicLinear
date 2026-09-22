import { randomUUID } from 'node:crypto';
import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  hostedMeasurementSchemaVersion,
  type HostedMutationAuditRecord,
  type HostedProductEvent,
} from './measurement-contract.js';

export const workspaceRoles = ['owner', 'member'] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export const workspaceActions = [
  'workspace.read',
  'workspace.settings.manage',
  'membership.list',
  'membership.manage',
  'invitation.manage',
  'project.read',
  'project.write',
  'milestone.read',
  'milestone.write',
  'issue.read',
  'issue.write',
  'comment.read',
  'comment.write',
  'token.manage',
  'billing.manage',
  'workspace.export',
  'automation.execute',
] as const;
export type WorkspaceAction = (typeof workspaceActions)[number];

const opaquePersonalTokenReferencePattern = /^tokref_[a-f0-9]{32}$/u;

export function isOpaquePersonalTokenReference(value: unknown): value is string {
  return typeof value === 'string' && opaquePersonalTokenReferencePattern.test(value);
}

const ownerOnlyActions = new Set<WorkspaceAction>([
  'workspace.settings.manage',
  'membership.manage',
  'invitation.manage',
  'token.manage',
  'billing.manage',
  'workspace.export',
]);

export type WorkspaceMembershipStatus = 'active' | 'removed';

export interface WorkspaceMembershipRecord {
  schemaVersion: 1;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  status: WorkspaceMembershipStatus;
  revision: number;
}

export interface WorkspaceMembershipReader {
  readMembership(workspaceId: string, userId: string): Promise<unknown | null>;
}

interface WorkspaceUserPrincipal {
  kind: 'user';
  userId: string;
  source: 'web' | 'rest' | 'mcp';
}

interface WorkspacePersonalTokenPrincipal {
  kind: 'personal_token';
  userId: string;
  tokenReference: string;
  credentialWorkspaceId: string;
  source: 'rest' | 'mcp';
}

export type WorkspacePrincipal = WorkspaceUserPrincipal | WorkspacePersonalTokenPrincipal;

export interface WorkspaceAuthorizationRequest {
  principal: WorkspacePrincipal;
  workspaceId: string;
  action: WorkspaceAction;
  targetEntityType: string;
  targetEntityId: string;
  requestId: string;
}

export interface WorkspaceAuthorizationGrant {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  action: WorkspaceAction;
}

export type WorkspaceAuthorizationDenialReason =
  | 'action_unsupported'
  | 'principal_reference_invalid'
  | 'credential_workspace_mismatch'
  | 'membership_missing'
  | 'membership_invalid'
  | 'membership_inactive'
  | 'role_forbidden'
  | 'membership_lookup_unavailable';

type AuthorizationEvent = Extract<HostedProductEvent, {name: 'authorization.checked'}>;

export interface WorkspaceAuthorizationEvidence {
  event: AuthorizationEvent;
  audit: HostedMutationAuditRecord;
  denialReason: WorkspaceAuthorizationDenialReason | null;
}

export interface WorkspaceAuthorizationEvidenceWriter {
  writeAuthorizationEvidence(evidence: WorkspaceAuthorizationEvidence): Promise<void>;
}

export interface WorkspaceAuthorizationServiceOptions {
  clock?: () => Date;
  idFactory?: () => string;
}

export class WorkspaceAuthorizationError extends Error {
  readonly code:
    | 'WORKSPACE_ACCESS_DENIED'
    | 'AUTHORIZATION_UNAVAILABLE'
    | 'AUTHORIZATION_EVIDENCE_UNAVAILABLE';
  readonly reason: WorkspaceAuthorizationDenialReason | 'evidence_unavailable';

  constructor(
    code: WorkspaceAuthorizationError['code'],
    reason: WorkspaceAuthorizationError['reason'],
  ) {
    super(code === 'WORKSPACE_ACCESS_DENIED'
      ? 'The requested workspace resource is unavailable.'
      : 'Workspace authorization is temporarily unavailable.');
    this.name = 'WorkspaceAuthorizationError';
    this.code = code;
    this.reason = reason;
  }
}

const clone = <Value>(value: Value): Value => structuredClone(value);

function safeReference(value: string, label: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 3
    || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(normalized)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function safeWorkspaceReference(value: string, label: string): string {
  const normalized = value.trim();
  if (
    normalized.length < 3
    || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(normalized)
  ) {
    throw new Error(`${label} is invalid.`);
  }
  return normalized;
}

function runtimeWorkspaceAction(value: unknown): WorkspaceAction | null {
  return typeof value === 'string' && (workspaceActions as readonly string[]).includes(value)
    ? value as WorkspaceAction
    : null;
}

const membershipProjectionKeys = [
  'schemaVersion', 'workspaceId', 'userId', 'role', 'status', 'revision',
] as const;
const storedMembershipKeys = [
  'schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt', 'revision',
] as const;
const expandedStoredMembershipKeys = [...storedMembershipKeys, 'updatedAt', 'removedAt'] as const;

function exactKeys(candidate: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(candidate);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function membershipRecord(
  value: unknown,
  expectedWorkspaceId: string,
  expectedUserId: string,
): WorkspaceMembershipRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const projection = exactKeys(candidate, membershipProjectionKeys);
  const stored = exactKeys(candidate, storedMembershipKeys);
  const expanded = exactKeys(candidate, expandedStoredMembershipKeys);
  if (
    (!projection && !stored && !expanded)
    || candidate.schemaVersion !== 1
    || candidate.workspaceId !== expectedWorkspaceId
    || candidate.userId !== expectedUserId
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (candidate.status !== 'active' && candidate.status !== 'removed')
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1
  ) {
    return null;
  }
  if (!projection) {
    if (typeof candidate.id !== 'string' || candidate.id.length < 3 || candidate.id.length > 128
      || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(candidate.id)
      || !canonicalTimestamp(candidate.createdAt)) return null;
    if (stored && candidate.status !== 'active') return null;
    if (expanded) {
      const updatedAt = candidate.updatedAt;
      const removedAt = candidate.removedAt;
      if ((updatedAt !== null && !canonicalTimestamp(updatedAt))
        || (removedAt !== null && !canonicalTimestamp(removedAt))
        || (updatedAt !== null && Date.parse(updatedAt) < Date.parse(candidate.createdAt as string))
        || (candidate.status === 'active' && removedAt !== null)
        || (candidate.status === 'removed' && (updatedAt === null || removedAt !== updatedAt
          || (candidate.revision as number) < 2))) return null;
    }
  }
  return {
    schemaVersion: 1,
    workspaceId: candidate.workspaceId,
    userId: candidate.userId,
    role: candidate.role,
    status: candidate.status,
    revision: candidate.revision as number,
  };
}

export function actionsForWorkspaceRole(role: WorkspaceRole): readonly WorkspaceAction[] {
  return workspaceActions.filter((action) => role === 'owner' || !ownerOnlyActions.has(action));
}

function actorReference(
  principal: WorkspacePrincipal,
  tokenReference: string | null,
): HostedProductEvent['actor'] {
  if (principal.kind === 'user') {
    return { kind: 'user', id: `user:${safeReference(principal.userId, 'userId')}` };
  }
  if (tokenReference === null) return { kind: 'personal_token', id: 'patref:invalid' };
  return {
    kind: 'personal_token',
    id: `patref:${tokenReference}`,
  };
}

function authorizationEvidence(input: {
  request: WorkspaceAuthorizationRequest;
  operation: string;
  actor: HostedProductEvent['actor'];
  principalWorkspaceId: string;
  membership: WorkspaceMembershipRecord | null;
  authorized: boolean;
  denialReason: WorkspaceAuthorizationDenialReason | null;
  now: string;
  opaqueId: string;
}): WorkspaceAuthorizationEvidence {
  const actor = input.actor;
  const workspaceId = safeWorkspaceReference(input.request.workspaceId, 'workspaceId');
  const targetEntityType = safeReference(input.request.targetEntityType, 'targetEntityType');
  const targetEntityId = safeReference(input.request.targetEntityId, 'targetEntityId');
  const requestId = safeReference(input.request.requestId, 'requestId');
  const opaqueId = safeReference(input.opaqueId.replaceAll('-', ''), 'opaqueId');
  const auditId = `audit:authorization:${opaqueId}`;
  const event: AuthorizationEvent = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: `event:authorization:${opaqueId}`,
    name: 'authorization.checked',
    source: input.request.principal.source,
    occurredAt: input.now,
    receivedAt: input.now,
    workspaceId,
    actor,
    requestId,
    correlationId: `authorization:${requestId}`,
    attributes: {
      operation: input.operation,
      principalWorkspaceId: input.principalWorkspaceId,
      targetWorkspaceId: workspaceId,
      targetEntityType,
      targetEntityId,
      authorized: input.authorized,
      operationSucceeded: false,
      protectedReadDisclosed: false,
      protectedStateChanged: false,
      auditId,
    },
  };
  const audit: HostedMutationAuditRecord = {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: auditId,
    workspaceId,
    actor,
    source: input.request.principal.source,
    occurredAt: input.now,
    requestId,
    entity: {
      type: targetEntityType,
      id: targetEntityId,
      revisionBefore: null,
      revisionAfter: null,
    },
    action: `authorization.${input.operation}`,
    result: input.authorized ? 'succeeded' : 'denied',
    changes: [],
  };
  assertHostedProductEvent(event);
  assertHostedMutationAuditRecord(audit);
  return { event, audit, denialReason: input.denialReason };
}

export class WorkspaceAuthorizationService {
  readonly #memberships: WorkspaceMembershipReader;
  readonly #evidence: WorkspaceAuthorizationEvidenceWriter;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(
    memberships: WorkspaceMembershipReader,
    evidence: WorkspaceAuthorizationEvidenceWriter,
    options: WorkspaceAuthorizationServiceOptions = {},
  ) {
    this.#memberships = memberships;
    this.#evidence = evidence;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async authorize(request: WorkspaceAuthorizationRequest): Promise<WorkspaceAuthorizationGrant> {
    const workspaceId = safeWorkspaceReference(request.workspaceId, 'workspaceId');
    const userId = safeReference(request.principal.userId, 'userId');
    const action = runtimeWorkspaceAction(request.action);
    const tokenReference = request.principal.kind === 'personal_token'
      && isOpaquePersonalTokenReference(request.principal.tokenReference)
      ? request.principal.tokenReference
      : null;
    let credentialWorkspaceId: string | null = null;
    if (request.principal.kind === 'personal_token') {
      try {
        credentialWorkspaceId = safeWorkspaceReference(
          request.principal.credentialWorkspaceId,
          'credentialWorkspaceId',
        );
      } catch {
        credentialWorkspaceId = null;
      }
    }
    let membership: WorkspaceMembershipRecord | null = null;
    let denialReason: WorkspaceAuthorizationDenialReason | null = action === null
      ? 'action_unsupported'
      : null;

    if (
      denialReason === null
      && request.principal.kind === 'personal_token'
      && tokenReference === null
    ) {
      denialReason = 'principal_reference_invalid';
    } else if (
      denialReason === null
      && request.principal.kind === 'personal_token'
      && credentialWorkspaceId !== workspaceId
    ) {
      denialReason = 'credential_workspace_mismatch';
    } else if (denialReason === null) {
      let rawMembership: unknown | null;
      try {
        rawMembership = await this.#memberships.readMembership(workspaceId, userId);
      } catch {
        rawMembership = null;
        denialReason = 'membership_lookup_unavailable';
      }
      if (denialReason === null && rawMembership === null) {
        denialReason = 'membership_missing';
      } else if (denialReason === null) {
        membership = membershipRecord(rawMembership, workspaceId, userId);
        if (membership === null) denialReason = 'membership_invalid';
        else if (membership.status !== 'active') denialReason = 'membership_inactive';
        else if (membership.role !== 'owner' && ownerOnlyActions.has(action as WorkspaceAction)) {
          denialReason = 'role_forbidden';
        }
      }
    }

    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw new Error('The authorization clock is invalid.');
    const evidence = authorizationEvidence({
      request: { ...request, workspaceId },
      operation: action ?? 'unsupported',
      actor: actorReference(request.principal, tokenReference),
      principalWorkspaceId: request.principal.kind === 'personal_token'
        ? credentialWorkspaceId ?? 'workspace:invalid'
        : membership?.workspaceId ?? 'workspace:unscoped',
      membership,
      authorized: denialReason === null,
      denialReason,
      now: now.toISOString(),
      opaqueId: this.#idFactory(),
    });
    try {
      await this.#evidence.writeAuthorizationEvidence(evidence);
    } catch {
      throw new WorkspaceAuthorizationError(
        'AUTHORIZATION_EVIDENCE_UNAVAILABLE',
        'evidence_unavailable',
      );
    }
    if (denialReason === 'membership_lookup_unavailable') {
      throw new WorkspaceAuthorizationError('AUTHORIZATION_UNAVAILABLE', denialReason);
    }
    if (denialReason !== null || membership === null) {
      throw new WorkspaceAuthorizationError('WORKSPACE_ACCESS_DENIED', denialReason ?? 'membership_invalid');
    }
    return {
      workspaceId,
      userId,
      role: membership.role,
      action: action as WorkspaceAction,
    };
  }
}

export class MemoryWorkspaceMembershipReader implements WorkspaceMembershipReader {
  readonly #records = new Map<string, unknown>();
  reads = 0;

  set(record: WorkspaceMembershipRecord): void {
    this.#records.set(`${record.workspaceId}:${record.userId}`, clone(record));
  }

  setRaw(workspaceId: string, userId: string, value: unknown): void {
    this.#records.set(`${workspaceId}:${userId}`, clone(value));
  }

  remove(workspaceId: string, userId: string): void {
    this.#records.delete(`${workspaceId}:${userId}`);
  }

  async readMembership(workspaceId: string, userId: string): Promise<unknown | null> {
    this.reads += 1;
    const value = this.#records.get(`${workspaceId}:${userId}`);
    return value === undefined ? null : clone(value);
  }
}

export class MemoryWorkspaceAuthorizationEvidenceWriter implements WorkspaceAuthorizationEvidenceWriter {
  readonly records: WorkspaceAuthorizationEvidence[] = [];
  fail = false;

  async writeAuthorizationEvidence(evidence: WorkspaceAuthorizationEvidence): Promise<void> {
    if (this.fail) throw new Error('EVIDENCE_WRITE_FAILED');
    this.records.push(clone(evidence));
  }
}
