export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

export interface MigrationDescriptorV1 {
  name: string;
  digest: string;
}

export interface TransferSourceV1 {
  productVersion: string;
  buildId: string;
  migrations: MigrationDescriptorV1[];
}

export interface ExportUserV1 {
  id: string;
  email: string;
  displayName: string;
  revision: number;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportWorkspaceV1 {
  id: string;
  name: string;
  slug: string;
  revision: number;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExportMembershipV1 {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportTeamV1 {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExportWorkflowStatusV1 {
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

export interface ExportProjectV1 {
  id: string;
  workspaceId: string;
  teamId: string;
  name: string;
  summary: string;
  status: 'planned' | 'in_progress' | 'paused' | 'completed' | 'canceled';
  priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
  leadUserId: string | null;
  startDate: string | null;
  targetDate: string | null;
  icon: 'briefcase' | 'layers' | 'target' | 'compass' | 'rocket';
  color: string;
  position: number;
  overviewDocument: CanonicalJson;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportProjectResourceV1 {
  id: string;
  workspaceId: string;
  projectId: string;
  label: string;
  url: string;
  position: number;
  createdAt: string;
}

export interface ExportMilestoneV1 {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: string | null;
  position: number;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportTeamIssueSequenceV1 {
  workspaceId: string;
  teamId: string;
  nextNumber: string;
}

export interface ExportLabelV1 {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportIssueV1 {
  id: string;
  workspaceId: string;
  teamId: string;
  sequenceNumber: string;
  identifier: string;
  title: string;
  descriptionDocument: CanonicalJson;
  statusId: string;
  priority: 'none' | 'urgent' | 'high' | 'medium' | 'low';
  assigneeUserId: string | null;
  dueDate: string | null;
  projectId: string | null;
  milestoneId: string | null;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportIssueResourceV1 {
  id: string;
  workspaceId: string;
  issueId: string;
  label: string;
  url: string;
  position: number;
  createdAt: string;
}

export interface ExportIssueLabelV1 {
  workspaceId: string;
  issueId: string;
  labelId: string;
  position: number;
  createdAt: string;
}

export interface ExportIssueRelationV1 {
  id: string;
  workspaceId: string;
  sourceIssueId: string;
  targetIssueId: string;
  relationType: 'blocks' | 'related' | 'duplicate' | 'parent';
  revision: number;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportCommentV1 {
  id: string;
  workspaceId: string;
  issueId: string;
  authorUserId: string | null;
  bodyDocument: CanonicalJson;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportSavedViewV1 {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  sharingScope: 'private' | 'workspace';
  state: CanonicalJson;
  revision: number;
  archivedAt: string | null;
  archivedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportActivityEntryV1 {
  id: string;
  workspaceId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  entityRevision: number;
  metadata: CanonicalJson;
  createdAt: string;
}

export interface CanonicalWorkspaceCollectionsV1 {
  users: ExportUserV1[];
  workspaces: ExportWorkspaceV1[];
  memberships: ExportMembershipV1[];
  teams: ExportTeamV1[];
  workflowStatuses: ExportWorkflowStatusV1[];
  projects: ExportProjectV1[];
  projectResources: ExportProjectResourceV1[];
  milestones: ExportMilestoneV1[];
  teamIssueSequences: ExportTeamIssueSequenceV1[];
  labels: ExportLabelV1[];
  issues: ExportIssueV1[];
  issueResources: ExportIssueResourceV1[];
  issueLabels: ExportIssueLabelV1[];
  issueRelations: ExportIssueRelationV1[];
  comments: ExportCommentV1[];
  savedViews: ExportSavedViewV1[];
  activityEntries: ExportActivityEntryV1[];
}

export type CanonicalWorkspaceCollectionName = keyof CanonicalWorkspaceCollectionsV1;

export interface CanonicalWorkspaceDigestsV1 {
  algorithm: 'sha256';
  collections: Record<CanonicalWorkspaceCollectionName, string>;
  canonical: string;
}

export interface CanonicalWorkspaceSnapshotV1 {
  workspaceId: string;
  collections: CanonicalWorkspaceCollectionsV1;
  digests: CanonicalWorkspaceDigestsV1;
}

export interface WorkspaceExportV1 extends CanonicalWorkspaceSnapshotV1 {
  format: 'openlinear.workspace-export';
  version: 1;
  generatedAt: string;
  source: TransferSourceV1;
}

export interface BackupUserV1 extends ExportUserV1 {
  passwordHash: string;
}

export interface BackupOidcIdentityV1 {
  id: string;
  userId: string;
  issuer: string;
  subject: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseBackupV1 {
  format: 'openlinear.database-backup';
  version: 1;
  generatedAt: string;
  source: TransferSourceV1 & {
    databaseName: string;
    serverVersion: string;
  };
  users: BackupUserV1[];
  oidcIdentities: BackupOidcIdentityV1[];
  workspaces: CanonicalWorkspaceSnapshotV1[];
  digests: {
    algorithm: 'sha256';
    users: string;
    oidcIdentities: string;
    workspaces: string;
    canonical: string;
  };
}
