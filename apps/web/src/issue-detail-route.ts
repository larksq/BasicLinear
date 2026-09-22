export type IssueDetailMode = 'contextual' | 'direct';
export type IssueDetailPresentation = 'panel' | 'route';

export interface IssueRouteState {
  issueId: string | null;
  detailMode: IssueDetailMode | null;
}

function historyRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function readIssueRoute(search: string, historyState: unknown): IssueRouteState {
  const issueId = new URLSearchParams(search).get('issue');
  if (!issueId) return { issueId: null, detailMode: null };
  return {
    issueId,
    detailMode: historyRecord(historyState).basiclinearIssue === true ? 'contextual' : 'direct',
  };
}

export function issueRouteHistoryState(
  historyState: unknown,
  issueId: string | null,
  detailMode: IssueDetailMode | null,
): Record<string, unknown> {
  return {
    ...historyRecord(historyState),
    basiclinearIssue: issueId !== null && detailMode === 'contextual',
  };
}

export function issueDetailPresentation(
  detailMode: IssueDetailMode | null,
  viewportWidth: number,
): IssueDetailPresentation | null {
  if (detailMode === null) return null;
  if (detailMode === 'direct' || viewportWidth < 768) return 'route';
  return 'panel';
}
