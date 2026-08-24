import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  projectDensityStorageKey,
  projectRowHeight,
  readProjectDensity,
  writeProjectDensity,
  type ProjectDensity,
} from '../src/project-density.js';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('project density', () => {
  it('maps the accepted compact, default, and comfortable row heights', () => {
    expect(projectRowHeight('compact')).toBe(32);
    expect(projectRowHeight('default')).toBe(36);
    expect(projectRowHeight('comfortable')).toBe(44);
  });

  it.each<ProjectDensity>(['compact', 'default', 'comfortable'])('restores the valid %s preference', (density) => {
    expect(readProjectDensity({ getItem: () => density })).toBe(density);
  });

  it('defaults invalid, missing, and unavailable storage safely', () => {
    expect(readProjectDensity({ getItem: () => null })).toBe('default');
    expect(readProjectDensity({ getItem: () => 'dense' })).toBe('default');
    expect(readProjectDensity({ getItem: () => { throw new Error('unavailable'); } })).toBe('default');
  });

  it('persists the exact valid preference and tolerates write failure', () => {
    const setItem = vi.fn();
    writeProjectDensity({ setItem }, 'comfortable');
    expect(setItem).toHaveBeenCalledWith(projectDensityStorageKey, 'comfortable');
    expect(() => writeProjectDensity({ setItem: () => { throw new Error('unavailable'); } }, 'compact')).not.toThrow();
  });

  it('binds one named preference to loaded and loading project geometry', async () => {
    const [projects, components, styles] = await Promise.all([
      source('../src/projects.tsx'),
      source('../src/components.tsx'),
      source('../src/styles.css'),
    ]);

    expect(projects).toContain('<span className="sr-only">Project density</span>');
    expect(projects).toContain('tableDensity={density}');
    expect(projects).toContain('project-density-${density}');
    expect(components).toContain('loading-skeleton-project-density-${tableDensity}');
    expect(styles).toMatch(/project-density-compact[^}]+height: 32px/);
    expect(styles).toMatch(/project-density-default[^}]+height: 36px/);
    expect(styles).toMatch(/project-density-comfortable[^}]+height: 44px/);
    expect(styles).toMatch(/loading-skeleton-project-density-compact[^}]+min-height: 258px/);
    expect(styles).toMatch(/loading-skeleton-project-density-default[^}]+min-height: 286px/);
    expect(styles).toMatch(/loading-skeleton-project-density-comfortable[^}]+min-height: 342px/);
    expect(styles).not.toContain('.project-row { min-height: 58px;');
  });
});
