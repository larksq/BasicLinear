export const workspaceViews = [
  'projects',
  'my-work',
  'issues',
  'views',
  'workflow',
] as const;

export type WorkspaceView = (typeof workspaceViews)[number];
export type IssueWorkspaceView = Extract<WorkspaceView, 'my-work' | 'issues'>;
export type TeamWorkspaceView = Extract<WorkspaceView, 'projects' | 'issues' | 'views'>;

const issueWorkspaceViews = new Set<WorkspaceView>(['my-work', 'issues']);
const teamWorkspaceViews = new Set<WorkspaceView>(['projects', 'issues', 'views']);
const workspaceViewParameters = [
  'team',
  'issue',
  'project',
  'projectTab',
  'milestone',
  'layout',
  'group',
  'order',
  'direction',
  'density',
  'archive',
  'status',
  'priority',
  'properties',
  'saved',
  'q',
  'collapsed',
  'filter',
] as const;

function clearWorkspaceViewParameters(url: URL): void {
  for (const parameter of workspaceViewParameters) url.searchParams.delete(parameter);
}

export function isIssueWorkspaceView(view: WorkspaceView): view is IssueWorkspaceView {
  return issueWorkspaceViews.has(view);
}

export function isTeamWorkspaceView(view: WorkspaceView): view is TeamWorkspaceView {
  return teamWorkspaceViews.has(view);
}

export function workspaceViewFromSearch(search: string): WorkspaceView {
  const requested = new URLSearchParams(search).get('view');
  return workspaceViews.find((view) => view === requested) ?? 'projects';
}

export function workspaceViewLabel(view: WorkspaceView): string {
  if (view === 'my-work') return 'My work';
  return `${view.slice(0, 1).toUpperCase()}${view.slice(1)}`;
}

export function workspaceIdFromSearch(
  _search: string,
  accessibleWorkspaceIds: readonly string[],
  fallbackWorkspaceId = accessibleWorkspaceIds[0] ?? '',
): string {
  if (accessibleWorkspaceIds.includes(fallbackWorkspaceId)) return fallbackWorkspaceId;
  return accessibleWorkspaceIds[0] ?? '';
}

export function teamIdFromSearch(
  _search: string,
  _accessibleTeamIds: readonly string[],
): string | null {
  return null;
}

export function workspaceSelectionUrl(
  href: string,
  _workspaceId: string,
  options: { resetSurface?: boolean } = {},
): URL {
  const url = new URL(href);
  if (options.resetSurface === true || url.searchParams.has('workspace') || url.searchParams.has('team')) {
    clearWorkspaceViewParameters(url);
  }
  url.searchParams.delete('workspace');
  url.searchParams.delete('team');
  return url;
}

export function workspaceNavigationUrl(
  href: string,
  next: WorkspaceView,
  current: WorkspaceView,
  options: { reset?: boolean } = {},
): URL {
  const url = new URL(href);
  url.searchParams.set('view', next);
  const statefulSurface = isIssueWorkspaceView(next) || next === 'projects';
  if (options.reset === true || !statefulSurface || next !== current) {
    clearWorkspaceViewParameters(url);
  }
  url.searchParams.delete('workspace');
  url.searchParams.delete('team');
  return url;
}

export function teamNavigationUrl(
  href: string,
  _teamId: string,
  next: TeamWorkspaceView,
): URL {
  const current = workspaceViewFromSearch(new URL(href).search);
  return workspaceNavigationUrl(href, next, current, { reset: true });
}

export function savedViewNavigationUrl(
  href: string,
  savedViewId: string | null,
  _teamId: string | null = null,
): URL {
  const current = workspaceViewFromSearch(new URL(href).search);
  const url = workspaceNavigationUrl(href, 'issues', current, { reset: true });
  if (savedViewId !== null) url.searchParams.set('saved', savedViewId);
  return url;
}

export function ownerWorkspaceUrl(href: string): URL {
  const url = new URL(href);
  const requestedView = url.searchParams.get('view');
  const view = workspaceViewFromSearch(url.search);
  const legacyScope = url.searchParams.has('workspace') || url.searchParams.has('team');
  const unsupportedView = requestedView !== null && requestedView !== view;
  if (legacyScope || unsupportedView) clearWorkspaceViewParameters(url);
  if (unsupportedView) url.searchParams.set('view', view);
  url.searchParams.delete('workspace');
  url.searchParams.delete('team');
  return url;
}
