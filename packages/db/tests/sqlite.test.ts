import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  archiveMilestone,
  archiveLabel,
  archiveIssue,
  archiveProject,
  bootstrapInstance,
  createComment,
  createDatabase,
  createIssue,
  createIssueRelation,
  createLabel,
  createMilestone,
  createOnlineBackup,
  createProject,
  createSavedView,
  createWorkspaceExport,
  getIssue,
  getProject,
  importWorkspaceExport,
  importWorkspaceExportFile,
  listIssues,
  listComments,
  listIssueActivity,
  listIssueRelations,
  listMilestones,
  listProjectActivity,
  listProjects,
  listStatuses,
  listWorkspaceEvents,
  listWorkspaceMilestones,
  purgeMilestone,
  purgeProject,
  restoreDatabaseFile,
  restoreIssue,
  restoreProject,
  retireStatus,
  searchWorkspace,
  updateIssue,
  verifyDatabaseFile,
  writeTransaction,
  type OpenLinearDatabase,
} from '@openlinear/db/sqlite';
import {
  buildWorkspaceDigests,
  canonicalSha256,
  canonicalStringify,
  sortWorkspaceCollections,
} from '../src/canonical.js';
import { defaultIssueViewState } from '@openlinear/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createLegacyTransferFixture,
  legacyTransferFixtureIds,
  legacyTransferFixtureSha256,
} from './legacy-transfer-fixture.js';

const bootstrap = {
  email: 'owner@openlinear.local',
  displayName: 'Owner',
  workspaceName: 'OpenLinear',
  workspaceSlug: 'openlinear',
  teamName: 'Personal',
  teamKey: 'OL',
};

describe('embedded SQLite repository', () => {
  let db: OpenLinearDatabase;
  let ids: Awaited<ReturnType<typeof bootstrapInstance>>;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    ids = await bootstrapInstance(db, bootstrap);
  });

  afterEach(() => db.close());

  it('persists the project, milestone, issue, activity, and derived-progress workflow', async () => {
    const project = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Release readiness',
      resources: [{ label: 'Spec', url: 'https://example.com/spec' }],
      idempotencyKey: 'project-release-readiness',
    });
    const repeated = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Ignored replay payload',
      idempotencyKey: 'project-release-readiness',
    });
    expect(repeated.id).toBe(project.id);

    const milestone = await createMilestone(db, ids.userId, ids.workspaceId, project.id, {
      name: 'Candidate',
      idempotencyKey: 'milestone-candidate',
    });
    const label = await createLabel(db, ids.userId, ids.workspaceId, {
      name: 'Migration',
      color: '#5E6AD2',
      idempotencyKey: 'label-migration',
    });
    const issue = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Verify canonical import',
      projectId: project.id,
      milestoneId: milestone.id,
      assigneeUserId: ids.userId,
      labelIds: [label.id],
      idempotencyKey: 'issue-canonical-import',
    });
    const completed = (await listStatuses(db, ids.userId, ids.workspaceId))
      .find((status) => status.category === 'completed')!;
    const done = await updateIssue(db, ids.userId, ids.workspaceId, issue.id, {
      expectedRevision: issue.revision,
      statusId: completed.id,
    });

    const historicalAssignee = randomUUID();
    db.sqlite.prepare('UPDATE issues SET assignee_user_id = ? WHERE id = ?')
      .run(historicalAssignee, issue.id);
    const preserved = await updateIssue(db, ids.userId, ids.workspaceId, issue.id, {
      expectedRevision: done.revision,
      priority: 'high',
    });
    expect(preserved.assigneeUserId).toBe(historicalAssignee);
    await expect(updateIssue(db, ids.userId, ids.workspaceId, issue.id, {
      expectedRevision: preserved.revision,
      assigneeUserId: randomUUID(),
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect((await getProject(db, ids.userId, ids.workspaceId, project.id)).progress).toMatchObject({
      issueCount: 1,
      completedCount: 1,
      fraction: 1,
    });
    expect((await listWorkspaceMilestones(db, ids.userId, ids.workspaceId))[0]?.progress.fraction).toBe(1);
    expect(await listProjectActivity(db, ids.userId, ids.workspaceId, project.id)).not.toHaveLength(0);
    await expect(updateIssue(db, ids.userId, ids.workspaceId, preserved.id, {
      expectedRevision: issue.revision,
      priority: 'medium',
    })).rejects.toMatchObject({ code: 'CONFLICT', currentRevision: preserved.revision });
  });

  it('rolls back interrupted writes and preserves archive and restore revisions', async () => {
    expect(() => writeTransaction(db, () => {
      db.sqlite.prepare(`
        INSERT INTO labels (id, name, color, revision, created_at, updated_at)
        VALUES (?, 'Interrupted', '#000000', 1, ?, ?)
      `).run(randomUUID(), new Date().toISOString(), new Date().toISOString());
      throw new Error('interrupt');
    })).toThrow('The operation could not be completed.');
    expect((db.sqlite.prepare("SELECT count(*) AS count FROM labels WHERE name = 'Interrupted'")
      .get() as { count: number }).count).toBe(0);

    const project = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Archive workflow',
      idempotencyKey: 'project-archive-workflow',
    });
    const archived = await archiveProject(db, ids.userId, ids.workspaceId, project.id, project.revision);
    const restored = await restoreProject(db, ids.userId, ids.workspaceId, project.id, archived.revision);
    expect(archived.archivedAt).not.toBeNull();
    expect(restored.archivedAt).toBeNull();
    expect(restored.revision).toBe(project.revision + 2);
  });

  it('purges only an exactly confirmed archived project and preserves detached issues', async () => {
    const project = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Disposable project',
      idempotencyKey: 'project-disposable',
    });
    const milestone = await createMilestone(db, ids.userId, ids.workspaceId, project.id, {
      name: 'Disposable milestone',
      idempotencyKey: 'milestone-disposable',
    });
    const label = await createLabel(db, ids.userId, ids.workspaceId, {
      name: 'Preserved',
      color: '#117766',
      idempotencyKey: 'label-preserved-after-project-purge',
    });
    const first = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Preserve active issue',
      projectId: project.id,
      milestoneId: milestone.id,
      labelIds: [label.id],
      idempotencyKey: 'issue-active-project-purge',
    });
    const second = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Preserve archived issue',
      projectId: project.id,
      milestoneId: milestone.id,
      idempotencyKey: 'issue-archived-project-purge',
    });
    await createIssueRelation(db, ids.userId, ids.workspaceId, first.id, {
      type: 'related',
      targetIssueId: second.id,
      idempotencyKey: 'relation-project-purge',
    });
    await createComment(db, ids.userId, ids.workspaceId, first.id, {
      bodyDocument: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this comment.' }] }],
      },
      idempotencyKey: 'comment-project-purge',
    });
    const archivedSecond = await archiveIssue(
      db,
      ids.userId,
      ids.workspaceId,
      second.id,
      second.revision,
    );

    await expect(purgeProject(db, ids.userId, ids.workspaceId, project.id, {
      expectedRevision: project.revision,
      confirmation: project.name,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const archivedProject = await archiveProject(
      db,
      ids.userId,
      ids.workspaceId,
      project.id,
      project.revision,
    );
    await expect(purgeProject(db, ids.userId, ids.workspaceId, project.id, {
      expectedRevision: archivedProject.revision,
      confirmation: 'Disposable Project',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'confirmation' });
    await expect(purgeProject(db, ids.userId, ids.workspaceId, project.id, {
      expectedRevision: project.revision,
      confirmation: project.name,
    })).rejects.toMatchObject({ code: 'CONFLICT', currentRevision: archivedProject.revision });
    await expect(purgeProject(db, ids.userId, randomUUID(), project.id, {
      expectedRevision: archivedProject.revision,
      confirmation: project.name,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const receipt = await purgeProject(db, ids.userId, ids.workspaceId, project.id, {
      expectedRevision: archivedProject.revision,
      confirmation: project.name,
    });
    expect(receipt).toMatchObject({
      id: project.id,
      name: project.name,
      detachedIssueCount: 2,
      removedMilestoneCount: 1,
    });
    expect(receipt.purgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    await expect(getProject(db, ids.userId, ids.workspaceId, project.id))
      .rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await listWorkspaceMilestones(db, ids.userId, ids.workspaceId, true)).toHaveLength(0);

    const preservedFirst = await getIssue(db, ids.userId, ids.workspaceId, first.id);
    const preservedSecond = await getIssue(db, ids.userId, ids.workspaceId, second.id);
    expect(preservedFirst).toMatchObject({
      id: first.id,
      identifier: first.identifier,
      projectId: null,
      milestoneId: null,
      revision: first.revision + 1,
      labels: [{ id: label.id }],
    });
    expect(preservedSecond).toMatchObject({
      id: second.id,
      identifier: second.identifier,
      projectId: null,
      milestoneId: null,
      archivedAt: archivedSecond.archivedAt,
      revision: archivedSecond.revision + 1,
    });
    expect(await listIssueRelations(db, ids.userId, ids.workspaceId, first.id)).toHaveLength(1);
    expect(await listComments(db, ids.userId, ids.workspaceId, first.id, true)).toHaveLength(1);
    expect((await listIssueActivity(db, ids.userId, ids.workspaceId, first.id))[0]).toMatchObject({
      action: 'issue.updated',
      entityRevision: first.revision + 1,
      fields: [
        { field: 'projectId', before: project.id, after: null },
        { field: 'milestoneId', before: milestone.id, after: null },
      ],
    });

    const recreated = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Recreated project',
      idempotencyKey: 'project-disposable',
    });
    expect(recreated.id).not.toBe(project.id);
  });

  it('purges only an exactly confirmed archived milestone and preserves linked issues in project', async () => {
    const project = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Milestone retention project',
      idempotencyKey: 'project-milestone-retention',
    });
    const otherProject = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Other project',
      idempotencyKey: 'project-milestone-retention-other',
    });
    const milestone = await createMilestone(db, ids.userId, ids.workspaceId, project.id, {
      name: 'Disposable milestone',
      idempotencyKey: 'milestone-retention-purge',
    });
    const label = await createLabel(db, ids.userId, ids.workspaceId, {
      name: 'Still labeled',
      color: '#117766',
      idempotencyKey: 'label-preserved-after-milestone-purge',
    });
    const first = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Preserve active milestone issue',
      projectId: project.id,
      milestoneId: milestone.id,
      labelIds: [label.id],
      idempotencyKey: 'issue-active-milestone-purge',
    });
    const second = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Preserve archived milestone issue',
      projectId: project.id,
      milestoneId: milestone.id,
      idempotencyKey: 'issue-archived-milestone-purge',
    });
    await createIssueRelation(db, ids.userId, ids.workspaceId, first.id, {
      type: 'related',
      targetIssueId: second.id,
      idempotencyKey: 'relation-milestone-purge',
    });
    await createComment(db, ids.userId, ids.workspaceId, first.id, {
      bodyDocument: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep this comment.' }] }],
      },
      idempotencyKey: 'comment-milestone-purge',
    });
    const archivedSecond = await archiveIssue(
      db,
      ids.userId,
      ids.workspaceId,
      second.id,
      second.revision,
    );

    await expect(purgeMilestone(db, ids.userId, ids.workspaceId, project.id, milestone.id, {
      expectedRevision: milestone.revision,
      confirmation: milestone.name,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    const archivedMilestone = await archiveMilestone(
      db,
      ids.userId,
      ids.workspaceId,
      project.id,
      milestone.id,
      milestone.revision,
    );
    await expect(purgeMilestone(db, ids.userId, ids.workspaceId, project.id, milestone.id, {
      expectedRevision: archivedMilestone.revision,
      confirmation: 'Disposable Milestone',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'confirmation' });
    await expect(purgeMilestone(db, ids.userId, ids.workspaceId, project.id, milestone.id, {
      expectedRevision: milestone.revision,
      confirmation: milestone.name,
    })).rejects.toMatchObject({ code: 'CONFLICT', currentRevision: archivedMilestone.revision });
    await expect(purgeMilestone(
      db,
      ids.userId,
      ids.workspaceId,
      otherProject.id,
      milestone.id,
      { expectedRevision: archivedMilestone.revision, confirmation: milestone.name },
    )).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(purgeMilestone(
      db,
      ids.userId,
      randomUUID(),
      project.id,
      milestone.id,
      { expectedRevision: archivedMilestone.revision, confirmation: milestone.name },
    )).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const receipt = await purgeMilestone(
      db,
      ids.userId,
      ids.workspaceId,
      project.id,
      milestone.id,
      { expectedRevision: archivedMilestone.revision, confirmation: milestone.name },
    );
    expect(receipt).toMatchObject({
      id: milestone.id,
      projectId: project.id,
      name: milestone.name,
      detachedIssueCount: 2,
    });
    expect(receipt.purgedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);
    expect(await listMilestones(db, ids.userId, ids.workspaceId, project.id, true)).toHaveLength(0);

    const preservedFirst = await getIssue(db, ids.userId, ids.workspaceId, first.id);
    const preservedSecond = await getIssue(db, ids.userId, ids.workspaceId, second.id);
    expect(preservedFirst).toMatchObject({
      id: first.id,
      identifier: first.identifier,
      projectId: project.id,
      milestoneId: null,
      revision: first.revision + 1,
      labels: [{ id: label.id }],
    });
    expect(preservedSecond).toMatchObject({
      id: second.id,
      identifier: second.identifier,
      projectId: project.id,
      milestoneId: null,
      archivedAt: archivedSecond.archivedAt,
      revision: archivedSecond.revision + 1,
    });
    expect(await listIssueRelations(db, ids.userId, ids.workspaceId, first.id)).toHaveLength(1);
    expect(await listComments(db, ids.userId, ids.workspaceId, first.id, true)).toHaveLength(1);
    expect((await listIssueActivity(db, ids.userId, ids.workspaceId, first.id))[0]).toMatchObject({
      action: 'issue.updated',
      entityRevision: first.revision + 1,
      fields: [{ field: 'milestoneId', before: milestone.id, after: null }],
    });
    expect(await listProjectActivity(db, ids.userId, ids.workspaceId, project.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'project',
          entityId: project.id,
          action: 'milestone.purged',
          entityRevision: project.revision,
          fields: expect.arrayContaining([
            { field: 'milestoneId', before: milestone.id, after: null },
            { field: 'milestoneName', before: milestone.name, after: null },
            { field: 'detachedIssueCount', before: 0, after: 2 },
          ]),
        }),
      ]),
    );

    const recreated = await createMilestone(db, ids.userId, ids.workspaceId, project.id, {
      name: 'Recreated milestone',
      idempotencyKey: 'milestone-retention-purge',
    });
    expect(recreated.id).not.toBe(milestone.id);
  });

  it('evaluates filters and deterministic ranking in TypeScript without FTS', async () => {
    const project = await createProject(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Search migration',
      summary: 'SQLite cutover',
      idempotencyKey: 'project-search',
    });
    const label = await createLabel(db, ids.userId, ids.workspaceId, {
      name: 'Critical path',
      color: '#CC3344',
      idempotencyKey: 'label-critical',
    });
    const issue = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Preserve migration order',
      projectId: project.id,
      labelIds: [label.id],
      priority: 'urgent',
      dueDate: '2026-09-01',
      idempotencyKey: 'issue-search',
    });
    const filtered = await listIssues(db, ids.userId, ids.workspaceId, {
      filter: {
        version: 1,
        root: {
          type: 'group',
          operator: 'and',
          children: [
            { type: 'condition', field: 'labelId', operator: 'is', value: label.id },
            { type: 'condition', field: 'dueDate', operator: 'before', value: '2026-09-02' },
          ],
        },
      },
    });
    expect(filtered.map((value) => value.id)).toEqual([issue.id]);
    expect((await searchWorkspace(db, ids.userId, ids.workspaceId, issue.identifier))[0]).toMatchObject({
      id: issue.id,
      matchedBy: 'identifier',
      rank: 0,
    });
    expect((await searchWorkspace(db, ids.userId, ids.workspaceId, 'SQLite cutover'))[0]).toMatchObject({
      id: project.id,
      kind: 'project',
    });
  });

  it('prevents relation cycles and preserves comment and issue archive behavior', async () => {
    const first = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'First',
      idempotencyKey: 'issue-first',
    });
    const second = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Second',
      idempotencyKey: 'issue-second',
    });
    await createIssueRelation(db, ids.userId, ids.workspaceId, first.id, {
      type: 'blocks',
      targetIssueId: second.id,
      idempotencyKey: 'relation-first-second',
    });
    await expect(createIssueRelation(db, ids.userId, ids.workspaceId, second.id, {
      type: 'blocks',
      targetIssueId: first.id,
      idempotencyKey: 'relation-second-first',
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await createComment(db, ids.userId, ids.workspaceId, first.id, {
      bodyDocument: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Local note' }] }],
      },
      idempotencyKey: 'comment-local-note',
    });
    const archived = await archiveIssue(db, ids.userId, ids.workspaceId, first.id, first.revision);
    await expect(createComment(db, ids.userId, ids.workspaceId, first.id, {
      bodyDocument: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Blocked' }] }],
      },
      idempotencyKey: 'comment-blocked',
    })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await restoreIssue(
      db, ids.userId, ids.workspaceId, first.id, archived.revision,
    )).archivedAt).toBeNull();
  });

  it('retires a workflow status atomically and keeps saved views personal', async () => {
    const statuses = await listStatuses(db, ids.userId, ids.workspaceId);
    const source = statuses.find((status) => status.category === 'backlog')!;
    const replacement = statuses.find((status) => status.category === 'unstarted')!;
    const issue = await createIssue(db, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Reassign status',
      statusId: source.id,
      idempotencyKey: 'issue-reassign-status',
    });
    const result = await retireStatus(db, ids.userId, ids.workspaceId, source.id, {
      expectedRevision: source.revision,
      replacementStatusId: replacement.id,
      replacementExpectedRevision: replacement.revision,
    });
    expect(result.reassignedIssueCount).toBe(1);
    expect((await getIssue(db, ids.userId, ids.workspaceId, issue.id)).statusId).toBe(replacement.id);

    const view = await createSavedView(db, ids.userId, ids.workspaceId, {
      name: 'My work',
      sharingScope: 'workspace',
      state: defaultIssueViewState,
      idempotencyKey: 'saved-view-my-work',
    });
    expect(view.sharingScope).toBe('private');
  });
});

describe('SQLite canonical migration and recovery', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('preflights the locked legacy fixture before creating an ambiguous target', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'openlinear-legacy-transfer-test-'));
    directories.push(directory);
    const fixture = createLegacyTransferFixture();
    const sourceBefore = `${canonicalStringify(fixture)}\n`;
    expect(canonicalSha256(fixture)).toBe(legacyTransferFixtureSha256);
    const sourcePath = join(directory, 'legacy-database-backup-v1.json');
    writeFileSync(sourcePath, sourceBefore, { mode: 0o600 });
    const sourceFileBefore = readFileSync(sourcePath);
    const sourceDocument = JSON.parse(sourceFileBefore.toString('utf8')) as unknown;

    const ambiguousDirectory = join(directory, 'ambiguous');
    const ambiguousTarget = join(ambiguousDirectory, 'openlinear.sqlite3');
    await expect(importWorkspaceExportFile(sourceDocument, ambiguousTarget, {}))
      .rejects.toMatchObject({ code: 'AMBIGUOUS_SCOPE' });
    expect(existsSync(ambiguousDirectory)).toBe(false);
    expect(readFileSync(sourcePath).equals(sourceFileBefore)).toBe(true);
    expect(`${canonicalStringify(fixture)}\n`).toBe(sourceBefore);

    const selectedTarget = join(directory, 'selected', 'openlinear.sqlite3');
    const imported = await importWorkspaceExportFile(sourceDocument, selectedTarget, {
      workspaceId: legacyTransferFixtureIds.workspace,
    });
    expect(imported).toMatchObject({
      workspaceId: legacyTransferFixtureIds.workspace,
      teamId: legacyTransferFixtureIds.team,
      ownerUserId: legacyTransferFixtureIds.owner,
      credentialRecoveryRequired: 0,
      replaced: false,
    });
    expect(imported.canonicalDigest).toBe(fixture.workspaces[0]!.digests.canonical);
    expect(statSync(selectedTarget).mode & 0o777).toBe(0o600);

    const selected = createDatabase(selectedTarget);
    const readback = await createWorkspaceExport(
      selected,
      imported.workspaceId,
      imported.ownerUserId,
    );
    expect(readback.digests.canonical).toBe(fixture.workspaces[0]!.digests.canonical);
    const tables = selected.sqlite.prepare(`
      SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name
    `).all().map((row) => String((row as { name: string }).name));
    expect(tables).not.toContain('oidc_identities');
    expect(tables).not.toContain('sessions');
    const ownerColumns = selected.sqlite.prepare("PRAGMA table_info('owner_profile')").all()
      .map((row) => String((row as { name: string }).name));
    expect(ownerColumns).not.toContain('password_hash');
    selected.close();
    const databaseBytes = readFileSync(selectedTarget);
    expect(databaseBytes.includes(Buffer.from('$argon2id$legacy-fixture'))).toBe(false);
    expect(databaseBytes.includes(Buffer.from('identity.example.test'))).toBe(false);
    expect(readFileSync(sourcePath).equals(sourceFileBefore)).toBe(true);
    expect(`${canonicalStringify(fixture)}\n`).toBe(sourceBefore);
  });

  it('round trips canonical data, rejects tampering, and fails closed on ambiguous teams', async () => {
    const source = createDatabase(':memory:');
    const ids = await bootstrapInstance(source, bootstrap);
    const archivedLabel = await createLabel(source, ids.userId, ids.workspaceId, {
      name: 'Reusable',
      color: '#445566',
      idempotencyKey: 'label-reusable-archived',
    });
    await archiveLabel(
      source, ids.userId, ids.workspaceId, archivedLabel.id, archivedLabel.revision,
    );
    const activeLabel = await createLabel(source, ids.userId, ids.workspaceId, {
      name: 'Reusable',
      color: '#556677',
      idempotencyKey: 'label-reusable-active',
    });
    const secondLabel = await createLabel(source, ids.userId, ids.workspaceId, {
      name: 'Ordering',
      color: '#667788',
      idempotencyKey: 'label-ordering',
    });
    const project = await createProject(source, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      name: 'Canonical source',
      resources: [
        { label: 'Spec', url: 'https://example.com/spec' },
        { label: 'Runbook', url: 'https://example.com/runbook' },
      ],
      idempotencyKey: 'project-canonical-source',
    });
    const milestone = await createMilestone(source, ids.userId, ids.workspaceId, project.id, {
      name: 'Canonical milestone',
      idempotencyKey: 'milestone-canonical-source',
    });
    await createIssue(source, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Stable identity',
      projectId: project.id,
      milestoneId: milestone.id,
      labelIds: [activeLabel.id, secondLabel.id],
      resources: [
        { label: 'Trace', url: 'https://example.com/trace' },
        { label: 'Evidence', url: 'https://example.com/evidence' },
      ],
      idempotencyKey: 'issue-stable-identity',
    });
    await createSavedView(source, ids.userId, ids.workspaceId, {
      name: 'Duplicate source name',
      sharingScope: 'private',
      state: defaultIssueViewState,
      idempotencyKey: 'saved-view-duplicate-one',
    });
    await createSavedView(source, ids.userId, ids.workspaceId, {
      name: 'Duplicate source name',
      sharingScope: 'private',
      state: defaultIssueViewState,
      idempotencyKey: 'saved-view-duplicate-two',
    });
    const document = await createWorkspaceExport(source, ids.workspaceId, ids.userId);
    document.collections.workflowStatuses[0]!.name = 'Case';
    document.collections.workflowStatuses[0]!.position = 150.5;
    document.collections.workflowStatuses[1]!.name = 'case';
    document.collections.workflowStatuses[1]!.position = 150.5;
    document.collections.projects[0]!.position = 25.5;
    document.collections.milestones[0]!.position = 12.5;
    document.collections.projectResources.forEach((resource) => { resource.position = 0.5; });
    document.collections.issueResources.forEach((resource) => { resource.position = 0.5; });
    document.collections.issueLabels.forEach((link) => { link.position = 0.5; });
    document.collections = sortWorkspaceCollections(document.collections);
    document.digests = buildWorkspaceDigests(
      document.source.migrations,
      document.workspaceId,
      document.collections,
    );
    const target = createDatabase(':memory:');
    const imported = await importWorkspaceExport(target, document, {});
    const readback = await createWorkspaceExport(target, imported.workspaceId, imported.ownerUserId);
    expect(readback.digests.canonical).toBe(document.digests.canonical);
    expect(readback.collections.issues[0]?.id).toBe(document.collections.issues[0]?.id);

    const tampered = structuredClone(document);
    tampered.collections.issues[0]!.title = 'Tampered';
    const tamperedTarget = createDatabase(':memory:');
    await expect(importWorkspaceExport(tamperedTarget, tampered, {}))
      .rejects.toMatchObject({ code: 'DIGEST_MISMATCH' });
    tamperedTarget.close();

    const ambiguous = structuredClone(document);
    ambiguous.collections.teams.push({
      ...ambiguous.collections.teams[0]!,
      id: randomUUID(),
      name: 'Second team',
      key: 'TWO',
    });
    ambiguous.collections = sortWorkspaceCollections(ambiguous.collections);
    ambiguous.digests = buildWorkspaceDigests(
      ambiguous.source.migrations,
      ambiguous.workspaceId,
      ambiguous.collections,
    );
    const ambiguousTarget = createDatabase(':memory:');
    await expect(importWorkspaceExport(ambiguousTarget, ambiguous, {}))
      .rejects.toMatchObject({ code: 'AMBIGUOUS_SCOPE' });
    ambiguousTarget.close();

    const selectedTarget = createDatabase(':memory:');
    const selected = await importWorkspaceExport(selectedTarget, ambiguous, {
      teamId: ids.teamId,
    });
    const selectedReadback = await createWorkspaceExport(
      selectedTarget, selected.workspaceId, selected.ownerUserId,
    );
    expect(selectedReadback.collections.teams.map((team) => team.id)).toEqual([ids.teamId]);
    expect(selectedReadback.collections.activityEntries.some(
      (entry) => entry.entityId === activeLabel.id,
    )).toBe(true);
    expect(selectedReadback.digests.canonical).toBe(selected.canonicalDigest);
    selectedTarget.close();
    source.close();
    target.close();
  });

  it('persists across restart and verifies online backup and atomic restore', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'openlinear-sqlite-test-'));
    directories.push(directory);
    const databasePath = join(directory, 'openlinear.sqlite3');
    const backupPath = join(directory, 'backup.sqlite3');
    const restoredPath = join(directory, 'restored.sqlite3');
    const corruptPath = join(directory, 'corrupt.sqlite3');
    let database = createDatabase(databasePath);
    const ids = await bootstrapInstance(database, bootstrap);
    const issue = await createIssue(database, ids.userId, ids.workspaceId, {
      teamId: ids.teamId,
      title: 'Survive restart',
      idempotencyKey: 'issue-survive-restart',
    });
    expect(database.sqlite.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'delete' });
    expect(database.sqlite.prepare('PRAGMA synchronous').get()).toEqual({ synchronous: 2 });
    await createOnlineBackup(database, backupPath);
    expect(existsSync(`${backupPath}-shm`)).toBe(false);
    expect(existsSync(`${backupPath}-wal`)).toBe(false);
    await expect(createOnlineBackup(database, databasePath, true))
      .rejects.toMatchObject({ code: 'OUTPUT_UNSAFE' });
    database.close();
    expect(existsSync(`${databasePath}-shm`)).toBe(false);
    expect(existsSync(`${databasePath}-wal`)).toBe(false);

    database = createDatabase(databasePath);
    expect((await getIssue(database, ids.userId, ids.workspaceId, issue.id)).title).toBe('Survive restart');
    database.close();
    expect(existsSync(`${databasePath}-shm`)).toBe(false);
    expect(existsSync(`${databasePath}-wal`)).toBe(false);
    writeFileSync(corruptPath, 'not a SQLite database', { mode: 0o600 });
    expect(() => verifyDatabaseFile(corruptPath)).toThrowError(expect.objectContaining({
      code: 'DATABASE_CORRUPT',
    }));
    expect(() => restoreDatabaseFile(corruptPath, databasePath, true)).toThrowError(
      expect.objectContaining({ code: 'DATABASE_CORRUPT' }),
    );
    database = createDatabase(databasePath);
    expect((await getIssue(database, ids.userId, ids.workspaceId, issue.id)).title).toBe('Survive restart');
    database.close();
    expect(verifyDatabaseFile(backupPath)).toMatchObject({ integrity: 'ok', foreignKeyViolations: 0 });
    expect(restoreDatabaseFile(backupPath, restoredPath)).toMatchObject({ integrity: 'ok' });
    expect(existsSync(`${restoredPath}-shm`)).toBe(false);
    expect(existsSync(`${restoredPath}-wal`)).toBe(false);
    expect(statSync(databasePath).mode & 0o777).toBe(0o600);
    expect(statSync(backupPath).mode & 0o777).toBe(0o600);
  });

  it('refuses a newer schema version without mutating the database', () => {
    const directory = mkdtempSync(join(tmpdir(), 'openlinear-sqlite-version-test-'));
    directories.push(directory);
    const databasePath = join(directory, 'future.sqlite3');
    const future = new DatabaseSync(databasePath);
    future.exec('PRAGMA user_version = 3');
    future.close();

    expect(() => createDatabase(databasePath)).toThrow('schema version is unsupported');

    const readback = new DatabaseSync(databasePath, { readOnly: true });
    expect((readback.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
      .toBe(3);
    readback.close();
  });

  it('scans the accepted personal-data ceiling with deterministic bounded results', async () => {
    const database = createDatabase(':memory:');
    const ids = await bootstrapInstance(database, bootstrap);
    const status = (await listStatuses(database, ids.userId, ids.workspaceId))[0]!;
    const timestamp = new Date('2026-08-21T00:00:00.000Z').toISOString();
    database.write(() => {
      const projectInsert = database.sqlite.prepare(`
        INSERT INTO projects (
          id, name, summary, status, priority, lead_user_id, start_date, target_date,
          icon, color, position, overview_document, revision, created_at, updated_at
        ) VALUES (?, ?, '', 'planned', 'none', NULL, NULL, NULL, 'layers', '#5E6AD2', ?,
                  '{"version":1,"type":"doc","content":[]}', 1, ?, ?)
      `);
      const milestoneInsert = database.sqlite.prepare(`
        INSERT INTO milestones (
          id, project_id, name, description, target_date, position, revision, created_at, updated_at
        ) VALUES (?, ?, ?, '', NULL, ?, 1, ?, ?)
      `);
      const projects: string[] = [];
      for (let index = 0; index < 1_000; index += 1) {
        const id = randomUUID();
        projects.push(id);
        projectInsert.run(id, `Project ${index}`, (index + 1) * 100, timestamp, timestamp);
      }
      for (let index = 0; index < 2_000; index += 1) {
        milestoneInsert.run(
          randomUUID(),
          projects[index % projects.length]!,
          `Milestone ${index}`,
          (index + 1) * 100,
          timestamp,
          timestamp,
        );
      }
      const issueInsert = database.sqlite.prepare(`
        INSERT INTO issues (
          id, sequence_number, identifier, title, description_document, status_id,
          priority, revision, created_at, updated_at
        ) VALUES (?, ?, ?, ?, '{"version":1,"type":"doc","content":[]}', ?, 'none', 1, ?, ?)
      `);
      for (let index = 1; index <= 10_000; index += 1) issueInsert.run(
        randomUUID(), index, `OL-${index}`, index === 10_000 ? 'Needle 10000' : `Issue ${index}`,
        status.id, timestamp, timestamp,
      );
      database.sqlite.prepare('UPDATE issue_sequence SET next_number = 10001 WHERE singleton = 1').run();
      const activityInsert = database.sqlite.prepare(`
        INSERT INTO activity_entries (
          actor_user_id, entity_type, entity_id, action, entity_revision, metadata, created_at
        ) VALUES (?, 'issue', ?, 'issue.updated', 1, '{"fields":[]}', ?)
      `);
      for (let index = 0; index < 50_000; index += 1) {
        activityInsert.run(ids.userId, randomUUID(), timestamp);
      }
    });

    const startedAt = performance.now();
    expect((await listIssues(database, ids.userId, ids.workspaceId, { query: 'Needle 10000' })))
      .toHaveLength(1);
    expect(await listProjects(database, ids.userId, ids.workspaceId)).toHaveLength(1_000);
    expect(await listWorkspaceMilestones(database, ids.userId, ids.workspaceId)).toHaveLength(2_000);
    expect((await searchWorkspace(database, ids.userId, ids.workspaceId, 'OL-10000'))[0]?.identifier)
      .toBe('OL-10000');
    expect(await listWorkspaceEvents(database, ids.userId, ids.workspaceId, '49800', 200))
      .toHaveLength(200);
    expect(performance.now() - startedAt).toBeLessThan(5_000);
    database.close();
  }, 20_000);
});
