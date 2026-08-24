import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createIssueNavigationScrollState,
  issueNavigationOriginForOpen,
  issueNavigationScrollStateForContext,
  recordIssueBoardColumnScroll,
  recordIssueBoardScroll,
  recordIssueListScroll,
} from '../src/issue-navigation-context.js';

const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));

describe('issue navigation context', () => {
  it('retains list and board offsets for the exact view context', () => {
    let state = createIssueNavigationScrollState('view-a');
    state = recordIssueListScroll(state, 'view-a', 420);
    state = recordIssueBoardScroll(state, 'view-a', 180);
    state = recordIssueBoardColumnScroll(state, 'view-a', 'status-started', 260);

    expect(issueNavigationScrollStateForContext(state, 'view-a')).toEqual({
      contextKey: 'view-a',
      listScrollTop: 420,
      boardScrollLeft: 180,
      boardColumnScrollTops: { 'status-started': 260 },
    });
  });

  it('resets every offset when the serialized view context changes', () => {
    const recorded = recordIssueBoardColumnScroll(
      recordIssueListScroll(createIssueNavigationScrollState('view-a'), 'view-a', 420),
      'view-a',
      'priority-high',
      95,
    );

    expect(issueNavigationScrollStateForContext(recorded, 'view-b')).toEqual(
      createIssueNavigationScrollState('view-b'),
    );
  });

  it('fails closed for negative, non-finite, and extreme offsets', () => {
    let state = createIssueNavigationScrollState('view-a');
    state = recordIssueListScroll(state, 'view-a', -1);
    state = recordIssueBoardScroll(state, 'view-a', Number.POSITIVE_INFINITY);
    state = recordIssueBoardColumnScroll(state, 'view-a', 'status-done', 50_000_000);

    expect(state.listScrollTop).toBe(0);
    expect(state.boardScrollLeft).toBe(0);
    expect(state.boardColumnScrollTops['status-done']).toBe(10_000_000);
  });

  it('keeps independent vertical offsets for stable board groups', () => {
    let state = createIssueNavigationScrollState('view-a');
    state = recordIssueBoardColumnScroll(state, 'view-a', 'todo', 120);
    state = recordIssueBoardColumnScroll(state, 'view-a', 'done', 640);

    expect(state.boardColumnScrollTops).toEqual({ todo: 120, done: 640 });
  });

  it('records into a fresh state when an event belongs to a new context', () => {
    const state = recordIssueListScroll(
      recordIssueBoardScroll(createIssueNavigationScrollState('view-a'), 'view-a', 99),
      'view-b',
      44,
    );

    expect(state).toEqual({
      contextKey: 'view-b',
      listScrollTop: 44,
      boardScrollLeft: 0,
      boardColumnScrollTops: {},
    });
  });

  it('retains the first row origin through a related-issue chain', () => {
    const origin = issueNavigationOriginForOpen(null, null, 'issue-a');
    const afterFirstRelation = issueNavigationOriginForOpen(origin, 'issue-a', 'issue-b');
    const afterSecondRelation = issueNavigationOriginForOpen(afterFirstRelation, 'issue-b', 'issue-c');

    expect(afterSecondRelation).toBe('issue-a');
  });

  it('does not invent a row origin for a direct detail route', () => {
    expect(issueNavigationOriginForOpen(null, 'issue-a', 'issue-b')).toBeNull();
  });

  it('binds list restoration to the virtual scroll owner', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('scrollRef.current.scrollTop = initialScrollTop;');
    expect(source).toContain('onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}');
    expect(source).toContain('initialScrollTop={navigationScroll.listScrollTop}');
    expect(source).toContain('onScrollTopChange={rememberListScroll}');
  });

  it('binds board restoration to horizontal and stable-column scroll owners', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('boardRef.current.scrollLeft = initialScrollLeft;');
    expect(source).toContain('onScroll={(event) => onScrollLeftChange(event.currentTarget.scrollLeft)}');
    expect(source).toContain('initialScrollTop={initialColumnScrollTops[group.key] ?? 0}');
    expect(source).toContain('onScrollTopChange={(scrollTop) => onColumnScrollTopChange(group.key, scrollTop)}');
  });

  it('keys restoration to workspace, view, filter, grouping, and contextual scope state', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('() => JSON.stringify([workspaceId, queryState])');
    expect(source).toContain('issueNavigationScrollStateForContext(');
    expect(source).toContain('navigationScrollRef.current = recordIssueListScroll(');
    expect(source).toContain('navigationScrollRef.current = recordIssueBoardColumnScroll(');
  });

  it('restores the first trigger only after route content can remount', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('focusReturnIssueId.current = issueNavigationOriginForOpen(');
    expect(source).toContain('focusReturnIssueId.current = null;');
    expect(source).toContain("if (route.detailMode === 'direct') focusReturnIssueId.current = null;");
    expect(source).toContain('focus(4);');
    expect(source).toContain('document.querySelector<HTMLElement>(`[data-issue-id="${id}"]`)');
  });

  it('consumes primary-navigation reset signals without clearing retained drafts', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');
    const resetEffect = source.slice(
      source.indexOf('if (openIssueSignal <= 0'),
      source.indexOf("writeIssueUrl(viewState, selectedIssueId"),
    );
    const locationSync = source.slice(
      source.indexOf('const syncIssueLocation = useCallback'),
      source.indexOf('if (openIssueSignal <= 0'),
    );

    expect(resetEffect).not.toContain('|| !openIssueId');
    expect(resetEffect).toContain('if (openIssueId !== null && openIssueId !== undefined) openIssue(openIssueId);');
    expect(resetEffect).toContain('else syncIssueLocation(false);');
    expect(locationSync).toContain('setSelectedIssueId(route.issueId);');
    expect(locationSync).toContain('setViewState(restoredState);');
    expect(locationSync).toContain('pushedIssueEntry.current = false;');
    expect(locationSync).not.toContain('setIssueDetailDraftStore');
  });
});
