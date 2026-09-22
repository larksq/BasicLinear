import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  hostedMeasurementSchemaVersion,
  type HostedMutationAuditRecord,
  type HostedProductEvent,
} from './measurement-contract.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationGrant,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
  type WorkspaceRole,
} from './workspace-authorization.js';
import {
  BillingServiceError,
  type WorkspaceMutationEntitlementPolicy,
} from './billing-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';
import {
  buildDefaultHostedTeamRecord,
  buildDefaultHostedWorkflowStatusRecords,
  defaultHostedStatusId,
  defaultHostedTeamId,
  trustedHostedCycleRecord,
  trustedHostedTeamRecord,
  trustedHostedWorkflowStatusRecord,
  type HostedWorkflowStatusCategory,
} from './workspace-configuration-service.js';
import {
  buildAutomaticIssueObservation,
  issueObservationPath,
  trustedIssueObservationRecord,
} from './issue-observation-service.js';

export const collaborationIssueStatuses = ['todo', 'in_progress', 'done'] as const;
export const collaborationIssuePriorities = ['no_priority', 'low', 'medium', 'high', 'urgent'] as const;
export type CollaborationIssueStatus = (typeof collaborationIssueStatuses)[number];
export type CollaborationIssuePriority = (typeof collaborationIssuePriorities)[number];

export interface CollaborationIssueResource {
  label: string;
  url: string;
}

export interface CollaborationIssue {
  schemaVersion: 1;
  id: string;
  number: number;
  workspaceId: string;
  title: string;
  description: string;
  status: CollaborationIssueStatus;
  priority: CollaborationIssuePriority;
  teamId: string;
  statusId: string;
  cycleId: string | null;
  projectId: string | null;
  milestoneId: string | null;
  parentIssueId: string | null;
  resources: CollaborationIssueResource[];
  dueAt: string | null;
  assigneeUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface CollaborationIssueActivity {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  actorUserId: string;
  action: string;
  entityType: 'issue' | 'comment';
  entityId: string;
  occurredAt: string;
  revisionBefore: number | null;
  revisionAfter: number;
}

export interface CollaborationComment {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  issueId: string;
  authorUserId: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  revision: number;
}

export interface CollaborationMember {
  userId: string;
  role: WorkspaceRole;
  displayName: string | null;
}

export interface CollaborationTransaction {
  get(path: string): Promise<unknown | null>;
  list(collectionPath: string, maximumRecords?: number): Promise<unknown[]>;
  create(path: string, value: Record<string, unknown>): void;
  set(path: string, value: Record<string, unknown>): void;
}

export interface CollaborationRepository {
  runTransaction<Value>(operation: (transaction: CollaborationTransaction) => Promise<Value>): Promise<Value>;
  listDocuments(
    collectionPath: string,
    orderByField: string,
    direction: 'asc' | 'desc',
    limit: number,
  ): Promise<unknown[]>;
}

export interface CollaborationServiceOptions {
  secret: string | Uint8Array;
  entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  clock?: () => Date;
  idFactory?: () => string;
}

export class CollaborationServiceError extends Error {
  readonly code:
    | 'INVALID_COLLABORATION_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'COLLABORATION_NOT_FOUND'
    | 'COLLABORATION_CONFLICT'
    | 'COLLABORATION_FORBIDDEN'
    | 'COLLABORATION_ENTITLEMENT_REQUIRED'
    | 'ASSIGNEE_UNAVAILABLE'
    | 'COLLABORATION_SERVICE_UNAVAILABLE';

  constructor(code: CollaborationServiceError['code'], message: string) {
    super(message);
    this.name = 'CollaborationServiceError';
    this.code = code;
  }
}

type MutationOperation =
  | 'issue.create'
  | 'issue.update'
  | 'issue.assign'
  | 'comment.create'
  | 'comment.edit'
  | 'comment.delete';

interface StoredMembership {
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string | null;
}

interface IdempotencyRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  userId: string;
  operation: MutationOperation;
  entityId: string;
  requestDigest: string;
  outcomeRevision: number;
  createdAt: string;
  binding: string;
}

interface StoredCollaborationIssue extends Omit<CollaborationIssue, 'number'> {
  number: number | null;
}

interface IssueSequenceRecord {
  schemaVersion: 1;
  workspaceId: string;
  nextNumber: number;
  createdAt: string;
  updatedAt: string;
}

interface TrustedIssueState {
  issues: CollaborationIssue[];
  nextNumber: number;
  sequence: IssueSequenceRecord | null;
  migratedIssues: CollaborationIssue[];
}

function issueFromState(state: TrustedIssueState, issueId: string): CollaborationIssue {
  const issue = state.issues.find((candidate) => candidate.id === issueId);
  if (issue === undefined) throw notFound();
  return issue;
}

interface MutationContext {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
  idempotencyKey: string;
}

interface AuthorizedMutationContext extends MutationContext {
  grant: WorkspaceAuthorizationGrant;
}

interface CreateIssueCommand extends MutationContext {
  title: string;
  description?: string;
  teamId?: string;
  statusId?: string;
  cycleId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  parentIssueId?: string | null;
  resources?: CollaborationIssueResource[];
  dueAt?: string | null;
}

interface UpdateIssueCommand extends MutationContext {
  issueId: string;
  expectedRevision: number;
  patch: {
    title?: string;
    description?: string;
    status?: CollaborationIssueStatus;
    priority?: CollaborationIssuePriority;
    teamId?: string;
    statusId?: string;
    cycleId?: string | null;
    projectId?: string | null;
    milestoneId?: string | null;
    parentIssueId?: string | null;
    resources?: CollaborationIssueResource[];
    dueAt?: string | null;
  };
}

interface AssignIssueCommand extends MutationContext {
  issueId: string;
  expectedRevision: number;
  assigneeUserId: string | null;
}

interface CreateCommentCommand extends MutationContext {
  issueId: string;
  body: string;
}

interface UpdateCommentCommand extends MutationContext {
  issueId: string;
  commentId: string;
  expectedRevision: number;
}

interface EditCommentCommand extends UpdateCommentCommand {
  body: string;
}

interface ListCommand {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
}

interface ListCommentsCommand extends ListCommand {
  issueId: string;
}

interface ListActivityCommand extends ListCommand {
  issueId: string;
}

const legacyIssueKeys = [
  'schemaVersion', 'id', 'workspaceId', 'title', 'status', 'priority', 'assigneeUserId',
  'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const placedIssueKeys = [
  'schemaVersion', 'id', 'workspaceId', 'title', 'status', 'priority', 'projectId',
  'milestoneId', 'assigneeUserId', 'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const richIssueKeys = [
  'schemaVersion', 'id', 'workspaceId', 'title', 'description', 'status', 'priority', 'projectId',
  'milestoneId', 'parentIssueId', 'resources', 'assigneeUserId', 'createdByUserId', 'createdAt',
  'updatedAt', 'revision',
] as const;
const unnumberedIssueKeys = [
  'schemaVersion', 'id', 'workspaceId', 'title', 'description', 'status', 'priority', 'teamId',
  'statusId', 'cycleId', 'projectId', 'milestoneId', 'parentIssueId', 'resources',
  'assigneeUserId', 'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const issueKeys = [
  'schemaVersion', 'id', 'number', 'workspaceId', 'title', 'description', 'status', 'priority', 'teamId',
  'statusId', 'cycleId', 'projectId', 'milestoneId', 'parentIssueId', 'resources',
  'assigneeUserId', 'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const scheduledUnnumberedIssueKeys = [...unnumberedIssueKeys, 'dueAt'] as const;
const scheduledIssueKeys = [...issueKeys, 'dueAt'] as const;
const issueSequenceKeys = [
  'schemaVersion', 'workspaceId', 'nextNumber', 'createdAt', 'updatedAt',
] as const;
const commentKeys = [
  'schemaVersion', 'id', 'workspaceId', 'issueId', 'authorUserId', 'body', 'createdAt',
  'updatedAt', 'deletedAt', 'revision',
] as const;
const activityKeys = [
  'schemaVersion', 'id', 'workspaceId', 'issueId', 'actorUserId', 'action', 'entityType',
  'entityId', 'occurredAt', 'revisionBefore', 'revisionAfter',
] as const;
const idempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'userId', 'operation', 'entityId', 'requestDigest',
  'outcomeRevision', 'createdAt', 'binding',
] as const;

const paths = {
  hostedUser: (userId: string) => `hostedUsers/${userId}`,
  membership: (workspaceId: string, userId: string) => `workspaces/${workspaceId}/memberships/${userId}`,
  memberships: (workspaceId: string) => `workspaces/${workspaceId}/memberships`,
  issue: (workspaceId: string, issueId: string) => `workspaces/${workspaceId}/issues/${issueId}`,
  issues: (workspaceId: string) => `workspaces/${workspaceId}/issues`,
  issueSequence: (workspaceId: string) => `workspaces/${workspaceId}/issueSequences/issues`,
  project: (workspaceId: string, projectId: string) => `workspaces/${workspaceId}/projects/${projectId}`,
  milestone: (workspaceId: string, milestoneId: string) => `workspaces/${workspaceId}/milestones/${milestoneId}`,
  team: (workspaceId: string, teamId: string) => `workspaces/${workspaceId}/teams/${teamId}`,
  status: (workspaceId: string, statusId: string) => `workspaces/${workspaceId}/workflowStatuses/${statusId}`,
  cycle: (workspaceId: string, cycleId: string) => `workspaces/${workspaceId}/cycles/${cycleId}`,
  comment: (workspaceId: string, issueId: string, commentId: string) => (
    `workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}`
  ),
  comments: (workspaceId: string, issueId: string) => `workspaces/${workspaceId}/issues/${issueId}/comments`,
  activity: (workspaceId: string, issueId: string, activityId: string) => (
    `workspaces/${workspaceId}/issues/${issueId}/activity/${activityId}`
  ),
  idempotency: (workspaceId: string, digest: string) => (
    `workspaces/${workspaceId}/collaborationIdempotency/${digest}`
  ),
  event: (workspaceId: string, eventId: string) => `workspaces/${workspaceId}/productEvents/${eventId}`,
  audit: (workspaceId: string, auditId: string) => `workspaces/${workspaceId}/mutationAudits/${auditId}`,
};

function hostedUserDisplayName(value: unknown, userId: string): string | null {
  const candidate = record(value);
  if (candidate === null || candidate.schemaVersion !== 1 || candidate.uid !== userId
    || candidate.authProvider !== 'google.com' || !canonicalTimestamp(candidate.updatedAt)
    || candidate.displayName !== null && (typeof candidate.displayName !== 'string'
      || candidate.displayName !== candidate.displayName.trim()
      || candidate.displayName.length < 1 || candidate.displayName.length > 160)) {
    return null;
  }
  return candidate.displayName as string | null;
}

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
  return typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function assertAtOrBefore(value: string, now: string): void {
  if (Date.parse(value) > Date.parse(now)) throw unavailable();
}

function safeWorkspaceId(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
  }
  return normalized;
}

function safeReference(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
  }
  return normalized;
}

function safeIssueId(value: string): string {
  const normalized = value.trim();
  if (!/^issue_[a-f0-9]{32}$/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
  }
  return normalized;
}

function safeCommentId(value: string): string {
  const normalized = value.trim();
  if (!/^comment_[a-f0-9]{32}$/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
  }
  return normalized;
}

function safeProjectId(value: string): string {
  const normalized = value.trim();
  if (!/^project_[a-f0-9]{32}$/u.test(normalized)) throw invalidRequest();
  return normalized;
}

function safeMilestoneId(value: string): string {
  const normalized = value.trim();
  if (!/^milestone_[a-f0-9]{32}$/u.test(normalized)) throw invalidRequest();
  return normalized;
}

function safeTeamId(value: string): string {
  const normalized = value.trim();
  if (!/^team_[a-f0-9]{32}$/u.test(normalized)) throw invalidRequest();
  return normalized;
}

function safeStatusId(value: string): string {
  const normalized = value.trim();
  if (!/^status_[a-f0-9]{32}$/u.test(normalized)) throw invalidRequest();
  return normalized;
}

function safeCycleId(value: string): string {
  const normalized = value.trim();
  if (!/^cycle_[a-f0-9]{32}$/u.test(normalized)) throw invalidRequest();
  return normalized;
}

function legacyStatusForCategory(category: HostedWorkflowStatusCategory): CollaborationIssueStatus {
  if (category === 'started') return 'in_progress';
  if (category === 'completed' || category === 'canceled') return 'done';
  return 'todo';
}

function safeTitle(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 200 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The issue title is invalid.');
  }
  return normalized;
}

function safeDescription(value: string): string {
  const normalized = value.trim().replace(/\r\n?/gu, '\n');
  if (normalized.length > 10_000
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The issue description is invalid.');
  }
  return normalized;
}

function safeResource(value: CollaborationIssueResource): CollaborationIssueResource {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalidRequest();
  const candidate = value as unknown as Record<string, unknown>;
  if (!exactKeys(candidate, ['label', 'url']) || typeof candidate.label !== 'string'
    || typeof candidate.url !== 'string') throw invalidRequest();
  const label = candidate.label.trim();
  const url = candidate.url.trim();
  if (label.length < 1 || label.length > 120 || url.length < 1 || url.length > 2_048
    || /[\u0000-\u001F\u007F]/u.test(label) || /[\u0000-\u001F\u007F]/u.test(url)) throw invalidRequest();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalidRequest();
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username !== '' || parsed.password !== '') {
    throw invalidRequest();
  }
  return {label, url};
}

function safeResources(value: CollaborationIssueResource[] | undefined): CollaborationIssueResource[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 25) throw invalidRequest();
  const resources = value.map((resource) => safeResource(resource));
  const keys = resources.map((resource) => `${resource.label}\u0000${resource.url}`);
  if (new Set(keys).size !== keys.length) throw invalidRequest();
  return resources;
}

function safeDueAt(value: string | null): string | null {
  if (value === null) return null;
  if (!canonicalTimestamp(value)) throw invalidRequest();
  return value;
}

function safeCommentBody(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 4_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The comment is invalid.');
  }
  return normalized;
}

function storedSafeReference(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function positiveRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration revision is invalid.');
  }
  return value;
}

function opaquePart(value: string): string {
  const part = value.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(part)) throw new Error('The collaboration id factory returned an invalid value.');
  return part;
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string | Uint8Array, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function equalDigest(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(left) || !/^[a-f0-9]{64}$/u.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stable(candidate[key])}`).join(',')}}`;
}

function actor(principal: WorkspacePrincipal): HostedProductEvent['actor'] {
  if (principal.kind === 'user') return { kind: 'user', id: `user:${safeReference(principal.userId)}` };
  return { kind: 'personal_token', id: `patref:${principal.tokenReference}` };
}

function trustedStoredCollaborationIssueRecord(
  value: unknown,
  workspaceId: string,
  expectedId?: string,
): StoredCollaborationIssue {
  if (value === null) throw notFound();
  const candidate = record(value);
  const scheduled = candidate !== null && (
    exactKeys(candidate, scheduledIssueKeys) || exactKeys(candidate, scheduledUnnumberedIssueKeys)
  );
  const numbered = candidate !== null && (
    exactKeys(candidate, issueKeys) || exactKeys(candidate, scheduledIssueKeys)
  );
  const current = numbered || candidate !== null && (
    exactKeys(candidate, unnumberedIssueKeys) || exactKeys(candidate, scheduledUnnumberedIssueKeys)
  );
  const rich = candidate !== null && exactKeys(candidate, richIssueKeys);
  if (candidate === null || (!current && !rich && !exactKeys(candidate, placedIssueKeys) && !exactKeys(candidate, legacyIssueKeys))
    || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^issue_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || (numbered && (!Number.isSafeInteger(candidate.number) || (candidate.number as number) < 1))
    || candidate.workspaceId !== workspaceId
    || typeof candidate.title !== 'string' || candidate.title !== candidate.title.trim()
    || candidate.title.length < 1 || candidate.title.length > 200
    || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(candidate.title)
    || ((current || rich) && (typeof candidate.description !== 'string'
      || candidate.description !== candidate.description.trim().replace(/\r\n?/gu, '\n')
      || candidate.description.length > 10_000
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(candidate.description)))
    || !collaborationIssueStatuses.includes(candidate.status as CollaborationIssueStatus)
    || !collaborationIssuePriorities.includes(candidate.priority as CollaborationIssuePriority)
    || (current && (typeof candidate.teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.teamId)
      || typeof candidate.statusId !== 'string' || !/^status_[a-f0-9]{32}$/u.test(candidate.statusId)
      || (candidate.cycleId !== null
        && (typeof candidate.cycleId !== 'string' || !/^cycle_[a-f0-9]{32}$/u.test(candidate.cycleId)))) )
    || ('projectId' in candidate && candidate.projectId !== null
      && (typeof candidate.projectId !== 'string' || !/^project_[a-f0-9]{32}$/u.test(candidate.projectId)))
    || ('milestoneId' in candidate && candidate.milestoneId !== null
      && (typeof candidate.milestoneId !== 'string' || !/^milestone_[a-f0-9]{32}$/u.test(candidate.milestoneId)))
    || ('milestoneId' in candidate && candidate.milestoneId !== null
      && (!('projectId' in candidate) || candidate.projectId === null))
    || ((current || rich) && candidate.parentIssueId !== null
      && (typeof candidate.parentIssueId !== 'string' || !/^issue_[a-f0-9]{32}$/u.test(candidate.parentIssueId)
        || candidate.parentIssueId === candidate.id))
    || ((current || rich) && !Array.isArray(candidate.resources))
    || (scheduled && candidate.dueAt !== null && !canonicalTimestamp(candidate.dueAt))
    || (candidate.assigneeUserId !== null && !storedSafeReference(candidate.assigneeUserId))
    || !storedSafeReference(candidate.createdByUserId)
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) {
    throw unavailable();
  }
  let resources: CollaborationIssueResource[] = [];
  if (current || rich) {
    try {
      resources = safeResources(candidate.resources as CollaborationIssueResource[]);
    } catch {
      throw unavailable();
    }
  }
  return clone({
    ...candidate,
    number: numbered ? candidate.number : null,
    description: current || rich ? candidate.description : '',
    teamId: current ? candidate.teamId : defaultHostedTeamId(workspaceId),
    statusId: current ? candidate.statusId : defaultHostedStatusId(
      workspaceId,
      defaultHostedTeamId(workspaceId),
      candidate.status === 'in_progress' ? 'in_progress' : candidate.status === 'done' ? 'done' : 'todo',
    ),
    cycleId: current ? candidate.cycleId : null,
    projectId: 'projectId' in candidate ? candidate.projectId : null,
    milestoneId: 'milestoneId' in candidate ? candidate.milestoneId : null,
    parentIssueId: current || rich ? candidate.parentIssueId : null,
    resources,
    dueAt: scheduled ? candidate.dueAt : null,
  } as unknown as StoredCollaborationIssue);
}

export function trustedCollaborationIssueRecord(
  value: unknown,
  workspaceId: string,
  expectedId?: string,
): CollaborationIssue {
  const issue = trustedStoredCollaborationIssueRecord(value, workspaceId, expectedId);
  if (issue.number === null) throw unavailable();
  return issue as CollaborationIssue;
}

function trustedIssueSequenceRecord(
  value: unknown,
  workspaceId: string,
): IssueSequenceRecord | null {
  if (value === null) return null;
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, issueSequenceKeys)
    || candidate.schemaVersion !== 1 || candidate.workspaceId !== workspaceId
    || !Number.isSafeInteger(candidate.nextNumber) || (candidate.nextNumber as number) < 1
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)) {
    throw unavailable();
  }
  return clone(candidate as unknown as IssueSequenceRecord);
}

async function readTrustedIssueState(
  transaction: CollaborationTransaction,
  workspaceId: string,
  now: string,
): Promise<TrustedIssueState> {
  const [rawSequence, rawIssues] = await Promise.all([
    transaction.get(paths.issueSequence(workspaceId)),
    transaction.list(paths.issues(workspaceId), hostedOperationsPolicyV1.queries.maximumTransactionListRecords),
  ]);
  const sequence = trustedIssueSequenceRecord(rawSequence, workspaceId);
  if (sequence !== null) {
    assertAtOrBefore(sequence.createdAt, now);
    assertAtOrBefore(sequence.updatedAt, now);
  }
  const stored = rawIssues.map((value) => trustedStoredCollaborationIssueRecord(value, workspaceId));
  for (const issue of stored) {
    assertAtOrBefore(issue.createdAt, now);
    assertAtOrBefore(issue.updatedAt, now);
  }
  const numberedCount = stored.filter((issue) => issue.number !== null).length;
  if (numberedCount !== 0 && numberedCount !== stored.length) throw unavailable();
  const migratedIssues = numberedCount === 0
    ? [...stored]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((issue, index): CollaborationIssue => ({...issue, number: index + 1}))
    : [];
  const issues = numberedCount === 0
    ? migratedIssues
    : stored as CollaborationIssue[];
  if (issues.length > 0) {
    const statuses = (await transaction.list(
      `workspaces/${workspaceId}/workflowStatuses`, hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
    )).map(value => trustedHostedWorkflowStatusRecord(value, workspaceId));
    const statusById = new Map(statuses.map(status => [status.id, status]));
    if (statusById.size !== statuses.length) throw unavailable();
    for (const status of statuses) {
      assertAtOrBefore(status.createdAt, now);
      assertAtOrBefore(status.updatedAt, now);
    }
    for (const issue of issues) {
      const status = statusById.get(issue.statusId)
        ?? buildDefaultHostedWorkflowStatusRecords(workspaceId, issue.teamId, issue.createdAt)
          .find(candidate => candidate.id === issue.statusId);
      if (status === undefined || status.teamId !== issue.teamId) throw unavailable();
      // Completion follows the shared workflow definition. Reading a category
      // edit must not rewrite every issue or discard its revision history.
      issue.status = legacyStatusForCategory(status.category);
    }
  }
  const numbers = issues.map((issue) => issue.number).sort((left, right) => left - right);
  if (numbers.some((number, index) => number !== index + 1)) throw unavailable();
  const nextNumber = issues.length + 1;
  if (!Number.isSafeInteger(nextNumber)) throw unavailable();
  if (sequence !== null && sequence.nextNumber !== nextNumber) throw unavailable();
  return {issues, nextNumber, sequence, migratedIssues};
}

export async function readTrustedCollaborationIssues(
  transaction: CollaborationTransaction,
  workspaceId: string,
  now: string,
): Promise<CollaborationIssue[]> {
  return (await readTrustedIssueState(transaction, workspaceId, now)).issues;
}

export async function readTrustedCollaborationIssue(
  transaction: CollaborationTransaction,
  workspaceId: string,
  issueId: string,
  now: string,
): Promise<CollaborationIssue> {
  return issueFromState(await readTrustedIssueState(transaction, workspaceId, now), issueId);
}

function persistIssueState(
  transaction: CollaborationTransaction,
  workspaceId: string,
  state: TrustedIssueState,
  now: string,
  nextNumber = state.nextNumber,
): void {
  for (const issue of state.migratedIssues) {
    transaction.set(paths.issue(workspaceId, issue.id), {...issue});
  }
  if (state.sequence === null) {
    transaction.create(paths.issueSequence(workspaceId), {
      schemaVersion: 1,
      workspaceId,
      nextNumber,
      createdAt: now,
      updatedAt: now,
    });
  } else if (nextNumber !== state.sequence.nextNumber) {
    transaction.set(paths.issueSequence(workspaceId), {
      ...state.sequence,
      nextNumber,
      updatedAt: now,
    });
  }
}

export function trustedCollaborationCommentRecord(
  value: unknown,
  workspaceId: string,
  issueId: string,
  expectedId?: string,
): CollaborationComment {
  if (value === null) throw notFound();
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, commentKeys)
    || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^comment_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || candidate.workspaceId !== workspaceId || candidate.issueId !== issueId
    || !storedSafeReference(candidate.authorUserId)
    || (candidate.body !== null && (typeof candidate.body !== 'string'
      || candidate.body !== candidate.body.trim() || candidate.body.length < 1 || candidate.body.length > 4_000
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(candidate.body)))
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || (candidate.deletedAt !== null && !canonicalTimestamp(candidate.deletedAt))
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || (candidate.deletedAt === null) !== (candidate.body !== null)
    || (candidate.deletedAt !== null && candidate.deletedAt !== candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) {
    throw unavailable();
  }
  return clone(candidate as unknown as CollaborationComment);
}

const commentRecord = trustedCollaborationCommentRecord;

function activityRecord(
  value: unknown,
  workspaceId: string,
  issueId: string,
): CollaborationIssueActivity {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, activityKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^activity_[a-f0-9]{32}$/u.test(candidate.id)
    || candidate.workspaceId !== workspaceId || candidate.issueId !== issueId
    || !storedSafeReference(candidate.actorUserId)
    || typeof candidate.action !== 'string' || candidate.action.length < 1 || candidate.action.length > 120
    || !['issue', 'comment'].includes(String(candidate.entityType))
    || typeof candidate.entityId !== 'string' || !/^(?:issue|comment)_[a-f0-9]{32}$/u.test(candidate.entityId)
    || !canonicalTimestamp(candidate.occurredAt)
    || (candidate.revisionBefore !== null
      && (!Number.isSafeInteger(candidate.revisionBefore) || (candidate.revisionBefore as number) < 1))
    || !Number.isSafeInteger(candidate.revisionAfter) || (candidate.revisionAfter as number) < 1) {
    throw unavailable();
  }
  return clone(candidate as unknown as CollaborationIssueActivity);
}

function membershipRecord(value: unknown, workspaceId: string, userId: string): StoredMembership | null {
  if (value === null) return null;
  const candidate = record(value);
  const allowed = new Set([
    'schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt',
    'updatedAt', 'removedAt', 'revision',
  ]);
  if (candidate === null || Object.keys(candidate).some((key) => !allowed.has(key))
    || candidate.schemaVersion !== 1 || !storedSafeReference(candidate.id)
    || candidate.workspaceId !== workspaceId || candidate.userId !== userId
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (candidate.status !== 'active' && candidate.status !== 'removed')
    || !canonicalTimestamp(candidate.createdAt)
    || (candidate.updatedAt !== undefined && !canonicalTimestamp(candidate.updatedAt))
    || (candidate.removedAt !== undefined
      && candidate.removedAt !== null && !canonicalTimestamp(candidate.removedAt))
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) {
    throw unavailable();
  }
  if ((candidate.updatedAt !== undefined && Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt))
    || (candidate.status === 'active' && typeof candidate.removedAt === 'string')
    || (candidate.status === 'removed'
      && (typeof candidate.removedAt !== 'string' || candidate.updatedAt !== candidate.removedAt))) {
    throw unavailable();
  }
  return {
    userId,
    role: candidate.role,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
  };
}

function unavailable(): CollaborationServiceError {
  return new CollaborationServiceError(
    'COLLABORATION_SERVICE_UNAVAILABLE',
    'Collaboration is temporarily unavailable.',
  );
}

function auditChange(field: string, before: unknown, after: unknown) {
  return {
    field,
    beforeSha256: before === undefined ? null : digest(stable(before)),
    afterSha256: after === undefined ? null : digest(stable(after)),
  };
}

function idempotencyBinding(secret: string | Uint8Array, value: Omit<IdempotencyRecord, 'binding'>): string {
  return hmac(secret, stable(value));
}

class MemoryCollaborationTransaction implements CollaborationTransaction {
  constructor(private readonly documents: Map<string, unknown>) {}

  async get(path: string): Promise<unknown | null> {
    const value = this.documents.get(path);
    return value === undefined ? null : clone(value);
  }

  async list(collectionPath: string, maximumRecords?: number): Promise<unknown[]> {
    const prefix = `${collectionPath}/`;
    const values = [...this.documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => clone(value));
    if (maximumRecords !== undefined && values.length > maximumRecords) {
      throw new Error('COLLABORATION_QUERY_BUDGET_EXCEEDED');
    }
    return values;
  }

  create(path: string, value: Record<string, unknown>): void {
    if (this.documents.has(path)) throw new Error('ALREADY_EXISTS');
    this.documents.set(path, clone(value));
  }

  set(path: string, value: Record<string, unknown>): void {
    this.documents.set(path, clone(value));
  }
}

export class MemoryCollaborationRepository implements CollaborationRepository {
  #documents = new Map<string, unknown>();
  #queue: Promise<void> = Promise.resolve();

  runTransaction<Value>(operation: (transaction: CollaborationTransaction) => Promise<Value>): Promise<Value> {
    const pending = this.#queue.then(async () => {
      const working = new Map([...this.#documents.entries()].map(([path, value]) => [path, clone(value)]));
      const result = await operation(new MemoryCollaborationTransaction(working));
      this.#documents = working;
      return result;
    });
    this.#queue = pending.then(() => undefined, () => undefined);
    return pending;
  }

  async listDocuments(
    collectionPath: string,
    orderByField: string,
    direction: 'asc' | 'desc',
    limit: number,
  ): Promise<unknown[]> {
    await this.#queue;
    const prefix = `${collectionPath}/`;
    const multiplier = direction === 'asc' ? 1 : -1;
    return [...this.#documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .map(([, value]) => clone(value))
      .sort((left, right) => multiplier * String(record(left)?.[orderByField] ?? '').localeCompare(
        String(record(right)?.[orderByField] ?? ''),
      ))
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
    return Object.fromEntries([...this.#documents.entries()].map(([path, value]) => [path, clone(value)]));
  }
}

export class CollaborationService {
  readonly #repository: CollaborationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: string | Uint8Array;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #entitlementPolicy: WorkspaceMutationEntitlementPolicy;

  constructor(
    repository: CollaborationRepository,
    authorization: WorkspaceAuthorizationService,
    options: CollaborationServiceOptions,
  ) {
    const secretLength = typeof options.secret === 'string'
      ? Buffer.byteLength(options.secret, 'utf8')
      : options.secret.byteLength;
    if (secretLength < 32 || secretLength > 512) throw new Error('Collaboration secret must contain 32 to 512 bytes.');
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = options.secret;
    this.#entitlementPolicy = options.entitlementPolicy;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async listMembers(command: ListCommand): Promise<CollaborationMember[]> {
    const context = await this.#readContext(command, 'membership.list', 'membership', command.workspaceId);
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction(async (transaction) => {
        const memberships = await transaction.list(
          paths.memberships(context.workspaceId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        );
        const active = memberships.map((value) => {
        const candidate = record(value);
        if (candidate === null || typeof candidate.userId !== 'string') throw unavailable();
        const membership = membershipRecord(value, context.workspaceId, candidate.userId);
        if (membership !== null) {
          assertAtOrBefore(membership.createdAt, now);
          if (membership.updatedAt !== null) assertAtOrBefore(membership.updatedAt, now);
        }
        return membership;
        }).filter((value): value is StoredMembership => value !== null && value.status === 'active');
        return Promise.all(active.map(async ({userId, role}) => ({
          userId,
          role,
          displayName: hostedUserDisplayName(await transaction.get(paths.hostedUser(userId)), userId),
        })));
      });
      return values
        .sort((left, right) => left.userId.localeCompare(right.userId));
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async listIssues(command: ListCommand): Promise<CollaborationIssue[]> {
    const context = await this.#readContext(command, 'issue.read', 'issue', 'collection');
    try {
      const now = this.#trustedNow();
      const issues = await this.#repository.runTransaction((transaction) => (
        readTrustedCollaborationIssues(transaction, context.workspaceId, now)
      ));
      return issues
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async getIssue(command: ListCommand & {issueId: string}): Promise<CollaborationIssue> {
    const issueId = safeIssueId(command.issueId);
    const context = await this.#readContext(command, 'issue.read', 'issue', issueId);
    try {
      const now = this.#trustedNow();
      return await this.#repository.runTransaction(async (transaction) => {
        return readTrustedCollaborationIssue(transaction, context.workspaceId, issueId, now);
      });
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async listComments(command: ListCommentsCommand): Promise<CollaborationComment[]> {
    const issueId = safeIssueId(command.issueId);
    const context = await this.#readContext(command, 'comment.read', 'issue', issueId);
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction(async (transaction) => {
        await readTrustedCollaborationIssue(transaction, context.workspaceId, issueId, now);
        return transaction.list(
          paths.comments(context.workspaceId, issueId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        );
      });
      return values.map((value) => {
        const comment = commentRecord(value, context.workspaceId, issueId);
        assertAtOrBefore(comment.createdAt, now);
        assertAtOrBefore(comment.updatedAt, now);
        if (comment.deletedAt !== null) assertAtOrBefore(comment.deletedAt, now);
        return comment;
      })
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async getComment(command: ListCommentsCommand & {commentId: string}): Promise<CollaborationComment> {
    const issueId = safeIssueId(command.issueId);
    const commentId = safeCommentId(command.commentId);
    const context = await this.#readContext(command, 'comment.read', 'comment', commentId);
    try {
      const now = this.#trustedNow();
      return await this.#repository.runTransaction(async (transaction) => {
        await readTrustedCollaborationIssue(transaction, context.workspaceId, issueId, now);
        const comment = commentRecord(
          await transaction.get(paths.comment(context.workspaceId, issueId, commentId)),
          context.workspaceId,
          issueId,
          commentId,
        );
        assertAtOrBefore(comment.createdAt, now);
        assertAtOrBefore(comment.updatedAt, now);
        if (comment.deletedAt !== null) assertAtOrBefore(comment.deletedAt, now);
        return comment;
      });
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async listIssueActivity(command: ListActivityCommand): Promise<CollaborationIssueActivity[]> {
    const issueId = safeIssueId(command.issueId);
    const context = await this.#readContext(command, 'issue.read', 'issue', issueId);
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction(async (transaction) => {
        await readTrustedCollaborationIssue(transaction, context.workspaceId, issueId, now);
        return transaction.list(
          `workspaces/${context.workspaceId}/issues/${issueId}/activity`,
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        );
      });
      return values.map((value) => {
        const activity = activityRecord(value, context.workspaceId, issueId);
        assertAtOrBefore(activity.occurredAt, now);
        return activity;
      }).sort((left, right) => (
        left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id)
      ));
    } catch (error) {
      if (error instanceof CollaborationServiceError) throw error;
      throw unavailable();
    }
  }

  async createIssue(command: CreateIssueCommand): Promise<CollaborationIssue> {
    const title = safeTitle(command.title);
    const description = safeDescription(command.description ?? '');
    const teamId = command.teamId === undefined
      ? defaultHostedTeamId(command.workspaceId)
      : safeTeamId(command.teamId);
    const statusId = command.statusId === undefined
      ? defaultHostedStatusId(command.workspaceId, teamId, 'todo')
      : safeStatusId(command.statusId);
    const cycleId = command.cycleId === undefined || command.cycleId === null
      ? null
      : safeCycleId(command.cycleId);
    const projectId = command.projectId === undefined || command.projectId === null
      ? null
      : safeProjectId(command.projectId);
    const milestoneId = command.milestoneId === undefined || command.milestoneId === null
      ? null
      : safeMilestoneId(command.milestoneId);
    const parentIssueId = command.parentIssueId === undefined || command.parentIssueId === null
      ? null
      : safeIssueId(command.parentIssueId);
    const resources = safeResources(command.resources);
    const dueAt = command.dueAt === undefined ? null : safeDueAt(command.dueAt);
    if (milestoneId !== null && projectId === null) throw invalidRequest();
    const context = await this.#mutationContext(command, 'issue.write', 'issue', 'new');
    const requestDigest = hmac(this.#secret, stable({
      title, description, teamId, statusId, cycleId, projectId, milestoneId, parentIssueId, resources, dueAt,
    }));
    return this.#mutate(context, 'issue.create', requestDigest, null, async (transaction, grant, now, replay) => {
      const issueState = await readTrustedIssueState(transaction, context.workspaceId, now);
      if (replay !== null) return issueFromState(issueState, replay.entityId);
      if (!Number.isSafeInteger(issueState.nextNumber + 1)) throw unavailable();
      const id = `issue_${opaquePart(this.#idFactory())}`;
      const creatorObservationPath = issueObservationPath(context.workspaceId, id, grant.userId);
      if (await transaction.get(creatorObservationPath) !== null) throw unavailable();
      await this.#assertIssuePlacement(transaction, context.workspaceId, projectId, milestoneId, now);
      const configuration = await this.#readIssueConfiguration(
        transaction,
        context.workspaceId,
        teamId,
        statusId,
        cycleId,
        now,
        grant.userId,
      );
      await this.#assertIssueParent(transaction, context.workspaceId, id, parentIssueId, now);
      const issue: CollaborationIssue = {
        schemaVersion: 1, id, number: issueState.nextNumber,
        workspaceId: context.workspaceId, title, description, status: configuration.status,
        priority: 'no_priority', teamId, statusId, cycleId, projectId, milestoneId, parentIssueId, resources, dueAt,
        assigneeUserId: null, createdByUserId: grant.userId,
        createdAt: now, updatedAt: now, revision: 1,
      };
      await this.#activeActor(transaction, grant, now);
      const evidence = this.#issueCreatedEvidence(context, issue, now);
      configuration.persistDefaults();
      persistIssueState(transaction, context.workspaceId, issueState, now, issue.number + 1);
      transaction.create(paths.issue(context.workspaceId, id), { ...issue });
      transaction.create(creatorObservationPath, {
        ...buildAutomaticIssueObservation(this.#secret, context.workspaceId, id, grant.userId, now),
      });
      this.#writeEvidence(transaction, evidence);
      this.#writeActivity(transaction, context, issue.id, 'issue.created', 'issue', issue.id, null, 1, now);
      return issue;
    });
  }

  async updateIssue(command: UpdateIssueCommand): Promise<CollaborationIssue> {
    const issueId = safeIssueId(command.issueId);
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length < 1 || keys.some((key) => ![
      'title', 'description', 'status', 'priority', 'teamId', 'statusId', 'cycleId',
      'projectId', 'milestoneId', 'parentIssueId', 'resources', 'dueAt',
    ].includes(key))) {
      throw new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
    }
    const patch: UpdateIssueCommand['patch'] = {};
    if (command.patch.title !== undefined) patch.title = safeTitle(command.patch.title);
    if (command.patch.description !== undefined) patch.description = safeDescription(command.patch.description);
    if (command.patch.status !== undefined) {
      if (!collaborationIssueStatuses.includes(command.patch.status)) throw invalidRequest();
      patch.status = command.patch.status;
    }
    if (command.patch.priority !== undefined) {
      if (!collaborationIssuePriorities.includes(command.patch.priority)) throw invalidRequest();
      patch.priority = command.patch.priority;
    }
    if (command.patch.teamId !== undefined) patch.teamId = safeTeamId(command.patch.teamId);
    if (command.patch.statusId !== undefined) patch.statusId = safeStatusId(command.patch.statusId);
    if (command.patch.cycleId !== undefined) {
      patch.cycleId = command.patch.cycleId === null ? null : safeCycleId(command.patch.cycleId);
    }
    if (command.patch.projectId !== undefined) {
      patch.projectId = command.patch.projectId === null ? null : safeProjectId(command.patch.projectId);
    }
    if (command.patch.milestoneId !== undefined) {
      patch.milestoneId = command.patch.milestoneId === null ? null : safeMilestoneId(command.patch.milestoneId);
    }
    if (command.patch.parentIssueId !== undefined) {
      patch.parentIssueId = command.patch.parentIssueId === null ? null : safeIssueId(command.patch.parentIssueId);
    }
    if (command.patch.resources !== undefined) patch.resources = safeResources(command.patch.resources);
    if (command.patch.dueAt !== undefined) patch.dueAt = safeDueAt(command.patch.dueAt);
    const context = await this.#mutationContext(command, 'issue.write', 'issue', issueId);
    const requestDigest = hmac(this.#secret, stable({ issueId, expectedRevision, patch }));
    return this.#mutate(context, 'issue.update', requestDigest, issueId, async (transaction, grant, now, replay) => {
      const issueState = await readTrustedIssueState(transaction, context.workspaceId, now);
      const before = issueFromState(issueState, issueId);
      if (replay !== null) return before;
      assertAtOrBefore(before.updatedAt, now);
      const membership = await this.#activeActor(transaction, grant, now);
      if (before.revision !== expectedRevision) throw conflict();
      if (membership.role === 'member' && before.assigneeUserId !== grant.userId) throw forbidden();
      const teamId = patch.teamId ?? before.teamId;
      let statusId = patch.statusId ?? before.statusId;
      let cycleId = patch.cycleId === undefined ? before.cycleId : patch.cycleId;
      if (patch.teamId !== undefined && patch.statusId === undefined) {
        statusId = defaultHostedStatusId(
          context.workspaceId,
          teamId,
          (patch.status ?? before.status) === 'in_progress'
            ? 'in_progress'
            : (patch.status ?? before.status) === 'done' ? 'done' : 'todo',
        );
        if (patch.cycleId === undefined) cycleId = null;
      } else if (patch.status !== undefined && patch.statusId === undefined) {
        statusId = defaultHostedStatusId(
          context.workspaceId,
          teamId,
          patch.status === 'in_progress' ? 'in_progress' : patch.status === 'done' ? 'done' : 'todo',
        );
      }
      const configuration = await this.#readIssueConfiguration(
        transaction,
        context.workspaceId,
        teamId,
        statusId,
        cycleId,
        now,
        grant.userId,
      );
      if (patch.status !== undefined && patch.status !== configuration.status) throw invalidRequest();
      const after: CollaborationIssue = {
        ...before,
        ...patch,
        teamId,
        statusId,
        cycleId,
        status: configuration.status,
        updatedAt: now,
        revision: before.revision + 1,
      };
      if (after.milestoneId !== null && after.projectId === null) throw invalidRequest();
      await this.#assertIssuePlacement(
        transaction,
        context.workspaceId,
        after.projectId,
        after.milestoneId,
        now,
      );
      await this.#assertIssueParent(
        transaction,
        context.workspaceId,
        issueId,
        after.parentIssueId,
        now,
      );
      if (stable(before) === stable(after)) throw conflict();
      const changedFields = ([
        'title', 'description', 'status', 'priority', 'teamId', 'statusId', 'cycleId',
        'projectId', 'milestoneId', 'parentIssueId', 'resources', 'dueAt',
      ] as const).filter((field) => stable(before[field]) !== stable(after[field]));
      if (changedFields.length === 0) throw conflict();
      configuration.persistDefaults();
      persistIssueState(transaction, context.workspaceId, issueState, now);
      transaction.set(paths.issue(context.workspaceId, issueId), { ...after });
      this.#writeAudit(transaction, this.#audit(context, 'issue', issueId, 'issue.update', before.revision, after.revision,
        changedFields.map((field) => auditChange(field, before[field], after[field])), now));
      const activityFields = [...new Set(changedFields.map((field) => (
        field === 'statusId' ? 'status'
          : field === 'teamId' ? 'team'
            : field === 'cycleId' ? 'cycle'
              : field
      )))];
      for (const field of activityFields) {
        this.#writeActivity(transaction, context, issueId, `issue.${field}.changed`, 'issue', issueId, before.revision, after.revision, now);
        if (membership.role === 'member' && context.principal.kind === 'user'
          && (field === 'title' || field === 'status' || field === 'priority')) {
          this.#writeEvent(transaction, this.#memberActionEvent(context, issueId, field, now));
        }
      }
      return after;
    });
  }

  async assignIssue(command: AssignIssueCommand): Promise<CollaborationIssue> {
    const issueId = safeIssueId(command.issueId);
    const expectedRevision = positiveRevision(command.expectedRevision);
    const assigneeUserId = command.assigneeUserId === null ? null : safeReference(command.assigneeUserId);
    const context = await this.#mutationContext(command, 'issue.write', 'issue', issueId);
    const requestDigest = hmac(this.#secret, stable({ issueId, expectedRevision, assigneeUserId }));
    return this.#mutate(context, 'issue.assign', requestDigest, issueId, async (transaction, grant, now, replay) => {
      const issueState = await readTrustedIssueState(transaction, context.workspaceId, now);
      const before = issueFromState(issueState, issueId);
      if (replay !== null) return before;
      assertAtOrBefore(before.updatedAt, now);
      const membership = await this.#activeActor(transaction, grant, now);
      if (membership.role !== 'owner') throw forbidden();
      let assigneeObservation: unknown | null = null;
      if (assigneeUserId !== null) {
        const assignee = membershipRecord(
          await transaction.get(paths.membership(context.workspaceId, assigneeUserId)),
          context.workspaceId,
          assigneeUserId,
        );
        if (assignee === null || assignee.status !== 'active') {
          throw new CollaborationServiceError('ASSIGNEE_UNAVAILABLE', 'The selected assignee is unavailable.');
        }
        assertAtOrBefore(assignee.createdAt, now);
        if (assignee.updatedAt !== null) assertAtOrBefore(assignee.updatedAt, now);
        assigneeObservation = await transaction.get(
          issueObservationPath(context.workspaceId, issueId, assigneeUserId),
        );
        if (assigneeObservation !== null) {
          trustedIssueObservationRecord(
            assigneeObservation,
            this.#secret,
            context.workspaceId,
            issueId,
            assigneeUserId,
          );
        }
      }
      if (before.revision !== expectedRevision || before.assigneeUserId === assigneeUserId) throw conflict();
      const after: CollaborationIssue = { ...before, assigneeUserId, updatedAt: now, revision: before.revision + 1 };
      persistIssueState(transaction, context.workspaceId, issueState, now);
      transaction.set(paths.issue(context.workspaceId, issueId), { ...after });
      if (assigneeUserId !== null && assigneeObservation === null) {
        transaction.create(issueObservationPath(context.workspaceId, issueId, assigneeUserId), {
          ...buildAutomaticIssueObservation(
            this.#secret,
            context.workspaceId,
            issueId,
            assigneeUserId,
            now,
          ),
        });
      }
      this.#writeAudit(transaction, this.#audit(context, 'issue', issueId, 'issue.assign', before.revision, after.revision,
        [auditChange('assigneeUserId', before.assigneeUserId, after.assigneeUserId)], now));
      this.#writeActivity(transaction, context, issueId, assigneeUserId === null ? 'issue.unassigned' : 'issue.assigned',
        'issue', issueId, before.revision, after.revision, now);
      if (assigneeUserId !== null) this.#writeEvent(transaction, this.#assignedEvent(context, issueId, assigneeUserId, membership.role, now));
      return after;
    }, {assigneeUserId});
  }

  async createComment(command: CreateCommentCommand): Promise<CollaborationComment> {
    const issueId = safeIssueId(command.issueId);
    const body = safeCommentBody(command.body);
    const context = await this.#mutationContext(command, 'comment.write', 'issue', issueId);
    const requestDigest = hmac(this.#secret, stable({ issueId, body }));
    return this.#mutate(context, 'comment.create', requestDigest, null, async (transaction, grant, now, replay) => {
      if (replay !== null) {
        return commentRecord(await transaction.get(paths.comment(context.workspaceId, issueId, replay.entityId)), context.workspaceId, issueId, replay.entityId);
      }
      await this.#activeActor(transaction, grant, now);
      await readTrustedCollaborationIssue(transaction, context.workspaceId, issueId, now);
      const authorObservationPath = issueObservationPath(context.workspaceId, issueId, grant.userId);
      const authorObservation = await transaction.get(authorObservationPath);
      if (authorObservation !== null) {
        trustedIssueObservationRecord(
          authorObservation,
          this.#secret,
          context.workspaceId,
          issueId,
          grant.userId,
        );
      }
      const id = `comment_${opaquePart(this.#idFactory())}`;
      const comment: CollaborationComment = {
        schemaVersion: 1, id, workspaceId: context.workspaceId, issueId,
        authorUserId: grant.userId, body, createdAt: now, updatedAt: now, deletedAt: null, revision: 1,
      };
      transaction.create(paths.comment(context.workspaceId, issueId, id), { ...comment });
      if (authorObservation === null) {
        transaction.create(authorObservationPath, {
          ...buildAutomaticIssueObservation(
            this.#secret,
            context.workspaceId,
            issueId,
            grant.userId,
            now,
          ),
        });
      }
      this.#writeAudit(transaction, this.#audit(context, 'comment', id, 'comment.create', null, 1,
        [auditChange('body', undefined, body)], now));
      this.#writeEvent(transaction, this.#commentCreatedEvent(context, issueId, grant.userId, grant.role, now));
      this.#writeActivity(transaction, context, issueId, 'comment.created', 'comment', id, null, 1, now);
      return comment;
    });
  }

  async editComment(command: EditCommentCommand): Promise<CollaborationComment> {
    return this.#changeComment(command, 'comment.edit');
  }

  async deleteComment(command: UpdateCommentCommand): Promise<CollaborationComment> {
    return this.#changeComment(command, 'comment.delete');
  }

  async #changeComment(command: EditCommentCommand | UpdateCommentCommand, operation: 'comment.edit' | 'comment.delete') {
    const issueId = safeIssueId(command.issueId);
    const commentId = safeCommentId(command.commentId);
    const expectedRevision = positiveRevision(command.expectedRevision);
    const body = operation === 'comment.edit' ? safeCommentBody((command as EditCommentCommand).body) : null;
    const context = await this.#mutationContext(command, 'comment.write', 'comment', commentId);
    const requestDigest = hmac(this.#secret, stable({ issueId, commentId, expectedRevision, body }));
    return this.#mutate(context, operation, requestDigest, commentId, async (transaction, grant, now, replay) => {
      const before = commentRecord(
        await transaction.get(paths.comment(context.workspaceId, issueId, commentId)),
        context.workspaceId,
        issueId,
        commentId,
      );
      if (replay !== null) return before;
      assertAtOrBefore(before.updatedAt, now);
      const membership = await this.#activeActor(transaction, grant, now);
      if (membership.role !== 'owner' && before.authorUserId !== grant.userId) throw forbidden();
      if (before.revision !== expectedRevision || before.deletedAt !== null || before.body === body) throw conflict();
      const after: CollaborationComment = {
        ...before,
        body,
        updatedAt: now,
        deletedAt: operation === 'comment.delete' ? now : null,
        revision: before.revision + 1,
      };
      transaction.set(paths.comment(context.workspaceId, issueId, commentId), { ...after });
      this.#writeAudit(transaction, this.#audit(context, 'comment', commentId, operation, before.revision, after.revision,
        [auditChange('body', before.body, after.body), ...(operation === 'comment.delete'
          ? [auditChange('deletedAt', null, now)] : [])], now));
      this.#writeActivity(transaction, context, issueId, operation, 'comment', commentId, before.revision, after.revision, now);
      return after;
    });
  }

  async #readContext(
    command: ListCommand,
    action: 'membership.list' | 'issue.read' | 'comment.read',
    targetEntityType: string,
    targetEntityId: string,
  ) {
    const workspaceId = safeWorkspaceId(command.workspaceId);
    const requestId = safeReference(command.requestId);
    await this.#authorization.authorize({
      principal: command.principal, workspaceId, action, targetEntityType,
      targetEntityId: safeReference(targetEntityId), requestId,
    });
    return { workspaceId, requestId };
  }

  async #mutationContext(
    command: MutationContext,
    action: 'issue.write' | 'comment.write',
    targetEntityType: string,
    targetEntityId: string,
  ): Promise<AuthorizedMutationContext> {
    const workspaceId = safeWorkspaceId(command.workspaceId);
    const requestId = safeReference(command.requestId);
    const idempotencyKey = command.idempotencyKey.trim();
    if (idempotencyKey.length < 16 || idempotencyKey.length > 160 || /\s/u.test(idempotencyKey)) {
      throw new CollaborationServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
    }
    const grant = await this.#authorization.authorize({
      principal: command.principal, workspaceId, action, targetEntityType,
      targetEntityId: safeReference(targetEntityId), requestId,
    });
    return { principal: command.principal, workspaceId, requestId, idempotencyKey, grant };
  }

  async #mutate<Value extends {id: string; revision: number; updatedAt: string}>(
    context: AuthorizedMutationContext,
    operation: MutationOperation,
    requestDigest: string,
    fixedEntityId: string | null,
    operationBody: (
      transaction: CollaborationTransaction,
      grant: WorkspaceAuthorizationGrant,
      now: string,
      replay: IdempotencyRecord | null,
    ) => Promise<Value>,
    entitlementDetails: {assigneeUserId?: string | null} = {},
  ): Promise<Value> {
    const keyDigest = digest(`${context.grant.userId}:${operation}:${context.idempotencyKey}`);
    const path = paths.idempotency(context.workspaceId, keyDigest);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const rawIdempotency = await transaction.get(path);
        const nowDate = this.#clock();
        if (!Number.isFinite(nowDate.getTime())) throw unavailable();
        const now = nowDate.toISOString();
        const replay = rawIdempotency === null ? null : this.#idempotencyRecord(
          rawIdempotency,
          keyDigest,
          context,
          operation,
          requestDigest,
          now,
        );
        await this.#activeActor(transaction, context.grant, now);
        if (replay === null) {
          await this.#assertEntitled(transaction, context, operation, now, entitlementDetails);
        }
        const result = await operationBody(transaction, context.grant, now, replay);
        if (replay === null) {
          if (fixedEntityId !== null && result.id !== fixedEntityId) throw unavailable();
          const value: Omit<IdempotencyRecord, 'binding'> = {
            schemaVersion: 1, id: keyDigest, workspaceId: context.workspaceId,
            userId: context.grant.userId, operation, entityId: result.id,
            requestDigest, outcomeRevision: result.revision, createdAt: now,
          };
          transaction.create(path, { ...value, binding: idempotencyBinding(this.#secret, value) });
        } else {
          if (result.id !== replay.entityId || result.revision !== replay.outcomeRevision) throw conflict();
          if (result.updatedAt !== replay.createdAt) throw unavailable();
          const resultRecord = result as unknown as Record<string, unknown>;
          if ((operation === 'issue.create' || operation === 'comment.create')
            && resultRecord.createdAt !== replay.createdAt) throw unavailable();
          if (operation === 'issue.create' && resultRecord.createdByUserId !== context.grant.userId) throw unavailable();
          if (operation === 'comment.create' && resultRecord.authorUserId !== context.grant.userId) throw unavailable();
        }
        return clone(result);
      });
    } catch (error) {
      if (error instanceof CollaborationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async #assertEntitled(
    transaction: CollaborationTransaction,
    context: AuthorizedMutationContext,
    operation: MutationOperation,
    now: string,
    details: {assigneeUserId?: string | null},
  ): Promise<void> {
    try {
      await this.#entitlementPolicy.assertMutation({
        transaction,
        workspaceId: context.workspaceId,
        principal: context.principal,
        grant: context.grant,
        operation,
        now,
        ...(Object.hasOwn(details, 'assigneeUserId') ? {assigneeUserId: details.assigneeUserId} : {}),
      });
    } catch (error) {
      if (error instanceof BillingServiceError && error.code === 'BILLING_FORBIDDEN') {
        throw new CollaborationServiceError(
          'COLLABORATION_ENTITLEMENT_REQUIRED',
          'This workspace is on Free. Subscribe or reduce the workspace to continue this write.',
        );
      }
      throw unavailable();
    }
  }

  #idempotencyRecord(
    value: unknown,
    id: string,
    context: AuthorizedMutationContext,
    operation: MutationOperation,
    requestDigest: string,
    now: string,
  ): IdempotencyRecord {
    const candidate = record(value);
    if (candidate === null || !exactKeys(candidate, idempotencyKeys)
      || candidate.schemaVersion !== 1 || typeof candidate.id !== 'string'
      || typeof candidate.workspaceId !== 'string' || !storedSafeReference(candidate.workspaceId)
      || !storedSafeReference(candidate.userId)
      || !['issue.create', 'issue.update', 'issue.assign', 'comment.create', 'comment.edit', 'comment.delete']
        .includes(String(candidate.operation))
      || typeof candidate.entityId !== 'string'
      || !/^(?:issue|comment)_[a-f0-9]{32}$/u.test(candidate.entityId)
      || typeof candidate.requestDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.requestDigest)
      || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 1
      || !canonicalTimestamp(candidate.createdAt)
      || typeof candidate.binding !== 'string') throw unavailable();
    const unsigned: Omit<IdempotencyRecord, 'binding'> = {
      schemaVersion: 1, id: candidate.id, workspaceId: candidate.workspaceId,
      userId: candidate.userId, operation: candidate.operation as MutationOperation,
      entityId: candidate.entityId, requestDigest: candidate.requestDigest,
      outcomeRevision: candidate.outcomeRevision as number, createdAt: candidate.createdAt,
    };
    const expected = idempotencyBinding(this.#secret, unsigned);
    if (!equalDigest(candidate.binding, expected)) throw unavailable();
    if (unsigned.id !== id || unsigned.workspaceId !== context.workspaceId
      || unsigned.userId !== context.grant.userId || unsigned.operation !== operation
      || unsigned.requestDigest !== requestDigest) throw conflict();
    if (Date.parse(unsigned.createdAt) > Date.parse(now)) throw unavailable();
    return { ...unsigned, binding: expected };
  }

  async #activeActor(
    transaction: CollaborationTransaction,
    grant: WorkspaceAuthorizationGrant,
    now: string,
  ): Promise<StoredMembership> {
    const membership = membershipRecord(
      await transaction.get(paths.membership(grant.workspaceId, grant.userId)),
      grant.workspaceId,
      grant.userId,
    );
    if (membership === null || membership.status !== 'active') throw forbidden();
    if (membership.role !== grant.role) throw unavailable();
    assertAtOrBefore(membership.createdAt, now);
    if (membership.updatedAt !== null) assertAtOrBefore(membership.updatedAt, now);
    return membership;
  }

  async #assertIssuePlacement(
    transaction: CollaborationTransaction,
    workspaceId: string,
    projectId: string | null,
    milestoneId: string | null,
    now: string,
  ): Promise<void> {
    if (projectId === null) {
      if (milestoneId !== null) throw invalidRequest();
      return;
    }
    const project = record(await transaction.get(paths.project(workspaceId, projectId)));
    if (project === null || project.schemaVersion !== 1 || project.id !== projectId
      || project.workspaceId !== workspaceId || project.archivedAt !== null
      || !canonicalTimestamp(project.createdAt) || !canonicalTimestamp(project.updatedAt)
      || Date.parse(project.createdAt) > Date.parse(project.updatedAt)) throw unavailable();
    assertAtOrBefore(project.updatedAt, now);
    if (milestoneId === null) return;
    const milestone = record(await transaction.get(paths.milestone(workspaceId, milestoneId)));
    if (milestone === null || milestone.schemaVersion !== 1 || milestone.id !== milestoneId
      || milestone.workspaceId !== workspaceId || milestone.projectId !== projectId
      || milestone.archivedAt !== null || !canonicalTimestamp(milestone.createdAt)
      || !canonicalTimestamp(milestone.updatedAt)
      || Date.parse(milestone.createdAt) > Date.parse(milestone.updatedAt)) throw unavailable();
    assertAtOrBefore(milestone.updatedAt, now);
  }

  async #readIssueConfiguration(
    transaction: CollaborationTransaction,
    workspaceId: string,
    teamId: string,
    statusId: string,
    cycleId: string | null,
    now: string,
    actorUserId: string,
  ): Promise<{status: CollaborationIssueStatus; persistDefaults(): void}> {
    const rawTeam = await transaction.get(paths.team(workspaceId, teamId));
    const team = rawTeam === null && teamId === defaultHostedTeamId(workspaceId)
      ? buildDefaultHostedTeamRecord(workspaceId, actorUserId, now)
      : trustedHostedTeamRecord(rawTeam, workspaceId, teamId);
    assertAtOrBefore(team.createdAt, now);
    assertAtOrBefore(team.updatedAt, now);
    const rawStatus = await transaction.get(paths.status(workspaceId, statusId));
    const defaultStatus = buildDefaultHostedWorkflowStatusRecords(workspaceId, teamId, now)
      .find((candidate) => candidate.id === statusId) ?? null;
    const workflowStatus = rawStatus === null && defaultStatus !== null
      ? defaultStatus
      : trustedHostedWorkflowStatusRecord(rawStatus, workspaceId, statusId);
    if (workflowStatus.teamId !== teamId) throw invalidRequest();
    assertAtOrBefore(workflowStatus.createdAt, now);
    assertAtOrBefore(workflowStatus.updatedAt, now);
    if (cycleId !== null) {
      const cycle = trustedHostedCycleRecord(
        await transaction.get(paths.cycle(workspaceId, cycleId)),
        workspaceId,
        cycleId,
      );
      if (cycle.teamId !== teamId) throw invalidRequest();
      assertAtOrBefore(cycle.createdAt, now);
      assertAtOrBefore(cycle.updatedAt, now);
    }
    return {
      status: legacyStatusForCategory(workflowStatus.category),
      // The caller must finish its parent, placement, and actor reads first.
      persistDefaults() {
        if (rawTeam === null) transaction.create(paths.team(workspaceId, teamId), {...team});
        if (rawStatus === null) transaction.create(paths.status(workspaceId, statusId), {...workflowStatus});
      },
    };
  }

  async #assertIssueParent(
    transaction: CollaborationTransaction,
    workspaceId: string,
    issueId: string,
    parentIssueId: string | null,
    now: string,
  ): Promise<void> {
    if (parentIssueId === null) return;
    const visited = new Set<string>([issueId]);
    let currentId: string | null = parentIssueId;
    for (let depth = 0; currentId !== null && depth < 100; depth += 1) {
      if (visited.has(currentId)) throw invalidRequest();
      visited.add(currentId);
      const parent = trustedStoredCollaborationIssueRecord(
        await transaction.get(paths.issue(workspaceId, currentId)),
        workspaceId,
        currentId,
      );
      assertAtOrBefore(parent.createdAt, now);
      assertAtOrBefore(parent.updatedAt, now);
      currentId = parent.parentIssueId;
    }
    if (currentId !== null) throw unavailable();
  }

  #audit(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    entityType: string,
    entityId: string,
    action: string,
    revisionBefore: number | null,
    revisionAfter: number,
    changes: HostedMutationAuditRecord['changes'],
    now: string,
  ): HostedMutationAuditRecord {
    const value: HostedMutationAuditRecord = {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `audit:collaboration:${opaquePart(this.#idFactory())}`,
      workspaceId: context.workspaceId,
      actor: actor(context.principal), source: context.principal.source,
      occurredAt: now, requestId: context.requestId,
      entity: { type: entityType, id: entityId, revisionBefore, revisionAfter },
      action, result: 'succeeded', changes,
    };
    assertHostedMutationAuditRecord(value);
    return value;
  }

  #issueCreatedEvidence(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    issue: CollaborationIssue,
    now: string,
  ) {
    const event: HostedProductEvent = {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `event:issue:${opaquePart(this.#idFactory())}`,
      name: 'issue.created', source: context.principal.source, occurredAt: now, receivedAt: now,
      workspaceId: context.workspaceId, actor: actor(context.principal), requestId: context.requestId,
      correlationId: context.requestId, attributes: { issueId: issue.id },
    };
    return { event, audit: this.#audit(context, 'issue', issue.id, 'issue.create', null, 1,
      [auditChange('title', undefined, issue.title)], now) };
  }

  #assignedEvent(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    issueId: string,
    assigneeUserId: string,
    role: WorkspaceRole,
    now: string,
  ): HostedProductEvent {
    return {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `event:assignment:${opaquePart(this.#idFactory())}`,
      name: 'issue.assigned', source: context.principal.source, occurredAt: now, receivedAt: now,
      workspaceId: context.workspaceId, actor: actor(context.principal), requestId: context.requestId,
      correlationId: context.requestId,
      attributes: { issueId, assigneeUserId: `user:${assigneeUserId}`, actorRole: role },
    };
  }

  #memberActionEvent(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    issueId: string,
    field: 'title' | 'status' | 'priority',
    now: string,
  ): HostedProductEvent {
    const userId = `user:${context.principal.userId}`;
    return {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `event:memberaction:${opaquePart(this.#idFactory())}`,
      name: 'issue.member_action.completed', source: context.principal.source,
      occurredAt: now, receivedAt: now, workspaceId: context.workspaceId,
      actor: { kind: 'user', id: userId }, requestId: context.requestId, correlationId: context.requestId,
      attributes: { issueId, memberUserId: userId, action: `${field}_changed` },
    };
  }

  #commentCreatedEvent(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    issueId: string,
    authorUserId: string,
    role: WorkspaceRole,
    now: string,
  ): HostedProductEvent {
    return {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `event:comment:${opaquePart(this.#idFactory())}`,
      name: 'comment.created', source: context.principal.source, occurredAt: now, receivedAt: now,
      workspaceId: context.workspaceId, actor: actor(context.principal), requestId: context.requestId,
      correlationId: context.requestId,
      attributes: { issueId, authorUserId: `user:${authorUserId}`, actorRole: role },
    };
  }

  #writeEvidence(
    transaction: CollaborationTransaction,
    evidence: {event: HostedProductEvent; audit: HostedMutationAuditRecord},
  ) {
    this.#writeEvent(transaction, evidence.event);
    this.#writeAudit(transaction, evidence.audit);
  }

  #writeEvent(transaction: CollaborationTransaction, event: HostedProductEvent) {
    assertHostedProductEvent(event);
    transaction.create(paths.event(event.workspaceId, event.id), { ...event });
  }

  #writeAudit(transaction: CollaborationTransaction, audit: HostedMutationAuditRecord) {
    assertHostedMutationAuditRecord(audit);
    transaction.create(paths.audit(audit.workspaceId, audit.id), { ...audit });
  }

  #writeActivity(
    transaction: CollaborationTransaction,
    context: {principal: WorkspacePrincipal; workspaceId: string},
    issueId: string,
    action: string,
    entityType: 'issue' | 'comment',
    entityId: string,
    revisionBefore: number | null,
    revisionAfter: number,
    now: string,
  ) {
    const id = `activity_${opaquePart(this.#idFactory())}`;
    transaction.create(paths.activity(context.workspaceId, issueId, id), {
      schemaVersion: 1, id, workspaceId: context.workspaceId, issueId,
      actorUserId: context.principal.userId, action, entityType, entityId,
      occurredAt: now, revisionBefore, revisionAfter,
    });
  }

  #trustedNow(): string {
    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw unavailable();
    return now.toISOString();
  }
}

function invalidRequest(): CollaborationServiceError {
  return new CollaborationServiceError('INVALID_COLLABORATION_REQUEST', 'The collaboration request is invalid.');
}

function conflict(): CollaborationServiceError {
  return new CollaborationServiceError('COLLABORATION_CONFLICT', 'The collaboration record changed. Refresh and try again.');
}

function notFound(): CollaborationServiceError {
  return new CollaborationServiceError('COLLABORATION_NOT_FOUND', 'The requested collaboration resource is unavailable.');
}

function forbidden(): CollaborationServiceError {
  return new CollaborationServiceError('COLLABORATION_FORBIDDEN', 'The requested collaboration resource is unavailable.');
}
