import { describe, expect, it } from 'vitest';
import {
  defaultProjectListRouteState,
  isPushedProjectRoute,
  projectNavigationUrl,
  projectRouteFromSearch,
  projectRouteHistoryState,
} from '../src/project-navigation.js';

const projectId = '50000000-0000-4000-8000-000000000023';
const milestoneId = '52000000-0000-4000-8000-000000000023';

describe('project navigation state', () => {
  it('restores an allowlisted project list, tab, and milestone scope', () => {
    const route = projectRouteFromSearch(
      `?view=projects&q=launch&status=in_progress&priority=high&archive=archived&order=targetDate&direction=desc&density=compact&group=status&properties=status,team,progress&collapsed=status:planned&project=${projectId}&projectTab=issues&milestone=${milestoneId}`,
      defaultProjectListRouteState('default'),
    );

    expect(route).toEqual({
      list: {
        query: 'launch',
        status: 'in_progress',
        priority: 'high',
        archiveState: 'archived',
        order: 'targetDate',
        direction: 'desc',
        density: 'compact',
        groupBy: 'status',
        visibleProperties: ['status', 'team', 'progress'],
        collapsedGroups: ['status:planned'],
      },
      projectId,
      tab: 'issues',
      milestoneId,
    });
  });

  it('fails closed for malformed and incompatible route values', () => {
    const route = projectRouteFromSearch(
      '?status=deleted&priority=critical&archive=all&order=random&direction=sideways&density=tiny&group=owner&properties=status,owner&collapsed=lead:none&project=not-an-id&projectTab=issues&milestone=also-invalid',
      defaultProjectListRouteState('comfortable'),
    );

    expect(route).toEqual({
      list: {
        query: '',
        status: '',
        priority: '',
        archiveState: 'active',
        order: 'position',
        direction: 'asc',
        density: 'comfortable',
        groupBy: 'none',
        visibleProperties: ['status', 'lead', 'targetDate', 'progress'],
        collapsedGroups: [],
      },
      projectId: null,
      tab: 'overview',
      milestoneId: null,
    });
  });

  it('accepts milestone scope only on a project issues tab', () => {
    const activity = projectRouteFromSearch(
      `?project=${projectId}&projectTab=activity&milestone=${milestoneId}`,
      defaultProjectListRouteState('default'),
    );
    expect(activity.tab).toBe('activity');
    expect(activity.milestoneId).toBeNull();

    const list = projectRouteFromSearch(
      `?projectTab=issues&milestone=${milestoneId}`,
      defaultProjectListRouteState('default'),
    );
    expect(list.projectId).toBeNull();
    expect(list.tab).toBe('overview');
    expect(list.milestoneId).toBeNull();
  });

  it('serializes canonical route state without discarding unrelated parameters', () => {
    const url = projectNavigationUrl('https://openlinear.test/?fixture=project-route&context=linked', {
      list: {
        query: 'launch',
        status: 'planned',
        priority: '',
        archiveState: 'active',
        order: 'updatedAt',
        direction: 'desc',
        density: 'comfortable',
        groupBy: 'lead',
        visibleProperties: ['status', 'priority', 'lead', 'progress'],
        collapsedGroups: ['lead:none'],
      },
      projectId,
      tab: 'issues',
      milestoneId,
    });

    expect(url.searchParams.get('view')).toBe('projects');
    expect(url.searchParams.get('fixture')).toBe('project-route');
    expect(url.searchParams.get('context')).toBe('linked');
    expect(url.searchParams.get('q')).toBe('launch');
    expect(url.searchParams.get('status')).toBe('planned');
    expect(url.searchParams.has('priority')).toBe(false);
    expect(url.searchParams.get('archive')).toBe('active');
    expect(url.searchParams.get('order')).toBe('updatedAt');
    expect(url.searchParams.get('direction')).toBe('desc');
    expect(url.searchParams.get('density')).toBe('comfortable');
    expect(url.searchParams.get('group')).toBe('lead');
    expect(url.searchParams.get('properties')).toBe('status,priority,lead,progress');
    expect(url.searchParams.get('collapsed')).toBe('lead:none');
    expect(url.searchParams.get('project')).toBe(projectId);
    expect(url.searchParams.get('projectTab')).toBe('issues');
    expect(url.searchParams.get('milestone')).toBe(milestoneId);
  });

  it('removes detail-only parameters when returning to the project list', () => {
    const url = projectNavigationUrl(
      `https://openlinear.test/?view=projects&project=${projectId}&projectTab=issues&milestone=${milestoneId}`,
      {
        list: defaultProjectListRouteState('default'),
        projectId: null,
        tab: 'overview',
        milestoneId: null,
      },
    );

    expect(url.searchParams.has('project')).toBe(false);
    expect(url.searchParams.has('projectTab')).toBe(false);
    expect(url.searchParams.has('milestone')).toBe(false);
  });

  it('marks only pushed detail routes while preserving other history state', () => {
    const detailState = projectRouteHistoryState({ retained: 1 }, projectId);
    expect(detailState).toEqual({ retained: 1, __openlinearProjectId: projectId });
    expect(isPushedProjectRoute(detailState, projectId)).toBe(true);
    expect(isPushedProjectRoute(detailState, milestoneId)).toBe(false);
    expect(projectRouteHistoryState(detailState, null)).toEqual({ retained: 1 });
  });
});
