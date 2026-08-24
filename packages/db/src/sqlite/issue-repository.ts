import { randomUUID } from 'node:crypto';
import {
  AppError,
  normalizeColor,
  normalizeDate,
  normalizeIssueDocument,
  normalizeIssueFilter,
  normalizeText,
  parseIssuePriority,
  parseIssueRelationType,
  type IssueFilterCondition,
  type IssueFilterNode,
  type IssueRichTextDocument,
} from '@openlinear/domain';
import type {
  DbActivityEntry,
  DbBulkIssueMutationResult,
  DbComment,
  DbIssue,
  DbIssuePriority,
  DbIssueRelation,
  DbIssueRelationType,
  DbLabel,
  DbPurgeIssueReceipt,
} from '../types.js';
import { asSqliteError, type OpenLinearDatabase } from './client.js';
import {
  changed,
  compactChanges,
  emptyDocument,
  idempotentEntity,
  json,
  listActivity,
  normalizeResources,
  now,
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

export interface IssueListInput {
  query?: string;
  teamId?: string;
  statusId?: string;
  priority?: DbIssuePriority;
  assigneeUserId?: string;
  projectId?: string;
  milestoneId?: string;
  labelId?: string;
  archiveState?: 'active' | 'archived' | 'all';
  order?: 'updatedAt' | 'identifier' | 'priority' | 'dueDate';
  direction?: 'asc' | 'desc';
  filter?: unknown;
}

export interface CreateIssueInput {
  teamId: string;
  title: string;
  descriptionDocument?: unknown;
  statusId?: string;
  priority?: DbIssuePriority;
  assigneeUserId?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  labelIds?: string[];
  resources?: IssueResourceInput[];
  idempotencyKey: string;
}

export interface UpdateIssueInput {
  expectedRevision: number;
  title?: string;
  descriptionDocument?: unknown;
  statusId?: string;
  priority?: DbIssuePriority;
  assigneeUserId?: string | null;
  dueDate?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  labelIds?: string[];
  labelMutation?: { operation: 'add' | 'remove'; labelIds: string[] };
  resources?: IssueResourceInput[];
}

export interface IssueResourceInput {
  label: string;
  url: string;
}

interface IssueRow {
  id: string;
  sequenceNumber: number;
  identifier: string;
  title: string;
  descriptionDocument: string;
  statusId: string;
  priority: DbIssuePriority;
  assigneeUserId: string | null;
  dueDate: string | null;
  projectId: string | null;
  milestoneId: string | null;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LabelRow {
  id: string;
  name: string;
  color: string;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RelationRow {
  id: string;
  sourceIssueId: string;
  targetIssueId: string;
  type: DbIssueRelationType;
  revision: number;
  createdAt: string;
  updatedAt: string;
  sourceIdentifier: string;
  sourceTitle: string;
  sourceArchivedAt: string | null;
  targetIdentifier: string;
  targetTitle: string;
  targetArchivedAt: string | null;
}

interface CommentRow {
  id: string;
  issueId: string;
  authorUserId: string | null;
  bodyDocument: string;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

const issueSelection = `
  id, sequence_number AS sequenceNumber, identifier, title,
  description_document AS descriptionDocument, status_id AS statusId, priority,
  assignee_user_id AS assigneeUserId, due_date AS dueDate, project_id AS projectId,
  milestone_id AS milestoneId, revision, archived_at AS archivedAt,
  created_at AS createdAt, updated_at AS updatedAt
`;

const labelSelection = `
  id, name, color, revision, archived_at AS archivedAt,
  created_at AS createdAt, updated_at AS updatedAt
`;

const relationSelection = `
  r.id, r.source_issue_id AS sourceIssueId, r.target_issue_id AS targetIssueId,
  r.relation_type AS type, r.revision, r.created_at AS createdAt, r.updated_at AS updatedAt,
  source.identifier AS sourceIdentifier, source.title AS sourceTitle,
  source.archived_at AS sourceArchivedAt, target.identifier AS targetIdentifier,
  target.title AS targetTitle, target.archived_at AS targetArchivedAt
`;

const commentSelection = `
  id, issue_id AS issueId, author_user_id AS authorUserId, body_document AS bodyDocument,
  archived_at AS archivedAt, revision, created_at AS createdAt, updated_at AS updatedAt
`;

function metadata(db: OpenLinearDatabase): { workspaceId: string; teamId: string; teamKey: string } {
  return db.sqlite.prepare(`
    SELECT workspace_id AS workspaceId, team_id AS teamId, team_key AS teamKey
    FROM scope_metadata WHERE singleton = 1
  `).get() as { workspaceId: string; teamId: string; teamKey: string };
}

function mapLabel(db: OpenLinearDatabase, row: LabelRow): DbLabel {
  return {
    id: row.id,
    workspaceId: metadata(db).workspaceId,
    name: row.name,
    color: row.color,
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function labelsForIssue(db: OpenLinearDatabase, issueId: string): DbLabel[] {
  return (db.sqlite.prepare(`
    SELECT l.id, l.name, l.color, l.revision, l.archived_at AS archivedAt,
           l.created_at AS createdAt, l.updated_at AS updatedAt
    FROM issue_labels il JOIN labels l ON l.id = il.label_id
    WHERE il.issue_id = ? ORDER BY il.position, lower(l.name), l.id
  `).all(issueId) as unknown as LabelRow[]).map((row) => mapLabel(db, row));
}

function labelsForAllIssues(db: OpenLinearDatabase): Map<string, DbLabel[]> {
  const rows = db.sqlite.prepare(`
    SELECT il.issue_id AS issueId, l.id, l.name, l.color, l.revision,
           l.archived_at AS archivedAt, l.created_at AS createdAt, l.updated_at AS updatedAt
    FROM issue_labels il JOIN labels l ON l.id = il.label_id
    ORDER BY il.issue_id, il.position, lower(l.name), l.id
  `).all() as unknown as Array<LabelRow & { issueId: string }>;
  const grouped = new Map<string, DbLabel[]>();
  for (const row of rows) {
    const current = grouped.get(row.issueId) ?? [];
    current.push(mapLabel(db, row));
    grouped.set(row.issueId, current);
  }
  return grouped;
}

function resourcesForAllIssues(
  db: OpenLinearDatabase,
): Map<string, Array<{ id: string; label: string; url: string; position: number }>> {
  const rows = db.sqlite.prepare(`
    SELECT issue_id AS issueId, id, label, url, position
    FROM issue_resources ORDER BY issue_id, position, id
  `).all() as unknown as Array<{
    issueId: string;
    id: string;
    label: string;
    url: string;
    position: number;
  }>;
  const grouped = new Map<string, Array<{ id: string; label: string; url: string; position: number }>>();
  for (const row of rows) {
    const current = grouped.get(row.issueId) ?? [];
    current.push({ id: row.id, label: row.label, url: row.url, position: row.position });
    grouped.set(row.issueId, current);
  }
  return grouped;
}

function mapIssue(
  db: OpenLinearDatabase,
  row: IssueRow,
  labels = labelsForIssue(db, row.id),
  resources = readResources(db, 'issue_resources', 'issue_id', row.id),
): DbIssue {
  const scope = metadata(db);
  return {
    id: row.id,
    workspaceId: scope.workspaceId,
    teamId: scope.teamId,
    sequenceNumber: row.sequenceNumber,
    identifier: row.identifier,
    title: row.title,
    descriptionDocument: json<IssueRichTextDocument>(row.descriptionDocument),
    statusId: row.statusId,
    priority: row.priority,
    assigneeUserId: row.assigneeUserId,
    dueDate: row.dueDate,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    labels,
    resources,
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function issueById(db: OpenLinearDatabase, issueId: string): DbIssue {
  const row = db.sqlite.prepare(`SELECT ${issueSelection} FROM issues WHERE id = ?`)
    .get(issueId) as IssueRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Issue not found.', 404);
  return mapIssue(db, row);
}

function labelById(db: OpenLinearDatabase, labelId: string): DbLabel {
  const row = db.sqlite.prepare(`SELECT ${labelSelection} FROM labels WHERE id = ?`)
    .get(labelId) as LabelRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Label not found.', 404);
  return mapLabel(db, row);
}

function statusCategory(
  db: OpenLinearDatabase,
  statusId: string,
): 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' {
  const row = db.sqlite.prepare('SELECT category FROM workflow_statuses WHERE id = ?')
    .get(statusId) as {
      category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
    } | undefined;
  if (row === undefined) {
    throw new AppError('VALIDATION_ERROR', 'Choose a status from this issue team.', 400, {
      field: 'statusId',
    });
  }
  return row.category;
}

function defaultStatusId(db: OpenLinearDatabase): string {
  const row = db.sqlite.prepare(`
    SELECT id FROM workflow_statuses
    ORDER BY CASE WHEN category = 'unstarted' THEN 0 ELSE 1 END, position, id LIMIT 1
  `).get() as { id: string } | undefined;
  if (row === undefined) {
    throw new AppError('VALIDATION_ERROR', 'Create a workflow status before creating issues.', 400, {
      field: 'statusId',
    });
  }
  return row.id;
}

function ensureAssignment(
  db: OpenLinearDatabase,
  projectId: string | null,
  milestoneId: string | null,
): void {
  if (projectId === null) {
    if (milestoneId !== null) {
      throw new AppError('VALIDATION_ERROR', 'A milestone requires a project.', 400, {
        field: 'milestoneId',
      });
    }
    return;
  }
  const project = db.sqlite.prepare('SELECT archived_at AS archivedAt FROM projects WHERE id = ?')
    .get(projectId) as { archivedAt: string | null } | undefined;
  if (project === undefined || project.archivedAt !== null) {
    throw new AppError('VALIDATION_ERROR', 'Choose an active project from this issue team.', 400, {
      field: 'projectId',
    });
  }
  if (milestoneId === null) return;
  const milestone = db.sqlite.prepare(`
    SELECT archived_at AS archivedAt FROM milestones WHERE id = ? AND project_id = ?
  `).get(milestoneId, projectId) as { archivedAt: string | null } | undefined;
  if (milestone === undefined || milestone.archivedAt !== null) {
    throw new AppError('VALIDATION_ERROR', 'Choose an active milestone from this project.', 400, {
      field: 'milestoneId',
    });
  }
}

function normalizedLabelIds(db: OpenLinearDatabase, labelIds: readonly string[]): string[] {
  const ids = [...new Set(labelIds)];
  if (ids.length !== labelIds.length || ids.length > 50) {
    throw new AppError('VALIDATION_ERROR', 'Choose each label at most once.', 400, { field: 'labelIds' });
  }
  for (const id of ids) {
    const row = db.sqlite.prepare('SELECT archived_at AS archivedAt FROM labels WHERE id = ?')
      .get(id) as { archivedAt: string | null } | undefined;
    if (row === undefined || row.archivedAt !== null) {
      throw new AppError('VALIDATION_ERROR', 'One or more labels are unavailable.', 400, {
        field: 'labelIds',
      });
    }
  }
  return ids;
}

function replaceIssueLabels(db: OpenLinearDatabase, issueId: string, labelIds: readonly string[]): void {
  db.sqlite.prepare('DELETE FROM issue_labels WHERE issue_id = ?').run(issueId);
  const insert = db.sqlite.prepare(`
    INSERT INTO issue_labels (issue_id, label_id, position, created_at) VALUES (?, ?, ?, ?)
  `);
  labelIds.forEach((labelId, index) => insert.run(issueId, labelId, (index + 1) * 100, now()));
}

function normalizedIssueResources(resources: readonly IssueResourceInput[]): IssueResourceInput[] {
  if (resources.length > 50) {
    throw new AppError('VALIDATION_ERROR', 'Add at most 50 issue resources.', 400, { field: 'resources' });
  }
  return normalizeResources(resources);
}

function documentText(document: IssueRichTextDocument): string {
  const values: string[] = [];
  const visit = (node: IssueRichTextDocument['content'][number]) => {
    if (node.type === 'text' && node.text !== undefined) values.push(node.text);
    for (const child of node.content ?? []) visit(child);
  };
  for (const node of document.content) visit(node);
  return values.join(' ').trim();
}

function scalarMatch(
  actual: string | null,
  condition: IssueFilterCondition,
  emptyValue?: string,
): boolean {
  const empty = actual === null || (emptyValue !== undefined && actual === emptyValue);
  if (condition.operator === 'isEmpty') return empty;
  if (condition.operator === 'isNotEmpty') return !empty;
  const values = Array.isArray(condition.value) ? condition.value : [condition.value as string];
  const includes = actual !== null && values.includes(actual);
  if (condition.operator === 'is' || condition.operator === 'in') return includes;
  if (condition.operator === 'before') return actual !== null && actual < String(condition.value);
  if (condition.operator === 'after') return actual !== null && actual > String(condition.value);
  return !includes;
}

function matchesFilter(issue: DbIssue, node: IssueFilterNode): boolean {
  if (node.type === 'group') {
    if (node.children.length === 0) return true;
    return node.operator === 'and'
      ? node.children.every((child) => matchesFilter(issue, child))
      : node.children.some((child) => matchesFilter(issue, child));
  }
  if (node.field === 'labelId') {
    const values = issue.labels.map((label) => label.id);
    if (node.operator === 'isEmpty') return values.length === 0;
    if (node.operator === 'isNotEmpty') return values.length > 0;
    const requested = Array.isArray(node.value) ? node.value : [node.value as string];
    const found = requested.some((value) => values.includes(value));
    return ['is', 'in'].includes(node.operator) ? found : !found;
  }
  const value = node.field === 'teamId' ? issue.teamId
    : node.field === 'statusId' ? issue.statusId
      : node.field === 'priority' ? issue.priority
        : node.field === 'assigneeUserId' ? issue.assigneeUserId
          : node.field === 'projectId' ? issue.projectId
            : node.field === 'milestoneId' ? issue.milestoneId
              : issue.dueDate;
  return scalarMatch(value, node, node.field === 'priority' ? 'none' : undefined);
}

function issueSearchRank(issue: DbIssue, query: string): number {
  if (query === '') return 0;
  const identifier = issue.identifier.toLocaleLowerCase('en');
  const title = issue.title.toLocaleLowerCase('en');
  if (identifier === query) return 0;
  if (identifier.startsWith(query)) return 1;
  if (title === query) return 2;
  if (title.startsWith(query)) return 3;
  if (title.includes(query)) return 4;
  if (issue.labels.some((label) => label.archivedAt === null
    && label.name.toLocaleLowerCase('en').includes(query))) return 5;
  return 6;
}

function nullableCompare(left: string | null, right: string | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right, 'en');
}

export async function listIssues(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: IssueListInput = {},
): Promise<DbIssue[]> {
  const scope = requireOwnerScope(db, userId, workspaceId);
  if (input.teamId !== undefined && input.teamId !== scope.teamId) return [];
  const query = normalizeText(input.query ?? '', 200, 'query').toLocaleLowerCase('en');
  const filter = normalizeIssueFilter(input.filter ?? {
    version: 1,
    root: { type: 'group', operator: 'and', children: [] },
  });
  const archiveState = input.archiveState ?? 'active';
  const labelMap = labelsForAllIssues(db);
  const resourceMap = resourcesForAllIssues(db);
  let issues = (db.sqlite.prepare(`SELECT ${issueSelection} FROM issues`).all() as unknown as IssueRow[])
    .map((row) => mapIssue(db, row, labelMap.get(row.id) ?? [], resourceMap.get(row.id) ?? []))
    .filter((issue) => archiveState === 'all'
      || (archiveState === 'archived' ? issue.archivedAt !== null : issue.archivedAt === null))
    .filter((issue) => input.statusId === undefined || issue.statusId === input.statusId)
    .filter((issue) => input.priority === undefined || issue.priority === parseIssuePriority(input.priority))
    .filter((issue) => input.assigneeUserId === undefined || issue.assigneeUserId === input.assigneeUserId)
    .filter((issue) => input.projectId === undefined || issue.projectId === input.projectId)
    .filter((issue) => input.milestoneId === undefined || issue.milestoneId === input.milestoneId)
    .filter((issue) => input.labelId === undefined
      || issue.labels.some((label) => label.id === input.labelId))
    .filter((issue) => query === ''
      || issueSearchRank(issue, query) < 6
      || documentText(issue.descriptionDocument).toLocaleLowerCase('en').includes(query))
    .filter((issue) => matchesFilter(issue, filter.root));
  const order = input.order ?? 'updatedAt';
  const direction = input.direction ?? 'desc';
  const priorityRank: Record<DbIssuePriority, number> = {
    urgent: 1, high: 2, medium: 3, low: 4, none: 5,
  };
  issues = issues.sort((left, right) => {
    const rank = issueSearchRank(left, query) - issueSearchRank(right, query);
    if (rank !== 0) return rank;
    let result: number;
    if (order === 'identifier') result = left.sequenceNumber - right.sequenceNumber;
    else if (order === 'priority') result = priorityRank[left.priority] - priorityRank[right.priority];
    else if (order === 'dueDate') {
      if (left.dueDate === null || right.dueDate === null) {
        return nullableCompare(left.dueDate, right.dueDate) || left.id.localeCompare(right.id, 'en');
      }
      result = left.dueDate.localeCompare(right.dueDate, 'en');
    }
    else result = left.updatedAt.localeCompare(right.updatedAt, 'en');
    return (direction === 'desc' ? -result : result) || left.id.localeCompare(right.id, 'en');
  });
  return issues;
}

export async function getIssue(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<DbIssue> {
  requireOwnerScope(db, userId, workspaceId);
  return issueById(db, issueId);
}

export async function createIssue(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: CreateIssueInput,
): Promise<DbIssue> {
  requireOwnerScope(db, userId, workspaceId);
  requireTeam(db, input.teamId);
  requireOwnerUser(db, input.assigneeUserId ?? null, 'assigneeUserId');
  return db.write(() => {
    const existing = idempotentEntity(db, userId, 'issue.create', input.idempotencyKey);
    if (existing !== undefined) return issueById(db, existing);
    const title = normalizeText(input.title, 240, 'title');
    if (title === '') {
      throw new AppError('VALIDATION_ERROR', 'Issue title cannot be empty.', 400, { field: 'title' });
    }
    const description = normalizeIssueDocument(input.descriptionDocument ?? emptyDocument);
    const statusId = input.statusId ?? defaultStatusId(db);
    statusCategory(db, statusId);
    const priority = parseIssuePriority(input.priority ?? 'none');
    const assigneeUserId = input.assigneeUserId ?? null;
    const dueDate = normalizeDate(input.dueDate ?? null, 'dueDate');
    const projectId = input.projectId ?? null;
    const milestoneId = input.milestoneId ?? null;
    ensureAssignment(db, projectId, milestoneId);
    const labelIds = normalizedLabelIds(db, input.labelIds ?? []);
    const resources = normalizedIssueResources(input.resources ?? []);
    const sequence = db.sqlite.prepare('SELECT next_number AS nextNumber FROM issue_sequence WHERE singleton = 1')
      .get() as { nextNumber: number } | undefined;
    if (sequence === undefined || !Number.isSafeInteger(sequence.nextNumber) || sequence.nextNumber < 1) {
      throw new AppError('INTERNAL_ERROR', 'Issue sequence allocation failed.', 500);
    }
    db.sqlite.prepare('UPDATE issue_sequence SET next_number = next_number + 1 WHERE singleton = 1').run();
    const issueId = randomUUID();
    const identifier = `${metadata(db).teamKey}-${sequence.nextNumber}`;
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO issues (
        id, sequence_number, identifier, title, description_document, status_id, priority,
        assignee_user_id, due_date, project_id, milestone_id, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      issueId,
      sequence.nextNumber,
      identifier,
      title,
      JSON.stringify(description),
      statusId,
      priority,
      assigneeUserId,
      dueDate,
      projectId,
      milestoneId,
      timestamp,
      timestamp,
    );
    replaceIssueLabels(db, issueId, labelIds);
    replaceResources(db, 'issue_resources', 'issue_id', issueId, resources, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue',
      entityId: issueId,
      action: 'issue.created',
      entityRevision: 1,
      fields: [
        { field: 'identifier', before: null, after: identifier },
        { field: 'title', before: null, after: title },
        { field: 'statusId', before: null, after: statusId },
        { field: 'projectId', before: null, after: projectId },
        { field: 'milestoneId', before: null, after: milestoneId },
      ],
    });
    rememberIdempotency(db, {
      userId,
      operation: 'issue.create',
      key: input.idempotencyKey,
      entityId: issueId,
      revision: 1,
    });
    return issueById(db, issueId);
  });
}

export async function updateIssue(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  input: UpdateIssueInput,
): Promise<DbIssue> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = issueById(db, issueId);
    requireRevision(input.expectedRevision, current.revision);
    requireActive(current.archivedAt, current.revision, 'issue');
    const title = input.title === undefined ? current.title : normalizeText(input.title, 240, 'title');
    if (title === '') {
      throw new AppError('VALIDATION_ERROR', 'Issue title cannot be empty.', 400, { field: 'title' });
    }
    const description = input.descriptionDocument === undefined
      ? current.descriptionDocument
      : normalizeIssueDocument(input.descriptionDocument);
    const statusId = input.statusId ?? current.statusId;
    statusCategory(db, statusId);
    const priority = input.priority === undefined ? current.priority : parseIssuePriority(input.priority);
    const assigneeUserId = input.assigneeUserId === undefined
      ? current.assigneeUserId
      : input.assigneeUserId;
    if (input.assigneeUserId !== undefined) {
      requireOwnerUser(db, assigneeUserId, 'assigneeUserId');
    }
    const dueDate = input.dueDate === undefined ? current.dueDate : normalizeDate(input.dueDate, 'dueDate');
    const projectId = input.projectId === undefined ? current.projectId : input.projectId;
    const milestoneId = input.milestoneId === undefined
      ? (projectId === current.projectId ? current.milestoneId : null)
      : input.milestoneId;
    ensureAssignment(db, projectId, milestoneId);
    if (input.labelIds !== undefined && input.labelMutation !== undefined) {
      throw new AppError('VALIDATION_ERROR', 'Choose one label update mode.', 400, { field: 'labelIds' });
    }
    const currentLabelIds = current.labels.map((label) => label.id);
    let labelIds = currentLabelIds;
    if (input.labelIds !== undefined) labelIds = normalizedLabelIds(db, input.labelIds);
    else if (input.labelMutation !== undefined) {
      const requested = normalizedLabelIds(db, input.labelMutation.labelIds);
      if (requested.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Choose at least one label.', 400, { field: 'labelIds' });
      }
      const requestedSet = new Set(requested);
      labelIds = input.labelMutation.operation === 'add'
        ? [...currentLabelIds, ...requested.filter((id) => !currentLabelIds.includes(id))]
        : currentLabelIds.filter((id) => !requestedSet.has(id));
      if (labelIds.length > 50) {
        throw new AppError('VALIDATION_ERROR', 'An issue can have at most 50 labels.', 400, {
          field: 'labelIds',
        });
      }
    }
    const currentResources = current.resources.map(({ label, url }) => ({ label, url }));
    const resources = input.resources === undefined
      ? currentResources
      : normalizedIssueResources(input.resources);
    const fields = compactChanges([
      changed('title', current.title, title),
      changed('descriptionDocument', current.descriptionDocument, description),
      changed('statusId', current.statusId, statusId),
      changed('priority', current.priority, priority),
      changed('assigneeUserId', current.assigneeUserId, assigneeUserId),
      changed('dueDate', current.dueDate, dueDate),
      changed('projectId', current.projectId, projectId),
      changed('milestoneId', current.milestoneId, milestoneId),
      changed('labelIds', currentLabelIds, labelIds),
      changed('resources', currentResources, resources),
    ]);
    if (fields.length === 0) {
      if (input.labelMutation !== undefined) return current;
      throw new AppError('VALIDATION_ERROR', 'Change at least one issue field.', 400);
    }
    const revision = current.revision + 1;
    const timestamp = now();
    db.sqlite.prepare(`
      UPDATE issues SET title = ?, description_document = ?, status_id = ?, priority = ?,
        assignee_user_id = ?, due_date = ?, project_id = ?, milestone_id = ?,
        revision = ?, updated_at = ? WHERE id = ? AND revision = ?
    `).run(
      title,
      JSON.stringify(description),
      statusId,
      priority,
      assigneeUserId,
      dueDate,
      projectId,
      milestoneId,
      revision,
      timestamp,
      issueId,
      current.revision,
    );
    if (input.labelIds !== undefined || input.labelMutation !== undefined) {
      replaceIssueLabels(db, issueId, labelIds);
    }
    if (input.resources !== undefined) {
      replaceResources(db, 'issue_resources', 'issue_id', issueId, resources, timestamp);
    }
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue',
      entityId: issueId,
      action: 'issue.updated',
      entityRevision: revision,
      fields,
    });
    return issueById(db, issueId);
  });
}

function setIssueArchive(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  expectedRevision: number,
  archive: boolean,
): DbIssue {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = issueById(db, issueId);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('VALIDATION_ERROR', archive
        ? 'Issue is already archived.'
        : 'Issue is already active.', 400);
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE issues SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(archivedAt, archive ? userId : null, revision, now(), issueId, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue',
      entityId: issueId,
      action: archive ? 'issue.archived' : 'issue.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return issueById(db, issueId);
  });
}

export const archiveIssue = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  expectedRevision: number,
) => Promise.resolve(setIssueArchive(db, userId, workspaceId, issueId, expectedRevision, true));

export const restoreIssue = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  expectedRevision: number,
) => Promise.resolve(setIssueArchive(db, userId, workspaceId, issueId, expectedRevision, false));

export async function bulkMutateIssues(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: {
    items: Array<{ id: string; expectedRevision: number }>;
    mutation:
      | { type: 'update'; patch: Pick<UpdateIssueInput,
        'statusId' | 'priority' | 'assigneeUserId' | 'dueDate' | 'projectId' | 'milestoneId'> }
      | { type: 'labels'; operation: 'add' | 'remove'; labelIds: string[] }
      | { type: 'archive' }
      | { type: 'restore' };
  },
): Promise<DbBulkIssueMutationResult[]> {
  const ids = new Set(input.items.map((item) => item.id));
  if (ids.size !== input.items.length) {
    throw new AppError('VALIDATION_ERROR', 'Bulk issue identifiers must be unique.', 400, {
      field: 'items',
    });
  }
  if (input.mutation.type === 'update' && Object.keys(input.mutation.patch).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'Choose at least one bulk issue change.', 400, {
      field: 'mutation.patch',
    });
  }
  const results: DbBulkIssueMutationResult[] = [];
  for (const item of input.items) {
    try {
      const issue = input.mutation.type === 'update'
        ? await updateIssue(db, userId, workspaceId, item.id, {
            ...input.mutation.patch,
            expectedRevision: item.expectedRevision,
          })
        : input.mutation.type === 'labels'
          ? await updateIssue(db, userId, workspaceId, item.id, {
              expectedRevision: item.expectedRevision,
              labelMutation: {
                operation: input.mutation.operation,
                labelIds: input.mutation.labelIds,
              },
            })
          : input.mutation.type === 'archive'
            ? await archiveIssue(db, userId, workspaceId, item.id, item.expectedRevision)
            : await restoreIssue(db, userId, workspaceId, item.id, item.expectedRevision);
      results.push({ id: item.id, status: 'updated', issue });
    } catch (error) {
      const safe = asSqliteError(error);
      results.push({
        id: item.id,
        status: safe.code === 'CONFLICT' ? 'conflict' : 'failed',
        error: {
          code: safe.code,
          message: safe.message,
          ...(safe.currentRevision === undefined ? {} : { currentRevision: safe.currentRevision }),
        },
      });
    }
  }
  return results;
}

export async function purgeIssue(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  input: { expectedRevision: number; confirmation: string },
): Promise<DbPurgeIssueReceipt> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = issueById(db, issueId);
    requireRevision(input.expectedRevision, current.revision);
    if (current.archivedAt === null) {
      throw new AppError('VALIDATION_ERROR', 'Archive this issue before purging it.', 400);
    }
    if (input.confirmation !== current.identifier) {
      throw new AppError('VALIDATION_ERROR', `Type ${current.identifier} to confirm purge.`, 400, {
        field: 'confirmation',
      });
    }
    const purgedAt = now();
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue',
      entityId: issueId,
      action: 'issue.purged',
      entityRevision: current.revision + 1,
      fields: [{ field: 'purgedAt', before: null, after: purgedAt }],
    });
    db.sqlite.prepare('DELETE FROM issues WHERE id = ? AND revision = ?').run(issueId, current.revision);
    return { id: issueId, identifier: current.identifier, purgedAt };
  });
}

export async function listLabels(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  includeArchived = false,
): Promise<DbLabel[]> {
  requireOwnerScope(db, userId, workspaceId);
  return (db.sqlite.prepare(`
    SELECT ${labelSelection} FROM labels ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
    ORDER BY CASE WHEN archived_at IS NULL THEN 0 ELSE 1 END, lower(name), id
  `).all() as unknown as LabelRow[]).map((row) => mapLabel(db, row));
}

export async function createLabel(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  input: { name: string; color: string; idempotencyKey: string },
): Promise<DbLabel> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const existing = idempotentEntity(db, userId, 'label.create', input.idempotencyKey);
    if (existing !== undefined) return labelById(db, existing);
    const name = normalizeText(input.name, 60, 'name');
    if (name === '') {
      throw new AppError('VALIDATION_ERROR', 'Label name cannot be empty.', 400, { field: 'name' });
    }
    const id = randomUUID();
    const color = normalizeColor(input.color);
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO labels (id, name, color, revision, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, ?)
    `).run(id, name, color, timestamp, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'label',
      entityId: id,
      action: 'label.created',
      entityRevision: 1,
      fields: [{ field: 'name', before: null, after: name }],
    });
    rememberIdempotency(db, {
      userId,
      operation: 'label.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return labelById(db, id);
  });
}

export async function updateLabel(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  labelId: string,
  input: { expectedRevision: number; name?: string; color?: string },
): Promise<DbLabel> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = labelById(db, labelId);
    requireRevision(input.expectedRevision, current.revision);
    const name = input.name === undefined ? current.name : normalizeText(input.name, 60, 'name');
    if (name === '') {
      throw new AppError('VALIDATION_ERROR', 'Label name cannot be empty.', 400, { field: 'name' });
    }
    const color = input.color === undefined ? current.color : normalizeColor(input.color);
    const fields = compactChanges([
      changed('name', current.name, name),
      changed('color', current.color, color),
    ]);
    if (fields.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Change at least one label field.', 400);
    }
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE labels SET name = ?, color = ?, revision = ?, updated_at = ? WHERE id = ? AND revision = ?
    `).run(name, color, revision, now(), labelId, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'label',
      entityId: labelId,
      action: 'label.updated',
      entityRevision: revision,
      fields,
    });
    return labelById(db, labelId);
  });
}

function setLabelArchive(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  labelId: string,
  expectedRevision: number,
  archive: boolean,
): DbLabel {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = labelById(db, labelId);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('VALIDATION_ERROR', archive
        ? 'Label is already archived.'
        : 'Label is already active.', 400);
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE labels SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(archivedAt, archive ? userId : null, revision, now(), labelId, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'label',
      entityId: labelId,
      action: archive ? 'label.archived' : 'label.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return labelById(db, labelId);
  });
}

export const archiveLabel = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  labelId: string,
  expectedRevision: number,
) => Promise.resolve(setLabelArchive(db, userId, workspaceId, labelId, expectedRevision, true));

export const restoreLabel = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  labelId: string,
  expectedRevision: number,
) => Promise.resolve(setLabelArchive(db, userId, workspaceId, labelId, expectedRevision, false));

function relationDirection(row: RelationRow, issueId: string): DbIssueRelation['direction'] {
  if (row.type === 'related') return 'related';
  if (row.type === 'blocks') return row.sourceIssueId === issueId ? 'blocks' : 'blocked_by';
  if (row.type === 'duplicate') return row.sourceIssueId === issueId ? 'duplicate_of' : 'duplicates';
  return row.sourceIssueId === issueId ? 'sub_issue' : 'parent';
}

function mapRelation(db: OpenLinearDatabase, row: RelationRow, issueId: string): DbIssueRelation {
  const sourceIsCurrent = row.sourceIssueId === issueId;
  return {
    id: row.id,
    workspaceId: metadata(db).workspaceId,
    sourceIssueId: row.sourceIssueId,
    targetIssueId: row.targetIssueId,
    type: row.type,
    direction: relationDirection(row, issueId),
    otherIssue: sourceIsCurrent
      ? {
          id: row.targetIssueId,
          identifier: row.targetIdentifier,
          title: row.targetTitle,
          archivedAt: row.targetArchivedAt,
        }
      : {
          id: row.sourceIssueId,
          identifier: row.sourceIdentifier,
          title: row.sourceTitle,
          archivedAt: row.sourceArchivedAt,
        },
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function relationById(db: OpenLinearDatabase, relationId: string, issueId: string): DbIssueRelation {
  const row = db.sqlite.prepare(`
    SELECT ${relationSelection}
    FROM issue_relations r JOIN issues source ON source.id = r.source_issue_id
    JOIN issues target ON target.id = r.target_issue_id
    WHERE r.id = ? AND (r.source_issue_id = ? OR r.target_issue_id = ?)
  `).get(relationId, issueId, issueId) as RelationRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Issue relation not found.', 404);
  return mapRelation(db, row, issueId);
}

export async function listIssueRelations(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<DbIssueRelation[]> {
  requireOwnerScope(db, userId, workspaceId);
  issueById(db, issueId);
  return (db.sqlite.prepare(`
    SELECT ${relationSelection}
    FROM issue_relations r JOIN issues source ON source.id = r.source_issue_id
    JOIN issues target ON target.id = r.target_issue_id
    WHERE r.source_issue_id = ? OR r.target_issue_id = ? ORDER BY r.created_at, r.id
  `).all(issueId, issueId) as unknown as RelationRow[]).map((row) => mapRelation(db, row, issueId));
}

function relationWouldCycle(
  db: OpenLinearDatabase,
  type: Exclude<DbIssueRelationType, 'related'>,
  sourceIssueId: string,
  targetIssueId: string,
): boolean {
  const edges = db.sqlite.prepare(`
    SELECT source_issue_id AS sourceIssueId, target_issue_id AS targetIssueId
    FROM issue_relations WHERE relation_type = ?
  `).all(type) as Array<{ sourceIssueId: string; targetIssueId: string }>;
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const values = next.get(edge.sourceIssueId) ?? [];
    values.push(edge.targetIssueId);
    next.set(edge.sourceIssueId, values);
  }
  const pending = [targetIssueId];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === sourceIssueId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(next.get(current) ?? []));
  }
  return false;
}

export async function createIssueRelation(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  input: { type: DbIssueRelationType; targetIssueId: string; idempotencyKey: string },
): Promise<DbIssueRelation> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const source = issueById(db, issueId);
    const target = issueById(db, input.targetIssueId);
    if (source.archivedAt !== null || target.archivedAt !== null) {
      throw new AppError('VALIDATION_ERROR', 'Restore both issues before relating them.', 400, {
        field: 'targetIssueId',
      });
    }
    if (issueId === input.targetIssueId) {
      throw new AppError('VALIDATION_ERROR', 'An issue cannot relate to itself.', 400, {
        field: 'targetIssueId',
      });
    }
    const existing = idempotentEntity(db, userId, 'issue_relation.create', input.idempotencyKey);
    if (existing !== undefined) return relationById(db, existing, issueId);
    const type = parseIssueRelationType(input.type);
    let sourceIssueId = issueId;
    let targetIssueId = input.targetIssueId;
    if (type === 'related' && sourceIssueId > targetIssueId) {
      [sourceIssueId, targetIssueId] = [targetIssueId, sourceIssueId];
    }
    if (type !== 'related' && relationWouldCycle(db, type, sourceIssueId, targetIssueId)) {
      throw new AppError('VALIDATION_ERROR', `This ${type} relation would create a cycle.`, 400, {
        field: 'targetIssueId',
      });
    }
    const id = randomUUID();
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO issue_relations (
        id, source_issue_id, target_issue_id, relation_type, revision,
        created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, sourceIssueId, targetIssueId, type, userId, timestamp, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue_relation',
      entityId: id,
      action: 'issue_relation.created',
      entityRevision: 1,
      fields: [
        { field: 'type', before: null, after: type },
        { field: 'sourceIssueId', before: null, after: sourceIssueId },
        { field: 'targetIssueId', before: null, after: targetIssueId },
      ],
    });
    rememberIdempotency(db, {
      userId,
      operation: 'issue_relation.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return relationById(db, id, issueId);
  });
}

export async function deleteIssueRelation(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  relationId: string,
  expectedRevision: number,
): Promise<void> {
  requireOwnerScope(db, userId, workspaceId);
  db.write(() => {
    const current = relationById(db, relationId, issueId);
    requireRevision(expectedRevision, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'issue_relation',
      entityId: relationId,
      action: 'issue_relation.removed',
      entityRevision: current.revision + 1,
      fields: [{ field: 'type', before: current.type, after: null }],
    });
    db.sqlite.prepare('DELETE FROM issue_relations WHERE id = ? AND revision = ?')
      .run(relationId, current.revision);
  });
}

function mapComment(db: OpenLinearDatabase, row: CommentRow): DbComment {
  const owner = db.sqlite.prepare('SELECT id, display_name AS displayName FROM owner_profile WHERE singleton = 1')
    .get() as { id: string; displayName: string } | undefined;
  return {
    id: row.id,
    workspaceId: metadata(db).workspaceId,
    issueId: row.issueId,
    author: row.authorUserId !== null && owner?.id === row.authorUserId
      ? { id: owner.id, displayName: owner.displayName }
      : null,
    bodyDocument: json<IssueRichTextDocument>(row.bodyDocument),
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function commentById(db: OpenLinearDatabase, issueId: string, commentId: string): DbComment {
  const row = db.sqlite.prepare(`
    SELECT ${commentSelection} FROM comments WHERE id = ? AND issue_id = ?
  `).get(commentId, issueId) as CommentRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Comment not found.', 404);
  return mapComment(db, row);
}

export async function listComments(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  includeArchived = false,
): Promise<DbComment[]> {
  requireOwnerScope(db, userId, workspaceId);
  issueById(db, issueId);
  return (db.sqlite.prepare(`
    SELECT ${commentSelection} FROM comments WHERE issue_id = ?
    ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY created_at, id
  `).all(issueId) as unknown as CommentRow[]).map((row) => mapComment(db, row));
}

export async function createComment(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  input: { bodyDocument: unknown; idempotencyKey: string },
): Promise<DbComment> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const issue = issueById(db, issueId);
    requireActive(issue.archivedAt, issue.revision, 'issue');
    const existing = idempotentEntity(db, userId, 'comment.create', input.idempotencyKey);
    if (existing !== undefined) return commentById(db, issueId, existing);
    const body = normalizeIssueDocument(input.bodyDocument, 'bodyDocument');
    if (documentText(body) === '') {
      throw new AppError('VALIDATION_ERROR', 'Comment cannot be empty.', 400, {
        field: 'bodyDocument',
      });
    }
    const id = randomUUID();
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO comments (
        id, issue_id, author_user_id, body_document, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, issueId, userId, JSON.stringify(body), timestamp, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'comment',
      entityId: id,
      action: 'comment.created',
      entityRevision: 1,
      fields: [{ field: 'bodyDocument', before: null, after: body }],
    });
    rememberIdempotency(db, {
      userId,
      operation: 'comment.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return commentById(db, issueId, id);
  });
}

export async function updateComment(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  input: { expectedRevision: number; bodyDocument: unknown },
): Promise<DbComment> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = commentById(db, issueId, commentId);
    requireRevision(input.expectedRevision, current.revision);
    requireActive(current.archivedAt, current.revision, 'comment');
    const body = normalizeIssueDocument(input.bodyDocument, 'bodyDocument');
    if (documentText(body) === '') {
      throw new AppError('VALIDATION_ERROR', 'Comment cannot be empty.', 400, {
        field: 'bodyDocument',
      });
    }
    const fields = compactChanges([changed('bodyDocument', current.bodyDocument, body)]);
    if (fields.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Change the comment before saving.', 400);
    }
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE comments SET body_document = ?, revision = ?, updated_at = ?
      WHERE id = ? AND issue_id = ? AND revision = ?
    `).run(JSON.stringify(body), revision, now(), commentId, issueId, current.revision);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'comment',
      entityId: commentId,
      action: 'comment.updated',
      entityRevision: revision,
      fields,
    });
    return commentById(db, issueId, commentId);
  });
}

function setCommentArchive(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  expectedRevision: number,
  archive: boolean,
): DbComment {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = commentById(db, issueId, commentId);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('VALIDATION_ERROR', archive
        ? 'Comment is already archived.'
        : 'Comment is already active.', 400);
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE comments SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND issue_id = ? AND revision = ?
    `).run(
      archivedAt,
      archive ? userId : null,
      revision,
      now(),
      commentId,
      issueId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'comment',
      entityId: commentId,
      action: archive ? 'comment.archived' : 'comment.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return commentById(db, issueId, commentId);
  });
}

export const archiveComment = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  expectedRevision: number,
) => Promise.resolve(setCommentArchive(
  db, userId, workspaceId, issueId, commentId, expectedRevision, true,
));

export const restoreComment = (
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
  commentId: string,
  expectedRevision: number,
) => Promise.resolve(setCommentArchive(
  db, userId, workspaceId, issueId, commentId, expectedRevision, false,
));

export async function listIssueActivity(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  issueId: string,
): Promise<DbActivityEntry[]> {
  requireOwnerScope(db, userId, workspaceId);
  issueById(db, issueId);
  const comments = (db.sqlite.prepare('SELECT id FROM comments WHERE issue_id = ?')
    .all(issueId) as Array<{ id: string }>).map((row) => row.id);
  const relations = (db.sqlite.prepare(`
    SELECT id FROM issue_relations WHERE source_issue_id = ? OR target_issue_id = ?
  `).all(issueId, issueId) as Array<{ id: string }>).map((row) => row.id);
  return listActivity(
    db,
    ['issue', 'comment', 'issue_relation'],
    [issueId, ...comments, ...relations],
    200,
  );
}
