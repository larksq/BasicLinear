import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasCapability } from '@basiclinear/domain';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('project purge surface', () => {
  it('reserves irreversible project purge for the owner capability', () => {
    expect(hasCapability('owner', 'project:purge')).toBe(true);
    expect(hasCapability('admin', 'project:purge')).toBe(false);
    expect(hasCapability('member', 'project:purge')).toBe(false);
    expect(hasCapability('guest', 'project:purge')).toBe(false);
  });

  it('uses one revisioned, exact-confirmation client request', async () => {
    const api = await source('apps/web/src/api.ts');
    expect(api).toContain('purgeProject: (');
    expect(api).toContain('expectedRevision: number,');
    expect(api).toContain('confirmation: string,');
    expect(api).toContain('/projects/${projectId}/purge`');
    expect(api).toContain('body: json({ expectedRevision, confirmation })');
  });

  it('shows purge only for an archived project and names the preservation consequence', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain('canPurgeProjects && current.archivedAt !== null ? <button');
    expect(projects).toContain('data-project-purge');
    expect(projects).toContain('title={`Purge ${current.name}`}');
    expect(projects).toContain('projectPurgeOpen && canPurgeProjects && current.archivedAt !== null');
    expect(projects).toContain('Type <strong>{current.name}</strong> to confirm');
    expect(projects).toContain('Issues are preserved and moved to no project.');
    expect(projects).toContain('api.purgeProject(workspaceId, current.id, current.revision, confirmation)');
  });

  it('closes the invalid detail route, refreshes dependent reads, and exposes persistent status', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain('function closePurgedProject()');
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['projects', workspaceId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['issues', workspaceId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['workspace-milestones', workspaceId] })");
    expect(projects).toContain('className="project-purge-feedback" role="status"');
  });

  it('keeps long confirmation and completion copy inside stable geometry', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.project-purge-feedback { min-height: 32px;');
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('.project-purge-form p {');
  });
});
