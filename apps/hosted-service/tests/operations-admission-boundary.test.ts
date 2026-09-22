import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import {
  createHostedHttpHandler,
  HostedOperationsControl,
  hostedOperationsPolicyV1,
  MemoryHostedOperationsTelemetrySink,
  type HostedOperationsPolicy,
} from '@basiclinear/hosted';
import { runHostedServerHandler } from '../src/server-boundary.js';

function healthRequest(): IncomingMessage {
  return {
    method: 'GET',
    url: '/health/ready',
    headers: {host: 'basiclinear.test'},
    rawHeaders: ['Host', 'basiclinear.test'],
    socket: {remoteAddress: '203.0.113.211'},
  } as unknown as IncomingMessage;
}

function responseFixture(failure: 'none' | 'writeHead' | 'end') {
  let status = 0;
  let destroyed = false;
  const response = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    writeHead(nextStatus: number) {
      if (failure === 'writeHead') throw new Error('private writeHead transport failure');
      status = nextStatus;
      response.statusCode = nextStatus;
      response.headersSent = true;
      return response;
    },
    end() {
      if (failure === 'end') throw new Error('private end transport failure');
      response.writableEnded = true;
      return response;
    },
    destroy() {
      destroyed = true;
      response.destroyed = true;
      return response;
    },
  } as unknown as ServerResponse;
  return {response, snapshot: () => ({status, destroyed})};
}

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function policyWithOneHealthRequest(): HostedOperationsPolicy {
  const policy = structuredClone(hostedOperationsPolicyV1);
  policy.limits.health = {global: 1, network: 1, credential: null, workspace: null};
  return policy;
}

function context(kind: 'rate_limit' | 'clock_regression') {
  let now = new Date('2026-08-01T00:01:00.000Z');
  let identityCalls = 0;
  const sink = new MemoryHostedOperationsTelemetrySink();
  const control = new HostedOperationsControl({
    secret: 'operations-admission-boundary-secret-0000000000000001',
    sink,
    policy: kind === 'rate_limit' ? policyWithOneHealthRequest() : hostedOperationsPolicyV1,
    clock: () => now,
  });
  const handler = createHostedHttpHandler({
    readinessCheck: async () => {},
    identityVerifier: {
      verifyGoogleIdToken: async () => {
        identityCalls += 1;
        throw new Error('identity must remain outside the health admission probe');
      },
    },
    bootstrapService: {} as never,
    workspaceAuthorizationService: {} as never,
    invitationService: {} as never,
    operationsControl: control,
    operationsService: {} as never,
    budgetNoticeVerifier: {verifyPubSubToken: async () => undefined},
  });
  return {
    control,
    handler,
    sink,
    identityCalls: () => identityCalls,
    regressClock: () => { now = new Date('2026-08-01T00:00:54.000Z'); },
  };
}

describe('hosted operations rejection transport boundary', () => {
  it('keeps liveness available when operations admission is unavailable', async () => {
    const current = context('clock_regression');
    await current.handler(healthRequest(), responseFixture('none').response);
    current.regressClock();
    const readyResponse = responseFixture('none');
    await current.handler(healthRequest(), readyResponse.response);
    expect(readyResponse.snapshot().status).toBe(503);
    const liveResponse = responseFixture('none');
    await current.handler({...healthRequest(), url: '/health/live'} as IncomingMessage, liveResponse.response);
    expect(liveResponse.snapshot().status).toBe(200);
  });

  it.each([
    ['rate_limit', 'writeHead', 429, 'rejected'],
    ['rate_limit', 'end', 429, 'rejected'],
    ['clock_regression', 'writeHead', 503, 'failed'],
    ['clock_regression', 'end', 503, 'failed'],
  ] as const)(
    'records one redacted %s event when response.%s throws',
    async (kind, failure, expectedStatus, expectedOutcome) => {
      const current = context(kind);
      const firstResponse = responseFixture('none');
      await current.handler(healthRequest(), firstResponse.response);
      expect(firstResponse.snapshot().status).toBe(200);
      expect(current.sink.events).toHaveLength(1);
      const countersBeforeReject = current.control.snapshotForTests();
      if (kind === 'clock_regression') current.regressClock();

      const rejectedResponse = responseFixture(failure);
      const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      runHostedServerHandler(
        current.handler,
        healthRequest(),
        rejectedResponse.response,
        () => `contained-${kind}-${failure}`,
      );
      await nextTurn();

      expect(rejectedResponse.snapshot().destroyed).toBe(true);
      expect(current.identityCalls()).toBe(0);
      expect(current.control.snapshotForTests()).toEqual(countersBeforeReject);
      expect(current.sink.events).toHaveLength(2);
      expect(current.sink.events[1]).toMatchObject({
        statusCode: expectedStatus,
        outcome: expectedOutcome,
        durationMilliseconds: 0,
        limited: expectedStatus === 429,
      });
      const serialized = JSON.stringify(current.sink.events);
      expect(serialized).not.toContain('203.0.113.211');
      expect(serialized).not.toContain('private');
      expect(stderr).toHaveBeenCalledOnce();
      expect(JSON.stringify(stderr.mock.calls)).not.toContain('private');
      stderr.mockRestore();
    },
  );
});
