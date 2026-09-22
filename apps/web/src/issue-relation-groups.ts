import type { IssueRelation } from '@basiclinear/contracts';

const hierarchyDirections = new Set<IssueRelation['direction']>(['parent', 'sub_issue']);

export function groupIssueRelations<T extends Pick<IssueRelation, 'direction'>>(
  relations: readonly T[],
): { hierarchy: T[]; peers: T[] } {
  const hierarchy: T[] = [];
  const peers: T[] = [];
  for (const relation of relations) {
    (hierarchyDirections.has(relation.direction) ? hierarchy : peers).push(relation);
  }
  return { hierarchy, peers };
}
