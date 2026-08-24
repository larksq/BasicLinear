import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveRovingProjectId } from '../src/project-roving-focus.js';

const projectsSourcePath = fileURLToPath(new URL('../src/projects.tsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

describe('project row interaction contract', () => {
  it('keeps a preferred project as the one row tab stop across reorder', () => {
    expect(resolveRovingProjectId(['p-1', 'p-2', 'p-3'], 'p-2')).toBe('p-2');
    expect(resolveRovingProjectId(['p-3', 'p-2', 'p-1'], 'p-2')).toBe('p-2');
  });

  it('falls back deterministically when the preferred row disappears', () => {
    expect(resolveRovingProjectId(['p-3', 'p-1'], 'p-2')).toBe('p-3');
    expect(resolveRovingProjectId(['p-3'], null)).toBe('p-3');
    expect(resolveRovingProjectId([], 'p-2')).toBeNull();
  });

  it('binds selection, roving focus, and named menu semantics to the project grid', async () => {
    const source = await readFile(projectsSourcePath, 'utf8');
    expect(source).toContain('role="grid"');
    expect(source).toContain('aria-multiselectable={canWriteProjects || undefined}');
    expect(source).toContain('tabIndex={rovingProjectId === item.id ? 0 : -1}');
    expect(source).toContain('aria-selected={canWriteProjects ? selectedProjectIds.has(item.id) : undefined}');
    expect(source).toContain('aria-haspopup="menu"');
    expect(source).toContain('aria-controls={openProjectMenuId === item.id ? `project-menu-${item.id}` : undefined}');
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("event.key === 'Escape'");
    expect(source).toContain('resolveMenuFocusIndex(event.key, currentIndex, items.length)');
    expect(source).toContain('onContextMenu={(event) =>');
  });

  it('keeps selected and menu layers inside fixed row geometry', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.project-row.selected');
    expect(styles).toContain('.project-row-leading');
    expect(styles).toContain('.project-row-menu { position: absolute;');
    expect(styles).toContain('.project-bulk-toolbar { min-height: 42px;');
  });

  it('keeps project status and actions reachable on narrow screens', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.project-row, .project-group-row { grid-template-columns: minmax(0, 1fr) 116px 30px; }');
    expect(styles).toContain('.project-row > .project-property-cell:not(.project-property-status), .project-row-header > .project-property-header:not(.project-property-status) { display: none; }');
    expect(styles).toContain('.project-row > .project-row-actions { grid-column: 3; display: flex; }');
    expect(styles).toContain('.loading-skeleton-table-projects .skeleton-table-row > :nth-child(n + 3) { display: none; }');
  });
});
