import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('single owner product surface', () => {
  it('starts one local owner session without setup, login, or account controls', async () => {
    const [app, api] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/api.ts'),
    ]);

    expect(app).toContain('mutationFn: api.localOwnerSession');
    expect(app).toContain('if (started.current) return;');
    expect(app).toContain("const workspace = session.workspaces.length === 1 && session.workspaces[0]?.role === 'owner'");
    expect(api).toContain("localOwnerSession: () => request<Session>('/api/v1/local-owner-session', {");
    expect(api).toContain("'x-openlinear-csrf': csrfToken");
    expect(api).toContain("body: '{}'");
    for (const unsupported of [
      'setupState', 'LoginScreen', 'SetupScreen', 'startOidcLink', 'changePassword',
      'createWorkspace', 'createTeam', 'createMembership', 'logout:',
    ]) {
      expect(`${app}\n${api}`).not.toContain(unsupported);
    }
  });

  it('renders only the owner navigation and filters collaboration records out of props', async () => {
    const app = await source('apps/web/src/App.tsx');

    for (const label of ['My work', 'Projects', 'Issues', 'Views', 'Workflow']) {
      expect(app).toContain(`aria-label="${label}"`);
    }
    for (const unsupported of [
      'aria-label="Teams"', 'aria-label="Members"', 'Team navigation', 'role-badge',
      'New workspace', 'New team', 'Add local member', 'Sign out', 'Change password',
    ]) {
      expect(app).not.toContain(unsupported);
    }
    expect(app).toContain('(membership) => membership.userId === session.user.id');
    expect(app).toContain('const systemTeam = teams.data?.[0];');
    expect(app).toContain('ownerContextUnavailable');
    expect(app).toContain('ownerMode');
  });

  it('keeps issue, project, and saved-view creation fixed to the owner context', async () => {
    const [issues, projects, views] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/saved-views.tsx'),
    ]);

    expect(issues).toContain('assigneeUserId: ownerMode ? initialAssigneeUserId || null : assigneeUserId || null');
    expect(issues).toContain('{!ownerMode ? <label className="field"><span>Team</span>');
    expect(issues).toContain('{!ownerMode ? <label className="field"><span>Assignee</span>');
    expect(issues).toContain("sharingScope: 'private'");
    expect(issues).not.toContain('name="sharingScope"');
    expect(projects).toContain('lockTeam ? teams[0]?.id ?? \'\' : String(data.get(\'teamId\'))');
    expect(projects).toContain("visibleProperties.filter((property) => property !== 'team')");
    expect(views).toContain("sharingScope: 'private'");
    expect(views).not.toContain('<th scope="col">Access</th>');
  });

  it('makes issue ownership read-only across detail, quick edit, bulk, and board paths', async () => {
    const issues = await source('apps/web/src/issues.tsx');

    expect(issues).toContain('ownerMode ? <div className="issue-owner-property"><span>Owner</span>');
    expect(issues).toContain('assigneeUserId: ownerMode');
    expect(issues).toContain('? issue.assigneeUserId');
    expect(issues).toMatch(/ownerMode\s*\?\s*\{ \.\.\.values, assigneeUserId: quickEditIssue\.assigneeUserId \}/u);
    expect(issues).toContain("ownerMode && bulkDraft.assigneeUserId !== ''");
    expect(issues).toContain('{!ownerMode ? <label>\n              <span className="sr-only">Bulk assignee</span>');
    expect(issues).toContain('{!ownerMode ? <option value="assignee">Assignee</option> : null}');
    expect(issues).toContain("ownerMode && viewState.groupBy === 'assignee'");
    expect(issues).toContain('enforceOwnerViewBoundary(withoutIssueQueryScope');
    expect(issues.match(/<IssueDetail[^>]+ownerMode=\{ownerMode\}/gu)).toHaveLength(2);
    expect(issues).toContain('ownerMode={ownerMode}\n          ownerDisplayName=');
  });

  it('canonicalizes legacy workspace, team, and administration URLs without retaining record state', async () => {
    const navigation = await source('apps/web/src/workspace-navigation.ts');

    expect(navigation).toContain('const legacyScope = url.searchParams.has(\'workspace\') || url.searchParams.has(\'team\');');
    expect(navigation).toContain('if (legacyScope || unsupportedView) clearWorkspaceViewParameters(url);');
    expect(navigation).toContain("url.searchParams.delete('workspace');");
    expect(navigation).toContain("url.searchParams.delete('team');");
    for (const unsupportedView of ['overview', 'teams', 'members']) {
      expect(navigation).not.toContain(`  '${unsupportedView}',`);
    }
  });
});
