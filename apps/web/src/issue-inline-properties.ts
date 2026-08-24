import type {
  IssuePriority,
  UpdateIssueRequest,
} from '@openlinear/contracts';
import {
  nativeDateCommitDecision,
  nativeDateInputShouldSync,
  validNativeDate,
  type NativeDateCommitDecision,
} from './native-date-input.js';

interface IssuePropertySource {
  workspaceId: string;
  teamId: string;
  revision: number;
  statusId: string;
  priority: IssuePriority;
  assigneeUserId: string | null;
  dueDate: string | null;
  projectId: string | null;
  milestoneId: string | null;
  labels: readonly { id: string }[];
}

interface IssuePropertyStatus {
  id: string;
  workspaceId: string;
  teamId: string;
}

interface IssuePropertyMember {
  workspaceId: string;
  userId: string;
}

interface IssuePropertyProject {
  id: string;
  workspaceId: string;
  teamId: string;
  archivedAt: string | null;
}

interface IssuePropertyMilestone {
  id: string;
  workspaceId: string;
  projectId: string;
  archivedAt: string | null;
}

interface IssuePropertyLabel {
  id: string;
  workspaceId: string;
  archivedAt: string | null;
}

export interface IssueInlinePropertyLookups {
  statuses: readonly IssuePropertyStatus[];
  members: readonly IssuePropertyMember[];
  projects: readonly IssuePropertyProject[];
  milestones: readonly IssuePropertyMilestone[];
  labels: readonly IssuePropertyLabel[];
}

export type IssueInlinePropertyChange =
  | { field: 'statusId'; value: string }
  | { field: 'priority'; value: IssuePriority }
  | { field: 'assigneeUserId'; value: string | null }
  | { field: 'dueDate'; value: string | null }
  | { field: 'projectId'; value: string | null }
  | { field: 'milestoneId'; value: string | null }
  | { field: 'label'; labelId: string; selected: boolean };

export type IssueDueDateCommitDecision = NativeDateCommitDecision;

const priorities = new Set<IssuePriority>(['none', 'urgent', 'high', 'medium', 'low']);

function identityCounts<T>(records: readonly T[], identity: (record: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const id = identity(record);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

function uniqueMatch<T>(records: readonly T[], predicate: (record: T) => boolean): T | null {
  const matches = records.filter(predicate);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function issueDueDateCommitDecision(
  authoritativeValue: string | null,
  baselineValue: string | null,
  candidateValue: string,
  inputValid: boolean,
): IssueDueDateCommitDecision {
  return nativeDateCommitDecision(
    authoritativeValue,
    baselineValue,
    candidateValue,
    inputValid,
  );
}

export function issueDueDateInputShouldSync(focused: boolean, dirty: boolean): boolean {
  return nativeDateInputShouldSync(focused, dirty);
}

export function issueDetailStatuses<T extends IssuePropertyStatus>(
  issue: Pick<IssuePropertySource, 'workspaceId' | 'teamId'>,
  statuses: readonly T[],
): T[] {
  const counts = identityCounts(statuses, (status) => status.id);
  return statuses.filter((status) =>
    status.workspaceId === issue.workspaceId
    && status.teamId === issue.teamId
    && counts.get(status.id) === 1);
}

export function issueDetailMembers<T extends IssuePropertyMember>(
  issue: Pick<IssuePropertySource, 'workspaceId'>,
  members: readonly T[],
): T[] {
  const counts = identityCounts(members, (member) => member.userId);
  return members.filter((member) =>
    member.workspaceId === issue.workspaceId
    && counts.get(member.userId) === 1);
}

export function issueDetailProjectOptions<T extends IssuePropertyProject>(
  issue: Pick<IssuePropertySource, 'workspaceId' | 'teamId' | 'projectId'>,
  projects: readonly T[],
): T[] {
  const counts = identityCounts(projects, (project) => project.id);
  return projects.filter((project) =>
    project.workspaceId === issue.workspaceId
    && project.teamId === issue.teamId
    && counts.get(project.id) === 1
    && (project.archivedAt === null || project.id === issue.projectId));
}

export function issueDetailMilestoneOptions<
  TProject extends IssuePropertyProject,
  TMilestone extends IssuePropertyMilestone,
>(
  issue: Pick<IssuePropertySource, 'workspaceId' | 'teamId' | 'projectId' | 'milestoneId'>,
  projectId: string,
  projects: readonly TProject[],
  milestones: readonly TMilestone[],
): TMilestone[] {
  if (projectId === '') return [];
  const project = uniqueMatch(projects, (candidate) =>
    candidate.id === projectId
    && candidate.workspaceId === issue.workspaceId
    && candidate.teamId === issue.teamId);
  if (project === null) return [];
  const counts = identityCounts(milestones, (milestone) => milestone.id);
  return milestones.filter((milestone) =>
    milestone.workspaceId === issue.workspaceId
    && milestone.projectId === projectId
    && counts.get(milestone.id) === 1
    && (
      milestone.archivedAt === null && project.archivedAt === null
      || projectId === issue.projectId && milestone.id === issue.milestoneId
    ));
}

export function issueDetailLabelOptions<T extends IssuePropertyLabel>(
  issue: Pick<IssuePropertySource, 'workspaceId' | 'labels'>,
  labels: readonly T[],
): T[] {
  const currentIds = new Set(issue.labels.map((label) => label.id));
  const counts = identityCounts(labels, (label) => label.id);
  return labels.filter((label) =>
    label.workspaceId === issue.workspaceId
    && counts.get(label.id) === 1
    && (label.archivedAt === null || currentIds.has(label.id)));
}

export function issueInlinePropertyRequest(
  issue: IssuePropertySource,
  change: IssueInlinePropertyChange,
  lookups: IssueInlinePropertyLookups,
): UpdateIssueRequest | null {
  const expectedRevision = issue.revision;

  if (change.field === 'statusId') {
    if (change.value === issue.statusId) return null;
    const status = uniqueMatch(lookups.statuses, (candidate) =>
      candidate.id === change.value
      && candidate.workspaceId === issue.workspaceId
      && candidate.teamId === issue.teamId);
    return status === null ? null : { expectedRevision, statusId: status.id };
  }

  if (change.field === 'priority') {
    if (change.value === issue.priority) return null;
    return priorities.has(change.value) ? { expectedRevision, priority: change.value } : null;
  }

  if (change.field === 'assigneeUserId') {
    if (change.value === issue.assigneeUserId) return null;
    if (change.value === null) return { expectedRevision, assigneeUserId: null };
    const member = uniqueMatch(lookups.members, (candidate) =>
      candidate.userId === change.value && candidate.workspaceId === issue.workspaceId);
    return member === null ? null : { expectedRevision, assigneeUserId: member.userId };
  }

  if (change.field === 'dueDate') {
    if (change.value === issue.dueDate) return null;
    if (change.value === null) return { expectedRevision, dueDate: null };
    return validNativeDate(change.value) ? { expectedRevision, dueDate: change.value } : null;
  }

  if (change.field === 'projectId') {
    if (change.value === issue.projectId) return null;
    if (change.value === null) {
      return { expectedRevision, projectId: null, milestoneId: null };
    }
    const project = uniqueMatch(lookups.projects, (candidate) =>
      candidate.id === change.value
      && candidate.workspaceId === issue.workspaceId
      && candidate.teamId === issue.teamId
      && candidate.archivedAt === null);
    return project === null
      ? null
      : { expectedRevision, projectId: project.id, milestoneId: null };
  }

  if (change.field === 'milestoneId') {
    if (change.value === issue.milestoneId) return null;
    if (change.value === null) return { expectedRevision, milestoneId: null };
    if (issue.projectId === null) return null;
    const project = uniqueMatch(lookups.projects, (candidate) =>
      candidate.id === issue.projectId
      && candidate.workspaceId === issue.workspaceId
      && candidate.teamId === issue.teamId
      && candidate.archivedAt === null);
    const milestone = uniqueMatch(lookups.milestones, (candidate) =>
      candidate.id === change.value
      && candidate.workspaceId === issue.workspaceId
      && candidate.projectId === issue.projectId
      && candidate.archivedAt === null);
    return project === null || milestone === null
      ? null
      : { expectedRevision, milestoneId: milestone.id };
  }

  const currentLabelIds = issue.labels.map((label) => label.id);
  if (new Set(currentLabelIds).size !== currentLabelIds.length) return null;
  const present = currentLabelIds.includes(change.labelId);
  if (present === change.selected) return null;
  let labelIds: string[];
  if (change.selected) {
    const label = uniqueMatch(lookups.labels, (candidate) =>
      candidate.id === change.labelId
      && candidate.workspaceId === issue.workspaceId
      && candidate.archivedAt === null);
    if (label === null) return null;
    labelIds = [...currentLabelIds, label.id];
  } else {
    labelIds = currentLabelIds.filter((labelId) => labelId !== change.labelId);
  }
  return labelIds.length <= 50 ? { expectedRevision, labelIds } : null;
}
