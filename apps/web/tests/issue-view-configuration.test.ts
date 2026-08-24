import { describe, expect, it } from 'vitest';
import {
  canonicalCollapsedIssueGroups,
  collapsedIssueGroupsFromParam,
  collapsedIssueGroupsParam,
  defaultIssueViewProperties,
  issueGridTemplate,
  issueViewPropertiesFromParam,
  issueViewPropertiesParam,
  normalizeIssueViewConfiguration,
  ownerIssueViewConfiguration,
  toggleIssueViewProperty,
} from '../src/issue-view-configuration.js';

const id = '40000000-0000-4000-8000-000000000023';

describe('issue view configuration', () => {
  it('round-trips canonical properties including an intentionally empty set', () => {
    expect(issueViewPropertiesFromParam('dueDate,priority,milestone', defaultIssueViewProperties))
      .toEqual(['priority', 'milestone', 'dueDate']);
    expect(issueViewPropertiesParam(['dueDate', 'priority', 'milestone']))
      .toBe('priority,milestone,dueDate');
    expect(issueViewPropertiesFromParam('none', defaultIssueViewProperties)).toEqual([]);
    expect(issueViewPropertiesParam([])).toBe('none');
  });

  it('fails malformed or duplicate property payloads closed as a whole', () => {
    expect(issueViewPropertiesFromParam('priority,owner', defaultIssueViewProperties))
      .toEqual(defaultIssueViewProperties);
    expect(issueViewPropertiesFromParam('priority,priority', defaultIssueViewProperties))
      .toEqual(defaultIssueViewProperties);
  });

  it('keeps property columns in deterministic order when toggled', () => {
    expect(toggleIssueViewProperty(['dueDate', 'assignee'], 'priority'))
      .toEqual(['priority', 'assignee', 'dueDate']);
    expect(toggleIssueViewProperty(['priority', 'assignee'], 'assignee')).toEqual(['priority']);
  });

  it('qualifies collapse keys for the active grouping and rejects cross-group state', () => {
    expect(collapsedIssueGroupsFromParam(`status:${id},status:unknown`, 'status'))
      .toEqual([id, 'unknown']);
    expect(collapsedIssueGroupsParam([id, 'unassigned'], 'assignee'))
      .toBe(`assignee:${id},assignee:unassigned`);
    expect(collapsedIssueGroupsFromParam(`status:${id},priority:high`, 'status')).toEqual([]);
    expect(collapsedIssueGroupsFromParam(`${id}`, 'status')).toEqual([]);
    expect(collapsedIssueGroupsFromParam(`priority:high,priority:high`, 'priority')).toEqual([]);
    expect(collapsedIssueGroupsFromParam(`status:${id}`, 'none')).toEqual([]);
  });

  it('normalizes saved configuration without preserving invalid collapse state', () => {
    const normalized = normalizeIssueViewConfiguration({
      version: 1,
      layout: 'list',
      groupBy: 'project',
      order: { field: 'updatedAt', direction: 'desc' },
      visibleProperties: ['dueDate', 'priority'],
      density: 'default',
      filter: { version: 1, root: { type: 'group', operator: 'and', children: [] } },
      searchQuery: '',
      archiveState: 'active',
      collapsedGroups: ['not-a-project'],
    });
    expect(normalized.visibleProperties).toEqual(['priority', 'dueDate']);
    expect(normalized.collapsedGroups).toEqual([]);
    expect(canonicalCollapsedIssueGroups([id, 'no-project'], 'project'))
      .toEqual([id, 'no-project']);
  });

  it('removes assignee grouping from the owner surface without discarding metadata', () => {
    const ownerState = ownerIssueViewConfiguration({
      version: 1,
      layout: 'board',
      groupBy: 'assignee',
      order: { field: 'updatedAt', direction: 'desc' },
      visibleProperties: ['assignee', 'priority'],
      density: 'default',
      filter: {
        version: 1,
        root: {
          type: 'condition',
          field: 'assigneeUserId',
          operator: 'is',
          value: id,
        },
      },
      searchQuery: '',
      archiveState: 'active',
      collapsedGroups: [id],
    });

    expect(ownerState.groupBy).toBe('none');
    expect(ownerState.collapsedGroups).toEqual([]);
    expect(ownerState.visibleProperties).toEqual(['priority', 'assignee']);
    expect(ownerState.filter.root).toMatchObject({ field: 'assigneeUserId', value: id });
  });

  it('uses one stable grid template for all property sets', () => {
    expect(issueGridTemplate(defaultIssueViewProperties)).toBe(
      '28px 104px minmax(240px, 1.6fr) 92px 128px minmax(116px, .7fr) minmax(124px, .8fr) 98px 28px',
    );
    expect(issueGridTemplate(['milestone', 'priority'])).toBe(
      '28px 104px minmax(240px, 1.6fr) 92px minmax(148px, .8fr) 28px',
    );
    expect(issueGridTemplate([])).toBe('28px 104px minmax(240px, 1.6fr) 28px');
  });
});
