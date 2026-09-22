import { describe, expect, it } from 'vitest';
import {
  isIssueWorkspaceView,
  isTeamWorkspaceView,
  ownerWorkspaceUrl,
  savedViewNavigationUrl,
  teamIdFromSearch,
  teamNavigationUrl,
  workspaceIdFromSearch,
  workspaceNavigationUrl,
  workspaceSelectionUrl,
  workspaceViewFromSearch,
  workspaceViewLabel,
} from '../src/workspace-navigation.js';

describe('single-owner navigation state', () => {
  it('restores only supported direct destinations', () => {
    expect(workspaceViewFromSearch('?view=my-work')).toBe('my-work');
    expect(workspaceViewFromSearch('?view=workflow')).toBe('workflow');
    expect(workspaceViewFromSearch('?view=teams')).toBe('projects');
    expect(workspaceViewFromSearch('?view=members')).toBe('projects');
    expect(workspaceViewFromSearch('?view=overview')).toBe('projects');
    expect(workspaceViewFromSearch('?view=unknown')).toBe('projects');
    expect(workspaceViewFromSearch('')).toBe('projects');
  });

  it('identifies issue-backed destinations and names My work naturally', () => {
    expect(isIssueWorkspaceView('my-work')).toBe(true);
    expect(isIssueWorkspaceView('issues')).toBe(true);
    expect(isIssueWorkspaceView('projects')).toBe(false);
    expect(workspaceViewLabel('my-work')).toBe('My work');
    expect(workspaceViewLabel('projects')).toBe('Projects');
    expect(isTeamWorkspaceView('issues')).toBe(true);
    expect(isTeamWorkspaceView('projects')).toBe(true);
    expect(isTeamWorkspaceView('views')).toBe(true);
    expect(isTeamWorkspaceView('my-work')).toBe(false);
  });

  it('never restores legacy team or workspace choices', () => {
    expect(teamIdFromSearch('?team=team-b&view=issues', ['team-a', 'team-b'])).toBeNull();
    expect(workspaceIdFromSearch(
      '?workspace=workspace-b&view=issues',
      ['workspace-a', 'workspace-b'],
    )).toBe('workspace-a');
    expect(workspaceIdFromSearch('', ['workspace-a', 'workspace-b'], 'workspace-b')).toBe('workspace-b');
    expect(workspaceIdFromSearch('', ['workspace-a'], 'workspace-private')).toBe('workspace-a');
    expect(workspaceIdFromSearch('', [])).toBe('');
  });

  it('canonicalizes explicit workspace selection and clears scoped record state', () => {
    const next = workspaceSelectionUrl(
      'https://basiclinear.test/?workspace=workspace-a&view=issues&issue=issue-a&project=project-a&layout=board&saved=view-a&q=release&fixture=workspace-route',
      'workspace-b',
      { resetSurface: true },
    );

    expect(next.searchParams.has('workspace')).toBe(false);
    expect(next.searchParams.get('view')).toBe('issues');
    expect(next.searchParams.get('fixture')).toBe('workspace-route');
    for (const parameter of ['team', 'issue', 'project', 'layout', 'saved', 'q']) {
      expect(next.searchParams.has(parameter)).toBe(false);
    }
  });

  it('keeps supported same-surface state and removes all explicit scope', () => {
    const same = workspaceNavigationUrl(
      'https://basiclinear.test/?workspace=workspace-a&team=team-a&view=issues&layout=board&q=release&fixture=state',
      'issues',
      'issues',
    );
    expect(same.searchParams.has('workspace')).toBe(false);
    expect(same.searchParams.has('team')).toBe(false);
    expect(same.searchParams.get('layout')).toBe('board');
    expect(same.searchParams.get('q')).toBe('release');

    const exit = workspaceNavigationUrl(same.href, 'projects', 'issues');
    expect(exit.searchParams.get('view')).toBe('projects');
    expect(exit.searchParams.has('layout')).toBe(false);
    expect(exit.searchParams.has('q')).toBe(false);
    expect(exit.searchParams.get('fixture')).toBe('state');
  });

  it('canonicalizes former team and saved-view navigation to owner scope', () => {
    const team = teamNavigationUrl(
      'https://basiclinear.test/?workspace=workspace-a&view=issues&team=team-a&issue=issue-a&fixture=team-route',
      'team-b',
      'projects',
    );
    expect(team.searchParams.get('view')).toBe('projects');
    expect(team.searchParams.has('workspace')).toBe(false);
    expect(team.searchParams.has('team')).toBe(false);
    expect(team.searchParams.has('issue')).toBe(false);

    const saved = savedViewNavigationUrl(team.href, 'view-a', 'team-b');
    expect(saved.searchParams.get('view')).toBe('issues');
    expect(saved.searchParams.get('saved')).toBe('view-a');
    expect(saved.searchParams.has('team')).toBe(false);
  });

  it('clears record state from explicit legacy scopes and administration routes', () => {
    const scoped = ownerWorkspaceUrl(
      'https://basiclinear.test/?workspace=workspace-private&team=team-private&view=issues&issue=issue-private&fixture=legacy',
    );
    expect(scoped.searchParams.has('workspace')).toBe(false);
    expect(scoped.searchParams.has('team')).toBe(false);
    expect(scoped.searchParams.has('issue')).toBe(false);
    expect(scoped.searchParams.get('view')).toBe('issues');
    expect(scoped.searchParams.get('fixture')).toBe('legacy');

    const administration = ownerWorkspaceUrl(
      'https://basiclinear.test/?view=members&filter=private&fixture=legacy',
    );
    expect(administration.searchParams.get('view')).toBe('projects');
    expect(administration.searchParams.has('filter')).toBe(false);
    expect(administration.searchParams.get('fixture')).toBe('legacy');
  });
});
