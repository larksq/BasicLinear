import type { Membership, Project, Team } from '@openlinear/contracts';

export const projectViewGroupings = ['none', 'status', 'priority', 'lead', 'team'] as const;
export type ProjectViewGrouping = typeof projectViewGroupings[number];

export const projectViewProperties = [
  'status',
  'priority',
  'lead',
  'team',
  'startDate',
  'targetDate',
  'progress',
] as const;
export type ProjectViewProperty = typeof projectViewProperties[number];

export const defaultProjectViewProperties: ProjectViewProperty[] = [
  'status',
  'lead',
  'targetDate',
  'progress',
];

export interface ProjectViewGroup {
  key: string;
  label: string;
  projects: Project[];
}

const groupingSet = new Set<string>(projectViewGroupings);
const propertySet = new Set<string>(projectViewProperties);
const statusOrder = new Map<Project['status'], number>([
  ['planned', 0],
  ['in_progress', 1],
  ['paused', 2],
  ['completed', 3],
  ['canceled', 4],
]);
const priorityOrder = new Map<Project['priority'], number>([
  ['urgent', 0],
  ['high', 1],
  ['medium', 2],
  ['low', 3],
  ['none', 4],
]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canonicalProperties(properties: readonly ProjectViewProperty[]): ProjectViewProperty[] {
  const selected = new Set(properties);
  return projectViewProperties.filter((property) => selected.has(property));
}

export function projectViewGroupingFromParam(
  value: string | null,
  fallback: ProjectViewGrouping,
): ProjectViewGrouping {
  return value !== null && groupingSet.has(value) ? value as ProjectViewGrouping : fallback;
}

export function projectViewPropertiesFromParam(
  value: string | null,
  fallback: readonly ProjectViewProperty[],
): ProjectViewProperty[] {
  if (value === null) return canonicalProperties(fallback);
  if (value === 'none') return [];

  const values = value.split(',');
  if (
    values.length === 0
    || values.some((property) => !propertySet.has(property))
    || new Set(values).size !== values.length
  ) return canonicalProperties(fallback);

  return canonicalProperties(values as ProjectViewProperty[]);
}

export function projectViewPropertiesParam(properties: readonly ProjectViewProperty[]): string {
  const canonical = canonicalProperties(properties);
  return canonical.length === 0 ? 'none' : canonical.join(',');
}

function validCollapsedGroupKey(value: string, groupBy: ProjectViewGrouping): boolean {
  const separator = value.indexOf(':');
  if (separator < 1) return false;
  const prefix = value.slice(0, separator);
  const identifier = value.slice(separator + 1);
  if (prefix !== groupBy || identifier === '') return false;
  if (groupBy === 'status') return statusOrder.has(identifier as Project['status']);
  if (groupBy === 'priority') return priorityOrder.has(identifier as Project['priority']);
  if (groupBy === 'lead') return identifier === 'none' || identifier === 'missing' || uuid.test(identifier);
  if (groupBy === 'team') return identifier === 'missing' || uuid.test(identifier);
  return false;
}

export function collapsedProjectGroupsFromParam(
  value: string | null,
  groupBy: ProjectViewGrouping,
): string[] {
  if (value === null || value === '' || groupBy === 'none') return [];
  const keys = value.split(',');
  if (
    keys.length > 32
    || keys.some((key) => !validCollapsedGroupKey(key, groupBy))
    || new Set(keys).size !== keys.length
  ) return [];
  return keys;
}

export function collapsedProjectGroupsParam(
  groups: readonly string[],
  groupBy: ProjectViewGrouping,
): string {
  if (groupBy === 'none') return '';
  return groups.filter((key, index) => (
    index < 32
    && groups.indexOf(key) === index
    && validCollapsedGroupKey(key, groupBy)
  )).join(',');
}

export function toggleProjectViewProperty(
  properties: readonly ProjectViewProperty[],
  property: ProjectViewProperty,
): ProjectViewProperty[] {
  const next = properties.includes(property)
    ? properties.filter((item) => item !== property)
    : [...properties, property];
  return canonicalProperties(next);
}

export function projectViewPropertyLabel(property: ProjectViewProperty): string {
  if (property === 'startDate') return 'Start';
  if (property === 'targetDate') return 'Target';
  return titleCase(property);
}

export function projectGridTemplate(properties: readonly ProjectViewProperty[]): string {
  const widths: Record<ProjectViewProperty, string> = {
    status: '116px',
    priority: '104px',
    lead: '130px',
    team: '140px',
    startDate: '100px',
    targetDate: '100px',
    progress: '128px',
  };
  return ['minmax(260px, 1fr)', ...canonicalProperties(properties).map((property) => widths[property]), '94px'].join(' ');
}

export function groupProjects(
  projects: readonly Project[],
  groupBy: ProjectViewGrouping,
  teams: readonly Team[],
  members: readonly Membership[],
): ProjectViewGroup[] {
  if (groupBy === 'none') return [{ key: 'all', label: 'All projects', projects: [...projects] }];

  const teamNames = new Map(teams.map((team) => [team.id, team.name]));
  const memberNames = new Map(members.map((member) => [member.userId, member.displayName]));
  const groups = new Map<string, ProjectViewGroup & { order: number }>();

  for (const project of projects) {
    let key: string;
    let label: string;
    let order = 0;
    if (groupBy === 'status') {
      key = `status:${project.status}`;
      label = titleCase(project.status);
      order = statusOrder.get(project.status) ?? 999;
    } else if (groupBy === 'priority') {
      key = `priority:${project.priority}`;
      label = project.priority === 'none' ? 'No priority' : titleCase(project.priority);
      order = priorityOrder.get(project.priority) ?? 999;
    } else if (groupBy === 'lead') {
      const knownLead = project.leadUserId === null ? null : memberNames.get(project.leadUserId);
      key = project.leadUserId === null
        ? 'lead:none'
        : knownLead === undefined ? 'lead:missing' : `lead:${project.leadUserId}`;
      label = project.leadUserId === null ? 'No lead' : knownLead ?? 'Unknown lead';
      order = knownLead === undefined || project.leadUserId === null ? 1 : 0;
    } else {
      const knownTeam = teamNames.get(project.teamId);
      key = knownTeam === undefined ? 'team:missing' : `team:${project.teamId}`;
      label = knownTeam ?? 'Unknown team';
      order = knownTeam === undefined ? 1 : 0;
    }

    const current = groups.get(key);
    if (current === undefined) groups.set(key, { key, label, projects: [project], order });
    else current.projects.push(project);
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order
      || left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
      || left.key.localeCompare(right.key))
    .map(({ key, label, projects: groupedProjects }) => ({ key, label, projects: groupedProjects }));
}

export function visibleGroupedProjectIds(
  groups: readonly ProjectViewGroup[],
  collapsedGroups: readonly string[],
): string[] {
  const collapsed = new Set(collapsedGroups);
  return groups.flatMap((group) => collapsed.has(group.key)
    ? []
    : group.projects.map((project) => project.id));
}
