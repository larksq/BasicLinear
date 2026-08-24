import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nativeDateCommitDecision,
  nativeDateInputShouldSync,
} from '../src/native-date-input.js';

describe('buffered native date input', () => {
  it('keeps focused native partial input across parent rerenders', () => {
    expect(nativeDateInputShouldSync(true, true)).toBe(false);
    expect(nativeDateInputShouldSync(true, false)).toBe(true);
    expect(nativeDateInputShouldSync(false, true)).toBe(true);
  });

  it('commits complete changes and deliberate clears only after validation', () => {
    expect(nativeDateCommitDecision(null, null, '2026-10-30', true))
      .toEqual({ action: 'commit', value: '2026-10-30' });
    expect(nativeDateCommitDecision('2026-10-30', '2026-10-30', '', true))
      .toEqual({ action: 'commit', value: null });
    expect(nativeDateCommitDecision(null, null, '', false))
      .toEqual({ action: 'restore', value: '' });
  });

  it('restores current authority when a focused draft has gone stale', () => {
    expect(nativeDateCommitDecision(
      '2026-11-15',
      '2026-10-30',
      '2026-12-20',
      true,
    )).toEqual({ action: 'restore', value: '2026-11-15' });
  });

  it('binds the buffered component to issue, project, and milestone date surfaces', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [component, issues, projects] = await Promise.all([
      readFile(join(root, 'apps/web/src/buffered-date-input.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/projects.tsx'), 'utf8'),
    ]);
    expect(component).toContain("defaultValue={value ?? ''}");
    expect(component).toContain('dirtyRef.current = true;');
    expect(component).toContain('nativeDateInputShouldSync(');
    expect(component).toContain('nativeDateCommitDecision(');
    expect(issues).toContain('<BufferedDateInput label="Issue due date"');
    expect(projects).toContain('<BufferedDateInput label="Project start date"');
    expect(projects).toContain('<BufferedDateInput label="Project target date"');
    expect(projects).toContain('<BufferedDateInput label="Milestone target date"');
  });
});
