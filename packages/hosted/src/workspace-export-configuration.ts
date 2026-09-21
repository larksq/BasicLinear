import type {CollaborationIssue, CollaborationTransaction} from './collaboration-service.js';
import {hostedOperationsPolicyV1} from './operations-control.js';
import {
  buildDefaultHostedTeamRecord, buildDefaultHostedWorkflowStatusRecords, defaultHostedTeamId,
  trustedHostedTeamRecord, trustedHostedTeamMembershipRecord, trustedHostedWorkflowStatusRecord,
  trustedHostedCycleRecord, trustedHostedSavedViewRecord,
  type HostedTeam, type HostedTeamMembership, type HostedWorkflowStatus, type HostedCycle, type HostedSavedView,
} from './workspace-configuration-service.js';

export interface WorkspaceExportConfiguration {
  teams: HostedTeam[];
  teamMemberships: HostedTeamMembership[];
  workflowStatuses: HostedWorkflowStatus[];
  cycles: HostedCycle[];
  savedViews: HostedSavedView[];
}

function invalid(): never {throw new Error('WORKSPACE_EXPORT_CONFIGURATION_INVALID');}

export async function readWorkspaceExportConfiguration(
  transaction: CollaborationTransaction,
  workspace: {id: string; ownerUserId: string; createdAt: string},
  now: string,
  memberIds: ReadonlySet<string>,
  issues: readonly CollaborationIssue[],
  invitations: ReadonlyArray<{teamIds?: string[]}>,
): Promise<WorkspaceExportConfiguration> {
  const maximum = hostedOperationsPolicyV1.queries.maximumTransactionListRecords;
  const list = async <Value>(group: string, parse: (value: unknown, workspaceId: string) => Value): Promise<Value[]> => (
    (await transaction.list(`workspaces/${workspace.id}/${group}`, maximum)).map(value => parse(value, workspace.id))
  );
  const [teams, teamMemberships, workflowStatuses, cycles, savedViews] = await Promise.all([
    list('teams', trustedHostedTeamRecord),
    list('teamMemberships', trustedHostedTeamMembershipRecord),
    list('workflowStatuses', trustedHostedWorkflowStatusRecord),
    list('cycles', trustedHostedCycleRecord),
    list('savedViews', trustedHostedSavedViewRecord),
  ]);
  const teamById = new Map(teams.map(team => [team.id, team]));
  const statusById = new Map(workflowStatuses.map(status => [status.id, status]));
  // Legacy issue reads infer these same deterministic defaults. Include their
  // definitions in the portable snapshot without modifying the source database.
  for (const issue of issues) {
    let team = teamById.get(issue.teamId);
    if (team === undefined && issue.teamId === defaultHostedTeamId(workspace.id)) {
      team = buildDefaultHostedTeamRecord(workspace.id, workspace.ownerUserId, workspace.createdAt);
      teams.push(team);
      teamById.set(team.id, team);
    }
    if (team === undefined) invalid();
    if (!statusById.has(issue.statusId)) {
      const status = buildDefaultHostedWorkflowStatusRecords(workspace.id, team.id, team.createdAt)
        .find(candidate => candidate.id === issue.statusId);
      if (status === undefined) invalid();
      workflowStatuses.push(status);
      statusById.set(status.id, status);
    }
  }
  const configuration = {teams, teamMemberships, workflowStatuses, cycles, savedViews};
  for (const values of Object.values(configuration)) {
    if (values.length > maximum || new Set(values.map(value => value.id)).size !== values.length
      || values.some(value => value.createdAt > now || value.updatedAt > now)) invalid();
    values.sort((left, right) => left.id.localeCompare(right.id));
  }
  const cycleById = new Map(cycles.map(cycle => [cycle.id, cycle]));
  if (teams.some(team => !memberIds.has(team.createdByUserId))
    || teamMemberships.some(member => !teamById.has(member.teamId) || !memberIds.has(member.userId))
    || workflowStatuses.some(status => !teamById.has(status.teamId))
    || cycles.some(cycle => !teamById.has(cycle.teamId) || !memberIds.has(cycle.createdByUserId))
    || savedViews.some(view => !teamById.has(view.teamId) || !memberIds.has(view.createdByUserId))
    || invitations.some(invitation => invitation.teamIds?.some(id => !teamById.has(id)))) invalid();
  const issueIds = new Set(issues.map(issue => issue.id));
  if (issues.some(issue => statusById.get(issue.statusId)?.teamId !== issue.teamId
    || (issue.cycleId !== null && cycleById.get(issue.cycleId)?.teamId !== issue.teamId)
    || (issue.parentIssueId !== null && !issueIds.has(issue.parentIssueId)))) invalid();
  return configuration;
}
