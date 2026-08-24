import type {
  Issue,
  IssuePriority,
  IssueViewGrouping,
  Membership,
  Milestone,
  Project,
  UpdateIssueRequest,
  WorkflowStatus,
} from '@openlinear/contracts';

const issuePriorities: readonly IssuePriority[] = ['urgent', 'high', 'medium', 'low', 'none'];
const defaultDragThreshold = 6;

function uniqueMatch<T>(records: readonly T[], predicate: (record: T) => boolean): T | null {
  const matches = records.filter(predicate);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function issueBoardDragThresholdExceeded(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = defaultDragThreshold,
): boolean {
  if (
    ![startX, startY, currentX, currentY, threshold].every(Number.isFinite)
    || threshold < 0
  ) return false;
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  return deltaX * deltaX + deltaY * deltaY >= threshold * threshold;
}

export function issueBoardMoveRequest(
  issue: Issue,
  groupBy: IssueViewGrouping,
  targetGroupKey: string,
  statuses: readonly WorkflowStatus[],
  members: readonly Membership[],
  projects: readonly Project[],
  milestones: readonly Milestone[],
): UpdateIssueRequest | null {
  if (issue.archivedAt !== null || groupBy === 'none') return null;

  if (groupBy === 'status') {
    const status = uniqueMatch(statuses, (candidate) =>
      candidate.id === targetGroupKey && candidate.teamId === issue.teamId);
    if (status === null || status.id === issue.statusId) return null;
    return { expectedRevision: issue.revision, statusId: status.id };
  }

  if (groupBy === 'priority') {
    const priority = issuePriorities.find((candidate) => candidate === targetGroupKey);
    if (priority === undefined || priority === issue.priority) return null;
    return { expectedRevision: issue.revision, priority };
  }

  if (groupBy === 'assignee') {
    if (targetGroupKey === 'unassigned') {
      return issue.assigneeUserId === null
        ? null
        : { expectedRevision: issue.revision, assigneeUserId: null };
    }
    const member = uniqueMatch(members, (candidate) => candidate.userId === targetGroupKey);
    if (member === null || member.userId === issue.assigneeUserId) return null;
    return { expectedRevision: issue.revision, assigneeUserId: member.userId };
  }

  if (groupBy === 'project') {
    if (targetGroupKey === 'no-project') {
      if (issue.projectId === null && issue.milestoneId === null) return null;
      return { expectedRevision: issue.revision, projectId: null, milestoneId: null };
    }
    const project = uniqueMatch(projects, (candidate) =>
      candidate.id === targetGroupKey
      && candidate.teamId === issue.teamId
      && candidate.archivedAt === null);
    if (project === null || project.id === issue.projectId) return null;
    return { expectedRevision: issue.revision, projectId: project.id, milestoneId: null };
  }

  if (targetGroupKey === 'no-milestone') {
    return issue.milestoneId === null
      ? null
      : { expectedRevision: issue.revision, milestoneId: null };
  }
  const milestone = uniqueMatch(milestones, (candidate) =>
    candidate.id === targetGroupKey && candidate.archivedAt === null);
  if (milestone === null || milestone.id === issue.milestoneId) return null;
  const project = uniqueMatch(projects, (candidate) =>
    candidate.id === milestone.projectId
    && candidate.teamId === issue.teamId
    && candidate.archivedAt === null);
  if (project === null) return null;
  return {
    expectedRevision: issue.revision,
    projectId: project.id,
    milestoneId: milestone.id,
  };
}
