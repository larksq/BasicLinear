import type {
  BackupOidcIdentityV1,
  BackupUserV1,
  CanonicalWorkspaceCollectionsV1,
  CanonicalWorkspaceSnapshotV1,
  DatabaseBackupV1,
  ExportUserV1,
  MigrationDescriptorV1,
} from '@basiclinear/contracts';
import {
  buildDatabaseBackupDigests,
  buildWorkspaceDigests,
  sortWorkspaceCollections,
} from '../src/canonical.js';

const timestamp = '2024-06-15T12:00:00.000Z';

function scopedId(kind: number, scope: number, record = 1): string {
  return `${kind.toString(16).padStart(8, '0')}-${scope.toString(16).padStart(4, '0')}-4000-8000-${record.toString(16).padStart(12, '0')}`;
}

const migrations: MigrationDescriptorV1[] = [
  { name: '001_foundation.sql', digest: '1'.repeat(64) },
  { name: '011_canonical_transfer.sql', digest: 'b'.repeat(64) },
];

function publicUser(scope: number): ExportUserV1 {
  return {
    id: scopedId(0x10, scope),
    email: `legacy-owner-${scope}@example.test`,
    displayName: `Legacy Owner ${scope}`,
    revision: 3,
    disabledAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function workspaceSnapshot(scope: number): CanonicalWorkspaceSnapshotV1 {
  const user = publicUser(scope);
  const workspaceId = scopedId(0x20, scope);
  const membershipId = scopedId(0x21, scope);
  const teamId = scopedId(0x30, scope);
  const statusId = scopedId(0x40, scope);
  const projectId = scopedId(0x50, scope);
  const projectResourceId = scopedId(0x51, scope);
  const milestoneId = scopedId(0x60, scope);
  const labelId = scopedId(0x65, scope);
  const issueOneId = scopedId(0x70, scope, 1);
  const issueTwoId = scopedId(0x70, scope, 2);
  const issueResourceId = scopedId(0x71, scope);
  const relationId = scopedId(0x72, scope);
  const commentId = scopedId(0x73, scope);
  const savedViewId = scopedId(0x74, scope);
  const key = scope === 1 ? 'LEG' : 'ARC';
  const collections: CanonicalWorkspaceCollectionsV1 = sortWorkspaceCollections({
    users: [user],
    workspaces: [{
      id: workspaceId,
      name: `Legacy Workspace ${scope}`,
      slug: `legacy-workspace-${scope}`,
      revision: 4,
      createdByUserId: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    memberships: [{
      id: membershipId,
      workspaceId,
      userId: user.id,
      role: 'owner',
      revision: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    teams: [{
      id: teamId,
      workspaceId,
      name: `Legacy Team ${scope}`,
      key,
      revision: 5,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    workflowStatuses: [{
      id: statusId,
      workspaceId,
      teamId,
      name: 'In Progress',
      category: 'started',
      color: '#5e6ad2',
      position: 200,
      isDefault: true,
      revision: 6,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    projects: [{
      id: projectId,
      workspaceId,
      teamId,
      name: `Canonical Project ${scope}`,
      summary: 'Legacy PostgreSQL transfer fixture',
      status: 'in_progress',
      priority: 'high',
      leadUserId: user.id,
      startDate: '2024-06-15',
      targetDate: '2024-09-30',
      icon: 'target',
      color: '#26b5ce',
      position: 125.5,
      overviewDocument: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Preserve rich project context.' }] }],
      },
      revision: 7,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    projectResources: [{
      id: projectResourceId,
      workspaceId,
      projectId,
      label: 'Specification',
      url: `https://example.test/legacy-${scope}/project`,
      position: 50.5,
      createdAt: timestamp,
    }],
    milestones: [{
      id: milestoneId,
      workspaceId,
      projectId,
      name: `Migration Milestone ${scope}`,
      description: 'Retains ordering, dates, and project scope.',
      targetDate: '2024-08-31',
      position: 75.5,
      revision: 8,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    teamIssueSequences: [{ workspaceId, teamId, nextNumber: '3' }],
    labels: [{
      id: labelId,
      workspaceId,
      name: 'Migration',
      color: '#d97706',
      revision: 2,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    issues: [
      {
        id: issueOneId,
        workspaceId,
        teamId,
        sequenceNumber: '1',
        identifier: `${key}-1`,
        title: `Preserve canonical issue ${scope}`,
        descriptionDocument: {
          type: 'doc',
          version: 1,
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich issue text survives.' }] }],
        },
        statusId,
        priority: 'urgent',
        assigneeUserId: user.id,
        dueDate: '2024-08-15',
        projectId,
        milestoneId,
        revision: 9,
        archivedAt: null,
        archivedByUserId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: issueTwoId,
        workspaceId,
        teamId,
        sequenceNumber: '2',
        identifier: `${key}-2`,
        title: `Retain relation target ${scope}`,
        descriptionDocument: { type: 'doc', version: 1, content: [] },
        statusId,
        priority: 'medium',
        assigneeUserId: null,
        dueDate: null,
        projectId,
        milestoneId,
        revision: 4,
        archivedAt: null,
        archivedByUserId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    issueResources: [{
      id: issueResourceId,
      workspaceId,
      issueId: issueOneId,
      label: 'Evidence',
      url: `https://example.test/legacy-${scope}/issue`,
      position: 25.5,
      createdAt: timestamp,
    }],
    issueLabels: [{
      workspaceId,
      issueId: issueOneId,
      labelId,
      position: 40.5,
      createdAt: timestamp,
    }],
    issueRelations: [{
      id: relationId,
      workspaceId,
      sourceIssueId: issueOneId,
      targetIssueId: issueTwoId,
      relationType: 'blocks',
      revision: 3,
      createdByUserId: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    comments: [{
      id: commentId,
      workspaceId,
      issueId: issueOneId,
      authorUserId: user.id,
      bodyDocument: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Migration comment.' }] }],
      },
      revision: 2,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    savedViews: [{
      id: savedViewId,
      workspaceId,
      ownerUserId: user.id,
      name: 'Legacy focus',
      sharingScope: 'workspace',
      state: { filters: [{ field: 'project', operator: 'is', value: projectId }], layout: 'list' },
      revision: 3,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    activityEntries: [
      {
        id: '1',
        workspaceId,
        actorUserId: user.id,
        entityType: 'project',
        entityId: projectId,
        action: 'project.created',
        entityRevision: 1,
        metadata: { fields: ['name', 'summary'] },
        createdAt: timestamp,
      },
      {
        id: '2',
        workspaceId,
        actorUserId: user.id,
        entityType: 'issue',
        entityId: issueOneId,
        action: 'issue.updated',
        entityRevision: 9,
        metadata: { fields: ['milestoneId', 'statusId'] },
        createdAt: timestamp,
      },
    ],
  });
  return {
    workspaceId,
    collections,
    digests: buildWorkspaceDigests(migrations, workspaceId, collections),
  };
}

export const legacyTransferFixtureIds = {
  owner: scopedId(0x10, 1),
  workspace: scopedId(0x20, 1),
  team: scopedId(0x30, 1),
} as const;

export function createLegacyTransferFixture(): DatabaseBackupV1 {
  const users: BackupUserV1[] = [1, 2].map((scope) => ({
    ...publicUser(scope),
    passwordHash: `$argon2id$legacy-fixture-${scope}`,
  }));
  const oidcIdentities: BackupOidcIdentityV1[] = [1, 2].map((scope) => ({
    id: scopedId(0x90, scope),
    userId: scopedId(0x10, scope),
    issuer: 'https://identity.example.test',
    subject: `legacy-owner-${scope}`,
    revision: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const workspaces = [workspaceSnapshot(1), workspaceSnapshot(2)];
  return {
    format: 'basiclinear.database-backup',
    version: 1,
    generatedAt: timestamp,
    source: {
      productVersion: '0.0.9',
      buildId: 'legacy-postgresql-final-fixture',
      migrations,
      databaseName: 'basiclinear_legacy_fixture',
      serverVersion: 'PostgreSQL 16.10',
    },
    users,
    oidcIdentities,
    workspaces,
    digests: buildDatabaseBackupDigests(migrations, users, oidcIdentities, workspaces),
  };
}

export const legacyTransferFixtureSha256 = '3a5a996130beeb71754b509ec2c00cd9ad4c1d681bbae958e876c60c4bab8c3b';
