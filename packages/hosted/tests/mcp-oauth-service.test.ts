import {createHash} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {
  McpOAuthService,
  McpOAuthServiceError,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationService,
  mcpAccessTokenLifetimeSeconds,
  mcpOAuthScopes,
  mcpRefreshTokenLifetimeSeconds,
} from '../src/index.js';

const workspaceId = 'ws_mcp_oauth';
const ownerId = 'owner_mcp_oauth';
const memberId = 'member_mcp_oauth';
const origin = 'https://online.basiclinear.test';
const redirectUri = 'https://client.basiclinear.test/oauth/callback';
const verifier = 'mcp-oauth-verifier-with-forty-three-safe-characters-1234567890';
const challenge = createHash('sha256').update(verifier).digest('base64url');

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  let now = new Date('2027-01-02T00:00:00.000Z');
  let sequence = 1;
  memberships.set({
    schemaVersion: 1, workspaceId, userId: ownerId, role: 'owner', status: 'active', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1, id: workspaceId, workspaceId, name: 'MCP OAuth workspace', ownerUid: ownerId,
    authority: 'firebase-hosted', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
    schemaVersion: 1, id: `mem_${ownerId}`, workspaceId, userId: ownerId, role: 'owner', status: 'active',
    createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(memberships, evidence, {
    clock: () => now,
    idFactory: () => (sequence++).toString(16).padStart(32, '0'),
  });
  const service = new McpOAuthService(repository, authorization, {
    secret: 'mcp-oauth-test-secret-at-least-32-bytes-long',
    publicOrigin: origin,
    clock: () => now,
    idFactory: () => (sequence++).toString(16).padStart(32, '0'),
    randomSecret: () => new Uint8Array(32).fill((sequence++ % 250) + 1),
  });
  const authorize = async (scope = [...mcpOAuthScopes].join(' ')) => {
    const client = await service.registerClient({
      clientName: 'MCP test client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    const started = await service.startAuthorization({
      responseType: 'code', clientId: client.client_id, redirectUri, workspaceId, scope,
      state: 'state-value-at-least-sixteen', codeChallenge: challenge, codeChallengeMethod: 'S256',
      resource: `${origin}/mcp`,
    });
    const preview = await service.consentView(started.requestId, {uid: ownerId}, 'request_consent_view');
    const consent = await service.decideConsent({
      requestId: started.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'request_consent_approve',
    });
    const code = new URL(consent.redirectUri).searchParams.get('code') as string;
    const tokens = await service.exchangeAuthorizationCode({
      code, clientId: client.client_id, redirectUri, codeVerifier: verifier, resource: `${origin}/mcp`,
    });
    return {client, started, preview, consent, tokens};
  };
  return {
    repository, memberships, evidence, service, authorize,
    setNow(value: string) { now = new Date(value); },
  };
}

describe('MCP OAuth service', () => {
  it('validates a standard authorization request before offering first-party workspace selection', async () => {
    const context = fixture();
    const client = await context.service.registerClient({
      clientName: 'Workspace selection client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    const before = context.repository.snapshot();
    const selectionUri = await context.service.authorizationSelectionUri({
      responseType: 'code', clientId: client.client_id, redirectUri,
      scope: 'workspace:read issues:write issues:read', state: 'workspace-selection-state-value',
      codeChallenge: challenge, codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    });
    const selection = new URL(selectionUri);
    expect(selection.origin).toBe(origin);
    expect(selection.pathname).toBe('/hosted.html');
    expect(Object.fromEntries(selection.searchParams)).toEqual({
      oauth_workspace: 'select',
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      scope: 'issues:read issues:write workspace:read',
      state: 'workspace-selection-state-value',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: `${origin}/mcp`,
    });
    expect(context.repository.snapshot()).toEqual(before);

    await expect(context.service.authorizationSelectionUri({
      responseType: 'code', clientId: client.client_id, redirectUri: 'https://hostile.example/callback',
      scope: 'workspace:read', state: 'workspace-selection-state-value', codeChallenge: challenge,
      codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'INVALID_OAUTH_REQUEST'});
    expect(context.repository.snapshot()).toEqual(before);
  });

  it('discovers, consents with Google identity, exchanges PKCE, and stores no raw credential', async () => {
    const context = fixture();
    expect(context.service.protectedResourceMetadata()).toMatchObject({
      resource: `${origin}/mcp`, authorization_servers: [origin], bearer_methods_supported: ['header'],
      resource_documentation: `${origin}/mcp-guide.html`,
    });
    expect(context.service.authorizationServerMetadata()).toMatchObject({
      issuer: origin, code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: false,
      service_documentation: `${origin}/mcp-guide.html`,
    });

    const result = await context.authorize('workspace:read projects:read projects:write');
    expect(result.preview).toMatchObject({
      client: {name: 'MCP test client'}, workspace: {id: workspaceId},
      scopes: ['projects:read', 'projects:write', 'workspace:read'], state: 'pending',
    });
    expect(result.consent.decision).toBe('approved');
    expect(new URL(result.consent.redirectUri).searchParams.get('iss')).toBe(origin);
    expect(result.tokens).toMatchObject({
      token_type: 'Bearer', expires_in: mcpAccessTokenLifetimeSeconds,
      scope: 'projects:read projects:write workspace:read', resource: `${origin}/mcp`,
    });
    expect(result.tokens.access_token).toMatch(/^olm_at_[A-Za-z0-9_-]{43}$/u);
    expect(result.tokens.refresh_token).toMatch(/^olm_rt_[A-Za-z0-9_-]{43}$/u);
    expect(await context.service.authenticateAccessToken(result.tokens.access_token)).toMatchObject({
      principal: {kind: 'user', userId: ownerId, source: 'mcp'}, workspaceId,
      scopes: ['projects:read', 'projects:write', 'workspace:read'], resource: `${origin}/mcp`,
    });
    const stored = JSON.stringify(context.repository.snapshot());
    expect(stored).not.toContain(result.tokens.access_token);
    expect(stored).not.toContain(result.tokens.refresh_token);
    expect(stored).not.toContain(new URL(result.consent.redirectUri).searchParams.get('code'));
    const families = Object.values(context.repository.snapshot()).filter((value) => (
      (value as {schemaVersion?: number; currentRefreshDigest?: string}).currentRefreshDigest !== undefined
    )) as Array<{createdAt: string; expiresAt: string}>;
    expect(families).toHaveLength(1);
    expect(Date.parse(families[0]?.expiresAt ?? '') - Date.parse(families[0]?.createdAt ?? ''))
      .toBe(mcpRefreshTokenLifetimeSeconds * 1_000);
  });

  it('rotates refresh credentials, revokes the family on reuse, and applies explicit revocation', async () => {
    const context = fixture();
    const first = await context.authorize('workspace:read projects:read');
    context.setNow('2027-01-02T00:01:00.000Z');
    const rotated = await context.service.refreshAccessToken({
      refreshToken: first.tokens.refresh_token, clientId: first.client.client_id,
      scope: 'workspace:read',
    });
    expect(rotated.refresh_token).not.toBe(first.tokens.refresh_token);
    expect((await context.service.authenticateAccessToken(rotated.access_token)).scopes).toEqual(['workspace:read']);
    await expect(context.service.refreshAccessToken({
      refreshToken: first.tokens.refresh_token, clientId: first.client.client_id, resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'OAUTH_INVALID_GRANT'});
    await expect(context.service.authenticateAccessToken(rotated.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});

    const separate = fixture();
    const live = await separate.authorize('workspace:read');
    await separate.service.revokeToken({token: live.tokens.access_token, clientId: live.client.client_id});
    await expect(separate.service.authenticateAccessToken(live.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
  });

  it('does not revive an old grant after membership reactivation or issue an unusable late access token', async () => {
    const reactivated = fixture();
    const old = await reactivated.authorize('workspace:read');
    reactivated.repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
      schemaVersion: 1,
      id: `mem_${ownerId}`,
      workspaceId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-02T00:02:00.000Z',
      removedAt: null,
      revision: 3,
    });
    const beforeReactivationProbe = reactivated.repository.snapshot();
    await expect(reactivated.service.authenticateAccessToken(old.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    expect(reactivated.repository.snapshot()).toEqual(beforeReactivationProbe);

    const late = fixture();
    const lateGrant = await late.authorize('workspace:read');
    late.setNow('2027-01-31T23:50:00.001Z');
    const beforeLateRefresh = late.repository.snapshot();
    await expect(late.service.refreshAccessToken({
      refreshToken: lateGrant.tokens.refresh_token,
      clientId: lateGrant.client.client_id,
      resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'OAUTH_INVALID_GRANT'});
    expect(late.repository.snapshot()).toEqual(beforeLateRefresh);

    const boundary = fixture();
    const boundaryGrant = await boundary.authorize('workspace:read');
    boundary.setNow('2027-01-31T23:50:00.000Z');
    const final = await boundary.service.refreshAccessToken({
      refreshToken: boundaryGrant.tokens.refresh_token,
      clientId: boundaryGrant.client.client_id,
      resource: `${origin}/mcp`,
    });
    expect((await boundary.service.authenticateAccessToken(final.access_token)).expiresAt)
      .toBe('2027-02-01T00:00:00.000Z');
  });

  it('fails closed for redirect/resource/PKCE mismatch, removal, expiry, and bound-record tamper', async () => {
    const context = fixture();
    const registration = await context.service.registerClient({
      clientName: 'Boundary client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    await expect(context.service.startAuthorization({
      responseType: 'code', clientId: registration.client_id,
      redirectUri: 'https://hostile.basiclinear.test/callback', workspaceId, scope: 'workspace:read',
      state: 'state-value-at-least-sixteen', codeChallenge: challenge, codeChallengeMethod: 'S256',
      resource: `${origin}/mcp`,
    })).rejects.toBeInstanceOf(McpOAuthServiceError);
    await expect(context.service.startAuthorization({
      responseType: 'code', clientId: registration.client_id,
      redirectUri: 'https://client.basiclinear.test:443/oauth/callback', workspaceId,
      scope: 'workspace:read', state: 'state-value-at-least-sixteen', codeChallenge: challenge,
      codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'INVALID_OAUTH_REQUEST'});
    await expect(context.service.startAuthorization({
      responseType: 'code', clientId: ` ${registration.client_id}`,
      redirectUri, workspaceId, scope: 'workspace:read', state: 'state-value-at-least-sixteen',
      codeChallenge: challenge, codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'INVALID_OAUTH_REQUEST'});
    const live = await context.authorize('workspace:read');
    context.repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
      schemaVersion: 1, id: `mem_${ownerId}`, workspaceId, userId: ownerId, role: 'owner', status: 'removed',
      createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-02T00:02:00.000Z',
      removedAt: '2027-01-02T00:02:00.000Z', revision: 2,
    });
    await expect(context.service.authenticateAccessToken(live.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});

    const expired = fixture();
    const expiredLive = await expired.authorize('workspace:read');
    expired.setNow('2027-01-02T00:10:00.000Z');
    await expect(expired.service.authenticateAccessToken(expiredLive.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});

    const tampered = fixture();
    const tamperedLive = await tampered.authorize('workspace:read');
    const accessEntry = Object.entries(tampered.repository.snapshot()).find(([path]) => path.startsWith('oauthAccessTokens/'));
    expect(accessEntry).toBeDefined();
    tampered.repository.seedDocument(accessEntry?.[0] ?? '', {
      ...(accessEntry?.[1] as Record<string, unknown>), workspaceId: 'ws_foreign',
    });
    const before = tampered.repository.snapshot();
    await expect(tampered.service.authenticateAccessToken(tamperedLive.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    expect(tampered.repository.snapshot()).toEqual(before);
  });

  it('canonicalizes registration and fails closed on consent/code replay or refresh scope expansion', async () => {
    const context = fixture();
    const registered = await context.service.registerClient({
      clientName: 'Canonical client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['refresh_token', 'authorization_code'], responseTypes: ['code'],
      scope: 'workspace:read issues:write issues:read',
    });
    expect(registered.grant_types).toEqual(['authorization_code', 'refresh_token']);
    expect(registered.scope).toBe('issues:read issues:write workspace:read');

    const live = await context.authorize('workspace:read projects:read');
    const code = new URL(live.consent.redirectUri).searchParams.get('code') as string;
    const beforeCodeReplay = context.repository.snapshot();
    await expect(context.service.exchangeAuthorizationCode({
      code, clientId: live.client.client_id, redirectUri, codeVerifier: verifier,
      resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'OAUTH_INVALID_GRANT'});
    expect(context.repository.snapshot()).toEqual(beforeCodeReplay);
    await expect(context.service.decideConsent({
      requestId: live.started.requestId, identity: {uid: ownerId}, decision: 'deny',
      requestReference: 'opposite_consent_replay',
    })).rejects.toMatchObject({code: 'OAUTH_ACCESS_DENIED'});
    expect(context.repository.snapshot()).toEqual(beforeCodeReplay);
    await expect(context.service.decideConsent({
      requestId: live.started.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'used_code_consent_replay',
    })).rejects.toMatchObject({code: 'OAUTH_ACCESS_DENIED'});
    expect(context.repository.snapshot()).toEqual(beforeCodeReplay);

    const expiring = fixture();
    const expiringClient = await expiring.service.registerClient({
      clientName: 'Expiring consent client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    const expiringRequest = await expiring.service.startAuthorization({
      responseType: 'code', clientId: expiringClient.client_id, redirectUri, workspaceId,
      scope: 'workspace:read', state: 'expiring-state-at-least-sixteen', codeChallenge: challenge,
      codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    });
    const firstApproval = await expiring.service.decideConsent({
      requestId: expiringRequest.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'expiring_consent_approval',
    });
    expiring.setNow('2027-01-02T00:04:59.999Z');
    expect(await expiring.service.decideConsent({
      requestId: expiringRequest.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'live_code_consent_replay',
    })).toEqual(firstApproval);
    const beforeExpiredReplay = expiring.repository.snapshot();
    expiring.setNow('2027-01-02T00:05:00.000Z');
    await expect(expiring.service.decideConsent({
      requestId: expiringRequest.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'exact_expiry_consent_replay',
    })).rejects.toMatchObject({code: 'OAUTH_ACCESS_DENIED'});
    expiring.setNow('2027-01-02T00:05:00.001Z');
    await expect(expiring.service.decideConsent({
      requestId: expiringRequest.requestId, identity: {uid: ownerId}, decision: 'approve',
      requestReference: 'after_expiry_consent_replay',
    })).rejects.toMatchObject({code: 'OAUTH_ACCESS_DENIED'});
    expect(expiring.repository.snapshot()).toEqual(beforeExpiredReplay);

    const corruptedCode = fixture();
    const corruptedCodeLive = await corruptedCode.authorize('workspace:read');
    const codeEntry = Object.entries(corruptedCode.repository.snapshot())
      .find(([path]) => path.startsWith('oauthAuthorizationCodes/'));
    expect(codeEntry).toBeDefined();
    corruptedCode.repository.seedDocument(codeEntry?.[0] ?? '', {
      ...(codeEntry?.[1] as Record<string, unknown>),
      workspaceId: 'ws_foreign',
    });
    const beforeCorruptedReplay = corruptedCode.repository.snapshot();
    await expect(corruptedCode.service.decideConsent({
      requestId: corruptedCodeLive.started.requestId,
      identity: {uid: ownerId},
      decision: 'approve',
      requestReference: 'corrupted_code_consent_replay',
    })).rejects.toMatchObject({code: 'OAUTH_SERVICE_UNAVAILABLE'});
    expect(corruptedCode.repository.snapshot()).toEqual(beforeCorruptedReplay);

    context.setNow('2027-01-02T00:01:00.000Z');
    const narrowed = await context.service.refreshAccessToken({
      refreshToken: live.tokens.refresh_token,
      clientId: live.client.client_id,
      resource: `${origin}/mcp`,
      scope: 'workspace:read',
    });
    const beforeExpansion = context.repository.snapshot();
    context.setNow('2027-01-02T00:02:00.000Z');
    await expect(context.service.refreshAccessToken({
      refreshToken: narrowed.refresh_token,
      clientId: live.client.client_id,
      resource: `${origin}/mcp`,
      scope: 'workspace:read projects:read',
    })).rejects.toMatchObject({code: 'OAUTH_INVALID_GRANT'});
    expect(context.repository.snapshot()).toEqual(beforeExpansion);
    expect((await context.service.authenticateAccessToken(narrowed.access_token)).scopes)
      .toEqual(['workspace:read']);
  });

  it('rejects clock regression and every current token dependency without mutation or disclosure', async () => {
    const regressed = fixture();
    const live = await regressed.authorize('workspace:read');
    regressed.setNow('2027-01-01T23:59:59.000Z');
    const beforeRegression = regressed.repository.snapshot();
    await expect(regressed.service.authenticateAccessToken(live.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    await expect(regressed.service.refreshAccessToken({
      refreshToken: live.tokens.refresh_token,
      clientId: live.client.client_id,
      resource: `${origin}/mcp`,
    })).rejects.toMatchObject({code: 'OAUTH_SERVICE_UNAVAILABLE'});
    await expect(regressed.service.revokeToken({
      token: live.tokens.access_token,
      clientId: live.client.client_id,
    })).rejects.toMatchObject({code: 'OAUTH_SERVICE_UNAVAILABLE'});
    expect(regressed.repository.snapshot()).toEqual(beforeRegression);

    const futureMembership = fixture();
    const futureMembershipLive = await futureMembership.authorize('workspace:read');
    futureMembership.repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
      schemaVersion: 1,
      id: `mem_${ownerId}`,
      workspaceId,
      userId: ownerId,
      role: 'owner',
      status: 'active',
      createdAt: '2027-01-01T00:00:00.000Z',
      updatedAt: '2027-01-02T00:00:01.000Z',
      removedAt: null,
      revision: 1,
    });
    const beforeFutureMembership = futureMembership.repository.snapshot();
    await expect(futureMembership.service.authenticateAccessToken(futureMembershipLive.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    expect(futureMembership.repository.snapshot()).toEqual(beforeFutureMembership);

    const futureWorkspace = fixture();
    const futureWorkspaceLive = await futureWorkspace.authorize('workspace:read');
    futureWorkspace.repository.seedDocument(`workspaces/${workspaceId}`, {
      schemaVersion: 1,
      id: workspaceId,
      workspaceId,
      name: 'MCP OAuth workspace',
      ownerUid: ownerId,
      authority: 'firebase-hosted',
      createdAt: '2027-01-02T00:00:01.000Z',
      revision: 1,
    });
    const beforeFutureWorkspace = futureWorkspace.repository.snapshot();
    await expect(futureWorkspace.service.authenticateAccessToken(futureWorkspaceLive.tokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    expect(futureWorkspace.repository.snapshot()).toEqual(beforeFutureWorkspace);

    for (const prefix of [
      'oauthClients/', 'oauthGrants/', 'oauthTokenFamilies/', 'oauthRefreshTokens/',
    ]) {
      const corrupted = fixture();
      const corruptedLive = await corrupted.authorize('workspace:read');
      const entry = Object.entries(corrupted.repository.snapshot())
        .find(([path]) => path.startsWith(prefix));
      expect(entry, prefix).toBeDefined();
      corrupted.repository.seedDocument(entry?.[0] ?? '', {
        ...(entry?.[1] as Record<string, unknown>),
        revision: 99,
      });
      const before = corrupted.repository.snapshot();
      await expect(corrupted.service.authenticateAccessToken(corruptedLive.tokens.access_token))
        .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
      expect(corrupted.repository.snapshot()).toEqual(before);
      expect(JSON.stringify(before)).not.toContain(corruptedLive.tokens.access_token);
      expect(JSON.stringify(before)).not.toContain(corruptedLive.tokens.refresh_token);
    }
  });

  it('enforces owner/member scope policy before consent or credential issuance', async () => {
    const context = fixture();
    context.memberships.set({
      schemaVersion: 1, workspaceId, userId: memberId, role: 'member', status: 'active', revision: 1,
    });
    context.repository.seedDocument(`workspaces/${workspaceId}/memberships/${memberId}`, {
      schemaVersion: 1,
      id: `mem_${memberId}`,
      workspaceId,
      userId: memberId,
      role: 'member',
      status: 'active',
      createdAt: '2027-01-01T00:00:00.000Z',
      revision: 1,
    });
    const client = await context.service.registerClient({
      clientName: 'Member client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    const ownerOnly = await context.service.startAuthorization({
      responseType: 'code', clientId: client.client_id, redirectUri, workspaceId,
      scope: 'billing:read', state: 'member-owner-scope-state', codeChallenge: challenge,
      codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    });
    const beforeDeniedConsent = context.repository.snapshot();
    await expect(context.service.consentView(
      ownerOnly.requestId,
      {uid: memberId},
      'member_owner_scope_consent',
    )).rejects.toMatchObject({code: 'OAUTH_SCOPE_DENIED'});
    expect(context.repository.snapshot()).toEqual(beforeDeniedConsent);

    const memberAllowed = await context.service.startAuthorization({
      responseType: 'code', clientId: client.client_id, redirectUri, workspaceId,
      scope: 'issues:read issues:write comments:read comments:write',
      state: 'member-allowed-scope-state', codeChallenge: challenge,
      codeChallengeMethod: 'S256', resource: `${origin}/mcp`,
    });
    const approved = await context.service.decideConsent({
      requestId: memberAllowed.requestId,
      identity: {uid: memberId},
      decision: 'approve',
      requestReference: 'member_allowed_consent',
    });
    const tokens = await context.service.exchangeAuthorizationCode({
      code: new URL(approved.redirectUri).searchParams.get('code') as string,
      clientId: client.client_id,
      redirectUri,
      codeVerifier: verifier,
      resource: `${origin}/mcp`,
    });
    expect(await context.service.authenticateAccessToken(tokens.access_token)).toMatchObject({
      principal: {userId: memberId, source: 'mcp'},
      role: 'member',
      scopes: ['comments:read', 'comments:write', 'issues:read', 'issues:write'],
    });
  });
});
