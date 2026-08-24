import type { WorkspaceEvent } from '@openlinear/contracts';
import { AppError } from '@openlinear/domain';

const maximumCursor = 9_223_372_036_854_775_807n;

export function resolveEventCursor(queryCursor: string | undefined, lastEventId: unknown): string {
  const header = typeof lastEventId === 'string' ? lastEventId.trim() : undefined;
  const candidate = queryCursor ?? (header === '' ? undefined : header) ?? '0';
  if (!/^(0|[1-9][0-9]*)$/.test(candidate)
    || candidate.length > 19
    || BigInt(candidate) > maximumCursor) {
    throw new AppError('VALIDATION_ERROR', 'The event cursor is invalid.', 400, { field: 'cursor' });
  }
  return candidate;
}

export function serializeWorkspaceEvents(events: WorkspaceEvent[]): string {
  let stream = 'retry: 2000\n\n';
  if (events.length === 0) return `${stream}: keepalive\n\n`;
  for (const event of events) {
    stream += `id: ${event.cursor}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`;
  }
  return stream;
}
