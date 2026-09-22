import { describe, expect, it } from 'vitest';
import type { Membership, Project, Team } from '@basiclinear/contracts';
import {
  collapsedProjectGroupsFromParam,
  collapsedProjectGroupsParam,
  defaultProjectViewProperties,
  groupProjects,
  projectGridTemplate,
  projectViewGroupingFromParam,
  projectViewPropertiesFromParam,
  projectViewPropertiesParam,
  toggleProjectViewProperty,
  visibleGroupedProjectIds,
} from '../src/project-view-configuration.js';

const timestamp = '2026-08-20T00:00:00.000Z';
const workspaceId = '20000000-0000-4000-8000-000000000023';
const teamAId = '30000000-0000-4000-8000-000000000023';
const teamBId = '30000000-0000-4000-8000-000000000024';
const memberAId = '10000000-0000-4000-8000-000000000023';
const memberBId = '10000000-0000-4000-8000-000000000024';

const teams: Team[] = [
  { id: teamAId, workspaceId, name: 'Zeta', key: 'ZET', revision: 1, createdAt: timestamp, updatedAt: timestamp },
  { id: teamBId, workspaceId, name: 'Alpha', key: 'ALP', revision: 1, createdAt: timestamp, updatedAt: timestamp },
];
const members: Membership[] = [
  { id: '21000000-0000-4000-8000-000000000023', workspaceId, userId: memberAId, email: 'zeta@example.test', displayName: 'Zeta Lead', role: 'member', revision: 1, createdAt: timestamp, updatedAt: timestamp },
  { id: '21000000-0000-4000-8000-000000000024', workspaceId, userId: memberBId, email: 'alpha@example.test', displayName: 'Alpha Lead', role: 'member', revision: 1, createdAt: timestamp, updatedAt: timestamp },
];

function project(
  idSuffix: string,
  overrides: Partial<Pick<Project, 'status' | 'priority' | 'leadUserId' | 'teamId' | 'name'>> = {},
): Project {
  return {
    id: `50000000-0000-4000-8000-0000000000${idSuffix}`,
    workspaceId,
    teamId: teamAId,
    name: `Project ${idSuffix}`,
    summary: '',
    status: 'planned',
    priority: 'none',
    leadUserId: null,
    startDate: null,
    targetDate: null,
    icon: 'layers',
    color: '#5E6AD2',
    position: 100,
    overviewDocument: { version: 1, type: 'doc', content: [] },
    resources: [],
    progress: { policy: 'project-progress-v1', issueCount: 0, completedCount: 0, canceledCount: 0, eligibleCount: 0, fraction: 0 },
    archivedAt: null,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe('project view configuration', () => {
  it('parses only allowlisted grouping and canonical properties', () => {
    expect(projectViewGroupingFromParam('team', 'none')).toBe('team');
    expect(projectViewGroupingFromParam('owner', 'status')).toBe('status');
    expect(projectViewPropertiesFromParam('progress,status,team', defaultProjectViewProperties))
      .toEqual(['status', 'team', 'progress']);
    expect(projectViewPropertiesParam(['progress', 'status', 'team'])).toBe('status,team,progress');
    expect(projectViewPropertiesFromParam('none', defaultProjectViewProperties)).toEqual([]);
    expect(projectViewPropertiesParam([])).toBe('none');
  });

  it('fails the complete property payload closed on invalid or duplicate entries', () => {
    expect(projectViewPropertiesFromParam('status,owner', defaultProjectViewProperties))
      .toEqual(defaultProjectViewProperties);
    expect(projectViewPropertiesFromParam('status,status', defaultProjectViewProperties))
      .toEqual(defaultProjectViewProperties);
  });

  it('validates collapsed keys against the active grouping', () => {
    const collapsed = `lead:${memberAId},lead:none`;
    expect(collapsedProjectGroupsFromParam(collapsed, 'lead')).toEqual([
      `lead:${memberAId}`,
      'lead:none',
    ]);
    expect(collapsedProjectGroupsParam(['lead:none', `lead:${memberAId}`], 'lead'))
      .toBe(`lead:none,lead:${memberAId}`);
    expect(collapsedProjectGroupsFromParam('status:planned,lead:none', 'status')).toEqual([]);
    expect(collapsedProjectGroupsFromParam('status:planned,status:planned', 'status')).toEqual([]);
    expect(collapsedProjectGroupsFromParam('status:planned', 'none')).toEqual([]);
  });

  it('keeps visible properties in stable column order when toggled', () => {
    expect(toggleProjectViewProperty(['progress', 'lead'], 'status')).toEqual([
      'status',
      'lead',
      'progress',
    ]);
    expect(toggleProjectViewProperty(['status', 'lead'], 'lead')).toEqual(['status']);
  });

  it('orders status and priority groups by workflow semantics', () => {
    const values = [
      project('23', { status: 'completed', priority: 'none' }),
      project('24', { status: 'planned', priority: 'low' }),
      project('25', { status: 'in_progress', priority: 'urgent' }),
    ];
    expect(groupProjects(values, 'status', teams, members).map((group) => group.key)).toEqual([
      'status:planned',
      'status:in_progress',
      'status:completed',
    ]);
    expect(groupProjects(values, 'priority', teams, members).map((group) => group.key)).toEqual([
      'priority:urgent',
      'priority:low',
      'priority:none',
    ]);
  });

  it('orders named groups alphabetically and keeps missing values last', () => {
    const unknownId = '10000000-0000-4000-8000-000000000025';
    const values = [
      project('23', { leadUserId: memberAId, teamId: teamAId }),
      project('24', { leadUserId: memberBId, teamId: teamBId }),
      project('25', { leadUserId: null, teamId: '30000000-0000-4000-8000-000000000025' }),
      project('26', { leadUserId: unknownId, teamId: teamAId }),
    ];
    expect(groupProjects(values, 'lead', teams, members).map((group) => group.label)).toEqual([
      'Alpha Lead',
      'Zeta Lead',
      'No lead',
      'Unknown lead',
    ]);
    expect(groupProjects(values, 'team', teams, members).map((group) => group.label)).toEqual([
      'Alpha',
      'Zeta',
      'Unknown team',
    ]);
  });

  it('flattens only rows from expanded groups in their original order', () => {
    const values = [
      project('23', { status: 'planned' }),
      project('24', { status: 'in_progress' }),
      project('25', { status: 'planned' }),
    ];
    const groups = groupProjects(values, 'status', teams, members);
    expect(visibleGroupedProjectIds(groups, ['status:planned'])).toEqual([values[1]?.id]);
  });

  it('uses one stable grid template for every selected property set', () => {
    expect(projectGridTemplate(defaultProjectViewProperties)).toBe(
      'minmax(260px, 1fr) 116px 130px 100px 128px 94px',
    );
    expect(projectGridTemplate(['team', 'startDate'])).toBe(
      'minmax(260px, 1fr) 140px 100px 94px',
    );
    expect(projectGridTemplate([])).toBe('minmax(260px, 1fr) 94px');
  });
});
