import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  issueHierarchyCreateDirections,
  issuePeerCreateDirections,
  issueRelationCandidates,
  issueRelationCreateCommand,
  issueRelationDirectionLabel,
  type IssueRelationCreateDirection,
} from '../src/issue-relation-create.js';

const workspaceId = 'workspace-a';
const current = {
  id: 'issue-current',
  workspaceId,
  archivedAt: null,
};
const candidate = {
  id: 'issue-other',
  workspaceId,
  archivedAt: null,
};

describe('issue relation creation', () => {
  it('maps every current-issue direction to the canonical service endpoint', () => {
    const expected = {
      related: ['issue-current', 'related', 'issue-other'],
      blocks: ['issue-current', 'blocks', 'issue-other'],
      blocked_by: ['issue-other', 'blocks', 'issue-current'],
      duplicate_of: ['issue-current', 'duplicate', 'issue-other'],
      duplicates: ['issue-other', 'duplicate', 'issue-current'],
      parent: ['issue-other', 'parent', 'issue-current'],
      sub_issue: ['issue-current', 'parent', 'issue-other'],
    } as const;
    const directions: IssueRelationCreateDirection[] = [
      ...issueHierarchyCreateDirections,
      ...issuePeerCreateDirections,
    ];

    for (const direction of directions) {
      const command = issueRelationCreateCommand(current, {
        direction,
        otherIssueId: candidate.id,
      }, [current, candidate]);
      expect(command).not.toBeNull();
      expect([
        command?.sourceIssueId,
        command?.input.type,
        command?.input.targetIssueId,
      ]).toEqual(expected[direction]);
      expect(command).toMatchObject({
        direction,
        currentIssueId: current.id,
        otherIssueId: candidate.id,
      });
    }
  });

  it('offers unique active workspace candidates across team boundaries', () => {
    const duplicate = { id: 'duplicate', workspaceId, archivedAt: null };
    expect(issueRelationCandidates(current, [
      current,
      candidate,
      { id: 'cross-team', workspaceId, archivedAt: null },
      { id: 'archived', workspaceId, archivedAt: '2026-08-20T00:00:00.000Z' },
      { id: 'other-workspace', workspaceId: 'workspace-b', archivedAt: null },
      duplicate,
      { ...duplicate },
    ]).map((issue) => issue.id)).toEqual(['issue-other', 'cross-team']);
  });

  it('fails closed for archived sources and invalid candidate identities', () => {
    expect(issueRelationCreateCommand({ ...current, archivedAt: '2026-08-20T00:00:00.000Z' }, {
      direction: 'related', otherIssueId: candidate.id,
    }, [candidate])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'related', otherIssueId: current.id,
    }, [current, candidate])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'related', otherIssueId: 'missing',
    }, [current, candidate])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'related', otherIssueId: candidate.id,
    }, [current, candidate, { ...candidate }])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'related', otherIssueId: 'archived',
    }, [{ id: 'archived', workspaceId, archivedAt: '2026-08-20T00:00:00.000Z' }])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'related', otherIssueId: 'other-workspace',
    }, [{ id: 'other-workspace', workspaceId: 'workspace-b', archivedAt: null }])).toBeNull();
    expect(issueRelationCreateCommand(current, {
      direction: 'unsupported' as IssueRelationCreateDirection,
      otherIssueId: candidate.id,
    }, [candidate])).toBeNull();
  });

  it('uses explicit human-readable labels for all directions', () => {
    expect([
      ...issueHierarchyCreateDirections,
      ...issuePeerCreateDirections,
    ].map((direction) => issueRelationDirectionLabel(direction))).toEqual([
      'Parent issue',
      'Sub-issue',
      'Related to',
      'Blocks',
      'Blocked by',
      'Duplicate of',
      'Duplicates',
    ]);
  });

  it('locks the source workflow to canonical commands, retained drafts, and authoritative readback', async () => {
    const [source, styles, fixture] = await Promise.all([
      readFile(join(process.cwd(), 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(process.cwd(), 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(source).toContain('issueRelationCreateCommand(current, draft, issueOptions.data ?? [])');
    expect(source).toContain('api.createIssueRelation(workspaceId, command.sourceIssueId, command.input)');
    expect(source).toContain("issueHierarchyCreateDirections");
    expect(source).toContain("issuePeerCreateDirections");
    expect(source).toContain('Relation was not added. Current server relations restored; your selection is retained.');
    expect(source).toContain('setRelationCreateEpoch((value) => ({ ...value, [section]: value[section] + 1 }))');
    expect(source).toContain('relationCreateEpoch.hierarchy');
    expect(source).toContain('relationCreateEpoch.peer');
    expect(source).toContain("queryKey: ['issues', workspaceId, issueOptionFilters]");
    expect(source).not.toContain("...(teamScopeId === undefined ? {} : { teamId: teamScopeId })");
    expect(styles).toContain('.relation-feedback');
    expect(fixture).toContain("fixtureName(request) === 'issue-relation-directions'");
  });
});
