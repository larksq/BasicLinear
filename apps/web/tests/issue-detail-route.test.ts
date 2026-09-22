import { describe, expect, it } from 'vitest';
import {
  issueDetailPresentation,
  issueRouteHistoryState,
  readIssueRoute,
} from '../src/issue-detail-route.js';

describe('issue detail routing', () => {
  it('treats a fresh issue URL as direct navigation', () => {
    expect(readIssueRoute('?view=issues&issue=issue-1', null)).toEqual({
      issueId: 'issue-1',
      detailMode: 'direct',
    });
    expect(readIssueRoute('?view=issues', { basiclinearIssue: true })).toEqual({
      issueId: null,
      detailMode: null,
    });
  });

  it('restores contextual intent only from the matching history entry', () => {
    expect(readIssueRoute('?issue=issue-1', { basiclinearIssue: true })).toEqual({
      issueId: 'issue-1',
      detailMode: 'contextual',
    });
    expect(readIssueRoute('?issue=issue-1', { basiclinearIssue: false })).toEqual({
      issueId: 'issue-1',
      detailMode: 'direct',
    });
  });

  it('writes route intent without discarding unrelated history state', () => {
    expect(issueRouteHistoryState({ retained: 1 }, 'issue-1', 'contextual')).toEqual({
      retained: 1,
      basiclinearIssue: true,
    });
    expect(issueRouteHistoryState({ retained: 1 }, 'issue-1', 'direct')).toEqual({
      retained: 1,
      basiclinearIssue: false,
    });
    expect(issueRouteHistoryState({ retained: 1 }, null, null)).toEqual({
      retained: 1,
      basiclinearIssue: false,
    });
  });

  it('uses full routes for direct links and the accepted mobile boundary', () => {
    expect(issueDetailPresentation('direct', 1440)).toBe('route');
    expect(issueDetailPresentation('contextual', 767)).toBe('route');
    expect(issueDetailPresentation('contextual', 768)).toBe('panel');
    expect(issueDetailPresentation('contextual', 1440)).toBe('panel');
    expect(issueDetailPresentation(null, 390)).toBeNull();
  });
});
