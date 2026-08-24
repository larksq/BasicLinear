import { randomUUID } from 'node:crypto';
import {
  AppError,
  assertUniqueOrder,
  normalizeColor,
  normalizeDate,
  normalizeIssueDocument,
  normalizeName,
  normalizeText,
  parseProjectIcon,
  parseProjectPriority,
  parseProjectStatus,
} from '@openlinear/domain';
import type {
  DbActivityEntry,
  DbMilestone,
  DbProgressSnapshot,
  DbProject,
  DbProjectIcon,
  DbProjectPriority,
  DbProjectStatus,
  DbPurgeMilestoneReceipt,
  DbPurgeProjectReceipt,
  DbRichTextDocument,
} from '../types.js';
import type { OpenLinearDatabase } from './client.js';
import {
  changed,
  compactChanges,
  emptyDocument,
  idempotentEntity,
  json,
  listActivity,
  normalizeResources,
  now,
  progressFor,
  readResources,
  recordActivity,
  rememberIdempotency,
  replaceResources,
  requireActive,
  requireOwnerScope,
  requireOwnerUser,
  requireRevision,
  requireTeam,
} from './helpers.js';

export interface ProjectResourceInput {
  label: string;
  url: string;
}

export interface ProjectListInput {
  query?: string;
  teamId?: string;
  status?: DbProjectStatus;
  priority?: DbProjectPriority;
  leadUserId?: string;
  archiveState?: 'active' | 'archived' | 'all';
  order?: 'position' | 'name' | 'targetDate' | 'updatedAt';
  direction?: 'asc' | 'desc';
}

export interface CreateProjectInput {
  teamId: string;
  name: string;
  summary?: string;
  status?: DbProjectStatus;
  priority?: DbProjectPriority;
  leadUserId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  icon?: DbProjectIcon;
  color?: string;
  overviewDocument?: unknown;
  resources?: ProjectResourceInput[];
  idempotencyKey: string;
}

export interface UpdateProjectInput {
  expectedRevision: number;
  teamId?: string;
  name?: string;
  summary?: string;
  status?: DbProjectStatus;
  priority?: DbProjectPriority;
  leadUserId?: string | null;
  startDate?: string | null;
  targetDate?: string | null;
  icon?: DbProjectIcon;
  color?: string;
  overviewDocument?: unknown;
  resources?: ProjectResourceInput[];
}

export interface CreateMilestoneInput {
  name: string;
  description?: string;
  targetDate?: string | null;
  idempotencyKey: string;
}

export interface UpdateMilestoneInput {
  expectedRevision: number;
  name?: string;
  description?: string;
  targetDate?: string | null;
}

interface ProjectRow {
  id: string;
  name: string;
  summary: string;
  status: DbProjectStatus;
  priority: DbProjectPriority;
  leadUserId: string | null;
  startDate: string | null;
  targetDate: string | null;
  icon: DbProjectIcon;
  color: string;
  position: number;
  overviewDocument: string;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MilestoneRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  position: number;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const projectSelection = `
  id, name, summary, status, priority, lead_user_id AS leadUserId,
  start_date AS startDate, target_date AS targetDate, icon, color, position,
  overview_document AS overviewDocument, revision, archived_at AS archivedAt,
  created_at AS createdAt, updated_at AS updatedAt
`;

const milestoneSelection = `
  id, project_id AS projectId, name, description, target_date AS targetDate,
  position, revision, archived_at AS archivedAt, created_at AS createdAt,
  updated_at AS updatedAt
`;

function scope(db: OpenLinearDatabase): { workspaceId: string; teamId: string } {
  return db.sqlite.prepare(`
    SELECT workspace_id AS workspaceId, team_id AS teamId FROM scope_metadata WHERE singleton = 1
  `).get() as { workspaceId: string; teamId: string };
}

function validateDateOrder(startDate: string | null, targetDate: string | null): void {
  if (startDate !== null && targetDate !== null && startDate > targetDate) {
    throw new AppError('VALIDATION_ERROR', 'Target date cannot be before the start date.', 400, {
      field: 'targetDate',
    });
  }
}

function emptyProgress(): DbProgressSnapshot {
  return {
    policy: 'project-progress-v1',
    issueCount: 0,
    completedCount: 0,
    canceledCount: 0,
    eligibleCount: 0,
    fraction: 0,
  };
}

function progressMaps(db: OpenLinearDatabase): {
  projects: Map<string, DbProgressSnapshot>;
  milestones: Map<string, DbProgressSnapshot>;
} {
  const rows = db.sqlite.prepare(`
    SELECT i.project_id AS projectId, i.milestone_id AS milestoneId, s.category
    FROM issues i JOIN workflow_statuses s ON s.id = i.status_id
    WHERE i.archived_at IS NULL AND i.project_id IS NOT NULL
  `).all() as Array<{
    projectId: string;
    milestoneId: string | null;
    category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  }>;
  const categories = new Map<string, Array<typeof rows[number]['category']>>();
  const milestoneCategories = new Map<string, Array<typeof rows[number]['category']>>();
  for (const row of rows) {
    const projectValues = categories.get(row.projectId) ?? [];
    projectValues.push(row.category);
    categories.set(row.projectId, projectValues);
    if (row.milestoneId !== null) {
      const milestoneValues = milestoneCategories.get(row.milestoneId) ?? [];
      milestoneValues.push(row.category);
      milestoneCategories.set(row.milestoneId, milestoneValues);
    }
  }
  const derive = (values: readonly typeof rows[number]['category'][]): DbProgressSnapshot => {
    const completedCount = values.filter((value) => value === 'completed').length;
    const canceledCount = values.filter((value) => value === 'canceled').length;
    const eligibleCount = values.length - canceledCount;
    return {
      policy: 'project-progress-v1',
      issueCount: values.length,
      completedCount,
      canceledCount,
      eligibleCount,
      fraction: eligibleCount === 0 ? 0 : completedCount / eligibleCount,
    };
  };
  return {
    projects: new Map([...categories].map(([id, values]) => [id, derive(values)])),
    milestones: new Map([...milestoneCategories].map(([id, values]) => [id, derive(values)])),
  };
}

function resourcesForAllProjects(
  db: OpenLinearDatabase,
): Map<string, Array<{ id: string; label: string; url: string; position: number }>> {
  const rows = db.sqlite.prepare(`
    SELECT project_id AS projectId, id, label, url, position
    FROM project_resources ORDER BY project_id, position, id
  `).all() as Array<{ projectId: string; id: string; label: string; url: string; position: number }>;
  const grouped = new Map<string, Array<{ id: string; label: string; url: string; position: number }>>();
  for (const row of rows) {
    const current = grouped.get(row.projectId) ?? [];
    current.push({ id: row.id, label: row.label, url: row.url, position: row.position });
    grouped.set(row.projectId, current);
  }
  return grouped;
}

function mapProject(
  db: OpenLinearDatabase,
  row: ProjectRow,
  resources = readResources(db, 'project_resources', 'project_id', row.id),
  progress = progressFor(db, 'project_id', row.id),
): DbProject {
  const metadata = scope(db);
  return {
    id: row.id,
    workspaceId: metadata.workspaceId,
    teamId: metadata.teamId,
    name: row.name,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    leadUserId: row.leadUserId,
    startDate: row.startDate,
    targetDate: row.targetDate,
    icon: row.icon,
    color: row.color,
    position: row.position,
    overviewDocument: json<DbRichTextDocument>(row.overviewDocument),
    resources,
    progress,
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function projectById(db: OpenLinearDatabase, projectId: string): DbProject {
  const row = db.sqlite.prepare(`SELECT ${projectSelection} FROM projects WHERE id = ?`)
    .get(projectId) as ProjectRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Project not found.', 404);
  return mapProject(db, row);
}

function mapMilestone(
  db: OpenLinearDatabase,
  row: MilestoneRow,
  progress = progressFor(db, 'milestone_id', row.id),
): DbMilestone {
  return {
    id: row.id,
    workspaceId: scope(db).workspaceId,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    targetDate: row.targetDate,
    position: row.position,
    progress,
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function milestoneById(
  db: OpenLinearDatabase,
  projectId: string,
  milestoneId: string,
): DbMilestone {
  const row = db.sqlite.prepare(`
    SELECT ${milestoneSelection} FROM milestones WHERE id = ? AND project_id = ?
  `).get(milestoneId, projectId) as MilestoneRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Milestone not found.', 404);
  return mapMilestone(db, row);
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right, 'en');
}

export async function listProjects(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: ProjectListInput = {},
): Promise<DbProject[]> {
  const metadata = requireOwnerScope(db, userId, workspaceId);
  if (input.teamId !== undefined && input.teamId !== metadata.teamId) return [];
  const query = input.query?.trim().toLocaleLowerCase('en') ?? '';
  const archiveState = input.archiveState ?? 'active';
  const resourceMap = resourcesForAllProjects(db);
  const progress = progressMaps(db).projects;
  let values = (db.sqlite.prepare(`SELECT ${projectSelection} FROM projects`).all() as unknown as ProjectRow[])
    .map((row) => mapProject(
      db,
      row,
      resourceMap.get(row.id) ?? [],
      progress.get(row.id) ?? emptyProgress(),
    ))
    .filter((project) => archiveState === 'all'
      || (archiveState === 'archived' ? project.archivedAt !== null : project.archivedAt === null))
    .filter((project) => input.status === undefined || project.status === input.status)
    .filter((project) => input.priority === undefined || project.priority === input.priority)
    .filter((project) => input.leadUserId === undefined || project.leadUserId === input.leadUserId)
    .filter((project) => query === ''
      || project.name.toLocaleLowerCase('en').includes(query)
      || project.summary.toLocaleLowerCase('en').includes(query));
  const order = input.order ?? 'position';
  const direction = input.direction ?? 'asc';
  values = values.sort((left, right) => {
    let result: number;
    if (order === 'position') result = left.position - right.position;
    else if (order === 'name') result = left.name.localeCompare(right.name, 'en', { sensitivity: 'base' });
    else if (order === 'targetDate') {
      if (left.targetDate === null || right.targetDate === null) {
        return compareNullable(left.targetDate, right.targetDate) || left.id.localeCompare(right.id, 'en');
      }
      result = left.targetDate.localeCompare(right.targetDate, 'en');
    }
    else result = left.updatedAt.localeCompare(right.updatedAt, 'en');
    return (direction === 'desc' ? -result : result) || left.id.localeCompare(right.id, 'en');
  });
  return values;
}

export async function getProject(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<DbProject> {
  requireOwnerScope(db, userId, workspaceId);
  return projectById(db, projectId);
}

export async function createProject(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: CreateProjectInput,
): Promise<DbProject> {
  requireOwnerScope(db, userId, workspaceId);
  requireTeam(db, input.teamId);
  requireOwnerUser(db, input.leadUserId ?? null, 'leadUserId');
  return db.write(() => {
    const existing = idempotentEntity(db, userId, 'project.create', input.idempotencyKey);
    if (existing !== undefined) return projectById(db, existing);
    const startDate = normalizeDate(input.startDate ?? null, 'startDate');
    const targetDate = normalizeDate(input.targetDate ?? null, 'targetDate');
    validateDateOrder(startDate, targetDate);
    const resources = normalizeResources(input.resources ?? []);
    const row = db.sqlite.prepare('SELECT coalesce(max(position), 0) + 100 AS position FROM projects')
      .get() as { position: number };
    const projectId = randomUUID();
    const timestamp = now();
    const fields = {
      name: normalizeName(input.name),
      summary: normalizeText(input.summary ?? '', 280, 'summary'),
      status: parseProjectStatus(input.status ?? 'planned'),
      priority: parseProjectPriority(input.priority ?? 'none'),
      leadUserId: input.leadUserId ?? null,
      icon: parseProjectIcon(input.icon ?? 'layers'),
      color: normalizeColor(input.color ?? '#5E6AD2'),
      overviewDocument: normalizeIssueDocument(input.overviewDocument ?? emptyDocument, 'overviewDocument'),
    };
    db.sqlite.prepare(`
      INSERT INTO projects (
        id, name, summary, status, priority, lead_user_id, start_date, target_date,
        icon, color, position, overview_document, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      projectId,
      fields.name,
      fields.summary,
      fields.status,
      fields.priority,
      fields.leadUserId,
      startDate,
      targetDate,
      fields.icon,
      fields.color,
      row.position,
      JSON.stringify(fields.overviewDocument),
      timestamp,
      timestamp,
    );
    replaceResources(db, 'project_resources', 'project_id', projectId, resources, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.created',
      entityRevision: 1,
      fields: compactChanges([
        changed('name', null, fields.name),
        changed('status', null, fields.status),
        changed('priority', null, fields.priority),
      ]),
    });
    rememberIdempotency(db, {
      userId,
      operation: 'project.create',
      key: input.idempotencyKey,
      entityId: projectId,
      revision: 1,
    });
    return projectById(db, projectId);
  });
}

export async function updateProject(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<DbProject> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = projectById(db, projectId);
    requireActive(current.archivedAt, current.revision, 'project');
    requireRevision(input.expectedRevision, current.revision);
    if (input.teamId !== undefined) requireTeam(db, input.teamId);
    if (input.leadUserId !== undefined) requireOwnerUser(db, input.leadUserId, 'leadUserId');
    const startDate = input.startDate === undefined
      ? current.startDate
      : normalizeDate(input.startDate, 'startDate');
    const targetDate = input.targetDate === undefined
      ? current.targetDate
      : normalizeDate(input.targetDate, 'targetDate');
    validateDateOrder(startDate, targetDate);
    const resources = input.resources === undefined
      ? current.resources.map(({ label, url }) => ({ label, url }))
      : normalizeResources(input.resources);
    const next = {
      name: input.name === undefined ? current.name : normalizeName(input.name),
      summary: input.summary === undefined ? current.summary : normalizeText(input.summary, 280, 'summary'),
      status: input.status === undefined ? current.status : parseProjectStatus(input.status),
      priority: input.priority === undefined ? current.priority : parseProjectPriority(input.priority),
      leadUserId: input.leadUserId === undefined ? current.leadUserId : input.leadUserId,
      startDate,
      targetDate,
      icon: input.icon === undefined ? current.icon : parseProjectIcon(input.icon),
      color: input.color === undefined ? current.color : normalizeColor(input.color),
      overviewDocument: input.overviewDocument === undefined
        ? current.overviewDocument
        : normalizeIssueDocument(input.overviewDocument, 'overviewDocument'),
      resources,
    };
    const currentResources = current.resources.map(({ label, url }) => ({ label, url }));
    const fields = compactChanges([
      changed('name', current.name, next.name),
      changed('summary', current.summary, next.summary),
      changed('status', current.status, next.status),
      changed('priority', current.priority, next.priority),
      changed('leadUserId', current.leadUserId, next.leadUserId),
      changed('startDate', current.startDate, next.startDate),
      changed('targetDate', current.targetDate, next.targetDate),
      changed('icon', current.icon, next.icon),
      changed('color', current.color, next.color),
      changed('overviewDocument', current.overviewDocument, next.overviewDocument),
      changed('resources', currentResources, next.resources),
    ]);
    if (fields.length === 0) throw new AppError('VALIDATION_ERROR', 'No project changes to save.', 400);
    const revision = current.revision + 1;
    const timestamp = now();
    db.sqlite.prepare(`
      UPDATE projects SET name = ?, summary = ?, status = ?, priority = ?, lead_user_id = ?,
        start_date = ?, target_date = ?, icon = ?, color = ?, overview_document = ?,
        revision = ?, updated_at = ? WHERE id = ? AND revision = ?
    `).run(
      next.name,
      next.summary,
      next.status,
      next.priority,
      next.leadUserId,
      next.startDate,
      next.targetDate,
      next.icon,
      next.color,
      JSON.stringify(next.overviewDocument),
      revision,
      timestamp,
      projectId,
      current.revision,
    );
    if (input.resources !== undefined) {
      replaceResources(db, 'project_resources', 'project_id', projectId, next.resources, timestamp);
    }
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.updated',
      entityRevision: revision,
      fields,
    });
    return projectById(db, projectId);
  });
}

function setProjectArchive(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  expectedRevision: number,
  archive: boolean,
): DbProject {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = projectById(db, projectId);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('CONFLICT', archive
        ? 'This project is already archived.'
        : 'This project is already active.', 409, { currentRevision: current.revision });
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE projects SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(archivedAt, archive ? userId : null, revision, now(), projectId, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'project',
      entityId: projectId,
      action: archive ? 'project.archived' : 'project.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return projectById(db, projectId);
  });
}

export const archiveProject = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  expectedRevision: number,
) => Promise.resolve(setProjectArchive(db, userId, workspaceId, projectId, expectedRevision, true));

export const restoreProject = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  expectedRevision: number,
) => Promise.resolve(setProjectArchive(db, userId, workspaceId, projectId, expectedRevision, false));

export async function purgeProject(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  input: { expectedRevision: number; confirmation: string },
): Promise<DbPurgeProjectReceipt> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = projectById(db, projectId);
    requireRevision(input.expectedRevision, current.revision);
    if (current.archivedAt === null) {
      throw new AppError('VALIDATION_ERROR', 'Archive this project before purging it.', 400);
    }
    if (input.confirmation !== current.name) {
      throw new AppError('VALIDATION_ERROR', `Type ${current.name} to confirm purge.`, 400, {
        field: 'confirmation',
      });
    }

    const milestones = db.sqlite.prepare(
      'SELECT id FROM milestones WHERE project_id = ? ORDER BY id',
    ).all(projectId) as Array<{ id: string }>;
    const issues = db.sqlite.prepare(`
      SELECT id, revision, project_id AS projectId, milestone_id AS milestoneId
      FROM issues
      WHERE project_id = ? OR milestone_id IN (
        SELECT id FROM milestones WHERE project_id = ?
      )
      ORDER BY id
    `).all(projectId, projectId) as Array<{
      id: string;
      revision: number;
      projectId: string | null;
      milestoneId: string | null;
    }>;
    const purgedAt = now();
    const detach = db.sqlite.prepare(`
      UPDATE issues
      SET project_id = NULL, milestone_id = NULL, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `);
    for (const issue of issues) {
      const revision = issue.revision + 1;
      detach.run(revision, purgedAt, issue.id, issue.revision);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'issue',
        entityId: issue.id,
        action: 'issue.updated',
        entityRevision: revision,
        fields: compactChanges([
          changed('projectId', issue.projectId, null),
          changed('milestoneId', issue.milestoneId, null),
        ]),
        createdAt: purgedAt,
      });
    }
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'project',
      entityId: projectId,
      action: 'project.purged',
      entityRevision: current.revision + 1,
      fields: [
        { field: 'purgedAt', before: null, after: purgedAt },
        { field: 'detachedIssueCount', before: 0, after: issues.length },
        { field: 'removedMilestoneCount', before: 0, after: milestones.length },
      ],
      createdAt: purgedAt,
    });
    db.sqlite.prepare(`
      DELETE FROM idempotency_records
      WHERE entity_id = ? OR entity_id IN (
        SELECT id FROM milestones WHERE project_id = ?
      )
    `).run(projectId, projectId);
    db.sqlite.prepare('DELETE FROM projects WHERE id = ? AND revision = ?')
      .run(projectId, current.revision);
    return {
      id: projectId,
      name: current.name,
      detachedIssueCount: issues.length,
      removedMilestoneCount: milestones.length,
      purgedAt,
    };
  });
}

export async function reorderProjects(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  items: readonly { id: string; expectedRevision: number }[],
): Promise<DbProject[]> {
  requireOwnerScope(db, userId, workspaceId);
  assertUniqueOrder(items);
  db.write(() => {
    const rows = db.sqlite.prepare(`
      SELECT id, position, revision FROM projects WHERE archived_at IS NULL ORDER BY position, id
    `).all() as Array<{ id: string; position: number; revision: number }>;
    const byId = new Map(rows.map((row) => [row.id, row]));
    if (rows.length !== items.length || items.some((item) => !byId.has(item.id))) {
      throw new AppError('VALIDATION_ERROR', 'Order every active project exactly once.', 400, {
        field: 'items',
      });
    }
    for (const item of items) requireRevision(item.expectedRevision, byId.get(item.id)!.revision);
    if (items.every((item, index) => item.id === rows[index]?.id)) {
      throw new AppError('VALIDATION_ERROR', 'Project order is unchanged.', 400, { field: 'items' });
    }
    const update = db.sqlite.prepare(`
      UPDATE projects SET position = ?, revision = revision + 1, updated_at = ? WHERE id = ?
    `);
    items.forEach((item, index) => {
      const before = byId.get(item.id)!;
      const position = (index + 1) * 100;
      update.run(position, now(), item.id);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'project',
        entityId: item.id,
        action: 'project.reordered',
        entityRevision: before.revision + 1,
        fields: [{ field: 'position', before: before.position, after: position }],
      });
    });
  });
  return listProjects(db, userId, workspaceId);
}

export async function listMilestones(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  includeArchived = false,
): Promise<DbMilestone[]> {
  requireOwnerScope(db, userId, workspaceId);
  projectById(db, projectId);
  const progress = progressMaps(db).milestones;
  return (db.sqlite.prepare(`
    SELECT ${milestoneSelection} FROM milestones WHERE project_id = ?
    ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY position, id
  `).all(projectId) as unknown as MilestoneRow[]).map((row) =>
    mapMilestone(db, row, progress.get(row.id) ?? emptyProgress()));
}

export async function listWorkspaceMilestones(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  includeArchived = false,
): Promise<DbMilestone[]> {
  requireOwnerScope(db, userId, workspaceId);
  const progress = progressMaps(db).milestones;
  return (db.sqlite.prepare(`
    SELECT ${milestoneSelection} FROM milestones
    ${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY project_id, position, id
  `).all() as unknown as MilestoneRow[]).map((row) =>
    mapMilestone(db, row, progress.get(row.id) ?? emptyProgress()));
}

export async function createMilestone(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  input: CreateMilestoneInput,
): Promise<DbMilestone> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const project = projectById(db, projectId);
    requireActive(project.archivedAt, project.revision, 'project');
    const existing = idempotentEntity(db, userId, 'milestone.create', input.idempotencyKey);
    if (existing !== undefined) return milestoneById(db, projectId, existing);
    const position = Number((db.sqlite.prepare(`
      SELECT coalesce(max(position), 0) + 100 AS position FROM milestones WHERE project_id = ?
    `).get(projectId) as { position: number }).position);
    const id = randomUUID();
    const timestamp = now();
    const name = normalizeName(input.name);
    const description = normalizeText(input.description ?? '', 4000, 'description');
    const targetDate = normalizeDate(input.targetDate ?? null, 'targetDate');
    db.sqlite.prepare(`
      INSERT INTO milestones
        (id, project_id, name, description, target_date, position, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, projectId, name, description, targetDate, position, timestamp, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'milestone',
      entityId: id,
      action: 'milestone.created',
      entityRevision: 1,
      fields: compactChanges([
        changed('projectId', null, projectId),
        changed('name', null, name),
        changed('targetDate', null, targetDate),
      ]),
    });
    rememberIdempotency(db, {
      userId,
      operation: 'milestone.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return milestoneById(db, projectId, id);
  });
}

export async function updateMilestone(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
): Promise<DbMilestone> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = milestoneById(db, projectId, milestoneId);
    requireActive(current.archivedAt, current.revision, 'milestone');
    requireRevision(input.expectedRevision, current.revision);
    const next = {
      name: input.name === undefined ? current.name : normalizeName(input.name),
      description: input.description === undefined
        ? current.description
        : normalizeText(input.description, 4000, 'description'),
      targetDate: input.targetDate === undefined
        ? current.targetDate
        : normalizeDate(input.targetDate, 'targetDate'),
    };
    const fields = compactChanges([
      changed('name', current.name, next.name),
      changed('description', current.description, next.description),
      changed('targetDate', current.targetDate, next.targetDate),
    ]);
    if (fields.length === 0) throw new AppError('VALIDATION_ERROR', 'No milestone changes to save.', 400);
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE milestones SET name = ?, description = ?, target_date = ?, revision = ?, updated_at = ?
      WHERE id = ? AND project_id = ? AND revision = ?
    `).run(
      next.name,
      next.description,
      next.targetDate,
      revision,
      now(),
      milestoneId,
      projectId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'milestone',
      entityId: milestoneId,
      action: 'milestone.updated',
      entityRevision: revision,
      fields,
    });
    return milestoneById(db, projectId, milestoneId);
  });
}

function setMilestoneArchive(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  expectedRevision: number,
  archive: boolean,
): DbMilestone {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = milestoneById(db, projectId, milestoneId);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('CONFLICT', archive
        ? 'This milestone is already archived.'
        : 'This milestone is already active.', 409, { currentRevision: current.revision });
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE milestones SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND project_id = ? AND revision = ?
    `).run(
      archivedAt,
      archive ? userId : null,
      revision,
      now(),
      milestoneId,
      projectId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'milestone',
      entityId: milestoneId,
      action: archive ? 'milestone.archived' : 'milestone.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return milestoneById(db, projectId, milestoneId);
  });
}

export const archiveMilestone = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  expectedRevision: number,
) => Promise.resolve(setMilestoneArchive(
  db, userId, workspaceId, projectId, milestoneId, expectedRevision, true,
));

export const restoreMilestone = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  expectedRevision: number,
) => Promise.resolve(setMilestoneArchive(
  db, userId, workspaceId, projectId, milestoneId, expectedRevision, false,
));

export async function purgeMilestone(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  milestoneId: string,
  input: { expectedRevision: number; confirmation: string },
): Promise<DbPurgeMilestoneReceipt> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const project = projectById(db, projectId);
    const current = milestoneById(db, projectId, milestoneId);
    requireRevision(input.expectedRevision, current.revision);
    if (current.archivedAt === null) {
      throw new AppError('VALIDATION_ERROR', 'Archive this milestone before purging it.', 400);
    }
    if (input.confirmation !== current.name) {
      throw new AppError('VALIDATION_ERROR', `Type ${current.name} to confirm purge.`, 400, {
        field: 'confirmation',
      });
    }

    const issues = db.sqlite.prepare(`
      SELECT id, revision FROM issues WHERE milestone_id = ? ORDER BY id
    `).all(milestoneId) as Array<{ id: string; revision: number }>;
    const purgedAt = now();
    const detach = db.sqlite.prepare(`
      UPDATE issues
      SET milestone_id = NULL, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `);
    for (const issue of issues) {
      const revision = issue.revision + 1;
      detach.run(revision, purgedAt, issue.id, issue.revision);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'issue',
        entityId: issue.id,
        action: 'issue.updated',
        entityRevision: revision,
        fields: [{ field: 'milestoneId', before: milestoneId, after: null }],
        createdAt: purgedAt,
      });
    }
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'project',
      entityId: projectId,
      action: 'milestone.purged',
      entityRevision: project.revision,
      fields: [
        { field: 'milestoneId', before: milestoneId, after: null },
        { field: 'milestoneName', before: current.name, after: null },
        { field: 'detachedIssueCount', before: 0, after: issues.length },
        { field: 'purgedAt', before: null, after: purgedAt },
      ],
      createdAt: purgedAt,
    });
    db.sqlite.prepare('DELETE FROM idempotency_records WHERE entity_id = ?').run(milestoneId);
    db.sqlite.prepare(`
      DELETE FROM milestones WHERE id = ? AND project_id = ? AND revision = ?
    `).run(milestoneId, projectId, current.revision);
    return {
      id: milestoneId,
      projectId,
      name: current.name,
      detachedIssueCount: issues.length,
      purgedAt,
    };
  });
}

export async function reorderMilestones(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
  items: readonly { id: string; expectedRevision: number }[],
): Promise<DbMilestone[]> {
  requireOwnerScope(db, userId, workspaceId);
  projectById(db, projectId);
  assertUniqueOrder(items);
  db.write(() => {
    const rows = db.sqlite.prepare(`
      SELECT id, position, revision FROM milestones
      WHERE project_id = ? AND archived_at IS NULL ORDER BY position, id
    `).all(projectId) as Array<{ id: string; position: number; revision: number }>;
    const byId = new Map(rows.map((row) => [row.id, row]));
    if (rows.length !== items.length || items.some((item) => !byId.has(item.id))) {
      throw new AppError('VALIDATION_ERROR', 'Order every active milestone exactly once.', 400, {
        field: 'items',
      });
    }
    for (const item of items) requireRevision(item.expectedRevision, byId.get(item.id)!.revision);
    if (items.every((item, index) => item.id === rows[index]?.id)) {
      throw new AppError('VALIDATION_ERROR', 'Milestone order is unchanged.', 400, { field: 'items' });
    }
    const update = db.sqlite.prepare(`
      UPDATE milestones SET position = ?, revision = revision + 1, updated_at = ? WHERE id = ?
    `);
    items.forEach((item, index) => {
      const before = byId.get(item.id)!;
      const position = (index + 1) * 100;
      update.run(position, now(), item.id);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'milestone',
        entityId: item.id,
        action: 'milestone.reordered',
        entityRevision: before.revision + 1,
        fields: [{ field: 'position', before: before.position, after: position }],
      });
    });
  });
  return listMilestones(db, userId, workspaceId, projectId);
}

export async function listProjectActivity(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  projectId: string,
): Promise<DbActivityEntry[]> {
  requireOwnerScope(db, userId, workspaceId);
  projectById(db, projectId);
  const milestoneIds = (db.sqlite.prepare('SELECT id FROM milestones WHERE project_id = ?')
    .all(projectId) as Array<{ id: string }>).map((row) => row.id);
  return listActivity(db, ['project', 'milestone'], [projectId, ...milestoneIds], 200);
}
