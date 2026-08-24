import type {
  BulkIssueMutationRequest,
  BulkIssueMutationResult,
  IssuePriority,
} from '@openlinear/contracts';

export const issueBulkClearValue = 'none';
export const issueBulkUnassignedValue = 'unassigned';

export interface IssueBulkSource {
  id: string;
  revision: number;
  teamId: string;
}

export interface IssueBulkStatus {
  id: string;
  teamId: string;
}

export interface IssueBulkMember {
  userId: string;
}

export interface IssueBulkProject {
  id: string;
  teamId: string;
  archivedAt: string | null;
}

export interface IssueBulkMilestone {
  id: string;
  projectId: string;
  archivedAt: string | null;
}

export interface IssueBulkLabel {
  id: string;
  archivedAt: string | null;
}

export type IssueBulkLabelOperation = 'add' | 'remove';

export interface IssueBulkDraft {
  statusId: string;
  priority: '' | IssuePriority;
  assigneeUserId: string;
  projectId: string;
  milestoneId: string;
  dueDate: string;
  clearDueDate: boolean;
}

type IssueBulkUpdateMutation = Extract<
  BulkIssueMutationRequest['mutation'],
  { type: 'update' }
>;

const priorities = new Set<IssuePriority>(['none', 'urgent', 'high', 'medium', 'low']);

export function emptyIssueBulkDraft(): IssueBulkDraft {
  return {
    statusId: '',
    priority: '',
    assigneeUserId: '',
    projectId: '',
    milestoneId: '',
    dueDate: '',
    clearDueDate: false,
  };
}

function uniqueMatch<T>(records: readonly T[], predicate: (record: T) => boolean): T | null {
  const matches = records.filter(predicate);
  return matches.length === 1 ? matches[0] ?? null : null;
}

function commonIssueTeamId(issues: readonly IssueBulkSource[]): string | null {
  const first = issues[0]?.teamId;
  return first !== undefined && issues.every((issue) => issue.teamId === first) ? first : null;
}

function uniqueActiveRecords<T extends { id: string; archivedAt: string | null }>(
  records: readonly T[],
): T[] {
  const counts = new Map<string, number>();
  for (const record of records) counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
  return records.filter((record) => record.archivedAt === null && counts.get(record.id) === 1);
}

export function issueBulkStatuses<T extends IssueBulkStatus>(
  issues: readonly IssueBulkSource[],
  statuses: readonly T[],
): T[] {
  const teamId = commonIssueTeamId(issues);
  if (teamId === null) return [];
  const counts = new Map<string, number>();
  for (const status of statuses) counts.set(status.id, (counts.get(status.id) ?? 0) + 1);
  return statuses.filter((status) => status.teamId === teamId && counts.get(status.id) === 1);
}

export function issueBulkProjects<T extends IssueBulkProject>(
  issues: readonly IssueBulkSource[],
  projects: readonly T[],
): T[] {
  const teamId = commonIssueTeamId(issues);
  return teamId === null
    ? []
    : uniqueActiveRecords(projects).filter((project) => project.teamId === teamId);
}

export function issueBulkLabels<T extends IssueBulkLabel>(labels: readonly T[]): T[] {
  return uniqueActiveRecords(labels);
}

export function issueBulkMilestones<
  TProject extends IssueBulkProject,
  TMilestone extends IssueBulkMilestone,
>(
  issues: readonly IssueBulkSource[],
  projects: readonly TProject[],
  milestones: readonly TMilestone[],
  selectedProjectId = '',
): TMilestone[] {
  const eligibleProjectIds = new Set(issueBulkProjects(issues, projects).map((project) => project.id));
  if (selectedProjectId === issueBulkClearValue) return [];
  return uniqueActiveRecords(milestones).filter((milestone) =>
    eligibleProjectIds.has(milestone.projectId)
    && (selectedProjectId === '' || milestone.projectId === selectedProjectId));
}

export function reconcileIssueBulkDraft(
  draft: IssueBulkDraft,
  statuses: readonly IssueBulkStatus[],
  members: readonly IssueBulkMember[],
  projects: readonly IssueBulkProject[],
  milestones: readonly IssueBulkMilestone[],
): IssueBulkDraft {
  const next = { ...draft };
  if (next.statusId !== '' && !statuses.some((status) => status.id === next.statusId)) {
    next.statusId = '';
  }
  if (next.assigneeUserId !== ''
    && next.assigneeUserId !== issueBulkUnassignedValue
    && !members.some((member) => member.userId === next.assigneeUserId)) {
    next.assigneeUserId = '';
  }
  if (next.projectId === issueBulkClearValue) {
    next.milestoneId = '';
  } else if (next.projectId !== '' && !projects.some((project) => project.id === next.projectId)) {
    next.projectId = '';
    next.milestoneId = '';
  }
  if (next.milestoneId !== ''
    && next.milestoneId !== issueBulkClearValue
    && !milestones.some((milestone) => milestone.id === next.milestoneId)) {
    next.milestoneId = '';
  }
  if (next.clearDueDate && next.dueDate !== '') next.dueDate = '';
  return Object.keys(next).every((key) =>
    next[key as keyof IssueBulkDraft] === draft[key as keyof IssueBulkDraft]) ? draft : next;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function issueBulkUpdateRequest(
  issues: readonly IssueBulkSource[],
  draft: IssueBulkDraft,
  statuses: readonly IssueBulkStatus[],
  members: readonly IssueBulkMember[],
  projects: readonly IssueBulkProject[],
  milestones: readonly IssueBulkMilestone[],
): BulkIssueMutationRequest | null {
  if (issues.length === 0 || new Set(issues.map((issue) => issue.id)).size !== issues.length) return null;
  const patch: IssueBulkUpdateMutation['patch'] = {};

  if (draft.statusId !== '') {
    const status = uniqueMatch(statuses, (candidate) => candidate.id === draft.statusId);
    if (status === null || issues.some((issue) => issue.teamId !== status.teamId)) return null;
    patch.statusId = status.id;
  }
  if (draft.priority !== '') {
    if (!priorities.has(draft.priority)) return null;
    patch.priority = draft.priority;
  }
  if (draft.assigneeUserId !== '') {
    if (draft.assigneeUserId === issueBulkUnassignedValue) {
      patch.assigneeUserId = null;
    } else {
      const member = uniqueMatch(members, (candidate) => candidate.userId === draft.assigneeUserId);
      if (member === null) return null;
      patch.assigneeUserId = member.userId;
    }
  }
  if (draft.clearDueDate && draft.dueDate !== '') return null;
  if (draft.clearDueDate) {
    patch.dueDate = null;
  } else if (draft.dueDate !== '') {
    if (!validDate(draft.dueDate)) return null;
    patch.dueDate = draft.dueDate;
  }

  let selectedProject: IssueBulkProject | null = null;
  if (draft.projectId === issueBulkClearValue) {
    patch.projectId = null;
    patch.milestoneId = null;
  } else if (draft.projectId !== '') {
    selectedProject = uniqueMatch(projects, (candidate) =>
      candidate.id === draft.projectId
      && candidate.archivedAt === null
      && issues.every((issue) => issue.teamId === candidate.teamId));
    if (selectedProject === null) return null;
    patch.projectId = selectedProject.id;
    patch.milestoneId = null;
  }

  if (draft.milestoneId === issueBulkClearValue) {
    patch.milestoneId = null;
  } else if (draft.milestoneId !== '') {
    if (draft.projectId === issueBulkClearValue) return null;
    const milestone = uniqueMatch(milestones, (candidate) =>
      candidate.id === draft.milestoneId && candidate.archivedAt === null);
    if (milestone === null) return null;
    const owner = uniqueMatch(projects, (candidate) =>
      candidate.id === milestone.projectId
      && candidate.archivedAt === null
      && issues.every((issue) => issue.teamId === candidate.teamId));
    if (owner === null || (selectedProject !== null && selectedProject.id !== owner.id)) return null;
    patch.projectId = owner.id;
    patch.milestoneId = milestone.id;
  }

  if (Object.keys(patch).length === 0) return null;
  return {
    items: issues.map((issue) => ({ id: issue.id, expectedRevision: issue.revision })),
    mutation: { type: 'update', patch },
  };
}

export function issueBulkLabelRequest(
  issues: readonly IssueBulkSource[],
  operation: IssueBulkLabelOperation,
  labelIds: readonly string[],
  labels: readonly IssueBulkLabel[],
): BulkIssueMutationRequest | null {
  if (issues.length === 0 || new Set(issues.map((issue) => issue.id)).size !== issues.length) return null;
  if (operation !== 'add' && operation !== 'remove') return null;
  if (labelIds.length === 0 || labelIds.length > 50 || new Set(labelIds).size !== labelIds.length) return null;
  const available = new Set(issueBulkLabels(labels).map((label) => label.id));
  if (labelIds.some((labelId) => !available.has(labelId))) return null;
  return {
    items: issues.map((issue) => ({ id: issue.id, expectedRevision: issue.revision })),
    mutation: { type: 'labels', operation, labelIds: [...labelIds] },
  };
}

export function issueBulkResultSummary(results: readonly BulkIssueMutationResult[]): string {
  const updated = results.filter((item) => item.status === 'updated').length;
  const conflicts = results.filter((item) => item.status === 'conflict').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  return `${updated} updated, ${conflicts} conflicts, ${failed} failed`;
}
