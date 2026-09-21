import assert from 'node:assert/strict';
import {
  HostedOperationsControl,
  MemoryHostedOperationsTelemetrySink,
  hostedOperationsPolicyV1,
} from '../../packages/hosted/dist/index.js';

let now = new Date('2026-08-01T00:00:00.000Z');
const secret = 'ct141-load-test-operations-secret-0000000000000000001';
const instances = Array.from({length: hostedOperationsPolicyV1.runtime.maxInstances}, () => {
  const sink = new MemoryHostedOperationsTelemetrySink();
  return {
    sink,
    control: new HostedOperationsControl({secret, sink, clock: () => now}),
  };
});

function input(index, overrides = {}) {
  return {
    correlationId: `ct141-load-request-${String(index).padStart(8, '0')}`,
    method: 'POST',
    pathname: '/api/v1/workspaces/ws_load_test/projects',
    networkAddress: '203.0.113.10',
    authorization: `Bearer ${'a'.repeat(64)}`,
    workspaceId: 'ws_load_test',
    traceId: null,
    ...overrides,
  };
}

let correlation = 0;
for (const {control, sink} of instances) {
  for (let count = 0; count < 30; count += 1) {
    const admission = control.admit(input(++correlation));
    control.complete(admission, {statusCode: 201});
  }
  const rejectedInput = input(++correlation);
  assert.throws(
    () => control.admit(rejectedInput),
    (error) => {
      control.recordAdmissionFailure(rejectedInput, error);
      return error?.code === 'OPERATIONS_RATE_LIMITED' && error.retryAfterSeconds === 60;
    },
  );
  assert.equal(sink.events.length, 31);
  assert.deepEqual(sink.events.at(-1)?.limited, true);
}

assert.equal(correlation, 93);
assert.equal(
  30 * instances.length,
  hostedOperationsPolicyV1.limits.authenticated_write.credential
    * hostedOperationsPolicyV1.runtime.maxInstances,
);

now = new Date('2026-08-01T00:01:00.000Z');
const workspaceControl = instances[0].control;
for (let count = 0; count < 60; count += 1) {
  workspaceControl.admit(input(++correlation, {
    networkAddress: `198.51.100.${count + 1}`,
    authorization: `Bearer ${String(count).padStart(64, '0')}`,
  }));
}
const workspaceRejectedInput = input(++correlation, {
  networkAddress: '198.51.100.200',
  authorization: `Bearer ${'f'.repeat(64)}`,
});
assert.throws(
  () => workspaceControl.admit(workspaceRejectedInput),
  (error) => {
    workspaceControl.recordAdmissionFailure(workspaceRejectedInput, error);
    return error?.code === 'OPERATIONS_RATE_LIMITED';
  },
);

const serialized = JSON.stringify(instances.flatMap(({sink}) => sink.events));
assert.equal(serialized.includes('203.0.113.10'), false);
assert.equal(serialized.includes('ws_load_test'), false);
assert.equal(serialized.includes('a'.repeat(64)), false);

console.log(JSON.stringify({
  passed: true,
  instances: instances.length,
  perInstanceCredentialLimit: hostedOperationsPolicyV1.limits.authenticated_write.credential,
  aggregateCredentialUpperBound: 90,
  perInstanceWorkspaceLimit: hostedOperationsPolicyV1.limits.authenticated_write.workspace,
  maximumConcurrentRequests: hostedOperationsPolicyV1.runtime.maxInstances
    * hostedOperationsPolicyV1.runtime.concurrency,
  recordedRateLimitSignals: instances.length + 1,
  rawIdentifiersInTelemetry: false,
}));
