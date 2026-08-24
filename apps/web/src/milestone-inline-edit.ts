import type { Milestone, UpdateMilestoneRequest } from '@openlinear/contracts';

interface MilestoneEditSource extends Pick<Milestone,
  'revision' | 'name' | 'description' | 'targetDate' | 'archivedAt'> {}

export interface MilestoneEditDraft {
  name: string;
  description: string;
  targetDate: string | null;
}

function normalizedName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= 1 && normalized.length <= 80 ? normalized : null;
}

function normalizedDescription(value: string): string | null {
  const normalized = value.trim().replace(/\r\n?/g, '\n');
  return normalized.length <= 4000 ? normalized : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function milestoneEditDraft(milestone: MilestoneEditSource): MilestoneEditDraft {
  return {
    name: milestone.name,
    description: milestone.description,
    targetDate: milestone.targetDate,
  };
}

export function milestoneEditRequest(
  milestone: MilestoneEditSource,
  draft: MilestoneEditDraft,
): UpdateMilestoneRequest | null {
  if (
    milestone.archivedAt !== null
    || !Number.isInteger(milestone.revision)
    || milestone.revision < 1
  ) return null;

  const name = normalizedName(draft.name);
  const description = normalizedDescription(draft.description);
  const targetDate = draft.targetDate;
  if (
    name === null
    || description === null
    || (targetDate !== null && !validDate(targetDate))
  ) return null;

  const request: UpdateMilestoneRequest = { expectedRevision: milestone.revision };
  if (name !== milestone.name) request.name = name;
  if (description !== milestone.description) request.description = description;
  if (targetDate !== milestone.targetDate) request.targetDate = targetDate;
  return Object.keys(request).length > 1 ? request : null;
}
