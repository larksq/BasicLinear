import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

let boardSource = '';
let boardStyles = '';

beforeAll(async () => {
  const issues = await readFile(join(process.cwd(), 'apps/web/src/issues.tsx'), 'utf8');
  boardSource = issues.slice(issues.indexOf('function IssueBoardColumn'), issues.indexOf('function VirtualIssueBoard'));
  boardStyles = await readFile(join(process.cwd(), 'apps/web/src/styles.css'), 'utf8');
});

describe('issue board accessibility contract', () => {
  it('uses one roving card tab stop per populated column', () => {
    expect(boardSource).toContain('tabIndex={rovingIssueId === issue.id ? 0 : -1}');
    expect(boardSource).toContain('setPreferredFocusedIssueId(issue.id)');
    expect(boardSource).not.toContain('tabIndex={0}');
    expect(boardSource).toContain('data-board-index={virtualCard.index}');
  });

  it('keeps virtualized keyboard targets mounted and focused', () => {
    expect(boardSource).toContain("virtualizer.scrollToIndex(bounded, { align: 'auto' })");
    expect(boardSource).toContain('`[data-board-index="${bounded}"]`');
    expect(boardSource).toContain('?.focus()');
  });

  it('supports row navigation without stealing nested-control keys', () => {
    expect(boardSource).toContain('resolveRecordKeyAction({');
    expect(boardSource).toContain("closest('input, button, a, select, textarea, [contenteditable=\"true\"]')");
    expect(boardSource).toContain("action === 'next'");
    expect(boardSource).toContain("action === 'previous'");
    expect(boardSource).toContain('focusCard(virtualCard.index + 1)');
    expect(boardSource).toContain('focusCard(virtualCard.index - 1)');
    expect(boardSource).toContain('menuEnabled: true');
    expect(boardSource).toContain("action === 'open-menu'");
    expect(boardSource).toContain('onContextMenu={(event) =>');
  });

  it('reserves a named pointer action without adding a card tab stop', () => {
    expect(boardSource).toContain('className="issue-board-card-actions"');
    expect(boardSource).toContain('className="icon-button issue-menu-trigger"');
    expect(boardSource).toContain('tabIndex={-1}');
    expect(boardSource).toContain('aria-haspopup="menu"');
    expect(boardSource).toContain('aria-controls={openMenuIssueId === issue.id');
    expect(boardSource).toContain('data-issue-drag-handle');
    expect(boardSource).toContain('aria-hidden="true"');
    expect(boardSource).toContain('onPointerDown={canDrag ? (event) => onBeginDrag(event, issue) : undefined}');
    expect(boardSource).toContain("groupBy !== 'none'");
  });

  it('keeps cross-column target and focus behavior explicit', () => {
    expect(boardSource).toContain('data-board-group-key={group.key}');
    expect(boardSource).toContain("pointerDrag.targetGroupKey === group.key ? 'drop-target' : ''");
    expect(boardSource).toContain("virtualizer.scrollToIndex(index, { align: 'auto' })");
    expect(boardSource).toContain('onFocusRequestHandled(focusRequestedIssueId)');
    expect(boardSource).toContain("closest('input, button, a, [data-issue-drag-handle]')");
  });

  it('exposes status and priority text without changing visible metadata', () => {
    expect(boardSource).toContain('<span className="sr-only">Status: </span><span>{status?.name ?? \'Unknown\'}</span>');
    expect(boardSource).toContain('<span className="sr-only">Priority: </span><span>{titleCase(issue.priority)}</span>');
    expect(boardSource).toContain('className="status-ring" aria-hidden="true"');
  });

  it('exposes each metadata label and value once without a nested scroll region', () => {
    expect(boardSource).not.toMatch(/<span role="group" aria-label=\{`(?:Status|Priority|Assignee|Project|Milestone|Labels|Due date):/u);
    expect(boardSource).toContain('<span className="sr-only">Status: </span><span>{status?.name ?? \'Unknown\'}</span>');
    expect(boardSource).toContain('<span className="sr-only">Priority: </span><span>{titleCase(issue.priority)}</span>');
    expect(boardSource).toContain('<UserRound size={12} aria-hidden="true" /><span className="sr-only">Assignee: </span><span>{assignee}</span>');
    expect(boardSource).toContain('<CalendarDays size={12} aria-hidden="true" /><span className="sr-only">Due date: </span><span>{dueDate}</span>');
    expect(boardStyles).toMatch(/\.issue-board-metadata \{[^}]*overflow: hidden;/);
    expect(boardStyles).not.toMatch(/\.issue-board-metadata \{[^}]*overflow-x: auto;/);
  });
});
