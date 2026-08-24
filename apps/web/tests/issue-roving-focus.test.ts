import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveRovingIssueId } from '../src/issue-roving-focus.js';

const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));

describe('dynamic issue roving focus', () => {
  it('preserves the preferred issue across collection reorder', () => {
    expect(resolveRovingIssueId(['issue-c', 'issue-a', 'issue-b'], 'issue-b', 'issue-a')).toBe('issue-b');
  });

  it('falls back to the active issue when the preferred issue is no longer visible', () => {
    expect(resolveRovingIssueId(['issue-a', 'issue-c'], 'issue-b', 'issue-c')).toBe('issue-c');
  });

  it('falls back to the first visible issue when neither preferred nor active is visible', () => {
    expect(resolveRovingIssueId(['issue-c', 'issue-a'], 'issue-b', 'issue-d')).toBe('issue-c');
    expect(resolveRovingIssueId(['issue-c', 'issue-a'], null, null)).toBe('issue-c');
  });

  it('exposes no roving issue when the collection is empty', () => {
    expect(resolveRovingIssueId([], 'issue-b', 'issue-a')).toBeNull();
  });

  it('binds the stable resolver to both virtualized issue layouts', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');
    expect(source.match(/resolveRovingIssueId\(/gu)).toHaveLength(2);
    expect(source.match(/tabIndex=\{rovingIssueId === issue\.id \? 0 : -1\}/gu)).toHaveLength(2);
    expect(source).not.toContain('const [focusedIndex, setFocusedIndex]');
  });
});
