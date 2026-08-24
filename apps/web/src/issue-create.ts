import type { Milestone, WorkflowStatus } from '@openlinear/contracts';

type IssueCreateMilestone = Pick<Milestone, 'id' | 'projectId' | 'archivedAt'>;
type IssueCreateStatus = Pick<WorkflowStatus, 'id' | 'teamId' | 'category'>;

export function issueCreateMilestones<T extends IssueCreateMilestone>(
  projectId: string,
  milestones: readonly T[],
): T[] {
  if (projectId === '') return [];
  const counts = new Map<string, number>();
  for (const milestone of milestones) {
    counts.set(milestone.id, (counts.get(milestone.id) ?? 0) + 1);
  }
  return milestones.filter((milestone) =>
    milestone.projectId === projectId
    && milestone.archivedAt === null
    && counts.get(milestone.id) === 1);
}

export function reconcileIssueCreateMilestoneId(
  milestoneId: string,
  projectId: string,
  milestones: readonly IssueCreateMilestone[],
): string {
  if (milestoneId === '') return '';
  return issueCreateMilestones(projectId, milestones).some((milestone) => milestone.id === milestoneId)
    ? milestoneId
    : '';
}

export function contextualIssueCreateMilestoneId(
  context: { id: string } | undefined,
  projectId: string,
  milestones: readonly IssueCreateMilestone[],
): string {
  return context === undefined
    ? ''
    : reconcileIssueCreateMilestoneId(context.id, projectId, milestones);
}

export function defaultIssueCreateStatusId(
  teamId: string,
  statuses: readonly IssueCreateStatus[],
): string {
  const teamStatuses = statuses.filter((status) => status.teamId === teamId);
  return teamStatuses.find((status) => status.category === 'unstarted')?.id
    ?? teamStatuses[0]?.id
    ?? '';
}

export function reconcileIssueCreateStatusId(
  statusId: string,
  teamId: string,
  statuses: readonly IssueCreateStatus[],
): string {
  return statuses.some((status) => status.id === statusId && status.teamId === teamId)
    ? statusId
    : defaultIssueCreateStatusId(teamId, statuses);
}
