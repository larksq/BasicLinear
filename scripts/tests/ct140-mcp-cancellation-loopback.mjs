import assert from 'node:assert/strict';
import {createServer, request as createRequest} from 'node:http';
import {createMcpHttpHandler, mcpProtocolVersion} from '../../packages/hosted/dist/index.js';

const workspaceId = 'ws_ct140_loopback';
const resource = 'https://online.openlinear.test/mcp';
const rawToken = `olm_at_${'a'.repeat(43)}`;
const state = {serviceCalls: 0, audits: [], idempotency: [], projects: []};
async function withTimeout(promise, label) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

let markAuthenticationStarted;
let releaseAuthentication;
const authenticationStarted = new Promise((resolve) => { markAuthenticationStarted = resolve; });
const authenticationGate = new Promise((resolve) => { releaseAuthentication = resolve; });

const handler = createMcpHttpHandler({
  oauthService: {
    resource,
    async authenticateAccessToken(token) {
      assert.equal(token, rawToken);
      markAuthenticationStarted();
      await authenticationGate;
      return {
        principal: {kind: 'user', userId: 'owner_ct140_loopback', source: 'mcp'},
        workspaceId,
        clientId: 'client_ct140_loopback',
        scopes: ['projects:write'],
        role: 'owner',
        resource,
        expiresAt: '2027-01-01T00:10:00.000Z',
      };
    },
  },
  identityVerifier: {},
  projectManagementService: {
    async createProject(input) {
      state.serviceCalls += 1;
      state.audits.push({action: 'project.create', requestId: input.requestId});
      state.idempotency.push(input.idempotencyKey);
      state.projects.push(input.name);
      return {id: 'project_should_not_exist'};
    },
  },
  collaborationService: {},
  invitationService: {},
  billingService: {},
});

let markServerClosed;
const serverClosed = new Promise((resolve) => { markServerClosed = resolve; });
let markHandlerFinished;
let rejectHandler;
const handlerFinished = new Promise((resolve, reject) => {
  markHandlerFinished = resolve;
  rejectHandler = reject;
});
let closedBeforeAuthenticationResolved = false;

const server = createServer((incoming, response) => {
  response.once('close', () => {
    closedBeforeAuthenticationResolved = true;
    markServerClosed();
  });
  const url = new URL(incoming.url ?? '/', 'http://127.0.0.1');
  handler(incoming, response, 'request_ct140_loopback', url).then(markHandlerFinished, rejectHandler);
});

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert(address !== null && typeof address !== 'string');
  const body = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'project.create',
      arguments: {
        workspaceId,
        name: 'Must not be created',
        idempotencyKey: 'ct140-loopback-create-key-0001',
      },
      _meta: {
        'io.modelcontextprotocol/protocolVersion': mcpProtocolVersion,
        'io.modelcontextprotocol/clientInfo': {name: 'CT-140 cancellation probe', version: '1.0.0'},
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  });
  const client = createRequest({
    host: '127.0.0.1',
    port: address.port,
    path: '/mcp',
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${rawToken}`,
      'content-length': Buffer.byteLength(body),
      'content-type': 'application/json',
      'mcp-method': 'tools/call',
      'mcp-name': 'project.create',
      'mcp-param-workspace-id': workspaceId,
      'mcp-protocol-version': mcpProtocolVersion,
    },
  });
  client.on('error', () => {});
  client.end(body);
  await withTimeout(authenticationStarted, 'authentication to start');
  client.destroy();
  await withTimeout(serverClosed, 'the server-side response close');
  releaseAuthentication();
  await withTimeout(handlerFinished, 'the MCP handler to finish');
  assert.equal(closedBeforeAuthenticationResolved, true);
  assert.deepEqual(state, {serviceCalls: 0, audits: [], idempotency: [], projects: []});
  console.log(JSON.stringify({
    passed: true,
    closedBeforeAuthenticationResolved,
    state,
  }));
} finally {
  await new Promise((resolve) => server.close(resolve));
}
