interface RevisionConflictError {
  code: 'CONFLICT';
  currentRevision: number;
}

export interface IssueEditConflictRecovery<T extends { expectedRevision: number }> {
  phase: 'conflict' | 'reapplied';
  attemptedRevision: number;
  signaledRevision: number;
  confirmedRevision: number;
  draft: T;
}

function isPositiveRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function revisionConflict(error: unknown): RevisionConflictError | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { code?: unknown; currentRevision?: unknown };
  if (candidate.code !== 'CONFLICT' || !isPositiveRevision(candidate.currentRevision)) return null;
  return { code: 'CONFLICT', currentRevision: candidate.currentRevision };
}

export function createIssueEditConflictRecovery<T extends { expectedRevision: number }>(
  error: unknown,
  confirmedRevision: number,
  draft: T,
): IssueEditConflictRecovery<T> | null {
  const conflict = revisionConflict(error);
  if (
    conflict === null
    || !isPositiveRevision(draft.expectedRevision)
    || !isPositiveRevision(confirmedRevision)
    || confirmedRevision < conflict.currentRevision
  ) return null;

  return {
    phase: 'conflict',
    attemptedRevision: draft.expectedRevision,
    signaledRevision: conflict.currentRevision,
    confirmedRevision,
    draft,
  };
}

export function reapplyIssueEditDraft<T extends { expectedRevision: number }>(
  recovery: IssueEditConflictRecovery<T>,
): IssueEditConflictRecovery<T> {
  return {
    ...recovery,
    phase: 'reapplied',
    draft: {
      ...recovery.draft,
      expectedRevision: recovery.confirmedRevision,
    },
  };
}

export function issueEditRecoveryMessage(
  identifier: string,
  recovery: IssueEditConflictRecovery<{ expectedRevision: number }>,
): string {
  if (recovery.phase === 'reapplied') {
    return `Your draft is reapplied to ${identifier} revision ${recovery.confirmedRevision}. Review it before saving; no changes have been submitted.`;
  }
  return `${identifier} changed while you were editing. Revision ${recovery.confirmedRevision} is confirmed and its server values are shown. Your draft is retained.`;
}
