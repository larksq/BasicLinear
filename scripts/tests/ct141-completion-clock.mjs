import assert from 'node:assert/strict';
import {
  createHostedHttpHandler,
  HostedOperationsControl,
  HostedOperationsControlError,
  hostedOperationsPolicyV1,
  MemoryHostedOperationsTelemetrySink,
} from '../../packages/hosted/dist/index.js';
import { runHostedServerHandler } from '../../apps/hosted-service/dist/server-boundary.js';

let now = new Date('2026-08-01T00:01:00.000Z');
const telemetry = new MemoryHostedOperationsTelemetrySink();
const control = new HostedOperationsControl({
  secret: 'ct141-built-completion-secret-000000000000000000001',
  sink: telemetry,
  clock: () => now,
});
const admissionInput = {
  method: 'GET',
  pathname: '/health/ready',
  networkAddress: '203.0.113.200',
  authorization: `Bearer ${'z'.repeat(64)}`,
  workspaceId: null,
  traceId: null,
};
const admission = control.admit({
  ...admissionInput,
  correlationId: 'ct141-built-completion-0001',
});
now = new Date('2026-08-01T00:00:54.000Z');
control.complete(admission, {statusCode: 200});
assert.equal(telemetry.events.length, 1);
assert.deepEqual(
  {
    statusCode: telemetry.events[0]?.statusCode,
    occurredAt: telemetry.events[0]?.occurredAt,
    durationMilliseconds: telemetry.events[0]?.durationMilliseconds,
  },
  {
    statusCode: 200,
    occurredAt: '2026-08-01T00:01:00.000Z',
    durationMilliseconds: 0,
  },
);

let admissionFailure;
try {
  control.admit({...admissionInput, correlationId: 'ct141-built-admission-0002'});
} catch (error) {
  admissionFailure = error;
}
assert.ok(admissionFailure instanceof HostedOperationsControlError);
assert.equal(admissionFailure.code, 'OPERATIONS_UNAVAILABLE');
control.recordAdmissionFailure(
  {...admissionInput, correlationId: 'ct141-built-admission-0002'},
  admissionFailure,
);
assert.equal(telemetry.events.length, 2);
assert.deepEqual(
  {
    statusCode: telemetry.events[1]?.statusCode,
    occurredAt: telemetry.events[1]?.occurredAt,
    outcome: telemetry.events[1]?.outcome,
  },
  {
    statusCode: 503,
    occurredAt: '2026-08-01T00:01:00.000Z',
    outcome: 'failed',
  },
);

let serverStatus = 0;
let serverBody = '';
let serverEnded = false;
const response = {
  destroyed: false,
  headersSent: false,
  writableEnded: false,
  writeHead(statusCode) {
    serverStatus = statusCode;
    this.headersSent = true;
    return this;
  },
  end(body = '') {
    serverBody = body;
    serverEnded = true;
    this.writableEnded = true;
    return this;
  },
  destroy() {
    this.destroyed = true;
    return this;
  },
};
const originalConsoleError = console.error;
const containedErrors = [];
console.error = (...values) => containedErrors.push(values);
try {
  runHostedServerHandler(
    async () => { throw new Error('private built handler failure'); },
    {},
    response,
    () => 'ct141-built-server-0003',
  );
  await new Promise((resolve) => setImmediate(resolve));
} finally {
  console.error = originalConsoleError;
}
assert.equal(serverStatus, 503);
assert.equal(serverEnded, true);
assert.equal(JSON.parse(serverBody).error.code, 'SERVICE_UNAVAILABLE');
assert.equal(containedErrors.length, 1);
assert.equal(JSON.stringify(containedErrors).includes('private built handler failure'), false);

const serializedTelemetry = JSON.stringify(telemetry.events);
assert.equal(serializedTelemetry.includes('203.0.113.200'), false);
assert.equal(serializedTelemetry.includes('z'.repeat(64)), false);

function builtHealthRequest() {
  return {
    method: 'GET',
    url: '/health/ready',
    headers: {host: 'openlinear.test'},
    rawHeaders: ['Host', 'openlinear.test'],
    socket: {remoteAddress: '203.0.113.201'},
  };
}

function builtResponse(failure = 'none') {
  let status = 0;
  let destroyed = false;
  const value = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    writeHead(nextStatus) {
      if (failure === 'writeHead') throw new Error('private built write failure');
      status = nextStatus;
      value.statusCode = nextStatus;
      value.headersSent = true;
      return value;
    },
    end() {
      if (failure === 'end') throw new Error('private built end failure');
      value.writableEnded = true;
      return value;
    },
    destroy() {
      destroyed = true;
      value.destroyed = true;
      return value;
    },
  };
  return {value, snapshot: () => ({status, destroyed})};
}

const rejectionTransportMatrix = [];
for (const [kind, failure, expectedStatus] of [
  ['rate_limit', 'writeHead', 429],
  ['rate_limit', 'end', 429],
  ['clock_regression', 'writeHead', 503],
  ['clock_regression', 'end', 503],
]) {
  let boundaryNow = new Date('2026-08-01T00:01:00.000Z');
  const boundarySink = new MemoryHostedOperationsTelemetrySink();
  const boundaryPolicy = structuredClone(hostedOperationsPolicyV1);
  if (kind === 'rate_limit') {
    boundaryPolicy.limits.health = {global: 1, network: 1, credential: null, workspace: null};
  }
  const boundaryControl = new HostedOperationsControl({
    secret: 'ct141-built-admission-boundary-secret-00000000000001',
    sink: boundarySink,
    policy: boundaryPolicy,
    clock: () => boundaryNow,
  });
  let identityCalls = 0;
  const boundaryHandler = createHostedHttpHandler({
    identityVerifier: {verifyGoogleIdToken: async () => { identityCalls += 1; throw new Error('unused'); }},
    bootstrapService: {},
    workspaceAuthorizationService: {},
    invitationService: {},
    operationsControl: boundaryControl,
    operationsService: {},
    budgetNoticeVerifier: {verifyPubSubToken: async () => undefined},
  });
  const first = builtResponse();
  await boundaryHandler(builtHealthRequest(), first.value);
  assert.equal(first.snapshot().status, 200);
  const countersBeforeReject = boundaryControl.snapshotForTests();
  if (kind === 'clock_regression') boundaryNow = new Date('2026-08-01T00:00:54.000Z');
  const rejected = builtResponse(failure);
  const savedConsoleError = console.error;
  const boundaryErrors = [];
  console.error = (...values) => boundaryErrors.push(values);
  try {
    runHostedServerHandler(
      boundaryHandler,
      builtHealthRequest(),
      rejected.value,
      () => `ct141-built-${kind}-${failure}`,
    );
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.error = savedConsoleError;
  }
  assert.equal(rejected.snapshot().destroyed, true);
  assert.equal(identityCalls, 0);
  assert.deepEqual(boundaryControl.snapshotForTests(), countersBeforeReject);
  assert.equal(boundarySink.events.length, 2);
  assert.equal(boundarySink.events[1]?.statusCode, expectedStatus);
  assert.equal(JSON.stringify(boundarySink.events).includes('203.0.113.201'), false);
  assert.equal(JSON.stringify(boundaryErrors).includes('private'), false);
  rejectionTransportMatrix.push({kind, failure, status: boundarySink.events[1]?.statusCode});
}

console.log(JSON.stringify({
  passed: true,
  completionStatus: telemetry.events[0]?.statusCode,
  completionDurationMilliseconds: telemetry.events[0]?.durationMilliseconds,
  admissionRegressionStatus: telemetry.events[1]?.statusCode,
  admittedEvents: telemetry.events.length,
  serverRejectionStatus: serverStatus,
  serverRejectionContained: serverEnded,
  rejectionTransportMatrix,
  rawIdentifiersInTelemetry: false,
}));
