import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('desktop density-control contract', () => {
  it('keeps the visual fixture aligned with the local readiness contract', async () => {
    const fixture = await source('scripts/serve-visual-fixture.mjs');
    expect(fixture).toContain("path === '/health/ready'");
    expect(fixture).toContain("plainJson(response, { status: 'ready' })");
    expect(fixture).toContain("url.pathname.startsWith('/api/') || url.pathname.startsWith('/health/')");
  });

  it('exposes a named persistent navigation rail toggle', async () => {
    const [app, styles] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/styles.css'),
    ]);
    expect(app).toContain("readNavigationRailPreference(localStorage)");
    expect(app).toContain('railPreference ?? tabletRailDefault');
    expect(app).toContain('onClick={toggleNavigationRail}');
    expect(app).toContain("railCollapsed ? 'rail-collapsed' : ''");
    expect(app).toContain("railCollapsed ? 'Expand navigation' : 'Collapse navigation'");
    expect(styles).toContain('.app-shell { --ol-sidebar-width: 238px; }');
    expect(styles).toContain('.app-shell.rail-collapsed { grid-template-columns: 48px minmax(0, 1fr); }');
    expect(styles).toContain('.sidebar-collapse { display: none !important; }');
    expect(styles).toContain('@media (min-width: 768px)');
    expect(styles).toContain('@media (max-width: 767px)');
  });

  it('provides a first-class saved-view route and clears stale issue state before opening it', async () => {
    const [app, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/workspace-navigation.ts'),
    ]);
    expect(navigation).toContain("'projects',");
    expect(navigation).toContain("'issues',");
    expect(navigation).toContain("'views',");
    expect(app).toContain('aria-label="Views" aria-current={view === \'views\' ? \'page\' : undefined}');
    expect(app).toContain('const openSavedView = (savedViewId: string | null) => {');
    expect(app).toContain('savedViewNavigationUrl(window.location.href, savedViewId)');
    expect(navigation).toContain('export function savedViewNavigationUrl(');
    expect(app).toContain("window.history.pushState(null, '', url);");
    expect(app).toContain('onBuildView={() => openSavedView(null)}');
  });

  it('makes project details, tabs, and milestone drill-down URL-authoritative', async () => {
    const [app, projects, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/project-navigation.ts'),
    ]);
    expect(app).toContain("navigate('projects', { reset: true })");
    expect(app).toContain("setProjectOpenRequest((current) => ({ id: null, signal: current.signal + 1 }))");
    expect(projects).toContain('projectRouteFromSearch(');
    expect(projects).toContain('projectNavigationUrl(window.location.href');
    expect(projects).toContain("window.addEventListener('popstate', syncProjectRouteFromLocation)");
    expect(projects).toContain('isPushedProjectRoute(window.history.state, currentProjectId)');
    expect(projects).toContain('window.history.back()');
    expect(projects).toContain('setMilestoneIssueFilterId(milestone.id); setTab(\'issues\')');
    expect(navigation).toContain("url.searchParams.set('projectTab', route.tab)");
    expect(navigation).toContain("url.searchParams.set('milestone', route.milestoneId)");
  });

  it('provides a locked, URL-authoritative My work destination', async () => {
    const [app, issues, scope, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/issue-scope.ts'),
      source('apps/web/src/workspace-navigation.ts'),
    ]);
    expect(navigation).toContain("'my-work',");
    expect(navigation).toContain("if (view === 'my-work') return 'My work';");
    expect(app).toContain('aria-label="My work" aria-current={view === \'my-work\' ? \'page\' : undefined}');
    expect(app).toContain('const syncLocation = () => {');
    expect(app).toContain('setView(workspaceViewFromSearch(canonical.search));');
    expect(app).toContain("window.addEventListener('popstate', syncLocation);");
    expect(app).toContain("routeView={view}");
    expect(app).toContain("view === 'my-work' ? { systemAssignee:");
    expect(issues).toContain("url.searchParams.set('view', routeView);");
    expect(issues).toContain('const initialCreateAssigneeUserId = ownerMode ? currentUserId : systemAssigneeUserId;');
    expect(issues).toContain('excludedFields={excludedFilterFields}');
    expect(scope).toContain("['assigneeUserId', scope.assigneeUserId]");
  });

  it('makes the fixed owner workspace canonical across links and history', async () => {
    const [app, navigation] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/workspace-navigation.ts'),
    ]);
    expect(navigation).toContain('export function workspaceIdFromSearch(');
    expect(navigation).toContain('if (accessibleWorkspaceIds.includes(fallbackWorkspaceId)) return fallbackWorkspaceId;');
    expect(navigation).toContain('export function workspaceSelectionUrl(');
    expect(navigation).toContain('if (options.resetSurface === true || url.searchParams.has(\'workspace\') || url.searchParams.has(\'team\')) {');
    expect(navigation).toContain('export function ownerWorkspaceUrl(href: string): URL {');
    expect(app).toContain('const canonical = ownerWorkspaceUrl(window.location.href);');
    expect(app).toContain("window.history.replaceState(null, '', canonical);");
    expect(app).toContain('key={`${workspaceId}:${view}:${workspaceRouteEpoch}`}');
    expect(app).toContain('data-workspace-id={workspaceId}');
    expect(app).not.toContain('<select aria-label="Workspace"');
    expect(app).not.toContain('startOidcLink');
  });

  it('keeps saved-view names and actions reachable across responsive table geometries', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.saved-view-table { width: 100%; min-width: 760px;');
    expect(styles).toContain('.saved-view-table { min-width: 560px; }');
    expect(styles).toContain('.saved-view-table { min-width: 380px; }');
    expect(styles).toContain('.saved-view-table th:nth-child(3), .saved-view-table td:nth-child(3)');
    expect(styles).toContain('.saved-view-table th:nth-child(2), .saved-view-table td:nth-child(2)');
    expect(styles).not.toContain('.saved-view-table th:nth-child(6), .saved-view-table td:nth-child(6)');
    expect(styles).toContain('.saved-view-actions { min-height: 30px;');
    expect(styles).toContain('.saved-view-table .saved-view-section-row td { height: 32px;');
  });

  it('reserves non-shrinking workflow action targets across responsive layouts', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.workflow-status-row-actions { width: 124px; flex: 0 0 124px;');
    expect(styles).toContain('grid-template-columns: 24px 14px minmax(120px, 1fr) 110px 75px 124px;');
    expect(styles).toContain('grid-template-columns: 24px 14px minmax(100px, 1fr) 124px;');
    expect(styles).toContain('.skeleton-workflow-row .skeleton-block:last-child { width: 112px;');
  });

  it('keeps the issue separator accessible and desktop-only', async () => {
    const [issues, styles] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/styles.css'),
    ]);
    expect(issues).toContain('role="separator"');
    expect(issues).toContain('aria-label="Resize issue details"');
    expect(issues).toContain('aria-valuenow={panelWidth}');
    expect(issues).toContain('onPointerDown={beginPanelResize}');
    expect(issues).toContain('onKeyDown={resizePanelWithKeyboard}');
    expect(styles).toContain('grid-template-columns: minmax(0, 1fr) 12px clamp(480px, var(--issue-panel-width, 560px), 640px);');
    expect(styles).toContain('.issues-view.detail-open .issue-toolbar .project-search { flex-basis: 100%; }');
    expect(styles).toContain('.issue-panel-resizer { display: none; }');
  });

  it('fails closed when URL filter state cannot be restored', async () => {
    const [issues, styles] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/styles.css'),
    ]);
    expect(issues).toContain('enabled: invalidUrlFilter === null');
    expect(issues).toContain('Filter could not be restored');
    expect(issues).toContain('Issue results are hidden until the filter is replaced or cleared.');
    expect(issues).toContain('if (embedded || invalidUrlFilter !== null) return;');
    expect(issues).toContain('setInvalidUrlFilter(restored.invalidFilter)');
    expect(styles).toContain('.invalid-filter-banner');
    expect(styles).toContain('.invalid-filter-blocked');
  });

  it('separates direct issue routes from contextual panels', async () => {
    const [issues, styles] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/styles.css'),
    ]);
    expect(issues).toContain('readIssueRoute(window.location.search, window.history.state)');
    expect(issues).toContain('issueRouteHistoryState(window.history.state, selectedIssueId, detailMode)');
    expect(issues).toContain("detailPresentation === 'route'");
    expect(issues).toContain("detailPresentation === 'panel'");
    expect(issues).toContain("data-issue-presentation={detailPresentation ?? 'list'}");
    expect(issues).toMatch(/<IssueDetail\s+key=\{`\$\{workspaceId\}:\$\{selectedIssueId\}`\}\s+workspaceId=\{workspaceId\}/);
    expect(issues).toMatch(/<IssueDetail\s+key=\{`\$\{workspaceId\}:\$\{selectedIssueId\}`\}\s+panel\s+workspaceId=\{workspaceId\}/);
    expect(issues).toContain('{!panel ? <h1 className="sr-only">{current.title}</h1> : null}');
    expect(styles).toContain('.issues-view.detail-route-open');
    expect(styles).toContain('.issue-detail-route');
  });

  it('forwards milestone scope into contextual issue creation', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain('contextualIssueCreateMilestoneId(contextMilestone, projectId, milestoneSource ?? [])');
    expect(issues).toContain('value={milestoneId}');
    expect(issues).toContain('milestoneId: milestoneId || null');
    expect(issues).toContain('{ contextMilestone }');
    expect(issues).toContain('`New issue for ${contextMilestone.name}`');
    const fixture = await source('scripts/serve-visual-fixture.mjs');
    expect(fixture).toContain("fixtureName(request) === 'milestone-create'");
    expect(fixture).toContain("input.milestoneId !== ids.milestone");
  });

  it('names shared dialogs from their visible title', async () => {
    const components = await source('apps/web/src/components.tsx');
    expect(components).toContain('const titleId = useId();');
    expect(components).toContain('aria-labelledby={titleId}');
    expect(components).toContain('<h2 id={titleId}>{title}</h2>');
  });

  it('keeps project grouping, collapse state, and properties route-backed and aligned', async () => {
    const [projects, navigation, styles, fixture] = await Promise.all([
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/project-navigation.ts'),
      source('apps/web/src/styles.css'),
      source('scripts/serve-visual-fixture.mjs'),
    ]);
    expect(navigation).toContain("url.searchParams.set('group', route.list.groupBy);");
    expect(navigation).toContain("url.searchParams.set('properties', projectViewPropertiesParam(route.list.visibleProperties));");
    expect(navigation).toContain('collapsedProjectGroupsFromParam(parameters.get(\'collapsed\'), groupBy)');
    expect(projects).toContain('visibleGroupedProjectIds(projectGroups, collapsedGroups)');
    expect(projects).toContain("&& effectiveGroupBy === 'none';");
    expect(projects).toContain('aria-expanded={!collapsed} onClick={() => toggleProjectGroup(group.key)}');
    expect(projects).toContain('setVisibleProperties((current) => toggleProjectViewProperty(current, property))');
    expect(styles).toContain('grid-template-columns: var(--project-grid-template');
    expect(styles).toContain('.project-table { overflow-x: auto;');
    expect(styles).not.toMatch(/\.project-row > :nth-child/);
    expect(fixture).toContain("fixtureName(request) === 'project-view'");
    expect(fixture).toContain('? [project, projectC, projectD]');
  });

  it('keeps issue grouping, collapse state, and properties canonical across history', async () => {
    const [issues, configuration, fixture] = await Promise.all([
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/issue-view-configuration.ts'),
      source('scripts/serve-visual-fixture.mjs'),
    ]);
    expect(issues).toContain("url.searchParams.set('properties', issueViewPropertiesParam(state.visibleProperties));");
    expect(issues).toContain("assignOptional('collapsed', collapsedIssueGroupsParam(state.collapsedGroups, state.groupBy));");
    expect(issues).toContain("state.groupBy === 'none' ? []");
    expect(issues).toContain('toggleIssueViewProperty(current.visibleProperties, property)');
    expect(configuration).toContain("return canonical.length === 0 ? 'none' : canonical.join(',');");
    expect(configuration).toContain("if (separator < 1 || item.slice(0, separator) !== groupBy) return [];");
    expect(fixture).toContain("fixtureName(request) === 'issue-view'");
    expect(fixture).toContain('teamRoute || issueView');
  });

  it('uses final-geometry skeletons for surface loading states', async () => {
    const [app, projects, issues, components, styles, fixture] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/issues.tsx'),
      source('apps/web/src/components.tsx'),
      source('apps/web/src/styles.css'),
      source('scripts/serve-visual-fixture.mjs'),
    ]);
    expect(app).toContain('<LoadingSkeleton variant="gate" label="Loading application" />');
    expect(app).toContain('<LoadingSkeleton variant="command" label="Loading search results" />');
    expect(app).toContain("<LoadingSkeleton variant={view === 'workflow' ? 'workflow' : 'table'}");
    expect(projects).toContain(
      '<LoadingSkeleton variant="table" tableKind="projects" tableDensity={density} tableColumnCount={2 + effectiveVisibleProperties.length} tableGridTemplate={projectGridTemplate(effectiveVisibleProperties)} label="Loading projects" />',
    );
    expect(projects).toContain('<LoadingSkeleton variant="project" label="Loading project details" />');
    expect(projects).toContain('<LoadingSkeleton variant="milestones" label="Loading project milestones" />');
    expect(projects).toContain('<LoadingSkeleton variant="activity" label="Loading project activity" />');
    expect(issues).toContain('<LoadingSkeleton variant="table" tableKind="issues" tableDensity={viewState.density} tableColumnCount={4 + viewState.visibleProperties.length} tableGridTemplate={issueGridTemplate(viewState.visibleProperties)} label="Loading issues" />');
    expect(issues).toContain('<LoadingSkeleton variant="board" boardDensity={viewState.density} label="Loading issue board" />');
    expect(issues).toContain('<LoadingSkeleton variant="detail" panel={panel} label="Loading issue details" />');
    expect(issues).toContain('<LoadingSkeleton variant="editor" label="Loading rich text editor" />');
    expect(issues).toContain('<LoadingSkeleton variant="relations" label="Loading issue relations" />');
    expect(issues).toContain('<LoadingSkeleton variant="comments" label="Loading issue comments" />');
    expect(issues).toContain('<LoadingSkeleton variant="activity" label="Loading issue activity" />');
    expect(app).not.toMatch(/(?:teams|memberships|statuses)\.isLoading \? <Spinner/);
    expect(projects).not.toMatch(/(?:project|milestones|activity)\.isLoading \? <Spinner/);
    expect(issues).not.toMatch(/(?:relations|comments|activity)\.isLoading \? <Spinner/);
    expect(app).toContain('ownerContextLoading ? (');
    expect(projects).toContain('projects.isLoading ? <span className="skeleton-block skeleton-inline-count"');
    expect(issues).toContain('loading ? <span className="skeleton-block skeleton-inline-count"');
    expect(issues).toContain('comments.isLoading ? <span className="skeleton-block skeleton-inline-count"');
    expect(components).toContain('role="status"');
    expect(components).toContain('aria-busy="true"');
    expect(styles).toContain('.loading-skeleton-table-projects');
    expect(styles).toContain('.loading-skeleton-detail');
    expect(styles).toContain('.loading-skeleton-project');
    expect(styles).toContain('.loading-skeleton-workflow');
    expect(styles).toContain('.skeleton-milestone-row');
    expect(styles).toContain('.milestone-drag-handle { width: 24px; height: 32px;');
    expect(styles).toContain('.milestone-row.drop-before::before, .milestone-row.drop-after::after');
    expect(styles).toContain('.issue-board-card-actions { width: 72px;');
    expect(styles).toContain('grid-template-columns: 24px 14px 24px;');
    expect(styles).toContain('.issue-board-drag-handle { width: 24px; height: 24px;');
    expect(styles).toContain('.issue-board-column.drop-target { background:');
    expect(styles).toContain('box-shadow: inset 0 0 0 2px');
    expect(styles).toContain('.issue-board-card.dragging { opacity: .55;');
    expect(styles).toContain('.bulk-toolbar { min-height: 42px; display: flex; flex-wrap: wrap;');
    expect(styles).toContain('.bulk-due-control { height: 30px; display: grid; grid-template-columns: 22px 116px 28px;');
    expect(styles).toContain('.bulk-due-control.clear-active');
    expect(styles).toContain('.bulk-label-popover { position: absolute; z-index: 18;');
    expect(styles).toContain('width: min(244px, calc(100vw - 20px));');
    expect(styles).toContain('.bulk-label-mode { height: 28px; display: grid; grid-template-columns: 1fr 1fr;');
    expect(styles).toContain('.bulk-label-popover fieldset { max-height: 180px;');
    expect(styles).toContain('.skeleton-activity-row');
    expect(fixture).toContain("fixture === 'issues-loading'");
    expect(fixture).toContain("fixtureName(request) === 'issue-board-move'");
    expect(fixture).toContain("fixtureName(request) === 'issue-bulk-edit'");
    expect(fixture).toContain("mutation?.type === 'labels'");
    expect(fixture).toContain("mutation.operation === 'add'");
    expect(fixture).toContain("fixture === 'issue-detail-loading'");
    expect(fixture).toContain("fixture === 'workflow-loading'");
    expect(fixture).toContain("fixture === 'project-detail-loading'");
    expect(fixture).toContain("fixture === 'project-sections-loading'");
    expect(fixture).toContain("fixture === 'issue-sections-loading'");
  });
});
