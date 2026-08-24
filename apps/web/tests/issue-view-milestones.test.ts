import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  issueMilestoneLabel,
  milestoneViewLabel,
  milestoneViewOptions,
} from '../src/issue-view-milestones.js';

const projects = [
  { id: 'project-b', name: 'Beta' },
  { id: 'project-a', name: 'Alpha' },
];
const milestones = [
  { id: 'milestone-b2', projectId: 'project-b', name: 'Launch', position: 200, archivedAt: null },
  { id: 'milestone-a2', projectId: 'project-a', name: 'Release', position: 200, archivedAt: '2026-08-20T00:00:00.000Z' },
  { id: 'milestone-a1', projectId: 'project-a', name: 'Design', position: 100, archivedAt: null },
];

describe('milestone-aware issue views', () => {
  it('disambiguates duplicate milestone names with project context', () => {
    expect(milestoneViewLabel(milestones[0]!, projects)).toBe('Beta / Launch');
    expect(milestoneViewLabel({ projectId: 'missing', name: 'Review' }, projects))
      .toBe('Unknown project / Review');
  });

  it('orders options by project and milestone position while retaining archive state', () => {
    expect(milestoneViewOptions(milestones, projects)).toEqual([
      { value: 'milestone-a1', label: 'Alpha / Design', projectId: 'project-a', position: 100, archived: false },
      { value: 'milestone-a2', label: 'Alpha / Release (archived)', projectId: 'project-a', position: 200, archived: true },
      { value: 'milestone-b2', label: 'Beta / Launch', projectId: 'project-b', position: 200, archived: false },
    ]);
  });

  it('names empty, missing, and assigned milestone values explicitly', () => {
    expect(issueMilestoneLabel({ milestoneId: null }, milestones, projects)).toBe('No milestone');
    expect(issueMilestoneLabel({ milestoneId: 'missing' }, milestones, projects)).toBe('Unknown milestone');
    expect(issueMilestoneLabel({ milestoneId: 'milestone-a1' }, milestones, projects)).toBe('Alpha / Design');
  });

  it('wires the workspace read contract and one shared list/board property model', async () => {
    const root = process.cwd();
    const [api, repository, schema, issues, configuration, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/api/src/app.ts'), 'utf8'),
      readFile(join(root, 'packages/db/src/sqlite/project-repository.ts'), 'utf8'),
      readFile(join(root, 'packages/db/src/sqlite/client.ts'), 'utf8'),
      readFile(join(root, 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/issue-view-configuration.ts'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(api).toContain("'/api/v1/workspaces/:workspaceId/milestones'");
    expect(api).toContain('listWorkspaceMilestones(');
    expect(repository).toContain('export async function listWorkspaceMilestones(');
    expect(repository).toContain('requireOwnerScope(db, userId, workspaceId);');
    expect(repository).toContain("${includeArchived ? '' : 'WHERE archived_at IS NULL'} ORDER BY project_id, position, id");
    expect(schema).toContain('CREATE TABLE saved_views');
    expect(schema).toContain('state TEXT NOT NULL CHECK (json_valid(state))');
    expect(issues).toContain("{ value: 'milestoneId', label: 'Milestone' }");
    expect(issues).toContain('<option value="milestone">Milestone</option>');
    expect(issues).toContain("properties.includes('milestone')");
    expect(issues).toContain("'project', 'milestone'].includes(groupBy ?? '')");
    expect(configuration).toContain('export const issueViewProperties = [');
    expect(configuration).toContain("'milestone',");
    expect(issues).toContain('className="issue-board-metadata" role="group"');
    expect(styles).toContain('.issue-board-metadata {');
    expect(styles).toContain('.issue-milestone-cell');
    expect(fixture).toContain('/\\/workspaces\\/[0-9a-f-]{36}\\/milestones$/i');
  });
});
