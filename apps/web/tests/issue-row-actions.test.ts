import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  issueQuickEditRequest,
  positionIssueActionMenu,
} from '../src/issue-row-actions.js';

describe('issue row actions', () => {
  it('places a menu below its anchor when the viewport has room', () => {
    expect(positionIssueActionMenu(
      { x: 240, aboveY: 80, belowY: 112 },
      { width: 1024, height: 768 },
    )).toEqual({ left: 240, top: 116 });
  });

  it('flips and clamps a menu inside constrained viewport edges', () => {
    expect(positionIssueActionMenu(
      { x: 790, aboveY: 600, belowY: 632 },
      { width: 820, height: 660 },
    )).toEqual({ left: 604, top: 488 });
    expect(positionIssueActionMenu(
      { x: -40, aboveY: 4, belowY: 12 },
      { width: 180, height: 110 },
    )).toEqual({ left: 8, top: 8 });
  });

  it('uses measured menu geometry for read-only and archived variants', () => {
    expect(positionIssueActionMenu(
      { x: 120, aboveY: 568, belowY: 600 },
      { width: 820, height: 660 },
      { width: 208, height: 40 },
    )).toEqual({ left: 120, top: 604 });
  });

  it('builds a revision-safe patch containing only changed quick properties', () => {
    expect(issueQuickEditRequest({
      revision: 7,
      statusId: 'status-todo',
      priority: 'medium',
      assigneeUserId: 'user-1',
      projectId: 'project-1',
      milestoneId: 'milestone-1',
    }, {
      statusId: 'status-done',
      priority: 'medium',
      assigneeUserId: null,
      projectId: 'project-2',
      milestoneId: null,
    })).toEqual({
      expectedRevision: 7,
      statusId: 'status-done',
      assigneeUserId: null,
      projectId: 'project-2',
      milestoneId: null,
    });
  });

  it('does not submit a no-op property edit', () => {
    expect(issueQuickEditRequest({
      revision: 7,
      statusId: 'status-todo',
      priority: 'medium',
      assigneeUserId: null,
      projectId: null,
      milestoneId: null,
    }, {
      statusId: 'status-todo',
      priority: 'medium',
      assigneeUserId: null,
      projectId: null,
      milestoneId: null,
    })).toBeNull();
  });

  it('keeps shared menu state above both virtualized surfaces', async () => {
    const source = await readFile(new URL('../src/issues.tsx', import.meta.url), 'utf8');
    expect(source).toContain('const [actionMenu, setActionMenu] = useState<IssueActionMenuState | null>(null)');
    expect(source).toContain('function IssueActionMenu({');
    expect(source).toContain('role="menu"');
    expect(source).toContain('role="menuitem"');
    expect(source).toContain("event.key === 'Escape' || event.key === 'Tab'");
    expect(source).toContain('resolveMenuFocusIndex(event.key, currentIndex, items.length)');
    expect(source).toContain('openMenuIssueId={actionMenu?.issueId ?? null}');
  });

  it('gates mutations while preserving read-only open behavior', async () => {
    const source = await readFile(new URL('../src/issues.tsx', import.meta.url), 'utf8');
    expect(source).toContain('<button type="button" role="menuitem" tabIndex={-1} onClick={onOpen}');
    expect(source).toContain('{canWrite && issue.archivedAt === null ? <button');
    expect(source).toContain('{canWrite ? <button type="button" role="menuitem"');
    expect(source).toContain('const input = issueQuickEditRequest(quickEditIssue, ownerMode');
    expect(source).toContain('? { ...values, assigneeUserId: quickEditIssue.assigneeUserId }');
    expect(source).toContain('api.updateIssue(targetWorkspaceId, issueId, input)');
    expect(source).toContain('if (variables.targetWorkspaceId !== workspaceId) return;');
    expect(source).toContain('focusIssueRecord(updated.id)');
    expect(source).toContain('<span>Project</span><select name="projectId"');
    expect(source).toContain('<span>Milestone</span><select name="milestoneId"');
  });

  it('reserves fixed list, board, and menu geometry', async () => {
    const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
    expect(styles).toContain('.issue-action-cell { display: flex; justify-content: flex-end; }');
    expect(styles).toContain('.issue-action-menu { position: fixed;');
    expect(styles).toContain('.issue-board-card-actions { width: 72px;');
    expect(styles).toContain('.issue-row > .issue-action-cell, .issue-row > .issue-action-header { grid-column: 4; }');
  });
});
