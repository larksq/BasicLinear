import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { IssueRelation } from '@openlinear/contracts';
import {
  groupIssueRelations,
} from '../src/issue-relation-groups.js';

const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));

type RelationStub = Pick<IssueRelation, 'direction'> & { id: string };

const relation = (id: string, direction: IssueRelation['direction']): RelationStub => ({
  id,
  direction,
});

describe('issue relation groups', () => {
  it('separates both hierarchy directions from dependency and peer relations', () => {
    const grouped = groupIssueRelations([
      relation('blocks', 'blocks'),
      relation('parent', 'parent'),
      relation('related', 'related'),
      relation('child', 'sub_issue'),
      relation('duplicate', 'duplicate_of'),
    ]);

    expect(grouped.hierarchy.map((item) => item.id)).toEqual(['parent', 'child']);
    expect(grouped.peers.map((item) => item.id)).toEqual(['blocks', 'related', 'duplicate']);
  });

  it('preserves server order and object identity within each partition', () => {
    const childA = relation('child-a', 'sub_issue');
    const childB = relation('child-b', 'sub_issue');
    const blockedBy = relation('blocked-by', 'blocked_by');
    const grouped = groupIssueRelations([childA, blockedBy, childB]);

    expect(grouped.hierarchy).toEqual([childA, childB]);
    expect(grouped.hierarchy[0]).toBe(childA);
    expect(grouped.peers).toEqual([blockedBy]);
  });

  it('returns independent empty groups for an empty response', () => {
    expect(groupIssueRelations([])).toEqual({ hierarchy: [], peers: [] });
  });

  it('keeps every inverse dependency and duplicate direction in peer relations', () => {
    const grouped = groupIssueRelations([
      relation('blocked-by', 'blocked_by'),
      relation('duplicate-of', 'duplicate_of'),
      relation('duplicates', 'duplicates'),
    ]);

    expect(grouped.hierarchy).toEqual([]);
    expect(grouped.peers.map((item) => item.id)).toEqual(['blocked-by', 'duplicate-of', 'duplicates']);
  });

  it('renders hierarchy before peer relations and comments', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');
    const hierarchy = source.indexOf('<IssueRelationSection hierarchy');
    const peers = source.indexOf('<IssueRelationSection loading');
    const comments = source.indexOf('id="comments-title"');

    expect(hierarchy).toBeGreaterThan(-1);
    expect(hierarchy).toBeLessThan(peers);
    expect(peers).toBeLessThan(comments);
    expect(source).toContain("const headingId = hierarchy ? 'sub-issues-title' : 'relations-title';");
    expect(source).toContain('relations={groupedRelations.hierarchy}');
    expect(source).toContain('relations={groupedRelations.peers}');
    expect(source).toContain('<span>{relations.length}</span>');
  });

  it('uses one shared row contract for hierarchy and peer relations', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('issueRelationDirectionLabel(relation.direction)');
    expect(source).toContain('relations={groupedRelations.hierarchy}');
    expect(source).toContain('relations={groupedRelations.peers}');
    expect(source).toContain('onOpenIssue(relation.otherIssue.id)');
    expect(source).toContain('onRemove(relation)');
  });

  it('offers both current-issue hierarchy directions in the dedicated section', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('const directions = hierarchy ? issueHierarchyCreateDirections : issuePeerCreateDirections;');
    expect(source).toContain("hierarchy ? 'sub_issue' : 'related'");
    expect(source).toContain('section="hierarchy"');
    expect(source).toContain("aria-label={hierarchy ? 'Hierarchy direction' : 'Relation direction'}");
  });

  it('keeps peer and hierarchy composers separate while sharing canonical submission', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('section="peer"');
    expect(source).toContain("submitRelation('hierarchy', draft)");
    expect(source).toContain("submitRelation('peer', draft)");
    expect(source).toContain('issueRelationCreateCommand(current, draft, issueOptions.data ?? [])');
    expect(source).toContain('command.sourceIssueId, command.input');
  });
});
