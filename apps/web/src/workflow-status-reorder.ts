export interface WorkflowStatusOrderRecord {
  id: string;
  workspaceId: string;
  teamId: string;
  revision: number;
}

export interface WorkflowStatusOrderScope {
  workspaceId: string;
  teamId: string;
}

export type WorkflowStatusDropEdge = 'before' | 'after';

const defaultDragThreshold = 6;

function validCollection(
  records: readonly WorkflowStatusOrderRecord[],
  scope: WorkflowStatusOrderScope,
): boolean {
  return records.length > 0
    && new Set(records.map((record) => record.id)).size === records.length
    && records.every((record) => record.workspaceId === scope.workspaceId
      && record.teamId === scope.teamId
      && Number.isSafeInteger(record.revision)
      && record.revision >= 1);
}

export function reorderWorkflowStatusForMove<T extends WorkflowStatusOrderRecord>(
  records: readonly T[],
  statusId: string,
  offset: -1 | 1,
  scope: WorkflowStatusOrderScope,
): T[] | null {
  if (!validCollection(records, scope)) return null;
  const index = records.findIndex((record) => record.id === statusId);
  const destination = index + offset;
  if (index < 0 || destination < 0 || destination >= records.length) return null;
  const ordered = [...records];
  const source = ordered[index];
  const target = ordered[destination];
  if (source === undefined || target === undefined) return null;
  ordered[index] = target;
  ordered[destination] = source;
  return ordered;
}

export function reorderWorkflowStatusForDrop<T extends WorkflowStatusOrderRecord>(
  records: readonly T[],
  statusId: string,
  targetId: string,
  edge: WorkflowStatusDropEdge,
  scope: WorkflowStatusOrderScope,
): T[] | null {
  if (
    statusId === targetId
    || (edge !== 'before' && edge !== 'after')
    || !validCollection(records, scope)
  ) return null;
  const sourceIndex = records.findIndex((record) => record.id === statusId);
  const targetIndex = records.findIndex((record) => record.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return null;
  const ordered = [...records];
  const [source] = ordered.splice(sourceIndex, 1);
  if (source === undefined) return null;
  const remainingTargetIndex = ordered.findIndex((record) => record.id === targetId);
  if (remainingTargetIndex < 0) return null;
  ordered.splice(remainingTargetIndex + (edge === 'after' ? 1 : 0), 0, source);
  return ordered.every((record, index) => record.id === records[index]?.id) ? null : ordered;
}

export function workflowStatusDropEdge(
  pointerY: number,
  rowTop: number,
  rowHeight: number,
): WorkflowStatusDropEdge | null {
  if (![pointerY, rowTop, rowHeight].every(Number.isFinite) || rowHeight <= 0) return null;
  return pointerY < rowTop + rowHeight / 2 ? 'before' : 'after';
}

export function workflowStatusDragThresholdExceeded(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = defaultDragThreshold,
): boolean {
  if (
    ![startX, startY, currentX, currentY, threshold].every(Number.isFinite)
    || threshold < 0
  ) return false;
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  return deltaX * deltaX + deltaY * deltaY >= threshold * threshold;
}

export function workflowStatusPositionAnnouncement(
  statusName: string,
  records: readonly WorkflowStatusOrderRecord[],
  statusId: string,
): string | null {
  const index = records.findIndex((record) => record.id === statusId);
  if (index < 0) return null;
  return `${statusName} moved to position ${index + 1} of ${records.length}.`;
}
