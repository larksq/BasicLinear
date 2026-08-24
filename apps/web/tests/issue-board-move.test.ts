import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { Issue, Membership, Milestone, Project, WorkflowStatus } from '@openlinear/contracts';
import {
  issueBoardDragThresholdExceeded,
  issueBoardMoveRequest,
} from '../src/issue-board-move.js';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const teamId = '20000000-0000-4000-8000-000000000001';
const otherTeamId = '20000000-0000-4000-8000-000000000002';
const now = '2026-08-20T00:00:00.000Z';
const progress = { policy: 'project-progress-v1' as const, issueCount: 0, completedCount: 0, canceledCount: 0, eligibleCount: 0, fraction: 0 };

const issue: Issue = {
  id: '60000000-0000-4000-8000-000000000001',
  workspaceId,
  teamId,
  sequenceNumber: 1,
  identifier: 'ENG-1',
  title: 'Move this issue',
  descriptionDocument: { version: 1, type: 'doc', content: [] },
  statusId: '30000000-0000-4000-8000-000000000001',
  priority: 'medium',
  assigneeUserId: '40000000-0000-4000-8000-000000000001',
  dueDate: null,
  projectId: '50000000-0000-4000-8000-000000000001',
  milestoneId: '70000000-0000-4000-8000-000000000001',
  labels: [],
  resources: [],
  archivedAt: null,
  revision: 7,
  createdAt: now,
  updatedAt: now,
};

const statuses: WorkflowStatus[] = [
  { id: issue.statusId, workspaceId, teamId, name: 'Todo', category: 'unstarted', color: '#999999', position: 100, isDefault: true, revision: 1, createdAt: now, updatedAt: now },
  { id: '30000000-0000-4000-8000-000000000002', workspaceId, teamId, name: 'Done', category: 'completed', color: '#44aa66', position: 200, isDefault: false, revision: 1, createdAt: now, updatedAt: now },
  { id: '30000000-0000-4000-8000-000000000003', workspaceId, teamId: otherTeamId, name: 'Other', category: 'started', color: '#4488cc', position: 100, isDefault: true, revision: 1, createdAt: now, updatedAt: now },
];

const members: Membership[] = [
  { id: '41000000-0000-4000-8000-000000000001', workspaceId, userId: issue.assigneeUserId!, email: 'one@example.test', displayName: 'One', role: 'member', revision: 1, createdAt: now, updatedAt: now },
  { id: '41000000-0000-4000-8000-000000000002', workspaceId, userId: '40000000-0000-4000-8000-000000000002', email: 'two@example.test', displayName: 'Two', role: 'member', revision: 1, createdAt: now, updatedAt: now },
];

function project(id: string, candidateTeamId: string, archivedAt: string | null = null): Project {
  return {
    id, workspaceId, teamId: candidateTeamId, name: id, summary: '', status: 'planned', priority: 'none', leadUserId: null,
    startDate: null, targetDate: null, icon: 'layers', color: '#666666', position: 100,
    overviewDocument: { version: 1, type: 'doc', content: [] }, resources: [], progress, archivedAt,
    revision: 1, createdAt: now, updatedAt: now,
  };
}

function milestone(id: string, projectId: string, archivedAt: string | null = null): Milestone {
  return { id, workspaceId, projectId, name: id, description: '', targetDate: null, position: 100, progress, archivedAt, revision: 1, createdAt: now, updatedAt: now };
}

const projects = [
  project(issue.projectId!, teamId),
  project('50000000-0000-4000-8000-000000000002', teamId),
  project('50000000-0000-4000-8000-000000000003', otherTeamId),
  project('50000000-0000-4000-8000-000000000004', teamId, now),
];
const milestones = [
  milestone(issue.milestoneId!, issue.projectId!),
  milestone('70000000-0000-4000-8000-000000000002', projects[1]!.id),
  milestone('70000000-0000-4000-8000-000000000003', projects[2]!.id),
  milestone('70000000-0000-4000-8000-000000000004', projects[1]!.id, now),
];

describe('issue board movement', () => {
  it('uses a finite six-pixel pickup threshold', () => {
    expect(issueBoardDragThresholdExceeded(10, 10, 13, 14)).toBe(false);
    expect(issueBoardDragThresholdExceeded(10, 10, 16, 10)).toBe(true);
    expect(issueBoardDragThresholdExceeded(10, 10, Number.NaN, 10)).toBe(false);
    expect(issueBoardDragThresholdExceeded(10, 10, 16, 10, -1)).toBe(false);
  });

  it('builds revision-safe status, priority, and assignee patches', () => {
    expect(issueBoardMoveRequest(issue, 'status', statuses[1]!.id, statuses, members, projects, milestones)).toEqual({ expectedRevision: 7, statusId: statuses[1]!.id });
    expect(issueBoardMoveRequest(issue, 'priority', 'urgent', statuses, members, projects, milestones)).toEqual({ expectedRevision: 7, priority: 'urgent' });
    expect(issueBoardMoveRequest(issue, 'assignee', members[1]!.userId, statuses, members, projects, milestones)).toEqual({ expectedRevision: 7, assigneeUserId: members[1]!.userId });
    expect(issueBoardMoveRequest(issue, 'assignee', 'unassigned', statuses, members, projects, milestones)).toEqual({ expectedRevision: 7, assigneeUserId: null });
  });

  it('clears milestone assignment when a project move crosses projects', () => {
    expect(issueBoardMoveRequest(issue, 'project', projects[1]!.id, statuses, members, projects, milestones)).toEqual({
      expectedRevision: 7,
      projectId: projects[1]!.id,
      milestoneId: null,
    });
    expect(issueBoardMoveRequest(issue, 'project', 'no-project', statuses, members, projects, milestones)).toEqual({
      expectedRevision: 7,
      projectId: null,
      milestoneId: null,
    });
  });

  it('pairs a milestone move with its team-valid project', () => {
    expect(issueBoardMoveRequest(issue, 'milestone', milestones[1]!.id, statuses, members, projects, milestones)).toEqual({
      expectedRevision: 7,
      projectId: projects[1]!.id,
      milestoneId: milestones[1]!.id,
    });
    expect(issueBoardMoveRequest(issue, 'milestone', 'no-milestone', statuses, members, projects, milestones)).toEqual({
      expectedRevision: 7,
      milestoneId: null,
    });
  });

  it('rejects no-op, unknown, archived, cross-team, and duplicate targets', () => {
    expect(issueBoardMoveRequest(issue, 'none', 'all', statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'status', issue.statusId, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'priority', 'invalid', statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'status', statuses[2]!.id, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'project', projects[2]!.id, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'project', projects[3]!.id, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'milestone', milestones[2]!.id, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'milestone', milestones[3]!.id, statuses, members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest(issue, 'status', statuses[1]!.id, [...statuses, statuses[1]!], members, projects, milestones)).toBeNull();
    expect(issueBoardMoveRequest({ ...issue, archivedAt: now }, 'priority', 'urgent', statuses, members, projects, milestones)).toBeNull();
  });

  it('wires one captured primary pointer with cancellation and commit readback', async () => {
    const source = await readFile(new URL('../src/issues.tsx', import.meta.url), 'utf8');
    expect(source).toContain("event.pointerType === 'mouse' && event.button !== 0");
    expect(source).toContain('!event.isPrimary');
    expect(source).toContain('event.currentTarget.setPointerCapture(event.pointerId)');
    expect(source).toContain('document.elementFromPoint(event.clientX, event.clientY)');
    expect(source).toContain("?.closest<HTMLElement>('[data-board-group-key]')");
    expect(source).toContain('event.currentTarget.hasPointerCapture(event.pointerId)');
    expect(source).toContain('event.currentTarget.releasePointerCapture(event.pointerId)');
    expect(source).toContain('onPointerCancel={canDrag ? onCancelDrag : undefined}');
    expect(source).toContain('onLostPointerCapture={canDrag ? onCancelDrag : undefined}');
    expect(source).toContain('picked up. Target ${validTarget.label}. Release to move.');
    expect(source).toContain('const input = issueBoardMoveRequest(');
    expect(source).toContain('await refreshIssueAction(variables.targetWorkspaceId, updated.id)');
    expect(source).toContain("client.invalidateQueries({ queryKey: ['workspace-milestones', targetWorkspaceId] })");
    expect(source).toContain('setBoardFocusIssueId(updated.id)');
    expect(source).toContain('<div className="issue-board" role="region" aria-label="Issue board" tabIndex={-1}');
    expect(source).toContain('boardRef.current?.focus()');
  });

  it('exposes a stateful issue update fixture with stale-revision rejection', async () => {
    const source = await readFile(new URL('../../../scripts/serve-visual-fixture.mjs', import.meta.url), 'utf8');
    expect(source).toContain("fixtureName(request) === 'issue-board-move'");
    expect(source).toContain("request.method === 'PATCH'");
    expect(source).toContain("apiError(response, 'REVISION_CONFLICT'");
    expect(source).toContain('issueBoardMoveIssues[index] = next');
    expect(source).toContain("apiError(response, 'INVALID_ASSIGNMENT'");
  });
});
