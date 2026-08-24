export interface MilestoneOrderRecord {
  id: string;
}

export type MilestoneDropEdge = 'before' | 'after';

const defaultDragThreshold = 6;

function hasUniqueMilestoneIds(records: readonly MilestoneOrderRecord[]): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

export function reorderMilestoneForMove<T extends MilestoneOrderRecord>(
  records: readonly T[],
  milestoneId: string,
  offset: -1 | 1,
): T[] | null {
  const matches = records.reduce(
    (count, record) => count + (record.id === milestoneId ? 1 : 0),
    0,
  );
  if (matches !== 1) return null;

  const index = records.findIndex((record) => record.id === milestoneId);
  const destination = index + offset;
  if (destination < 0 || destination >= records.length) return null;

  const ordered = [...records];
  const item = ordered[index];
  const target = ordered[destination];
  if (item === undefined || target === undefined) return null;
  ordered[index] = target;
  ordered[destination] = item;
  return ordered;
}

export function reorderMilestoneForDrop<T extends MilestoneOrderRecord>(
  records: readonly T[],
  milestoneId: string,
  targetId: string,
  edge: MilestoneDropEdge,
): T[] | null {
  if (
    milestoneId === targetId
    || (edge !== 'before' && edge !== 'after')
    || !hasUniqueMilestoneIds(records)
  ) return null;

  const sourceIndex = records.findIndex((record) => record.id === milestoneId);
  const targetIndex = records.findIndex((record) => record.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return null;

  const ordered = [...records];
  const [source] = ordered.splice(sourceIndex, 1);
  if (source === undefined) return null;
  const remainingTargetIndex = ordered.findIndex((record) => record.id === targetId);
  if (remainingTargetIndex < 0) return null;
  ordered.splice(remainingTargetIndex + (edge === 'after' ? 1 : 0), 0, source);

  return ordered.every((record, index) => record.id === records[index]?.id)
    ? null
    : ordered;
}

export function milestoneDropEdge(
  pointerY: number,
  rowTop: number,
  rowHeight: number,
): MilestoneDropEdge | null {
  if (![pointerY, rowTop, rowHeight].every(Number.isFinite) || rowHeight <= 0) return null;
  return pointerY < rowTop + rowHeight / 2 ? 'before' : 'after';
}

export function milestoneDragThresholdExceeded(
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

export function milestonePositionAnnouncement(
  milestoneName: string,
  records: readonly MilestoneOrderRecord[],
  milestoneId: string,
): string | null {
  const index = records.findIndex((record) => record.id === milestoneId);
  if (index < 0) return null;
  return `${milestoneName} moved to position ${index + 1} of ${records.length}.`;
}
