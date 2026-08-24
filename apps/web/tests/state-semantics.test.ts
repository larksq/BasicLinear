import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('stateful control semantics', () => {
  it('marks exactly the active owner destination as current', async () => {
    const app = await source('apps/web/src/App.tsx');
    for (const view of ['my-work', 'projects', 'issues', 'views', 'workflow']) {
      expect(app).toContain(`aria-current={view === '${view}' ? 'page' : undefined}`);
    }
    for (const view of ['overview', 'teams', 'members']) {
      expect(app).not.toContain(`aria-current={view === '${view}' ? 'page' : undefined}`);
    }
    expect(app).not.toContain('activeTeam');
  });

  it('exposes the selected issue layout as a pressed button', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain("aria-pressed={viewState.layout === 'list'}");
    expect(issues).toContain("aria-pressed={viewState.layout === 'board'}");
  });

  it('exposes the selected filter join operator as pressed', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain("aria-pressed={join === 'and'}");
    expect(issues).toContain("aria-pressed={join === 'or'}");
  });

  it('exposes each rich-text tool toggle state', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain("className={`editor-tool ${active ? 'active' : ''}`}");
    expect(issues).toContain('aria-pressed={active}');
  });
});
