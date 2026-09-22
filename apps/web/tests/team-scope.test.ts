import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('fixed owner workspace contract', () => {
  it('canonicalizes legacy workspace and team scope before rendering the owner shell', async () => {
    const [app, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/workspace-navigation.ts'),
    ]);

    expect(app).toContain('const canonical = ownerWorkspaceUrl(window.location.href);');
    expect(app).toContain("window.history.replaceState(null, '', canonical);");
    expect(app).not.toContain('teamIdFromSearch(');
    expect(app).not.toContain('data-team-id=');
    expect(app).not.toContain('aria-label="Team navigation"');
    expect(navigation).toContain("url.searchParams.delete('workspace');");
    expect(navigation).toContain("url.searchParams.delete('team');");
    expect(navigation).toContain('if (legacyScope || unsupportedView) clearWorkspaceViewParameters(url);');
  });

  it('keeps saved views in one private owner library', async () => {
    const [app, views, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/saved-views.tsx'),
      source('apps/web/src/workspace-navigation.ts'),
    ]);

    expect(app).toContain('savedViewNavigationUrl(window.location.href, savedViewId)');
    expect(app).not.toContain('teamContext');
    expect(views).toContain("sharingScope: 'private'");
    expect(views).not.toContain('teamContext');
    expect(views).not.toContain('<span>Access</span>');
    expect(views).toContain('aria-describedby="saved-views-description"');
    expect(navigation).toContain("url.searchParams.delete('team');");
  });

  it('keeps the implicit team internal while fixing issue creation to the owner', async () => {
    const issues = await source('apps/web/src/issues.tsx');

    expect(issues).toContain("systemTeam?: Pick<Team, 'id' | 'name'>;");
    expect(issues).toContain('{ teamId: systemTeamId }');
    expect(issues).toContain('{ teamId: systemTeamId }),\n    archiveState: \'all\' as const');
    expect(issues).toContain('selectedIssueScope.data.teamId !== systemTeamId');
    expect(issues).toContain('if (!selectedIssueRejected) return;');
    expect(issues).toContain('contextTeam?: Pick<Team, \'id\' | \'name\'>;');
    expect(issues).toContain('disabled={contextProject !== undefined || contextTeam !== undefined}');
    expect(issues).toContain("...(systemTeam === undefined ? [] : ['teamId' as const])");
    expect(issues).toContain('withoutIssueQueryScope(cloneIssueViewState(saved.state), systemScope)');
    expect(issues).toContain('const initialCreateAssigneeUserId = ownerMode ? currentUserId : systemAssigneeUserId;');
    expect(issues).toContain('ownerMode={ownerMode}');
    expect(issues).toContain('{!ownerMode ? <label className="field"><span>Team</span>');
    expect(issues).toContain('{!ownerMode ? <label className="field"><span>Assignee</span>');
  });

  it('keeps project scope internal and removes team presentation in owner mode', async () => {
    const projects = await source('apps/web/src/projects.tsx');

    expect(projects).toContain("systemTeam?: Pick<Team, 'id' | 'name'>;");
    expect(projects).toContain('{ teamId: systemTeam.id }');
    expect(projects).toContain('project.data.teamId === systemTeam.id');
    expect(projects).toContain('if (selectedProjectId === null || project.data === undefined || selectedProjectInScope) return;');
    expect(projects).toContain('window.history.replaceState(projectRouteHistoryState(null, null), \'\', url);');
    expect(projects).toContain('teams.filter((team) => team.id === systemTeam.id)');
    expect(projects).toContain('lockTeam={systemTeam !== undefined}');
    expect(projects).toContain("const effectiveGroupBy = systemTeam !== undefined && groupBy === 'team' ? 'none' : groupBy;");
    expect(projects).toContain("visibleProperties.filter((property) => property !== 'team')");
    expect(projects).toContain('hideTeam={systemTeam !== undefined}');
    expect(projects).toContain('ownerMode={systemTeam !== undefined}');
  });

  it('keeps stable responsive navigation geometry for the owner brand', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(styles).toContain('.sidebar-scroll { min-height: 0; flex: 1 1 auto; overflow-y: auto;');
    expect(styles).toContain('.owner-brand { min-height: 34px; display: grid;');
    expect(styles).toContain('.rail-collapsed .owner-brand > span { display: none; }');
    expect(styles).not.toContain('.team-view-switcher { height: 28px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));');
  });

  it('renders only owner destinations in the application shell', async () => {
    const app = await source('apps/web/src/App.tsx');

    for (const label of ['My work', 'Projects', 'Issues', 'Views', 'Workflow']) {
      expect(app).toContain(`aria-label="${label}"`);
    }
    for (const label of ['Teams', 'Members', 'New workspace', 'New team']) {
      expect(app).not.toContain(`aria-label="${label}"`);
    }
  });
});
