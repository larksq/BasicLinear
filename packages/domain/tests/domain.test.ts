import { describe, expect, it } from 'vitest';
import {
  AppError,
  assertCapability,
  assertExpectedRevision,
  assertUniqueOrder,
  deriveProgress,
  hasCapability,
  normalizeEmail,
  normalizeHttpUrl,
  normalizeIssueDocument,
  normalizeIssueFilter,
  normalizeIssueViewState,
  normalizeDate,
  normalizeTeamKey,
  normalizeWorkspaceSlug,
  parseIssuePriority,
  parseIssueRelationType,
  parseProjectPriority,
  parseProjectStatus,
  parseMembershipRole,
  validatePassword,
} from '../src/index.js';

describe('domain validation', () => {
  it('normalizes stable identity fields', () => {
    expect(normalizeEmail(' Admin@Example.COM ')).toBe('admin@example.com');
    expect(normalizeWorkspaceSlug('open-linear')).toBe('open-linear');
    expect(normalizeTeamKey('eng2')).toBe('ENG2');
    expect(parseMembershipRole('owner')).toBe('owner');
  });

  it('rejects ambiguous or weak values', () => {
    expect(() => normalizeEmail('not-an-email')).toThrow(AppError);
    expect(() => normalizeWorkspaceSlug('-hidden')).toThrow(AppError);
    expect(() => normalizeTeamKey('2BAD')).toThrow(AppError);
    expect(() => validatePassword('too-short')).toThrow(AppError);
  });

  it('enforces capabilities and optimistic revisions', () => {
    expect(hasCapability('owner', 'project:purge')).toBe(true);
    expect(hasCapability('owner', 'milestone:purge')).toBe(true);
    expect(hasCapability('owner', 'issue:purge')).toBe(true);
    expect(hasCapability('admin', 'membership:manage')).toBe(true);
    expect(hasCapability('member', 'project:write')).toBe(true);
    expect(hasCapability('member', 'issue:write')).toBe(true);
    expect(hasCapability('guest', 'project:write')).toBe(false);
    expect(hasCapability('guest', 'issue:write')).toBe(false);
    expect(hasCapability('member', 'team:manage')).toBe(false);
    expect(() => assertCapability('member', 'team:manage')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => assertExpectedRevision(4, 5)).toThrowError(
      expect.objectContaining({ code: 'CONFLICT', currentRevision: 5 }),
    );
    expect(() => assertExpectedRevision(5, 5)).not.toThrow();
    expect(() => assertCapability('member', 'project:write')).not.toThrow();
    expect(() => assertCapability('member', 'issue:write')).not.toThrow();
    expect(() => assertCapability('admin', 'issue:purge')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => assertCapability('admin', 'project:purge')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => assertCapability('admin', 'milestone:purge')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => assertCapability('owner', 'project:purge')).not.toThrow();
    expect(() => assertCapability('owner', 'milestone:purge')).not.toThrow();
    expect(() => assertCapability('owner', 'issue:purge')).not.toThrow();
    expect(() => assertCapability('guest', 'project:write')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('derives versioned project progress and excludes canceled work', () => {
    expect(deriveProgress(['completed', 'started', 'canceled'])).toEqual({
      policy: 'project-progress-v1',
      issueCount: 3,
      completedCount: 1,
      canceledCount: 1,
      eligibleCount: 2,
      fraction: 0.5,
    });
    expect(deriveProgress([]).fraction).toBe(0);
    expect(deriveProgress(['canceled']).fraction).toBe(0);
  });

  it('validates project values and deterministic order requests', () => {
    expect(normalizeDate('2026-09-20', 'targetDate')).toBe('2026-09-20');
    expect(() => normalizeDate('2026-02-30', 'targetDate')).toThrow(AppError);
    expect(normalizeHttpUrl('https://example.test/brief')).toBe('https://example.test/brief');
    expect(() => normalizeHttpUrl('javascript:alert(1)')).toThrow(AppError);
    expect(parseProjectStatus('in_progress')).toBe('in_progress');
    expect(parseProjectPriority('urgent')).toBe('urgent');
    expect(() => assertUniqueOrder([
      { id: 'same', expectedRevision: 1 },
      { id: 'same', expectedRevision: 2 },
    ])).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });

  it('normalizes allowlisted ProseMirror JSON and rejects unsafe content', () => {
    expect(normalizeIssueDocument({
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Read the runbook',
          marks: [{ type: 'link', attrs: { href: 'https://example.test/runbook' } }],
        }],
      }],
    })).toEqual({
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Read the runbook',
          marks: [{
            type: 'link',
            attrs: {
              href: 'https://example.test/runbook',
              target: '_blank',
              rel: 'noopener noreferrer nofollow',
            },
          }],
        }],
      }],
    });
    expect(normalizeIssueDocument({
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph' }],
    })).toEqual({
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    });
    expect(() => normalizeIssueDocument({
      version: 1,
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'https://example.test/private.png' } }],
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => normalizeIssueDocument({
      version: 1,
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'unsafe',
          marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
        }],
      }],
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(parseIssuePriority('high')).toBe('high');
    expect(parseIssueRelationType('parent')).toBe('parent');
  });

  it('canonicalizes bounded issue filters and complete saved-view state', () => {
    const statusId = '8c05e5e3-f62e-4cc0-92cc-5ed313334a4f';
    const filter = normalizeIssueFilter({
      version: 1,
      root: {
        type: 'group',
        operator: 'and',
        children: [
          { type: 'condition', field: 'priority', operator: 'in', value: ['high', 'urgent', 'high'] },
          { type: 'condition', field: 'statusId', operator: 'is', value: statusId.toUpperCase() },
        ],
      },
    });
    expect(filter.root.children).toEqual([
      { type: 'condition', field: 'priority', operator: 'in', value: ['high', 'urgent'] },
      { type: 'condition', field: 'statusId', operator: 'is', value: statusId },
    ]);

    expect(normalizeIssueViewState({
      version: 1,
      layout: 'board',
      groupBy: 'milestone',
      order: { field: 'identifier', direction: 'asc' },
      visibleProperties: ['priority', 'milestone', 'labels'],
      density: 'compact',
      filter,
      searchQuery: '  release gate  ',
      archiveState: 'active',
      collapsedGroups: ['high', 'high', 'none'],
    })).toMatchObject({
      layout: 'board',
      groupBy: 'milestone',
      visibleProperties: ['priority', 'milestone', 'labels'],
      searchQuery: 'release gate',
      collapsedGroups: ['high', 'none'],
    });
  });

  it('rejects non-allowlisted, mismatched, and overly complex issue filters', () => {
    const empty = { version: 1, root: { type: 'group', operator: 'and', children: [] } };
    expect(() => normalizeIssueFilter({
      version: 1,
      root: { type: 'condition', field: 'priority', operator: 'is', value: 'high' },
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => normalizeIssueFilter({
      version: 1,
      root: {
        type: 'group',
        operator: 'and',
        children: [{ type: 'condition', field: 'statusId', operator: 'before', value: '2026-09-01' }],
      },
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    expect(() => normalizeIssueViewState({
      version: 1,
      layout: 'list',
      groupBy: 'status',
      order: { field: 'updatedAt', direction: 'desc' },
      visibleProperties: ['labels', 'labels'],
      density: 'default',
      filter: empty,
      searchQuery: '',
      archiveState: 'active',
      collapsedGroups: [],
    })).toThrowError(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
  });
});
