import type {
  IssuePriority,
  IssueViewGrouping,
  IssueViewProperty,
  IssueViewState,
} from '@openlinear/contracts';

export const issueViewProperties = [
  'priority',
  'assignee',
  'project',
  'milestone',
  'labels',
  'dueDate',
] as const satisfies readonly IssueViewProperty[];

export const defaultIssueViewProperties: IssueViewProperty[] = [
  'priority',
  'assignee',
  'project',
  'labels',
  'dueDate',
];

const propertySet = new Set<string>(issueViewProperties);
const prioritySet = new Set<IssuePriority>(['urgent', 'high', 'medium', 'low', 'none']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function canonicalIssueViewProperties(
  properties: readonly IssueViewProperty[],
): IssueViewProperty[] {
  const selected = new Set(properties);
  return issueViewProperties.filter((property) => selected.has(property));
}

export function issueViewPropertiesFromParam(
  value: string | null,
  fallback: readonly IssueViewProperty[],
): IssueViewProperty[] {
  if (value === null) return canonicalIssueViewProperties(fallback);
  if (value === 'none') return [];

  const values = value.split(',');
  if (
    values.length === 0
    || values.some((property) => !propertySet.has(property))
    || new Set(values).size !== values.length
  ) return canonicalIssueViewProperties(fallback);

  return canonicalIssueViewProperties(values as IssueViewProperty[]);
}

export function issueViewPropertiesParam(properties: readonly IssueViewProperty[]): string {
  const canonical = canonicalIssueViewProperties(properties);
  return canonical.length === 0 ? 'none' : canonical.join(',');
}

export function toggleIssueViewProperty(
  properties: readonly IssueViewProperty[],
  property: IssueViewProperty,
): IssueViewProperty[] {
  const next = properties.includes(property)
    ? properties.filter((item) => item !== property)
    : [...properties, property];
  return canonicalIssueViewProperties(next);
}

function validCollapsedGroupKey(value: string, groupBy: IssueViewGrouping): boolean {
  if (groupBy === 'status') return value === 'unknown' || uuid.test(value);
  if (groupBy === 'priority') return prioritySet.has(value as IssuePriority);
  if (groupBy === 'assignee') return value === 'unassigned' || uuid.test(value);
  if (groupBy === 'project') return value === 'no-project' || uuid.test(value);
  if (groupBy === 'milestone') return value === 'no-milestone' || uuid.test(value);
  return false;
}

export function canonicalCollapsedIssueGroups(
  groups: readonly string[],
  groupBy: IssueViewGrouping,
): string[] {
  if (
    groupBy === 'none'
    || groups.length > 32
    || groups.some((group) => !validCollapsedGroupKey(group, groupBy))
    || new Set(groups).size !== groups.length
  ) return [];
  return [...groups];
}

export function collapsedIssueGroupsFromParam(
  value: string | null,
  groupBy: IssueViewGrouping,
): string[] {
  if (value === null || value === '' || groupBy === 'none') return [];
  const qualified = value.split(',');
  if (qualified.length > 32 || new Set(qualified).size !== qualified.length) return [];

  const groups: string[] = [];
  for (const item of qualified) {
    const separator = item.indexOf(':');
    if (separator < 1 || item.slice(0, separator) !== groupBy) return [];
    groups.push(item.slice(separator + 1));
  }
  return canonicalCollapsedIssueGroups(groups, groupBy);
}

export function collapsedIssueGroupsParam(
  groups: readonly string[],
  groupBy: IssueViewGrouping,
): string {
  return canonicalCollapsedIssueGroups(groups, groupBy)
    .map((group) => `${groupBy}:${group}`)
    .join(',');
}

export function normalizeIssueViewConfiguration(state: IssueViewState): IssueViewState {
  return {
    ...state,
    visibleProperties: canonicalIssueViewProperties(state.visibleProperties),
    collapsedGroups: canonicalCollapsedIssueGroups(state.collapsedGroups, state.groupBy),
  };
}

export function ownerIssueViewConfiguration(state: IssueViewState): IssueViewState {
  const normalized = normalizeIssueViewConfiguration(state);
  return normalized.groupBy === 'assignee'
    ? { ...normalized, groupBy: 'none', collapsedGroups: [] }
    : normalized;
}

export function issueGridTemplate(properties: readonly IssueViewProperty[]): string {
  const widths: Record<IssueViewProperty, string> = {
    priority: '92px',
    assignee: '128px',
    project: 'minmax(116px, .7fr)',
    milestone: 'minmax(148px, .8fr)',
    labels: 'minmax(124px, .8fr)',
    dueDate: '98px',
  };
  return [
    '28px',
    '104px',
    'minmax(240px, 1.6fr)',
    ...canonicalIssueViewProperties(properties).map((property) => widths[property]),
    '28px',
  ].join(' ');
}
