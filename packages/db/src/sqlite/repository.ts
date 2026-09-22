import { randomUUID } from 'node:crypto';
import {
  AppError,
  assertUniqueOrder,
  normalizeColor,
  normalizeEmail,
  normalizeName,
  normalizeTeamKey,
  normalizeWorkspaceSlug,
  parseStatusCategory,
  type MembershipRole,
} from '@basiclinear/domain';
import type {
  DbMembership,
  DbRetireStatusResult,
  DbTeam,
  DbUser,
  DbWorkflowStatus,
  DbWorkspace,
} from '../types.js';
import { asSqliteError, type BasicLinearDatabase } from './client.js';
import {
  changed,
  compactChanges,
  idempotentEntity,
  now,
  recordActivity,
  rememberIdempotency,
  requireOwnerScope,
  requireRevision,
  requireTeam,
} from './helpers.js';

export interface BootstrapInput {
  email: string;
  displayName: string;
  workspaceName: string;
  workspaceSlug: string;
  teamName: string;
  teamKey: string;
}

export interface BootstrapResult {
  userId: string;
  workspaceId: string;
  teamId: string;
}

interface ScopeRow {
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
}

interface StatusRow {
  id: string;
  name: string;
  category: DbWorkflowStatus['category'];
  color: string;
  position: number;
  isDefault: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

const defaultStatuses = [
  ['Backlog', 'backlog', '#8A8F98', 100],
  ['Planned', 'unstarted', '#6B83D6', 200],
  ['In progress', 'started', '#E5A04B', 300],
  ['Done', 'completed', '#50A773', 400],
  ['Canceled', 'canceled', '#9A9CA3', 500],
] as const;

function scopeRow(db: BasicLinearDatabase): ScopeRow | undefined {
  return db.sqlite.prepare(`
    SELECT workspace_id AS workspaceId, workspace_name AS workspaceName,
           workspace_slug AS workspaceSlug, membership_id AS membershipId,
           team_id AS teamId, team_name AS teamName, team_key AS teamKey,
           revision, created_at AS createdAt, updated_at AS updatedAt
    FROM scope_metadata WHERE singleton = 1
  `).get() as ScopeRow | undefined;
}

function statusById(db: BasicLinearDatabase, workspaceId: string, statusId: string): DbWorkflowStatus {
  const scope = scopeRow(db);
  if (scope?.workspaceId !== workspaceId) throw new AppError('NOT_FOUND', 'Status not found.', 404);
  const row = db.sqlite.prepare(`
    SELECT id, name, category, color, position, is_default AS isDefault,
           revision, created_at AS createdAt, updated_at AS updatedAt
    FROM workflow_statuses WHERE id = ?
  `).get(statusId) as StatusRow | undefined;
  if (row === undefined) throw new AppError('NOT_FOUND', 'Status not found.', 404);
  return mapStatus(scope, row);
}

function mapStatus(scope: ScopeRow, row: StatusRow): DbWorkflowStatus {
  return {
    id: row.id,
    workspaceId: scope.workspaceId,
    teamId: scope.teamId,
    name: row.name,
    category: row.category,
    color: row.color,
    position: row.position,
    isDefault: row.isDefault === 1,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function setupRequired(db: BasicLinearDatabase): Promise<boolean> {
  const row = db.sqlite.prepare('SELECT EXISTS(SELECT 1 FROM owner_profile) AS present')
    .get() as { present: number };
  return row.present !== 1;
}

export async function bootstrapInstance(
  db: BasicLinearDatabase,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  try {
    return db.write(() => {
      if (db.sqlite.prepare('SELECT 1 AS present FROM owner_profile').get() !== undefined) {
        throw new AppError('SETUP_UNAVAILABLE', 'Initial setup has already been completed.', 409);
      }
      const ids = { userId: randomUUID(), workspaceId: randomUUID(), teamId: randomUUID() };
      const timestamp = now();
      const email = normalizeEmail(input.email);
      const displayName = normalizeName(input.displayName, 'displayName');
      const workspaceName = normalizeName(input.workspaceName, 'workspaceName');
      const workspaceSlug = normalizeWorkspaceSlug(input.workspaceSlug);
      const teamName = normalizeName(input.teamName, 'teamName');
      const teamKey = normalizeTeamKey(input.teamKey);
      db.sqlite.prepare(`
        INSERT INTO owner_profile
          (singleton, id, email, display_name, revision, created_at, updated_at)
        VALUES (1, ?, ?, ?, 1, ?, ?)
      `).run(ids.userId, email, displayName, timestamp, timestamp);
      db.sqlite.prepare(`
        INSERT INTO scope_metadata
          (singleton, workspace_id, workspace_name, workspace_slug, membership_id,
           team_id, team_name, team_key, revision, created_at, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        ids.workspaceId,
        workspaceName,
        workspaceSlug,
        randomUUID(),
        ids.teamId,
        teamName,
        teamKey,
        timestamp,
        timestamp,
      );
      const insertStatus = db.sqlite.prepare(`
        INSERT INTO workflow_statuses
          (id, name, category, color, position, is_default, revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)
      `);
      for (const [name, category, color, position] of defaultStatuses) {
        insertStatus.run(randomUUID(), name, category, color, position, timestamp, timestamp);
      }
      db.sqlite.prepare('INSERT INTO issue_sequence (singleton, next_number) VALUES (1, 1)').run();
      return ids;
    });
  } catch (error) {
    throw asSqliteError(error);
  }
}

export async function getOwnerProfile(db: BasicLinearDatabase): Promise<DbUser | undefined> {
  return db.sqlite.prepare(`
    SELECT id, email, display_name AS displayName, revision
    FROM owner_profile WHERE singleton = 1
  `).get() as DbUser | undefined;
}

export async function createSession(
  db: BasicLinearDatabase,
  input: { id: string; userId: string; tokenHash: string; csrfTokenHash: string; expiresAt: Date },
): Promise<void> {
  const owner = db.sqlite.prepare('SELECT id FROM owner_profile WHERE singleton = 1').get() as { id: string } | undefined;
  if (owner?.id !== input.userId) throw new AppError('NOT_FOUND', 'The account is unavailable.', 404);
  for (const [key, session] of db.sessions) {
    if (session.expiresAt <= Date.now()) db.sessions.delete(key);
  }
  db.sessions.set(input.tokenHash, {
    userId: input.userId,
    expiresAt: input.expiresAt.valueOf(),
    csrfTokenHashes: [input.csrfTokenHash],
  });
}

export async function addSessionCsrfToken(
  db: BasicLinearDatabase,
  tokenHash: string,
  csrfTokenHash: string,
): Promise<boolean> {
  const session = db.sessions.get(tokenHash);
  if (session === undefined || session.expiresAt <= Date.now()) {
    db.sessions.delete(tokenHash);
    return false;
  }
  session.csrfTokenHashes.push(csrfTokenHash);
  if (session.csrfTokenHashes.length > 16) session.csrfTokenHashes.shift();
  return true;
}

export async function sessionAcceptsCsrfToken(
  db: BasicLinearDatabase,
  tokenHash: string,
  csrfTokenHash: string,
): Promise<boolean> {
  const session = db.sessions.get(tokenHash);
  if (session === undefined || session.expiresAt <= Date.now()) {
    db.sessions.delete(tokenHash);
    return false;
  }
  return session.csrfTokenHashes.includes(csrfTokenHash);
}

export async function resolveSession(
  db: BasicLinearDatabase,
  tokenHash: string,
): Promise<DbUser | undefined> {
  const session = db.sessions.get(tokenHash);
  if (session === undefined) return undefined;
  if (session.expiresAt <= Date.now()) {
    db.sessions.delete(tokenHash);
    return undefined;
  }
  return db.sqlite.prepare(`
    SELECT id, email, display_name AS displayName, revision
    FROM owner_profile WHERE singleton = 1 AND id = ?
  `).get(session.userId) as DbUser | undefined;
}

export async function revokeSession(db: BasicLinearDatabase, tokenHash: string): Promise<void> {
  db.sessions.delete(tokenHash);
}

export async function listWorkspaces(
  db: BasicLinearDatabase,
  userId: string,
): Promise<DbWorkspace[]> {
  const scope = requireOwnerScope(db, userId);
  const row = scopeRow(db)!;
  return [{
    id: scope.workspaceId,
    name: row.workspaceName,
    slug: row.workspaceSlug,
    role: 'owner',
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }];
}

export async function listTeams(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
): Promise<DbTeam[]> {
  requireOwnerScope(db, userId, workspaceId);
  const row = scopeRow(db)!;
  return [{
    id: row.teamId,
    workspaceId: row.workspaceId,
    name: row.teamName,
    key: row.teamKey,
    revision: row.revision,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }];
}

export async function listMemberships(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
): Promise<DbMembership[]> {
  requireOwnerScope(db, userId, workspaceId);
  const scope = scopeRow(db)!;
  const owner = db.sqlite.prepare(`
    SELECT id, email, display_name AS displayName, revision, created_at AS createdAt,
           updated_at AS updatedAt FROM owner_profile WHERE singleton = 1
  `).get() as {
    id: string;
    email: string;
    displayName: string;
    revision: number;
    createdAt: string;
    updatedAt: string;
  };
  return [{
    id: scope.membershipId,
    workspaceId,
    userId: owner.id,
    email: owner.email,
    displayName: owner.displayName,
    role: 'owner',
    revision: owner.revision,
    createdAt: owner.createdAt,
    updatedAt: owner.updatedAt,
  }];
}

function unsupportedCollaboration(): never {
  throw new AppError('FORBIDDEN', 'This local version supports one owner and one workspace.', 403);
}

export async function createWorkspace(
  _db: BasicLinearDatabase,
  _userId: string,
  _input: { name: string; slug: string; idempotencyKey: string },
): Promise<DbWorkspace> {
  return unsupportedCollaboration();
}

export async function createTeam(
  _db: BasicLinearDatabase,
  _userId: string,
  _workspaceId: string,
  _input: { name: string; key: string; idempotencyKey: string },
): Promise<DbTeam> {
  return unsupportedCollaboration();
}

export async function createLocalMembership(
  _db: BasicLinearDatabase,
  _actorUserId: string,
  _workspaceId: string,
  _input: {
    email: string;
    displayName: string;
    role: MembershipRole;
    idempotencyKey: string;
  },
): Promise<DbMembership> {
  return unsupportedCollaboration();
}

export async function listStatuses(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
  teamId?: string,
): Promise<DbWorkflowStatus[]> {
  const scope = requireOwnerScope(db, userId, workspaceId);
  if (teamId !== undefined && teamId !== scope.teamId) return [];
  const rows = db.sqlite.prepare(`
    SELECT id, name, category, color, position, is_default AS isDefault,
           revision, created_at AS createdAt, updated_at AS updatedAt
    FROM workflow_statuses ORDER BY position, id
  `).all() as unknown as StatusRow[];
  return rows.map((row) => mapStatus(scopeRow(db)!, row));
}

export async function createStatus(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
  input: {
    teamId: string;
    name: string;
    category: DbWorkflowStatus['category'];
    color: string;
    position: number;
    idempotencyKey: string;
  },
): Promise<DbWorkflowStatus> {
  requireOwnerScope(db, userId, workspaceId);
  requireTeam(db, input.teamId);
  return db.write(() => {
    const existing = idempotentEntity(db, userId, 'status.create', input.idempotencyKey);
    if (existing !== undefined) return statusById(db, workspaceId, existing);
    if (!Number.isSafeInteger(input.position) || input.position < 0) {
      throw new AppError('VALIDATION_ERROR', 'Choose a valid status position.', 400, { field: 'position' });
    }
    const id = randomUUID();
    const timestamp = now();
    db.sqlite.prepare(`
      INSERT INTO workflow_statuses
        (id, name, category, color, position, is_default, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)
    `).run(
      id,
      normalizeName(input.name),
      parseStatusCategory(input.category),
      normalizeColor(input.color),
      input.position,
      timestamp,
      timestamp,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'workflow_status',
      entityId: id,
      action: 'workflow_status.created',
      entityRevision: 1,
    });
    rememberIdempotency(db, {
      userId,
      operation: 'status.create',
      key: input.idempotencyKey,
      entityId: id,
      revision: 1,
    });
    return statusById(db, workspaceId, id);
  });
}

export async function updateStatus(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
  statusId: string,
  input: {
    expectedRevision: number;
    name?: string;
    category?: DbWorkflowStatus['category'];
    color?: string;
    position?: number;
  },
): Promise<DbWorkflowStatus> {
  requireOwnerScope(db, userId, workspaceId);
  return db.write(() => {
    const current = statusById(db, workspaceId, statusId);
    requireRevision(input.expectedRevision, current.revision);
    const next = {
      name: input.name === undefined ? current.name : normalizeName(input.name),
      category: input.category === undefined ? current.category : parseStatusCategory(input.category),
      color: input.color === undefined ? current.color : normalizeColor(input.color),
      position: input.position ?? current.position,
    };
    if (!Number.isSafeInteger(next.position) || next.position < 0) {
      throw new AppError('VALIDATION_ERROR', 'Choose a valid status position.', 400, { field: 'position' });
    }
    const fields = compactChanges([
      changed('name', current.name, next.name),
      changed('category', current.category, next.category),
      changed('color', current.color, next.color),
      changed('position', current.position, next.position),
    ]);
    if (fields.length === 0) throw new AppError('VALIDATION_ERROR', 'No status changes to save.', 400);
    const revision = current.revision + 1;
    db.sqlite.prepare(`
      UPDATE workflow_statuses
      SET name = ?, category = ?, color = ?, position = ?, revision = ?, updated_at = ?
      WHERE id = ? AND revision = ?
    `).run(
      next.name,
      next.category,
      next.color,
      next.position,
      revision,
      now(),
      statusId,
      current.revision,
    );
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'workflow_status',
      entityId: statusId,
      action: 'workflow_status.updated',
      entityRevision: revision,
      fields,
    });
    return statusById(db, workspaceId, statusId);
  });
}

export async function reorderStatuses(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
  teamId: string,
  items: readonly { id: string; expectedRevision: number }[],
): Promise<DbWorkflowStatus[]> {
  requireOwnerScope(db, userId, workspaceId);
  requireTeam(db, teamId);
  assertUniqueOrder(items);
  db.write(() => {
    const current = db.sqlite.prepare(`
      SELECT id, position, revision FROM workflow_statuses ORDER BY position, id
    `).all() as Array<{ id: string; position: number; revision: number }>;
    const byId = new Map(current.map((row) => [row.id, row]));
    if (current.length !== items.length || items.some((item) => !byId.has(item.id))) {
      throw new AppError('VALIDATION_ERROR', 'Order every workflow status exactly once.', 400, {
        field: 'items',
      });
    }
    for (const item of items) requireRevision(item.expectedRevision, byId.get(item.id)!.revision);
    if (items.every((item, index) => item.id === current[index]?.id)) {
      throw new AppError('VALIDATION_ERROR', 'Workflow status order is unchanged.', 400, { field: 'items' });
    }
    db.sqlite.exec('UPDATE workflow_statuses SET position = position + 1000000');
    const update = db.sqlite.prepare(`
      UPDATE workflow_statuses SET position = ?, revision = revision + 1, updated_at = ? WHERE id = ?
    `);
    items.forEach((item, index) => {
      const before = byId.get(item.id)!;
      const position = (index + 1) * 100;
      const revision = before.revision + 1;
      update.run(position, now(), item.id);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'workflow_status',
        entityId: item.id,
        action: 'workflow_status.reordered',
        entityRevision: revision,
        fields: [{ field: 'position', before: before.position, after: position }],
      });
    });
  });
  return listStatuses(db, userId, workspaceId, teamId);
}

export async function retireStatus(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId: string,
  statusId: string,
  input: {
    expectedRevision: number;
    replacementStatusId: string;
    replacementExpectedRevision: number;
  },
): Promise<DbRetireStatusResult> {
  requireOwnerScope(db, userId, workspaceId);
  if (statusId === input.replacementStatusId) {
    throw new AppError('VALIDATION_ERROR', 'Choose a different replacement status.', 400, {
      field: 'replacementStatusId',
    });
  }
  return db.write(() => {
    const source = statusById(db, workspaceId, statusId);
    const replacement = statusById(db, workspaceId, input.replacementStatusId);
    const count = Number((db.sqlite.prepare('SELECT count(*) AS count FROM workflow_statuses')
      .get() as { count: number }).count);
    if (count <= 1) {
      throw new AppError('VALIDATION_ERROR', 'A team must keep at least one workflow status.', 400);
    }
    requireRevision(input.expectedRevision, source.revision);
    requireRevision(input.replacementExpectedRevision, replacement.revision);
    const affected = db.sqlite.prepare('SELECT id, revision FROM issues WHERE status_id = ?')
      .all(statusId) as Array<{ id: string; revision: number }>;
    const issueUpdate = db.sqlite.prepare(`
      UPDATE issues SET status_id = ?, revision = revision + 1, updated_at = ? WHERE id = ?
    `);
    for (const issue of affected) {
      issueUpdate.run(replacement.id, now(), issue.id);
      recordActivity(db, {
        actorUserId: userId,
        entityType: 'issue',
        entityId: issue.id,
        action: 'issue.updated',
        entityRevision: issue.revision + 1,
        fields: [{ field: 'statusId', before: source.id, after: replacement.id }],
      });
    }
    recordActivity(db, {
      actorUserId: userId,
      entityType: 'workflow_status',
      entityId: source.id,
      action: 'workflow_status.retired',
      entityRevision: source.revision + 1,
    });
    db.sqlite.prepare('DELETE FROM workflow_statuses WHERE id = ?').run(source.id);
    const rows = db.sqlite.prepare(`
      SELECT id, position FROM workflow_statuses ORDER BY position, id
    `).all() as Array<{ id: string; position: number }>;
    db.sqlite.exec('UPDATE workflow_statuses SET position = position + 1000000');
    const normalizePosition = db.sqlite.prepare('UPDATE workflow_statuses SET position = ? WHERE id = ?');
    rows.forEach((row, index) => normalizePosition.run((index + 1) * 100, row.id));
    return {
      retiredStatusId: source.id,
      replacementStatusId: replacement.id,
      reassignedIssueCount: affected.length,
      statuses: (db.sqlite.prepare(`
        SELECT id, name, category, color, position, is_default AS isDefault,
               revision, created_at AS createdAt, updated_at AS updatedAt
        FROM workflow_statuses ORDER BY position, id
      `).all() as unknown as StatusRow[]).map((row) => mapStatus(scopeRow(db)!, row)),
    };
  });
}
