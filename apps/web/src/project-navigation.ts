import type { Project } from '@openlinear/contracts';
import type { ProjectDensity } from './project-density.js';
import {
  collapsedProjectGroupsFromParam,
  collapsedProjectGroupsParam,
  defaultProjectViewProperties,
  projectViewGroupingFromParam,
  projectViewPropertiesFromParam,
  projectViewPropertiesParam,
  type ProjectViewGrouping,
  type ProjectViewProperty,
} from './project-view-configuration.js';

export type ProjectTab = 'overview' | 'issues' | 'activity';
export type ProjectArchiveState = 'active' | 'archived';
export type ProjectOrder = 'position' | 'name' | 'targetDate' | 'updatedAt';
export type ProjectDirection = 'asc' | 'desc';

export interface ProjectListRouteState {
  query: string;
  status: '' | Project['status'];
  priority: '' | Project['priority'];
  archiveState: ProjectArchiveState;
  order: ProjectOrder;
  direction: ProjectDirection;
  density: ProjectDensity;
  groupBy: ProjectViewGrouping;
  visibleProperties: ProjectViewProperty[];
  collapsedGroups: string[];
}

export interface ProjectRouteState {
  list: ProjectListRouteState;
  projectId: string | null;
  tab: ProjectTab;
  milestoneId: string | null;
}

const projectStatuses = new Set<Project['status']>([
  'planned',
  'in_progress',
  'paused',
  'completed',
  'canceled',
]);
const projectPriorities = new Set<Project['priority']>([
  'none',
  'urgent',
  'high',
  'medium',
  'low',
]);
const projectArchiveStates = new Set<ProjectArchiveState>(['active', 'archived']);
const projectOrders = new Set<ProjectOrder>(['position', 'name', 'targetDate', 'updatedAt']);
const projectDirections = new Set<ProjectDirection>(['asc', 'desc']);
const projectDensities = new Set<ProjectDensity>(['compact', 'default', 'comfortable']);
const projectTabs = new Set<ProjectTab>(['overview', 'issues', 'activity']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const projectHistoryKey = '__openlinearProjectId';

function selected<T extends string>(value: string | null, options: Set<T>, fallback: T): T {
  return value !== null && options.has(value as T) ? value as T : fallback;
}

function optionalSelected<T extends string>(value: string | null, options: Set<T>): '' | T {
  return value !== null && options.has(value as T) ? value as T : '';
}

function routeId(value: string | null): string | null {
  return value !== null && uuid.test(value) ? value.toLowerCase() : null;
}

export function defaultProjectListRouteState(density: ProjectDensity): ProjectListRouteState {
  return {
    query: '',
    status: '',
    priority: '',
    archiveState: 'active',
    order: 'position',
    direction: 'asc',
    density,
    groupBy: 'none',
    visibleProperties: [...defaultProjectViewProperties],
    collapsedGroups: [],
  };
}

export function projectRouteFromSearch(
  search: string,
  fallback: ProjectListRouteState,
): ProjectRouteState {
  const parameters = new URLSearchParams(search);
  const projectId = routeId(parameters.get('project'));
  const tab = projectId === null
    ? 'overview'
    : selected(parameters.get('projectTab'), projectTabs, 'overview');
  const milestoneId = projectId !== null && tab === 'issues'
    ? routeId(parameters.get('milestone'))
    : null;
  const groupBy = projectViewGroupingFromParam(parameters.get('group'), fallback.groupBy);

  return {
    list: {
      query: (parameters.get('q') ?? fallback.query).slice(0, 200),
      status: optionalSelected(parameters.get('status'), projectStatuses),
      priority: optionalSelected(parameters.get('priority'), projectPriorities),
      archiveState: selected(
        parameters.get('archive'),
        projectArchiveStates,
        fallback.archiveState,
      ),
      order: selected(parameters.get('order'), projectOrders, fallback.order),
      direction: selected(
        parameters.get('direction'),
        projectDirections,
        fallback.direction,
      ),
      density: selected(parameters.get('density'), projectDensities, fallback.density),
      groupBy,
      visibleProperties: projectViewPropertiesFromParam(
        parameters.get('properties'),
        fallback.visibleProperties,
      ),
      collapsedGroups: collapsedProjectGroupsFromParam(parameters.get('collapsed'), groupBy),
    },
    projectId,
    tab,
    milestoneId,
  };
}

export function projectNavigationUrl(href: string, route: ProjectRouteState): URL {
  const url = new URL(href);
  const assignOptional = (name: string, value: string) => {
    if (value === '') url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  };

  url.searchParams.set('view', 'projects');
  assignOptional('q', route.list.query);
  assignOptional('status', route.list.status);
  assignOptional('priority', route.list.priority);
  url.searchParams.set('archive', route.list.archiveState);
  url.searchParams.set('order', route.list.order);
  url.searchParams.set('direction', route.list.direction);
  url.searchParams.set('density', route.list.density);
  url.searchParams.set('group', route.list.groupBy);
  url.searchParams.set('properties', projectViewPropertiesParam(route.list.visibleProperties));
  const collapsedGroups = collapsedProjectGroupsParam(
    route.list.collapsedGroups,
    route.list.groupBy,
  );
  if (collapsedGroups === '') url.searchParams.delete('collapsed');
  else url.searchParams.set('collapsed', collapsedGroups);

  if (route.projectId === null) {
    url.searchParams.delete('project');
    url.searchParams.delete('projectTab');
    url.searchParams.delete('milestone');
  } else {
    url.searchParams.set('project', route.projectId);
    url.searchParams.set('projectTab', route.tab);
    if (route.tab === 'issues' && route.milestoneId !== null) {
      url.searchParams.set('milestone', route.milestoneId);
    } else {
      url.searchParams.delete('milestone');
    }
  }

  return url;
}

function historyRecord(state: unknown): Record<string, unknown> {
  return typeof state === 'object' && state !== null && !Array.isArray(state)
    ? { ...state as Record<string, unknown> }
    : {};
}

export function projectRouteHistoryState(state: unknown, projectId: string | null): Record<string, unknown> {
  const next = historyRecord(state);
  if (projectId === null) delete next[projectHistoryKey];
  else next[projectHistoryKey] = projectId;
  return next;
}

export function isPushedProjectRoute(state: unknown, projectId: string): boolean {
  return historyRecord(state)[projectHistoryKey] === projectId;
}
