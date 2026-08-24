import type { UpdateStatusRequest, WorkflowStatus } from '@openlinear/contracts';

export const workflowStatusCategories = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
] as const satisfies readonly WorkflowStatus['category'][];

type WorkflowStatusEditSource = Pick<WorkflowStatus,
  'workspaceId' | 'teamId' | 'revision' | 'name' | 'category' | 'color'>;

export interface WorkflowStatusEditDraft {
  name: string;
  category: WorkflowStatus['category'];
  color: string;
}

export interface WorkflowStatusEditScope {
  workspaceId: string;
  teamId: string;
}

function normalizedName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length >= 1 && normalized.length <= 80 ? normalized : null;
}

function normalizedColor(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function validCategory(value: string): value is WorkflowStatus['category'] {
  return workflowStatusCategories.some((category) => category === value);
}

export function workflowStatusEditDraft(
  status: WorkflowStatusEditSource,
): WorkflowStatusEditDraft {
  return {
    name: status.name,
    category: status.category,
    color: status.color,
  };
}

export function workflowStatusEditRequest(
  status: WorkflowStatusEditSource,
  draft: WorkflowStatusEditDraft,
  scope: WorkflowStatusEditScope,
): UpdateStatusRequest | null {
  if (
    status.workspaceId !== scope.workspaceId
    || status.teamId !== scope.teamId
    || !Number.isSafeInteger(status.revision)
    || status.revision < 1
  ) return null;

  const name = normalizedName(draft.name);
  const color = normalizedColor(draft.color);
  const baselineName = normalizedName(status.name);
  const baselineColor = normalizedColor(status.color);
  if (
    name === null
    || color === null
    || baselineName === null
    || baselineColor === null
    || !validCategory(draft.category)
    || !validCategory(status.category)
  ) return null;

  const request: UpdateStatusRequest = { expectedRevision: status.revision };
  if (name !== baselineName) request.name = name;
  if (draft.category !== status.category) request.category = draft.category;
  if (color !== baselineColor) request.color = color;
  return Object.keys(request).length > 1 ? request : null;
}

export function nextWorkflowStatusPosition(
  statuses: readonly Pick<WorkflowStatus, 'workspaceId' | 'teamId' | 'position'>[],
  scope: WorkflowStatusEditScope,
): number | null {
  const positions = statuses
    .filter((status) => status.workspaceId === scope.workspaceId && status.teamId === scope.teamId)
    .map((status) => status.position);
  if (positions.some((position) => !Number.isFinite(position) || position < 0)) return null;
  const position = (positions.length === 0 ? 0 : Math.max(...positions)) + 100;
  return Number.isFinite(position) && position >= 0 ? position : null;
}
