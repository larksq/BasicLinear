import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  assertHostedMutationAuditRecord,
  hostedMeasurementSchemaVersion,
  type HostedMutationAuditRecord,
} from './measurement-contract.js';
import {
  BillingServiceError,
  type WorkspaceMutationEntitlementPolicy,
} from './billing-service.js';
import { hostedOperationsPolicyV1 } from './operations-control.js';
import {readWorkspaceExportConfiguration, type WorkspaceExportConfiguration} from './workspace-export-configuration.js';
import {
  readTrustedCollaborationIssues,
  trustedCollaborationCommentRecord,
  type CollaborationComment,
  type CollaborationIssue,
  type CollaborationRepository,
  type CollaborationTransaction,
} from './collaboration-service.js';
import {
  trustedInvitationOwnerView,
  type InvitationOwnerView,
} from './invitation-service.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationGrant,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
  type WorkspaceRole,
} from './workspace-authorization.js';

export const hostedProjectStatuses = [
  'planned', 'in_progress', 'paused', 'completed', 'canceled',
] as const;
export type HostedProjectStatus = (typeof hostedProjectStatuses)[number];

export const workspaceExportMediaType =
  'application/vnd.basiclinear.workspace-export+json;version=1' as const;

export interface HostedWorkspace {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  ownerUserId: string;
  authority: 'firebase-hosted';
  createdAt: string;
  revision: number;
}

export interface HostedProject {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  summary: string;
  status: HostedProjectStatus;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedMilestone {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface ExportedMembership {
  id: string;
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string | null;
  removedAt: string | null;
  revision: number;
}

export interface WorkspaceExportData extends WorkspaceExportConfiguration {
  schemaVersion: 'basiclinear.workspace-export.v1';
  workspace: HostedWorkspace;
  memberships: ExportedMembership[];
  invitations: InvitationOwnerView[];
  projects: HostedProject[];
  milestones: HostedMilestone[];
  issues: CollaborationIssue[];
  comments: CollaborationComment[];
}

export interface WorkspaceExportEnvelope {
  mediaType: typeof workspaceExportMediaType;
  workspaceId: string;
  sha256: string;
  data: WorkspaceExportData;
}

export interface ProjectManagementServiceOptions {
  secret: string | Uint8Array;
  entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  clock?: () => Date;
  idFactory?: () => string;
}

export class ProjectManagementServiceError extends Error {
  readonly code:
    | 'INVALID_PM_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'PM_NOT_FOUND'
    | 'PM_CONFLICT'
    | 'PM_FORBIDDEN'
    | 'PM_ENTITLEMENT_REQUIRED'
    | 'PM_SERVICE_UNAVAILABLE';

  constructor(code: ProjectManagementServiceError['code'], message: string) {
    super(message);
    this.name = 'ProjectManagementServiceError';
    this.code = code;
  }
}

type PmOperation = 'project.create' | 'project.update' | 'milestone.create' | 'milestone.update';

interface PmIdempotencyRecord {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  userId: string;
  operation: PmOperation;
  entityId: string;
  requestDigest: string;
  outcomeRevision: number;
  createdAt: string;
  binding: string;
}

interface BaseCommand {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
}

interface MutationCommand extends BaseCommand {
  idempotencyKey: string;
}

const workspaceKeys = [
  'schemaVersion', 'id', 'workspaceId', 'name', 'ownerUid', 'authority', 'createdAt', 'revision',
] as const;
const projectKeys = [
  'schemaVersion', 'id', 'workspaceId', 'name', 'summary', 'status', 'createdByUserId',
  'archivedAt', 'createdAt', 'updatedAt', 'revision',
] as const;
const milestoneKeys = [
  'schemaVersion', 'id', 'workspaceId', 'projectId', 'name', 'description', 'targetDate',
  'createdByUserId', 'archivedAt', 'createdAt', 'updatedAt', 'revision',
] as const;
const idempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'userId', 'operation', 'entityId', 'requestDigest',
  'outcomeRevision', 'createdAt', 'binding',
] as const;

const paths = {
  workspace: (workspaceId: string) => `workspaces/${workspaceId}`,
  membership: (workspaceId: string, userId: string) => `workspaces/${workspaceId}/memberships/${userId}`,
  memberships: (workspaceId: string) => `workspaces/${workspaceId}/memberships`,
  invitations: (workspaceId: string) => `workspaces/${workspaceId}/invitations`,
  project: (workspaceId: string, projectId: string) => `workspaces/${workspaceId}/projects/${projectId}`,
  projects: (workspaceId: string) => `workspaces/${workspaceId}/projects`,
  milestone: (workspaceId: string, milestoneId: string) => `workspaces/${workspaceId}/milestones/${milestoneId}`,
  milestones: (workspaceId: string) => `workspaces/${workspaceId}/milestones`,
  issues: (workspaceId: string) => `workspaces/${workspaceId}/issues`,
  comments: (workspaceId: string, issueId: string) => `workspaces/${workspaceId}/issues/${issueId}/comments`,
  idempotency: (workspaceId: string, id: string) => `workspaces/${workspaceId}/pmIdempotency/${id}`,
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

function safeReference(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function workspaceId(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(normalized)) throw invalid();
  return normalized;
}

function requestId(value: string): string {
  const normalized = value.trim();
  if (!safeReference(normalized)) throw invalid();
  return normalized;
}

function projectId(value: string): string {
  const normalized = value.trim();
  if (!/^project_[a-f0-9]{32}$/u.test(normalized)) throw invalid();
  return normalized;
}

function milestoneId(value: string): string {
  const normalized = value.trim();
  if (!/^milestone_[a-f0-9]{32}$/u.test(normalized)) throw invalid();
  return normalized;
}

function name(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || normalized.length > 80 || controlCharacters(normalized)) throw invalid();
  return normalized;
}

function text(value: string, maximum: number): string {
  const normalized = value.trim().replace(/\r\n?/gu, '\n');
  if (normalized.length > maximum || controlCharacters(normalized)) throw invalid();
  return normalized;
}

function controlCharacters(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value);
}

function targetDate(value: string | null): string | null {
  if (value === null) return null;
  if (!storedTargetDate(value)) throw invalid();
  return value;
}

function storedTargetDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function positiveRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw invalid();
  return value;
}

function opaquePart(value: string): string {
  const part = value.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(part)) throw new Error('The PM id factory returned an invalid value.');
  return part;
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

function invalid(): ProjectManagementServiceError {
  return new ProjectManagementServiceError('INVALID_PM_REQUEST', 'The product-management request is invalid.');
}

function notFound(): ProjectManagementServiceError {
  return new ProjectManagementServiceError('PM_NOT_FOUND', 'The requested product-management resource was not found.');
}

function conflict(): ProjectManagementServiceError {
  return new ProjectManagementServiceError('PM_CONFLICT', 'The product-management resource changed. Refresh and retry.');
}

function unavailable(): ProjectManagementServiceError {
  return new ProjectManagementServiceError('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.');
}

function trustedWorkspace(value: unknown, expectedWorkspaceId: string): HostedWorkspace {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, workspaceKeys) || candidate.schemaVersion !== 1
    || candidate.id !== expectedWorkspaceId || candidate.workspaceId !== expectedWorkspaceId
    || typeof candidate.name !== 'string' || candidate.name !== candidate.name.trim()
    || candidate.name.length < 1 || candidate.name.length > 160 || controlCharacters(candidate.name)
    || !safeReference(candidate.ownerUid) || candidate.authority !== 'firebase-hosted'
    || !canonicalTimestamp(candidate.createdAt) || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) throw unavailable();
  return {
    schemaVersion: 1,
    id: expectedWorkspaceId,
    workspaceId: expectedWorkspaceId,
    name: candidate.name,
    ownerUserId: candidate.ownerUid,
    authority: 'firebase-hosted',
    createdAt: candidate.createdAt,
    revision: candidate.revision as number,
  };
}

export function trustedHostedProject(
  value: unknown,
  expectedWorkspaceId: string,
  expectedId?: string,
): HostedProject {
  if (value === null) throw notFound();
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, projectKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^project_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || candidate.workspaceId !== expectedWorkspaceId || typeof candidate.name !== 'string'
    || candidate.name !== candidate.name.trim() || candidate.name.length < 1 || candidate.name.length > 80
    || controlCharacters(candidate.name) || typeof candidate.summary !== 'string'
    || candidate.summary !== candidate.summary.trim() || candidate.summary.length > 280
    || controlCharacters(candidate.summary)
    || !hostedProjectStatuses.includes(candidate.status as HostedProjectStatus)
    || !safeReference(candidate.createdByUserId) || candidate.archivedAt !== null
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone(candidate as unknown as HostedProject);
}

export function trustedHostedMilestone(
  value: unknown,
  expectedWorkspaceId: string,
  expectedId?: string,
): HostedMilestone {
  if (value === null) throw notFound();
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, milestoneKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^milestone_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || candidate.workspaceId !== expectedWorkspaceId || typeof candidate.projectId !== 'string'
    || !/^project_[a-f0-9]{32}$/u.test(candidate.projectId)
    || typeof candidate.name !== 'string' || candidate.name !== candidate.name.trim()
    || candidate.name.length < 1 || candidate.name.length > 80 || controlCharacters(candidate.name)
    || typeof candidate.description !== 'string' || candidate.description !== candidate.description.trim()
    || candidate.description.length > 4_000 || controlCharacters(candidate.description)
    || (candidate.targetDate !== null && !storedTargetDate(candidate.targetDate))
    || !safeReference(candidate.createdByUserId) || candidate.archivedAt !== null
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone(candidate as unknown as HostedMilestone);
}

function assertProjectAtOrBefore(value: HostedProject, now: string): HostedProject {
  if (Date.parse(value.createdAt) > Date.parse(now) || Date.parse(value.updatedAt) > Date.parse(now)) {
    throw unavailable();
  }
  return value;
}

function assertMilestoneAtOrBefore(value: HostedMilestone, now: string): HostedMilestone {
  if (Date.parse(value.createdAt) > Date.parse(now) || Date.parse(value.updatedAt) > Date.parse(now)) {
    throw unavailable();
  }
  return value;
}

function trustedMembership(value: unknown, expectedWorkspaceId: string): ExportedMembership {
  const candidate = record(value);
  const base = ['schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt', 'revision'];
  const expanded = [...base, 'updatedAt', 'removedAt'];
  if (candidate === null || (!exactKeys(candidate, base) && !exactKeys(candidate, expanded))
    || candidate.schemaVersion !== 1 || !safeReference(candidate.id)
    || candidate.workspaceId !== expectedWorkspaceId || !safeReference(candidate.userId)
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
  if (candidate.status === 'removed' && (updatedAt === null || removedAt !== updatedAt)) throw unavailable();
  return {
    id: candidate.id,
    userId: candidate.userId,
    role: candidate.role,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt,
    removedAt,
    revision: candidate.revision as number,
  };
}

function auditChange(field: string, before: unknown, after: unknown) {
  return {
    field,
    beforeSha256: before === undefined ? null : sha256(stable(before)),
    afterSha256: after === undefined ? null : sha256(stable(after)),
  };
}

function actor(principal: WorkspacePrincipal): HostedMutationAuditRecord['actor'] {
  return principal.kind === 'user'
    ? {kind: 'user', id: `user:${principal.userId}`}
    : {kind: 'personal_token', id: `patref:${principal.tokenReference}`};
}

export class ProjectManagementService {
  readonly #repository: CollaborationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: string | Uint8Array;
  readonly #entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(
    repository: CollaborationRepository,
    authorization: WorkspaceAuthorizationService,
    options: ProjectManagementServiceOptions,
  ) {
    const secretLength = typeof options.secret === 'string'
      ? Buffer.byteLength(options.secret, 'utf8')
      : options.secret.byteLength;
    if (secretLength < 32 || secretLength > 512) throw new Error('PM secret must contain 32 to 512 bytes.');
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = options.secret;
    this.#entitlementPolicy = options.entitlementPolicy;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async getWorkspace(command: BaseCommand): Promise<HostedWorkspace> {
    const context = await this.#readContext(command, 'workspace.read', 'workspace', command.workspaceId);
    try {
      const now = this.#trustedNow();
      return await this.#repository.runTransaction(async (transaction) => {
        const workspace = trustedWorkspace(
          await transaction.get(paths.workspace(context.workspaceId)),
          context.workspaceId,
        );
        if (Date.parse(workspace.createdAt) > Date.parse(now)) throw unavailable();
        return workspace;
      });
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async listProjects(command: BaseCommand): Promise<HostedProject[]> {
    const context = await this.#readContext(command, 'project.read', 'project', 'collection');
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction((transaction) => (
        transaction.list(
          paths.projects(context.workspaceId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )
      ));
      return values.map((value) => assertProjectAtOrBefore(
        trustedHostedProject(value, context.workspaceId),
        now,
      ))
        .sort((left, right) => left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async getProject(command: BaseCommand & {projectId: string}): Promise<HostedProject> {
    const id = projectId(command.projectId);
    const context = await this.#readContext(command, 'project.read', 'project', id);
    try {
      const now = this.#trustedNow();
      return await this.#repository.runTransaction(async (transaction) => assertProjectAtOrBefore(
        trustedHostedProject(
          await transaction.get(paths.project(context.workspaceId, id)),
          context.workspaceId,
          id,
        ),
        now,
      ));
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async createProject(command: MutationCommand & {
    name: string;
    summary?: string;
    status?: HostedProjectStatus;
  }): Promise<HostedProject> {
    const normalized = {
      name: name(command.name),
      summary: text(command.summary ?? '', 280),
      status: command.status ?? 'planned',
    };
    if (!hostedProjectStatuses.includes(normalized.status)) throw invalid();
    const context = await this.#mutationContext(command, 'project.write', 'project', 'new');
    const digest = hmac(this.#secret, stable(normalized));
    return this.#mutate(context, 'project.create', digest, null, async (transaction, grant, now, replay) => {
      if (replay !== null) return {
        value: trustedHostedProject(
          await transaction.get(paths.project(context.workspaceId, replay.entityId)),
          context.workspaceId,
          replay.entityId,
        ),
        changes: [],
      };
      const id = `project_${opaquePart(this.#idFactory())}`;
      const project: HostedProject = {
        schemaVersion: 1,
        id,
        workspaceId: context.workspaceId,
        ...normalized,
        createdByUserId: grant.userId,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      transaction.create(paths.project(context.workspaceId, id), {...project});
      return {
        value: project,
        changes: [
          auditChange('name', undefined, project.name),
          auditChange('summary', undefined, project.summary),
          auditChange('status', undefined, project.status),
        ],
      };
    });
  }

  async updateProject(command: MutationCommand & {
    projectId: string;
    expectedRevision: number;
    patch: {name?: string; summary?: string; status?: HostedProjectStatus};
  }): Promise<HostedProject> {
    const id = projectId(command.projectId);
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length === 0 || keys.some((key) => !['name', 'summary', 'status'].includes(key))) throw invalid();
    const patch: {name?: string; summary?: string; status?: HostedProjectStatus} = {};
    if (command.patch.name !== undefined) patch.name = name(command.patch.name);
    if (command.patch.summary !== undefined) patch.summary = text(command.patch.summary, 280);
    if (command.patch.status !== undefined) {
      if (!hostedProjectStatuses.includes(command.patch.status)) throw invalid();
      patch.status = command.patch.status;
    }
    const context = await this.#mutationContext(command, 'project.write', 'project', id);
    const digest = hmac(this.#secret, stable({id, expectedRevision, patch}));
    return this.#mutate(context, 'project.update', digest, id, async (transaction, _grant, now, replay) => {
      const before = trustedHostedProject(
        await transaction.get(paths.project(context.workspaceId, id)),
        context.workspaceId,
        id,
      );
      if (replay !== null) return {value: before, changes: []};
      if (Date.parse(before.updatedAt) > Date.parse(now)) throw unavailable();
      if (before.revision !== expectedRevision) throw conflict();
      const after: HostedProject = {...before, ...patch, updatedAt: now, revision: before.revision + 1};
      const changes = (['name', 'summary', 'status'] as const).filter((field) => before[field] !== after[field]);
      if (changes.length === 0) throw conflict();
      transaction.set(paths.project(context.workspaceId, id), {...after});
      return {
        value: after,
        changes: changes.map((field) => auditChange(field, before[field], after[field])),
      };
    });
  }

  async listMilestones(command: BaseCommand & {projectId?: string}): Promise<HostedMilestone[]> {
    const projectFilter = command.projectId === undefined ? null : projectId(command.projectId);
    const context = await this.#readContext(
      command,
      'milestone.read',
      'milestone',
      projectFilter ?? 'collection',
    );
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction((transaction) => (
        transaction.list(
          paths.milestones(context.workspaceId),
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        )
      ));
      return values.map((value) => assertMilestoneAtOrBefore(
        trustedHostedMilestone(value, context.workspaceId),
        now,
      ))
        .filter((value) => projectFilter === null || value.projectId === projectFilter)
        .sort((left, right) => left.id.localeCompare(right.id));
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async getMilestone(command: BaseCommand & {milestoneId: string}): Promise<HostedMilestone> {
    const id = milestoneId(command.milestoneId);
    const context = await this.#readContext(command, 'milestone.read', 'milestone', id);
    try {
      const now = this.#trustedNow();
      return await this.#repository.runTransaction(async (transaction) => assertMilestoneAtOrBefore(
        trustedHostedMilestone(
          await transaction.get(paths.milestone(context.workspaceId, id)),
          context.workspaceId,
          id,
        ),
        now,
      ));
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async createMilestone(command: MutationCommand & {
    projectId: string;
    name: string;
    description?: string;
    targetDate?: string | null;
  }): Promise<HostedMilestone> {
    const parentId = projectId(command.projectId);
    const normalized = {
      name: name(command.name),
      description: text(command.description ?? '', 4_000),
      targetDate: targetDate(command.targetDate ?? null),
    };
    const context = await this.#mutationContext(command, 'milestone.write', 'project', parentId);
    const digest = hmac(this.#secret, stable({parentId, ...normalized}));
    return this.#mutate(context, 'milestone.create', digest, null, async (transaction, grant, now, replay) => {
      if (replay !== null) return {
        value: trustedHostedMilestone(
          await transaction.get(paths.milestone(context.workspaceId, replay.entityId)),
          context.workspaceId,
          replay.entityId,
        ),
        changes: [],
      };
      const parent = trustedHostedProject(
        await transaction.get(paths.project(context.workspaceId, parentId)),
        context.workspaceId,
        parentId,
      );
      if (Date.parse(parent.updatedAt) > Date.parse(now)) throw unavailable();
      const id = `milestone_${opaquePart(this.#idFactory())}`;
      const milestone: HostedMilestone = {
        schemaVersion: 1,
        id,
        workspaceId: context.workspaceId,
        projectId: parentId,
        ...normalized,
        createdByUserId: grant.userId,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      transaction.create(paths.milestone(context.workspaceId, id), {...milestone});
      return {
        value: milestone,
        changes: [
          auditChange('projectId', undefined, milestone.projectId),
          auditChange('name', undefined, milestone.name),
          auditChange('description', undefined, milestone.description),
          auditChange('targetDate', undefined, milestone.targetDate),
        ],
      };
    });
  }

  async updateMilestone(command: MutationCommand & {
    milestoneId: string;
    expectedRevision: number;
    patch: {name?: string; description?: string; targetDate?: string | null};
  }): Promise<HostedMilestone> {
    const id = milestoneId(command.milestoneId);
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length === 0 || keys.some((key) => !['name', 'description', 'targetDate'].includes(key))) throw invalid();
    const patch: {name?: string; description?: string; targetDate?: string | null} = {};
    if (command.patch.name !== undefined) patch.name = name(command.patch.name);
    if (command.patch.description !== undefined) patch.description = text(command.patch.description, 4_000);
    if (command.patch.targetDate !== undefined) patch.targetDate = targetDate(command.patch.targetDate);
    const context = await this.#mutationContext(command, 'milestone.write', 'milestone', id);
    const digest = hmac(this.#secret, stable({id, expectedRevision, patch}));
    return this.#mutate(context, 'milestone.update', digest, id, async (transaction, _grant, now, replay) => {
      const before = trustedHostedMilestone(
        await transaction.get(paths.milestone(context.workspaceId, id)),
        context.workspaceId,
        id,
      );
      if (replay !== null) return {value: before, changes: []};
      if (Date.parse(before.updatedAt) > Date.parse(now)) throw unavailable();
      if (before.revision !== expectedRevision) throw conflict();
      const after: HostedMilestone = {...before, ...patch, updatedAt: now, revision: before.revision + 1};
      const changes = (['name', 'description', 'targetDate'] as const)
        .filter((field) => before[field] !== after[field]);
      if (changes.length === 0) throw conflict();
      transaction.set(paths.milestone(context.workspaceId, id), {...after});
      return {
        value: after,
        changes: changes.map((field) => auditChange(field, before[field], after[field])),
      };
    });
  }

  async exportWorkspace(command: BaseCommand): Promise<WorkspaceExportEnvelope> {
    const context = await this.#readContext(command, 'workspace.export', 'workspace', command.workspaceId);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        const workspace = trustedWorkspace(
          await transaction.get(paths.workspace(context.workspaceId)),
          context.workspaceId,
        );
        if (Date.parse(workspace.createdAt) > Date.parse(now)) throw unavailable();
        const actorMembership = trustedMembership(
          await transaction.get(paths.membership(context.workspaceId, command.principal.userId)),
          context.workspaceId,
        );
        if (actorMembership.userId !== workspace.ownerUserId || actorMembership.role !== 'owner'
          || actorMembership.status !== 'active' || Date.parse(actorMembership.createdAt) > Date.parse(now)) {
          throw new ProjectManagementServiceError('PM_FORBIDDEN', 'Workspace export is unavailable.');
        }
        const [rawMemberships, rawInvitations, rawProjects, rawMilestones] = await Promise.all([
          transaction.list(
            paths.memberships(context.workspaceId),
            hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
          ),
          transaction.list(
            paths.invitations(context.workspaceId),
            hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
          ),
          transaction.list(
            paths.projects(context.workspaceId),
            hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
          ),
          transaction.list(
            paths.milestones(context.workspaceId),
            hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
          ),
        ]);
        const memberships = rawMemberships.map((value) => trustedMembership(value, context.workspaceId))
          .sort((left, right) => left.userId.localeCompare(right.userId));
        if (memberships.some((value) => Date.parse(value.createdAt) > Date.parse(now)
          || (value.updatedAt !== null && Date.parse(value.updatedAt) > Date.parse(now))
          || (value.removedAt !== null && Date.parse(value.removedAt) > Date.parse(now)))) throw unavailable();
        if (memberships.filter((value) => value.role === 'owner' && value.status === 'active').length !== 1) {
          throw unavailable();
        }
        const membershipIds = new Set(memberships.map((value) => value.userId));
        if (membershipIds.size !== memberships.length
          || !membershipIds.has(workspace.ownerUserId)
          || memberships.some((value) => value.role === 'owner' && value.status === 'active'
            && value.userId !== workspace.ownerUserId)) throw unavailable();
        const invitations = rawInvitations
          .map((value) => trustedInvitationOwnerView(value, context.workspaceId, now))
          .sort((left, right) => left.id.localeCompare(right.id));
        const projects = rawProjects.map((value) => assertProjectAtOrBefore(
          trustedHostedProject(value, context.workspaceId),
          now,
        ))
          .sort((left, right) => left.id.localeCompare(right.id));
        if (projects.some((value) => !membershipIds.has(value.createdByUserId))) throw unavailable();
        const projectIds = new Set(projects.map((value) => value.id));
        const milestones = rawMilestones.map((value) => assertMilestoneAtOrBefore(
          trustedHostedMilestone(value, context.workspaceId),
          now,
        ))
          .sort((left, right) => left.id.localeCompare(right.id));
        if (milestones.some((value) => !projectIds.has(value.projectId)
          || !membershipIds.has(value.createdByUserId))) throw unavailable();
        const milestoneProjects = new Map(milestones.map((value) => [value.id, value.projectId]));
        const issues = (await readTrustedCollaborationIssues(transaction, context.workspaceId, now))
          .sort((left, right) => left.id.localeCompare(right.id));
        if (issues.some((value) => Date.parse(value.createdAt) > Date.parse(now)
          || Date.parse(value.updatedAt) > Date.parse(now))) throw unavailable();
        if (issues.some((value) => (value.projectId !== null && !projectIds.has(value.projectId))
          || (value.milestoneId !== null && milestoneProjects.get(value.milestoneId) !== value.projectId)
          || !membershipIds.has(value.createdByUserId)
          || (value.assigneeUserId !== null && !membershipIds.has(value.assigneeUserId)))) {
          throw unavailable();
        }
        if (issues.length > hostedOperationsPolicyV1.queries.maximumExportIssueQueries) {
          throw unavailable();
        }
        const configuration = await readWorkspaceExportConfiguration(
          transaction, workspace, now, membershipIds, issues, invitations,
        );
        let exportRecordCount = 1 + memberships.length + invitations.length
          + projects.length + milestones.length + issues.length
          + Object.values(configuration).reduce((total, values) => total + values.length, 0);
        if (exportRecordCount > hostedOperationsPolicyV1.queries.maximumExportRecords) {
          throw unavailable();
        }
        const comments: CollaborationComment[] = [];
        for (const issue of issues) {
          const remaining = hostedOperationsPolicyV1.queries.maximumExportRecords
            - exportRecordCount;
          const queryMaximum = Math.max(1, Math.min(
            hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
            remaining + 1,
          ));
          const group = (await transaction.list(
            paths.comments(context.workspaceId, issue.id),
            queryMaximum,
          )).map((value) => trustedCollaborationCommentRecord(
            value,
            context.workspaceId,
            issue.id,
          ));
          if (group.length > remaining) throw unavailable();
          comments.push(...group);
          exportRecordCount += group.length;
        }
        comments.sort((left, right) => left.id.localeCompare(right.id));
        if (comments.some((value) => Date.parse(value.createdAt) > Date.parse(now)
          || Date.parse(value.updatedAt) > Date.parse(now)
          || (value.deletedAt !== null && Date.parse(value.deletedAt) > Date.parse(now))
          || !membershipIds.has(value.authorUserId))) throw unavailable();
        const data: WorkspaceExportData = {
          schemaVersion: 'basiclinear.workspace-export.v1',
          workspace,
          memberships,
          invitations,
          projects,
          milestones,
          issues,
          comments,
          ...configuration,
        };
        return {
          mediaType: workspaceExportMediaType,
          workspaceId: context.workspaceId,
          sha256: sha256(stable(data)),
          data,
        };
      });
    } catch (error) {
      if (error instanceof ProjectManagementServiceError) throw error;
      throw unavailable();
    }
  }

  async #readContext(
    command: BaseCommand,
    action: 'workspace.read' | 'project.read' | 'milestone.read' | 'workspace.export',
    targetEntityType: string,
    targetEntityId: string,
  ): Promise<{workspaceId: string; requestId: string}> {
    const normalizedWorkspaceId = workspaceId(command.workspaceId);
    const normalizedRequestId = requestId(command.requestId);
    await this.#authorization.authorize({
      principal: command.principal,
      workspaceId: normalizedWorkspaceId,
      action,
      targetEntityType,
      targetEntityId,
      requestId: normalizedRequestId,
    });
    return {workspaceId: normalizedWorkspaceId, requestId: normalizedRequestId};
  }

  async #mutationContext(
    command: MutationCommand,
    action: 'project.write' | 'milestone.write',
    targetEntityType: string,
    targetEntityId: string,
  ): Promise<{
      principal: WorkspacePrincipal;
      workspaceId: string;
      requestId: string;
      idempotencyKey: string;
      grant: WorkspaceAuthorizationGrant;
    }> {
    const normalizedWorkspaceId = workspaceId(command.workspaceId);
    const normalizedRequestId = requestId(command.requestId);
    const key = command.idempotencyKey.trim();
    if (key.length < 16 || key.length > 160 || /\s/u.test(key)) {
      throw new ProjectManagementServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
    }
    const grant = await this.#authorization.authorize({
      principal: command.principal,
      workspaceId: normalizedWorkspaceId,
      action,
      targetEntityType,
      targetEntityId,
      requestId: normalizedRequestId,
    });
    return {
      principal: command.principal,
      workspaceId: normalizedWorkspaceId,
      requestId: normalizedRequestId,
      idempotencyKey: key,
      grant,
    };
  }

  async #mutate<Value extends {id: string; revision: number; updatedAt: string}>(
    context: {
      principal: WorkspacePrincipal;
      workspaceId: string;
      requestId: string;
      idempotencyKey: string;
      grant: WorkspaceAuthorizationGrant;
    },
    operation: PmOperation,
    requestDigest: string,
    fixedEntityId: string | null,
    body: (
      transaction: CollaborationTransaction,
      grant: WorkspaceAuthorizationGrant,
      now: string,
      replay: PmIdempotencyRecord | null,
    ) => Promise<{value: Value; changes: ReturnType<typeof auditChange>[]}>,
  ): Promise<Value> {
    const id = sha256(`${context.grant.userId}:${operation}:${context.idempotencyKey}`);
    const path = paths.idempotency(context.workspaceId, id);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        const rawIdempotency = await transaction.get(path);
        let replay: PmIdempotencyRecord | null = null;
        if (rawIdempotency !== null) {
          replay = this.#idempotencyRecord(rawIdempotency, id, context, operation, requestDigest, now);
        }
        const membership = trustedMembership(
          await transaction.get(paths.membership(context.workspaceId, context.grant.userId)),
          context.workspaceId,
        );
        if (membership.userId !== context.grant.userId || membership.status !== 'active'
          || membership.role !== context.grant.role || Date.parse(membership.createdAt) > Date.parse(now)
          || (membership.updatedAt !== null && Date.parse(membership.updatedAt) > Date.parse(now))) {
          throw new ProjectManagementServiceError('PM_FORBIDDEN', 'The product-management resource is unavailable.');
        }
        if (replay === null) {
          try {
            await this.#entitlementPolicy.assertMutation({
              transaction,
              workspaceId: context.workspaceId,
              principal: context.principal,
              grant: context.grant,
              operation,
              now,
            });
          } catch (error) {
            if (error instanceof BillingServiceError && error.code === 'BILLING_FORBIDDEN') {
              throw new ProjectManagementServiceError(
                'PM_ENTITLEMENT_REQUIRED',
                'This workspace is on Free. Subscribe to continue this automation write.',
              );
            }
            throw unavailable();
          }
        }
        const outcome = await body(transaction, context.grant, now, replay);
        const value = outcome.value;
        if (replay !== null) {
          if (value.id !== replay.entityId || value.revision !== replay.outcomeRevision
            || value.updatedAt !== replay.createdAt) throw conflict();
          return value;
        }
        if (fixedEntityId !== null && value.id !== fixedEntityId) throw unavailable();
        const unsigned: Omit<PmIdempotencyRecord, 'binding'> = {
          schemaVersion: 1,
          id,
          workspaceId: context.workspaceId,
          userId: context.grant.userId,
          operation,
          entityId: value.id,
          requestDigest,
          outcomeRevision: value.revision,
          createdAt: value.updatedAt,
        };
        transaction.create(path, {...unsigned, binding: hmac(this.#secret, stable(unsigned))});
        const audit = this.#audit(
          context,
          operation,
          value.id,
          value.revision === 1 ? null : value.revision - 1,
          value.revision,
          value.updatedAt,
          outcome.changes,
        );
        transaction.create(paths.audit(context.workspaceId, audit.id), {...audit});
        return value;
      });
    } catch (error) {
      if (error instanceof ProjectManagementServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  #idempotencyRecord(
    value: unknown,
    id: string,
    context: {workspaceId: string; grant: WorkspaceAuthorizationGrant},
    operation: PmOperation,
    requestDigest: string,
    now: string,
  ): PmIdempotencyRecord {
    const candidate = record(value);
    if (candidate === null || !exactKeys(candidate, idempotencyKeys) || candidate.schemaVersion !== 1
      || candidate.id !== id || candidate.workspaceId !== context.workspaceId
      || candidate.userId !== context.grant.userId || candidate.operation !== operation
      || (typeof candidate.entityId !== 'string'
        || !/^(?:project|milestone)_[a-f0-9]{32}$/u.test(candidate.entityId))
      || candidate.requestDigest !== requestDigest || !/^[a-f0-9]{64}$/u.test(requestDigest)
      || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 1
      || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)) {
      throw conflict();
    }
    const unsigned: Omit<PmIdempotencyRecord, 'binding'> = {
      schemaVersion: 1,
      id,
      workspaceId: context.workspaceId,
      userId: context.grant.userId,
      operation,
      entityId: candidate.entityId,
      requestDigest,
      outcomeRevision: candidate.outcomeRevision as number,
      createdAt: candidate.createdAt,
    };
    const expectedBinding = hmac(this.#secret, stable(unsigned));
    if (!equalDigest(candidate.binding, expectedBinding)) throw unavailable();
    return {...unsigned, binding: expectedBinding};
  }

  #audit(
    context: {principal: WorkspacePrincipal; workspaceId: string; requestId: string},
    action: PmOperation,
    entityId: string,
    revisionBefore: number | null,
    revisionAfter: number,
    now: string,
    changes: ReturnType<typeof auditChange>[],
  ): HostedMutationAuditRecord {
    const entityType = action.startsWith('project.') ? 'project' : 'milestone';
    const value: HostedMutationAuditRecord = {
      schemaVersion: hostedMeasurementSchemaVersion,
      id: `audit:pm:${opaquePart(this.#idFactory())}`,
      workspaceId: context.workspaceId,
      actor: actor(context.principal),
      source: context.principal.source,
      occurredAt: now,
      requestId: context.requestId,
      entity: {type: entityType, id: entityId, revisionBefore, revisionAfter},
      action,
      result: 'succeeded',
      changes: [auditChange('revision', revisionBefore, revisionAfter), ...changes],
    };
    assertHostedMutationAuditRecord(value);
    return value;
  }

  #trustedNow(): string {
    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw unavailable();
    return now.toISOString();
  }
}
