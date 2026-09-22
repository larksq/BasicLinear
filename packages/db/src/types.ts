import type { IssueRichTextDocument, IssueViewState } from '@basiclinear/domain';

export interface DbUser {
  id: string;
  email: string;
  displayName: string;
  revision: number;
}


export interface DbWorkspace {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbTeam {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbMembership {
  id: string;
  workspaceId: string;
  userId: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbWorkflowStatus {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  category: 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';
  color: string;
  position: number;
  isDefault: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbRetireStatusResult {
  retiredStatusId: string;
  replacementStatusId: string;
  reassignedIssueCount: number;
  statuses: DbWorkflowStatus[];
}

export type DbProjectStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled';
export type DbProjectPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low';
export type DbProjectIcon = 'briefcase' | 'layers' | 'target' | 'compass' | 'rocket';

export type DbRichTextDocument = IssueRichTextDocument;

export interface DbProgressSnapshot {
  policy: 'project-progress-v1';
  issueCount: number;
  completedCount: number;
  canceledCount: number;
  eligibleCount: number;
  fraction: number;
}

export interface DbProjectResource {
  id: string;
  label: string;
  url: string;
  position: number;
}

export interface DbProject {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  summary: string;
  status: DbProjectStatus;
  priority: DbProjectPriority;
  leadUserId: string | null;
  startDate: string | null;
  targetDate: string | null;
  icon: DbProjectIcon;
  color: string;
  position: number;
  overviewDocument: DbRichTextDocument;
  resources: DbProjectResource[];
  progress: DbProgressSnapshot;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbMilestone {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  position: number;
  progress: DbProgressSnapshot;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbActivityEntry {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  entityRevision: number;
  actor: { id: string; displayName: string } | null;
  fields: Array<{ field: string; before: unknown; after: unknown }>;
  createdAt: string;
}

export type DbIssuePriority = 'none' | 'urgent' | 'high' | 'medium' | 'low';
export type DbIssueRelationType = 'blocks' | 'related' | 'duplicate' | 'parent';

export interface DbLabel {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbIssueResource {
  id: string;
  label: string;
  url: string;
  position: number;
}

export interface DbIssue {
  id: string;
  workspaceId: string;
  teamId: string;
  sequenceNumber: number;
  identifier: string;
  title: string;
  descriptionDocument: IssueRichTextDocument;
  statusId: string;
  priority: DbIssuePriority;
  assigneeUserId: string | null;
  dueDate: string | null;
  projectId: string | null;
  milestoneId: string | null;
  labels: DbLabel[];
  resources: DbIssueResource[];
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbIssueReference {
  id: string;
  identifier: string;
  title: string;
  archivedAt: string | null;
}

export interface DbIssueRelation {
  id: string;
  workspaceId: string;
  sourceIssueId: string;
  targetIssueId: string;
  type: DbIssueRelationType;
  direction: 'blocks' | 'blocked_by' | 'related' | 'duplicate_of' | 'duplicates' | 'parent' | 'sub_issue';
  otherIssue: DbIssueReference;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbComment {
  id: string;
  workspaceId: string;
  issueId: string;
  author: { id: string; displayName: string } | null;
  bodyDocument: IssueRichTextDocument;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbPurgeIssueReceipt {
  id: string;
  identifier: string;
  purgedAt: string;
}

export interface DbPurgeProjectReceipt {
  id: string;
  name: string;
  detachedIssueCount: number;
  removedMilestoneCount: number;
  purgedAt: string;
}

export interface DbPurgeMilestoneReceipt {
  id: string;
  projectId: string;
  name: string;
  detachedIssueCount: number;
  purgedAt: string;
}

export interface DbSavedView {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  sharingScope: 'private' | 'workspace';
  state: IssueViewState;
  archivedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DbSearchResult {
  kind: 'issue' | 'project';
  id: string;
  identifier: string | null;
  title: string;
  subtitle: string;
  matchedBy: 'identifier' | 'title' | 'description' | 'label' | 'summary';
  rank: number;
}

export interface DbBulkIssueMutationResult {
  id: string;
  status: 'updated' | 'conflict' | 'failed';
  issue?: DbIssue;
  error?: { code: string; message: string; currentRevision?: number };
}
