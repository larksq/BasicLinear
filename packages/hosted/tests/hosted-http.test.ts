import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  createHostedHttpHandler,
  InvitationService,
  MemoryInvitationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  MemoryOwnerBootstrapRepository,
  OwnerBootstrapService,
  WorkspaceAuthorizationService,
  type OwnerBootstrapRepository,
  type InvitationRepository,
  type VerifiedGoogleIdentity,
  type WorkspaceAuthorizationEvidenceWriter,
  type WorkspaceMembershipReader,
} from '../src/index.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';
import { hostedOperationsForHttpTests } from './fixtures/operations.js';

const identity: VerifiedGoogleIdentity = {
  uid: 'firebase-owner-http',
  email: 'owner@example.com',
  emailVerified: true,
  displayName: 'HTTP Owner',
  provider: 'google.com',
};

interface TestHttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function createFixture(
  repository: OwnerBootstrapRepository = new MemoryOwnerBootstrapRepository(),
  allowedOrigins: readonly string[] = [],
  authorization: {
    memberships?: WorkspaceMembershipReader;
    evidence?: WorkspaceAuthorizationEvidenceWriter;
  } = {},
  invitation: {
    repository?: InvitationRepository;
    identities?: Readonly<Record<string, VerifiedGoogleIdentity>>;
  } = {},
) {
  const memberships = authorization.memberships ?? new MemoryWorkspaceMembershipReader();
  const evidence = authorization.evidence ?? new MemoryWorkspaceAuthorizationEvidenceWriter();
  const workspaceAuthorizationService = new WorkspaceAuthorizationService(memberships, evidence, {
    clock: () => new Date('2026-12-01T00:00:00.000Z'),
    idFactory: (() => {
      let value = 100;
      return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
    })(),
  });
  const handler = createHostedHttpHandler({
    identityVerifier: {
      verifyGoogleIdToken: async (token) => {
        const resolved = invitation.identities?.[token]
          ?? (token === 'verified-google-token-123456789' ? identity : undefined);
        if (resolved === undefined) throw new Error('invalid token');
        return resolved;
      },
    },
    bootstrapService: new OwnerBootstrapService(repository, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: (() => {
        let value = 0;
        return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
      })(),
    }),
    workspaceAuthorizationService,
    invitationService: new InvitationService(
      invitation.repository ?? new MemoryInvitationRepository(),
      workspaceAuthorizationService,
      {
        secret: 'hosted-http-invitation-secret-value-0000000000000001',
        entitlementPolicy: proEntitlementPolicyForTests,
        seatReconciler: noopBillingSeatReconcilerForTests,
        clock: () => new Date('2026-12-01T00:00:00.000Z'),
        idFactory: (() => {
          let value = 200;
          return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
        })(),
      },
    ),
    allowedOrigins,
    ...hostedOperationsForHttpTests(() => new Date('2026-12-01T00:00:00.000Z')),
  });
  return async (
    method: string,
    path: string,
    headers: IncomingHttpHeaders = {},
    body = '',
  ): Promise<TestHttpResponse> => {
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    Object.assign(request, { method, url: path, headers: { host: 'openlinear.test', ...headers } });
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let payload = '';
    const response = {
      writeHead: (nextStatus: number, nextHeaders: Record<string, string>) => {
        status = nextStatus;
        responseHeaders = nextHeaders;
        return response;
      },
      end: (value?: string) => {
        payload = value ?? '';
        return response;
      },
    } as unknown as ServerResponse;
    await handler(request, response);
    return { status, headers: responseHeaders, body: payload === '' ? null : JSON.parse(payload) };
  };
}

const bootstrapHeaders = (key: string) => ({
  authorization: 'Bearer verified-google-token-123456789',
  'content-type': 'application/json',
  'idempotency-key': key,
});

function seedInvitationHttpRepository(repository: MemoryInvitationRepository): void {
  repository.seedDocument(`hostedUsers/${identity.uid}`, {
    schemaVersion: 1,
    uid: identity.uid,
    email: identity.email,
    displayName: identity.displayName,
    authProvider: 'google.com',
    updatedAt: '2026-12-01T00:00:00.000Z',
  });
  repository.seedDocument('workspaces/ws_http_invites', {
    schemaVersion: 1,
    id: 'ws_http_invites',
    workspaceId: 'ws_http_invites',
    name: 'HTTP invitation workspace',
    ownerUid: identity.uid,
    authority: 'firebase-hosted',
    createdAt: '2026-11-15T00:00:00.000Z',
    revision: 1,
  });
  repository.seedDocument('workspaces/ws_http_invites/entitlements/current', {
    schemaVersion: 1,
    id: 'trial_http_invites',
    workspaceId: 'ws_http_invites',
    plan: 'pro',
    status: 'active',
    trialStartedAt: '2026-11-15T00:00:00.000Z',
    trialEndsAt: '2026-12-15T00:00:00.000Z',
    source: 'owner_bootstrap',
    revision: 1,
  });
  repository.seedDocument(`workspaces/ws_http_invites/memberships/${identity.uid}`, {
    schemaVersion: 1,
    id: 'mem_http_invite_owner',
    workspaceId: 'ws_http_invites',
    userId: identity.uid,
    role: 'owner',
    status: 'active',
    createdAt: '2026-11-15T00:00:00.000Z',
    revision: 1,
  });
}

describe('hosted HTTP foundation', () => {
  it('returns one safe bootstrap result across retried tabs', async () => {
    const invoke = createFixture();
    const first = await invoke('POST', '/api/v1/hosted/bootstrap', bootstrapHeaders('browser-tab-one-key-0001'), '{}');
    const second = await invoke('POST', '/api/v1/hosted/bootstrap', bootstrapHeaders('browser-tab-two-key-0002'), '{}');
    const firstBody = first.body as {data: {created: boolean; workspace: {id: string}; trial: {durationDays: number}}};
    const secondBody = second.body as typeof firstBody;

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(firstBody.data.created).toBe(true);
    expect(secondBody.data.created).toBe(false);
    expect(secondBody.data.workspace.id).toBe(firstBody.data.workspace.id);
    expect(firstBody.data.trial.durationDays).toBe(30);
    expect(JSON.stringify(firstBody)).not.toContain('verified-google-token');
    expect(JSON.stringify(firstBody)).not.toContain('browser-tab-one-key');
  });

  it('fails closed for missing credentials and cross-origin browser requests', async () => {
    const invoke = createFixture();
    const missing = await invoke('POST', '/api/v1/hosted/bootstrap', { 'idempotency-key': 'browser-missing-auth-0001' }, '{}');
    const hostile = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-hostile-origin-0001'),
      origin: 'https://hostile.example',
    }, '{}');
    expect(missing.status).toBe(401);
    expect(missing.body).toMatchObject({ error: { code: 'AUTHENTICATION_REQUIRED' } });
    expect(hostile.status).toBe(403);
    expect(hostile.body).toMatchObject({ error: { code: 'ORIGIN_NOT_ALLOWED' } });
  });

  it('requires an exact deployment-owned browser origin and ignores forwarded host claims', async () => {
    const invoke = createFixture(
      new MemoryOwnerBootstrapRepository(),
      ['https://openlinear.test'],
    );
    const allowed = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-exact-origin-0001'),
      origin: 'https://openlinear.test',
    }, '{}');
    const downgraded = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-downgraded-origin-0001'),
      origin: 'http://openlinear.test',
    }, '{}');
    const spoofed = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-forwarded-spoof-0001'),
      origin: 'https://hostile.example',
      'x-forwarded-host': 'hostile.example, openlinear.test',
    }, '{}');
    const directIngress = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-direct-ingress-0001'),
      host: 'openlinear-hosted-api-xyz.a.run.app',
      origin: 'https://openlinear-hosted-api-xyz.a.run.app',
      'x-forwarded-host': 'openlinear-hosted-api-xyz.a.run.app',
    }, '{}');
    const duplicateOrigin = await invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders('browser-duplicate-origin-0001'),
      origin: ['https://openlinear.test', 'https://hostile.example'],
    }, '{}');
    const malformedOrigins = await Promise.all([
      'https://openlinear.test/forged',
      'https://user:pass@openlinear.test',
      'https://openlinear.test?x=1',
      'https://openlinear.test#x',
    ].map((origin, index) => invoke('POST', '/api/v1/hosted/bootstrap', {
      ...bootstrapHeaders(`browser-noncanonical-origin-${index + 1}-0001`),
      origin,
    }, '{}')));

    expect(allowed.status).toBe(201);
    for (const response of [
      downgraded,
      spoofed,
      directIngress,
      duplicateOrigin,
      ...malformedOrigins,
    ]) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: { code: 'ORIGIN_NOT_ALLOWED' } });
    }
  });

  it('exposes only the health check and bounded bootstrap route', async () => {
    const invoke = createFixture();
    const ready = await invoke('GET', '/health/ready');
    const localSession = await invoke('POST', '/api/v1/local-owner-session');
    const wrongMethod = await invoke('GET', '/api/v1/hosted/bootstrap');
    expect(ready.body).toEqual({ status: 'ready', authority: 'firebase-hosted' });
    expect(localSession.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.allow).toBe('POST');
  });

  it('classifies a trusted-store failure as a redacted server error', async () => {
    const invoke = createFixture({
      bootstrapOnce: async () => { throw new Error('private firestore detail'); },
    });
    const response = await invoke(
      'POST',
      '/api/v1/hosted/bootstrap',
      bootstrapHeaders('browser-store-failure-0001'),
      '{}',
    );
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(JSON.stringify(response.body)).not.toContain('private firestore detail');
  });

  it('rejects injected or oversized bootstrap bodies before identity work', async () => {
    const invoke = createFixture();
    const injected = await invoke(
      'POST',
      '/api/v1/hosted/bootstrap',
      bootstrapHeaders('browser-injected-body-0001'),
      '{"trialDays":365}',
    );
    const oversized = await invoke(
      'POST',
      '/api/v1/hosted/bootstrap',
      { ...bootstrapHeaders('browser-large-body-0001'), 'content-length': '2048' },
      '{}',
    );
    expect(injected.status).toBe(400);
    expect(injected.body).toMatchObject({ error: { code: 'INVALID_REQUEST' } });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toMatchObject({ error: { code: 'REQUEST_TOO_LARGE' } });
  });

  it('returns only role-bounded workspace access for active owners and members', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({
      schemaVersion: 1,
      workspaceId: 'ws_http_owner',
      userId: identity.uid,
      role: 'owner',
      status: 'active',
      revision: 1,
    });
    memberships.set({
      schemaVersion: 1,
      workspaceId: 'ws_http_member',
      userId: identity.uid,
      role: 'member',
      status: 'active',
      revision: 1,
    });
    const invoke = createFixture(undefined, [], { memberships });
    const owner = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_owner/access',
      { authorization: bootstrapHeaders('unused-owner-key-0001').authorization },
    );
    const member = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_member/access',
      { authorization: bootstrapHeaders('unused-member-key-0001').authorization },
    );
    const ownerBody = owner.body as {data: {membership: {role: string}; capabilities: string[]}};
    const memberBody = member.body as typeof ownerBody;

    expect(owner.status).toBe(200);
    expect(member.status).toBe(200);
    expect(ownerBody.data.membership.role).toBe('owner');
    expect(ownerBody.data.capabilities).toContain('billing.manage');
    expect(memberBody.data.membership.role).toBe('member');
    expect(memberBody.data.capabilities).toContain('issue.write');
    expect(memberBody.data.capabilities).not.toContain('billing.manage');
    expect(JSON.stringify([owner.body, member.body])).not.toContain(identity.email);
  });

  it('makes removed, missing, and malformed memberships indistinguishable to callers', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({
      schemaVersion: 1,
      workspaceId: 'ws_http_removed',
      userId: identity.uid,
      role: 'member',
      status: 'removed',
      revision: 2,
    });
    memberships.setRaw('ws_http_custom', identity.uid, {
      schemaVersion: 1,
      workspaceId: 'ws_http_custom',
      userId: identity.uid,
      role: 'administrator',
      status: 'active',
      revision: 1,
    });
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const invoke = createFixture(undefined, [], { memberships, evidence });
    const headers = { authorization: bootstrapHeaders('unused-denial-key-0001').authorization };
    const responses = await Promise.all([
      invoke('GET', '/api/v1/hosted/workspaces/ws_http_removed/access', headers),
      invoke('GET', '/api/v1/hosted/workspaces/ws_http_missing/access', headers),
      invoke('GET', '/api/v1/hosted/workspaces/ws_http_custom/access', headers),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ error: {
        code: 'WORKSPACE_ACCESS_DENIED',
        message: 'The requested workspace resource is unavailable.',
      } });
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('membership_');
      expect(serialized).not.toContain('administrator');
      expect(serialized).not.toContain(identity.email);
    }
    expect(evidence.records.map((record) => record.denialReason).sort()).toEqual([
      'membership_inactive',
      'membership_invalid',
      'membership_missing',
    ]);
  });

  it('rechecks the same browser credential after removal and fails closed without evidence', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set({
      schemaVersion: 1,
      workspaceId: 'ws_http_freshness',
      userId: identity.uid,
      role: 'member',
      status: 'active',
      revision: 1,
    });
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const invoke = createFixture(undefined, [], { memberships, evidence });
    const headers = { authorization: bootstrapHeaders('unused-fresh-key-0001').authorization };
    const first = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_freshness/access',
      headers,
    );
    memberships.set({
      schemaVersion: 1,
      workspaceId: 'ws_http_freshness',
      userId: identity.uid,
      role: 'member',
      status: 'removed',
      revision: 2,
    });
    const removed = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_freshness/access',
      headers,
    );
    evidence.fail = true;
    const unavailable = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_freshness/access',
      headers,
    );
    const unauthenticated = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_freshness/access',
    );

    expect(first.status).toBe(200);
    expect(removed.status).toBe(403);
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toMatchObject({ error: { code: 'AUTHORIZATION_UNAVAILABLE' } });
    expect(unauthenticated.status).toBe(401);
    expect(memberships.reads).toBe(3);
    expect(evidence.records).toHaveLength(2);
  });

  it('returns a redacted availability response for a membership-store outage', async () => {
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const invoke = createFixture(undefined, [], {
      memberships: {
        readMembership: async () => { throw new Error('private Firestore outage detail'); },
      },
      evidence,
    });
    const response = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_outage/access',
      { authorization: bootstrapHeaders('unused-outage-key-0001').authorization },
    );

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: {
      code: 'AUTHORIZATION_UNAVAILABLE',
      message: 'Workspace authorization is temporarily unavailable.',
    } });
    expect(JSON.stringify(response.body)).not.toContain('private Firestore outage detail');
    expect(evidence.records).toHaveLength(1);
    expect(evidence.records[0]?.denialReason).toBe('membership_lookup_unavailable');
  });

  it('creates, lists, inspects, and accepts an email-bound fragment invitation', async () => {
    const repository = new MemoryInvitationRepository();
    seedInvitationHttpRepository(repository);
    const correctIdentity: VerifiedGoogleIdentity = {
      uid: 'firebase-member-http',
      email: 'member-http@example.com',
      emailVerified: true,
      displayName: 'HTTP Member',
      provider: 'google.com',
    };
    const wrongIdentity: VerifiedGoogleIdentity = {
      uid: 'firebase-wrong-http',
      email: 'wrong-http@example.com',
      emailVerified: true,
      displayName: 'Wrong HTTP Member',
      provider: 'google.com',
    };
    const invoke = createFixture(undefined, [], { memberships: repository }, {
      repository,
      identities: {
        'verified-member-google-token-123456789': correctIdentity,
        'verified-wrong-google-token-1234567890': wrongIdentity,
      },
    });
    const created = await invoke(
      'POST',
      '/api/v1/hosted/workspaces/ws_http_invites/invitations',
      bootstrapHeaders('http-invitation-create-0001'),
      JSON.stringify({ email: correctIdentity.email }),
    );
    const createdBody = created.body as {
      data: {invitation: {id: string; state: string}; inviteUrl: string};
    };
    expect(created.status).toBe(201);
    expect(createdBody.data.invitation.state).toBe('pending');
    expect(createdBody.data.inviteUrl).toMatch(/^\/hosted\.html#invite=inv_/u);
    expect(createdBody.data.inviteUrl).not.toContain('/api/');
    const token = decodeURIComponent(createdBody.data.inviteUrl.split('=')[1] as string);

    const listed = await invoke(
      'GET',
      '/api/v1/hosted/workspaces/ws_http_invites/invitations',
      { authorization: bootstrapHeaders('unused-list-key-0001').authorization },
    );
    expect(listed.status).toBe(200);
    expect(listed.body).toMatchObject({ data: { invitations: [{
      invitedEmail: correctIdentity.email,
      state: 'pending',
      role: 'member',
    }] } });

    const preview = await invoke(
      'POST',
      '/api/v1/hosted/invitations/inspect',
      { 'content-type': 'application/json' },
      JSON.stringify({ token }),
    );
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ data: {
      workspaceName: 'HTTP invitation workspace',
      invitedEmail: correctIdentity.email,
      state: 'pending',
      role: 'member',
    } });

    const wrong = await invoke(
      'POST',
      '/api/v1/hosted/invitations/accept',
      {
        authorization: 'Bearer verified-wrong-google-token-1234567890',
        'content-type': 'application/json',
        'idempotency-key': 'http-invitation-wrong-0001',
      },
      JSON.stringify({ token }),
    );
    expect(wrong.status).toBe(403);
    expect(wrong.body).toMatchObject({ error: { code: 'INVITATION_EMAIL_MISMATCH' } });
    expect(JSON.stringify(wrong.body)).not.toContain(correctIdentity.email);

    const accepted = await invoke(
      'POST',
      '/api/v1/hosted/invitations/accept',
      {
        authorization: 'Bearer verified-member-google-token-123456789',
        'content-type': 'application/json',
        'idempotency-key': 'http-invitation-accept-0001',
      },
      JSON.stringify({ token }),
    );
    const replay = await invoke(
      'POST',
      '/api/v1/hosted/invitations/accept',
      {
        authorization: 'Bearer verified-member-google-token-123456789',
        'content-type': 'application/json',
        'idempotency-key': 'http-invitation-accept-0001',
      },
      JSON.stringify({ token }),
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ data: {
      state: 'accepted',
      firstAcceptance: true,
      activeSeatAdded: true,
      membership: { role: 'member', status: 'active' },
    } });
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ data: { firstAcceptance: false, activeSeatAdded: false } });
    expect(repository.activeMembershipCount('ws_http_invites')).toBe(2);
  });

  it('rotates resend links, revokes the current link, and keeps secrets out of error bodies', async () => {
    const repository = new MemoryInvitationRepository();
    seedInvitationHttpRepository(repository);
    const invoke = createFixture(undefined, [], { memberships: repository }, { repository });
    const created = await invoke(
      'POST',
      '/api/v1/hosted/workspaces/ws_http_invites/invitations',
      bootstrapHeaders('http-invitation-lifecycle-create-0001'),
      JSON.stringify({ email: 'lifecycle@example.com' }),
    );
    const createdData = (created.body as {data: {invitation: {id: string}; inviteUrl: string}}).data;
    const firstToken = decodeURIComponent(createdData.inviteUrl.split('=')[1] as string);
    const resent = await invoke(
      'POST',
      `/api/v1/hosted/workspaces/ws_http_invites/invitations/${createdData.invitation.id}/resend`,
      bootstrapHeaders('http-invitation-lifecycle-resend-0001'),
      '{}',
    );
    const secondUrl = (resent.body as {data: {inviteUrl: string}}).data.inviteUrl;
    const secondToken = decodeURIComponent(secondUrl.split('=')[1] as string);
    expect(secondToken).not.toBe(firstToken);
    const oldPreview = await invoke(
      'POST',
      '/api/v1/hosted/invitations/inspect',
      { 'content-type': 'application/json' },
      JSON.stringify({ token: firstToken }),
    );
    expect(oldPreview.body).toMatchObject({ data: { state: 'superseded' } });

    const revoked = await invoke(
      'POST',
      `/api/v1/hosted/workspaces/ws_http_invites/invitations/${createdData.invitation.id}/revoke`,
      bootstrapHeaders('http-invitation-lifecycle-revoke-0001'),
      '{}',
    );
    expect(revoked.body).toMatchObject({ data: { invitation: { state: 'revoked' }, inviteUrl: null } });
    const revokedPreview = await invoke(
      'POST',
      '/api/v1/hosted/invitations/inspect',
      { 'content-type': 'application/json' },
      JSON.stringify({ token: secondToken }),
    );
    expect(revokedPreview.body).toMatchObject({ data: { state: 'revoked' } });
    const invalid = await invoke(
      'POST',
      '/api/v1/hosted/invitations/inspect',
      { 'content-type': 'application/json' },
      JSON.stringify({ token: 'inv_invalid' }),
    );
    expect(invalid.status).toBe(404);
    expect(JSON.stringify(invalid.body)).not.toContain('inv_invalid');
  });
});
