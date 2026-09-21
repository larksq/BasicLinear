import { describe, expect, it } from 'vitest';
import {
  classifyHostedOperationsRoute,
  hostedOperationsPolicyDigest,
  hostedOperationsPolicyV1,
  HostedOperationsControl,
  HostedOperationsControlError,
  MemoryHostedOperationsTelemetrySink,
  type HostedOperationsPolicy,
} from '../src/index.js';

const secret = 'operations-control-test-secret-000000000000000000001';

function policyWithWriteLimits(input: {
  global: number;
  network: number;
  credential: number;
  workspace: number;
  maxTrackedBuckets?: number;
}): HostedOperationsPolicy {
  const policy = structuredClone(hostedOperationsPolicyV1);
  policy.limits.authenticated_write = {
    global: input.global,
    network: input.network,
    credential: input.credential,
    workspace: input.workspace,
  };
  if (input.maxTrackedBuckets !== undefined) policy.maxTrackedBuckets = input.maxTrackedBuckets;
  return policy;
}

describe('HostedOperationsControl', () => {
  it('classifies every public, provider, OAuth, MCP, and authenticated route boundary', () => {
    expect(classifyHostedOperationsRoute('/health/ready', 'GET')).toBe('health');
    expect(classifyHostedOperationsRoute('/api/v1/hosted/invitations/inspect', 'POST')).toBe('public_read');
    expect(classifyHostedOperationsRoute('/api/v1/hosted/invitations/accept', 'POST')).toBe('public_write');
    expect(classifyHostedOperationsRoute('/api/v1/hosted/billing/stripe/webhook', 'POST')).toBe('provider_webhook');
    expect(classifyHostedOperationsRoute('/api/v1/hosted/operations/budget-notice', 'POST')).toBe('provider_webhook');
    expect(classifyHostedOperationsRoute('/oauth/token', 'POST')).toBe('oauth');
    expect(classifyHostedOperationsRoute('/.well-known/oauth-authorization-server', 'GET')).toBe('oauth');
    expect(classifyHostedOperationsRoute('/mcp', 'POST')).toBe('mcp');
    expect(classifyHostedOperationsRoute('/api/v1/workspaces/ws_123/projects', 'GET')).toBe('authenticated_read');
    expect(classifyHostedOperationsRoute('/api/v1/workspaces/ws_123/projects', 'POST')).toBe('authenticated_write');
    expect(hostedOperationsPolicyDigest()).toMatch(/^[a-f0-9]{64}$/u);
    expect(Object.isFrozen(hostedOperationsPolicyV1)).toBe(true);
    expect(Object.isFrozen(hostedOperationsPolicyV1.limits)).toBe(true);
    expect(Object.isFrozen(hostedOperationsPolicyV1.limits.authenticated_write)).toBe(true);
  });

  it('copies caller-owned policy and binary secret material before enforcement', () => {
    const mutablePolicy = policyWithWriteLimits({
      global: 10,
      network: 10,
      credential: 1,
      workspace: 10,
    });
    const mutableSecret = new Uint8Array(32).fill(7);
    const first = new HostedOperationsControl({
      secret: mutableSecret,
      sink: new MemoryHostedOperationsTelemetrySink(),
      policy: mutablePolicy,
      clock: () => new Date('2026-08-01T00:00:00.000Z'),
    });
    mutablePolicy.limits.authenticated_write.credential = 10;
    mutableSecret.fill(8);
    const input = {
      correlationId: 'request-operations-copy-0001',
      method: 'POST',
      pathname: '/api/v1/workspaces/ws_copy/projects',
      networkAddress: '203.0.113.44',
      authorization: `Bearer ${'c'.repeat(64)}`,
      workspaceId: 'ws_copy',
      traceId: null,
    };
    const admission = first.admit(input);
    expect(() => first.admit({...input, correlationId: 'request-operations-copy-0002'}))
      .toThrowError(expect.objectContaining({code: 'OPERATIONS_RATE_LIMITED'}));

    const second = new HostedOperationsControl({
      secret: new Uint8Array(32).fill(7),
      sink: new MemoryHostedOperationsTelemetrySink(),
      policy: policyWithWriteLimits({global: 10, network: 10, credential: 1, workspace: 10}),
      clock: () => new Date('2026-08-01T00:00:00.000Z'),
    });
    expect(second.admit({...input, correlationId: 'request-operations-copy-0003'}).networkFingerprint)
      .toBe(admission.networkFingerprint);
  });

  it('atomically applies the most restrictive per-window network, credential, and workspace limit', () => {
    let now = new Date('2026-08-01T00:00:00.000Z');
    const sink = new MemoryHostedOperationsTelemetrySink();
    const control = new HostedOperationsControl({
      secret,
      sink,
      policy: policyWithWriteLimits({global: 10, network: 4, credential: 1, workspace: 3}),
      clock: () => now,
    });
    const input = {
      correlationId: 'request-operations-00000001',
      method: 'POST',
      pathname: '/api/v1/workspaces/ws_limits/projects',
      networkAddress: '203.0.113.8',
      authorization: `Bearer ${'a'.repeat(64)}`,
      workspaceId: 'ws_limits',
      traceId: 'b'.repeat(32),
    };
    const admission = control.admit(input);
    expect(admission).toMatchObject({
      routeClass: 'authenticated_write',
      limit: 1,
      remaining: 0,
      traceId: 'b'.repeat(32),
      windowEndsAt: '2026-08-01T00:01:00.000Z',
    });
    const beforeReject = control.snapshotForTests();
    expect(() => control.admit({...input, correlationId: 'request-operations-00000002'}))
      .toThrowError(expect.objectContaining({code: 'OPERATIONS_RATE_LIMITED', retryAfterSeconds: 60}));
    expect(control.snapshotForTests()).toEqual(beforeReject);

    try {
      control.admit({...input, correlationId: 'request-operations-00000004'});
    } catch (error) {
      expect(error).toBeInstanceOf(HostedOperationsControlError);
      control.recordAdmissionFailure(
        {...input, correlationId: 'request-operations-00000004'},
        error as HostedOperationsControlError,
      );
    }

    control.complete(admission, {statusCode: 201});
    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]).toMatchObject({
      correlationId: 'request-operations-00000004',
      statusCode: 429,
      outcome: 'rejected',
      limited: true,
      routeClass: 'authenticated_write',
    });
    expect(sink.events[1]).toMatchObject({
      correlationId: input.correlationId,
      statusCode: 201,
      outcome: 'succeeded',
      routeClass: 'authenticated_write',
    });
    const serialized = JSON.stringify(sink.events);
    expect(serialized).not.toContain('203.0.113.8');
    expect(serialized).not.toContain('ws_limits');
    expect(serialized).not.toContain('a'.repeat(64));
    expect(sink.events[0]?.networkFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(sink.events[0]?.credentialFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(sink.events[0]?.workspaceFingerprint).toMatch(/^[a-f0-9]{64}$/u);

    now = new Date('2026-08-01T00:01:00.000Z');
    expect(control.admit({...input, correlationId: 'request-operations-00000003'}).remaining).toBe(0);
  });

  it('fails closed on clock regression and bounded-bucket exhaustion without partial counters', () => {
    let now = new Date('2026-08-01T00:01:00.000Z');
    const control = new HostedOperationsControl({
      secret,
      sink: new MemoryHostedOperationsTelemetrySink(),
      policy: policyWithWriteLimits({
        global: 20,
        network: 20,
        credential: 20,
        workspace: 20,
        maxTrackedBuckets: 3,
      }),
      clock: () => now,
    });
    const base = {
      method: 'POST',
      pathname: '/api/v1/workspaces/ws_limits/projects',
      authorization: null,
      workspaceId: 'ws_limits',
      traceId: null,
    };
    control.admit({
      ...base,
      correlationId: 'request-operations-00000011',
      networkAddress: '203.0.113.10',
    });
    const full = control.snapshotForTests();
    expect(Object.keys(full)).toHaveLength(3);
    expect(() => control.admit({
      ...base,
      correlationId: 'request-operations-00000012',
      networkAddress: '203.0.113.11',
    })).toThrowError(expect.objectContaining({code: 'OPERATIONS_RATE_LIMITED'}));
    expect(control.snapshotForTests()).toEqual(full);

    now = new Date('2026-08-01T00:00:54.999Z');
    expect(() => control.admit({
      ...base,
      correlationId: 'request-operations-00000013',
      networkAddress: '203.0.113.10',
    })).toThrowError(expect.objectContaining({code: 'OPERATIONS_UNAVAILABLE'}));
    expect(control.snapshotForTests()).toEqual(full);
  });

  it('contains completion and admission-failure clock regression with exactly one redacted event', () => {
    let now = new Date('2026-08-01T00:01:00.000Z');
    const sink = new MemoryHostedOperationsTelemetrySink();
    const control = new HostedOperationsControl({
      secret,
      sink,
      clock: () => now,
    });
    const base = {
      method: 'GET',
      pathname: '/health/ready',
      networkAddress: '203.0.113.91',
      authorization: `Bearer ${'q'.repeat(64)}`,
      workspaceId: null,
      traceId: null,
    };
    const admission = control.admit({
      ...base,
      correlationId: 'request-completion-regression-0001',
    });
    now = new Date('2026-08-01T00:00:54.000Z');
    expect(() => control.complete(admission, {statusCode: 200})).not.toThrow();
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      correlationId: 'request-completion-regression-0001',
      occurredAt: '2026-08-01T00:01:00.000Z',
      statusCode: 200,
      durationMilliseconds: 0,
      outcome: 'succeeded',
    });

    let failure: HostedOperationsControlError | null = null;
    try {
      control.admit({...base, correlationId: 'request-admission-regression-0002'});
    } catch (error) {
      expect(error).toBeInstanceOf(HostedOperationsControlError);
      failure = error as HostedOperationsControlError;
    }
    expect(failure?.code).toBe('OPERATIONS_UNAVAILABLE');
    expect(() => control.recordAdmissionFailure(
      {...base, correlationId: 'request-admission-regression-0002'},
      failure as HostedOperationsControlError,
    )).not.toThrow();
    expect(sink.events).toHaveLength(2);
    expect(sink.events[1]).toMatchObject({
      correlationId: 'request-admission-regression-0002',
      occurredAt: '2026-08-01T00:01:00.000Z',
      statusCode: 503,
      durationMilliseconds: 0,
      outcome: 'failed',
      limited: false,
    });
    const serialized = JSON.stringify(sink.events);
    expect(serialized).not.toContain('203.0.113.91');
    expect(serialized).not.toContain('q'.repeat(64));
  });
});
