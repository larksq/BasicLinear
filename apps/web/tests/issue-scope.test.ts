import { describe, expect, it } from 'vitest';
import type { IssueViewState } from '@basiclinear/contracts';
import {
  contextualMilestoneId,
  milestoneIssueCountLabel,
  scopeIssueViewState,
  withoutIssueQueryScope,
} from '../src/issue-scope.js';

function viewState(): IssueViewState {
  return {
    version: 1,
    layout: 'list',
    groupBy: 'status',
    order: { field: 'updatedAt', direction: 'desc' },
    visibleProperties: ['priority'],
    density: 'default',
    filter: {
      version: 1,
      root: {
        type: 'group',
        operator: 'or',
        children: [
          { type: 'condition', field: 'priority', operator: 'is', value: 'high' },
          { type: 'condition', field: 'projectId', operator: 'is', value: 'old-project' },
          {
            type: 'group',
            operator: 'and',
            children: [
              { type: 'condition', field: 'milestoneId', operator: 'is', value: 'old-milestone' },
              { type: 'condition', field: 'statusId', operator: 'is', value: 'status-1' },
            ],
          },
        ],
      },
    },
    searchQuery: '',
    archiveState: 'active',
    collapsedGroups: [],
  };
}

describe('issue query scope', () => {
  it('ANDs project and milestone scope outside user filters', () => {
    const source = viewState();
    const scoped = scopeIssueViewState(source, {
      projectId: 'project-1',
      milestoneId: 'milestone-1',
    });

    expect(scoped.filter.root).toMatchObject({
      type: 'group',
      operator: 'and',
      children: [
        { type: 'group', operator: 'or' },
        { type: 'condition', field: 'projectId', operator: 'is', value: 'project-1' },
        { type: 'condition', field: 'milestoneId', operator: 'is', value: 'milestone-1' },
      ],
    });
    expect(JSON.stringify(scoped.filter)).not.toContain('old-project');
    expect(JSON.stringify(scoped.filter)).not.toContain('old-milestone');
    expect(JSON.stringify(scoped.filter)).toContain('status-1');
    expect(source).toEqual(viewState());
  });

  it('returns the original state when there is no context scope', () => {
    const source = viewState();
    expect(scopeIssueViewState(source, {})).toBe(source);
  });

  it('locks a current-user assignee outside user-controlled filters', () => {
    const source = viewState();
    source.filter.root.children.push({
      type: 'condition',
      field: 'assigneeUserId',
      operator: 'is',
      value: 'other-user',
    });

    const unscoped = withoutIssueQueryScope(source, { assigneeUserId: 'current-user' });
    const scoped = scopeIssueViewState(unscoped, { assigneeUserId: 'current-user' });

    expect(JSON.stringify(unscoped.filter)).not.toContain('assigneeUserId');
    expect(scoped.filter.root).toMatchObject({
      type: 'group',
      operator: 'and',
      children: [
        { type: 'group', operator: 'or' },
        { type: 'condition', field: 'assigneeUserId', operator: 'is', value: 'current-user' },
      ],
    });
    expect(JSON.stringify(scoped.filter)).not.toContain('other-user');
  });

  it('replaces user-controlled team filters with the URL team scope', () => {
    const source = viewState();
    source.filter.root.children.push({
      type: 'condition',
      field: 'teamId',
      operator: 'is',
      value: 'other-team',
    });

    const unscoped = withoutIssueQueryScope(source, { teamId: 'route-team' });
    const scoped = scopeIssueViewState(unscoped, { teamId: 'route-team' });

    expect(JSON.stringify(unscoped.filter)).not.toContain('teamId');
    expect(scoped.filter.root).toMatchObject({
      type: 'group',
      operator: 'and',
      children: [
        { type: 'group', operator: 'or' },
        { type: 'condition', field: 'teamId', operator: 'is', value: 'route-team' },
      ],
    });
    expect(JSON.stringify(scoped.filter)).not.toContain('other-team');
  });
});

describe('milestone issue count label', () => {
  it.each([
    [0, '0 issues'],
    [1, '1 issue'],
    [2, '2 issues'],
  ])('names %i issues as %s', (count, label) => {
    expect(milestoneIssueCountLabel(count)).toBe(label);
  });
});

describe('contextual milestone creation default', () => {
  const active = { id: 'milestone-active', archivedAt: null };
  const archived = { id: 'milestone-archived', archivedAt: '2026-08-20T00:00:00.000Z' };

  it('selects an active milestone from the current project context', () => {
    expect(contextualMilestoneId({ id: active.id }, [active, archived])).toBe(active.id);
  });

  it.each([
    ['project-only context', undefined],
    ['missing milestone context', { id: 'milestone-missing' }],
    ['archived milestone context', { id: archived.id }],
  ])('fails closed for %s', (_label, context) => {
    expect(contextualMilestoneId(context, [active, archived])).toBe('');
  });
});
