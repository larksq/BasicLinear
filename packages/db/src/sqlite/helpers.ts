import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { SQLInputValue } from 'node:sqlite';
import { AppError, assertExpectedRevision, normalizeHttpUrl, normalizeText } from '@basiclinear/domain';
import type { DbActivityEntry, DbProgressSnapshot, DbProjectResource, DbIssueResource } from '../types.js';
import type { BasicLinearDatabase } from './client.js';

export const emptyDocument = { version: 1 as const, type: 'doc' as const, content: [] };
export type FieldChange = { field: string; before: unknown; after: unknown };

export function now(): string {
  return new Date().toISOString();
}

export function json<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new AppError('INTERNAL_ERROR', 'Stored JSON is invalid.', 500);
  }
}

export function changed(field: string, before: unknown, after: unknown): FieldChange | undefined {
  return isDeepStrictEqual(before, after) ? undefined : { field, before, after };
}

export function compactChanges(values: Array<FieldChange | undefined>): FieldChange[] {
  return values.filter((value): value is FieldChange => value !== undefined);
}

export function requireOwnerScope(
  db: BasicLinearDatabase,
  userId: string,
  workspaceId?: string,
): { userId: string; workspaceId: string; teamId: string; teamKey: string } {
  const row = db.sqlite.prepare(`
    SELECT o.id AS userId, s.workspace_id AS workspaceId, s.team_id AS teamId, s.team_key AS teamKey
    FROM owner_profile o CROSS JOIN scope_metadata s
    WHERE o.singleton = 1 AND s.singleton = 1
  `).get() as { userId: string; workspaceId: string; teamId: string; teamKey: string } | undefined;
  if (row === undefined || row.userId !== userId || (workspaceId !== undefined && row.workspaceId !== workspaceId)) {
    throw new AppError('NOT_FOUND', 'The requested record is unavailable.', 404);
  }
  return row;
}

export function requireTeam(db: BasicLinearDatabase, teamId: string): void {
  const row = db.sqlite.prepare('SELECT team_id AS teamId FROM scope_metadata WHERE singleton = 1')
    .get() as { teamId: string } | undefined;
  if (row?.teamId !== teamId) throw new AppError('NOT_FOUND', 'Team not found.', 404);
}

export function requireOwnerUser(db: BasicLinearDatabase, userId: string | null, field: string): void {
  if (userId === null) return;
  const row = db.sqlite.prepare('SELECT id FROM owner_profile WHERE singleton = 1').get() as { id: string } | undefined;
  if (row?.id !== userId) {
    throw new AppError('VALIDATION_ERROR', 'Choose the local owner.', 400, { field });
  }
}

export function requireRevision(expected: number, current: number): void {
  assertExpectedRevision(expected, current);
}

export function requireActive(archivedAt: string | null, revision: number, noun: string): void {
  if (archivedAt !== null) {
    throw new AppError('CONFLICT', `Restore this ${noun} before editing it.`, 409, {
      currentRevision: revision,
    });
  }
}

export function normalizeResources<T extends { label: string; url: string }>(
  resources: readonly T[],
  prefix = 'resources',
): Array<{ label: string; url: string }> {
  return resources.map((resource, index) => {
    const label = normalizeText(resource.label, 120, `${prefix}.${index}.label`);
    if (label === '') {
      throw new AppError('VALIDATION_ERROR', 'Resource labels cannot be empty.', 400, {
        field: `${prefix}.${index}.label`,
      });
    }
    return { label, url: normalizeHttpUrl(resource.url, `${prefix}.${index}.url`) };
  });
}

export function replaceResources(
  db: BasicLinearDatabase,
  table: 'project_resources' | 'issue_resources',
  ownerColumn: 'project_id' | 'issue_id',
  ownerId: string,
  resources: readonly { label: string; url: string }[],
  createdAt = now(),
): DbProjectResource[] | DbIssueResource[] {
  db.sqlite.prepare(`DELETE FROM ${table} WHERE ${ownerColumn} = ?`).run(ownerId);
  const insert = db.sqlite.prepare(
    `INSERT INTO ${table} (id, ${ownerColumn}, label, url, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  return resources.map((resource, index) => {
    const value = { id: randomUUID(), label: resource.label, url: resource.url, position: index };
    insert.run(value.id, ownerId, value.label, value.url, value.position, createdAt);
    return value;
  });
}

export function readResources(
  db: BasicLinearDatabase,
  table: 'project_resources' | 'issue_resources',
  ownerColumn: 'project_id' | 'issue_id',
  ownerId: string,
): Array<{ id: string; label: string; url: string; position: number }> {
  return db.sqlite.prepare(
    `SELECT id, label, url, position FROM ${table} WHERE ${ownerColumn} = ? ORDER BY position, id`,
  ).all(ownerId) as Array<{ id: string; label: string; url: string; position: number }>;
}

export function recordActivity(
  db: BasicLinearDatabase,
  input: {
    actorUserId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    entityRevision: number;
    fields?: FieldChange[];
    createdAt?: string;
  },
): number {
  const result = db.sqlite.prepare(`
    INSERT INTO activity_entries
      (actor_user_id, entity_type, entity_id, action, entity_revision, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.actorUserId,
    input.entityType,
    input.entityId,
    input.action,
    input.entityRevision,
    JSON.stringify({ fields: input.fields ?? [] }),
    input.createdAt ?? now(),
  );
  return Number(result.lastInsertRowid);
}

export function listActivity(
  db: BasicLinearDatabase,
  entityTypes: readonly string[],
  entityIds: readonly string[],
  limit: number,
): DbActivityEntry[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
    throw new AppError('VALIDATION_ERROR', 'The activity limit is invalid.', 400, { field: 'limit' });
  }
  if (entityTypes.length === 0 || entityIds.length === 0) return [];
  const typeMarks = entityTypes.map(() => '?').join(', ');
  const idMarks = entityIds.map(() => '?').join(', ');
  const owner = db.sqlite.prepare('SELECT id, display_name AS displayName FROM owner_profile WHERE singleton = 1')
    .get() as { id: string; displayName: string } | undefined;
  const rows = db.sqlite.prepare(`
    SELECT id, actor_user_id AS actorUserId, entity_type AS entityType, entity_id AS entityId,
           action, entity_revision AS entityRevision, metadata, created_at AS createdAt
    FROM activity_entries
    WHERE entity_type IN (${typeMarks}) AND entity_id IN (${idMarks})
    ORDER BY id DESC LIMIT ?
  `).all(...entityTypes, ...entityIds, limit) as Array<{
    id: number;
    actorUserId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    entityRevision: number;
    metadata: string;
    createdAt: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    entityRevision: row.entityRevision,
    actor: row.actorUserId !== null && owner?.id === row.actorUserId
      ? { id: owner.id, displayName: owner.displayName }
      : null,
    fields: json<{ fields?: FieldChange[] }>(row.metadata).fields ?? [],
    createdAt: row.createdAt,
  }));
}

export function idempotentEntity(
  db: BasicLinearDatabase,
  userId: string,
  operation: string,
  key: string,
): string | undefined {
  const row = db.sqlite.prepare(`
    SELECT entity_id AS entityId FROM idempotency_records
    WHERE operation = ? AND key = ? AND user_id = ?
  `).get(operation, key, userId) as { entityId: string } | undefined;
  return row?.entityId;
}

export function rememberIdempotency(
  db: BasicLinearDatabase,
  input: { userId: string; operation: string; key: string; entityId: string; revision: number },
): void {
  db.sqlite.prepare(`
    INSERT INTO idempotency_records
      (operation, key, user_id, entity_id, entity_revision, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.operation, input.key, input.userId, input.entityId, input.revision, now());
  db.sqlite.exec(`
    DELETE FROM idempotency_records
    WHERE (operation, key) IN (
      SELECT operation, key FROM idempotency_records ORDER BY created_at DESC LIMIT -1 OFFSET 1000
    )
  `);
}

export function progressFor(
  db: BasicLinearDatabase,
  column: 'project_id' | 'milestone_id',
  id: string,
): DbProgressSnapshot {
  const rows = db.sqlite.prepare(`
    SELECT s.category FROM issues i JOIN workflow_statuses s ON s.id = i.status_id
    WHERE i.${column} = ? AND i.archived_at IS NULL
  `).all(id) as Array<{ category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled' }>;
  const completedCount = rows.filter((row) => row.category === 'completed').length;
  const canceledCount = rows.filter((row) => row.category === 'canceled').length;
  const eligibleCount = rows.length - canceledCount;
  return {
    policy: 'project-progress-v1',
    issueCount: rows.length,
    completedCount,
    canceledCount,
    eligibleCount,
    fraction: eligibleCount === 0 ? 0 : completedCount / eligibleCount,
  };
}

export function bindValues(values: readonly unknown[]): SQLInputValue[] {
  return values.map((value) => {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
      return value;
    }
    throw new AppError('INTERNAL_ERROR', 'Unsupported SQLite bind value.', 500);
  });
}
