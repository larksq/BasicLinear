import { describe, expect, it } from 'vitest';
import { AppError } from '@basiclinear/domain';
import { resolveEventCursor, serializeWorkspaceEvents } from '../src/events.js';

describe('workspace event protocol', () => {
  it('resolves query and reconnect cursors without accepting ambiguous integers', () => {
    expect(resolveEventCursor(undefined, undefined)).toBe('0');
    expect(resolveEventCursor(undefined, '42')).toBe('42');
    expect(resolveEventCursor('7', '42')).toBe('7');
    for (const invalid of ['-1', '+1', '01', '1.5', 'abc', '9223372036854775808']) {
      expect(() => resolveEventCursor(invalid, undefined)).toThrow(AppError);
    }
  });

  it('serializes only minimal revision hints with monotonic SSE identifiers', () => {
    const stream = serializeWorkspaceEvents([{
      cursor: '17',
      workspaceId: '00000000-0000-4000-8000-000000000001',
      entityType: 'issue',
      entityId: '00000000-0000-4000-8000-000000000002',
      revision: 3,
    }]);
    expect(stream).toContain('retry: 2000\n\n');
    expect(stream).toContain('id: 17\nevent: change\ndata: ');
    expect(stream).toContain('"revision":3');
    expect(stream).not.toMatch(/description|comment|token|password/i);
    expect(serializeWorkspaceEvents([])).toBe('retry: 2000\n\n: keepalive\n\n');
  });
});
