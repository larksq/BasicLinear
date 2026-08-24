import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  resolveMenuFocusIndex,
  resolveIssueViewKeyAction,
  resolveRecordKeyAction,
  type LocalKeyInput,
} from '../src/local-keyboard-actions.js';

const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));
const projectsSourcePath = fileURLToPath(new URL('../src/projects.tsx', import.meta.url));
const baseInput: LocalKeyInput = {
  key: '',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  withinExcludedTarget: false,
  selectionEnabled: true,
};

const viewAction = (input: Partial<LocalKeyInput>) => resolveIssueViewKeyAction({ ...baseInput, ...input });
const recordAction = (input: Partial<LocalKeyInput>) => resolveRecordKeyAction({ ...baseInput, ...input });

describe('local keyboard actions', () => {
  it('maps the exact issue-view keys to their existing actions', () => {
    expect(viewAction({ key: '/' })).toBe('focus-search');
    expect(viewAction({ key: 'f' })).toBe('open-filter');
    expect(viewAction({ key: 'B' })).toBe('toggle-layout');
    expect(viewAction({ key: 'x' })).toBeNull();
  });

  it('does not override modified, repeated, composing, claimed, or excluded view events', () => {
    expect(viewAction({ key: 'f', ctrlKey: true })).toBeNull();
    expect(viewAction({ key: 'b', metaKey: true })).toBeNull();
    expect(viewAction({ key: 'B', shiftKey: true })).toBeNull();
    expect(viewAction({ key: '/', altKey: true })).toBeNull();
    expect(viewAction({ key: 'b', repeat: true })).toBeNull();
    expect(viewAction({ key: 'b', isComposing: true })).toBeNull();
    expect(viewAction({ key: 'b', defaultPrevented: true })).toBeNull();
    expect(viewAction({ key: 'b', withinExcludedTarget: true })).toBeNull();
  });

  it('maps unmodified record keys without conflating open, selection, and navigation', () => {
    expect(recordAction({ key: 'Enter' })).toBe('open');
    expect(recordAction({ key: ' ' })).toBe('toggle-selection');
    expect(recordAction({ key: 'ArrowDown' })).toBe('next');
    expect(recordAction({ key: 'j' })).toBe('next');
    expect(recordAction({ key: 'ArrowUp' })).toBe('previous');
    expect(recordAction({ key: 'K' })).toBe('previous');
  });

  it('preserves reserved chords and nested controls while allowing navigation repeat', () => {
    expect(recordAction({ key: 'k', metaKey: true })).toBeNull();
    expect(recordAction({ key: 'f', ctrlKey: true })).toBeNull();
    expect(recordAction({ key: 'j', shiftKey: true })).toBeNull();
    expect(recordAction({ key: 'Enter', repeat: true })).toBeNull();
    expect(recordAction({ key: ' ', repeat: true })).toBeNull();
    expect(recordAction({ key: 'ArrowDown', repeat: true })).toBe('next');
    expect(recordAction({ key: 'k', isComposing: true })).toBeNull();
    expect(recordAction({ key: 'k', defaultPrevented: true })).toBeNull();
    expect(recordAction({ key: 'k', withinExcludedTarget: true })).toBeNull();
    expect(recordAction({ key: ' ', selectionEnabled: false })).toBeNull();
  });

  it('accepts only exact record context-menu gestures when enabled', () => {
    expect(recordAction({ key: 'ContextMenu', menuEnabled: true })).toBe('open-menu');
    expect(recordAction({ key: 'F10', shiftKey: true, menuEnabled: true })).toBe('open-menu');
    expect(recordAction({ key: 'ContextMenu' })).toBeNull();
    expect(recordAction({ key: 'F10', menuEnabled: true })).toBeNull();
    expect(recordAction({ key: 'F10', shiftKey: true, ctrlKey: true, menuEnabled: true })).toBeNull();
    expect(recordAction({ key: 'ContextMenu', repeat: true, menuEnabled: true })).toBeNull();
    expect(recordAction({ key: 'ContextMenu', isComposing: true, menuEnabled: true })).toBeNull();
    expect(recordAction({ key: 'ContextMenu', withinExcludedTarget: true, menuEnabled: true })).toBeNull();
  });

  it('moves within enabled menu items with wraparound and boundaries', () => {
    expect(resolveMenuFocusIndex('ArrowDown', 0, 3)).toBe(1);
    expect(resolveMenuFocusIndex('ArrowDown', 2, 3)).toBe(0);
    expect(resolveMenuFocusIndex('ArrowUp', 0, 3)).toBe(2);
    expect(resolveMenuFocusIndex('Home', 2, 3)).toBe(0);
    expect(resolveMenuFocusIndex('End', 0, 3)).toBe(2);
    expect(resolveMenuFocusIndex('Enter', 0, 3)).toBeNull();
    expect(resolveMenuFocusIndex('ArrowDown', 0, 0)).toBeNull();
  });

  it('binds the resolvers to issue view, list, and board dispatchers', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');
    expect(source.match(/resolveRecordKeyAction\(\{/gu)).toHaveLength(2);
    expect(source.match(/menuEnabled: true/gu)).toHaveLength(2);
    expect(source.match(/action === 'open-menu'/gu)).toHaveLength(2);
    expect(source.match(/onContextMenu=\{\(event\) =>/gu)).toHaveLength(2);
    expect(source).toContain('const action = resolveIssueViewKeyAction({');
    expect(source).toContain('if (action === null) return;');
    expect(source).toContain("if (action === 'focus-search')");
    expect(source).toContain("else if (action === 'toggle-layout')");
  });

  it('binds exact record actions to project rows', async () => {
    const source = await readFile(projectsSourcePath, 'utf8');
    expect(source).toContain('const action = resolveRecordKeyAction({');
    expect(source).toContain("if (action === 'open')");
    expect(source).toContain("else if (action === 'next')");
    expect(source).toContain("else if (action === 'previous')");
    expect(source).toContain("else if (action === 'toggle-selection')");
    expect(source).toContain("else if (action === 'open-menu')");
    expect(source).toContain('selectionEnabled: canWriteProjects');
    expect(source).toContain('menuEnabled: true');
  });
});
