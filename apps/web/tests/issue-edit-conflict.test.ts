import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createIssueEditConflictRecovery,
  issueEditRecoveryMessage,
  reapplyIssueEditDraft,
} from '../src/issue-edit-conflict.js';

const issuesSourcePath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

const draft = {
  expectedRevision: 4,
  title: 'Retained title',
  labelIds: ['label-a'],
};

describe('issue edit conflict recovery', () => {
  it('retains a stale draft only after a confirmed revision readback', () => {
    const recovery = createIssueEditConflictRecovery(
      { code: 'CONFLICT', currentRevision: 5 },
      5,
      draft,
    );

    expect(recovery).toEqual({
      phase: 'conflict',
      attemptedRevision: 4,
      signaledRevision: 5,
      confirmedRevision: 5,
      draft,
    });
    expect(draft.expectedRevision).toBe(4);
  });

  it('uses the later confirmed revision when state advances after the conflict response', () => {
    expect(createIssueEditConflictRecovery(
      { code: 'CONFLICT', currentRevision: 5 },
      7,
      draft,
    )?.confirmedRevision).toBe(7);
  });

  it.each([
    ['a non-conflict', { code: 'VALIDATION_ERROR', currentRevision: 5 }, 5],
    ['a missing conflict revision', { code: 'CONFLICT' }, 5],
    ['an invalid conflict revision', { code: 'CONFLICT', currentRevision: 0 }, 5],
    ['an invalid confirmed revision', { code: 'CONFLICT', currentRevision: 5 }, 0],
    ['a readback behind the conflict signal', { code: 'CONFLICT', currentRevision: 6 }, 5],
  ] as const)('rejects %s', (_label, error, confirmedRevision) => {
    expect(createIssueEditConflictRecovery(error, confirmedRevision, draft)).toBeNull();
  });

  it('reapplies only the expected revision without mutating the retained draft', () => {
    const recovery = createIssueEditConflictRecovery(
      { code: 'CONFLICT', currentRevision: 5 },
      6,
      draft,
    );
    expect(recovery).not.toBeNull();

    const reapplied = reapplyIssueEditDraft(recovery!);

    expect(reapplied).toEqual({
      ...recovery,
      phase: 'reapplied',
      draft: { ...draft, expectedRevision: 6 },
    });
    expect(recovery?.phase).toBe('conflict');
    expect(recovery?.draft.expectedRevision).toBe(4);
  });

  it('distinguishes confirmed server state from an unsubmitted reapplied draft', () => {
    const recovery = createIssueEditConflictRecovery(
      { code: 'CONFLICT', currentRevision: 5 },
      5,
      draft,
    );
    expect(recovery).not.toBeNull();

    expect(issueEditRecoveryMessage('OPS-42', recovery!)).toContain(
      'Revision 5 is confirmed and its server values are shown',
    );
    expect(issueEditRecoveryMessage('OPS-42', reapplyIssueEditDraft(recovery!))).toContain(
      'Review it before saving; no changes have been submitted',
    );
  });

  it('binds conflict detection to an authorized refetch and explicit draft actions', async () => {
    const source = await readFile(issuesSourcePath, 'utf8');

    expect(source).toContain('const confirmed = await api.issue(workspaceId, issueId);');
    expect(source).toContain("client.setQueryData(['issue', workspaceId, issueId], confirmed);");
    expect(source).toContain('setEditRecovery({ ...recovery, issueId });');
    expect(source).toContain("role={activeEditRecovery.phase === 'conflict' ? 'alert' : 'status'}");
    expect(source).toContain('Reapply draft');
    expect(source).toContain('Discard draft');
    expect(source).toContain('Use server values');
    expect(source).toContain("activeEditRecovery?.phase === 'reapplied' ? { draft: activeEditRecovery.draft } : {}");
    expect(source).toContain("storedEditRecovery?.phase === 'conflict'");
    expect(source).toContain("activeEditRecovery?.phase === 'reapplied'");
    expect(source).toContain('data-issue-title-editor');
    expect(source).toContain('data-issue-archive-action');
  });

  it('keeps the notice and actions bounded at desktop and mobile widths', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toContain('.issue-conflict-banner { min-height: 58px; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto;');
    expect(styles).toContain('.issue-conflict-copy p { min-width: 0;');
    expect(styles).toContain('.issue-conflict-actions .button { min-height: 30px; white-space: nowrap; }');
    expect(styles).toContain('.issue-conflict-banner { grid-template-columns: 18px minmax(0, 1fr); align-items: start; }');
    expect(styles).toContain('.issue-conflict-actions { grid-column: 1 / -1; flex-wrap: wrap; justify-content: flex-start; padding-left: 28px; }');
  });
});
