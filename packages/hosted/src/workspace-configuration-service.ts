import {createHash, createHmac, randomUUID, timingSafeEqual} from 'node:crypto';
import {
  BillingServiceError,
  type EntitledMutationOperation,
  type WorkspaceMutationEntitlementPolicy,
} from './billing-service.js';
import type {CollaborationRepository, CollaborationTransaction} from './collaboration-service.js';
import {hostedOperationsPolicyV1} from './operations-control.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationGrant,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
} from './workspace-authorization.js';

export const hostedWorkflowStatusCategories = [
  'backlog', 'unstarted', 'started', 'completed', 'canceled',
] as const;
export type HostedWorkflowStatusCategory = (typeof hostedWorkflowStatusCategories)[number];

export const hostedWorkflowStatusIcons = [
  'circle', 'circle-dashed', 'circle-dot', 'circle-check', 'circle-x',
] as const;
export type HostedWorkflowStatusIcon = (typeof hostedWorkflowStatusIcons)[number];

export const hostedCycleStates = ['planned', 'current', 'completed'] as const;
export type HostedCycleState = (typeof hostedCycleStates)[number];

export const hostedSavedViewTypes = ['issues', 'projects'] as const;
export type HostedSavedViewType = (typeof hostedSavedViewTypes)[number];

export const hostedSavedViewPredicates = [
  'all', 'active', 'backlog', 'my_open', 'unassigned', 'high_priority', 'completed',
] as const;
export type HostedSavedViewPredicate = (typeof hostedSavedViewPredicates)[number];

export interface HostedTeam {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  color: string;
  description: string;
  createdByUserId: string;
  archivedAt: null;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedTeamMembership {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'member';
  status: 'active' | 'left';
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedWorkflowStatus {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  category: HostedWorkflowStatusCategory;
  color: string;
  icon: HostedWorkflowStatusIcon;
  position: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedCycle {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  number: number;
  name: string;
  startDate: string;
  endDate: string;
  state: HostedCycleState;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface HostedSavedView {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  viewType: HostedSavedViewType;
  predicate: HostedSavedViewPredicate;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
}

type EntitledConfigurationOperation = Extract<EntitledMutationOperation,
  | 'team.create'
  | 'team.update'
  | 'workflow_status.create'
  | 'workflow_status.update'
  | 'cycle.create'
  | 'cycle.update'
  | 'saved_view.create'
  | 'saved_view.update'
>;
type ConfigurationOperation = EntitledConfigurationOperation
  | 'team_membership.join'
  | 'team_membership.leave';

interface ConfigurationIdempotency {
  schemaVersion: 1;
  id: string;
  workspaceId: string;
  userId: string;
  operation: ConfigurationOperation;
  entityId: string;
  requestDigest: string;
  outcomeRevision: number;
  createdAt: string;
  binding: string;
}

interface ReadCommand {
  principal: WorkspacePrincipal;
  workspaceId: string;
  requestId: string;
}

interface MutationCommand extends ReadCommand {
  idempotencyKey: string;
}

interface MutationContext extends MutationCommand {
  grant: WorkspaceAuthorizationGrant;
}

export interface WorkspaceConfigurationServiceOptions {
  secret: string | Uint8Array;
  entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  clock?: () => Date;
  idFactory?: () => string;
}

export class WorkspaceConfigurationServiceError extends Error {
  readonly code:
    | 'INVALID_CONFIGURATION_REQUEST'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'CONFIGURATION_NOT_FOUND'
    | 'CONFIGURATION_CONFLICT'
    | 'CONFIGURATION_FORBIDDEN'
    | 'CONFIGURATION_ENTITLEMENT_REQUIRED'
    | 'CONFIGURATION_SERVICE_UNAVAILABLE';

  constructor(code: WorkspaceConfigurationServiceError['code'], message: string) {
    super(message);
    this.name = 'WorkspaceConfigurationServiceError';
    this.code = code;
  }
}

const teamKeys = [
  'schemaVersion', 'id', 'workspaceId', 'name', 'key', 'color', 'description',
  'createdByUserId', 'archivedAt', 'createdAt', 'updatedAt', 'revision',
] as const;
const legacyTeamMembershipKeys = [
  'schemaVersion', 'id', 'workspaceId', 'teamId', 'userId', 'role',
  'createdAt', 'updatedAt', 'revision',
] as const;
const teamMembershipKeys = [...legacyTeamMembershipKeys, 'status'] as const;
const legacyStatusKeys = [
  'schemaVersion', 'id', 'workspaceId', 'teamId', 'name', 'category', 'color',
  'position', 'isDefault', 'createdAt', 'updatedAt', 'revision',
] as const;
const statusKeys = [...legacyStatusKeys, 'icon'] as const;
const cycleKeys = [
  'schemaVersion', 'id', 'workspaceId', 'teamId', 'number', 'name', 'startDate',
  'endDate', 'state', 'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const viewKeys = [
  'schemaVersion', 'id', 'workspaceId', 'teamId', 'name', 'viewType', 'predicate',
  'createdByUserId', 'createdAt', 'updatedAt', 'revision',
] as const;
const idempotencyKeys = [
  'schemaVersion', 'id', 'workspaceId', 'userId', 'operation', 'entityId',
  'requestDigest', 'outcomeRevision', 'createdAt', 'binding',
] as const;

const paths = {
  membership: (workspaceId: string, userId: string) => `workspaces/${workspaceId}/memberships/${userId}`,
  team: (workspaceId: string, teamId: string) => `workspaces/${workspaceId}/teams/${teamId}`,
  teams: (workspaceId: string) => `workspaces/${workspaceId}/teams`,
  teamMembership: (workspaceId: string, teamId: string, userId: string) => (
    `workspaces/${workspaceId}/teamMemberships/${teamId}--${userId}`
  ),
  teamMemberships: (workspaceId: string) => `workspaces/${workspaceId}/teamMemberships`,
  status: (workspaceId: string, statusId: string) => `workspaces/${workspaceId}/workflowStatuses/${statusId}`,
  statuses: (workspaceId: string) => `workspaces/${workspaceId}/workflowStatuses`,
  cycle: (workspaceId: string, cycleId: string) => `workspaces/${workspaceId}/cycles/${cycleId}`,
  cycles: (workspaceId: string) => `workspaces/${workspaceId}/cycles`,
  view: (workspaceId: string, viewId: string) => `workspaces/${workspaceId}/savedViews/${viewId}`,
  views: (workspaceId: string) => `workspaces/${workspaceId}/savedViews`,
  idempotency: (workspaceId: string, id: string) => `workspaces/${workspaceId}/configurationIdempotency/${id}`,
};

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
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function canonicalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
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

function safeEntityId(value: string, prefix: 'team' | 'status' | 'cycle' | 'view'): string {
  const normalized = value.trim();
  if (!new RegExp(`^${prefix}_[a-f0-9]{32}$`, 'u').test(normalized)) throw invalid();
  return normalized;
}

function defaultIconForCategory(category: HostedWorkflowStatusCategory): HostedWorkflowStatusIcon {
  if (category === 'backlog') return 'circle-dashed';
  if (category === 'started') return 'circle-dot';
  if (category === 'completed') return 'circle-check';
  if (category === 'canceled') return 'circle-x';
  return 'circle';
}

function safeStatusIcon(value: HostedWorkflowStatusIcon): HostedWorkflowStatusIcon {
  if (!hostedWorkflowStatusIcons.includes(value)) throw invalid();
  return value;
}

function safeName(value: string, maximum = 80): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || normalized.length > maximum || /[\u0000-\u001F\u007F]/u.test(normalized)) throw invalid();
  return normalized;
}

function safeDescription(value: string | undefined): string {
  const normalized = (value ?? '').trim().replace(/\r\n?/gu, '\n');
  if (normalized.length > 500 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) throw invalid();
  return normalized;
}

function safeTeamKey(value: string): string {
  const normalized = value.trim().toLocaleUpperCase('en-US');
  if (!/^[A-Z][A-Z0-9]{0,9}$/u.test(normalized)) throw invalid();
  return normalized;
}

function safeColor(value: string): string {
  const normalized = value.trim().toLocaleUpperCase('en-US');
  if (!/^#[0-9A-F]{6}$/u.test(normalized)) throw invalid();
  return normalized;
}

function safePosition(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > 10_000) throw invalid();
  return value;
}

function positiveRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw invalid();
  return value;
}

function opaquePart(value: string): string {
  const normalized = value.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(normalized)) throw new Error('Configuration id factory returned an invalid value.');
  return normalized;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string | Uint8Array, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function equalDigest(left: string, right: string): boolean {
  return /^[a-f0-9]{64}$/u.test(left) && /^[a-f0-9]{64}$/u.test(right)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => `${JSON.stringify(key)}:${stable(candidate[key])}`).join(',')}}`;
}

export function defaultHostedTeamId(workspaceId: string): string {
  return `team_${sha256(`default-team:${safeWorkspaceId(workspaceId)}`).slice(0, 32)}`;
}

export function defaultHostedStatusId(
  workspaceId: string,
  teamId: string,
  kind: 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled',
): string {
  return `status_${sha256(`default-status:${safeWorkspaceId(workspaceId)}:${safeEntityId(teamId, 'team')}:${kind}`).slice(0, 32)}`;
}

export function trustedHostedTeamRecord(value: unknown, workspaceId: string, expectedId?: string): HostedTeam {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, teamKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId) || candidate.workspaceId !== workspaceId
    || typeof candidate.name !== 'string' || safeName(candidate.name) !== candidate.name
    || typeof candidate.key !== 'string' || safeTeamKey(candidate.key) !== candidate.key
    || typeof candidate.color !== 'string' || safeColor(candidate.color) !== candidate.color
    || typeof candidate.description !== 'string' || safeDescription(candidate.description) !== candidate.description
    || typeof candidate.createdByUserId !== 'string' || safeReference(candidate.createdByUserId) !== candidate.createdByUserId
    || candidate.archivedAt !== null || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone(candidate as unknown as HostedTeam);
}

const trustedTeam = trustedHostedTeamRecord;

export function hostedTeamMembershipId(workspaceId: string, teamId: string, userId: string): string {
  return `team_member_${sha256(`team-membership:${safeWorkspaceId(workspaceId)}:${safeEntityId(teamId, 'team')}:${safeReference(userId)}`).slice(0, 32)}`;
}

export function trustedHostedTeamMembershipRecord(
  value: unknown,
  workspaceId: string,
  expectedTeamId?: string,
  expectedUserId?: string,
): HostedTeamMembership {
  const candidate = record(value);
  const current = candidate !== null && exactKeys(candidate, teamMembershipKeys);
  const legacy = candidate !== null && exactKeys(candidate, legacyTeamMembershipKeys);
  if (candidate === null || (!current && !legacy) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^team_member_[a-f0-9]{32}$/u.test(candidate.id)
    || candidate.workspaceId !== workspaceId
    || typeof candidate.teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.teamId)
    || (expectedTeamId !== undefined && candidate.teamId !== expectedTeamId)
    || typeof candidate.userId !== 'string' || safeReference(candidate.userId) !== candidate.userId
    || (expectedUserId !== undefined && candidate.userId !== expectedUserId)
    || candidate.id !== hostedTeamMembershipId(workspaceId, candidate.teamId, candidate.userId)
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (current && candidate.status !== 'active' && candidate.status !== 'left')
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone({...candidate, status: current ? candidate.status : 'active'} as unknown as HostedTeamMembership);
}

export function trustedHostedWorkflowStatusRecord(
  value: unknown,
  workspaceId: string,
  expectedId?: string,
): HostedWorkflowStatus {
  const candidate = record(value);
  const current = candidate !== null && exactKeys(candidate, statusKeys);
  const legacy = candidate !== null && exactKeys(candidate, legacyStatusKeys);
  if (candidate === null || (!current && !legacy) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^status_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId) || candidate.workspaceId !== workspaceId
    || typeof candidate.teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.teamId)
    || typeof candidate.name !== 'string' || safeName(candidate.name, 60) !== candidate.name
    || !hostedWorkflowStatusCategories.includes(candidate.category as HostedWorkflowStatusCategory)
    || typeof candidate.color !== 'string' || safeColor(candidate.color) !== candidate.color
    || (current && !hostedWorkflowStatusIcons.includes(candidate.icon as HostedWorkflowStatusIcon))
    || !Number.isSafeInteger(candidate.position) || (candidate.position as number) < 0
    || typeof candidate.isDefault !== 'boolean' || !canonicalTimestamp(candidate.createdAt)
    || !canonicalTimestamp(candidate.updatedAt) || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone({
    ...candidate,
    icon: current
      ? candidate.icon
      : defaultIconForCategory(candidate.category as HostedWorkflowStatusCategory),
  } as unknown as HostedWorkflowStatus);
}

const trustedStatus = trustedHostedWorkflowStatusRecord;

export function trustedHostedCycleRecord(value: unknown, workspaceId: string, expectedId?: string): HostedCycle {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, cycleKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^cycle_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId) || candidate.workspaceId !== workspaceId
    || typeof candidate.teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.teamId)
    || !Number.isSafeInteger(candidate.number) || (candidate.number as number) < 1
    || typeof candidate.name !== 'string' || safeName(candidate.name, 80) !== candidate.name
    || !canonicalDate(candidate.startDate) || !canonicalDate(candidate.endDate)
    || Date.parse(`${candidate.startDate}T00:00:00.000Z`) > Date.parse(`${candidate.endDate}T00:00:00.000Z`)
    || !hostedCycleStates.includes(candidate.state as HostedCycleState)
    || typeof candidate.createdByUserId !== 'string' || safeReference(candidate.createdByUserId) !== candidate.createdByUserId
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone(candidate as unknown as HostedCycle);
}

const trustedCycle = trustedHostedCycleRecord;

export function trustedHostedSavedViewRecord(value: unknown, workspaceId: string, expectedId?: string): HostedSavedView {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, viewKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^view_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId) || candidate.workspaceId !== workspaceId
    || typeof candidate.teamId !== 'string' || !/^team_[a-f0-9]{32}$/u.test(candidate.teamId)
    || typeof candidate.name !== 'string' || safeName(candidate.name, 80) !== candidate.name
    || !hostedSavedViewTypes.includes(candidate.viewType as HostedSavedViewType)
    || !hostedSavedViewPredicates.includes(candidate.predicate as HostedSavedViewPredicate)
    || typeof candidate.createdByUserId !== 'string' || safeReference(candidate.createdByUserId) !== candidate.createdByUserId
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.updatedAt)
    || Date.parse(candidate.createdAt) > Date.parse(candidate.updatedAt)
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1) throw unavailable();
  return clone(candidate as unknown as HostedSavedView);
}

const trustedView = trustedHostedSavedViewRecord;

export function buildDefaultHostedTeamRecord(workspaceId: string, userId: string, now: string): HostedTeam {
  return {
    schemaVersion: 1,
    id: defaultHostedTeamId(workspaceId),
    workspaceId,
    name: 'Product',
    key: 'PROD',
    color: '#5E6AD2',
    description: 'Product planning, delivery, and decisions.',
    createdByUserId: userId,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  };
}

const defaultTeam = buildDefaultHostedTeamRecord;

export function buildDefaultHostedWorkflowStatusRecords(
  workspaceId: string,
  teamId: string,
  now: string,
): HostedWorkflowStatus[] {
  const values: Array<[string, HostedWorkflowStatusCategory, string, HostedWorkflowStatusIcon, number, boolean, Parameters<typeof defaultHostedStatusId>[2]]> = [
    ['Backlog', 'backlog', '#6B7280', 'circle-dashed', 0, true, 'backlog'],
    ['Todo', 'unstarted', '#A3A3A3', 'circle', 1, true, 'todo'],
    ['In Progress', 'started', '#F2C94C', 'circle-dot', 2, true, 'in_progress'],
    ['Done', 'completed', '#5E6AD2', 'circle-check', 3, true, 'done'],
    ['Canceled', 'canceled', '#6B7280', 'circle-x', 4, true, 'canceled'],
  ];
  return values.map(([name, category, color, icon, position, isDefault, kind]) => ({
    schemaVersion: 1,
    id: defaultHostedStatusId(workspaceId, teamId, kind),
    workspaceId,
    teamId,
    name,
    category,
    color,
    icon,
    position,
    isDefault,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  }));
}

const defaultStatuses = buildDefaultHostedWorkflowStatusRecords;

export class WorkspaceConfigurationService {
  readonly #repository: CollaborationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: string | Uint8Array;
  readonly #entitlementPolicy: WorkspaceMutationEntitlementPolicy;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;

  constructor(
    repository: CollaborationRepository,
    authorization: WorkspaceAuthorizationService,
    options: WorkspaceConfigurationServiceOptions,
  ) {
    const secretLength = typeof options.secret === 'string'
      ? Buffer.byteLength(options.secret, 'utf8')
      : options.secret.byteLength;
    if (secretLength < 32 || secretLength > 512) throw new Error('Configuration secret must contain 32 to 512 bytes.');
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = options.secret;
    this.#entitlementPolicy = options.entitlementPolicy;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
  }

  async ensureDefaults(command: MutationCommand): Promise<{team: HostedTeam; statuses: HostedWorkflowStatus[]}> {
    const context = await this.#context(command, 'workspace.settings.manage', 'configuration', 'defaults');
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        await this.#activeActor(transaction, context, now);
        const teamId = defaultHostedTeamId(context.workspaceId);
        const rawTeam = await transaction.get(paths.team(context.workspaceId, teamId));
        const team = rawTeam === null ? defaultTeam(context.workspaceId, context.grant.userId, now)
          : trustedTeam(rawTeam, context.workspaceId, teamId);
        const statuses = defaultStatuses(context.workspaceId, team.id, team.createdAt);
        const [rawTeamMembership, ...rawStatuses] = await Promise.all([
          transaction.get(paths.teamMembership(context.workspaceId, team.id, context.grant.userId)),
          ...statuses.map((status) => transaction.get(paths.status(context.workspaceId, status.id))),
        ]);
        if (rawTeam === null) transaction.create(paths.team(context.workspaceId, team.id), {...team});
        if (rawTeamMembership === null) {
          const teamMembership: HostedTeamMembership = {
            schemaVersion: 1,
            id: hostedTeamMembershipId(context.workspaceId, team.id, context.grant.userId),
            workspaceId: context.workspaceId,
            teamId: team.id,
            userId: context.grant.userId,
            role: context.grant.role,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            revision: 1,
          };
          transaction.create(paths.teamMembership(context.workspaceId, team.id, context.grant.userId), {...teamMembership});
        } else {
          trustedHostedTeamMembershipRecord(rawTeamMembership, context.workspaceId, team.id, context.grant.userId);
        }
        const resolved: HostedWorkflowStatus[] = [];
        statuses.forEach((status, index) => {
          const raw = rawStatuses[index] ?? null;
          if (raw === null) {
            transaction.create(paths.status(context.workspaceId, status.id), {...status});
            resolved.push(status);
          } else {
            resolved.push(trustedStatus(raw, context.workspaceId, status.id));
          }
        });
        return {team: clone(team), statuses: clone(resolved)};
      });
    } catch (error) {
      if (error instanceof WorkspaceConfigurationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async listTeams(command: ReadCommand): Promise<HostedTeam[]> {
    const context = await this.#context(command, 'workspace.read', 'team', 'collection');
    return this.#list(context, paths.teams(context.workspaceId), trustedTeam)
      .then((values) => values.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)));
  }

  async listTeamMemberships(command: ReadCommand & {teamId?: string}): Promise<HostedTeamMembership[]> {
    const teamFilter = command.teamId === undefined ? null : safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'team', teamFilter ?? 'memberships');
    return this.#list(context, paths.teamMemberships(context.workspaceId), trustedHostedTeamMembershipRecord)
      .then((values) => values.filter((membership) => membership.status === 'active'
        && (teamFilter === null || membership.teamId === teamFilter))
        .sort((left, right) => left.teamId.localeCompare(right.teamId) || left.userId.localeCompare(right.userId)));
  }

  async joinTeam(command: MutationCommand & {teamId: string}): Promise<HostedTeamMembership> {
    const teamId = safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'team', teamId);
    const membershipId = hostedTeamMembershipId(context.workspaceId, teamId, context.grant.userId);
    return this.#mutate(
      context,
      'team_membership.join',
      {teamId},
      membershipId,
      async (transaction, now, replay) => {
        trustedTeam(await transaction.get(paths.team(context.workspaceId, teamId)), context.workspaceId, teamId);
        const membershipPath = paths.teamMembership(context.workspaceId, teamId, context.grant.userId);
        const raw = await transaction.get(membershipPath);
        const before = raw === null ? null : trustedHostedTeamMembershipRecord(
          raw, context.workspaceId, teamId, context.grant.userId,
        );
        if (replay !== null) {
          if (before === null) throw conflict();
          return {entity: before, value: before};
        }
        if (before?.status === 'active') throw conflict();
        const after: HostedTeamMembership = before === null ? {
          schemaVersion: 1,
          id: membershipId,
          workspaceId: context.workspaceId,
          teamId,
          userId: context.grant.userId,
          role: context.grant.role,
          status: 'active',
          createdAt: now,
          updatedAt: now,
          revision: 1,
        } : {
          ...before,
          role: context.grant.role,
          status: 'active',
          updatedAt: now,
          revision: before.revision + 1,
        };
        if (before === null) transaction.create(membershipPath, {...after});
        else transaction.set(membershipPath, {...after});
        return {entity: after, value: after};
      },
    );
  }

  async leaveTeam(command: MutationCommand & {teamId: string}): Promise<HostedTeamMembership> {
    const teamId = safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'team', teamId);
    const membershipId = hostedTeamMembershipId(context.workspaceId, teamId, context.grant.userId);
    return this.#mutate(
      context,
      'team_membership.leave',
      {teamId},
      membershipId,
      async (transaction, now, replay) => {
        trustedTeam(await transaction.get(paths.team(context.workspaceId, teamId)), context.workspaceId, teamId);
        const membershipPath = paths.teamMembership(context.workspaceId, teamId, context.grant.userId);
        const raw = await transaction.get(membershipPath);
        const before = raw === null ? null : trustedHostedTeamMembershipRecord(
          raw, context.workspaceId, teamId, context.grant.userId,
        );
        if (replay !== null) {
          if (before === null) throw conflict();
          return {entity: before, value: before};
        }
        if (before === null || before.status === 'left') throw conflict();
        const after: HostedTeamMembership = {
          ...before,
          status: 'left',
          updatedAt: now,
          revision: before.revision + 1,
        };
        transaction.set(membershipPath, {...after});
        return {entity: after, value: after};
      },
    );
  }

  async createTeam(command: MutationCommand & {
    name: string;
    key: string;
    color?: string;
    description?: string;
  }): Promise<{team: HostedTeam; statuses: HostedWorkflowStatus[]}> {
    const input = {
      name: safeName(command.name),
      key: safeTeamKey(command.key),
      color: safeColor(command.color ?? '#5E6AD2'),
      description: safeDescription(command.description),
    };
    const context = await this.#context(command, 'workspace.settings.manage', 'team', 'new');
    return this.#mutate(context, 'team.create', input, null, async (transaction, now, replay) => {
      if (replay !== null) {
        const team = trustedTeam(await transaction.get(paths.team(context.workspaceId, replay.entityId)), context.workspaceId, replay.entityId);
        trustedHostedTeamMembershipRecord(
          await transaction.get(paths.teamMembership(context.workspaceId, team.id, context.grant.userId)),
          context.workspaceId,
          team.id,
          context.grant.userId,
        );
        const statuses = (await transaction.list(paths.statuses(context.workspaceId), hostedOperationsPolicyV1.queries.maximumTransactionListRecords))
          .map((value) => trustedStatus(value, context.workspaceId)).filter((status) => status.teamId === team.id)
          .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
        return {entity: team, value: {team, statuses}};
      }
      const teams = (await transaction.list(paths.teams(context.workspaceId), 101)).map((value) => trustedTeam(value, context.workspaceId));
      if (teams.length >= 100 || teams.some((team) => team.key === input.key || team.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) throw conflict();
      const id = `team_${opaquePart(this.#idFactory())}`;
      const team: HostedTeam = {
        schemaVersion: 1, id, workspaceId: context.workspaceId, ...input,
        createdByUserId: context.grant.userId, archivedAt: null,
        createdAt: now, updatedAt: now, revision: 1,
      };
      const statuses = defaultStatuses(context.workspaceId, id, now);
      transaction.create(paths.team(context.workspaceId, id), {...team});
      const teamMembership: HostedTeamMembership = {
        schemaVersion: 1,
        id: hostedTeamMembershipId(context.workspaceId, id, context.grant.userId),
        workspaceId: context.workspaceId,
        teamId: id,
        userId: context.grant.userId,
        role: context.grant.role,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        revision: 1,
      };
      transaction.create(paths.teamMembership(context.workspaceId, id, context.grant.userId), {...teamMembership});
      for (const status of statuses) transaction.create(paths.status(context.workspaceId, status.id), {...status});
      return {entity: team, value: {team, statuses}};
    });
  }

  async updateTeam(command: MutationCommand & {
    teamId: string;
    expectedRevision: number;
    patch: {name?: string; key?: string; color?: string; description?: string};
  }): Promise<HostedTeam> {
    const id = safeEntityId(command.teamId, 'team');
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length === 0 || keys.some((key) => !['name', 'key', 'color', 'description'].includes(key))) throw invalid();
    const patch: {name?: string; key?: string; color?: string; description?: string} = {};
    if (command.patch.name !== undefined) patch.name = safeName(command.patch.name);
    if (command.patch.key !== undefined) patch.key = safeTeamKey(command.patch.key);
    if (command.patch.color !== undefined) patch.color = safeColor(command.patch.color);
    if (command.patch.description !== undefined) patch.description = safeDescription(command.patch.description);
    const context = await this.#context(command, 'workspace.settings.manage', 'team', id);
    return this.#mutate(context, 'team.update', {id, expectedRevision, patch}, id, async (transaction, now, replay) => {
      const before = trustedTeam(await transaction.get(paths.team(context.workspaceId, id)), context.workspaceId, id);
      if (replay !== null) return {entity: before, value: before};
      if (before.revision !== expectedRevision) throw conflict();
      const all = (await transaction.list(paths.teams(context.workspaceId), 101)).map((value) => trustedTeam(value, context.workspaceId));
      if (all.some((team) => team.id !== id && ((patch.key !== undefined && team.key === patch.key)
        || (patch.name !== undefined && team.name.toLocaleLowerCase() === patch.name.toLocaleLowerCase())))) throw conflict();
      const after: HostedTeam = {...before, ...patch, updatedAt: now, revision: before.revision + 1};
      if (stable(before) === stable(after)) throw conflict();
      transaction.set(paths.team(context.workspaceId, id), {...after});
      return {entity: after, value: after};
    });
  }

  async listStatuses(command: ReadCommand & {teamId?: string}): Promise<HostedWorkflowStatus[]> {
    const teamFilter = command.teamId === undefined ? null : safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'workflow_status', teamFilter ?? 'collection');
    return this.#list(context, paths.statuses(context.workspaceId), trustedStatus)
      .then((values) => values.filter((status) => teamFilter === null || status.teamId === teamFilter)
        .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name)));
  }

  async createStatus(command: MutationCommand & {
    teamId: string;
    name: string;
    category: HostedWorkflowStatusCategory;
    color: string;
    icon?: HostedWorkflowStatusIcon;
    position?: number;
  }): Promise<HostedWorkflowStatus> {
    const teamId = safeEntityId(command.teamId, 'team');
    if (!hostedWorkflowStatusCategories.includes(command.category)) throw invalid();
    const input = {
      teamId,
      name: safeName(command.name, 60),
      category: command.category,
      color: safeColor(command.color),
      icon: command.icon === undefined
        ? defaultIconForCategory(command.category)
        : safeStatusIcon(command.icon),
      ...(command.position === undefined ? {} : {position: safePosition(command.position)}),
    };
    const context = await this.#context(command, 'workspace.settings.manage', 'team', teamId);
    return this.#mutate(context, 'workflow_status.create', input, null, async (transaction, now, replay) => {
      if (replay !== null) {
        const status = trustedStatus(await transaction.get(paths.status(context.workspaceId, replay.entityId)), context.workspaceId, replay.entityId);
        return {entity: status, value: status};
      }
      trustedTeam(await transaction.get(paths.team(context.workspaceId, teamId)), context.workspaceId, teamId);
      const statuses = (await transaction.list(paths.statuses(context.workspaceId), 501)).map((value) => trustedStatus(value, context.workspaceId)).filter((status) => status.teamId === teamId);
      if (statuses.length >= 50 || statuses.some((status) => status.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) throw conflict();
      const id = `status_${opaquePart(this.#idFactory())}`;
      const position = input.position ?? (statuses.reduce((maximum, status) => Math.max(maximum, status.position), -1) + 1);
      const status: HostedWorkflowStatus = {
        schemaVersion: 1, id, workspaceId: context.workspaceId, teamId,
        name: input.name, category: input.category, color: input.color, icon: input.icon,
        position, isDefault: false, createdAt: now, updatedAt: now, revision: 1,
      };
      transaction.create(paths.status(context.workspaceId, id), {...status});
      return {entity: status, value: status};
    });
  }

  async updateStatus(command: MutationCommand & {
    statusId: string;
    expectedRevision: number;
    patch: {name?: string; category?: HostedWorkflowStatusCategory; color?: string; icon?: HostedWorkflowStatusIcon; position?: number};
  }): Promise<HostedWorkflowStatus> {
    const id = safeEntityId(command.statusId, 'status');
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length === 0 || keys.some((key) => !['name', 'category', 'color', 'icon', 'position'].includes(key))) throw invalid();
    const patch: {name?: string; category?: HostedWorkflowStatusCategory; color?: string; icon?: HostedWorkflowStatusIcon; position?: number} = {};
    if (command.patch.name !== undefined) patch.name = safeName(command.patch.name, 60);
    if (command.patch.category !== undefined) {
      if (!hostedWorkflowStatusCategories.includes(command.patch.category)) throw invalid();
      patch.category = command.patch.category;
    }
    if (command.patch.color !== undefined) patch.color = safeColor(command.patch.color);
    if (command.patch.icon !== undefined) patch.icon = safeStatusIcon(command.patch.icon);
    if (command.patch.position !== undefined) patch.position = safePosition(command.patch.position);
    const context = await this.#context(command, 'workspace.settings.manage', 'workflow_status', id);
    return this.#mutate(context, 'workflow_status.update', {id, expectedRevision, patch}, id, async (transaction, now, replay) => {
      const before = trustedStatus(await transaction.get(paths.status(context.workspaceId, id)), context.workspaceId, id);
      if (replay !== null) return {entity: before, value: before};
      if (before.revision !== expectedRevision) throw conflict();
      if (before.isDefault && Object.keys(patch).some((key) => key !== 'icon')) throw forbidden();
      const statuses = (await transaction.list(paths.statuses(context.workspaceId), 501)).map((value) => trustedStatus(value, context.workspaceId));
      if (patch.name !== undefined && statuses.some((status) => status.id !== id && status.teamId === before.teamId
        && status.name.toLocaleLowerCase() === patch.name?.toLocaleLowerCase())) throw conflict();
      const after: HostedWorkflowStatus = {...before, ...patch, updatedAt: now, revision: before.revision + 1};
      if (stable(before) === stable(after)) throw conflict();
      transaction.set(paths.status(context.workspaceId, id), {...after});
      return {entity: after, value: after};
    });
  }

  async listCycles(command: ReadCommand & {teamId?: string}): Promise<HostedCycle[]> {
    const teamFilter = command.teamId === undefined ? null : safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'cycle', teamFilter ?? 'collection');
    return this.#list(context, paths.cycles(context.workspaceId), trustedCycle)
      .then((values) => values.filter((cycle) => teamFilter === null || cycle.teamId === teamFilter)
        .sort((left, right) => right.startDate.localeCompare(left.startDate) || right.number - left.number));
  }

  async createCycle(command: MutationCommand & {
    teamId: string;
    name?: string;
    startDate: string;
    endDate: string;
    state?: HostedCycleState;
  }): Promise<HostedCycle> {
    const teamId = safeEntityId(command.teamId, 'team');
    if (!canonicalDate(command.startDate) || !canonicalDate(command.endDate)
      || Date.parse(`${command.startDate}T00:00:00.000Z`) > Date.parse(`${command.endDate}T00:00:00.000Z`)) throw invalid();
    const state = command.state ?? 'planned';
    if (!hostedCycleStates.includes(state)) throw invalid();
    const context = await this.#context(command, 'milestone.write', 'team', teamId);
    const input = {teamId, name: command.name === undefined ? null : safeName(command.name), startDate: command.startDate, endDate: command.endDate, state};
    return this.#mutate(context, 'cycle.create', input, null, async (transaction, now, replay) => {
      if (replay !== null) {
        const cycle = trustedCycle(await transaction.get(paths.cycle(context.workspaceId, replay.entityId)), context.workspaceId, replay.entityId);
        return {entity: cycle, value: cycle};
      }
      trustedTeam(await transaction.get(paths.team(context.workspaceId, teamId)), context.workspaceId, teamId);
      const cycles = (await transaction.list(paths.cycles(context.workspaceId), 501)).map((value) => trustedCycle(value, context.workspaceId)).filter((cycle) => cycle.teamId === teamId);
      if (cycles.length >= 200) throw conflict();
      const number = cycles.reduce((maximum, cycle) => Math.max(maximum, cycle.number), 0) + 1;
      const id = `cycle_${opaquePart(this.#idFactory())}`;
      const cycle: HostedCycle = {
        schemaVersion: 1, id, workspaceId: context.workspaceId, teamId, number,
        name: input.name ?? `Cycle ${number}`, startDate: input.startDate, endDate: input.endDate,
        state, createdByUserId: context.grant.userId, createdAt: now, updatedAt: now, revision: 1,
      };
      transaction.create(paths.cycle(context.workspaceId, id), {...cycle});
      return {entity: cycle, value: cycle};
    });
  }

  async updateCycle(command: MutationCommand & {
    cycleId: string;
    expectedRevision: number;
    patch: {name?: string; startDate?: string; endDate?: string; state?: HostedCycleState};
  }): Promise<HostedCycle> {
    const id = safeEntityId(command.cycleId, 'cycle');
    const expectedRevision = positiveRevision(command.expectedRevision);
    const keys = Object.keys(command.patch);
    if (keys.length === 0 || keys.some((key) => !['name', 'startDate', 'endDate', 'state'].includes(key))) throw invalid();
    const patch: {name?: string; startDate?: string; endDate?: string; state?: HostedCycleState} = {};
    if (command.patch.name !== undefined) patch.name = safeName(command.patch.name);
    if (command.patch.startDate !== undefined) {
      if (!canonicalDate(command.patch.startDate)) throw invalid();
      patch.startDate = command.patch.startDate;
    }
    if (command.patch.endDate !== undefined) {
      if (!canonicalDate(command.patch.endDate)) throw invalid();
      patch.endDate = command.patch.endDate;
    }
    if (command.patch.state !== undefined) {
      if (!hostedCycleStates.includes(command.patch.state)) throw invalid();
      patch.state = command.patch.state;
    }
    const context = await this.#context(command, 'milestone.write', 'cycle', id);
    return this.#mutate(context, 'cycle.update', {id, expectedRevision, patch}, id, async (transaction, now, replay) => {
      const before = trustedCycle(await transaction.get(paths.cycle(context.workspaceId, id)), context.workspaceId, id);
      if (replay !== null) return {entity: before, value: before};
      if (before.revision !== expectedRevision) throw conflict();
      const after: HostedCycle = {...before, ...patch, updatedAt: now, revision: before.revision + 1};
      if (Date.parse(`${after.startDate}T00:00:00.000Z`) > Date.parse(`${after.endDate}T00:00:00.000Z`) || stable(before) === stable(after)) throw conflict();
      transaction.set(paths.cycle(context.workspaceId, id), {...after});
      return {entity: after, value: after};
    });
  }

  async listSavedViews(command: ReadCommand & {teamId?: string}): Promise<HostedSavedView[]> {
    const teamFilter = command.teamId === undefined ? null : safeEntityId(command.teamId, 'team');
    const context = await this.#context(command, 'workspace.read', 'saved_view', teamFilter ?? 'collection');
    return this.#list(context, paths.views(context.workspaceId), trustedView)
      .then((values) => values.filter((view) => teamFilter === null || view.teamId === teamFilter)
        .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)));
  }

  async createSavedView(command: MutationCommand & {
    teamId: string;
    name: string;
    viewType: HostedSavedViewType;
    predicate: HostedSavedViewPredicate;
  }): Promise<HostedSavedView> {
    const teamId = safeEntityId(command.teamId, 'team');
    if (!hostedSavedViewTypes.includes(command.viewType) || !hostedSavedViewPredicates.includes(command.predicate)) throw invalid();
    const input = {teamId, name: safeName(command.name), viewType: command.viewType, predicate: command.predicate};
    const context = await this.#context(command, 'issue.write', 'team', teamId);
    return this.#mutate(context, 'saved_view.create', input, null, async (transaction, now, replay) => {
      if (replay !== null) {
        const view = trustedView(await transaction.get(paths.view(context.workspaceId, replay.entityId)), context.workspaceId, replay.entityId);
        return {entity: view, value: view};
      }
      trustedTeam(await transaction.get(paths.team(context.workspaceId, teamId)), context.workspaceId, teamId);
      const views = (await transaction.list(paths.views(context.workspaceId), 501)).map((value) => trustedView(value, context.workspaceId));
      if (views.length >= 250 || views.some((view) => view.teamId === teamId && view.name.toLocaleLowerCase() === input.name.toLocaleLowerCase())) throw conflict();
      const id = `view_${opaquePart(this.#idFactory())}`;
      const view: HostedSavedView = {
        schemaVersion: 1, id, workspaceId: context.workspaceId, ...input,
        createdByUserId: context.grant.userId, createdAt: now, updatedAt: now, revision: 1,
      };
      transaction.create(paths.view(context.workspaceId, id), {...view});
      return {entity: view, value: view};
    });
  }

  async #list<Value>(
    context: MutationContext,
    collectionPath: string,
    parser: (value: unknown, workspaceId: string) => Value,
  ): Promise<Value[]> {
    try {
      const now = this.#trustedNow();
      const values = await this.#repository.runTransaction((transaction) => transaction.list(
        collectionPath,
        hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
      ));
      const parsed = values.map((value) => parser(value, context.workspaceId));
      if (parsed.some((value) => {
        const candidate = value as {createdAt?: string; updatedAt?: string};
        return (candidate.createdAt !== undefined && Date.parse(candidate.createdAt) > Date.parse(now))
          || (candidate.updatedAt !== undefined && Date.parse(candidate.updatedAt) > Date.parse(now));
      })) throw unavailable();
      return parsed;
    } catch (error) {
      if (error instanceof WorkspaceConfigurationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  async #context(
    command: ReadCommand,
    action: WorkspaceAuthorizationGrant['action'],
    targetEntityType: string,
    targetEntityId: string,
  ): Promise<MutationContext> {
    const workspaceId = safeWorkspaceId(command.workspaceId);
    const requestId = safeReference(command.requestId);
    const grant = await this.#authorization.authorize({
      principal: command.principal, workspaceId, action, targetEntityType,
      targetEntityId: safeReference(targetEntityId), requestId,
    });
    const idempotencyKey = (command as Partial<MutationCommand>).idempotencyKey;
    return {
      ...command,
      workspaceId,
      requestId,
      idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : 'read-only-context',
      grant,
    };
  }

  async #mutate<Value, Entity extends {id: string; revision: number; updatedAt: string}>(
    context: MutationContext,
    operation: ConfigurationOperation,
    input: unknown,
    fixedEntityId: string | null,
    body: (
      transaction: CollaborationTransaction,
      now: string,
      replay: ConfigurationIdempotency | null,
    ) => Promise<{entity: Entity; value: Value}>,
  ): Promise<Value> {
    const key = context.idempotencyKey.trim();
    if (key.length < 16 || key.length > 160 || /\s/u.test(key)) {
      throw new WorkspaceConfigurationServiceError('INVALID_IDEMPOTENCY_KEY', 'A bounded idempotency key is required.');
    }
    const requestDigest = hmac(this.#secret, stable(input));
    const id = sha256(`${context.grant.userId}:${operation}:${key}`);
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const now = this.#trustedNow();
        await this.#activeActor(transaction, context, now);
        const rawReplay = await transaction.get(paths.idempotency(context.workspaceId, id));
        const replay = rawReplay === null ? null : this.#trustedIdempotency(
          rawReplay, id, context, operation, requestDigest, now,
        );
        if (replay === null && operation !== 'team_membership.join' && operation !== 'team_membership.leave') {
          await this.#assertEntitled(transaction, context, operation, now);
        }
        const result = await body(transaction, now, replay);
        if (replay === null) {
          if (fixedEntityId !== null && result.entity.id !== fixedEntityId) throw unavailable();
          const unsigned: Omit<ConfigurationIdempotency, 'binding'> = {
            schemaVersion: 1, id, workspaceId: context.workspaceId, userId: context.grant.userId,
            operation, entityId: result.entity.id, requestDigest,
            outcomeRevision: result.entity.revision, createdAt: now,
          };
          transaction.create(paths.idempotency(context.workspaceId, id), {
            ...unsigned,
            binding: hmac(this.#secret, stable(unsigned)),
          });
        } else if (result.entity.id !== replay.entityId || result.entity.revision !== replay.outcomeRevision
          || result.entity.updatedAt !== replay.createdAt) {
          throw conflict();
        }
        return clone(result.value);
      });
    } catch (error) {
      if (error instanceof WorkspaceConfigurationServiceError || error instanceof WorkspaceAuthorizationError) throw error;
      throw unavailable();
    }
  }

  #trustedIdempotency(
    value: unknown,
    id: string,
    context: MutationContext,
    operation: ConfigurationOperation,
    requestDigest: string,
    now: string,
  ): ConfigurationIdempotency {
    const candidate = record(value);
    if (candidate === null || !exactKeys(candidate, idempotencyKeys) || candidate.schemaVersion !== 1
      || candidate.id !== id || candidate.workspaceId !== context.workspaceId
      || candidate.userId !== context.grant.userId || candidate.operation !== operation
      || candidate.requestDigest !== requestDigest || typeof candidate.entityId !== 'string'
      || !/^(?:(?:team|status|cycle|view|team_member)_[a-f0-9]{32})$/u.test(candidate.entityId)
      || !Number.isSafeInteger(candidate.outcomeRevision) || (candidate.outcomeRevision as number) < 1
      || !canonicalTimestamp(candidate.createdAt) || Date.parse(candidate.createdAt) > Date.parse(now)
      || typeof candidate.binding !== 'string') throw conflict();
    const unsigned: Omit<ConfigurationIdempotency, 'binding'> = {
      schemaVersion: 1, id: candidate.id as string, workspaceId: candidate.workspaceId as string,
      userId: candidate.userId as string, operation: candidate.operation as ConfigurationOperation,
      entityId: candidate.entityId, requestDigest: candidate.requestDigest as string,
      outcomeRevision: candidate.outcomeRevision as number, createdAt: candidate.createdAt,
    };
    const expected = hmac(this.#secret, stable(unsigned));
    if (!equalDigest(candidate.binding, expected)) throw unavailable();
    return {...unsigned, binding: expected};
  }

  async #activeActor(transaction: CollaborationTransaction, context: MutationContext, now: string): Promise<void> {
    const candidate = record(await transaction.get(paths.membership(context.workspaceId, context.grant.userId)));
    if (candidate === null || candidate.schemaVersion !== 1 || candidate.workspaceId !== context.workspaceId
      || candidate.userId !== context.grant.userId || candidate.role !== context.grant.role
      || candidate.status !== 'active' || !canonicalTimestamp(candidate.createdAt)
      || Date.parse(candidate.createdAt) > Date.parse(now)) throw forbidden();
  }

  async #assertEntitled(
    transaction: CollaborationTransaction,
    context: MutationContext,
    operation: EntitledConfigurationOperation,
    now: string,
  ): Promise<void> {
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
        throw new WorkspaceConfigurationServiceError(
          'CONFIGURATION_ENTITLEMENT_REQUIRED',
          'This workspace is on Free. Subscribe or reduce the workspace to continue this write.',
        );
      }
      throw unavailable();
    }
  }

  #trustedNow(): string {
    const value = this.#clock();
    if (!Number.isFinite(value.getTime())) throw unavailable();
    return value.toISOString();
  }
}

function invalid(): WorkspaceConfigurationServiceError {
  return new WorkspaceConfigurationServiceError('INVALID_CONFIGURATION_REQUEST', 'The workspace configuration request is invalid.');
}

function conflict(): WorkspaceConfigurationServiceError {
  return new WorkspaceConfigurationServiceError('CONFIGURATION_CONFLICT', 'The workspace configuration changed. Refresh and try again.');
}

function forbidden(): WorkspaceConfigurationServiceError {
  return new WorkspaceConfigurationServiceError('CONFIGURATION_FORBIDDEN', 'The requested workspace configuration is unavailable.');
}

function unavailable(): WorkspaceConfigurationServiceError {
  return new WorkspaceConfigurationServiceError('CONFIGURATION_SERVICE_UNAVAILABLE', 'Workspace configuration is temporarily unavailable.');
}
