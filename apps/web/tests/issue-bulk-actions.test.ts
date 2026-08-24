import { describe, expect, it } from 'vitest';
import {
  emptyIssueBulkDraft,
  issueBulkClearValue,
  issueBulkLabelRequest,
  issueBulkLabels,
  issueBulkMilestones,
  issueBulkProjects,
  issueBulkResultSummary,
  issueBulkStatuses,
  issueBulkUnassignedValue,
  issueBulkUpdateRequest,
  reconcileIssueBulkDraft,
  type IssueBulkDraft,
} from '../src/issue-bulk-actions.js';

const issues = [
  { id: 'issue-a', revision: 3, teamId: 'team-a' },
  { id: 'issue-b', revision: 7, teamId: 'team-a' },
];
const statuses = [
  { id: 'status-a', teamId: 'team-a' },
  { id: 'status-b', teamId: 'team-b' },
];
const members = [{ userId: 'user-a' }];
const projects = [
  { id: 'project-a', teamId: 'team-a', archivedAt: null },
  { id: 'project-b', teamId: 'team-a', archivedAt: null },
  { id: 'project-archived', teamId: 'team-a', archivedAt: '2026-08-20T00:00:00Z' },
  { id: 'project-other-team', teamId: 'team-b', archivedAt: null },
];
const milestones = [
  { id: 'milestone-a', projectId: 'project-a', archivedAt: null },
  { id: 'milestone-b', projectId: 'project-b', archivedAt: null },
  { id: 'milestone-archived', projectId: 'project-a', archivedAt: '2026-08-20T00:00:00Z' },
];
const labels = [
  { id: 'label-a', archivedAt: null },
  { id: 'label-b', archivedAt: null },
  { id: 'label-archived', archivedAt: '2026-08-20T00:00:00Z' },
];

function draft(patch: Partial<IssueBulkDraft>): IssueBulkDraft {
  return { ...emptyIssueBulkDraft(), ...patch };
}

describe('issue bulk actions', () => {
  it('keeps status, project, and milestone choices unique, active, and common-team scoped', () => {
    expect(issueBulkStatuses(issues, [...statuses, statuses[0]!]).map((item) => item.id)).toEqual([]);
    expect(issueBulkProjects(issues, projects).map((item) => item.id)).toEqual(['project-a', 'project-b']);
    expect(issueBulkMilestones(issues, projects, milestones).map((item) => item.id)).toEqual([
      'milestone-a',
      'milestone-b',
    ]);
    expect(issueBulkMilestones(issues, projects, milestones, 'project-b').map((item) => item.id)).toEqual([
      'milestone-b',
    ]);
  });

  it('builds one revision-safe request for all deliberate property changes', () => {
    expect(issueBulkUpdateRequest(issues, draft({
      statusId: 'status-a',
      priority: 'urgent',
      assigneeUserId: issueBulkUnassignedValue,
      projectId: 'project-b',
      milestoneId: 'milestone-b',
      dueDate: '2026-11-04',
    }), statuses, members, projects, milestones)).toEqual({
      items: [
        { id: 'issue-a', expectedRevision: 3 },
        { id: 'issue-b', expectedRevision: 7 },
      ],
      mutation: {
        type: 'update',
        patch: {
          statusId: 'status-a',
          priority: 'urgent',
          assigneeUserId: null,
          dueDate: '2026-11-04',
          projectId: 'project-b',
          milestoneId: 'milestone-b',
        },
      },
    });
  });

  it('clears milestones when a project changes without an explicit milestone', () => {
    expect(issueBulkUpdateRequest(issues, draft({ projectId: 'project-b' }), statuses, members, projects, milestones))
      .toEqual({
        items: [
          { id: 'issue-a', expectedRevision: 3 },
          { id: 'issue-b', expectedRevision: 7 },
        ],
        mutation: { type: 'update', patch: { projectId: 'project-b', milestoneId: null } },
      });
  });

  it('pairs a milestone-only selection with its owning project', () => {
    expect(issueBulkUpdateRequest(issues, draft({ milestoneId: 'milestone-b' }), statuses, members, projects, milestones))
      .toMatchObject({ mutation: { patch: { projectId: 'project-b', milestoneId: 'milestone-b' } } });
  });

  it('supports independent no-project, no-milestone, and clear-due-date actions', () => {
    expect(issueBulkUpdateRequest(issues, draft({ projectId: issueBulkClearValue }), statuses, members, projects, milestones))
      .toMatchObject({ mutation: { patch: { projectId: null, milestoneId: null } } });
    expect(issueBulkUpdateRequest(issues, draft({ milestoneId: issueBulkClearValue }), statuses, members, projects, milestones))
      .toMatchObject({ mutation: { patch: { milestoneId: null } } });
    expect(issueBulkUpdateRequest(issues, draft({ clearDueDate: true }), statuses, members, projects, milestones))
      .toMatchObject({ mutation: { patch: { dueDate: null } } });
  });

  it('rejects empty, duplicate, cross-team, archived, inconsistent, and invalid-date requests', () => {
    expect(issueBulkUpdateRequest([], draft({ priority: 'high' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest([issues[0]!, issues[0]!], draft({ priority: 'high' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest([...issues, { id: 'issue-c', revision: 1, teamId: 'team-b' }], draft({ statusId: 'status-a' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest(issues, draft({ projectId: 'project-archived' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest(issues, draft({ projectId: 'project-a', milestoneId: 'milestone-b' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest(issues, draft({ dueDate: '2026-02-30' }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest(issues, draft({ dueDate: '2026-11-04', clearDueDate: true }), statuses, members, projects, milestones)).toBeNull();
    expect(issueBulkUpdateRequest(issues, emptyIssueBulkDraft(), statuses, members, projects, milestones)).toBeNull();
  });

  it('still permits team-neutral priority and due-date updates across teams', () => {
    const mixed = [...issues, { id: 'issue-c', revision: 1, teamId: 'team-b' }];
    expect(issueBulkUpdateRequest(mixed, draft({ priority: 'low', dueDate: '2026-12-01' }), statuses, members, projects, milestones))
      .toMatchObject({ mutation: { patch: { priority: 'low', dueDate: '2026-12-01' } } });
    expect(issueBulkProjects(mixed, projects)).toEqual([]);
  });

  it('builds revision-safe add and remove requests from unique active labels', () => {
    expect(issueBulkLabels([...labels, labels[0]!]).map((item) => item.id)).toEqual(['label-b']);
    expect(issueBulkLabelRequest(issues, 'add', ['label-a', 'label-b'], labels)).toEqual({
      items: [
        { id: 'issue-a', expectedRevision: 3 },
        { id: 'issue-b', expectedRevision: 7 },
      ],
      mutation: { type: 'labels', operation: 'add', labelIds: ['label-a', 'label-b'] },
    });
    expect(issueBulkLabelRequest(issues, 'remove', ['label-b'], labels))
      .toMatchObject({ mutation: { type: 'labels', operation: 'remove', labelIds: ['label-b'] } });
  });

  it('rejects unsafe bulk label selections', () => {
    expect(issueBulkLabelRequest([], 'add', ['label-a'], labels)).toBeNull();
    expect(issueBulkLabelRequest([issues[0]!, issues[0]!], 'add', ['label-a'], labels)).toBeNull();
    expect(issueBulkLabelRequest(issues, 'add', [], labels)).toBeNull();
    expect(issueBulkLabelRequest(issues, 'add', ['label-a', 'label-a'], labels)).toBeNull();
    expect(issueBulkLabelRequest(issues, 'add', ['label-archived'], labels)).toBeNull();
    expect(issueBulkLabelRequest(issues, 'add', ['label-missing'], labels)).toBeNull();
  });

  it('removes stale dependent choices when selection eligibility changes', () => {
    expect(reconcileIssueBulkDraft(draft({
      statusId: 'status-b',
      assigneeUserId: 'missing-user',
      projectId: 'project-b',
      milestoneId: 'milestone-b',
    }), [statuses[0]!], members, [projects[0]!], [milestones[0]!])).toEqual(emptyIssueBulkDraft());
    expect(reconcileIssueBulkDraft(draft({
      projectId: issueBulkClearValue,
      milestoneId: 'milestone-a',
    }), statuses, members, projects, milestones)).toMatchObject({
      projectId: issueBulkClearValue,
      milestoneId: '',
    });
  });

  it('formats one stable aggregate result announcement', () => {
    expect(issueBulkResultSummary([
      { id: 'issue-a', status: 'updated' },
      { id: 'issue-b', status: 'conflict' },
      { id: 'issue-c', status: 'failed' },
    ])).toBe('1 updated, 1 conflicts, 1 failed');
  });
});
