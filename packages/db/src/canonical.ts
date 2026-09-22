import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  BackupOidcIdentityV1,
  BackupUserV1,
  CanonicalJson,
  CanonicalWorkspaceCollectionName,
  CanonicalWorkspaceCollectionsV1,
  CanonicalWorkspaceDigestsV1,
  CanonicalWorkspaceSnapshotV1,
  DatabaseBackupV1,
  MigrationDescriptorV1,
  TransferSourceV1,
  WorkspaceExportV1,
} from '@basiclinear/contracts';

export class TransferError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

export const workspaceCollectionNames = [
  'users',
  'workspaces',
  'memberships',
  'teams',
  'workflowStatuses',
  'projects',
  'projectResources',
  'milestones',
  'teamIssueSequences',
  'labels',
  'issues',
  'issueResources',
  'issueLabels',
  'issueRelations',
  'comments',
  'savedViews',
  'activityEntries',
] as const satisfies readonly CanonicalWorkspaceCollectionName[];

const recordFields = {
  users: ['id', 'email', 'displayName', 'revision', 'disabledAt', 'createdAt', 'updatedAt'],
  workspaces: ['id', 'name', 'slug', 'revision', 'createdByUserId', 'createdAt', 'updatedAt'],
  memberships: ['id', 'workspaceId', 'userId', 'role', 'revision', 'createdAt', 'updatedAt'],
  teams: ['id', 'workspaceId', 'name', 'key', 'revision', 'createdAt', 'updatedAt'],
  workflowStatuses: [
    'id', 'workspaceId', 'teamId', 'name', 'category', 'color', 'position', 'isDefault',
    'revision', 'createdAt', 'updatedAt',
  ],
  projects: [
    'id', 'workspaceId', 'teamId', 'name', 'summary', 'status', 'priority', 'leadUserId',
    'startDate', 'targetDate', 'icon', 'color', 'position', 'overviewDocument', 'revision',
    'archivedAt', 'archivedByUserId', 'createdAt', 'updatedAt',
  ],
  projectResources: [
    'id', 'workspaceId', 'projectId', 'label', 'url', 'position', 'createdAt',
  ],
  milestones: [
    'id', 'workspaceId', 'projectId', 'name', 'description', 'targetDate', 'position',
    'revision', 'archivedAt', 'archivedByUserId', 'createdAt', 'updatedAt',
  ],
  teamIssueSequences: ['workspaceId', 'teamId', 'nextNumber'],
  labels: [
    'id', 'workspaceId', 'name', 'color', 'revision', 'archivedAt', 'archivedByUserId',
    'createdAt', 'updatedAt',
  ],
  issues: [
    'id', 'workspaceId', 'teamId', 'sequenceNumber', 'identifier', 'title',
    'descriptionDocument', 'statusId', 'priority', 'assigneeUserId', 'dueDate', 'projectId',
    'milestoneId', 'revision', 'archivedAt', 'archivedByUserId', 'createdAt', 'updatedAt',
  ],
  issueResources: [
    'id', 'workspaceId', 'issueId', 'label', 'url', 'position', 'createdAt',
  ],
  issueLabels: ['workspaceId', 'issueId', 'labelId', 'position', 'createdAt'],
  issueRelations: [
    'id', 'workspaceId', 'sourceIssueId', 'targetIssueId', 'relationType', 'revision',
    'createdByUserId', 'createdAt', 'updatedAt',
  ],
  comments: [
    'id', 'workspaceId', 'issueId', 'authorUserId', 'bodyDocument', 'revision',
    'archivedAt', 'archivedByUserId', 'createdAt', 'updatedAt',
  ],
  savedViews: [
    'id', 'workspaceId', 'ownerUserId', 'name', 'sharingScope', 'state', 'revision',
    'archivedAt', 'archivedByUserId', 'createdAt', 'updatedAt',
  ],
  activityEntries: [
    'id', 'workspaceId', 'actorUserId', 'entityType', 'entityId', 'action',
    'entityRevision', 'metadata', 'createdAt',
  ],
} as const satisfies Record<CanonicalWorkspaceCollectionName, readonly string[]>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const integerPattern = /^[1-9]\d*$/;
const nullableFields = new Set([
  'disabledAt', 'leadUserId', 'startDate', 'targetDate', 'archivedAt', 'archivedByUserId',
  'assigneeUserId', 'dueDate', 'projectId', 'milestoneId', 'createdByUserId', 'authorUserId',
  'actorUserId',
]);
const uuidFields = new Set([
  'id', 'workspaceId', 'userId', 'createdByUserId', 'teamId', 'leadUserId',
  'archivedByUserId', 'projectId', 'statusId', 'assigneeUserId', 'milestoneId', 'issueId',
  'labelId', 'sourceIssueId', 'targetIssueId', 'authorUserId', 'ownerUserId', 'actorUserId',
  'entityId',
]);
const timestampFields = new Set(['disabledAt', 'archivedAt', 'createdAt', 'updatedAt']);
const dateFields = new Set(['startDate', 'targetDate', 'dueDate']);
const numberFields = new Set(['position']);
const integerFields = new Set(['revision', 'entityRevision']);
const integerStringFields = new Set(['nextNumber', 'sequenceNumber']);
const booleanFields = new Set(['isDefault']);
const jsonFields = new Set(['overviewDocument', 'descriptionDocument', 'bodyDocument', 'state', 'metadata']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeCanonical(value: unknown, seen: Set<object>): CanonicalJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TransferError('INVALID_CANONICAL_JSON', 'Canonical JSON contains a non-finite number.');
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => normalizeCanonical(entry, seen));
  if (!isRecord(value)) throw new TransferError('INVALID_CANONICAL_JSON', 'Canonical JSON contains an unsupported value.');
  if (seen.has(value)) throw new TransferError('INVALID_CANONICAL_JSON', 'Canonical JSON contains a cycle.');
  seen.add(value);
  const normalized: { [key: string]: CanonicalJson } = {};
  for (const key of Object.keys(value).sort()) {
    const entry = value[key];
    if (entry === undefined) throw new TransferError('INVALID_CANONICAL_JSON', 'Canonical JSON contains an undefined value.');
    normalized[key] = normalizeCanonical(entry, seen);
  }
  seen.delete(value);
  return normalized;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value, new Set()));
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function digestMatches(actual: string, expected: string): boolean {
  if (!digestPattern.test(actual) || !digestPattern.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function assertIsoTimestamp(value: unknown, field: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TransferError('INVALID_EXPORT', `${field} must be an ISO timestamp.`);
  }
}

function assertRecordShape(collection: CanonicalWorkspaceCollectionName, value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new TransferError('INVALID_EXPORT', `${collection} contains a non-object record.`);
  const expected = [...recordFields[collection]].sort();
  const actual = Object.keys(value).sort();
  if (canonicalStringify(actual) !== canonicalStringify(expected)) {
    throw new TransferError('INVALID_EXPORT', `${collection} contains an unsupported or missing field.`);
  }
  for (const field of expected) {
    const entry = value[field];
    if (entry === null && nullableFields.has(field)) continue;
    if (collection === 'activityEntries' && field === 'id') {
      if (typeof entry !== 'string' || !integerPattern.test(entry)) {
        throw new TransferError('INVALID_EXPORT', 'activityEntries.id must be a positive integer string.');
      }
    } else if (uuidFields.has(field)) {
      if (typeof entry !== 'string' || !uuidPattern.test(entry)) {
        throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be a UUID.`);
      }
    } else if (timestampFields.has(field)) {
      assertIsoTimestamp(entry, `${collection}.${field}`);
    } else if (dateFields.has(field)) {
      if (typeof entry !== 'string' || !datePattern.test(entry)) {
        throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be an ISO date.`);
      }
    } else if (numberFields.has(field)) {
      if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) {
        throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be a non-negative number.`);
      }
    } else if (integerFields.has(field)) {
      if (!Number.isSafeInteger(entry) || (entry as number) < 1) {
        throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be a positive integer.`);
      }
    } else if (integerStringFields.has(field)) {
      if (typeof entry !== 'string' || !integerPattern.test(entry)) {
        throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be a positive integer string.`);
      }
    } else if (booleanFields.has(field)) {
      if (typeof entry !== 'boolean') throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be boolean.`);
    } else if (jsonFields.has(field)) {
      canonicalStringify(entry);
    } else if (typeof entry !== 'string') {
      throw new TransferError('INVALID_EXPORT', `${collection}.${field} must be a string.`);
    }
  }
}

function compareScalar(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right), 'en');
}

function compareIntegerString(left: unknown, right: unknown): number {
  const a = BigInt(String(left));
  const b = BigInt(String(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

const collectionComparators: Record<CanonicalWorkspaceCollectionName, (a: Record<string, unknown>, b: Record<string, unknown>) => number> = {
  users: (a, b) => compareScalar(a.id, b.id),
  workspaces: (a, b) => compareScalar(a.id, b.id),
  memberships: (a, b) => compareScalar(a.userId, b.userId) || compareScalar(a.id, b.id),
  teams: (a, b) => compareScalar(String(a.key).toLowerCase(), String(b.key).toLowerCase()) || compareScalar(a.id, b.id),
  workflowStatuses: (a, b) => compareScalar(a.teamId, b.teamId) || compareScalar(a.position, b.position) || compareScalar(a.id, b.id),
  projects: (a, b) => compareScalar(a.position, b.position) || compareScalar(a.id, b.id),
  projectResources: (a, b) => compareScalar(a.projectId, b.projectId) || compareScalar(a.position, b.position) || compareScalar(a.id, b.id),
  milestones: (a, b) => compareScalar(a.projectId, b.projectId) || compareScalar(a.position, b.position) || compareScalar(a.id, b.id),
  teamIssueSequences: (a, b) => compareScalar(a.teamId, b.teamId),
  labels: (a, b) => compareScalar(String(a.name).toLowerCase(), String(b.name).toLowerCase()) || compareScalar(a.id, b.id),
  issues: (a, b) => compareScalar(a.teamId, b.teamId) || compareIntegerString(a.sequenceNumber, b.sequenceNumber) || compareScalar(a.id, b.id),
  issueResources: (a, b) => compareScalar(a.issueId, b.issueId) || compareScalar(a.position, b.position) || compareScalar(a.id, b.id),
  issueLabels: (a, b) => compareScalar(a.issueId, b.issueId) || compareScalar(a.position, b.position) || compareScalar(a.labelId, b.labelId),
  issueRelations: (a, b) => compareScalar(a.sourceIssueId, b.sourceIssueId) || compareScalar(a.relationType, b.relationType) || compareScalar(a.targetIssueId, b.targetIssueId) || compareScalar(a.id, b.id),
  comments: (a, b) => compareScalar(a.issueId, b.issueId) || compareScalar(a.createdAt, b.createdAt) || compareScalar(a.id, b.id),
  savedViews: (a, b) => compareScalar(a.ownerUserId, b.ownerUserId) || compareScalar(String(a.name).toLowerCase(), String(b.name).toLowerCase()) || compareScalar(a.id, b.id),
  activityEntries: (a, b) => compareIntegerString(a.id, b.id),
};

export function sortWorkspaceCollections(collections: CanonicalWorkspaceCollectionsV1): CanonicalWorkspaceCollectionsV1 {
  const sorted = {} as CanonicalWorkspaceCollectionsV1;
  for (const name of workspaceCollectionNames) {
    const records = [...collections[name]] as unknown as Array<Record<string, unknown>>;
    records.sort(collectionComparators[name]);
    (sorted as unknown as Record<string, unknown>)[name] = records;
  }
  return sorted;
}

function assertMigrationManifest(value: unknown): asserts value is MigrationDescriptorV1[] {
  if (!Array.isArray(value)) throw new TransferError('INVALID_EXPORT', 'Migration manifest must be an array.');
  let prior = '';
  for (const migration of value) {
    if (!isRecord(migration) || Object.keys(migration).sort().join(',') !== 'digest,name') {
      throw new TransferError('INVALID_EXPORT', 'Migration manifest contains an invalid record.');
    }
    if (typeof migration.name !== 'string' || !/^\d+_[a-z0-9_]+\.sql$/.test(migration.name)) {
      throw new TransferError('INVALID_EXPORT', 'Migration manifest contains an invalid name.');
    }
    if (typeof migration.digest !== 'string' || !digestPattern.test(migration.digest)) {
      throw new TransferError('INVALID_EXPORT', 'Migration manifest contains an invalid digest.');
    }
    if (migration.name <= prior) throw new TransferError('INVALID_EXPORT', 'Migration manifest is not strictly ordered.');
    prior = migration.name;
  }
}

function assertSource(value: unknown, backup = false): asserts value is TransferSourceV1 {
  if (!isRecord(value)) throw new TransferError('INVALID_EXPORT', 'Source manifest is missing.');
  const required = backup
    ? ['buildId', 'databaseName', 'migrations', 'productVersion', 'serverVersion']
    : ['buildId', 'migrations', 'productVersion'];
  if (canonicalStringify(Object.keys(value).sort()) !== canonicalStringify(required)) {
    throw new TransferError('INVALID_EXPORT', 'Source manifest contains an unsupported or missing field.');
  }
  if (typeof value.productVersion !== 'string' || typeof value.buildId !== 'string') {
    throw new TransferError('INVALID_EXPORT', 'Source build metadata is invalid.');
  }
  if (backup && (typeof value.databaseName !== 'string' || typeof value.serverVersion !== 'string')) {
    throw new TransferError('INVALID_EXPORT', 'Source database metadata is invalid.');
  }
  assertMigrationManifest(value.migrations);
}

function ids(records: Array<{ id: string }>): Set<string> {
  const result = new Set<string>();
  for (const record of records) {
    if (result.has(record.id)) throw new TransferError('INVALID_EXPORT', 'A canonical collection contains duplicate IDs.');
    result.add(record.id);
  }
  return result;
}

function requireReference(set: Set<string>, value: string | null, field: string): void {
  if (value !== null && !set.has(value)) throw new TransferError('INVALID_EXPORT', `${field} references a missing record.`);
}

function validateReferences(snapshot: CanonicalWorkspaceSnapshotV1): void {
  const c = snapshot.collections;
  if (c.workspaces.length !== 1 || c.workspaces[0]?.id !== snapshot.workspaceId) {
    throw new TransferError('INVALID_EXPORT', 'The export must contain exactly its declared workspace.');
  }
  const userIds = ids(c.users);
  const membershipIds = ids(c.memberships);
  const teamIds = ids(c.teams);
  const statusIds = ids(c.workflowStatuses);
  const projectIds = ids(c.projects);
  const milestoneIds = ids(c.milestones);
  const labelIds = ids(c.labels);
  const issueIds = ids(c.issues);
  ids(c.workspaces);
  ids(c.projectResources);
  ids(c.issueResources);
  ids(c.issueRelations);
  ids(c.comments);
  ids(c.savedViews);
  const memberUsers = new Set(c.memberships.map((membership) => membership.userId));
  const statusTeams = new Map(c.workflowStatuses.map((status) => [status.id, status.teamId]));
  const projectTeams = new Map(c.projects.map((project) => [project.id, project.teamId]));
  const milestoneProjects = new Map(c.milestones.map((milestone) => [milestone.id, milestone.projectId]));

  requireReference(userIds, c.workspaces[0]?.createdByUserId ?? null, 'workspace.createdByUserId');
  for (const membership of c.memberships) {
    if (membership.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Membership workspace scope is invalid.');
    requireReference(userIds, membership.userId, 'membership.userId');
  }
  if (membershipIds.size !== c.memberships.length) throw new TransferError('INVALID_EXPORT', 'Membership IDs are not unique.');
  for (const team of c.teams) if (team.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Team workspace scope is invalid.');
  for (const status of c.workflowStatuses) {
    if (status.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Status workspace scope is invalid.');
    requireReference(teamIds, status.teamId, 'status.teamId');
  }
  for (const project of c.projects) {
    if (project.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Project workspace scope is invalid.');
    requireReference(teamIds, project.teamId, 'project.teamId');
    if (project.leadUserId !== null && !memberUsers.has(project.leadUserId)) throw new TransferError('INVALID_EXPORT', 'Project lead is not a workspace member.');
    requireReference(userIds, project.archivedByUserId, 'project.archivedByUserId');
  }
  for (const resource of c.projectResources) {
    if (resource.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Resource workspace scope is invalid.');
    requireReference(projectIds, resource.projectId, 'resource.projectId');
  }
  for (const milestone of c.milestones) {
    if (milestone.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Milestone workspace scope is invalid.');
    requireReference(projectIds, milestone.projectId, 'milestone.projectId');
    requireReference(userIds, milestone.archivedByUserId, 'milestone.archivedByUserId');
  }
  for (const sequence of c.teamIssueSequences) {
    if (sequence.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Issue sequence workspace scope is invalid.');
    requireReference(teamIds, sequence.teamId, 'teamIssueSequence.teamId');
  }
  for (const label of c.labels) {
    if (label.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Label workspace scope is invalid.');
    requireReference(userIds, label.archivedByUserId, 'label.archivedByUserId');
  }
  for (const issue of c.issues) {
    if (issue.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Issue workspace scope is invalid.');
    requireReference(teamIds, issue.teamId, 'issue.teamId');
    requireReference(statusIds, issue.statusId, 'issue.statusId');
    if (statusTeams.get(issue.statusId) !== issue.teamId) throw new TransferError('INVALID_EXPORT', 'Issue status belongs to another team.');
    if (issue.assigneeUserId !== null && !memberUsers.has(issue.assigneeUserId)) throw new TransferError('INVALID_EXPORT', 'Issue assignee is not a workspace member.');
    requireReference(projectIds, issue.projectId, 'issue.projectId');
    if (issue.projectId !== null && projectTeams.get(issue.projectId) !== issue.teamId) throw new TransferError('INVALID_EXPORT', 'Issue project belongs to another team.');
    requireReference(milestoneIds, issue.milestoneId, 'issue.milestoneId');
    if (issue.milestoneId !== null && milestoneProjects.get(issue.milestoneId) !== issue.projectId) throw new TransferError('INVALID_EXPORT', 'Issue milestone belongs to another project.');
    requireReference(userIds, issue.archivedByUserId, 'issue.archivedByUserId');
  }
  for (const resource of c.issueResources) {
    if (resource.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Issue resource workspace scope is invalid.');
    requireReference(issueIds, resource.issueId, 'issueResource.issueId');
  }
  for (const item of c.issueLabels) {
    if (item.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Issue label workspace scope is invalid.');
    requireReference(issueIds, item.issueId, 'issueLabel.issueId');
    requireReference(labelIds, item.labelId, 'issueLabel.labelId');
  }
  for (const relation of c.issueRelations) {
    if (relation.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Relation workspace scope is invalid.');
    requireReference(issueIds, relation.sourceIssueId, 'relation.sourceIssueId');
    requireReference(issueIds, relation.targetIssueId, 'relation.targetIssueId');
    if (relation.sourceIssueId === relation.targetIssueId) throw new TransferError('INVALID_EXPORT', 'Issue relation cannot reference itself.');
    requireReference(userIds, relation.createdByUserId, 'relation.createdByUserId');
  }
  for (const comment of c.comments) {
    if (comment.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Comment workspace scope is invalid.');
    requireReference(issueIds, comment.issueId, 'comment.issueId');
    requireReference(userIds, comment.authorUserId, 'comment.authorUserId');
    requireReference(userIds, comment.archivedByUserId, 'comment.archivedByUserId');
  }
  for (const view of c.savedViews) {
    if (view.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Saved view workspace scope is invalid.');
    if (!memberUsers.has(view.ownerUserId)) throw new TransferError('INVALID_EXPORT', 'Saved view owner is not a workspace member.');
    requireReference(userIds, view.archivedByUserId, 'savedView.archivedByUserId');
  }
  for (const activity of c.activityEntries) {
    if (activity.workspaceId !== snapshot.workspaceId) throw new TransferError('INVALID_EXPORT', 'Activity workspace scope is invalid.');
    requireReference(userIds, activity.actorUserId, 'activity.actorUserId');
  }
}

export function buildWorkspaceDigests(
  migrations: MigrationDescriptorV1[],
  workspaceId: string,
  collections: CanonicalWorkspaceCollectionsV1,
): CanonicalWorkspaceDigestsV1 {
  const collectionDigests = {} as Record<CanonicalWorkspaceCollectionName, string>;
  for (const name of workspaceCollectionNames) collectionDigests[name] = canonicalSha256(collections[name]);
  return {
    algorithm: 'sha256',
    collections: collectionDigests,
    canonical: canonicalSha256({
      format: 'basiclinear.workspace-snapshot',
      version: 1,
      migrations,
      workspaceId,
      collections: collectionDigests,
    }),
  };
}

export function verifyWorkspaceSnapshot(
  snapshot: CanonicalWorkspaceSnapshotV1,
  migrations: MigrationDescriptorV1[],
): void {
  if (!isRecord(snapshot) || typeof snapshot.workspaceId !== 'string' || !uuidPattern.test(snapshot.workspaceId)) {
    throw new TransferError('INVALID_EXPORT', 'Workspace snapshot metadata is invalid.');
  }
  if (!isRecord(snapshot.collections) || !isRecord(snapshot.digests)) {
    throw new TransferError('INVALID_EXPORT', 'Workspace collections or digests are missing.');
  }
  const names = Object.keys(snapshot.collections).sort();
  if (canonicalStringify(names) !== canonicalStringify([...workspaceCollectionNames].sort())) {
    throw new TransferError('INVALID_EXPORT', 'Workspace export contains an unsupported or missing collection.');
  }
  for (const name of workspaceCollectionNames) {
    const records = snapshot.collections[name];
    if (!Array.isArray(records)) throw new TransferError('INVALID_EXPORT', `${name} must be an array.`);
    for (const record of records) assertRecordShape(name, record);
  }
  const sorted = sortWorkspaceCollections(snapshot.collections);
  if (canonicalStringify(sorted) !== canonicalStringify(snapshot.collections)) {
    throw new TransferError('NON_CANONICAL_EXPORT', 'Workspace collections are not in canonical order.');
  }
  validateReferences(snapshot);
  const expected = buildWorkspaceDigests(migrations, snapshot.workspaceId, snapshot.collections);
  if (snapshot.digests.algorithm !== 'sha256' || !isRecord(snapshot.digests.collections)) {
    throw new TransferError('INVALID_EXPORT', 'Workspace digest metadata is invalid.');
  }
  for (const name of workspaceCollectionNames) {
    const actual = snapshot.digests.collections[name];
    if (typeof actual !== 'string' || !digestMatches(actual, expected.collections[name])) {
      throw new TransferError('DIGEST_MISMATCH', `Workspace collection digest failed for ${name}.`);
    }
  }
  if (typeof snapshot.digests.canonical !== 'string' || !digestMatches(snapshot.digests.canonical, expected.canonical)) {
    throw new TransferError('DIGEST_MISMATCH', 'Workspace canonical digest failed.');
  }
}

export function parseWorkspaceExport(value: unknown): WorkspaceExportV1 {
  if (!isRecord(value)) throw new TransferError('INVALID_EXPORT', 'Workspace export must be an object.');
  const keys = ['collections', 'digests', 'format', 'generatedAt', 'source', 'version', 'workspaceId'];
  if (canonicalStringify(Object.keys(value).sort()) !== canonicalStringify(keys)) {
    throw new TransferError('INVALID_EXPORT', 'Workspace export contains an unsupported or missing field.');
  }
  if (value.format !== 'basiclinear.workspace-export' || value.version !== 1) {
    throw new TransferError('UNSUPPORTED_EXPORT_VERSION', 'Workspace export format or version is unsupported.');
  }
  assertIsoTimestamp(value.generatedAt, 'generatedAt');
  assertSource(value.source);
  const result = value as unknown as WorkspaceExportV1;
  verifyWorkspaceSnapshot(result, result.source.migrations);
  return result;
}

function assertBackupUser(value: unknown): asserts value is BackupUserV1 {
  if (!isRecord(value)) throw new TransferError('INVALID_BACKUP', 'Backup users contain a non-object record.');
  const keys = [...recordFields.users, 'passwordHash'].sort();
  if (canonicalStringify(Object.keys(value).sort()) !== canonicalStringify(keys)) {
    throw new TransferError('INVALID_BACKUP', 'Backup user contains an unsupported or missing field.');
  }
  const publicUser = { ...value };
  delete publicUser.passwordHash;
  assertRecordShape('users', publicUser);
  if (typeof value.passwordHash !== 'string' || value.passwordHash.length < 1 || value.passwordHash.length > 4096) {
    throw new TransferError('INVALID_BACKUP', 'Backup credential data is invalid.');
  }
}

function assertBackupOidcIdentity(value: unknown): asserts value is BackupOidcIdentityV1 {
  if (!isRecord(value)) throw new TransferError('INVALID_BACKUP', 'Backup OIDC identities contain a non-object record.');
  const keys = ['createdAt', 'id', 'issuer', 'revision', 'subject', 'updatedAt', 'userId'];
  if (canonicalStringify(Object.keys(value).sort()) !== canonicalStringify(keys)) {
    throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity contains an unsupported or missing field.');
  }
  if (typeof value.id !== 'string' || !uuidPattern.test(value.id)
    || typeof value.userId !== 'string' || !uuidPattern.test(value.userId)) {
    throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity identifiers are invalid.');
  }
  if (typeof value.issuer !== 'string' || value.issuer.length > 2048 || !/^https?:\/\//.test(value.issuer)
    || typeof value.subject !== 'string' || value.subject.length < 1 || value.subject.length > 1024) {
    throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity claims are invalid.');
  }
  if (!Number.isSafeInteger(value.revision) || (value.revision as number) < 1) {
    throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity revision is invalid.');
  }
  assertIsoTimestamp(value.createdAt, 'oidcIdentities.createdAt');
  assertIsoTimestamp(value.updatedAt, 'oidcIdentities.updatedAt');
}

function compareBackupOidcIdentity(left: BackupOidcIdentityV1, right: BackupOidcIdentityV1): number {
  return left.issuer.localeCompare(right.issuer, 'en')
    || left.subject.localeCompare(right.subject, 'en')
    || left.id.localeCompare(right.id, 'en');
}

export function buildDatabaseBackupDigests(
  migrations: MigrationDescriptorV1[],
  users: BackupUserV1[],
  oidcIdentities: BackupOidcIdentityV1[],
  workspaces: CanonicalWorkspaceSnapshotV1[],
): DatabaseBackupV1['digests'] {
  const usersDigest = canonicalSha256(users);
  const oidcIdentitiesDigest = canonicalSha256(oidcIdentities);
  const workspacesDigest = canonicalSha256(
    workspaces.map((workspace) => ({ workspaceId: workspace.workspaceId, canonical: workspace.digests.canonical })),
  );
  return {
    algorithm: 'sha256',
    users: usersDigest,
    oidcIdentities: oidcIdentitiesDigest,
    workspaces: workspacesDigest,
    canonical: canonicalSha256({
      format: 'basiclinear.database-backup',
      version: 1,
      migrations,
      users: usersDigest,
      oidcIdentities: oidcIdentitiesDigest,
      workspaces: workspacesDigest,
    }),
  };
}

export function parseDatabaseBackup(value: unknown): DatabaseBackupV1 {
  if (!isRecord(value)) throw new TransferError('INVALID_BACKUP', 'Database backup must be an object.');
  const keys = ['digests', 'format', 'generatedAt', 'oidcIdentities', 'source', 'users', 'version', 'workspaces'];
  if (canonicalStringify(Object.keys(value).sort()) !== canonicalStringify(keys)) {
    throw new TransferError('INVALID_BACKUP', 'Database backup contains an unsupported or missing field.');
  }
  if (value.format !== 'basiclinear.database-backup' || value.version !== 1) {
    throw new TransferError('UNSUPPORTED_BACKUP_VERSION', 'Database backup format or version is unsupported.');
  }
  assertIsoTimestamp(value.generatedAt, 'generatedAt');
  assertSource(value.source, true);
  if (!Array.isArray(value.users) || !Array.isArray(value.oidcIdentities)
    || !Array.isArray(value.workspaces) || !isRecord(value.digests)) {
    throw new TransferError('INVALID_BACKUP', 'Database backup collections or digests are missing.');
  }
  for (const user of value.users) assertBackupUser(user);
  for (const identity of value.oidcIdentities) assertBackupOidcIdentity(identity);
  const userIds = ids(value.users as BackupUserV1[]);
  const sortedUsers = [...value.users].sort((a, b) => String((a as BackupUserV1).id).localeCompare(String((b as BackupUserV1).id), 'en'));
  if (canonicalStringify(sortedUsers) !== canonicalStringify(value.users)) {
    throw new TransferError('NON_CANONICAL_BACKUP', 'Backup users are not in canonical order.');
  }
  const identityIds = ids(value.oidcIdentities as BackupOidcIdentityV1[]);
  if (identityIds.size !== value.oidcIdentities.length) {
    throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity IDs are not unique.');
  }
  const sortedIdentities = [...value.oidcIdentities as BackupOidcIdentityV1[]].sort(compareBackupOidcIdentity);
  if (canonicalStringify(sortedIdentities) !== canonicalStringify(value.oidcIdentities)) {
    throw new TransferError('NON_CANONICAL_BACKUP', 'Backup OIDC identities are not in canonical order.');
  }
  const issuerSubjects = new Set<string>();
  const userIssuers = new Set<string>();
  for (const identity of value.oidcIdentities as BackupOidcIdentityV1[]) {
    if (!userIds.has(identity.userId)) {
      throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity references a missing user.');
    }
    const issuerSubject = canonicalStringify([identity.issuer, identity.subject]);
    const userIssuer = canonicalStringify([identity.userId, identity.issuer]);
    if (issuerSubjects.has(issuerSubject) || userIssuers.has(userIssuer)) {
      throw new TransferError('INVALID_BACKUP', 'Backup OIDC identity mapping is not unique.');
    }
    issuerSubjects.add(issuerSubject);
    userIssuers.add(userIssuer);
  }
  let priorWorkspace = '';
  for (const workspace of value.workspaces as CanonicalWorkspaceSnapshotV1[]) {
    verifyWorkspaceSnapshot(workspace, value.source.migrations as MigrationDescriptorV1[]);
    if (workspace.workspaceId <= priorWorkspace) throw new TransferError('NON_CANONICAL_BACKUP', 'Backup workspaces are not strictly ordered.');
    priorWorkspace = workspace.workspaceId;
    for (const user of workspace.collections.users) {
      if (!userIds.has(user.id)) throw new TransferError('INVALID_BACKUP', 'Workspace snapshot references a user missing from the backup.');
      const backupUser = (value.users as BackupUserV1[]).find((candidate) => candidate.id === user.id);
      if (backupUser === undefined || canonicalStringify(user) !== canonicalStringify({
        id: backupUser.id,
        email: backupUser.email,
        displayName: backupUser.displayName,
        revision: backupUser.revision,
        disabledAt: backupUser.disabledAt,
        createdAt: backupUser.createdAt,
        updatedAt: backupUser.updatedAt,
      })) throw new TransferError('INVALID_BACKUP', 'Workspace and backup user records disagree.');
    }
  }
  const result = value as unknown as DatabaseBackupV1;
  const expected = buildDatabaseBackupDigests(
    result.source.migrations,
    result.users,
    result.oidcIdentities,
    result.workspaces,
  );
  if (result.digests.algorithm !== 'sha256'
    || typeof result.digests.users !== 'string'
    || typeof result.digests.oidcIdentities !== 'string'
    || typeof result.digests.workspaces !== 'string'
    || typeof result.digests.canonical !== 'string'
    || !digestMatches(result.digests.users, expected.users)
    || !digestMatches(result.digests.oidcIdentities, expected.oidcIdentities)
    || !digestMatches(result.digests.workspaces, expected.workspaces)
    || !digestMatches(result.digests.canonical, expected.canonical)) {
    throw new TransferError('DIGEST_MISMATCH', 'Database backup digest verification failed.');
  }
  return result;
}
