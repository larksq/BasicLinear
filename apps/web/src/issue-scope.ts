import type { IssueFilterField, IssueFilterNode, IssueViewState, Milestone } from '@basiclinear/contracts';

export interface IssueQueryScope {
  teamId?: string;
  projectId?: string;
  milestoneId?: string;
  assigneeUserId?: string;
}

export function milestoneIssueCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'issue' : 'issues'}`;
}

export function contextualMilestoneId(
  context: Pick<Milestone, 'id'> | undefined,
  milestones: readonly Pick<Milestone, 'id' | 'archivedAt'>[],
): string {
  if (context === undefined) return '';
  return milestones.some((milestone) =>
    milestone.id === context.id && milestone.archivedAt === null)
    ? context.id
    : '';
}

function withoutScopedFields(
  node: IssueFilterNode,
  scopedFields: ReadonlySet<IssueFilterField>,
): IssueFilterNode | null {
  if (node.type === 'condition') return scopedFields.has(node.field) ? null : node;
  const children = node.children.flatMap((child) => {
    const next = withoutScopedFields(child, scopedFields);
    return next === null ? [] : [next];
  });
  return children.length === 0 ? null : { ...node, children };
}

export function scopeIssueViewState(state: IssueViewState, scope: IssueQueryScope): IssueViewState {
  const scopedEntries = [
    scope.teamId === undefined ? null : ['teamId', scope.teamId] as const,
    scope.projectId === undefined ? null : ['projectId', scope.projectId] as const,
    scope.milestoneId === undefined ? null : ['milestoneId', scope.milestoneId] as const,
    scope.assigneeUserId === undefined ? null : ['assigneeUserId', scope.assigneeUserId] as const,
  ].filter((entry): entry is readonly ['teamId' | 'projectId' | 'milestoneId' | 'assigneeUserId', string] => entry !== null);
  if (scopedEntries.length === 0) return state;

  const scopedFields = new Set<IssueFilterField>(scopedEntries.map(([field]) => field));
  const unscopedRoot = withoutScopedFields(state.filter.root, scopedFields);
  const scopeConditions: IssueFilterNode[] = scopedEntries.map(([field, value]) => ({
    type: 'condition',
    field,
    operator: 'is',
    value,
  }));

  return {
    ...state,
    filter: {
      version: 1,
      root: {
        type: 'group',
        operator: 'and',
        children: [...(unscopedRoot === null ? [] : [unscopedRoot]), ...scopeConditions],
      },
    },
  };
}

export function withoutIssueQueryScope(state: IssueViewState, scope: IssueQueryScope): IssueViewState {
  const scopedFields = new Set<IssueFilterField>([
    ...(scope.teamId === undefined ? [] : ['teamId'] as const),
    ...(scope.projectId === undefined ? [] : ['projectId'] as const),
    ...(scope.milestoneId === undefined ? [] : ['milestoneId'] as const),
    ...(scope.assigneeUserId === undefined ? [] : ['assigneeUserId'] as const),
  ]);
  if (scopedFields.size === 0) return state;

  const root = withoutScopedFields(state.filter.root, scopedFields);
  return {
    ...state,
    filter: {
      version: 1,
      root: root === null
        ? { type: 'group', operator: 'and', children: [] }
        : root.type === 'group'
          ? root
          : { type: 'group', operator: 'and', children: [root] },
    },
  };
}
