import {describe, expect, it} from 'vitest';
import {
  CollaborationService,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  WorkspaceConfigurationService,
} from '../src/index.js';
import {proEntitlementPolicyForTests} from './fixtures/entitlement.js';

const workspaceId = 'ws_configuration';
const ownerId = 'owner_configuration';
const memberId = 'member_configuration';
const principal = (userId: string) => ({kind: 'user' as const, userId, source: 'web' as const});

function membership(userId: string, role: 'owner' | 'member') {
  return {
    schemaVersion: 1,
    id: `mem_${userId}`,
    workspaceId,
    userId,
    role,
    status: 'active',
    createdAt: '2027-04-01T00:00:00.000Z',
    revision: 1,
  };
}

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  let sequence = 1;
  let now = new Date('2027-04-02T00:00:00.000Z');
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  for (const [userId, role] of [[ownerId, 'owner'], [memberId, 'member']] as const) {
    memberships.set({schemaVersion: 1, workspaceId, userId, role, status: 'active', revision: 1});
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, membership(userId, role));
  }
  const authorization = new WorkspaceAuthorizationService(memberships, evidence, {
    clock: () => now,
    idFactory,
  });
  const configuration = new WorkspaceConfigurationService(repository, authorization, {
    secret: 'configuration-test-secret-at-least-32-bytes',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  const collaboration = new CollaborationService(repository, authorization, {
    secret: 'configuration-collaboration-secret-at-least-32-bytes',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  return {
    repository,
    configuration,
    collaboration,
    setNow(value: string) { now = new Date(value); },
  };
}

describe('WorkspaceConfigurationService', () => {
  it('creates durable teams, custom workflows, saved views, and issue placement', async () => {
    const context = fixture();
    const defaults = await context.configuration.ensureDefaults({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_bootstrap',
      idempotencyKey: 'configuration-bootstrap-key-0001',
    });
    expect(defaults.team.name).toBe('Product');
    expect(defaults.statuses.map((status) => status.name)).toEqual([
      'Backlog', 'Todo', 'In Progress', 'Done', 'Canceled',
    ]);

    const teamCommand = {
      principal: principal(ownerId), workspaceId, requestId: 'configuration_team_create',
      idempotencyKey: 'configuration-team-create-key-0001',
      name: 'Engineering', key: 'ENG', color: '#4F8BD6', description: 'Build and operate OpenLinear.',
    };
    const teamResult = await context.configuration.createTeam(teamCommand);
    expect(await context.configuration.createTeam(teamCommand)).toEqual(teamResult);
    expect(teamResult.statuses).toHaveLength(5);

    context.setNow('2027-04-02T00:01:00.000Z');
    const review = await context.configuration.createStatus({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_status_create',
      idempotencyKey: 'configuration-status-create-key-0001',
      teamId: teamResult.team.id,
      name: 'In Review',
      category: 'started',
      color: '#A970FF',
      icon: 'circle-dot',
      position: 3,
    });
    const view = await context.configuration.createSavedView({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_view_create',
      idempotencyKey: 'configuration-view-create-key-0001',
      teamId: teamResult.team.id,
      name: 'Engineering active',
      viewType: 'issues',
      predicate: 'active',
    });

    context.setNow('2027-04-02T00:02:00.000Z');
    const issue = await context.collaboration.createIssue({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_issue_create',
      idempotencyKey: 'configuration-issue-create-key-0001',
      title: 'Ship durable team workflows',
      teamId: teamResult.team.id,
      statusId: review.id,
    });
    expect(issue).toMatchObject({
      teamId: teamResult.team.id,
      statusId: review.id,
      cycleId: null,
      status: 'in_progress',
    });
    expect(await context.configuration.listTeams({
      principal: principal(memberId), workspaceId, requestId: 'configuration_team_list',
    })).toHaveLength(2);
    expect(await context.configuration.listStatuses({
      principal: principal(memberId), workspaceId, requestId: 'configuration_status_list',
    })).toContainEqual(review);
    expect(await context.configuration.listSavedViews({
      principal: principal(memberId), workspaceId, requestId: 'configuration_view_list',
    })).toContainEqual(view);

    context.setNow('2027-04-02T00:03:00.000Z');
    const updatedTeam = await context.configuration.updateTeam({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_team_update',
      idempotencyKey: 'configuration-team-update-key-0001',
      teamId: teamResult.team.id,
      expectedRevision: teamResult.team.revision,
      patch: {name: 'Platform Engineering', color: '#2DA44E'},
    });
    const updatedStatus = await context.configuration.updateStatus({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_status_update',
      idempotencyKey: 'configuration-status-update-key-0001',
      statusId: review.id,
      expectedRevision: review.revision,
      patch: {name: 'Ready for review', color: '#E2B340'},
    });
    expect(updatedTeam).toMatchObject({name: 'Platform Engineering', color: '#2DA44E', revision: 2});
    expect(updatedStatus).toMatchObject({name: 'Ready for review', color: '#E2B340', revision: 2});

    const snapshot = context.repository.snapshot();
    expect(JSON.stringify(snapshot)).not.toContain('configuration-team-create-key-0001');
    expect(Object.keys(snapshot).some((path) => path.endsWith(`/teams/${teamResult.team.id}`))).toBe(true);
    expect(Object.keys(snapshot).some((path) => path.endsWith(`/workflowStatuses/${review.id}`))).toBe(true);
    expect(Object.keys(snapshot).some((path) => path.endsWith(`/savedViews/${view.id}`))).toBe(true);
  });

  it('locks system workflow definitions while allowing each icon to change', async () => {
    const context = fixture();
    const defaults = await context.configuration.ensureDefaults({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_status_lock_bootstrap',
      idempotencyKey: 'configuration-status-lock-bootstrap-0001',
    });
    const todo = defaults.statuses.find((status) => status.name === 'Todo');
    expect(todo).toMatchObject({isDefault: true, icon: 'circle'});
    if (todo === undefined) throw new Error('Todo status missing from fixture.');

    for (const [field, patch] of [
      ['name', {name: 'Ready'}],
      ['category', {category: 'started' as const}],
      ['color', {color: '#123456'}],
      ['position', {position: 99}],
    ] as const) {
      await expect(context.configuration.updateStatus({
        principal: principal(ownerId), workspaceId, requestId: `configuration_status_lock_${field}`,
        idempotencyKey: `configuration-status-lock-${field}-0001`,
        statusId: todo.id,
        expectedRevision: todo.revision,
        patch,
      })).rejects.toMatchObject({code: 'CONFIGURATION_FORBIDDEN'});
    }

    context.setNow('2027-04-02T00:01:00.000Z');
    await expect(context.configuration.updateStatus({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_status_icon_update',
      idempotencyKey: 'configuration-status-icon-update-0001',
      statusId: todo.id,
      expectedRevision: todo.revision,
      patch: {icon: 'circle-check'},
    })).resolves.toMatchObject({
      name: 'Todo', category: 'unstarted', color: '#A3A3A3', position: 1,
      icon: 'circle-check', isDefault: true, revision: 2,
    });
  });

  it('lets every organization member see, join, and leave multiple teams independently', async () => {
    const context = fixture();
    const defaults = await context.configuration.ensureDefaults({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_membership_bootstrap',
      idempotencyKey: 'configuration-membership-bootstrap-0001',
    });
    const engineering = (await context.configuration.createTeam({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_membership_team',
      idempotencyKey: 'configuration-membership-team-0001',
      name: 'Engineering', key: 'ENG',
    })).team;

    expect(await context.configuration.listTeams({
      principal: principal(memberId), workspaceId, requestId: 'configuration_membership_list_all',
    })).toEqual(expect.arrayContaining([defaults.team, engineering]));

    context.setNow('2027-04-02T00:01:00.000Z');
    const firstJoin = await context.configuration.joinTeam({
      principal: principal(memberId), workspaceId, teamId: defaults.team.id,
      requestId: 'configuration_membership_join_product',
      idempotencyKey: 'configuration-membership-join-product-0001',
    });
    const secondJoin = await context.configuration.joinTeam({
      principal: principal(memberId), workspaceId, teamId: engineering.id,
      requestId: 'configuration_membership_join_engineering',
      idempotencyKey: 'configuration-membership-join-engineering-0001',
    });
    expect(firstJoin).toMatchObject({userId: memberId, teamId: defaults.team.id, status: 'active'});
    expect(secondJoin).toMatchObject({userId: memberId, teamId: engineering.id, status: 'active'});
    expect((await context.configuration.listTeamMemberships({
      principal: principal(memberId), workspaceId, requestId: 'configuration_membership_list_joined',
    })).filter((membership) => membership.userId === memberId).map((membership) => membership.teamId)).toEqual([
      defaults.team.id,
      engineering.id,
    ].sort());

    context.setNow('2027-04-02T00:02:00.000Z');
    await expect(context.configuration.leaveTeam({
      principal: principal(memberId), workspaceId, teamId: defaults.team.id,
      requestId: 'configuration_membership_leave_product',
      idempotencyKey: 'configuration-membership-leave-product-0001',
    })).resolves.toMatchObject({status: 'left'});
    expect((await context.configuration.listTeamMemberships({
      principal: principal(memberId), workspaceId, requestId: 'configuration_membership_list_remaining',
    })).filter((membership) => membership.userId === memberId).map((membership) => membership.teamId)).toEqual([
      engineering.id,
    ]);
  });

  it('keeps workspace configuration owner-managed while members retain read access', async () => {
    const context = fixture();
    await context.configuration.ensureDefaults({
      principal: principal(ownerId), workspaceId, requestId: 'configuration_bootstrap_owner',
      idempotencyKey: 'configuration-bootstrap-owner-key-0001',
    });
    await expect(context.configuration.createTeam({
      principal: principal(memberId), workspaceId, requestId: 'configuration_team_member',
      idempotencyKey: 'configuration-team-member-key-0001',
      name: 'Unauthorized team', key: 'NOPE',
    })).rejects.toMatchObject({code: 'WORKSPACE_ACCESS_DENIED'});
    expect(await context.configuration.listTeams({
      principal: principal(memberId), workspaceId, requestId: 'configuration_team_member_list',
    })).toHaveLength(1);
  });
});
