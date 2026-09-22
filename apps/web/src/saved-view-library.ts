import type { IssueFilterNode, IssueViewState, SavedView } from '@basiclinear/contracts';

export type SavedViewMode = 'active' | 'archived';

export interface SavedViewSection {
  key: 'owner';
  label: 'Views';
  views: SavedView[];
}

export function countIssueFilterConditions(node: IssueFilterNode): number {
  if (node.type === 'condition') return 1;
  return node.children.reduce((total, child) => total + countIssueFilterConditions(child), 0);
}

export function savedViewGroupingLabel(groupBy: IssueViewState['groupBy']): string {
  switch (groupBy) {
    case 'none': return 'None';
    case 'status': return 'Status';
    case 'priority': return 'Priority';
    case 'assignee': return 'Assignee';
    case 'project': return 'Project';
    case 'milestone': return 'Milestone';
  }
}

export function savedViewStateSummary(state: IssueViewState): string {
  const filters = countIssueFilterConditions(state.filter.root);
  const parts = [
    state.layout === 'list' ? 'List' : 'Board',
    state.groupBy === 'none' ? 'Ungrouped' : `Grouped by ${savedViewGroupingLabel(state.groupBy)}`,
    filters === 0 ? 'No filters' : `${filters} ${filters === 1 ? 'filter' : 'filters'}`,
  ];
  const search = state.searchQuery.trim();
  if (search !== '') parts.push(`Search "${search}"`);
  parts.push(
    `${state.visibleProperties.length} ${state.visibleProperties.length === 1 ? 'property' : 'properties'}`,
    `${state.density[0]?.toUpperCase()}${state.density.slice(1)}`,
    state.archiveState === 'active' ? 'Active issues' : state.archiveState === 'archived' ? 'Archived issues' : 'All issues',
  );
  return parts.join(' | ');
}

export function savedViewSections(
  views: readonly SavedView[],
  mode: SavedViewMode,
  query: string,
): SavedViewSection[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
  const modeViews = views.filter((view) => mode === 'active' ? view.archivedAt === null : view.archivedAt !== null);
  const filtered = normalizedQuery === ''
    ? modeViews
    : modeViews.filter((view) => [
      view.name,
      savedViewStateSummary(view.state),
    ].some((value) => value.toLocaleLowerCase('en-US').includes(normalizedQuery)));
  const sortViews = (items: SavedView[]) => items.sort((left, right) => {
    const byName = left.name.localeCompare(right.name, 'en-US', { sensitivity: 'base' });
    return byName === 0 ? left.id.localeCompare(right.id, 'en-US') : byName;
  });
  return [
    {
      key: 'owner',
      label: 'Views',
      views: sortViews(filtered),
    },
  ];
}

export function canManageSavedView(view: SavedView, currentUserId: string, canWrite: boolean): boolean {
  return canWrite && view.ownerUserId === currentUserId;
}
