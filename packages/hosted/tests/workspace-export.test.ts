import {createHash} from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {describe, expect, it} from 'vitest';
import {
  CollaborationService, MemoryCollaborationRepository, MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader, ProjectManagementService, WorkspaceAuthorizationService,
  WorkspaceConfigurationService, openLinearOpenApiDocument,
} from '../src/index.js';
import {proEntitlementPolicyForTests} from './fixtures/entitlement.js';

const workspaceId = 'ws_export_configuration';
const userId = 'owner_export_configuration';
const createdAt = '2026-09-01T00:00:00.000Z';
const now = '2026-09-21T00:00:00.000Z';
const context = {workspaceId, principal: {kind: 'user' as const, userId, source: 'web' as const}, requestId: 'export_configuration_regression'};
const groups = ['teams', 'teamMemberships', 'workflowStatuses', 'cycles', 'savedViews'] as const;
const canonical = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
};
const document = openLinearOpenApiDocument();
const ajv = new Ajv2020({strict: false, allErrors: true});
addFormats(ajv);
const validate = ajv.compile({$ref: '#/components/schemas/WorkspaceExportData', components: document.components});

async function fixture(populated = true) {
  const repository = new MemoryCollaborationRepository();
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1, id: workspaceId, workspaceId, name: 'Export regression', ownerUid: userId,
    authority: 'firebase-hosted', createdAt, revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, {
    schemaVersion: 1, id: 'mem_export_configuration', workspaceId, userId, role: 'owner', status: 'active', createdAt, revision: 1,
  });
  const memberships = new MemoryWorkspaceMembershipReader();
  memberships.set({schemaVersion: 1, workspaceId, userId, role: 'owner', status: 'active', revision: 1});
  let sequence = 1;
  const options = {clock: () => new Date(now), idFactory: () => (sequence++).toString(16).padStart(32, '0'),
    secret: 'export-configuration-fixture-secret-at-least-32-bytes', entitlementPolicy: proEntitlementPolicyForTests};
  const authorization = new WorkspaceAuthorizationService(memberships, new MemoryWorkspaceAuthorizationEvidenceWriter(), options);
  const configuration = new WorkspaceConfigurationService(repository, authorization, options);
  const collaboration = new CollaborationService(repository, authorization, options);
  const service = new ProjectManagementService(repository, authorization, options);
  if (populated) {
    const {team} = await configuration.createTeam({...context, idempotencyKey: 'export-config-team-key-0001', name: 'Platform', key: 'PLAT', color: '#4F8BD6'});
    const status = await configuration.createStatus({...context, idempotencyKey: 'export-config-status-key-0001', teamId: team.id,
      name: 'In review', category: 'started', color: '#A970FF', position: 3});
    const cycle = await configuration.createCycle({...context, idempotencyKey: 'export-config-cycle-key-0001', teamId: team.id,
      name: 'Release sprint', startDate: '2026-09-21', endDate: '2026-09-30'});
    await configuration.createSavedView({...context, idempotencyKey: 'export-config-view-key-0001', teamId: team.id,
      name: 'Platform active', viewType: 'issues', predicate: 'active'});
    await collaboration.createIssue({...context, idempotencyKey: 'export-config-issue-key-0001', title: 'Portable workflow',
      teamId: team.id, statusId: status.id, cycleId: cycle.id, dueAt: '2026-09-30T00:00:00.000Z'});
  }
  const paths = (group: string) => Object.keys(repository.snapshot()).filter(path => path.startsWith(`workspaces/${workspaceId}/${group}/`));
  return {repository, service, configuration, collaboration, paths};
}

describe('Hosted configuration export', () => {
  it('preserves custom configuration with a deterministic digest and a valid published schema', async () => {
    const {repository, service, configuration, paths} = await fixture();
    repository.seedDocument('workspaces/ws_foreign/teams/team_private', {privateSecret: 'foreign-export-sentinel'});
    const before = repository.snapshot();
    const first = await service.exportWorkspace(context);
    expect(first.data).toMatchObject({
      teams: [{name: 'Platform'}], teamMemberships: [{userId, status: 'active'}],
      workflowStatuses: expect.arrayContaining([expect.objectContaining({name: 'In review', category: 'started'})]),
      cycles: [{name: 'Release sprint', endDate: '2026-09-30'}], savedViews: [{name: 'Platform active'}],
    });
    expect(validate(first.data), JSON.stringify(validate.errors)).toBe(true);
    expect(await service.exportWorkspace(context)).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.sha256).toBe(createHash('sha256').update(canonical(first.data)).digest('hex'));
    expect(repository.snapshot()).toEqual(before);
    expect(JSON.stringify(first)).not.toMatch(/foreign-export-sentinel|configurationIdempotency|binding/);
    for (const group of groups) {
      const values = first.data[group];
      expect(values.map(value => value.id)).toEqual(values.map(value => value.id).sort());
    }
    const team = repository.readDocument(paths('teams')[0]!) as {id: string; revision: number};
    await configuration.updateTeam({...context, idempotencyKey: 'export-config-team-update-0001', teamId: team.id,
      expectedRevision: team.revision, patch: {name: 'Renamed platform'}});
    const changed = await service.exportWorkspace(context);
    expect(changed.sha256).not.toBe(first.sha256);
    expect(changed.data.teams[0]?.name).toBe('Renamed platform');
  });

  it('exports explicit empty configuration arrays for a new workspace', async () => {
    const {service} = await fixture(false);
    const result = await service.exportWorkspace(context);
    for (const group of groups) expect(result.data[group]).toEqual([]);
    expect(validate(result.data), JSON.stringify(validate.errors)).toBe(true);
  });

  it('preserves left team memberships and sanitized invitation team references', async () => {
    const {service, repository, configuration, paths} = await fixture();
    const team = repository.readDocument(paths('teams')[0]!) as {id: string};
    await configuration.leaveTeam({...context, teamId: team.id, idempotencyKey: 'export-left-membership-key-0001'});
    const invitationId = `invite_${'a'.repeat(32)}`;
    const invitationPath = `workspaces/${workspaceId}/invitations/${invitationId}`;
    const invitation = {
      schemaVersion: 1, id: invitationId, workspaceId, invitedEmail: 'invitee@example.test',
      inviterUserId: userId, inviterDisplayName: 'Owner', workspaceName: 'Export regression', role: 'member',
      status: 'pending', teamIds: [team.id], createdAt: now, updatedAt: now, lastSentAt: now,
      expiresAt: '2026-09-28T00:00:00.000Z', acceptedAt: null, acceptedUserId: null, revokedAt: null,
      currentTokenDigest: 'a'.repeat(64), sendCount: 1, activeSeatApplied: false, revision: 1,
    };
    repository.seedDocument(invitationPath, invitation);
    const exported = await service.exportWorkspace(context);
    expect(exported.data.teamMemberships).toEqual([expect.objectContaining({status: 'left', userId})]);
    expect(exported.data.invitations[0]?.teamIds).toEqual([team.id]);
    expect(validate(exported.data), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(exported.data)).not.toContain(invitation.currentTokenDigest);
    repository.seedDocument(invitationPath, {...invitation, teamIds: [`team_${'f'.repeat(32)}`]});
    await expect(service.exportWorkspace(context)).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
  });

  it.each(['statusId', 'cycleId'] as const)('rejects an existing %s owned by a different team', async (field) => {
    const {service, repository, configuration, paths} = await fixture();
    const other = await configuration.createTeam({...context, name: 'Other', key: 'OTHER', color: '#4F8BD6',
      idempotencyKey: 'export-cross-team-key-0001'});
    const cycle = await configuration.createCycle({...context, teamId: other.team.id, startDate: '2026-09-21', endDate: '2026-09-30',
      idempotencyKey: 'export-cross-cycle-key-0001'});
    const issuePath = paths('issues')[0]!;
    repository.seedDocument(issuePath, {...repository.readDocument(issuePath) as Record<string, unknown>,
      [field]: field === 'statusId' ? other.statuses[0]!.id : cycle.id});
    await expect(service.exportWorkspace(context)).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
  });

  it('includes deterministic inferred defaults for legacy issues without writing to storage', async () => {
    const {service, repository} = await fixture(false);
    repository.seedDocument(`workspaces/${workspaceId}/issues/issue_${'f'.repeat(32)}`, {
      schemaVersion: 1, id: `issue_${'f'.repeat(32)}`, workspaceId, title: 'Legacy issue', status: 'in_progress',
      priority: 'no_priority', assigneeUserId: null, createdByUserId: userId, createdAt, updatedAt: createdAt, revision: 1,
    });
    const before = repository.snapshot();
    const exported = await service.exportWorkspace(context);
    expect(exported.data.teams).toEqual([expect.objectContaining({id: exported.data.issues[0]?.teamId, name: 'Product'})]);
    expect(exported.data.workflowStatuses).toEqual([expect.objectContaining({id: exported.data.issues[0]?.statusId, category: 'started'})]);
    expect(await service.exportWorkspace(context)).toEqual(exported);
    expect(repository.snapshot()).toEqual(before);
    expect(validate(exported.data), JSON.stringify(validate.errors)).toBe(true);
  });

  it.each(groups.flatMap(group => ['foreign-workspace', 'future', 'extra-field', 'duplicate-id'].map(corruption => ({group, corruption}))))(
    'rejects $corruption in $group without a partial export', async ({group, corruption}) => {
      const {service, repository, paths} = await fixture();
      const path = paths(group)[0]!;
      const record = repository.readDocument(path) as Record<string, unknown>;
      if (corruption === 'duplicate-id') repository.seedDocument(`${path}_duplicate`, record);
      else repository.seedDocument(path, {...record, ...(corruption === 'foreign-workspace' ? {workspaceId: 'ws_foreign'}
        : corruption === 'future' ? {updatedAt: '2030-01-01T00:00:00.000Z'} : {privateSecret: 'must-not-export'})});
      const before = repository.snapshot();
      await expect(service.exportWorkspace(context)).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
      expect(repository.snapshot()).toEqual(before);
    },
  );

  it.each([
    ['workflowStatuses', 'teamId', `team_${'f'.repeat(32)}`],
    ['cycles', 'teamId', `team_${'f'.repeat(32)}`],
    ['savedViews', 'teamId', `team_${'f'.repeat(32)}`],
    ['teams', 'createdByUserId', 'unknown_creator'],
    ['cycles', 'createdByUserId', 'unknown_creator'],
    ['savedViews', 'createdByUserId', 'unknown_creator'],
    ['issues', 'teamId', `team_${'f'.repeat(32)}`],
    ['issues', 'statusId', `status_${'f'.repeat(32)}`],
    ['issues', 'cycleId', `cycle_${'f'.repeat(32)}`],
  ])('rejects unresolved %s.%s', async (group, field, reference) => {
    const {service, repository, paths} = await fixture();
    const path = paths(group!)[0]!;
    repository.seedDocument(path, {...repository.readDocument(path) as Record<string, unknown>, [field!]: reference});
    await expect(service.exportWorkspace(context)).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
  });

  it('counts configuration against the per-collection and aggregate export budgets', async () => {
    for (const overflow of ['collection', 'aggregate']) {
      const {service, repository, paths} = await fixture();
      const sources = Object.fromEntries(groups.map(group => [group, repository.readDocument(paths(group)[0]!) as Record<string, unknown>]));
      const counts = overflow === 'collection' ? {teams: 10_001, workflowStatuses: 0, savedViews: 0}
        : {teams: 9_000, workflowStatuses: 9_000, savedViews: 8_000};
      for (const [group, count] of Object.entries(counts)) {
        for (let index = 1; index <= count; index += 1) {
          const prefix = group === 'teams' ? 'team' : group === 'workflowStatuses' ? 'status' : 'view';
          const id = `${prefix}_${(index + 1_000).toString(16).padStart(32, '0')}`;
          repository.seedDocument(`workspaces/${workspaceId}/${group}/${id}`, {...sources[group], id});
        }
      }
      await expect(service.exportWorkspace(context)).rejects.toMatchObject({code: 'PM_SERVICE_UNAVAILABLE'});
    }
  });
});
