import type { WorkspaceEvent } from '@openlinear/contracts';
import { AppError } from '@openlinear/domain';
import type { OpenLinearDatabase } from './client.js';
import { requireOwnerScope } from './helpers.js';

const maximumCursor = 9_223_372_036_854_775_807n;

export async function listWorkspaceEvents(
  db: OpenLinearDatabase,
  userId: string,
  workspaceId: string,
  afterCursor: string,
  limit: number,
): Promise<WorkspaceEvent[]> {
  requireOwnerScope(db, userId, workspaceId);
  if (!/^(0|[1-9][0-9]*)$/.test(afterCursor)
    || afterCursor.length > 19
    || BigInt(afterCursor) > maximumCursor
    || !Number.isSafeInteger(limit)
    || limit < 1
    || limit > 200) {
    throw new AppError('VALIDATION_ERROR', 'The event cursor is invalid.', 400, { field: 'cursor' });
  }
  return (db.sqlite.prepare(`
    SELECT CAST(id AS TEXT) AS cursor, entity_type AS entityType, entity_id AS entityId,
           entity_revision AS revision FROM activity_entries WHERE id > ? ORDER BY id LIMIT ?
  `).all(BigInt(afterCursor), limit) as Array<{
    cursor: string;
    entityType: string;
    entityId: string;
    revision: number;
  }>).map((row) => ({ ...row, workspaceId }));
}
