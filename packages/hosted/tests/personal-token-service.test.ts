import { describe, expect, it } from 'vitest';
import {
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  PersonalTokenService,
  WorkspaceAuthorizationService,
} from '../src/index.js';
import { proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_pat_contract';
const ownerId = 'owner_pat_contract';
const memberId = 'member_pat_contract';
const owner = {kind: 'user' as const, userId: ownerId, source: 'web' as const};

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  let now = new Date('2027-01-02T00:00:00.000Z');
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  for (const [userId, role] of [[ownerId, 'owner'], [memberId, 'member']] as const) {
    memberships.set({schemaVersion: 1, workspaceId, userId, role, status: 'active', revision: 1});
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, {
      schemaVersion: 1, id: `mem_${userId}`, workspaceId, userId, role, status: 'active',
      createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
    });
  }
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    {clock: () => now, idFactory},
  );
  const service = new PersonalTokenService(repository, authorization, {
    secret: 'personal-token-contract-secret-at-least-32-bytes',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
    randomSecret: () => new Uint8Array(32).fill(7),
  });
  return {repository, memberships, service, setNow(value: string) { now = new Date(value); }};
}

describe('PersonalTokenService', () => {
  it('shows a scoped credential once, stores only its digest, and updates last-use state', async () => {
    const context = fixture();
    const command = {
      principal: owner, workspaceId, requestId: 'request_pat_create',
      idempotencyKey: 'pat-create-idempotency-key-0001', name: 'CI product manager',
      scopes: ['workspace:read', 'issues:read'] as const, expiresInDays: 30,
    };
    const created = await context.service.createToken(command);
    expect(created.changed).toBe(true);
    expect(created.rawToken).toMatch(/^ol_pat_v1\.[a-f0-9]{32}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u);
    expect((await context.service.createToken(command)).rawToken).toBeNull();
    const raw = created.rawToken as string;
    const beforeAuth = JSON.stringify(context.repository.snapshot());
    expect(beforeAuth).not.toContain(raw);
    expect(beforeAuth).not.toContain('pat-create-idempotency-key-0001');

    context.setNow('2027-01-02T00:01:00.000Z');
    const principal = await context.service.authenticate({
      rawToken: raw, workspaceId, requiredScope: 'issues:read', action: 'issue.read',
      targetEntityType: 'issue', targetEntityId: 'collection', requestId: 'request_pat_auth',
    });
    expect(principal).toMatchObject({
      kind: 'personal_token', userId: ownerId, credentialWorkspaceId: workspaceId, source: 'rest',
    });
    expect((await context.service.listTokens({
      principal: owner, workspaceId, requestId: 'request_pat_list',
    }))[0]).toMatchObject({lastUsedAt: '2027-01-02T00:01:00.000Z', audience: 'openlinear-api-v1'});
    expect(Object.values(context.repository.snapshot())).toContainEqual(expect.objectContaining({
      action: 'token.use', source: 'rest', actor: expect.objectContaining({kind: 'personal_token'}),
      changes: [expect.objectContaining({field: 'lastUsedAt'})],
    }));

    await expect(context.service.authenticate({
      rawToken: raw, workspaceId, requiredScope: 'issues:write', action: 'issue.write',
      targetEntityType: 'issue', targetEntityId: 'new', requestId: 'request_pat_scope_deny',
    })).rejects.toMatchObject({code: 'TOKEN_SCOPE_DENIED'});
    await expect(context.service.authenticate({
      rawToken: raw, workspaceId: 'ws_pat_foreign', requiredScope: 'issues:read', action: 'issue.read',
      targetEntityType: 'issue', targetEntityId: 'collection', requestId: 'request_pat_workspace_deny',
    })).rejects.toMatchObject({code: 'TOKEN_AUTHENTICATION_FAILED'});
    context.memberships.set({
      schemaVersion: 1, workspaceId, userId: ownerId, role: 'owner', status: 'removed', revision: 2,
    });
    const beforeRemoved = context.repository.snapshot();
    await expect(context.service.authenticate({
      rawToken: raw, workspaceId, requiredScope: 'issues:read', action: 'issue.read',
      targetEntityType: 'issue', targetEntityId: 'collection', requestId: 'request_pat_removed_owner',
    })).rejects.toMatchObject({code: 'WORKSPACE_ACCESS_DENIED'});
    expect(context.repository.snapshot()).toEqual(beforeRemoved);
  });

  it('fails closed when a create idempotency outcome has since been used or revoked', async () => {
    const usedContext = fixture();
    const usedCommand = {
      principal: owner, workspaceId, requestId: 'request_pat_used_create',
      idempotencyKey: 'pat-used-create-key-0001', name: 'Used credential',
      scopes: ['workspace:read'] as const, expiresInDays: 30,
    };
    const used = await usedContext.service.createToken(usedCommand);
    usedContext.setNow('2027-01-02T00:01:00.000Z');
    await usedContext.service.authenticate({
      rawToken: used.rawToken as string, workspaceId, requiredScope: 'workspace:read',
      action: 'workspace.read', targetEntityType: 'workspace', targetEntityId: workspaceId,
      requestId: 'request_pat_used_auth',
    });
    const afterUse = usedContext.repository.snapshot();
    await expect(usedContext.service.createToken(usedCommand))
      .rejects.toMatchObject({code: 'TOKEN_CONFLICT'});
    expect(usedContext.repository.snapshot()).toEqual(afterUse);

    const revokedContext = fixture();
    const revokedCommand = {
      principal: owner, workspaceId, requestId: 'request_pat_revoked_create_replay',
      idempotencyKey: 'pat-revoked-create-key-0001', name: 'Revoked credential',
      scopes: ['workspace:read'] as const, expiresInDays: 30,
    };
    const revoked = await revokedContext.service.createToken(revokedCommand);
    await revokedContext.service.revokeToken({
      principal: owner, workspaceId, tokenId: revoked.token.id,
      requestId: 'request_pat_revoked_lifecycle', idempotencyKey: 'pat-revoke-lifecycle-key-0001',
    });
    const afterRevoke = revokedContext.repository.snapshot();
    await expect(revokedContext.service.createToken(revokedCommand))
      .rejects.toMatchObject({code: 'TOKEN_CONFLICT'});
    expect(revokedContext.repository.snapshot()).toEqual(afterRevoke);
  });

  it('revokes immediately, replays safely, and returns a stable not-found response', async () => {
    const context = fixture();
    const created = await context.service.createToken({
      principal: owner, workspaceId, requestId: 'request_pat_revoke_create',
      idempotencyKey: 'pat-revoke-create-key-0001', name: 'Temporary integration',
      scopes: ['workspace:read'], expiresInDays: 30,
    });
    const command = {
      principal: owner, workspaceId, tokenId: created.token.id,
      requestId: 'request_pat_revoke', idempotencyKey: 'pat-revoke-key-0001',
    };
    const revoked = await context.service.revokeToken(command);
    expect(revoked).toMatchObject({changed: true, token: {revokedAt: '2027-01-02T00:00:00.000Z'}});
    expect(await context.service.revokeToken(command)).toMatchObject({changed: false});
    await expect(context.service.authenticate({
      rawToken: created.rawToken as string, workspaceId, requiredScope: 'workspace:read',
      action: 'workspace.read', targetEntityType: 'workspace', targetEntityId: workspaceId,
      requestId: 'request_pat_revoked_auth',
    })).rejects.toMatchObject({code: 'TOKEN_AUTHENTICATION_FAILED'});
    await expect(context.service.revokeToken({
      principal: owner, workspaceId, tokenId: `pat_${'f'.repeat(32)}`,
      requestId: 'request_pat_missing', idempotencyKey: 'pat-missing-key-0001',
    })).rejects.toMatchObject({code: 'TOKEN_NOT_FOUND'});
  });

  it('allows only the browser owner to manage credentials and fails closed on signed-record tampering', async () => {
    const context = fixture();
    await expect(context.service.createToken({
      principal: {kind: 'user', userId: memberId, source: 'web'}, workspaceId,
      requestId: 'request_pat_member_create', idempotencyKey: 'pat-member-create-key-0001',
      name: 'Forbidden', scopes: ['workspace:read'], expiresInDays: 30,
    })).rejects.toMatchObject({code: 'WORKSPACE_ACCESS_DENIED'});
    const created = await context.service.createToken({
      principal: owner, workspaceId, requestId: 'request_pat_tamper_create',
      idempotencyKey: 'pat-tamper-create-key-0001', name: 'Tamper target',
      scopes: ['workspace:read'], expiresInDays: 30,
    });
    const path = `workspaces/${workspaceId}/personalTokens/${created.token.id}`;
    context.repository.seedDocument(path, {...context.repository.snapshot()[path], scopes: ['workspace:export']});
    const before = context.repository.snapshot();
    await expect(context.service.authenticate({
      rawToken: created.rawToken as string, workspaceId, requiredScope: 'workspace:export',
      action: 'workspace.export', targetEntityType: 'workspace', targetEntityId: workspaceId,
      requestId: 'request_pat_tampered_auth',
    })).rejects.toMatchObject({code: 'TOKEN_SERVICE_UNAVAILABLE'});
    expect(context.repository.snapshot()).toEqual(before);
  });

  it('survives service restart and binds terminal retries to the original token', async () => {
    const context = fixture();
    const created = await context.service.createToken({
      principal: owner, workspaceId, requestId: 'request_pat_restart_create',
      idempotencyKey: 'pat-restart-create-key-0001', name: 'Restart credential',
      scopes: ['workspace:read'], expiresInDays: 30,
    });
    let sequence = 500;
    const restarted = new PersonalTokenService(
      context.repository,
      new WorkspaceAuthorizationService(
        context.memberships,
        new MemoryWorkspaceAuthorizationEvidenceWriter(),
        {clock: () => new Date('2027-01-02T00:00:00.000Z'), idFactory: () => (++sequence).toString(16).padStart(32, '0')},
      ),
      {
        secret: 'personal-token-contract-secret-at-least-32-bytes',
        entitlementPolicy: proEntitlementPolicyForTests,
        clock: () => new Date('2027-01-02T00:00:00.000Z'),
        idFactory: () => (++sequence).toString(16).padStart(32, '0'),
      },
    );
    await expect(restarted.authenticate({
      rawToken: created.rawToken as string, workspaceId, requiredScope: 'workspace:read',
      action: 'workspace.read', targetEntityType: 'workspace', targetEntityId: workspaceId,
      requestId: 'request_pat_restart_auth',
    })).resolves.toMatchObject({kind: 'personal_token', userId: ownerId});

    const other = await restarted.createToken({
      principal: owner, workspaceId, requestId: 'request_pat_other_create',
      idempotencyKey: 'pat-other-create-key-0001', name: 'Other credential',
      scopes: ['workspace:read'], expiresInDays: 30,
    });
    await restarted.revokeToken({
      principal: owner, workspaceId, tokenId: created.token.id,
      requestId: 'request_pat_terminal_first', idempotencyKey: 'pat-terminal-reuse-key-0001',
    });
    await expect(restarted.revokeToken({
      principal: owner, workspaceId, tokenId: other.token.id,
      requestId: 'request_pat_terminal_other', idempotencyKey: 'pat-terminal-reuse-key-0001',
    })).rejects.toMatchObject({code: 'TOKEN_CONFLICT'});
    expect((await restarted.listTokens({
      principal: owner, workspaceId, requestId: 'request_pat_restart_list',
    })).find((token) => token.id === other.token.id)?.revokedAt).toBeNull();
  });
});
