import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasCapability } from '@basiclinear/domain';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('milestone purge surface', () => {
  it('reserves irreversible milestone purge for the owner capability', () => {
    expect(hasCapability('owner', 'milestone:purge')).toBe(true);
    expect(hasCapability('admin', 'milestone:purge')).toBe(false);
    expect(hasCapability('member', 'milestone:purge')).toBe(false);
    expect(hasCapability('guest', 'milestone:purge')).toBe(false);
  });

  it('uses one revisioned, exact-confirmation client request', async () => {
    const api = await source('apps/web/src/api.ts');
    expect(api).toContain('purgeMilestone: (');
    expect(api).toContain('milestoneId: string,');
    expect(api).toContain('expectedRevision: number,');
    expect(api).toContain('confirmation: string,');
    expect(api).toContain('/milestones/${milestoneId}/purge`');
    expect(api).toContain('body: json({ expectedRevision, confirmation })');
  });

  it('shows purge only for an archived milestone and names the preservation consequence', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain('canPurgeMilestones && milestone.archivedAt !== null');
    expect(projects).toContain('data-milestone-purge={milestone.id}');
    expect(projects).toContain('milestonePurgeTarget.milestone.archivedAt !== null');
    expect(projects).toContain('Type <strong>{milestonePurgeTarget.milestone.name}</strong> to confirm');
    expect(projects).toContain('Linked issues are preserved in this project and moved to no milestone.');
    expect(projects).toContain('milestone.revision,');
  });

  it('clears invalid context, refreshes dependent reads, restores focus, and reports the count', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain('if (milestoneIssueFilterId === receipt.id) setMilestoneIssueFilterId(null);');
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['workspace-milestones', workspaceId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['issues', workspaceId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['issue-activity', workspaceId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['project-activity', workspaceId, receipt.projectId] })");
    expect(projects).toContain('(target ?? milestoneArchivedToggleRef.current)?.focus();');
    expect(projects).toContain('${receipt.detachedIssueCount} ${issueLabel} preserved in this project');
  });

  it('keeps long confirmation copy inside the established dialog geometry', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.milestone-purge-form p {');
    expect(styles).toContain('line-height: 1.5;');
  });
});
