import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildHostedCostPerPaidSeatReport,
  createHostedHttpHandler,
  HostedOperationsControl,
  HostedOperationsService,
  InvitationService,
  MemoryHostedOperationsRepository,
  MemoryHostedOperationsTelemetrySink,
  MemoryInvitationRepository,
  MemoryOwnerBootstrapRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  OwnerBootstrapService,
  WorkspaceAuthorizationService,
  type HostedEconomicsRecord,
} from '../src/index.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const operationsSecret = 'operations-http-test-secret-0000000000000000000001';
const providerToken = 'verified-pubsub-oidc-token-'.padEnd(80, 'x');
let now: Date;

function sourceEconomics(): HostedEconomicsRecord[] {
  return [
    {
      schemaVersion: 'openlinear.hosted-measurement.v1',
      id: 'economics:http-cost',
      workspaceId: 'workspace-http-operations',
      provider: 'firebase',
      kind: 'variable_cost',
      category: 'hosted-runtime',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      amountMicrousd: 200_000,
      activePaidSeats: 1,
      sourceRef: 'billing-export:http-cost',
      retrievedAt: '2026-08-01T01:00:00.000Z',
    },
    {
      schemaVersion: 'openlinear.hosted-measurement.v1',
      id: 'economics:http-revenue',
      workspaceId: 'workspace-http-operations',
      provider: 'stripe',
      kind: 'recognized_revenue',
      category: 'subscription-revenue',
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-08-01T00:00:00.000Z',
      amountMicrousd: 2_000_000,
      activePaidSeats: 1,
      sourceRef: 'stripe-balance:http-revenue',
      retrievedAt: '2026-08-01T01:00:00.000Z',
    },
  ];
}

function budgetEnvelope(): Record<string, unknown> {
  const payload = {
    budgetDisplayName: 'OpenLinear pilot budget',
    costAmount: 13,
    costIntervalStart: '2026-08-01T00:00:00Z',
    budgetAmount: 25,
    budgetAmountType: 'SPECIFIED_AMOUNT',
    currencyCode: 'USD',
    alertThresholdExceeded: 0.5,
  };
  return {
    deliveryAttempt: 1,
    message: {
      attributes: {
        billingAccountId: '000AAA-BBB111-CCC222',
        budgetId: 'budget-operations-http',
        schemaVersion: '1.0',
      },
      data: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'),
      messageId: '9876543210',
      publishTime: '2026-08-01T04:00:00Z',
    },
    subscription: 'projects/openlinear-uat/subscriptions/budget-alerts',
  };
}

async function fixture(options: {controlClock?: () => Date} = {}) {
  const repository = new MemoryHostedOperationsRepository();
  const operationsService = new HostedOperationsService(repository, {
    secret: operationsSecret,
    environment: 'uat',
    clock: () => now,
  });
  const economics = sourceEconomics();
  const costReport = buildHostedCostPerPaidSeatReport({
    generatedAt: '2026-08-01T02:00:00.000Z',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z',
    evidenceClass: 'production_baseline',
    paidWorkspaceIds: ['workspace-http-operations'],
    economics,
  });
  await operationsService.installActivationEvidence({
    reviewId: 'review-http-operations-1',
    environment: 'uat',
    reviewedAt: '2026-08-01T03:00:00.000Z',
    expiresAt: '2026-08-02T03:00:00.000Z',
    budgetIntervalStart: '2026-08-01T00:00:00.000Z',
    providerReferences: {
      budgetDisplayName: 'OpenLinear pilot budget',
      billingAccountId: '000AAA-BBB111-CCC222',
      budgetId: 'budget-operations-http',
      pubsubSubscription: 'projects/openlinear-uat/subscriptions/budget-alerts',
      cloudRunService: 'openlinear-hosted-api',
      cloudArmorPolicy: 'openlinear-hosted-edge',
      billingExportDataset: 'openlinear_billing_export',
      backupBucket: 'openlinear-firestore-backups',
      restoreProject: 'restore-drill-openlinear-uat',
    },
    paidWorkspaceIds: ['workspace-http-operations'],
    economics,
    costReport,
  });
  const memberships = new MemoryWorkspaceMembershipReader();
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
  );
  let verifierCalls = 0;
  const telemetrySink = new MemoryHostedOperationsTelemetrySink();
  const handler = createHostedHttpHandler({
    readinessCheck: async () => {},
    identityVerifier: {verifyGoogleIdToken: async () => { throw new Error('unused'); }},
    bootstrapService: new OwnerBootstrapService(new MemoryOwnerBootstrapRepository()),
    workspaceAuthorizationService: authorization,
    invitationService: new InvitationService(
      new MemoryInvitationRepository(),
      authorization,
      {
        secret: 'operations-http-invitation-secret-00000000000000001',
        entitlementPolicy: proEntitlementPolicyForTests,
        seatReconciler: noopBillingSeatReconcilerForTests,
      },
    ),
    operationsControl: new HostedOperationsControl({
      secret: operationsSecret,
      sink: telemetrySink,
      clock: options.controlClock ?? (() => now),
    }),
    operationsService,
    budgetNoticeVerifier: {
      verifyPubSubToken: async (token) => {
        verifierCalls += 1;
        if (token !== providerToken) throw new Error('invalid identity');
      },
    },
  });
  return {handler, repository, telemetrySink, verifierCalls: () => verifierCalls};
}

async function invoke(
  handler: ReturnType<typeof createHostedHttpHandler>,
  options: {body: string; contentType?: string; tokens?: string[]},
): Promise<{status: number; body: unknown; headers: Record<string, string>}> {
  const contentType = options.contentType ?? 'application/json; charset=utf-8';
  const tokens = options.tokens ?? [providerToken];
  const request = Readable.from([options.body]) as unknown as IncomingMessage;
  const rawHeaders = [
    'Host', 'openlinear.test',
    'Content-Type', contentType,
    'Content-Length', String(Buffer.byteLength(options.body, 'utf8')),
    ...tokens.flatMap((token) => ['Authorization', `Bearer ${token}`]),
  ];
  Object.assign(request, {
    method: 'POST',
    url: '/api/v1/hosted/operations/budget-notice',
    headers: {
      host: 'openlinear.test',
      'content-type': contentType,
      'content-length': String(Buffer.byteLength(options.body, 'utf8')),
      authorization: `Bearer ${tokens[0] ?? ''}`,
    },
    rawHeaders,
  });
  let status = 0;
  let responseHeaders: Record<string, string> = {};
  let payload = '';
  const response = {
    statusCode: 200,
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
  return {
    status,
    headers: responseHeaders,
    body: payload === '' ? null : JSON.parse(payload) as unknown,
  };
}

async function invokeHealth(
  handler: ReturnType<typeof createHostedHttpHandler>,
): Promise<{status: number; body: unknown}> {
  const request = Readable.from([]) as unknown as IncomingMessage;
  Object.assign(request, {
    method: 'GET',
    url: '/health/ready',
    headers: {host: 'openlinear.test'},
    rawHeaders: ['Host', 'openlinear.test'],
  });
  let status = 0;
  let payload = '';
  const response = {
    statusCode: 200,
    writeHead: (nextStatus: number) => {
      status = nextStatus;
      response.statusCode = nextStatus;
      return response;
    },
    end: (value?: string) => {
      payload = value ?? '';
      return response;
    },
  } as unknown as ServerResponse;
  await handler(request, response);
  return {status, body: payload === '' ? null : JSON.parse(payload) as unknown};
}

describe('hosted budget push HTTP boundary', () => {
  beforeEach(() => {
    now = new Date('2026-08-01T05:00:00.000Z');
  });

  it('accepts an exact authenticated wrapped Pub/Sub notice and safely replays it', async () => {
    const context = await fixture();
    const body = JSON.stringify(budgetEnvelope());
    await expect(invoke(context.handler, {body})).resolves.toMatchObject({
      status: 200,
      body: {received: true},
      headers: {'cache-control': 'no-store', 'x-content-type-options': 'nosniff'},
    });
    const afterFirst = context.repository.snapshot();
    now = new Date('2026-08-01T06:00:00.000Z');
    await expect(invoke(context.handler, {body})).resolves.toMatchObject({status: 200});
    expect(context.repository.snapshot()).toEqual(afterFirst);
    expect(context.verifierCalls()).toBe(2);
  });

  it('rejects malformed media and duplicate provider authorization before service mutation', async () => {
    const context = await fixture();
    const baseline = context.repository.snapshot();
    const body = JSON.stringify(budgetEnvelope());
    await expect(invoke(context.handler, {body, contentType: 'text/plain'}))
      .resolves.toMatchObject({status: 400});
    expect(context.verifierCalls()).toBe(0);
    expect(context.repository.snapshot()).toEqual(baseline);

    await expect(invoke(context.handler, {body, tokens: [providerToken, providerToken]}))
      .resolves.toMatchObject({status: 401});
    expect(context.verifierCalls()).toBe(0);
    expect(context.repository.snapshot()).toEqual(baseline);
  });

  it('rejects unsupported envelope keys, duplicate JSON keys, and untrusted identities', async () => {
    const context = await fixture();
    const baseline = context.repository.snapshot();
    await expect(invoke(context.handler, {
      body: JSON.stringify({...budgetEnvelope(), unexpected: true}),
    })).resolves.toMatchObject({status: 400});
    await expect(invoke(context.handler, {
      body: `{"subscription":"one","subscription":"two","message":{}}`,
    })).resolves.toMatchObject({status: 400});
    await expect(invoke(context.handler, {
      body: JSON.stringify(budgetEnvelope()),
      tokens: ['untrusted-token-value-'.padEnd(80, 'z')],
    })).resolves.toMatchObject({status: 401});
    expect(context.repository.snapshot()).toEqual(baseline);
  });

  it('contains post-response clock regression and records admission-time regression once', async () => {
    const completionTimes = [
      new Date('2026-08-01T00:01:00.000Z'),
      new Date('2026-08-01T00:00:54.000Z'),
    ];
    let completionCall = 0;
    const completion = await fixture({
      controlClock: () => completionTimes[Math.min(completionCall++, 1)] as Date,
    });
    await expect(invokeHealth(completion.handler)).resolves.toMatchObject({
      status: 200,
      body: {status: 'ready'},
    });
    expect(completion.telemetrySink.events).toHaveLength(1);
    expect(completion.telemetrySink.events[0]).toMatchObject({
      statusCode: 200,
      occurredAt: '2026-08-01T00:01:00.000Z',
      durationMilliseconds: 0,
    });

    const admissionTimes = [
      new Date('2026-08-01T00:01:00.000Z'),
      new Date('2026-08-01T00:01:00.000Z'),
      new Date('2026-08-01T00:00:54.000Z'),
      new Date('2026-08-01T00:00:54.000Z'),
    ];
    let admissionCall = 0;
    const admission = await fixture({
      controlClock: () => admissionTimes[Math.min(admissionCall++, 3)] as Date,
    });
    await expect(invokeHealth(admission.handler)).resolves.toMatchObject({status: 200});
    await expect(invokeHealth(admission.handler)).resolves.toMatchObject({
      status: 503,
      body: {error: {code: 'OPERATIONS_UNAVAILABLE'}},
    });
    expect(admission.telemetrySink.events).toHaveLength(2);
    expect(admission.telemetrySink.events[1]).toMatchObject({
      statusCode: 503,
      occurredAt: '2026-08-01T00:01:00.000Z',
      durationMilliseconds: 0,
      outcome: 'failed',
      limited: false,
    });
  });
});
