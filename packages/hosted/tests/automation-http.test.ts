import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  CollaborationService,
  createHostedHttpHandler,
  createMcpHttpHandler,
  createRestApiHandler,
  InvitationService,
  MemoryCollaborationRepository,
  MemoryInvitationRepository,
  MemoryOwnerBootstrapRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  McpOAuthService,
  OwnerBootstrapService,
  PersonalTokenService,
  ProjectManagementService,
  WorkspaceAuthorizationService,
  mcpProtocolVersion,
  type BillingService,
  type VerifiedGoogleIdentity,
} from '../src/index.js';
import { hostedOperationsForHttpTests } from './fixtures/operations.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_automation_http';
const owner: VerifiedGoogleIdentity = {
  uid: 'owner_automation_http', email: 'owner@example.com', emailVerified: true,
  displayName: 'Owner', provider: 'google.com',
};

interface TestResponse {status: number; headers: Record<string, string>; body: unknown}

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  memberships.set({
    schemaVersion: 1, workspaceId, userId: owner.uid, role: 'owner', status: 'active', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1, id: workspaceId, workspaceId, name: 'Automation HTTP',
    ownerUid: owner.uid, authority: 'firebase-hosted', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${owner.uid}`, {
    schemaVersion: 1, id: `mem_${owner.uid}`, workspaceId, userId: owner.uid,
    role: 'owner', status: 'active', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    {clock: () => new Date('2027-01-02T00:00:00.000Z'), idFactory},
  );
  const tokenService = new PersonalTokenService(repository, authorization, {
    secret: 'automation-http-token-secret-at-least-32-bytes',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => new Date('2027-01-02T00:00:00.000Z'),
    idFactory,
    randomSecret: () => new Uint8Array(32).fill(19),
  });
  const pmService = new ProjectManagementService(repository, authorization, {
    secret: 'automation-http-pm-secret-at-least-32-bytes',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => new Date('2027-01-02T00:00:00.000Z'),
    idFactory,
  });
  const collaborationService = new CollaborationService(repository, authorization, {
    secret: 'automation-http-collaboration-secret-at-least-32',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => new Date('2027-01-02T00:00:00.000Z'),
    idFactory,
  });
  const invitationService = new InvitationService(
    new MemoryInvitationRepository(),
    authorization,
    {
      secret: 'automation-http-invitation-secret-at-least-32',
      entitlementPolicy: proEntitlementPolicyForTests,
      seatReconciler: noopBillingSeatReconcilerForTests,
    },
  );
  const restApiHandler = createRestApiHandler({
    personalTokenService: tokenService,
    projectManagementService: pmService,
    collaborationService,
    invitationService,
    billingService: {} as unknown as BillingService,
    cursorSecret: 'automation-http-cursor-secret-at-least-32-bytes',
  });
  const verifyGoogleIdToken = vi.fn(async (token: string) => {
    if (token === 'owner-google-token-automation-http') return owner;
    throw new Error('invalid');
  });
  const mcpOAuthService = new McpOAuthService(repository, authorization, {
    secret: 'automation-http-mcp-oauth-secret-at-least-32',
    publicOrigin: 'https://basiclinear.test',
    clock: () => new Date('2027-01-02T00:00:00.000Z'),
    idFactory,
    randomSecret: () => new Uint8Array(32).fill(23),
  });
  const mcpHttpHandler = createMcpHttpHandler({
    oauthService: mcpOAuthService,
    identityVerifier: {verifyGoogleIdToken},
    projectManagementService: pmService,
    collaborationService,
    invitationService,
    billingService: {} as unknown as BillingService,
  });
  const handler = createHostedHttpHandler({
    ...hostedOperationsForHttpTests(() => new Date('2026-10-10T00:00:00.000Z')),
    identityVerifier: {verifyGoogleIdToken},
    bootstrapService: new OwnerBootstrapService(new MemoryOwnerBootstrapRepository()),
    workspaceAuthorizationService: authorization,
    invitationService,
    collaborationService,
    personalTokenService: tokenService,
    projectManagementService: pmService,
    restApiHandler,
    mcpHttpHandler,
    allowedOrigins: ['https://basiclinear.test'],
  });
  const invoke = async (
    method: string,
    path: string,
    headers: IncomingHttpHeaders = {},
    body = '',
  ): Promise<TestResponse> => {
    const normalizedHeaders: IncomingHttpHeaders = {host: 'basiclinear.test', ...headers};
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    const headerEntries = Object.entries(normalizedHeaders).flatMap(([name, raw]) => (
      (Array.isArray(raw) ? raw : [raw]).flatMap((value) => (
        value === undefined ? [] : [[name, String(value)] as const]
      ))
    ));
    Object.assign(request, {
      method,
      url: path,
      headers: normalizedHeaders,
      headersDistinct: Object.fromEntries(Object.entries(normalizedHeaders).map(([name, raw]) => [
        name.toLowerCase(), (Array.isArray(raw) ? raw : [raw]).filter((value) => value !== undefined).map(String),
      ])),
      rawHeaders: headerEntries.flat(),
    });
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let payload = '';
    const response = {
      writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
        status = nextStatus; responseHeaders = nextHeaders; return response;
      },
      end(value?: string) { payload = value ?? ''; return response; },
    } as unknown as ServerResponse;
    await handler(request, response);
    return {status, headers: responseHeaders, body: payload === '' ? null : JSON.parse(payload)};
  };
  return {repository, verifyGoogleIdToken, invoke};
}

const browserHeaders = (key?: string): IncomingHttpHeaders => ({
  authorization: 'Bearer owner-google-token-automation-http',
  origin: 'https://basiclinear.test',
  'content-type': 'application/json',
  ...(key === undefined ? {} : {'idempotency-key': key}),
});

describe('hosted automation HTTP integration', () => {
  it('operates projects, milestones, and placed issues from the signed-in browser workspace', async () => {
    const context = fixture();
    const createdProject = await context.invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/projects`,
      browserHeaders('browser-project-create-key-0001'),
      JSON.stringify({name: 'Production launch', summary: 'Ship the real workspace', status: 'in_progress'}),
    );
    expect(createdProject.status).toBe(201);
    const project = (createdProject.body as {data: {project: {id: string; revision: number}}}).data.project;

    const createdMilestone = await context.invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/projects/${project.id}/milestones`,
      browserHeaders('browser-milestone-create-key-0001'),
      JSON.stringify({name: 'Launch ready', description: 'Core workflows verified', targetDate: '2027-01-31'}),
    );
    expect(createdMilestone.status).toBe(201);
    const milestone = (createdMilestone.body as {data: {milestone: {id: string; revision: number}}}).data.milestone;

    const createdIssue = await context.invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/issues`,
      browserHeaders('browser-placed-issue-key-0001'),
      JSON.stringify({title: 'Verify the workspace', projectId: project.id, milestoneId: milestone.id}),
    );
    expect(createdIssue.status).toBe(201);
    expect(createdIssue.body).toMatchObject({data: {issue: {
      projectId: project.id,
      milestoneId: milestone.id,
    }}});

    const updatedProject = await context.invoke(
      'PATCH', `/api/v1/hosted/workspaces/${workspaceId}/projects/${project.id}`,
      browserHeaders('browser-project-update-key-0001'),
      JSON.stringify({expectedRevision: project.revision, summary: 'Launch workflows are ready for people'}),
    );
    expect(updatedProject.status).toBe(200);

    const updatedMilestone = await context.invoke(
      'PATCH', `/api/v1/hosted/workspaces/${workspaceId}/milestones/${milestone.id}`,
      browserHeaders('browser-milestone-update-key-0001'),
      JSON.stringify({expectedRevision: milestone.revision, targetDate: '2027-02-07'}),
    );
    expect(updatedMilestone.status).toBe(200);

    const [projects, milestones] = await Promise.all([
      context.invoke('GET', `/api/v1/hosted/workspaces/${workspaceId}/projects`, browserHeaders()),
      context.invoke('GET', `/api/v1/hosted/workspaces/${workspaceId}/projects/${project.id}/milestones`, browserHeaders()),
    ]);
    expect(projects.status).toBe(200);
    expect(projects.body).toMatchObject({data: {projects: [{id: project.id, revision: 2}]}});
    expect(milestones.status).toBe(200);
    expect(milestones.body).toMatchObject({data: {milestones: [{id: milestone.id, revision: 2}]}});
  });

  it('creates one-time credentials in the browser, operates REST, exports, and revokes immediately', async () => {
    const context = fixture();
    const created = await context.invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/tokens`,
      browserHeaders('automation-http-token-create-key-0001'),
      JSON.stringify({
        name: 'REST product manager',
        scopes: ['projects:read', 'projects:write', 'workspace:export'],
        expiresInDays: 30,
      }),
    );
    expect(created.status).toBe(201);
    const credential = (created.body as {data: {rawToken: string; token: {id: string}}}).data;
    expect(credential.rawToken).toMatch(/^ol_pat_v1\./u);

    const listed = await context.invoke(
      'GET', `/api/v1/hosted/workspaces/${workspaceId}/tokens`, browserHeaders(),
    );
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain(credential.rawToken);

    const apiHeaders = {
      authorization: `Bearer ${credential.rawToken}`,
      origin: 'https://basiclinear.test',
      'content-type': 'application/json',
      'idempotency-key': 'automation-http-project-key-0001',
    };
    const project = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`, apiHeaders,
      JSON.stringify({name: 'API-operated product'}),
    );
    expect(project.status).toBe(201);
    expect(project.headers.etag).toBe('"rev-1"');

    const exported = await context.invoke(
      'GET', `/api/v1/hosted/workspaces/${workspaceId}/export`, browserHeaders(),
    );
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type'])
      .toBe('application/vnd.basiclinear.workspace-export+json;version=1');
    expect(exported.headers['x-basiclinear-export-sha256']).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(exported.body)).not.toContain(credential.rawToken);

    const revoked = await context.invoke(
      'DELETE', `/api/v1/hosted/workspaces/${workspaceId}/tokens/${credential.token.id}`,
      browserHeaders('automation-http-token-revoke-key-0001'), '{}',
    );
    expect(revoked.status).toBe(200);
    const denied = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects`, {
        authorization: `Bearer ${credential.rawToken}`, origin: 'https://basiclinear.test',
      },
    );
    expect(denied.status).toBe(401);
    expect(JSON.stringify(context.repository.snapshot())).not.toContain(credential.rawToken);
  });

  it('rejects a hostile browser origin before identity or token processing', async () => {
    const context = fixture();
    const response = await context.invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/tokens`,
      {...browserHeaders('hostile-origin-key-0001'), origin: 'https://hostile.example'},
      JSON.stringify({name: 'Should not parse', scopes: ['workspace:read'], expiresInDays: 30}),
    );
    expect(response.status).toBe(403);
    expect(context.verifyGoogleIdToken).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('delegates the stateless MCP profile only after exact Origin validation', async () => {
    const context = fixture();
    const body = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'server/discover',
      params: {_meta: {
        'io.modelcontextprotocol/protocolVersion': mcpProtocolVersion,
        'io.modelcontextprotocol/clientInfo': {name: 'Hosted integration', version: '1.0.0'},
        'io.modelcontextprotocol/clientCapabilities': {},
      }},
    });
    const headers = {
      origin: 'https://basiclinear.test',
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      'mcp-protocol-version': mcpProtocolVersion,
      'mcp-method': 'server/discover',
    };
    const valid = await context.invoke('POST', '/mcp', headers, body);
    expect(valid.status).toBe(200);
    expect(valid.body).toMatchObject({result: {supportedVersions: [mcpProtocolVersion]}});
    const before = context.repository.snapshot();
    const hostile = await context.invoke('POST', '/mcp', {
      ...headers, origin: 'https://hostile.example',
    }, body);
    expect(hostile.status).toBe(403);
    expect(context.repository.snapshot()).toEqual(before);
    expect(context.verifyGoogleIdToken).not.toHaveBeenCalled();
  });
});
