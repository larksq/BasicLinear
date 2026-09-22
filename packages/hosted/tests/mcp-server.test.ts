import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import type {IncomingHttpHeaders, IncomingMessage, ServerResponse} from 'node:http';
import {describe, expect, it} from 'vitest';
import {
  CollaborationService,
  McpOAuthService,
  MemoryCollaborationRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  ProjectManagementService,
  PersonalTokenService,
  WorkspaceAuthorizationService,
  createMcpHttpHandler,
  createRestApiHandler,
  mcpOAuthScopes,
  mcpProtocolVersion,
  mcpStandardProtocolVersion,
  type BillingService,
  type InvitationService,
  type PersonalTokenScope,
} from '../src/index.js';
import {proEntitlementPolicyForTests} from './fixtures/entitlement.js';

const workspaceId = 'ws_mcp_transport';
const ownerId = 'owner_mcp_transport';
const origin = 'https://online.basiclinear.test';
const redirectUri = 'https://mcp-client.basiclinear.test/callback';
const verifier = 'transport-verifier-with-at-least-forty-three-safe-characters-12345';
const challenge = createHash('sha256').update(verifier).digest('base64url');

interface InvocationResult {
  status: number;
  headers: Record<string, string>;
  text: string;
  body: unknown;
  writes: string[];
}

function rawHeaders(headers: Record<string, string | string[]>): string[] {
  return Object.entries(headers).flatMap(([name, rawValue]) => (
    (Array.isArray(rawValue) ? rawValue : [rawValue]).flatMap((value) => [name, value])
  ));
}

function fixture() {
  const repository = new MemoryCollaborationRepository();
  const memberships = new MemoryWorkspaceMembershipReader();
  const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
  const now = new Date('2027-01-02T00:00:00.000Z');
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  memberships.set({
    schemaVersion: 1, workspaceId, userId: ownerId, role: 'owner', status: 'active', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}`, {
    schemaVersion: 1, id: workspaceId, workspaceId, name: 'MCP transport workspace', ownerUid: ownerId,
    authority: 'firebase-hosted', createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  repository.seedDocument(`workspaces/${workspaceId}/memberships/${ownerId}`, {
    schemaVersion: 1, id: `mem_${ownerId}`, workspaceId, userId: ownerId, role: 'owner', status: 'active',
    createdAt: '2027-01-01T00:00:00.000Z', revision: 1,
  });
  const authorization = new WorkspaceAuthorizationService(memberships, evidence, {clock: () => now, idFactory});
  const oauthService = new McpOAuthService(repository, authorization, {
    secret: 'mcp-transport-oauth-secret-at-least-32-bytes', publicOrigin: origin, clock: () => now,
    idFactory, randomSecret: () => new Uint8Array(32).fill((sequence++ % 250) + 1),
  });
  const projectManagementService = new ProjectManagementService(repository, authorization, {
    secret: 'mcp-transport-pm-secret-at-least-32-bytes', entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now, idFactory,
  });
  const collaborationService = new CollaborationService(repository, authorization, {
    secret: 'mcp-transport-collab-secret-at-least-32-bytes', entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now, idFactory,
  });
  const personalTokenService = new PersonalTokenService(repository, authorization, {
    secret: 'mcp-parity-personal-token-secret-at-least-32',
    entitlementPolicy: proEntitlementPolicyForTests,
    clock: () => now,
    idFactory,
    randomSecret: () => new Uint8Array(32).fill(41),
  });
  const restHandler = createRestApiHandler({
    personalTokenService,
    projectManagementService,
    collaborationService,
    invitationService: {} as InvitationService,
    billingService: {} as BillingService,
    cursorSecret: 'mcp-parity-rest-cursor-secret-at-least-32',
  });
  const createHandler = (overrides: {
    oauthService?: McpOAuthService;
    projectManagementService?: ProjectManagementService;
  } = {}) => createMcpHttpHandler({
    oauthService: overrides.oauthService ?? oauthService,
    identityVerifier: {verifyGoogleIdToken: async () => ({uid: ownerId, email: 'owner@example.com', emailVerified: true})},
    projectManagementService: overrides.projectManagementService ?? projectManagementService,
    collaborationService,
    invitationService: {} as InvitationService,
    billingService: {} as BillingService,
  });
  const issueToken = async (scopes = [...mcpOAuthScopes].join(' ')) => {
    const client = await oauthService.registerClient({
      clientName: 'Transport client', redirectUris: [redirectUri], tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'],
    });
    const started = await oauthService.startAuthorization({
      responseType: 'code', clientId: client.client_id, redirectUri, workspaceId, scope: scopes,
      state: 'transport-state-at-least-sixteen', codeChallenge: challenge, codeChallengeMethod: 'S256',
      resource: `${origin}/mcp`,
    });
    const approved = await oauthService.decideConsent({
      requestId: started.requestId, identity: {uid: ownerId}, decision: 'approve', requestReference: 'transport_consent',
    });
    const code = new URL(approved.redirectUri).searchParams.get('code') as string;
    return oauthService.exchangeAuthorizationCode({
      code, clientId: client.client_id, redirectUri, codeVerifier: verifier, resource: `${origin}/mcp`,
    });
  };
  const issueRestToken = async (scopes: readonly PersonalTokenScope[]) => {
    const result = await personalTokenService.createToken({
      principal: {kind: 'user', userId: ownerId, source: 'web'},
      workspaceId,
      requestId: 'request_mcp_rest_parity_token',
      idempotencyKey: 'mcp-rest-parity-token-key-0001',
      name: 'MCP REST parity',
      scopes,
      expiresInDays: 30,
    });
    return result.rawToken as string;
  };
  const invoke = async (
    handler: ReturnType<typeof createMcpHttpHandler>,
    method: string,
    path: string,
    headers: Record<string, string | string[]> = {},
    body: string | Buffer = '',
    closeOnFlush = false,
    whileHandling?: (request: IncomingMessage, response: ServerResponse) => Promise<void> | void,
  ): Promise<InvocationResult> => {
    const normalizedHeaders: Record<string, string | string[]> = {
      host: 'online.basiclinear.test',
      ...(body === '' ? {} : {'content-length': String(Buffer.byteLength(body))}),
      ...headers,
    };
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    Object.assign(request, {
      method, url: path,
      headers: Object.fromEntries(Object.entries(normalizedHeaders).map(([key, value]) => [
        key.toLowerCase(), Array.isArray(value) ? value[0] : value,
      ])),
      headersDistinct: Object.fromEntries(Object.entries(normalizedHeaders).map(([key, value]) => [
        key.toLowerCase(), Array.isArray(value) ? value : [value],
      ])),
      rawHeaders: rawHeaders(normalizedHeaders),
    });
    const emitter = new EventEmitter();
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let ended = '';
    const writes: string[] = [];
    Object.assign(emitter, {
      headersSent: false,
      destroyed: false,
      writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
        status = nextStatus;
        responseHeaders = nextHeaders;
        (emitter as unknown as {headersSent: boolean}).headersSent = true;
        return emitter;
      },
      flushHeaders() {
        if (closeOnFlush) emitter.emit('close');
      },
      write(value: string) {
        writes.push(value);
        return true;
      },
      end(value?: string) {
        ended = value ?? '';
        return emitter;
      },
    });
    const handling = handler(
      request,
      emitter as unknown as ServerResponse,
      `request_mcp_${sequence++}`,
      new URL(path, origin),
    );
    if (whileHandling !== undefined) {
      await whileHandling(request, emitter as unknown as ServerResponse);
    }
    const handled = await handling;
    expect(handled).toBe(true);
    const text = ended || writes.join('');
    let parsed: unknown = null;
    if (text.startsWith('data: ')) parsed = JSON.parse(text.slice(6).trim()) as unknown;
    else if (text !== '') parsed = JSON.parse(text) as unknown;
    return {status, headers: responseHeaders, text, body: parsed, writes};
  };
  const invokeRest = async (
    method: string,
    path: string,
    headers: IncomingHttpHeaders = {},
    body = '',
  ): Promise<{status: number; headers: Record<string, string>; body: unknown}> => {
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    Object.assign(request, {method, url: path, headers: {host: 'online.basiclinear.test', ...headers}});
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
    expect(await restHandler(
      request,
      response,
      `request_rest_parity_${sequence++}`,
      new URL(path, origin),
    )).toBe(true);
    return {status, headers: responseHeaders, body: payload === '' ? null : JSON.parse(payload) as unknown};
  };
  return {
    repository,
    oauthService,
    projectManagementService,
    createHandler,
    issueToken,
    issueRestToken,
    invoke,
    invokeRest,
  };
}

const metadata = {
  'io.modelcontextprotocol/protocolVersion': mcpProtocolVersion,
  'io.modelcontextprotocol/clientInfo': {name: 'MCP transport test', version: '1.0.0'},
  'io.modelcontextprotocol/clientCapabilities': {},
};

function requestBody(id: number, method: string, params: Record<string, unknown>): string {
  return JSON.stringify({jsonrpc: '2.0', id, method, params: {...params, _meta: metadata}});
}

function mcpHeaders(method: string, extra: Record<string, string | string[]> = {}): Record<string, string | string[]> {
  return {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    'mcp-protocol-version': mcpProtocolVersion,
    'mcp-method': method,
    ...extra,
  };
}

function standardMcpHeaders(extra: Record<string, string | string[]> = {}): Record<string, string | string[]> {
  return {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    'mcp-protocol-version': mcpStandardProtocolVersion,
    ...extra,
  };
}

describe('MCP 2026-07-28 Streamable HTTP adapter', () => {
  it.each(['2025-06-18', '2025-11-25', '2024-11-05', '2030-01-01'].flatMap((version) => (
    [false, true].map((withHeader) => ({version, withHeader}))
  )))('negotiates $version with initialization header=$withHeader', async ({version, withHeader}) => {
    const context = fixture();
    const handler = context.createHandler();
    const tokens = await context.issueToken('workspace:read');
    const authorization = {authorization: `Bearer ${tokens.access_token}`};
    const headers: Record<string, string> = {
      accept: 'application/json, text/event-stream', 'content-type': 'application/json', ...authorization,
      ...(withHeader ? {'mcp-protocol-version': version} : {}),
    };
    const initialized = await context.invoke(handler, 'POST', '/mcp', headers, JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: version, capabilities: {}, clientInfo: {name: 'SDK compatibility regression', version: '1'},
      },
    }));
    expect(initialized.status).toBe(200);
    expect(initialized.body).toMatchObject({id: 1, result: {protocolVersion: '2025-06-18'}});
    expect(initialized.headers['mcp-protocol-version']).toBe('2025-06-18');
    const ready = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', method: 'notifications/initialized',
    }));
    expect(ready.status).toBe(202);
    const listed = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }));
    expect(listed.status).toBe(200);
    if (version !== '2025-06-18') {
      const wrongVersion = await context.invoke(handler, 'POST', '/mcp', {
        ...standardMcpHeaders(authorization), 'mcp-protocol-version': version,
      }, JSON.stringify({jsonrpc: '2.0', id: 3, method: 'ping'}));
      expect(wrongVersion.status).toBe(400);
    }
  });

  it.each([null, 20250618, '', 'v'.repeat(33), '2025\n06\n18'])('rejects malformed initialization version %j', async (version) => {
    const context = fixture();
    const result = await context.invoke(context.createHandler(), 'POST', '/mcp', standardMcpHeaders(), JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: version, capabilities: {}, clientInfo: {name: 'Invalid version', version: '1'},
      },
    }));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({id: 1, error: {code: -32602}});
  });

  it('rejects conflicting or duplicate initialization headers and still authenticates negotiated clients', async () => {
    const context = fixture();
    const body = JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'Untrusted client', version: '1'},
    }});
    for (const version of ['2025-06-18', ['2025-11-25', '2025-11-25']]) {
      const response = await context.invoke(context.createHandler(), 'POST', '/mcp', {
        ...standardMcpHeaders(), 'mcp-protocol-version': version,
      }, body);
      expect(response.status).toBe(400);
    }
    const unauthenticated = await context.invoke(context.createHandler(), 'POST', '/mcp', {
      ...standardMcpHeaders(), 'mcp-protocol-version': '2025-11-25',
    }, body);
    expect(unauthenticated.status).toBe(401);
  });

  it('negotiates the standard MCP lifecycle and injects the OAuth-bound workspace for Codex clients', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const tokens = await context.issueToken('workspace:read issues:read issues:write');
    const authorization = {authorization: `Bearer ${tokens.access_token}`};
    const initialized = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: mcpStandardProtocolVersion,
        capabilities: {},
        clientInfo: {name: 'Codex', version: '0.144.1'},
      },
    }));
    expect(initialized.status).toBe(200);
    expect(initialized.body).toMatchObject({
      jsonrpc: '2.0', id: 1, result: {
        protocolVersion: mcpStandardProtocolVersion,
        capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'basiclinear-product-management', version: '0.2.0'},
      },
    });
    expect((initialized.body as {result: {instructions: string}}).result.instructions).toContain(workspaceId);

    const ready = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', method: 'notifications/initialized', params: {},
    }));
    expect(ready.status).toBe(202);
    expect(ready.body).toBeNull();

    const listed = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list', params: {},
    }));
    const standardTools = (listed.body as {result: {tools: Array<{
      name: string; inputSchema: {properties: Record<string, unknown>; required: string[]};
    }>}}).result.tools;
    expect(standardTools.map((tool) => tool.name)).toEqual([
      'issue.assign', 'issue.create', 'issue.get', 'issue.list', 'issue.update', 'workspace.get',
    ]);
    expect(standardTools.every((tool) => (
      tool.inputSchema.properties.workspaceId === undefined
      && !tool.inputSchema.required.includes('workspaceId')
    ))).toBe(true);

    const workspace = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'workspace.get', arguments: {}},
    }));
    expect(workspace.status).toBe(200);
    expect(workspace.body).toMatchObject({
      jsonrpc: '2.0', id: 3, result: {isError: false, structuredContent: {data: {id: workspaceId}}},
    });

    const resources = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(authorization), JSON.stringify({
      jsonrpc: '2.0', id: 4, method: 'resources/list', params: {},
    }));
    expect(resources.body).toEqual({jsonrpc: '2.0', id: 4, result: {resources: []}});
  });

  it('discovers only authorized tools when standard list parameters are omitted', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const tokens = await context.issueToken('workspace:read');
    const headers = standardMcpHeaders({authorization: `Bearer ${tokens.access_token}`});
    const omitted = await context.invoke(handler, 'POST', '/mcp', headers, JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/list',
    }));
    const explicit = await context.invoke(handler, 'POST', '/mcp', headers, JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/list', params: {},
    }));
    expect(omitted.status).toBe(200);
    expect(omitted.body).toEqual(explicit.body);
    expect((omitted.body as {result: {tools: Array<{name: string}>}}).result.tools.map(tool => tool.name))
      .toEqual(['workspace.get']);
    const unauthenticated = await context.invoke(handler, 'POST', '/mcp', standardMcpHeaders(), JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/list',
    }));
    expect(unauthenticated.status).toBe(401);
  });

  it.each([null, [], '', 1])('rejects explicit malformed tools/list parameters %j', async (params) => {
    const context = fixture();
    const response = await context.invoke(context.createHandler(), 'POST', '/mcp', standardMcpHeaders(), JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/list', params,
    }));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({error: {code: -32602}});
  });

  it('still requires tool arguments and modern protocol metadata', async () => {
    const context = fixture();
    for (const method of ['tools/call', 'server/discover']) {
      const response = await context.invoke(context.createHandler(), 'POST', '/mcp', standardMcpHeaders(), JSON.stringify({
        jsonrpc: '2.0', id: 1, method,
      }));
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({error: {code: -32602}});
    }
    const modernList = await context.invoke(context.createHandler(), 'POST', '/mcp', mcpHeaders('tools/list'), JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/list',
    }));
    expect(modernList.status).toBe(400);
  });

  it('completes the public-client HTTP registration, PKCE consent, token, refresh, and revoke flow', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const registrationPayload = JSON.stringify({
      application_type: 'native',
      client_name: 'HTTP OAuth client',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['refresh_token', 'authorization_code'],
      response_types: ['code'],
      scope: 'workspace:read issues:read issues:write',
    });
    const registered = await context.invoke(handler, 'POST', '/oauth/register', {
      'content-type': 'application/json; charset=utf-8',
    }, registrationPayload);
    expect(registered.status).toBe(201);
    const clientId = (registered.body as {client_id: string}).client_id;
    expect(registered.body).toMatchObject({
      client_id: clientId,
      grant_types: ['authorization_code', 'refresh_token'],
      redirect_uris: [redirectUri],
      scope: 'issues:read issues:write workspace:read',
    });

    const webRegistered = await context.invoke(handler, 'POST', '/oauth/register', {
      'content-type': 'application/json',
    }, JSON.stringify({
      application_type: 'web',
      client_name: 'HTTP web OAuth client',
      redirect_uris: ['https://web-client.basiclinear.test/oauth/callback'],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }));
    expect(webRegistered.status).toBe(201);

    const beforeInvalidRegistration = context.repository.snapshot();
    for (const invalidRegistration of [
      JSON.stringify({
        application_type: 'desktop', client_name: 'Invalid application type',
        redirect_uris: [redirectUri], token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      }),
      '{"application_type":"native","application_type":"web","client_name":"Duplicate type",'
        + `"redirect_uris":["${redirectUri}"],"token_endpoint_auth_method":"none",`
        + '"grant_types":["authorization_code","refresh_token"],"response_types":["code"]}',
      JSON.stringify({
        application_type: 'native', client_name: 'Unsafe redirect',
        redirect_uris: ['https://user@hostile.basiclinear.test/callback'], token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
      }),
      JSON.stringify({
        application_type: 'native', client_name: 'Unknown registration scope',
        redirect_uris: [redirectUri], token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
        scope: 'workspace:read source-code:write',
      }),
    ]) {
      const rejected = await context.invoke(handler, 'POST', '/oauth/register', {
        'content-type': 'application/json',
      }, invalidRegistration);
      expect(rejected.status).toBe(400);
    }
    expect(context.repository.snapshot()).toEqual(beforeInvalidRegistration);

    const authorizeQuery = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      workspace_id: workspaceId,
      scope: 'projects:read workspace:read',
      state: 'http-oauth-state-at-least-sixteen',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: `${origin}/mcp`,
    });
    const selectionQuery = new URLSearchParams(authorizeQuery);
    selectionQuery.delete('workspace_id');
    const beforeSelection = context.repository.snapshot();
    const selection = await context.invoke(handler, 'GET', `/oauth/authorize?${selectionQuery.toString()}`);
    expect(selection.status).toBe(302);
    const selectionLocation = new URL(selection.headers.location);
    expect(selectionLocation.origin).toBe(origin);
    expect(selectionLocation.pathname).toBe('/hosted.html');
    expect(selectionLocation.searchParams.get('oauth_workspace')).toBe('select');
    expect(selectionLocation.searchParams.get('workspace_id')).toBeNull();
    expect(selectionLocation.searchParams.get('client_id')).toBe(clientId);
    expect(selectionLocation.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(selectionLocation.searchParams.get('scope')).toBe('projects:read workspace:read');
    expect(context.repository.snapshot()).toEqual(beforeSelection);

    const started = await context.invoke(handler, 'GET', `/oauth/authorize?${authorizeQuery.toString()}`);
    expect(started.status).toBe(302);
    const requestId = new URL(started.headers.location).searchParams.get('oauth_request') as string;
    expect(requestId).toMatch(/^oauthreq_[a-f0-9]{32}$/u);
    const googleHeaders = {authorization: `Bearer ${'firebase-google-token-'.padEnd(40, 'x')}`};
    const consent = await context.invoke(handler, 'GET', `/oauth/consent/${requestId}`, googleHeaders);
    expect(consent.body).toMatchObject({
      data: {client: {id: clientId, name: 'HTTP OAuth client'}, workspace: {id: workspaceId}},
    });
    const approved = await context.invoke(handler, 'POST', `/oauth/consent/${requestId}`, {
      ...googleHeaders, 'content-type': 'application/json',
    }, JSON.stringify({decision: 'approve'}));
    const approvalRedirect = (approved.body as {data: {redirectUri: string}}).data.redirectUri;
    const code = new URL(approvalRedirect).searchParams.get('code') as string;
    expect(new URL(approvalRedirect).searchParams.get('state')).toBe('http-oauth-state-at-least-sixteen');

    const tokenForm = new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: clientId, redirect_uri: redirectUri,
      code_verifier: verifier, resource: `${origin}/mcp`,
    }).toString();
    const issued = await context.invoke(handler, 'POST', '/oauth/token', {
      'content-type': 'application/x-www-form-urlencoded',
    }, tokenForm);
    expect(issued.status).toBe(200);
    expect(issued.headers.pragma).toBe('no-cache');
    const tokens = issued.body as {access_token: string; refresh_token: string};
    const refreshForm = new URLSearchParams({
      grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: clientId,
      scope: 'workspace:read',
    }).toString();
    const rotated = await context.invoke(handler, 'POST', '/oauth/token', {
      'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
    }, refreshForm);
    expect(rotated.body).toMatchObject({scope: 'workspace:read', token_type: 'Bearer'});
    const rotatedTokens = rotated.body as {access_token: string; refresh_token: string};
    const revoked = await context.invoke(handler, 'POST', '/oauth/revoke', {
      'content-type': 'application/x-www-form-urlencoded',
    }, new URLSearchParams({token: rotatedTokens.refresh_token, client_id: clientId}).toString());
    expect(revoked.status).toBe(200);
    await expect(context.oauthService.authenticateAccessToken(rotatedTokens.access_token))
      .rejects.toMatchObject({code: 'OAUTH_INVALID_TOKEN'});
    expect(JSON.stringify(context.repository.snapshot())).not.toContain(tokens.access_token);
    expect(JSON.stringify(context.repository.snapshot())).not.toContain(tokens.refresh_token);
  });

  it('serves public discovery and OAuth metadata while rejecting old transport methods', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const discover = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('server/discover'),
      requestBody(1, 'server/discover', {}));
    expect(discover.status).toBe(200);
    expect(discover.body).toMatchObject({
      jsonrpc: '2.0', id: 1,
      result: {
        resultType: 'complete', supportedVersions: [mcpProtocolVersion], capabilities: {tools: {}},
        _meta: {'io.modelcontextprotocol/serverInfo': {name: 'basiclinear-product-management', version: '0.2.0'}},
      },
    });
    const anonymousClient = JSON.stringify({
      jsonrpc: '2.0', id: 11, method: 'server/discover', params: {_meta: {
        'io.modelcontextprotocol/protocolVersion': mcpProtocolVersion,
        'io.modelcontextprotocol/clientCapabilities': {},
      }},
    });
    expect((await context.invoke(handler, 'POST', '/mcp', mcpHeaders('server/discover'), anonymousClient)).status)
      .toBe(200);
    const protectedMetadata = await context.invoke(handler, 'GET', '/.well-known/oauth-protected-resource/mcp');
    expect(protectedMetadata.body).toMatchObject({resource: `${origin}/mcp`, authorization_servers: [origin]});
    const authorizationMetadata = await context.invoke(handler, 'GET', '/.well-known/oauth-authorization-server');
    expect(authorizationMetadata.body).toMatchObject({issuer: origin, code_challenge_methods_supported: ['S256']});
    expect((await context.invoke(handler, 'GET', '/mcp')).status).toBe(405);
    expect((await context.invoke(handler, 'DELETE', '/mcp')).status).toBe(405);
  });

  it('lists exactly the scoped PM allowlist and calls the shared service over request-scoped SSE', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const tokens = await context.issueToken();
    const list = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      authorization: `Bearer ${tokens.access_token}`,
      'mcp-session-id': 'ignored-legacy-session', 'last-event-id': 'ignored-event',
    }), requestBody(2, 'tools/list', {}));
    expect(list.status).toBe(200);
    const toolResult = (list.body as {result: {tools: Array<Record<string, unknown>>}}).result.tools;
    expect(toolResult).toHaveLength(27);
    expect(toolResult.map((tool) => tool.name)).toEqual([...toolResult.map((tool) => tool.name)].sort());
    expect(JSON.stringify(toolResult)).not.toMatch(/agent|code.review|repository|pull.request|token.create|checkout/iu);
    expect(toolResult.every((tool) => (
      (tool.inputSchema as {properties: {workspaceId: Record<string, unknown>}})
        .properties.workspaceId['x-mcp-header'] === 'Workspace-Id'
    ))).toBe(true);
    expect((list.body as {result: {_meta: Record<string, unknown>}}).result._meta).toEqual({
      'io.modelcontextprotocol/serverInfo': {name: 'basiclinear-product-management', version: '0.2.0'},
    });
    expect(toolResult.every((tool) => (
      (tool.inputSchema as {$schema?: string}).$schema === 'https://json-schema.org/draft/2020-12/schema'
      && (tool.outputSchema as {$schema?: string}).$schema === 'https://json-schema.org/draft/2020-12/schema'
      && typeof (tool.annotations as {readOnlyHint?: unknown}).readOnlyHint === 'boolean'
      && typeof (tool.annotations as {destructiveHint?: unknown}).destructiveHint === 'boolean'
      && typeof (tool.annotations as {idempotentHint?: unknown}).idempotentHint === 'boolean'
      && (tool.annotations as {openWorldHint?: unknown}).openWorldHint === false
    ))).toBe(true);
    expect(list.headers['mcp-session-id']).toBeUndefined();

    const readTokens = await context.issueToken('workspace:read projects:read');
    const scoped = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      authorization: `Bearer ${readTokens.access_token}`,
    }), requestBody(20, 'tools/list', {}));
    expect((scoped.body as {result: {tools: Array<{name: string}>}}).result.tools.map((tool) => tool.name))
      .toEqual(['project.get', 'project.list', 'workspace.get']);

    const argumentsValue = {
      workspaceId, name: 'MCP-created project', summary: 'Same application service as REST',
      idempotencyKey: 'mcp-create-project-key-0001',
    };
    const call = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
      authorization: `Bearer ${tokens.access_token}`, 'mcp-name': 'project.create',
      'mcp-param-workspace-id': `=?base64?${Buffer.from(workspaceId).toString('base64')}?=`,
    }), requestBody(3, 'tools/call', {name: 'project.create', arguments: argumentsValue}));
    expect(call.status).toBe(200);
    expect(call.headers['content-type']).toBe('text/event-stream; charset=utf-8');
    expect(call.body).toMatchObject({
      jsonrpc: '2.0', id: 3,
      result: {
        resultType: 'complete', isError: false,
        structuredContent: {data: {name: 'MCP-created project', revision: 1}},
        _meta: {'io.modelcontextprotocol/serverInfo': {name: 'basiclinear-product-management', version: '0.2.0'}},
      },
    });
    const projectId = ((call.body as {result: {structuredContent: {data: {id: string}}}})
      .result.structuredContent.data.id);
    expect(await context.projectManagementService.getProject({
      principal: {kind: 'user', userId: ownerId, source: 'web'}, workspaceId,
      requestId: 'read_after_mcp', projectId,
    })).toMatchObject({name: 'MCP-created project', revision: 1});
    expect(Object.values(context.repository.snapshot())).toContainEqual(expect.objectContaining({
      source: 'mcp', action: 'project.create', entity: expect.objectContaining({id: projectId}),
    }));
  });

  it('preserves reciprocal REST/MCP state, retry, revision-conflict, and audit semantics', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const oauth = await context.issueToken('projects:read projects:write');
    const pat = await context.issueRestToken(['projects:read', 'projects:write']);
    const call = async (id: number, name: string, argumentsValue: Record<string, unknown>) => (
      context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
        authorization: `Bearer ${oauth.access_token}`,
        'mcp-name': name,
        'mcp-param-workspace-id': workspaceId,
      }), requestBody(id, 'tools/call', {name, arguments: argumentsValue}))
    );
    const projectState = () => Object.fromEntries(Object.entries(context.repository.snapshot())
      .filter(([path, value]) => (
        path.startsWith(`workspaces/${workspaceId}/projects/`)
        || path.startsWith(`workspaces/${workspaceId}/pmIdempotency/`)
        || (path.startsWith(`workspaces/${workspaceId}/mutationAudits/`)
          && String((value as {action?: unknown}).action).startsWith('project.'))
      )));

    const createArguments = {
      workspaceId,
      name: 'Cross-channel project',
      summary: 'Identical REST and MCP application state',
      idempotencyKey: 'cross-channel-project-create-0001',
    };
    const createdByMcp = await call(30, 'project.create', createArguments);
    const project = (createdByMcp.body as {
      result: {structuredContent: {data: {id: string; revision: number}}};
    }).result.structuredContent.data;
    const afterMcpCreate = projectState();
    const restReplay = await context.invokeRest(
      'POST',
      `/api/v1/workspaces/${workspaceId}/projects`,
      {
        authorization: `Bearer ${pat}`,
        'content-type': 'application/json',
        'idempotency-key': createArguments.idempotencyKey,
      },
      JSON.stringify({name: createArguments.name, summary: createArguments.summary}),
    );
    expect(restReplay.status).toBe(201);
    expect((restReplay.body as {data: {project: unknown}}).data.project).toEqual(project);
    expect(projectState()).toEqual(afterMcpCreate);

    const updateKey = 'cross-channel-project-update-0001';
    const restUpdated = await context.invokeRest(
      'PATCH',
      `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
      {
        authorization: `Bearer ${pat}`,
        'content-type': 'application/json',
        'idempotency-key': updateKey,
        'if-match': '"rev-1"',
      },
      JSON.stringify({status: 'completed'}),
    );
    expect(restUpdated.status).toBe(200);
    const updatedProject = (restUpdated.body as {data: {project: unknown}}).data.project;
    const afterRestUpdate = projectState();
    const mcpReplay = await call(31, 'project.update', {
      workspaceId,
      projectId: project.id,
      expectedRevision: 1,
      status: 'completed',
      idempotencyKey: updateKey,
    });
    expect((mcpReplay.body as {result: {structuredContent: {data: unknown}}})
      .result.structuredContent.data).toEqual(updatedProject);
    expect(projectState()).toEqual(afterRestUpdate);

    const beforeConflicts = projectState();
    const restConflict = await context.invokeRest(
      'PATCH',
      `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
      {
        authorization: `Bearer ${pat}`,
        'content-type': 'application/json',
        'idempotency-key': 'cross-channel-stale-rest-key-0001',
        'if-match': '"rev-1"',
      },
      JSON.stringify({summary: 'Must not persist'}),
    );
    expect(restConflict.status).toBe(409);
    const mcpConflict = await call(32, 'project.update', {
      workspaceId,
      projectId: project.id,
      expectedRevision: 1,
      summary: 'Must not persist either',
      idempotencyKey: 'cross-channel-stale-mcp-key-0001',
    });
    expect(mcpConflict.body).toMatchObject({
      result: {
        isError: true,
        content: [{type: 'text'}],
        structuredContent: {data: {error: {code: 'PM_CONFLICT'}}},
      },
    });
    expect(mcpConflict.text).toContain('PM_CONFLICT');
    expect(mcpConflict.text).not.toContain('Must not persist');
    expect(projectState()).toEqual(beforeConflicts);

    const audits = Object.values(projectState()).filter((value) => (
      typeof (value as {action?: unknown}).action === 'string'
    )) as Array<{action: string; source: string; entity: {id: string}}>;
    expect(audits).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action: 'project.create',
        source: 'mcp',
        entity: expect.objectContaining({id: project.id, revisionBefore: null, revisionAfter: 1}),
      }),
      expect.objectContaining({
        action: 'project.update',
        source: 'rest',
        entity: expect.objectContaining({id: project.id, revisionBefore: 1, revisionAfter: 2}),
      }),
    ]));
  });

  it('fails closed on PATs, header/body mismatch, malformed metadata, unsupported versions, and unknown methods', async () => {
    const context = fixture();
    const handler = context.createHandler();
    const tokens = await context.issueToken('workspace:read projects:read');
    const before = context.repository.snapshot();
    for (const accept of [
      'application/json;q=bogus, text/event-stream',
      'application/json;q=0, text/event-stream',
      'application/json;q=1.1, text/event-stream',
      'application/json;q=1;q=1, text/event-stream',
      'application/json;q = 0, text/event-stream',
      'application/json;, text/event-stream',
      'application/json;profile="v2", text/event-stream',
      'application/json;q=1;q=0.5, text/event-stream',
      'application/json;profile="unterminated, text/event-stream',
    ]) {
      const invalidAccept = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {accept}),
        requestBody(40, 'tools/list', {}));
      expect(invalidAccept.status, accept).toBe(400);
      expect(invalidAccept.body, accept).toMatchObject({error: {code: -32600}});
    }
    const charsetAccept = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      accept: 'application/json;charset=utf-8, text/event-stream;charset="UTF-8"',
      authorization: `Bearer ${tokens.access_token}`,
    }), requestBody(42, 'tools/list', {}));
    expect(charsetAccept.status).toBe(200);
    const unauthenticated = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list'),
      requestBody(4, 'tools/list', {}));
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource/mcp');
    expect(unauthenticated.headers['www-authenticate']).toContain('scope="workspace:read"');
    const pat = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      authorization: `Bearer olp_${'a'.repeat(96)}`,
    }), requestBody(5, 'tools/list', {}));
    expect(pat.status).toBe(401);
    const duplicateVersion = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      'mcp-protocol-version': [mcpProtocolVersion, mcpProtocolVersion],
    }), requestBody(50, 'tools/list', {}));
    expect(duplicateVersion.status).toBe(400);
    expect(duplicateVersion.body).toMatchObject({error: {code: -32020}});
    const malformedMetadata = JSON.stringify({
      jsonrpc: '2.0', id: 51, method: 'tools/list', params: {_meta: {
        ...metadata,
        'io.modelcontextprotocol/clientInfo': {name: '', version: '1.0.0'},
      }},
    });
    const invalidMetadata = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list'), malformedMetadata);
    expect(invalidMetadata.status).toBe(400);
    expect(invalidMetadata.body).toMatchObject({error: {code: -32602}});
    const malformedCapabilities = JSON.stringify({
      jsonrpc: '2.0', id: 52, method: 'server/discover', params: {_meta: {
        ...metadata,
        'io.modelcontextprotocol/clientCapabilities': {sampling: 'yes'},
      }},
    });
    const invalidCapabilities = await context.invoke(
      handler, 'POST', '/mcp', mcpHeaders('server/discover'), malformedCapabilities,
    );
    expect(invalidCapabilities.status).toBe(400);
    expect(invalidCapabilities.body).toMatchObject({error: {code: -32602}});
    const invalidMetaKey = JSON.stringify({
      jsonrpc: '2.0', id: 53, method: 'server/discover', params: {_meta: {
        ...metadata,
        'bad/key/extra': {},
      }},
    });
    const invalidKey = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('server/discover'), invalidMetaKey);
    expect(invalidKey.status).toBe(400);
    expect(invalidKey.body).toMatchObject({error: {code: -32602}});
    const richClientMetadata = JSON.stringify({
      jsonrpc: '2.0', id: 54, method: 'server/discover', params: {_meta: {
        ...metadata,
        'io.modelcontextprotocol/clientInfo': {
          name: 'Rich MCP client',
          version: '2.0.0',
          title: 'Rich client',
          description: 'Exercises the current optional implementation metadata.',
          websiteUrl: 'https://client.example.test/about',
          icons: [{src: 'https://client.example.test/icon.svg', mimeType: 'image/svg+xml', sizes: ['any']}],
        },
        'io.modelcontextprotocol/clientCapabilities': {
          experimental: {'vendor.example/preview': {}},
          roots: {listChanged: true},
          sampling: {context: {}, tools: {}},
          elicitation: {form: {}, url: {}},
          extensions: {'vendor.example/extension': {}},
        },
        'io.modelcontextprotocol/logLevel': 'notice',
        progressToken: 4,
      }},
    });
    const validRichMetadata = await context.invoke(
      handler, 'POST', '/mcp', mcpHeaders('server/discover'), richClientMetadata,
    );
    expect(validRichMetadata.status).toBe(200);
    expect(validRichMetadata.body).toMatchObject({result: {resultType: 'complete'}});
    const mismatch = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
      authorization: `Bearer ${tokens.access_token}`, 'mcp-name': 'workspace.get',
      'mcp-param-workspace-id': 'ws_foreign',
    }), requestBody(6, 'tools/call', {name: 'workspace.get', arguments: {workspaceId}}));
    expect(mismatch.status).toBe(400);
    expect(mismatch.body).toMatchObject({error: {code: -32020}});
    expect(context.repository.snapshot()).toEqual(before);

    const insufficient = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
      authorization: `Bearer ${tokens.access_token}`,
      'mcp-name': 'project.create',
      'mcp-param-workspace-id': workspaceId,
    }), requestBody(61, 'tools/call', {name: 'project.create', arguments: {
      workspaceId,
      name: 'Must not be created',
      idempotencyKey: 'insufficient-scope-project-key-0001',
    }}));
    expect(insufficient.status).toBe(403);
    expect(insufficient.body).toMatchObject({error: {data: {requiredScope: 'projects:write'}}});
    expect(insufficient.headers['www-authenticate']).toContain('error="insufficient_scope"');
    expect(insufficient.headers['www-authenticate']).toContain('scope="projects:write"');
    expect(context.repository.snapshot()).toEqual(before);

    const oldMetadata = {...metadata, 'io.modelcontextprotocol/protocolVersion': '2025-11-25'};
    const oldBody = JSON.stringify({jsonrpc: '2.0', id: 7, method: 'tools/list', params: {_meta: oldMetadata}});
    const unsupported = await context.invoke(handler, 'POST', '/mcp', {
      ...mcpHeaders('tools/list', {authorization: `Bearer ${tokens.access_token}`}),
      'mcp-protocol-version': '2025-11-25',
    }, oldBody);
    expect(unsupported.status).toBe(400);
    expect(unsupported.body).toMatchObject({error: {
      code: -32022,
      data: {supported: [mcpProtocolVersion], requested: '2025-11-25'},
    }});
    const missingVersion = await context.invoke(handler, 'POST', '/mcp', {
      ...mcpHeaders('tools/list', {authorization: `Bearer ${tokens.access_token}`}),
      'mcp-protocol-version': [],
    }, requestBody(71, 'tools/list', {}));
    expect(missingVersion.status).toBe(400);
    expect(missingVersion.body).toMatchObject({error: {code: -32020}});

    const invalidUtf8 = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/list', {
      authorization: `Bearer ${tokens.access_token}`,
    }), Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]));
    expect(invalidUtf8.status).toBe(400);
    expect(invalidUtf8.body).toMatchObject({error: {code: -32700}});
    expect(context.repository.snapshot()).toEqual(before);

    const unknown = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('agents/run'),
      requestBody(8, 'agents/run', {}));
    expect(unknown.status).toBe(404);
    expect(unknown.body).toMatchObject({error: {code: -32601}});
  });

  it('treats a closed request SSE stream as cancellation before starting work', async () => {
    const context = fixture();
    const tokens = await context.issueToken('projects:read');
    let calls = 0;
    const service = {
      ...context.projectManagementService,
      async listProjects() { calls += 1; return []; },
    } as unknown as ProjectManagementService;
    const handler = context.createHandler({projectManagementService: service});
    const result = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
      authorization: `Bearer ${tokens.access_token}`, 'mcp-name': 'project.list',
      'mcp-param-workspace-id': workspaceId,
    }), requestBody(9, 'tools/call', {name: 'project.list', arguments: {workspaceId}}), true);
    expect(result.status).toBe(200);
    expect(result.writes).toEqual([]);
    expect(calls).toBe(0);
  });

  it('tracks a client close while OAuth authentication is pending and never starts mutation work', async () => {
    const context = fixture();
    const tokens = await context.issueToken('projects:write');
    const before = context.repository.snapshot();
    let serviceCalls = 0;
    const service = {
      ...context.projectManagementService,
      async createProject() {
        serviceCalls += 1;
        throw new Error('Mutation work must never start after cancellation.');
      },
    } as unknown as ProjectManagementService;
    let markAuthenticationStarted!: () => void;
    let releaseAuthentication!: () => void;
    const authenticationStarted = new Promise<void>((resolve) => { markAuthenticationStarted = resolve; });
    const authenticationGate = new Promise<void>((resolve) => { releaseAuthentication = resolve; });
    const delayedOAuthService = {
      resource: context.oauthService.resource,
      authenticateAccessToken: async (rawToken: string) => {
        markAuthenticationStarted();
        await authenticationGate;
        return context.oauthService.authenticateAccessToken(rawToken);
      },
    } as McpOAuthService;
    const handler = context.createHandler({
      oauthService: delayedOAuthService,
      projectManagementService: service,
    });
    let controlledRequest: IncomingMessage | null = null;
    let controlledResponse: ServerResponse | null = null;
    const result = await context.invoke(handler, 'POST', '/mcp', mcpHeaders('tools/call', {
      authorization: `Bearer ${tokens.access_token}`, 'mcp-name': 'project.create',
      'mcp-param-workspace-id': workspaceId,
    }), requestBody(10, 'tools/call', {name: 'project.create', arguments: {
      workspaceId,
      name: 'Cancelled project',
      idempotencyKey: 'cancelled-project-create-key-0001',
    }}), false, async (request, response) => {
      controlledRequest = request;
      controlledResponse = response;
      await authenticationStarted;
      Object.assign(request, {aborted: true});
      Object.assign(response, {destroyed: true});
      request.emit('aborted');
      response.emit('close');
      releaseAuthentication();
    });
    expect(result.status).toBe(0);
    expect(result.writes).toEqual([]);
    expect(serviceCalls).toBe(0);
    expect(context.repository.snapshot()).toEqual(before);
    expect(controlledRequest?.listenerCount('aborted')).toBe(0);
    expect(controlledResponse?.listenerCount('close')).toBe(0);
  });
});
