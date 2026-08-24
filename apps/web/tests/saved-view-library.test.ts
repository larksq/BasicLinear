import type { IssueViewState, SavedView } from '@openlinear/contracts';
import { describe, expect, it } from 'vitest';
import {
  canManageSavedView,
  countIssueFilterConditions,
  savedViewGroupingLabel,
  savedViewSections,
  savedViewStateSummary,
} from '../src/saved-view-library.js';

const state: IssueViewState = {
  version: 1,
  layout: 'board',
  groupBy: 'status',
  order: { field: 'updatedAt', direction: 'desc' },
  visibleProperties: ['priority', 'assignee'],
  density: 'compact',
  filter: {
    version: 1,
    root: {
      type: 'group',
      operator: 'and',
      children: [
        { type: 'condition', field: 'priority', operator: 'is', value: 'high' },
        {
          type: 'group',
          operator: 'or',
          children: [
            { type: 'condition', field: 'statusId', operator: 'in', value: ['started'] },
            { type: 'condition', field: 'assigneeUserId', operator: 'isEmpty', value: null },
          ],
        },
      ],
    },
  },
  searchQuery: 'regression',
  archiveState: 'all',
  collapsedGroups: [],
};

function savedView(id: string, name: string, sharingScope: SavedView['sharingScope'], archived = false): SavedView {
  return {
    id,
    workspaceId: 'workspace-1',
    ownerUserId: 'user-1',
    name,
    sharingScope,
    state,
    archivedAt: archived ? '2026-08-20T08:00:00.000Z' : null,
    revision: 3,
    createdAt: '2026-08-19T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
  };
}

describe('saved view library', () => {
  it('counts nested filter conditions and renders a stable state summary', () => {
    expect(countIssueFilterConditions(state.filter.root)).toBe(3);
    expect(savedViewStateSummary(state)).toBe(
      'Board | Grouped by Status | 3 filters | Search "regression" | 2 properties | Compact | All issues',
    );
  });

  it('names milestone grouping in saved view summaries', () => {
    expect(savedViewGroupingLabel('milestone')).toBe('Milestone');
    expect(savedViewStateSummary({ ...state, groupBy: 'milestone' })).toContain('Grouped by Milestone');
  });

  it('presents one owner library by lifecycle mode with deterministic sorting', () => {
    const views = [
      savedView('view-z', 'Zeta', 'private'),
      savedView('view-a', 'alpha', 'private'),
      savedView('view-b', 'Beta', 'workspace'),
      savedView('view-c', 'Archived', 'workspace', true),
    ];
    const active = savedViewSections(views, 'active', '');
    expect(active).toHaveLength(1);
    expect(active[0]?.label).toBe('Views');
    expect(active[0]?.views.map((view) => view.name)).toEqual(['alpha', 'Beta', 'Zeta']);
    expect(savedViewSections(views, 'archived', '')[0]?.views.map((view) => view.name)).toEqual(['Archived']);
    expect(savedViewSections(views, 'active', 'workspace')[0]?.views).toEqual([]);
    expect(savedViewSections(views, 'active', 'beta')[0]?.views.map((view) => view.name)).toEqual(['Beta']);
  });

  it('requires both issue write capability and ownership for management', () => {
    const view = savedView('view-a', 'Personal', 'private');
    expect(canManageSavedView(view, 'user-1', true)).toBe(true);
    expect(canManageSavedView(view, 'user-1', false)).toBe(false);
    expect(canManageSavedView(view, 'user-2', true)).toBe(false);
  });
});
