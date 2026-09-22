import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  CollaborationService,
  createRestApiHandler,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  basicLinearOpenApiDocument,
  PersonalTokenService,
  ProjectManagementService,
  WorkspaceAuthorizationService,
  type BillingService,
  type InvitationService,
  type PersonalTokenScope,
} from '../src/index.js';
import { proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_rest_contract';
const ownerId = 'owner_rest_contract';
const owner = {kind: 'user' as const, userId: ownerId, source: 'web' as const};

interface TestResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  const now = new Date('2027-01-02T00:00:00.000Z');
  memberships.set({
    schemaVersion: 1, workspaceId, userId: ownerId, role: 'owner', status: 'active', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1, id: workspaceId, workspaceId, name: 'REST contract workspace',
    ownerUid: ownerId, authority: 'firebase-hosted', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
    schemaVersion: 1, id: `mem_${ownerId}`, workspaceId, userId: ownerId,
    role: 'owner', status: 'active', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    {clock: () => now, idFactory},
  );
  const personalTokenService = new PersonalTokenService(repository, authorization, {
    secret: 'rest-token-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
    randomSecret: () => new Uint8Array(32).fill(sequence % 251),
  });
  const projectManagementService = new ProjectManagementService(repository, authorization, {
    secret: 'rest-pm-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  const collaborationService = new CollaborationService(repository, authorization, {
    secret: 'rest-collaboration-secret-at-least-32-bytes-long',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
  });
  const handler = createRestApiHandler({
    personalTokenService,
    projectManagementService,
    collaborationService,
    invitationService: {} as unknown as InvitationService,
    billingService: {} as unknown as BillingService,
    cursorSecret: 'rest-cursor-secret-at-least-32-bytes-long',
  });
  const createToken = async (scopes: readonly PersonalTokenScope[], key: string) => {
    const result = await personalTokenService.createToken({
      principal: owner, workspaceId, requestId: `request_${key}`, idempotencyKey: key,
      name: `Token ${key.slice(-4)}`, scopes, expiresInDays: 30,
    });
    return result.rawToken as string;
  };
  const invoke = async (
    method: string,
    path: string,
    headers: IncomingHttpHeaders = {},
    body = '',
  ): Promise<TestResponse> => {
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    Object.assign(request, {method, url: path, headers: {host: 'basiclinear.test', ...headers}});
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let payload = '';
    const response = {
      writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
        status = nextStatus;
        responseHeaders = nextHeaders;
        return response;
      },
      end(value?: string) {
        payload = value ?? '';
        return response;
      },
    } as unknown as ServerResponse;
    const handled = await handler(
      request,
      response,
      `request_rest_${sequence++}`,
      new URL(path, 'https://basiclinear.test'),
    );
    expect(handled).toBe(true);
    return {status, headers: responseHeaders, body: payload === '' ? null : JSON.parse(payload)};
  };
  return {repository, createToken, invoke};
}

const bearerHeaders = (rawToken: string, idempotencyKey?: string, revision?: number): IncomingHttpHeaders => ({
  authorization: `Bearer ${rawToken}`,
  'content-type': 'application/json',
  ...(idempotencyKey === undefined ? {} : {'idempotency-key': idempotencyKey}),
  ...(revision === undefined ? {} : {'if-match': `"rev-${revision}"`}),
});

describe('BasicLinear REST API v1', () => {
  it('publishes an exact OpenAPI 3.1.1 contract with no excluded product routes', () => {
    const document = basicLinearOpenApiDocument() as {
      openapi: string;
      paths: Record<string, Record<string, {responses?: Record<string, unknown>}>>;
      components: {
        schemas: Record<string, {additionalProperties?: boolean}>;
        responses: Record<string, unknown>;
      };
    };
    expect(document.openapi).toBe('3.1.1');
    expect(Object.keys(document.paths)).toEqual(expect.arrayContaining([
      '/workspaces/{workspaceId}/projects',
      '/workspaces/{workspaceId}/issues',
      '/workspaces/{workspaceId}/export',
    ]));
    expect(Object.keys(document.paths).join(' ')).not.toMatch(/agent|code-review|repository|pull-request/iu);
    for (const name of ['Issue', 'Comment', 'Member', 'Invitation', 'Billing', 'WorkspaceExportData']) {
      expect(document.components.schemas[name]?.additionalProperties).toBe(false);
    }
    expect(document.components.schemas.Issue).toMatchObject({
      properties: {number: {type: 'integer', minimum: 1}},
      required: expect.arrayContaining(['number']),
    });
    const knownReferences = new Set([
      ...Object.keys(document.components.schemas).map((name) => `#/components/schemas/${name}`),
      ...Object.keys(document.components.responses).map((name) => `#/components/responses/${name}`),
    ]);
    const references: string[] = [];
    const visit = (value: unknown): void => {
      if (value === null || typeof value !== 'object') return;
      if (Array.isArray(value)) return value.forEach(visit);
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (key === '$ref' && typeof nested === 'string') references.push(nested);
        else visit(nested);
      }
    };
    visit(document);
    expect(references.length).toBeGreaterThan(0);
    expect(references.filter((reference) => !knownReferences.has(reference))).toEqual([]);
    const invitationCreate = document.paths['/workspaces/{workspaceId}/invitations']?.post;
    expect(Object.keys(invitationCreate?.responses ?? {})).toEqual(expect.arrayContaining(['200', '201', '405']));
    const exportResponse = document.paths['/workspaces/{workspaceId}/export']?.get
      ?.responses?.['200'] as {content?: Record<string, unknown>} | undefined;
    expect(Object.keys(exportResponse?.content ?? {}))
      .toEqual(['application/vnd.basiclinear.workspace-export+json;version=1']);
  });

  it('enforces bearer scope, exact bodies, idempotency, and revision preconditions', async () => {
    const context = fixture();
    const token = await context.createToken(
      ['workspace:read', 'projects:read', 'projects:write', 'workspace:export'],
      'rest-full-token-key-0001',
    );
    const created = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      bearerHeaders(token, 'rest-project-create-key-0001'),
      JSON.stringify({name: 'API launch', summary: 'Contract evidence'}),
    );
    expect(created.status).toBe(201);
    expect(created.headers.etag).toBe('"rev-1"');
    const project = (created.body as {data: {project: {id: string; revision: number}}}).data.project;
    expect(Object.values(context.repository.snapshot())).toContainEqual(expect.objectContaining({
      action: 'project.create', source: 'rest', actor: expect.objectContaining({kind: 'personal_token'}),
      entity: expect.objectContaining({id: project.id, revisionAfter: 1}),
    }));

    const missingRevision = await context.invoke(
      'PATCH', `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
      bearerHeaders(token, 'rest-project-update-key-0001'),
      JSON.stringify({status: 'completed'}),
    );
    expect(missingRevision.status).toBe(428);
    const injected = await context.invoke(
      'PATCH', `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
      bearerHeaders(token, 'rest-project-injected-key-0001', 1),
      JSON.stringify({summary: 'private request value', agentPrompt: 'excluded'}),
    );
    expect(injected.status).toBe(400);
    expect(JSON.stringify(injected.body)).not.toContain('private request value');

    const updated = await context.invoke(
      'PATCH', `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
      bearerHeaders(token, 'rest-project-update-key-0002', 1),
      JSON.stringify({status: 'completed'}),
    );
    expect(updated.status).toBe(200);
    expect(updated.headers.etag).toBe('"rev-2"');

    const readOnly = await context.createToken(['workspace:read'], 'rest-read-token-key-0001');
    const denied = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects`, bearerHeaders(readOnly),
    );
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({error: {code: 'TOKEN_SCOPE_DENIED'}});
    const foreign = await context.invoke(
      'GET', '/api/v1/workspaces/ws_rest_foreign/projects', bearerHeaders(token),
    );
    expect(foreign.status).toBe(401);
    expect(JSON.stringify(foreign.body)).not.toContain(workspaceId);
  });

  it('rejects duplicate credentials, unsupported body media, and undeclared query parameters before mutation', async () => {
    const context = fixture();
    const token = await context.createToken(
      ['workspace:read', 'projects:read', 'projects:write', 'issues:write'],
      'rest-framing-token-key-0001',
    );
    const before = context.repository.snapshot();
    const wrongMedia = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      {...bearerHeaders(token, 'rest-wrong-media-key-0001'), 'content-type': 'text/plain'},
      JSON.stringify({name: 'Must not be created'}),
    );
    expect(wrongMedia.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);
    const missingMedia = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      {authorization: `Bearer ${token}`, 'idempotency-key': 'rest-missing-media-key-0001'},
      JSON.stringify({name: 'Must also not be created'}),
    );
    expect(missingMedia.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);

    const wrongPutMedia = await context.invoke(
      'PUT', `/api/v1/workspaces/${workspaceId}/issues/issue_${'a'.repeat(32)}/assignee`,
      {
        ...bearerHeaders(token, 'rest-wrong-put-media-key-0001', 1),
        'content-type': 'text/plain',
      },
      JSON.stringify({assigneeUserId: null}),
    );
    expect(wrongPutMedia.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);

    const duplicateIdempotency = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      {
        ...bearerHeaders(token),
        'idempotency-key': ['rest-duplicate-key-0001', 'rest-duplicate-key-0002'],
      },
      JSON.stringify({name: 'Must not be created'}),
    );
    expect(duplicateIdempotency.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);

    const duplicateRevision = await context.invoke(
      'PATCH', `/api/v1/workspaces/${workspaceId}/projects/project_${'b'.repeat(32)}`,
      {
        ...bearerHeaders(token, 'rest-duplicate-revision-key-0001'),
        'if-match': ['"rev-1"', '"rev-2"'],
      },
      JSON.stringify({status: 'completed'}),
    );
    expect(duplicateRevision.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);

    const malformedJson = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      bearerHeaders(token, 'rest-malformed-json-key-0001'),
      '{"name":',
    );
    expect(malformedJson.status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);

    const oversizedBody = JSON.stringify({name: 'A'.repeat(17_000)});
    const oversized = await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects`,
      {
        ...bearerHeaders(token, 'rest-oversized-body-key-0001'),
        'content-length': String(Buffer.byteLength(oversizedBody)),
      },
      oversizedBody,
    );
    expect(oversized.status).toBe(413);
    expect(context.repository.snapshot()).toEqual(before);

    const duplicateAuthorization = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}`,
      {authorization: [`Bearer ${token}`, 'Bearer invalid-second-credential']},
    );
    expect(duplicateAuthorization.status).toBe(401);

    expect((await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}?undeclared=1`, bearerHeaders(token),
    )).status).toBe(400);
    expect((await context.invoke(
      'POST', `/api/v1/workspaces/${workspaceId}/projects?limit=1`,
      bearerHeaders(token, 'rest-query-mutation-key-0001'), JSON.stringify({name: 'Must not exist'}),
    )).status).toBe(400);
    expect(context.repository.snapshot()).toEqual(before);
  });

  it('rejects every zero-byte required mutation body before token-use state changes', async () => {
    const context = fixture();
    const token = await context.createToken(
      ['workspace:read', 'projects:read', 'projects:write'],
      'rest-empty-body-token-key-0001',
    );
    const before = context.repository.snapshot();
    const projectId = `project_${'a'.repeat(32)}`;
    const milestoneId = `milestone_${'b'.repeat(32)}`;
    const issueId = `issue_${'c'.repeat(32)}`;
    const commentId = `comment_${'d'.repeat(32)}`;
    const invitationId = `invite_${'e'.repeat(32)}`;
    const cases = [
      ['POST', `/api/v1/workspaces/${workspaceId}/projects`, false],
      ['PATCH', `/api/v1/workspaces/${workspaceId}/projects/${projectId}`, true],
      ['POST', `/api/v1/workspaces/${workspaceId}/projects/${projectId}/milestones`, false],
      ['PATCH', `/api/v1/workspaces/${workspaceId}/milestones/${milestoneId}`, true],
      ['POST', `/api/v1/workspaces/${workspaceId}/issues`, false],
      ['PATCH', `/api/v1/workspaces/${workspaceId}/issues/${issueId}`, true],
      ['PUT', `/api/v1/workspaces/${workspaceId}/issues/${issueId}/assignee`, true],
      ['POST', `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments`, false],
      ['PATCH', `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}`, true],
      ['DELETE', `/api/v1/workspaces/${workspaceId}/issues/${issueId}/comments/${commentId}`, true],
      ['DELETE', `/api/v1/workspaces/${workspaceId}/members/${ownerId}`, false],
      ['POST', `/api/v1/workspaces/${workspaceId}/invitations`, false],
      ['POST', `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}/resend`, false],
    ] as const;

    for (const [index, [method, path, revisionRequired]] of cases.entries()) {
      const response = await context.invoke(method, path, {
        ...bearerHeaders(token, `rest-empty-body-key-${String(index + 1).padStart(4, '0')}`),
        'content-length': '0',
        ...(revisionRequired ? {'if-match': '"rev-1"'} : {}),
      });
      expect(response.status, `${method} ${path}`).toBe(400);
      expect(context.repository.snapshot(), `${method} ${path}`).toEqual(before);
    }
  });

  it('binds opaque cursors to the exact workspace, resource, and page size', async () => {
    const context = fixture();
    const token = await context.createToken(
      ['projects:read', 'projects:write', 'issues:read'],
      'rest-page-token-key-0001',
    );
    for (const [index, name] of ['Alpha', 'Beta', 'Gamma'].entries()) {
      const response = await context.invoke(
        'POST', `/api/v1/workspaces/${workspaceId}/projects`,
        bearerHeaders(token, `rest-page-create-key-000${index + 1}`),
        JSON.stringify({name}),
      );
      expect(response.status).toBe(201);
    }
    const first = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects?limit=1`, bearerHeaders(token),
    );
    const page = (first.body as {data: {items: unknown[]; nextCursor: string}}).data;
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/u);
    const second = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects?cursor=${encodeURIComponent(page.nextCursor)}`,
      bearerHeaders(token),
    );
    expect((second.body as {data: {items: unknown[]}}).data.items).toHaveLength(1);

    const tampered = `${page.nextCursor.slice(0, -1)}${page.nextCursor.endsWith('a') ? 'b' : 'a'}`;
    expect((await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects?cursor=${encodeURIComponent(tampered)}`,
      bearerHeaders(token),
    )).status).toBe(400);
    expect((await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/issues?cursor=${encodeURIComponent(page.nextCursor)}`,
      bearerHeaders(token),
    )).status).toBe(400);
    const duplicateLimit = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/projects?limit=1&limit=2`, bearerHeaders(token),
    );
    expect(duplicateLimit.status).toBe(400);
    expect(duplicateLimit.body).toMatchObject({error: {code: 'INVALID_CURSOR'}});
  });

  it('enumerates the 1,001st authorized record without a hidden service cap', async () => {
    const context = fixture();
    const token = await context.createToken(['projects:read'], 'rest-record-1001-token-key');
    for (let index = 1; index <= 1_001; index += 1) {
      const id = `project_${index.toString(16).padStart(32, '0')}`;
      context.repository.seedDocument(`workspaces/${workspaceId}/projects/${id}`, {
        schemaVersion: 1, id, workspaceId, name: `Project ${index}`, summary: '', status: 'planned',
        createdByUserId: ownerId, archivedAt: null,
        createdAt: '2027-01-01T00:00:00.000Z', updatedAt: '2027-01-01T00:00:00.000Z', revision: 1,
      });
    }
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const path = cursor === null
        ? `/api/v1/workspaces/${workspaceId}/projects?limit=100`
        : `/api/v1/workspaces/${workspaceId}/projects?cursor=${encodeURIComponent(cursor)}`;
      const response = await context.invoke('GET', path, bearerHeaders(token));
      expect(response.status).toBe(200);
      const page = (response.body as {data: {items: Array<{id: string}>; nextCursor: string | null}}).data;
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor !== null);
    expect(ids).toHaveLength(1_001);
    expect(new Set(ids).size).toBe(1_001);
    expect(ids.at(-1)).toBe(`project_${(1_001).toString(16).padStart(32, '0')}`);
  });

  it('returns a canonical export without revealing the token or private server ledgers', async () => {
    const context = fixture();
    const token = await context.createToken(
      ['workspace:export'],
      'rest-export-token-key-0001',
    );
    const response = await context.invoke(
      'GET', `/api/v1/workspaces/${workspaceId}/export`, bearerHeaders(token),
    );
    expect(response.status).toBe(200);
    expect(response.headers['content-type'])
      .toBe('application/vnd.basiclinear.workspace-export+json;version=1');
    expect(response.headers['content-disposition']).toContain(`${workspaceId}-export-v1.json`);
    expect(response.headers['x-basiclinear-export-sha256']).toMatch(/^[a-f0-9]{64}$/u);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain('personalTokens');
    expect(serialized).not.toContain('mutationAudits');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
