import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  copyFileSync,
  constants as fsConstants,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import type {
  CanonicalWorkspaceCollectionsV1,
  CanonicalWorkspaceSnapshotV1,
  DatabaseBackupV1,
  ExportMembershipV1,
  ExportTeamV1,
  ExportUserV1,
  ExportWorkspaceV1,
  MigrationDescriptorV1,
  TransferSourceV1,
  WorkspaceExportV1,
} from '@openlinear/contracts';
import {
  buildWorkspaceDigests,
  parseDatabaseBackup,
  parseWorkspaceExport,
  sortWorkspaceCollections,
  TransferError,
  verifyWorkspaceSnapshot,
} from '../canonical.js';
import { createDatabase, databaseSchemaVersion, type OpenLinearDatabase } from './client.js';

export interface TransferBuildIdentity {
  productVersion?: string;
  buildId?: string;
}

export interface WorkspaceImportOptions {
  replace?: boolean;
  workspaceId?: string;
  teamId?: string;
  ownerUserId?: string;
}

export interface WorkspaceImportResult {
  workspaceId: string;
  teamId: string;
  ownerUserId: string;
  canonicalDigest: string;
  importedRecords: number;
  credentialRecoveryRequired: number;
  replaced: boolean;
}

export interface DatabaseFileHealth {
  path: string;
  schemaVersion: number;
  integrity: 'ok';
  foreignKeyViolations: number;
}

const localMigrationName = '001_embedded_sqlite.sql';
const localMigrations: MigrationDescriptorV1[] = [
  {
    name: localMigrationName,
    digest: createHash('sha256').update('openlinear:embedded-sqlite:schema-v1').digest('hex'),
  },
  {
    name: '002_local_owner_no_credentials.sql',
    digest: createHash('sha256').update('openlinear:embedded-sqlite:schema-v2').digest('hex'),
  },
];

interface TransferMetadataRow {
  sourceMigrations: string;
  sourceProductVersion: string;
  sourceBuildId: string;
  usersJson: string;
  workspacesJson: string;
  membershipsJson: string;
  teamsJson: string;
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new TransferError('DATABASE_CORRUPT', 'Stored canonical metadata is invalid.');
  }
}

function transferMetadata(db: OpenLinearDatabase): TransferMetadataRow | undefined {
  return db.sqlite.prepare(`
    SELECT source_migrations AS sourceMigrations,
           source_product_version AS sourceProductVersion,
           source_build_id AS sourceBuildId,
           users_json AS usersJson,
           workspaces_json AS workspacesJson,
           memberships_json AS membershipsJson,
           teams_json AS teamsJson
    FROM transfer_metadata WHERE singleton = 1
  `).get() as TransferMetadataRow | undefined;
}

function sourceManifest(
  db: OpenLinearDatabase,
  identity: TransferBuildIdentity,
): TransferSourceV1 {
  const imported = transferMetadata(db);
  return {
    productVersion: identity.productVersion ?? imported?.sourceProductVersion ?? '0.1.0',
    buildId: identity.buildId ?? imported?.sourceBuildId ?? 'development',
    migrations: imported === undefined
      ? localMigrations
      : parseJson<MigrationDescriptorV1[]>(imported.sourceMigrations),
  };
}

function databaseScope(db: OpenLinearDatabase): {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  membershipId: string;
  teamId: string;
  teamName: string;
  teamKey: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
} {
  const row = db.sqlite.prepare(`
    SELECT workspace_id AS workspaceId, workspace_name AS workspaceName,
           workspace_slug AS workspaceSlug, membership_id AS membershipId,
           team_id AS teamId, team_name AS teamName, team_key AS teamKey,
           revision, created_at AS createdAt, updated_at AS updatedAt
    FROM scope_metadata WHERE singleton = 1
  `).get() as {
    workspaceId: string;
    workspaceName: string;
    workspaceSlug: string;
    membershipId: string;
    teamId: string;
    teamName: string;
    teamKey: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
  } | undefined;
  if (row === undefined) throw new TransferError('DATABASE_EMPTY', 'The local workspace is not initialized.');
  return row;
}

function canonicalIdentity(db: OpenLinearDatabase): {
  users: ExportUserV1[];
  workspaces: ExportWorkspaceV1[];
  memberships: ExportMembershipV1[];
  teams: ExportTeamV1[];
} {
  const scope = databaseScope(db);
  const owner = db.sqlite.prepare(`
    SELECT id, email, display_name AS displayName, revision, disabled_at AS disabledAt,
           created_at AS createdAt, updated_at AS updatedAt
    FROM owner_profile WHERE singleton = 1
  `).get() as ExportUserV1 | undefined;
  if (owner === undefined) throw new TransferError('DATABASE_EMPTY', 'The local owner is not initialized.');
  const stored = transferMetadata(db);
  if (stored === undefined) {
    return {
      users: [owner],
      workspaces: [{
        id: scope.workspaceId,
        name: scope.workspaceName,
        slug: scope.workspaceSlug,
        revision: scope.revision,
        createdByUserId: owner.id,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      }],
      memberships: [{
        id: scope.membershipId,
        workspaceId: scope.workspaceId,
        userId: owner.id,
        role: 'owner',
        revision: 1,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      }],
      teams: [{
        id: scope.teamId,
        workspaceId: scope.workspaceId,
        name: scope.teamName,
        key: scope.teamKey,
        revision: scope.revision,
        createdAt: scope.createdAt,
        updatedAt: scope.updatedAt,
      }],
    };
  }
  const users = parseJson<ExportUserV1[]>(stored.usersJson);
  const ownerIndex = users.findIndex((user) => user.id === owner.id);
  if (ownerIndex === -1) throw new TransferError('DATABASE_CORRUPT', 'Canonical owner metadata is missing.');
  users[ownerIndex] = owner;
  return {
    users,
    workspaces: parseJson<ExportWorkspaceV1[]>(stored.workspacesJson),
    memberships: parseJson<ExportMembershipV1[]>(stored.membershipsJson),
    teams: parseJson<ExportTeamV1[]>(stored.teamsJson),
  };
}

function workspaceCollections(db: OpenLinearDatabase): CanonicalWorkspaceCollectionsV1 {
  const scope = databaseScope(db);
  const identity = canonicalIdentity(db);
  const workflowStatuses = (db.sqlite.prepare(`
    SELECT id, name, category, color, position, is_default AS isDefault, revision,
           created_at AS createdAt, updated_at AS updatedAt FROM workflow_statuses
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    workspaceId: scope.workspaceId,
    teamId: scope.teamId,
    isDefault: row.isDefault === 1,
  })) as CanonicalWorkspaceCollectionsV1['workflowStatuses'];
  const projects = (db.sqlite.prepare(`
    SELECT id, name, summary, status, priority, lead_user_id AS leadUserId,
           start_date AS startDate, target_date AS targetDate, icon, color, position,
           overview_document AS overviewDocument, revision, archived_at AS archivedAt,
           archived_by_user_id AS archivedByUserId, created_at AS createdAt,
           updated_at AS updatedAt FROM projects
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    workspaceId: scope.workspaceId,
    teamId: scope.teamId,
    overviewDocument: parseJson(String(row.overviewDocument)),
  })) as CanonicalWorkspaceCollectionsV1['projects'];
  const projectResources = (db.sqlite.prepare(`
    SELECT id, project_id AS projectId, label, url, position, created_at AS createdAt
    FROM project_resources
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['projectResources'];
  const milestones = (db.sqlite.prepare(`
    SELECT id, project_id AS projectId, name, description, target_date AS targetDate,
           position, revision, archived_at AS archivedAt,
           archived_by_user_id AS archivedByUserId, created_at AS createdAt,
           updated_at AS updatedAt FROM milestones
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['milestones'];
  const nextNumber = (db.sqlite.prepare(`
    SELECT next_number AS nextNumber FROM issue_sequence WHERE singleton = 1
  `).get() as { nextNumber: number } | undefined)?.nextNumber ?? 1;
  const labels = (db.sqlite.prepare(`
    SELECT id, name, color, revision, archived_at AS archivedAt,
           archived_by_user_id AS archivedByUserId, created_at AS createdAt,
           updated_at AS updatedAt FROM labels
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['labels'];
  const issues = (db.sqlite.prepare(`
    SELECT id, sequence_number AS sequenceNumber, identifier, title,
           description_document AS descriptionDocument, status_id AS statusId, priority,
           assignee_user_id AS assigneeUserId, due_date AS dueDate,
           project_id AS projectId, milestone_id AS milestoneId, revision,
           archived_at AS archivedAt, archived_by_user_id AS archivedByUserId,
           created_at AS createdAt, updated_at AS updatedAt FROM issues
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    workspaceId: scope.workspaceId,
    teamId: scope.teamId,
    sequenceNumber: String(row.sequenceNumber),
    descriptionDocument: parseJson(String(row.descriptionDocument)),
  })) as CanonicalWorkspaceCollectionsV1['issues'];
  const issueResources = (db.sqlite.prepare(`
    SELECT id, issue_id AS issueId, label, url, position, created_at AS createdAt
    FROM issue_resources
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['issueResources'];
  const issueLabels = (db.sqlite.prepare(`
    SELECT issue_id AS issueId, label_id AS labelId, position, created_at AS createdAt
    FROM issue_labels
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['issueLabels'];
  const issueRelations = (db.sqlite.prepare(`
    SELECT id, source_issue_id AS sourceIssueId, target_issue_id AS targetIssueId,
           relation_type AS relationType, revision, created_by_user_id AS createdByUserId,
           created_at AS createdAt, updated_at AS updatedAt FROM issue_relations
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row, workspaceId: scope.workspaceId,
  })) as CanonicalWorkspaceCollectionsV1['issueRelations'];
  const comments = (db.sqlite.prepare(`
    SELECT id, issue_id AS issueId, author_user_id AS authorUserId,
           body_document AS bodyDocument, revision, archived_at AS archivedAt,
           archived_by_user_id AS archivedByUserId, created_at AS createdAt,
           updated_at AS updatedAt FROM comments
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    workspaceId: scope.workspaceId,
    bodyDocument: parseJson(String(row.bodyDocument)),
  })) as CanonicalWorkspaceCollectionsV1['comments'];
  const savedViews = (db.sqlite.prepare(`
    SELECT id, owner_user_id AS ownerUserId, name, sharing_scope AS sharingScope,
           state, revision, archived_at AS archivedAt,
           archived_by_user_id AS archivedByUserId, created_at AS createdAt,
           updated_at AS updatedAt FROM saved_views
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    workspaceId: scope.workspaceId,
    state: parseJson(String(row.state)),
  })) as CanonicalWorkspaceCollectionsV1['savedViews'];
  const activityEntries = (db.sqlite.prepare(`
    SELECT id, actor_user_id AS actorUserId, entity_type AS entityType,
           entity_id AS entityId, action, entity_revision AS entityRevision,
           metadata, created_at AS createdAt FROM activity_entries
  `).all() as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    id: String(row.id),
    workspaceId: scope.workspaceId,
    metadata: parseJson(String(row.metadata)),
  })) as CanonicalWorkspaceCollectionsV1['activityEntries'];
  return sortWorkspaceCollections({
    users: identity.users,
    workspaces: identity.workspaces,
    memberships: identity.memberships,
    teams: identity.teams,
    workflowStatuses,
    projects,
    projectResources,
    milestones,
    teamIssueSequences: [{
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
      nextNumber: String(nextNumber),
    }],
    labels,
    issues,
    issueResources,
    issueLabels,
    issueRelations,
    comments,
    savedViews,
    activityEntries,
  });
}

function snapshotWorkspace(
  db: OpenLinearDatabase,
  source: TransferSourceV1,
): CanonicalWorkspaceSnapshotV1 {
  const scope = databaseScope(db);
  const collections = workspaceCollections(db);
  return {
    workspaceId: scope.workspaceId,
    collections,
    digests: buildWorkspaceDigests(source.migrations, scope.workspaceId, collections),
  };
}

export async function createWorkspaceExport(
  db: OpenLinearDatabase,
  workspaceId: string,
  actorUserId: string,
  identity: TransferBuildIdentity = {},
): Promise<WorkspaceExportV1> {
  const scope = databaseScope(db);
  const owner = db.sqlite.prepare('SELECT id FROM owner_profile WHERE singleton = 1').get() as { id: string };
  if (scope.workspaceId !== workspaceId || owner.id !== actorUserId) {
    throw new TransferError('WORKSPACE_NOT_FOUND', 'The workspace is unavailable.');
  }
  const source = sourceManifest(db, identity);
  return {
    format: 'openlinear.workspace-export',
    version: 1,
    generatedAt: new Date().toISOString(),
    source,
    ...snapshotWorkspace(db, source),
  };
}

function sourceDocument(value: unknown, options: WorkspaceImportOptions): WorkspaceExportV1 {
  if (typeof value !== 'object' || value === null || !('format' in value)) {
    throw new TransferError('INVALID_EXPORT', 'A canonical workspace export or database backup is required.');
  }
  if (value.format === 'openlinear.workspace-export') {
    const document = parseWorkspaceExport(value);
    if (options.workspaceId !== undefined && options.workspaceId !== document.workspaceId) {
      throw new TransferError('SCOPE_NOT_FOUND', 'The selected workspace is not present in the export.');
    }
    return document;
  }
  if (value.format !== 'openlinear.database-backup') {
    throw new TransferError('UNSUPPORTED_EXPORT_VERSION', 'The canonical export format is unsupported.');
  }
  const backupDocument = parseDatabaseBackup(value);
  if (backupDocument.workspaces.length !== 1 && options.workspaceId === undefined) {
    throw new TransferError('AMBIGUOUS_SCOPE', 'Select one workspace before importing a multi-workspace backup.');
  }
  const snapshot = options.workspaceId === undefined
    ? backupDocument.workspaces[0]
    : backupDocument.workspaces.find((candidate) => candidate.workspaceId === options.workspaceId);
  if (snapshot === undefined) {
    throw new TransferError('SCOPE_NOT_FOUND', 'The selected workspace is not present in the backup.');
  }
  verifyWorkspaceSnapshot(snapshot, backupDocument.source.migrations);
  return {
    format: 'openlinear.workspace-export',
    version: 1,
    generatedAt: backupDocument.generatedAt,
    source: backupDocument.source,
    ...snapshot,
  };
}

function selectedTeamDocument(
  document: WorkspaceExportV1,
  options: WorkspaceImportOptions,
): WorkspaceExportV1 {
  const teams = document.collections.teams;
  if (teams.length !== 1 && options.teamId === undefined) {
    throw new TransferError('AMBIGUOUS_SCOPE', 'Select one team before importing a multi-team workspace.');
  }
  const team = options.teamId === undefined
    ? teams[0]
    : teams.find((candidate) => candidate.id === options.teamId);
  if (team === undefined) throw new TransferError('SCOPE_NOT_FOUND', 'The selected team is not present in the export.');
  if (teams.length === 1) return document;

  const c = document.collections;
  const projects = c.projects.filter((project) => project.teamId === team.id);
  const projectIds = new Set(projects.map((project) => project.id));
  const milestones = c.milestones.filter((milestone) => projectIds.has(milestone.projectId));
  const milestoneIds = new Set(milestones.map((milestone) => milestone.id));
  const issues = c.issues.filter((issue) => issue.teamId === team.id);
  const issueIds = new Set(issues.map((issue) => issue.id));
  const workflowStatuses = c.workflowStatuses.filter((status) => status.teamId === team.id);
  const statusIds = new Set(workflowStatuses.map((status) => status.id));
  const labelIds = new Set(c.labels.map((label) => label.id));
  const savedViewIds = new Set(c.savedViews.map((view) => view.id));
  const relationIds = new Set(c.issueRelations
    .filter((relation) => issueIds.has(relation.sourceIssueId) && issueIds.has(relation.targetIssueId))
    .map((relation) => relation.id));
  const commentIds = new Set(c.comments.filter((comment) => issueIds.has(comment.issueId))
    .map((comment) => comment.id));
  const entityIds = new Set<string>([
    document.workspaceId,
    ...c.users.map((user) => user.id),
    ...c.memberships.map((membership) => membership.id),
    team.id,
    ...statusIds,
    ...projectIds,
    ...milestoneIds,
    ...labelIds,
    ...issueIds,
    ...relationIds,
    ...commentIds,
    ...savedViewIds,
  ]);
  const collections = sortWorkspaceCollections({
    users: c.users,
    workspaces: c.workspaces,
    memberships: c.memberships,
    teams: [team],
    workflowStatuses,
    projects,
    projectResources: c.projectResources.filter((resource) => projectIds.has(resource.projectId)),
    milestones,
    teamIssueSequences: c.teamIssueSequences.filter((sequence) => sequence.teamId === team.id),
    labels: c.labels,
    issues,
    issueResources: c.issueResources.filter((resource) => issueIds.has(resource.issueId)),
    issueLabels: c.issueLabels.filter((link) => issueIds.has(link.issueId)),
    issueRelations: c.issueRelations.filter((relation) => relationIds.has(relation.id)),
    comments: c.comments.filter((comment) => commentIds.has(comment.id)),
    savedViews: c.savedViews,
    activityEntries: c.activityEntries.filter((entry) => entityIds.has(entry.entityId)),
  });
  const selected = {
    ...document,
    collections,
    digests: buildWorkspaceDigests(document.source.migrations, document.workspaceId, collections),
  };
  verifyWorkspaceSnapshot(selected, document.source.migrations);
  return selected;
}

function importOwner(
  collections: CanonicalWorkspaceCollectionsV1,
  options: WorkspaceImportOptions,
): { user: ExportUserV1; membership: ExportMembershipV1 } {
  const owners = collections.memberships.filter((membership) => membership.role === 'owner');
  const membership = options.ownerUserId === undefined
    ? (owners.length === 1 ? owners[0] : undefined)
    : owners.find((candidate) => candidate.userId === options.ownerUserId);
  if (membership === undefined) {
    throw new TransferError('AMBIGUOUS_OWNER', 'Select the one workspace owner to use for the local profile.');
  }
  const user = collections.users.find((candidate) => candidate.id === membership.userId);
  if (user === undefined || user.disabledAt !== null) {
    throw new TransferError('OWNER_UNAVAILABLE', 'The selected owner is missing or disabled.');
  }
  return { user, membership };
}

function clearDatabase(db: OpenLinearDatabase): void {
  const tables = [
    'idempotency_records',
    'activity_entries',
    'saved_views',
    'comments',
    'issue_relations',
    'issue_labels',
    'issue_resources',
    'issues',
    'labels',
    'issue_sequence',
    'milestones',
    'project_resources',
    'projects',
    'workflow_statuses',
    'transfer_metadata',
    'scope_metadata',
    'owner_profile',
  ];
  for (const table of tables) db.sqlite.exec(`DELETE FROM ${table}`);
  db.sqlite.exec("DELETE FROM sqlite_sequence WHERE name = 'activity_entries'");
}

function recordCount(collections: CanonicalWorkspaceCollectionsV1): number {
  return Object.values(collections).reduce((total, records) => total + records.length, 0);
}

async function importSelectedWorkspaceExport(
  db: OpenLinearDatabase,
  document: WorkspaceExportV1,
  options: WorkspaceImportOptions,
): Promise<WorkspaceImportResult> {
  const c = document.collections;
  const workspace = c.workspaces.find((candidate) => candidate.id === document.workspaceId);
  const team = c.teams[0];
  if (workspace === undefined || team === undefined) {
    throw new TransferError('INVALID_EXPORT', 'The selected scope metadata is incomplete.');
  }
  const owner = importOwner(c, options);
  const existing = db.sqlite.prepare('SELECT 1 AS present FROM owner_profile').get() !== undefined;
  if (existing && !options.replace) {
    throw new TransferError('TARGET_NOT_EMPTY', 'Import requires an empty target or explicit replacement.');
  }
  db.write(() => {
    if (existing) clearDatabase(db);
    db.sqlite.prepare(`
      INSERT INTO owner_profile (
        singleton, id, email, display_name, revision, disabled_at,
        created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      owner.user.id,
      owner.user.email,
      owner.user.displayName,
      owner.user.revision,
      owner.user.disabledAt,
      owner.user.createdAt,
      owner.user.updatedAt,
    );
    db.sqlite.prepare(`
      INSERT INTO scope_metadata (
        singleton, workspace_id, workspace_name, workspace_slug, membership_id,
        team_id, team_name, team_key, revision, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      workspace.id,
      workspace.name,
      workspace.slug,
      owner.membership.id,
      team.id,
      team.name,
      team.key,
      Math.max(workspace.revision, team.revision),
      workspace.createdAt < team.createdAt ? workspace.createdAt : team.createdAt,
      workspace.updatedAt > team.updatedAt ? workspace.updatedAt : team.updatedAt,
    );
    db.sqlite.prepare(`
      INSERT INTO transfer_metadata (
        singleton, source_migrations, source_product_version, source_build_id,
        users_json, workspaces_json, memberships_json, teams_json
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      JSON.stringify(document.source.migrations),
      document.source.productVersion,
      document.source.buildId,
      JSON.stringify(c.users),
      JSON.stringify(c.workspaces),
      JSON.stringify(c.memberships),
      JSON.stringify(c.teams),
    );
    const statusInsert = db.sqlite.prepare(`
      INSERT INTO workflow_statuses (
        id, name, category, color, position, is_default, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const status of c.workflowStatuses) statusInsert.run(
      status.id, status.name, status.category, status.color, status.position,
      status.isDefault ? 1 : 0, status.revision, status.createdAt, status.updatedAt,
    );
    const projectInsert = db.sqlite.prepare(`
      INSERT INTO projects (
        id, name, summary, status, priority, lead_user_id, start_date, target_date,
        icon, color, position, overview_document, revision, archived_at,
        archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const project of c.projects) projectInsert.run(
      project.id, project.name, project.summary, project.status, project.priority,
      project.leadUserId, project.startDate, project.targetDate, project.icon, project.color,
      project.position, JSON.stringify(project.overviewDocument), project.revision,
      project.archivedAt, project.archivedByUserId, project.createdAt, project.updatedAt,
    );
    const projectResourceInsert = db.sqlite.prepare(`
      INSERT INTO project_resources (id, project_id, label, url, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const resource of c.projectResources) projectResourceInsert.run(
      resource.id, resource.projectId, resource.label, resource.url, resource.position, resource.createdAt,
    );
    const milestoneInsert = db.sqlite.prepare(`
      INSERT INTO milestones (
        id, project_id, name, description, target_date, position, revision,
        archived_at, archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const milestone of c.milestones) milestoneInsert.run(
      milestone.id, milestone.projectId, milestone.name, milestone.description,
      milestone.targetDate, milestone.position, milestone.revision, milestone.archivedAt,
      milestone.archivedByUserId, milestone.createdAt, milestone.updatedAt,
    );
    const sequence = c.teamIssueSequences.find((candidate) => candidate.teamId === team.id);
    const fallbackSequence = c.issues.reduce((maximum, issue) =>
      Math.max(maximum, Number(issue.sequenceNumber) + 1), 1);
    db.sqlite.prepare('INSERT INTO issue_sequence (singleton, next_number) VALUES (1, ?)')
      .run(sequence === undefined ? fallbackSequence : Number(sequence.nextNumber));
    const labelInsert = db.sqlite.prepare(`
      INSERT INTO labels (
        id, name, color, revision, archived_at, archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const label of c.labels) labelInsert.run(
      label.id, label.name, label.color, label.revision, label.archivedAt,
      label.archivedByUserId, label.createdAt, label.updatedAt,
    );
    const issueInsert = db.sqlite.prepare(`
      INSERT INTO issues (
        id, sequence_number, identifier, title, description_document, status_id, priority,
        assignee_user_id, due_date, project_id, milestone_id, revision, archived_at,
        archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const issue of c.issues) issueInsert.run(
      issue.id, Number(issue.sequenceNumber), issue.identifier, issue.title,
      JSON.stringify(issue.descriptionDocument), issue.statusId, issue.priority,
      issue.assigneeUserId, issue.dueDate, issue.projectId, issue.milestoneId,
      issue.revision, issue.archivedAt, issue.archivedByUserId, issue.createdAt, issue.updatedAt,
    );
    const issueResourceInsert = db.sqlite.prepare(`
      INSERT INTO issue_resources (id, issue_id, label, url, position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const resource of c.issueResources) issueResourceInsert.run(
      resource.id, resource.issueId, resource.label, resource.url, resource.position, resource.createdAt,
    );
    const issueLabelInsert = db.sqlite.prepare(`
      INSERT INTO issue_labels (issue_id, label_id, position, created_at) VALUES (?, ?, ?, ?)
    `);
    for (const link of c.issueLabels) issueLabelInsert.run(
      link.issueId, link.labelId, link.position, link.createdAt,
    );
    const relationInsert = db.sqlite.prepare(`
      INSERT INTO issue_relations (
        id, source_issue_id, target_issue_id, relation_type, revision,
        created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const relation of c.issueRelations) relationInsert.run(
      relation.id, relation.sourceIssueId, relation.targetIssueId, relation.relationType,
      relation.revision, relation.createdByUserId, relation.createdAt, relation.updatedAt,
    );
    const commentInsert = db.sqlite.prepare(`
      INSERT INTO comments (
        id, issue_id, author_user_id, body_document, revision, archived_at,
        archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const comment of c.comments) commentInsert.run(
      comment.id, comment.issueId, comment.authorUserId, JSON.stringify(comment.bodyDocument),
      comment.revision, comment.archivedAt, comment.archivedByUserId,
      comment.createdAt, comment.updatedAt,
    );
    const viewInsert = db.sqlite.prepare(`
      INSERT INTO saved_views (
        id, owner_user_id, name, sharing_scope, state, revision, archived_at,
        archived_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const view of c.savedViews) viewInsert.run(
      view.id, view.ownerUserId, view.name, view.sharingScope, JSON.stringify(view.state), view.revision,
      view.archivedAt, view.archivedByUserId, view.createdAt, view.updatedAt,
    );
    const activityInsert = db.sqlite.prepare(`
      INSERT INTO activity_entries (
        id, actor_user_id, entity_type, entity_id, action, entity_revision, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const activity of c.activityEntries) activityInsert.run(
      Number(activity.id), activity.actorUserId, activity.entityType, activity.entityId,
      activity.action, activity.entityRevision, JSON.stringify(activity.metadata), activity.createdAt,
    );
    const source = sourceManifest(db, {});
    const readback = snapshotWorkspace(db, source);
    if (readback.digests.canonical !== document.digests.canonical) {
      throw new TransferError('ROUND_TRIP_MISMATCH', 'Imported workspace digest does not match the selected source.');
    }
    const violations = db.sqlite.prepare('PRAGMA foreign_key_check').all();
    const integrity = db.sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check?: string };
    if (violations.length !== 0 || integrity.integrity_check !== 'ok') {
      throw new TransferError('IMPORT_INTEGRITY_FAILED', 'The imported SQLite database failed integrity checks.');
    }
  });
  return {
    workspaceId: document.workspaceId,
    teamId: team.id,
    ownerUserId: owner.user.id,
    canonicalDigest: document.digests.canonical,
    importedRecords: recordCount(c),
    credentialRecoveryRequired: 0,
    replaced: existing,
  };
}

export async function importWorkspaceExport(
  db: OpenLinearDatabase,
  value: unknown,
  options: WorkspaceImportOptions,
): Promise<WorkspaceImportResult> {
  const document = selectedTeamDocument(sourceDocument(value, options), options);
  return importSelectedWorkspaceExport(db, document, options);
}

function ensureRegularOrAbsent(path: string, allowExisting: boolean): void {
  if (!existsSync(path)) return;
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new TransferError('OUTPUT_UNSAFE', 'The database target must be a regular file.');
  }
  if (!allowExisting) throw new TransferError('OUTPUT_EXISTS', 'The database target already exists.');
}

function temporaryPath(target: string): string {
  return join(dirname(target), `.${basename(target)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`);
}

function syncDirectory(path: string): void {
  let descriptor: number;
  try {
    descriptor = openSync(dirname(path), fsConstants.O_RDONLY);
  } catch (error) {
    if (isErrno(error, ['EISDIR', 'EPERM', 'EINVAL', 'ENOTSUP'])) return;
    throw error;
  }
  try {
    fsyncSync(descriptor);
  } catch (error) {
    if (!isErrno(error, ['EISDIR', 'EPERM', 'EINVAL', 'ENOTSUP'])) throw error;
  } finally {
    closeSync(descriptor);
  }
}

function syncFile(path: string): void {
  const descriptor = openSync(path, fsConstants.O_RDONLY);
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function isErrno(error: unknown, codes: readonly string[]): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && typeof error.code === 'string' && codes.includes(error.code);
}

function removeIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'ENOENT') throw error;
  }
}

function removeDatabaseSidecars(path: string): void {
  removeIfPresent(`${path}-shm`);
  removeIfPresent(`${path}-wal`);
}

function finalizeStandaloneDatabase(path: string): void {
  let sqlite: DatabaseSync | undefined;
  try {
    sqlite = new DatabaseSync(path, {
      allowExtension: false,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      timeout: 2_000,
    });
    sqlite.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const journal = sqlite.prepare('PRAGMA journal_mode = DELETE').get() as { journal_mode?: string };
    if (journal.journal_mode !== 'delete') {
      throw new TransferError('DATABASE_CORRUPT', 'The SQLite database could not be finalized safely.');
    }
  } finally {
    sqlite?.close();
  }
  removeDatabaseSidecars(path);
}

export async function importWorkspaceExportFile(
  value: unknown,
  targetPath: string,
  options: WorkspaceImportOptions,
): Promise<WorkspaceImportResult> {
  const document = selectedTeamDocument(sourceDocument(value, options), options);
  const target = resolve(targetPath);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  ensureRegularOrAbsent(target, options.replace === true);
  const temporary = temporaryPath(target);
  let db: OpenLinearDatabase | undefined;
  try {
    db = createDatabase(temporary);
    const result = await importSelectedWorkspaceExport(db, document, { ...options, replace: false });
    db.close();
    db = undefined;
    finalizeStandaloneDatabase(temporary);
    verifyDatabaseFile(temporary);
    chmodSync(temporary, 0o600);
    syncFile(temporary);
    renameSync(temporary, target);
    syncDirectory(target);
    return result;
  } catch (error) {
    db?.close();
    removeIfPresent(temporary);
    removeDatabaseSidecars(temporary);
    throw error;
  }
}

export function verifyDatabaseFile(path: string): DatabaseFileHealth {
  const resolved = resolve(path);
  ensureRegularOrAbsent(resolved, true);
  if (!existsSync(resolved)) throw new TransferError('INPUT_UNAVAILABLE', 'The database file is unavailable.');
  let sqlite: DatabaseSync;
  try {
    sqlite = new DatabaseSync(resolved, {
      allowExtension: false,
      defensive: true,
      enableDoubleQuotedStringLiterals: false,
      enableForeignKeyConstraints: true,
      readOnly: true,
      timeout: 2_000,
    });
  } catch {
    throw new TransferError('DATABASE_CORRUPT', 'The SQLite database could not be opened safely.');
  }
  try {
    const integrity = sqlite.prepare('PRAGMA integrity_check').get() as { integrity_check?: string };
    const version = sqlite.prepare('PRAGMA user_version').get() as { user_version?: number };
    const violations = sqlite.prepare('PRAGMA foreign_key_check').all();
    if (integrity.integrity_check !== 'ok') {
      throw new TransferError('DATABASE_CORRUPT', 'The SQLite integrity check failed.');
    }
    if (Number(version.user_version) !== databaseSchemaVersion()) {
      throw new TransferError('SCHEMA_INCOMPATIBLE', 'The SQLite schema version is unsupported.');
    }
    if (violations.length !== 0) {
      throw new TransferError('DATABASE_CORRUPT', 'The SQLite foreign-key check failed.');
    }
    return {
      path: resolved,
      schemaVersion: Number(version.user_version),
      integrity: 'ok',
      foreignKeyViolations: 0,
    };
  } catch (error) {
    if (error instanceof TransferError) throw error;
    throw new TransferError('DATABASE_CORRUPT', 'The SQLite database could not be verified safely.');
  } finally {
    sqlite.close();
  }
}

export async function createOnlineBackup(
  db: OpenLinearDatabase,
  targetPath: string,
  overwrite = false,
): Promise<DatabaseFileHealth & { pages: number; sha256: string }> {
  const target = resolve(targetPath);
  if (db.path !== ':memory:' && resolve(db.path) === target) {
    throw new TransferError('OUTPUT_UNSAFE', 'The backup path must differ from the active database path.');
  }
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  ensureRegularOrAbsent(target, overwrite);
  const temporary = temporaryPath(target);
  try {
    const pages = await backup(db.sqlite, temporary, { rate: 100 });
    finalizeStandaloneDatabase(temporary);
    chmodSync(temporary, 0o600);
    const health = verifyDatabaseFile(temporary);
    const digest = createHash('sha256').update(readFileSync(temporary)).digest('hex');
    syncFile(temporary);
    renameSync(temporary, target);
    syncDirectory(target);
    return { ...health, path: target, pages, sha256: digest };
  } catch (error) {
    removeIfPresent(temporary);
    removeDatabaseSidecars(temporary);
    throw error;
  }
}

export function restoreDatabaseFile(
  backupPath: string,
  targetPath: string,
  replace = false,
): DatabaseFileHealth {
  const source = resolve(backupPath);
  const target = resolve(targetPath);
  verifyDatabaseFile(source);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  ensureRegularOrAbsent(target, replace);
  const temporary = temporaryPath(target);
  try {
    copyFileSync(source, temporary, fsConstants.COPYFILE_EXCL);
    chmodSync(temporary, 0o600);
    verifyDatabaseFile(temporary);
    syncFile(temporary);
    renameSync(temporary, target);
    syncDirectory(target);
    return verifyDatabaseFile(target);
  } catch (error) {
    removeIfPresent(temporary);
    throw error;
  }
}

export function countWorkspaceExportRecords(value: unknown): number {
  return recordCount(parseWorkspaceExport(value).collections);
}

export function verifyWorkspaceExport(value: unknown): WorkspaceExportV1 {
  return parseWorkspaceExport(value);
}

export function verifyDatabaseBackup(value: unknown): DatabaseBackupV1 {
  return parseDatabaseBackup(value);
}
