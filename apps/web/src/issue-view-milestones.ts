import type { Issue, Milestone, Project } from '@basiclinear/contracts';

export interface MilestoneViewOption {
  value: string;
  label: string;
  projectId: string;
  position: number;
  archived: boolean;
}

function projectName(projectId: string, projects: readonly Pick<Project, 'id' | 'name'>[]): string {
  return projects.find((project) => project.id === projectId)?.name ?? 'Unknown project';
}

export function milestoneViewLabel(
  milestone: Pick<Milestone, 'projectId' | 'name'>,
  projects: readonly Pick<Project, 'id' | 'name'>[],
): string {
  return `${projectName(milestone.projectId, projects)} / ${milestone.name}`;
}

export function milestoneViewOptions(
  milestones: readonly Pick<Milestone, 'id' | 'projectId' | 'name' | 'position' | 'archivedAt'>[],
  projects: readonly Pick<Project, 'id' | 'name'>[],
): MilestoneViewOption[] {
  const options = milestones
    .map((milestone) => ({
      value: milestone.id,
      label: `${milestoneViewLabel(milestone, projects)}${milestone.archivedAt === null ? '' : ' (archived)'}`,
      projectId: milestone.projectId,
      position: milestone.position,
      archived: milestone.archivedAt !== null,
    }));
  return options.sort((left, right) =>
      projectName(left.projectId, projects).localeCompare(
        projectName(right.projectId, projects),
        undefined,
        { sensitivity: 'base' },
      )
      || left.position - right.position
      || left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
      || left.value.localeCompare(right.value));
}

export function issueMilestoneLabel(
  issue: Pick<Issue, 'milestoneId'>,
  milestones: readonly Pick<Milestone, 'id' | 'projectId' | 'name'>[],
  projects: readonly Pick<Project, 'id' | 'name'>[],
): string {
  if (issue.milestoneId === null) return 'No milestone';
  const milestone = milestones.find((candidate) => candidate.id === issue.milestoneId);
  return milestone === undefined ? 'Unknown milestone' : milestoneViewLabel(milestone, projects);
}
