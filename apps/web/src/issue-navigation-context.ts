const MAX_SCROLL_OFFSET = 10_000_000;

export interface IssueNavigationScrollState {
  contextKey: string;
  listScrollTop: number;
  boardScrollLeft: number;
  boardColumnScrollTops: Readonly<Record<string, number>>;
}

function scrollOffset(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, MAX_SCROLL_OFFSET);
}

export function createIssueNavigationScrollState(contextKey: string): IssueNavigationScrollState {
  return {
    contextKey,
    listScrollTop: 0,
    boardScrollLeft: 0,
    boardColumnScrollTops: {},
  };
}

export function issueNavigationScrollStateForContext(
  state: IssueNavigationScrollState,
  contextKey: string,
): IssueNavigationScrollState {
  return state.contextKey === contextKey
    ? state
    : createIssueNavigationScrollState(contextKey);
}

export function recordIssueListScroll(
  state: IssueNavigationScrollState,
  contextKey: string,
  scrollTop: number,
): IssueNavigationScrollState {
  const current = issueNavigationScrollStateForContext(state, contextKey);
  return { ...current, listScrollTop: scrollOffset(scrollTop) };
}

export function recordIssueBoardScroll(
  state: IssueNavigationScrollState,
  contextKey: string,
  scrollLeft: number,
): IssueNavigationScrollState {
  const current = issueNavigationScrollStateForContext(state, contextKey);
  return { ...current, boardScrollLeft: scrollOffset(scrollLeft) };
}

export function recordIssueBoardColumnScroll(
  state: IssueNavigationScrollState,
  contextKey: string,
  groupKey: string,
  scrollTop: number,
): IssueNavigationScrollState {
  const current = issueNavigationScrollStateForContext(state, contextKey);
  return {
    ...current,
    boardColumnScrollTops: {
      ...current.boardColumnScrollTops,
      [groupKey]: scrollOffset(scrollTop),
    },
  };
}

export function issueNavigationOriginForOpen(
  originIssueId: string | null,
  selectedIssueId: string | null,
  openingIssueId: string,
): string | null {
  return selectedIssueId === null ? openingIssueId : originIssueId;
}
