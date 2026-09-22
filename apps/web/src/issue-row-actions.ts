import type { IssuePriority, UpdateIssueRequest } from '@basiclinear/contracts';

export interface IssueActionMenuAnchor {
  x: number;
  aboveY: number;
  belowY: number;
}

export interface IssueActionMenuViewport {
  width: number;
  height: number;
}

export interface IssueActionMenuPosition {
  left: number;
  top: number;
}

export interface IssueActionMenuSize {
  width: number;
  height: number;
}

export interface IssueQuickEditSource {
  revision: number;
  statusId: string;
  priority: IssuePriority;
  assigneeUserId: string | null;
  projectId: string | null;
  milestoneId: string | null;
}

export interface IssueQuickEditValues {
  statusId: string;
  priority: IssuePriority;
  assigneeUserId: string | null;
  projectId: string | null;
  milestoneId: string | null;
}

export const issueActionMenuWidth = 208;
const menuHeight = 108;
const viewportMargin = 8;
const anchorGap = 4;

export function positionIssueActionMenu(
  anchor: IssueActionMenuAnchor,
  viewport: IssueActionMenuViewport,
  size: IssueActionMenuSize = { width: issueActionMenuWidth, height: menuHeight },
): IssueActionMenuPosition {
  const maximumLeft = Math.max(viewportMargin, viewport.width - size.width - viewportMargin);
  const left = Math.min(maximumLeft, Math.max(viewportMargin, anchor.x));
  const below = anchor.belowY + anchorGap;
  const above = anchor.aboveY - size.height - anchorGap;
  const preferredTop = below + size.height <= viewport.height - viewportMargin ? below : above;
  const maximumTop = Math.max(viewportMargin, viewport.height - size.height - viewportMargin);
  return {
    left,
    top: Math.min(maximumTop, Math.max(viewportMargin, preferredTop)),
  };
}

export function issueQuickEditRequest(
  issue: IssueQuickEditSource,
  values: IssueQuickEditValues,
): UpdateIssueRequest | null {
  const request: UpdateIssueRequest = { expectedRevision: issue.revision };
  if (values.statusId !== issue.statusId) request.statusId = values.statusId;
  if (values.priority !== issue.priority) request.priority = values.priority;
  if (values.assigneeUserId !== issue.assigneeUserId) {
    request.assigneeUserId = values.assigneeUserId;
  }
  if (values.projectId !== issue.projectId) request.projectId = values.projectId;
  if (values.milestoneId !== issue.milestoneId) request.milestoneId = values.milestoneId;
  return Object.keys(request).length === 1 ? null : request;
}
