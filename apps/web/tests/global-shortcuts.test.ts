import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  resolveGlobalShortcutAction,
  type GlobalShortcutInput,
} from '../src/global-shortcuts.js';

const appSourcePath = fileURLToPath(new URL('../src/App.tsx', import.meta.url));
const baseInput: GlobalShortcutInput = {
  key: '',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
  withinEditable: false,
  withinDialog: false,
  withinCommandDialog: false,
};

const resolve = (input: Partial<GlobalShortcutInput>) => resolveGlobalShortcutAction({ ...baseInput, ...input });

describe('global keyboard shortcuts', () => {
  it('accepts only the exact primary-modifier search chord', () => {
    expect(resolve({ key: 'k', metaKey: true })).toBe('toggle-command');
    expect(resolve({ key: 'K', ctrlKey: true })).toBe('toggle-command');
    expect(resolve({ key: 'k', metaKey: true, shiftKey: true })).toBeNull();
    expect(resolve({ key: 'k', ctrlKey: true, altKey: true })).toBeNull();
    expect(resolve({ key: 'k' })).toBeNull();
  });

  it('does not override editable content or stack over another modal', () => {
    expect(resolve({ key: 'k', metaKey: true, withinEditable: true })).toBeNull();
    expect(resolve({ key: 'k', metaKey: true, withinDialog: true })).toBeNull();
    expect(resolve({
      key: 'k',
      metaKey: true,
      withinEditable: true,
      withinDialog: true,
      withinCommandDialog: true,
    })).toBe('toggle-command');
  });

  it('accepts issue creation only for an unmodified C outside editing and dialogs', () => {
    expect(resolve({ key: 'c' })).toBe('create-issue');
    expect(resolve({ key: 'C' })).toBe('create-issue');
    expect(resolve({ key: 'c', metaKey: true })).toBeNull();
    expect(resolve({ key: 'c', ctrlKey: true })).toBeNull();
    expect(resolve({ key: 'c', shiftKey: true })).toBeNull();
    expect(resolve({ key: 'c', altKey: true })).toBeNull();
    expect(resolve({ key: 'c', withinEditable: true })).toBeNull();
    expect(resolve({ key: 'c', withinDialog: true })).toBeNull();
  });

  it('ignores claimed, repeating, composing, and unrelated key events', () => {
    expect(resolve({ key: 'c', defaultPrevented: true })).toBeNull();
    expect(resolve({ key: 'c', repeat: true })).toBeNull();
    expect(resolve({ key: 'c', isComposing: true })).toBeNull();
    expect(resolve({ key: 'x' })).toBeNull();
  });

  it('binds the resolver to the application dispatcher', async () => {
    const source = await readFile(appSourcePath, 'utf8');
    expect(source).toContain('resolveGlobalShortcutAction({');
    expect(source).toContain("Boolean(target?.closest('input, textarea, select, [contenteditable=\"true\"]'))");
    expect(source).toContain("Boolean(target?.closest('.command-palette'))");
    expect(source).toContain("if (action === 'toggle-command')");
    expect(source).toContain("if (action !== 'create-issue' || !canWriteIssues) return;");
  });
});
