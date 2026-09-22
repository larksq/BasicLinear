import type { RetireStatusRequest, WorkflowStatus } from '@basiclinear/contracts';

export interface WorkflowStatusRetirementScope {
  workspaceId: string;
  teamId: string;
}

export interface WorkflowStatusRetirementDraft {
  source: WorkflowStatus;
  candidates: WorkflowStatus[];
  replacementStatusId: string;
}

function validRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

export function workflowStatusRetirementDraft(
  source: WorkflowStatus,
  records: readonly WorkflowStatus[],
  scope: WorkflowStatusRetirementScope,
): WorkflowStatusRetirementDraft | null {
  if (
    source.workspaceId !== scope.workspaceId
    || source.teamId !== scope.teamId
    || !validRevision(source.revision)
    || records.length < 2
  ) return null;
  const ids = new Set<string>();
  for (const record of records) {
    if (
      record.workspaceId !== scope.workspaceId
      || record.teamId !== scope.teamId
      || !validRevision(record.revision)
      || ids.has(record.id)
    ) return null;
    ids.add(record.id);
  }
  const confirmedSource = records.find((record) => record.id === source.id);
  if (confirmedSource === undefined || confirmedSource.revision !== source.revision) return null;
  const candidates = records.filter((record) => record.id !== source.id);
  const replacement = candidates[0];
  if (replacement === undefined) return null;
  return {
    source: confirmedSource,
    candidates: [...candidates],
    replacementStatusId: replacement.id,
  };
}

export function workflowStatusRetireRequest(
  draft: WorkflowStatusRetirementDraft,
  scope: WorkflowStatusRetirementScope,
): RetireStatusRequest | null {
  if (
    draft.source.workspaceId !== scope.workspaceId
    || draft.source.teamId !== scope.teamId
    || !validRevision(draft.source.revision)
    || draft.source.id === draft.replacementStatusId
  ) return null;
  const candidateIds = new Set<string>();
  for (const candidate of draft.candidates) {
    if (
      candidate.id === draft.source.id
      || candidate.workspaceId !== scope.workspaceId
      || candidate.teamId !== scope.teamId
      || !validRevision(candidate.revision)
      || candidateIds.has(candidate.id)
    ) return null;
    candidateIds.add(candidate.id);
  }
  const matches = draft.candidates.filter((candidate) =>
    candidate.id === draft.replacementStatusId);
  const replacement = matches.length === 1 ? matches[0] : undefined;
  if (replacement === undefined) return null;
  return {
    expectedRevision: draft.source.revision,
    replacementStatusId: replacement.id,
    replacementExpectedRevision: replacement.revision,
  };
}
