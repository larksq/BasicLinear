import type { IssueRelationType } from '@openlinear/contracts';

export const issueHierarchyCreateDirections = ['parent', 'sub_issue'] as const;
export const issuePeerCreateDirections = [
  'related',
  'blocks',
  'blocked_by',
  'duplicate_of',
  'duplicates',
] as const;

export type IssueRelationCreateDirection =
  | typeof issueHierarchyCreateDirections[number]
  | typeof issuePeerCreateDirections[number];

export interface IssueRelationCreateSource {
  id: string;
  workspaceId: string;
  archivedAt: string | null;
}

export interface IssueRelationCreateDraft {
  direction: IssueRelationCreateDirection;
  otherIssueId: string;
}

export interface IssueRelationCreateCommand {
  direction: IssueRelationCreateDirection;
  currentIssueId: string;
  otherIssueId: string;
  sourceIssueId: string;
  input: {
    type: IssueRelationType;
    targetIssueId: string;
  };
}

const relationDirectionLabels: Record<IssueRelationCreateDirection, string> = {
  parent: 'Parent issue',
  sub_issue: 'Sub-issue',
  related: 'Related to',
  blocks: 'Blocks',
  blocked_by: 'Blocked by',
  duplicate_of: 'Duplicate of',
  duplicates: 'Duplicates',
};

const relationDirections = new Set<IssueRelationCreateDirection>([
  ...issueHierarchyCreateDirections,
  ...issuePeerCreateDirections,
]);

export function issueRelationDirectionLabel(direction: IssueRelationCreateDirection): string {
  return relationDirectionLabels[direction];
}

export function issueRelationCandidates<T extends IssueRelationCreateSource>(
  currentIssue: IssueRelationCreateSource,
  issues: readonly T[],
): T[] {
  if (currentIssue.archivedAt !== null) return [];
  const counts = new Map<string, number>();
  for (const issue of issues) counts.set(issue.id, (counts.get(issue.id) ?? 0) + 1);
  return issues.filter((issue) =>
    issue.id !== currentIssue.id
    && issue.workspaceId === currentIssue.workspaceId
    && issue.archivedAt === null
    && counts.get(issue.id) === 1);
}

export function issueRelationCreateCommand(
  currentIssue: IssueRelationCreateSource,
  draft: IssueRelationCreateDraft,
  issues: readonly IssueRelationCreateSource[],
): IssueRelationCreateCommand | null {
  if (currentIssue.archivedAt !== null || !relationDirections.has(draft.direction)) return null;
  const otherIssue = issueRelationCandidates(currentIssue, issues)
    .find((issue) => issue.id === draft.otherIssueId);
  if (otherIssue === undefined) return null;

  const inverse = draft.direction === 'blocked_by'
    || draft.direction === 'duplicates'
    || draft.direction === 'parent';
  const type: IssueRelationType = draft.direction === 'related'
    ? 'related'
    : draft.direction === 'blocks' || draft.direction === 'blocked_by'
      ? 'blocks'
      : draft.direction === 'duplicate_of' || draft.direction === 'duplicates'
        ? 'duplicate'
        : 'parent';

  return {
    direction: draft.direction,
    currentIssueId: currentIssue.id,
    otherIssueId: otherIssue.id,
    sourceIssueId: inverse ? otherIssue.id : currentIssue.id,
    input: {
      type,
      targetIssueId: inverse ? currentIssue.id : otherIssue.id,
    },
  };
}
