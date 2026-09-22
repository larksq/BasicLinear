import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  assignHostedIssue,
  createHostedComment,
  createHostedIssue,
  createHostedMilestone,
  createHostedProject,
  deleteHostedComment,
  joinHostedTeam,
  leaveHostedTeam,
  listHostedComments,
  listHostedIssueActivity,
  listHostedIssues,
  listHostedMembers,
  listHostedMilestones,
  listHostedProjects,
  updateHostedIssue,
  updateHostedMilestone,
  updateHostedProject,
} from '../src/hosted-api.js';
import { restoreCommentEditButtonFocus } from '../src/hosted-app.js';

const response = (data: unknown, status = 200) => new Response(
  JSON.stringify({ data }),
  { status, headers: { 'content-type': 'application/json' } },
);

describe('hosted collaboration client', () => {
  it('joins and leaves teams through the signed-in self-membership route', async () => {
    const teamId = 'team_00000000000000000000000000000001';
    const membership = {
      schemaVersion: 1, id: 'team_member_00000000000000000000000000000001',
      workspaceId: 'ws_client', teamId, userId: 'member_client', role: 'member', status: 'active',
      createdAt: '2026-12-01T00:00:00.000Z', updatedAt: '2026-12-01T00:00:00.000Z', revision: 1,
    } as const;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({membership}))
      .mockResolvedValueOnce(response({membership: {...membership, status: 'left', revision: 2}}));

    await joinHostedTeam('token-value', 'ws_client', teamId, 'team-join-key-0001', fetcher);
    await leaveHostedTeam('token-value', 'ws_client', teamId, 'team-leave-key-0001', fetcher);

    expect(fetcher.mock.calls.map(([path, init]) => [String(path), init?.method, init?.body])).toEqual([
      [`/api/v1/hosted/workspaces/ws_client/teams/${teamId}/members`, 'POST', '{}'],
      [`/api/v1/hosted/workspaces/ws_client/teams/${teamId}/members`, 'DELETE', '{}'],
    ]);
  });

  it('uses the signed-in browser boundary for real project and milestone work', async () => {
    const project = {
      id: 'project_00000000000000000000000000000001', workspaceId: 'ws_client',
      name: 'Production launch', summary: '', status: 'planned', createdByUserId: 'owner_client',
      archivedAt: null, createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z', revision: 1,
    } as const;
    const milestone = {
      id: 'milestone_00000000000000000000000000000001', workspaceId: 'ws_client',
      projectId: project.id, name: 'Launch ready', description: '', targetDate: null,
      createdByUserId: 'owner_client', archivedAt: null,
      createdAt: project.createdAt, updatedAt: project.updatedAt, revision: 1,
    } as const;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({projects: [project]}))
      .mockResolvedValueOnce(response({project}, 201))
      .mockResolvedValueOnce(response({project: {...project, status: 'in_progress', revision: 2}}))
      .mockResolvedValueOnce(response({milestones: [milestone]}))
      .mockResolvedValueOnce(response({milestone}, 201))
      .mockResolvedValueOnce(response({milestone: {...milestone, targetDate: '2027-01-31', revision: 2}}));

    await listHostedProjects('token-value', 'ws_client', fetcher);
    await createHostedProject('token-value', 'ws_client', {name: project.name}, 'project-create-key-0001', fetcher);
    await updateHostedProject('token-value', 'ws_client', project.id, 1, {status: 'in_progress'}, 'project-update-key-0001', fetcher);
    await listHostedMilestones('token-value', 'ws_client', project.id, fetcher);
    await createHostedMilestone('token-value', 'ws_client', project.id, {name: milestone.name}, 'milestone-create-key-0001', fetcher);
    await updateHostedMilestone('token-value', 'ws_client', milestone.id, 1, {targetDate: '2027-01-31'}, 'milestone-update-key-0001', fetcher);

    expect(fetcher.mock.calls.map(([path]) => String(path))).toEqual([
      '/api/v1/hosted/workspaces/ws_client/projects',
      '/api/v1/hosted/workspaces/ws_client/projects',
      `/api/v1/hosted/workspaces/ws_client/projects/${project.id}`,
      `/api/v1/hosted/workspaces/ws_client/projects/${project.id}/milestones`,
      `/api/v1/hosted/workspaces/ws_client/projects/${project.id}/milestones`,
      `/api/v1/hosted/workspaces/ws_client/milestones/${milestone.id}`,
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({credentials: 'same-origin'});
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token-value');
    }
  });

  it('uses only same-origin trusted API routes for the bounded task and comment workflow', async () => {
    const issue = {
      id: 'issue_00000000000000000000000000000001', number: 1, workspaceId: 'ws_client',
      title: 'Client task', status: 'todo', priority: 'no_priority', assigneeUserId: null,
      createdByUserId: 'owner_client', createdAt: '2026-12-01T00:00:00.000Z',
      updatedAt: '2026-12-01T00:00:00.000Z', revision: 1,
    } as const;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ members: [{ userId: 'owner_client', role: 'owner' }] }))
      .mockResolvedValueOnce(response({ issues: [issue] }))
      .mockResolvedValueOnce(response({ issue }, 201))
      .mockResolvedValueOnce(response({ issue: { ...issue, assigneeUserId: 'member_client', revision: 2 } }))
      .mockResolvedValueOnce(response({ issue: { ...issue, status: 'in_progress', revision: 3 } }))
      .mockResolvedValueOnce(response({ comment: {
        id: 'comment_00000000000000000000000000000001', workspaceId: 'ws_client',
        issueId: issue.id, authorUserId: 'member_client', body: 'Started',
        createdAt: issue.createdAt, updatedAt: issue.createdAt, deletedAt: null, revision: 1,
      } }, 201))
      .mockResolvedValueOnce(response({ comments: [] }))
      .mockResolvedValueOnce(response({ comment: {
        id: 'comment_00000000000000000000000000000001', workspaceId: 'ws_client',
        issueId: issue.id, authorUserId: 'member_client', body: null,
        createdAt: issue.createdAt, updatedAt: issue.createdAt, deletedAt: issue.createdAt, revision: 2,
      } }));

    await listHostedMembers('token-value', 'ws_client', fetcher);
    await listHostedIssues('token-value', 'ws_client', fetcher);
    await createHostedIssue('token-value', 'ws_client', issue.title, 'create-key-00000001', fetcher);
    await assignHostedIssue('token-value', 'ws_client', issue.id, 1, 'member_client', 'assign-key-00000001', fetcher);
    await updateHostedIssue('token-value', 'ws_client', issue.id, 2, { status: 'in_progress' }, 'update-key-00000001', fetcher);
    await createHostedComment('token-value', 'ws_client', issue.id, 'Started', 'comment-key-0000001', fetcher);
    await listHostedComments('token-value', 'ws_client', issue.id, fetcher);
    await deleteHostedComment('token-value', 'ws_client', issue.id,
      'comment_00000000000000000000000000000001', 1, 'delete-key-00000001', fetcher);

    for (const [path, init] of fetcher.mock.calls) {
      expect(String(path)).toMatch(/^\/api\/v1\/hosted\/workspaces\/ws_client\//u);
      expect(init).toMatchObject({ credentials: 'same-origin' });
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token-value');
    }
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      'GET', 'GET', 'POST', 'PUT', 'PATCH', 'POST', 'GET', 'DELETE',
    ]);
  });

  it('renders keyboard-native task controls, assignment recovery, and durable comment tombstones', () => {
    const source = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const styles = readFileSync('apps/web/src/hosted.css', 'utf8');
    expect(source).toContain('My Work and workspace tasks');
    expect(source).toContain('Members can update tasks assigned to them.');
    expect(source).toContain('Removed member');
    expect(source).toContain('<option value={selectedIssue.assigneeUserId} disabled>');
    expect(source).toContain('Comment deleted · history preserved');
    expect(source).toContain('Edit comment by {comment.authorUserId}');
    expect(source).toContain('autoFocus maxLength={4000}');
    expect(source).toContain('restoreCommentEditButtonFocus(');
    expect(source).toContain("setStatus('No task changes to save.')");
    expect(source).toContain('Revision {selectedIssue.revision}');
    expect(source).toContain('aria-current');
    expect(source).toContain('aria-live="polite"');
    expect(styles).toContain('select:focus-visible');
    expect(styles).toContain('@media (max-width: 820px)');
    expect(source).not.toMatch(/mention|reaction|attachment|notification|agent prompt|code review|pull request/iu);
  });

  it('renders the hosted product as an operating workspace instead of a stacked information page', () => {
    const source = readFileSync('apps/web/src/hosted-workspace.tsx', 'utf8');
    const styles = readFileSync('apps/web/src/hosted-workspace.css', 'utf8');
    expect(source).toContain('aria-label="Global workspace navigation"');
    expect(source).toContain('aria-label="Workspace product navigation"');
    expect(source).toContain('<span>Show less</span>');
    expect(source).toContain('<span>Show more</span>');
    expect(source).toContain('Create issue');
    expect(source).toContain('Create project');
    expect(source).toContain('Add milestone');
    expect(source).toContain('Issue properties');
    expect(source).toContain('Sub-issues');
    expect(source).toContain('Resources');
    expect(source).toContain('Issue description');
    expect(source).toContain('type SavedViewId = HostedSavedViewPredicate');
    expect(source).toContain("setModal('team')");
    expect(source).toContain("setModal('status')");
    expect(source).toContain("setModal('view')");
    expect(source).toContain('createHostedTeam(');
    expect(source).toContain('updateHostedTeam(');
    expect(source).toContain('createHostedWorkflowStatus(');
    expect(source).toContain('updateHostedWorkflowStatus(');
    expect(source).toContain('moveWorkflowStatus(');
    expect(source).toContain('createHostedSavedView(');
    expect(source).toContain('joinHostedTeam(');
    expect(source).toContain('leaveHostedTeam(');
    expect(source).toContain('Remove from organization');
    expect(source).toContain('System-default names, categories, colors, ordering, and deletion are locked.');
    expect(source).toContain('type="datetime-local"');
    expect(source).toContain("priority === 'urgent'");
    expect(source).toContain('<SignalHigh');
    expect(source).toContain('<SignalMedium');
    expect(source).toContain('<SignalLow');
    expect(source).toContain('<span>Views</span>');
    expect(source).not.toContain('<span>Cycles</span>');
    expect(source).toContain("type NavigationScope = 'workspace' | 'team'");
    expect(source).toContain("navigationScope === 'workspace' && view === 'projects'");
    expect(source).toContain("navigationScope === 'team' && activeTeam && view === 'projects'");
    expect(source).toContain("go('workspace_view', 'workspace')");
    expect(source).toContain('Projects appear here when this team has an issue in them.');
    expect(source).toContain('Filter projects by status');
    expect(source).toContain('Sort projects');
    expect(source).toContain("viewType === 'projects'");
    expect(source).toContain('aria-expanded={!collapsed}');
    expect(source).toContain('aria-expanded={!collapsedDetailSectionIds.includes');
    expect(source).toContain('aria-haspopup="listbox"');
    expect(source).toContain("setModal('invite')");
    expect(source).toContain('API & MCP');
    expect(source).toContain('return `OL-${issue.number}`;');
    expect(source).not.toContain('issue.id.slice(-6)');
    expect(styles).toContain('grid-template-columns: 238px minmax(0, 1fr)');
    expect(styles).toContain('@media (max-width: 820px)');
  });

  it('uses the hosted issue API for rich issue content and the durable activity feed', async () => {
    const activity = [{
      schemaVersion: 1, id: 'activity_00000000000000000000000000000001', workspaceId: 'ws_client',
      issueId: 'issue_00000000000000000000000000000001', actorUserId: 'owner_client',
      action: 'issue.description.changed', entityType: 'issue',
      entityId: 'issue_00000000000000000000000000000001', occurredAt: '2026-12-01T00:00:00.000Z',
      revisionBefore: 1, revisionAfter: 2,
    }] as const;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({issue: {
        schemaVersion: 1, id: activity[0].issueId, number: 1, workspaceId: 'ws_client', title: 'Rich issue',
        description: 'Durable description', status: 'todo', priority: 'no_priority', projectId: null,
        milestoneId: null, parentIssueId: null,
        resources: [{label: 'Brief', url: 'https://example.com/brief'}], assigneeUserId: null,
        createdByUserId: 'owner_client', createdAt: activity[0].occurredAt,
        updatedAt: activity[0].occurredAt, revision: 1,
      }}, 201))
      .mockResolvedValueOnce(response({activity}));

    await createHostedIssue('token-value', 'ws_client', {
      title: 'Rich issue', description: 'Durable description',
      resources: [{label: 'Brief', url: 'https://example.com/brief'}],
    }, 'create-rich-key-0001', fetcher);
    await listHostedIssueActivity('token-value', 'ws_client', activity[0].issueId, fetcher);

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({
      description: 'Durable description', resources: [{label: 'Brief', url: 'https://example.com/brief'}],
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(`/api/v1/hosted/workspaces/ws_client/issues/${activity[0].issueId}/activity`);
  });

  it('defers Save focus restoration until the remounted Edit button is enabled', () => {
    const focus = vi.fn();
    const button = { disabled: true, focus };
    const buttons = new Map([['comment_focus', button]]);

    expect(restoreCommentEditButtonFocus(null, true, 'comment_focus', buttons))
      .toBe('comment_focus');
    expect(focus).not.toHaveBeenCalled();

    button.disabled = false;
    expect(restoreCommentEditButtonFocus(null, false, 'comment_focus', buttons)).toBeNull();
    expect(focus).toHaveBeenCalledOnce();
  });
});
