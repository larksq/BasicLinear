import type {
  CanonicalWorkspaceCollectionsV1,
  CanonicalWorkspaceSnapshotV1,
  DatabaseBackupV1,
  MigrationDescriptorV1,
  WorkspaceExportV1,
} from '@basiclinear/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildDatabaseBackupDigests,
  buildWorkspaceDigests,
  canonicalSha256,
  canonicalStringify,
  parseDatabaseBackup,
  parseWorkspaceExport,
  sortWorkspaceCollections,
  TransferError,
} from '../src/index.js';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  workspace: '20000000-0000-4000-8000-000000000001',
  membership: '21000000-0000-4000-8000-000000000001',
  team: '30000000-0000-4000-8000-000000000001',
  status: '40000000-0000-4000-8000-000000000001',
  issue: '70000000-0000-4000-8000-000000000001',
  issueResource: '70500000-0000-4000-8000-000000000001',
  oidcIdentity: '90000000-0000-4000-8000-000000000001',
} as const;
const timestamp = '2026-08-20T00:00:00.000Z';
const migrations: MigrationDescriptorV1[] = [{ name: '001_foundation.sql', digest: 'a'.repeat(64) }];

function collections(): CanonicalWorkspaceCollectionsV1 {
  return sortWorkspaceCollections({
    users: [{
      id: ids.user,
      email: 'owner@example.test',
      displayName: 'Owner',
      revision: 1,
      disabledAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    workspaces: [{
      id: ids.workspace,
      name: 'Workspace',
      slug: 'workspace',
      revision: 1,
      createdByUserId: ids.user,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    memberships: [{
      id: ids.membership,
      workspaceId: ids.workspace,
      userId: ids.user,
      role: 'owner',
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    teams: [{
      id: ids.team,
      workspaceId: ids.workspace,
      name: 'Product',
      key: 'PRO',
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    workflowStatuses: [{
      id: ids.status,
      workspaceId: ids.workspace,
      teamId: ids.team,
      name: 'Planned',
      category: 'unstarted',
      color: '#6279C6',
      position: 100,
      isDefault: true,
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }],
    projects: [],
    projectResources: [],
    milestones: [],
    teamIssueSequences: [],
    labels: [],
    issues: [],
    issueResources: [],
    issueLabels: [],
    issueRelations: [],
    comments: [],
    savedViews: [],
    activityEntries: [{
      id: '1',
      workspaceId: ids.workspace,
      actorUserId: ids.user,
      entityType: 'workspace',
      entityId: ids.workspace,
      action: 'workspace.created',
      entityRevision: 1,
      metadata: {},
      createdAt: timestamp,
    }],
  });
}

function workspaceExport(): WorkspaceExportV1 {
  const data = collections();
  return {
    format: 'basiclinear.workspace-export',
    version: 1,
    generatedAt: timestamp,
    source: { productVersion: '0.1.0', buildId: 'test', migrations },
    workspaceId: ids.workspace,
    collections: data,
    digests: buildWorkspaceDigests(migrations, ids.workspace, data),
  };
}

describe('P-T14 canonical transfer contract', () => {
  it('serializes object fields deterministically', () => {
    expect(canonicalStringify({ z: [3, { b: 2, a: 1 }], a: true }))
      .toBe('{"a":true,"z":[3,{"a":1,"b":2}]}');
    expect(canonicalSha256({ b: 2, a: 1 })).toBe(canonicalSha256({ a: 1, b: 2 }));
  });

  it('accepts a canonical workspace and rejects tampering before import', () => {
    const document = workspaceExport();
    expect(parseWorkspaceExport(document).digests.canonical).toBe(document.digests.canonical);

    const tampered = structuredClone(document);
    tampered.collections.workspaces[0]!.name = 'Changed without digest update';
    expect(() => parseWorkspaceExport(tampered)).toThrowError(TransferError);
    expect(() => parseWorkspaceExport(tampered)).toThrow(/digest/i);
  });

  it('rejects noncanonical order and broken references even with rebuilt digests', () => {
    const document = workspaceExport();
    document.collections.teams.push({
      id: '30000000-0000-4000-8000-000000000002',
      workspaceId: ids.workspace,
      name: 'Alpha',
      key: 'AAA',
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    document.digests = buildWorkspaceDigests(migrations, ids.workspace, document.collections);
    expect(() => parseWorkspaceExport(document)).toThrow(/canonical order/i);

    const broken = workspaceExport();
    broken.collections.workflowStatuses[0]!.teamId = '30000000-0000-4000-8000-000000000099';
    broken.digests = buildWorkspaceDigests(migrations, ids.workspace, broken.collections);
    expect(() => parseWorkspaceExport(broken)).toThrow(/missing record/i);
  });

  it('binds each issue resource to an issue in the exported workspace', () => {
    const document = workspaceExport();
    document.collections.issues.push({
      id: ids.issue,
      workspaceId: ids.workspace,
      teamId: ids.team,
      sequenceNumber: '1',
      identifier: 'PRO-1',
      title: 'Resource owner',
      descriptionDocument: { version: 1, type: 'doc', content: [] },
      statusId: ids.status,
      priority: 'none',
      assigneeUserId: null,
      dueDate: null,
      projectId: null,
      milestoneId: null,
      revision: 1,
      archivedAt: null,
      archivedByUserId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    document.collections.issueResources.push({
      id: ids.issueResource,
      workspaceId: ids.workspace,
      issueId: ids.issue,
      label: 'Runbook',
      url: 'https://example.test/runbook',
      position: 100,
      createdAt: timestamp,
    });
    document.digests = buildWorkspaceDigests(migrations, ids.workspace, document.collections);
    expect(parseWorkspaceExport(document).collections.issueResources).toHaveLength(1);

    document.collections.issueResources[0]!.issueId = '70000000-0000-4000-8000-000000000099';
    document.digests = buildWorkspaceDigests(migrations, ids.workspace, document.collections);
    expect(() => parseWorkspaceExport(document)).toThrow(/issueResource\.issueId references a missing record/i);
  });

  it('binds database backup credentials and workspace digests', () => {
    const exported = workspaceExport();
    const snapshot: CanonicalWorkspaceSnapshotV1 = {
      workspaceId: exported.workspaceId,
      collections: exported.collections,
      digests: exported.digests,
    };
    const users = [{ ...exported.collections.users[0]!, passwordHash: '$argon2id$test' }];
    const oidcIdentities = [{
      id: ids.oidcIdentity,
      userId: ids.user,
      issuer: 'https://identity.example.test',
      subject: 'owner-subject',
      revision: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
    const backup: DatabaseBackupV1 = {
      format: 'basiclinear.database-backup',
      version: 1,
      generatedAt: timestamp,
      source: {
        productVersion: '0.1.0',
        buildId: 'test',
        migrations,
        databaseName: 'source',
        serverVersion: '160010',
      },
      users,
      oidcIdentities,
      workspaces: [snapshot],
      digests: buildDatabaseBackupDigests(migrations, users, oidcIdentities, [snapshot]),
    };
    expect(parseDatabaseBackup(backup).digests.canonical).toBe(backup.digests.canonical);
    backup.users[0]!.passwordHash = 'changed';
    expect(() => parseDatabaseBackup(backup)).toThrow(/digest/i);
  });
});
