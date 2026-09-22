import { randomUUID } from 'node:crypto';
import {
  AppError,
  normalizeIssueViewState,
  normalizeName,
  normalizeText,
} from '@basiclinear/domain';
import type { IssueViewState } from '@basiclinear/domain';
import type { DbSavedView, DbSearchResult } from '../types.js';
import type { BasicLinearDatabase } from './client.js';
import {
  changed,
  compactChanges,
  idempotentEntity,
  json,
  now,
  recordActivity,
  rememberIdempotency,
  requireOwnerScope,
  requireRevision,
} from './helpers.js';

interface SavedViewRow {
  id: string;
  ownerUserId: string;
  name: string;
  sharingScope: 'private';
  state: string;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

const selection = `
  id, owner_user_id AS ownerUserId, name, sharing_scope AS sharingScope, state,
  archived_at AS archivedAt, revision, created_at AS createdAt, updated_at AS updatedAt
`;

function workspaceId(db: BasicLinearDatabase): string {
  return (db.sqlite.prepare('SELECT workspace_id AS workspaceId FROM scope_metadata WHERE singleton = 1')
    .get() as { workspaceId: string }).workspaceId;
}

function mapSavedView(db: BasicLinearDatabase, row: SavedViewRow): DbSavedView {
  return {
    id: row.id,
    workspaceId: workspaceId(db),
    ownerUserId: row.ownerUserId,
    name: row.name,
    sharingScope: 'private',
    state: normalizeIssueViewState(json<IssueViewState>(row.state)),
    archivedAt: row.archivedAt,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function savedViewById(db: BasicLinearDatabase, viewId: string): DbSavedView {
  const row = db.sqlite.prepare(`SELECT ${selection} FROM saved_views WHERE id = ?`)
    .get(viewId) as SavedViewRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Saved view not found.', 404);
  return mapSavedView(db, row);
}

export async function listSavedViews(
  db: BasicLinearDatabase,
  userId: string,
  scopeId: string,
  includeArchived = false,
): Promise<DbSavedView[]> {
  requireOwnerScope(db, userId, scopeId);
  return (db.sqlite.prepare(`
    SELECT ${selection} FROM saved_views WHERE owner_user_id = ?
    ${includeArchived ? '' : 'AND archived_at IS NULL'} ORDER BY lower(name), id
  `).all(userId) as unknown as SavedViewRow[]).map((row) => mapSavedView(db, row));
}

export async function createSavedView(
  db: BasicLinearDatabase,
  userId: string,
  scopeId: string,
  input: {
    name: string;
    sharingScope: 'private' | 'workspace';
    state: unknown;
    idempotencyKey: string;
  },
): Promise<DbSavedView> {
  requireOwnerScope(db, userId, scopeId);
  return db.write(() => {
    const existing = idempotentEntity(db, userId, 'saved-view.create', input.idempotencyKey);
    if (existing !== undefined) return savedViewById(db, existing);
    const id = randomUUID();
    const name = normalizeName(input.name, 'name');
    const state = normalizeIssueViewState(input.state);
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO saved_views (
        id, owner_user_id, name, sharing_scope, state, revision, created_at, updated_at
      ) VALUES (?, ?, ?, 'private', ?, 1, ?, ?)
    `).run(id, userId, name, JSON.stringify(state), timestamp, timestamp);
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'saved_view',
      entityId: id,
      action: 'saved_view.created',
      entityRevision: 1,
      fields: [{ field: 'name', before: null, after: name }],
    });
    rememberIdempotency(db, {
      userId,
      operation: 'saved-view.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return savedViewById(db, id);
  });
}

export async function updateSavedView(
  db: BasicLinearDatabase,
  userId: string,
  scopeId: string,
  viewId: string,
  input: {
    expectedRevision: number;
    name?: string;
    sharingScope?: 'private' | 'workspace';
    state?: unknown;
  },
): Promise<DbSavedView> {
  requireOwnerScope(db, userId, scopeId);
  return db.write(() => {
    const current = savedViewById(db, viewId);
    if (current.ownerUserId !== userId) throw new AppError('NOT_FOUND', 'Saved view not found.', 404);
    requireRevision(input.expectedRevision, current.revision);
    if (current.archivedAt !== null) {
      throw new AppError('CONFLICT', 'Restore this saved view before editing it.', 409, {
        currentRevision: current.revision,
      });
    }
    const name = input.name === undefined ? current.name : normalizeName(input.name, 'name');
    const state = input.state === undefined ? current.state : normalizeIssueViewState(input.state);
    const fields = compactChanges([
      changed('name', current.name, name),
      changed('state', current.state, state),
      changed('sharingScope', current.sharingScope, 'private'),
    ]);
    if (fields.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'No saved-view changes to save.', 400);
    }
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE saved_views SET name = ?, sharing_scope = 'private', state = ?, revision = ?,
        updated_at = ? WHERE id = ? AND owner_user_id = ? AND revision = ?
    `).run(
      name,
      JSON.stringify(state),
      revision,
      now(),
      viewId,
      userId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'saved_view',
      entityId: viewId,
      action: 'saved_view.updated',
      entityRevision: revision,
      fields,
    });
    return savedViewById(db, viewId);
  });
}

function setSavedViewArchive(
  db: BasicLinearDatabase,
  userId: string,
  scopeId: string,
  viewId: string,
  expectedRevision: number,
  archive: boolean,
): DbSavedView {
  requireOwnerScope(db, userId, scopeId);
  return db.write(() => {
    const current = savedViewById(db, viewId);
    if (current.ownerUserId !== userId) throw new AppError('NOT_FOUND', 'Saved view not found.', 404);
    requireRevision(expectedRevision, current.revision);
    if ((current.archivedAt !== null) === archive) {
      throw new AppError('VALIDATION_ERROR', archive
        ? 'Saved view is already archived.'
        : 'Saved view is already active.', 400);
    }
    const archivedAt = archive ? now() : null;
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE saved_views SET archived_at = ?, archived_by_user_id = ?, revision = ?, updated_at = ?
      WHERE id = ? AND owner_user_id = ? AND revision = ?
    `).run(
      archivedAt,
      archive ? userId : null,
      revision,
      now(),
      viewId,
      userId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'saved_view',
      entityId: viewId,
      action: archive ? 'saved_view.archived' : 'saved_view.restored',
      entityRevision: revision,
      fields: [{ field: 'archivedAt', before: current.archivedAt, after: archivedAt }],
    });
    return savedViewById(db, viewId);
  });
}

export const archiveSavedView = (
  db: BasicLinearDatabase,
  userId: string,
  workspaceIdValue: string,
  viewId: string,
  expectedRevision: number,
) => Promise.resolve(setSavedViewArchive(
  db, userId, workspaceIdValue, viewId, expectedRevision, true,
));

export const restoreSavedView = (
  db: BasicLinearDatabase,
  userId: string,
  workspaceIdValue: string,
  viewId: string,
  expectedRevision: number,
) => Promise.resolve(setSavedViewArchive(
  db, userId, workspaceIdValue, viewId, expectedRevision, false,
));

function documentText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(documentText).join(' ');
  if (typeof value !== 'object' || value === null) return '';
  return Object.values(value).map(documentText).join(' ');
}

export async function searchWorkspace(
  db: BasicLinearDatabase,
  userId: string,
  scopeId: string,
  rawQuery: string,
  rawLimit = 20,
): Promise<DbSearchResult[]> {
  requireOwnerScope(db, userId, scopeId);
  const query = normalizeText(rawQuery, 200, 'query').toLocaleLowerCase('en');
  if (query === '') return [];
  const limit = Number.isSafeInteger(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;
  const teamName = (db.sqlite.prepare('SELECT team_name AS teamName FROM scope_metadata WHERE singleton = 1')
    .get() as { teamName: string }).teamName;
  const issues = db.sqlite.prepare(`
    SELECT id, identifier, title, description_document AS descriptionDocument
    FROM issues WHERE archived_at IS NULL
  `).all() as Array<{ id: string; identifier: string; title: string; descriptionDocument: string }>;
  const projects = db.sqlite.prepare(`
    SELECT id, name, summary, overview_document AS overviewDocument
    FROM projects WHERE archived_at IS NULL
  `).all() as Array<{ id: string; name: string; summary: string; overviewDocument: string }>;
  const labelRows = db.sqlite.prepare(`
    SELECT il.issue_id AS issueId, l.name FROM issue_labels il
    JOIN labels l ON l.id = il.label_id WHERE l.archived_at IS NULL
  `).all() as Array<{ issueId: string; name: string }>;
  const labelsByIssue = new Map<string, string[]>();
  for (const label of labelRows) {
    const current = labelsByIssue.get(label.issueId) ?? [];
    current.push(label.name.toLocaleLowerCase('en'));
    labelsByIssue.set(label.issueId, current);
  }
  const results: DbSearchResult[] = [];
  for (const issue of issues) {
    const identifier = issue.identifier.toLocaleLowerCase('en');
    const title = issue.title.toLocaleLowerCase('en');
    const labels = labelsByIssue.get(issue.id) ?? [];
    const description = documentText(json<unknown>(issue.descriptionDocument)).toLocaleLowerCase('en');
    let rank = -1;
    let matchedBy: DbSearchResult['matchedBy'] = 'description';
    if (identifier === query) { rank = 0; matchedBy = 'identifier'; }
    else if (identifier.startsWith(query)) { rank = 1; matchedBy = 'identifier'; }
    else if (title === query) { rank = 2; matchedBy = 'title'; }
    else if (title.startsWith(query)) { rank = 3; matchedBy = 'title'; }
    else if (title.includes(query)) { rank = 4; matchedBy = 'title'; }
    else if (labels.some((label) => label.includes(query))) { rank = 5; matchedBy = 'label'; }
    else if (description.includes(query)) { rank = 6; matchedBy = 'description'; }
    if (rank >= 0) {
      results.push({
        kind: 'issue',
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        subtitle: teamName,
        matchedBy,
        rank,
      });
    }
  }
  for (const project of projects) {
    const name = project.name.toLocaleLowerCase('en');
    const summary = project.summary.toLocaleLowerCase('en');
    const overview = documentText(json<unknown>(project.overviewDocument)).toLocaleLowerCase('en');
    let rank = -1;
    let matchedBy: DbSearchResult['matchedBy'] = 'summary';
    if (name === query) { rank = 2; matchedBy = 'title'; }
    else if (name.startsWith(query)) { rank = 3; matchedBy = 'title'; }
    else if (name.includes(query)) { rank = 4; matchedBy = 'title'; }
    else if (summary.includes(query) || overview.includes(query)) { rank = 6; matchedBy = 'summary'; }
    if (rank >= 0) {
      results.push({
        kind: 'project',
        id: project.id,
        identifier: null,
        title: project.name,
        subtitle: teamName,
        matchedBy,
        rank,
      });
    }
  }
  return results.sort((left, right) => left.rank - right.rank
    || left.title.localeCompare(right.title, 'en', { sensitivity: 'base' })
    || left.kind.localeCompare(right.kind, 'en')
    || left.id.localeCompare(right.id, 'en')).slice(0, limit);
}
