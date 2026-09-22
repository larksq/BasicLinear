import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  createHostedHttpHandler,
  InvitationService,
  MemoryInvitationRepository,
  MemoryOwnerBootstrapRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  OwnerBootstrapService,
  WorkspaceAuthorizationService,
  type BillingService,
  type VerifiedBillingNotice,
} from '../src/index.js';
import { hostedOperationsForHttpTests } from './fixtures/operations.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';

interface TestResponse {status: number; headers: Record<string, string>; body: unknown}

function fixture(provider: VerifiedBillingNotice['provider'] = 'stripe') {
  const owner = 'owner_billing_http';
  const workspaceId = 'ws_billing_http';
  const memberships = new MemoryWorkspaceMembershipReader();
  memberships.set({schemaVersion: 1, workspaceId, userId: owner, role: 'owner', status: 'active', revision: 1});
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
  );
  const calls: Array<{name: string; value?: unknown}> = [];
  const billingService = {
    summary: async (value: unknown) => {
      calls.push({name: 'summary', value});
      return {workspaceId, mode: 'trial_pro'};
    },
    createCheckout: async (value: unknown) => {
      calls.push({name: 'checkout', value});
      return {
        checkoutSessionId: 'cs_billing_http', checkoutUrl: 'https://checkout.stripe.test/billing',
        plan: 'monthly', activeSeats: 2, totalCents: 400, currency: 'usd',
        expiresAt: '2026-09-01T00:30:00.000Z',
      };
    },
    removeMember: async (value: unknown) => {
      calls.push({name: 'removeMember', value});
      return {
        changed: true,
        userId: (value as {userId: string}).userId,
        activeSeats: 1,
      };
    },
    reconcileNotice: async (value: unknown) => {
      calls.push({name: 'reconcile', value});
      return {workspaceId, mode: 'paid_pro'};
    },
  } as unknown as BillingService;
  let verifiedNotice: VerifiedBillingNotice | null = {
    provider, eventId: 'evt_billing_http', eventCreatedAt: '2026-09-01T00:00:00.000Z',
    subscriptionId: 'sub_billing_http', checkoutSessionId: 'cs_billing_http',
  };
  let verifierThrows = false;
  let identityCalls = 0;
  const handler = createHostedHttpHandler({
    ...hostedOperationsForHttpTests(() => new Date('2026-08-20T00:00:00.000Z')),
    identityVerifier: {verifyGoogleIdToken: async () => {
      identityCalls += 1;
      return {uid: owner, email: 'owner@example.com', emailVerified: true, displayName: 'Owner', provider: 'google.com'};
    }},
    bootstrapService: new OwnerBootstrapService(new MemoryOwnerBootstrapRepository()),
    workspaceAuthorizationService: authorization,
    invitationService: new InvitationService(new MemoryInvitationRepository(), authorization, {
      secret: 'billing-http-invitation-secret-at-least-32-bytes',
      entitlementPolicy: proEntitlementPolicyForTests,
      seatReconciler: noopBillingSeatReconcilerForTests,
    }),
    billingService,
    billingWebhookProvider: provider,
    billingWebhookVerifier: {verifyWebhook: (rawBody, signature) => {
      calls.push({name: 'verify', value: {rawBody: rawBody.toString('utf8'), signature}});
      if (verifierThrows) throw new Error('bad signature');
      return verifiedNotice;
    }},
    allowedOrigins: ['https://online.example.com'],
  });

  const invoke = async (
    method: string,
    path: string,
    body = '',
    headers: IncomingHttpHeaders = {},
  ): Promise<TestResponse> => {
    const request = Readable.from(body === '' ? [] : [Buffer.from(body)]) as IncomingMessage;
    Object.assign(request, {
      method, url: path,
      headers: {
        ...(body === '' ? {} : {'content-length': String(Buffer.byteLength(body))}),
        ...headers,
      },
    });
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let responseBody = '';
    const response = {
      writeHead(value: number, values: Record<string, string>) { status = value; responseHeaders = values; return this; },
      end(value?: string) { responseBody = value ?? ''; return this; },
    } as unknown as ServerResponse;
    await handler(request, response);
    return {status, headers: responseHeaders, body: responseBody === '' ? null : JSON.parse(responseBody)};
  };
  return {
    calls, invoke,
    identityCalls: () => identityCalls,
    setVerifierThrows(value: boolean) { verifierThrows = value; },
    setNotice(value: VerifiedBillingNotice | null) { verifiedNotice = value; },
  };
}

describe('hosted billing HTTP boundary', () => {
  it('returns an owner summary and creates checkout from the exact plan-only shape', async () => {
    const {invoke, calls} = fixture();
    const headers = {authorization: `Bearer ${'a'.repeat(32)}`, origin: 'https://online.example.com'};
    expect((await invoke('GET', '/api/v1/hosted/workspaces/ws_billing_http/billing', '', headers)).status).toBe(200);
    const response = await invoke(
      'POST', '/api/v1/hosted/workspaces/ws_billing_http/billing/checkout',
      JSON.stringify({plan: 'monthly'}),
      {...headers, 'idempotency-key': 'billing-checkout-key-0001'},
    );
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(calls.find((value) => value.name === 'checkout')?.value).toMatchObject({
      workspaceId: 'ws_billing_http', plan: 'monthly', idempotencyKey: 'billing-checkout-key-0001',
    });

    const removal = await invoke(
      'DELETE', '/api/v1/hosted/workspaces/ws_billing_http/members/member_billing_http', '{}',
      {...headers, 'idempotency-key': 'billing-member-remove-key-0001'},
    );
    expect(removal.status).toBe(200);
    expect(removal.body).toEqual({data: {
      changed: true, userId: 'member_billing_http', activeSeats: 1,
    }});
    expect(calls.find((value) => value.name === 'removeMember')?.value).toMatchObject({
      workspaceId: 'ws_billing_http', userId: 'member_billing_http',
      idempotencyKey: 'billing-member-remove-key-0001',
    });
  });

  it('rejects all browser amount, quantity, customer, trial, metadata, and return-url injection before identity', async () => {
    const context = fixture();
    for (const extra of [
      {amount: 1}, {quantity: 1}, {customerId: 'cus_attacker'}, {trialDays: 999},
      {metadata: {workspaceId: 'foreign'}}, {successUrl: 'https://hostile.example'},
    ]) {
      const response = await context.invoke(
        'POST', '/api/v1/hosted/workspaces/ws_billing_http/billing/checkout',
        JSON.stringify({plan: 'monthly', ...extra}),
        {authorization: `Bearer ${'a'.repeat(32)}`, origin: 'https://online.example.com', 'idempotency-key': 'billing-shape-key-0001'},
      );
      expect(response.status).toBe(400);
    }
    expect(context.identityCalls()).toBe(0);
    expect(context.calls.some((value) => value.name === 'checkout')).toBe(false);
  });

  it('rejects member-removal body injection before identity or mutation', async () => {
    const context = fixture();
    const response = await context.invoke(
      'DELETE', '/api/v1/hosted/workspaces/ws_billing_http/members/member_billing_http',
      JSON.stringify({role: 'owner'}),
      {
        authorization: `Bearer ${'a'.repeat(32)}`,
        origin: 'https://online.example.com',
        'idempotency-key': 'billing-member-remove-key-0002',
      },
    );
    expect(response.status).toBe(400);
    expect(context.identityCalls()).toBe(0);
    expect(context.calls.some((value) => value.name === 'removeMember')).toBe(false);

    const malformedPath = fixture();
    expect((await malformedPath.invoke(
      'DELETE', '/api/v1/hosted/workspaces/ws_billing_http/members/member%ZZ', '{}',
      {
        authorization: `Bearer ${'a'.repeat(32)}`,
        origin: 'https://online.example.com',
        'idempotency-key': 'billing-member-remove-key-0003',
      },
    )).status).toBe(400);
    expect(malformedPath.identityCalls()).toBe(0);
  });

  it('verifies the exact raw webhook before reconciliation and does not require bearer auth', async () => {
    const context = fixture();
    const raw = '{"id":"evt_billing_http","private":"never echo"}';
    const response = await context.invoke(
      'POST', '/api/v1/hosted/billing/stripe/webhook', raw,
      {'stripe-signature': 't=1788220800,v1=signaturevalue'},
    );
    expect(response.status).toBe(200);
    expect(context.identityCalls()).toBe(0);
    expect(context.calls.slice(-2)).toEqual([
      {name: 'verify', value: {rawBody: raw, signature: 't=1788220800,v1=signaturevalue'}},
      {name: 'reconcile', value: expect.objectContaining({eventId: 'evt_billing_http'})},
    ]);
    expect(JSON.stringify(response.body)).not.toContain('private');
  });

  it('fails invalid signatures, oversized bodies, and hostile browser origins before reconciliation', async () => {
    const badSignature = fixture();
    badSignature.setVerifierThrows(true);
    expect((await badSignature.invoke(
      'POST', '/api/v1/hosted/billing/stripe/webhook', '{}',
      {'stripe-signature': 't=1788220800,v1=invalidsignature'},
    )).status).toBe(400);
    expect(badSignature.calls.some((value) => value.name === 'reconcile')).toBe(false);

    const oversized = fixture();
    expect((await oversized.invoke(
      'POST', '/api/v1/hosted/billing/stripe/webhook', '',
      {'content-length': '262145', 'stripe-signature': 't=1788220800,v1=signaturevalue'},
    )).status).toBe(413);
    expect(oversized.calls).toHaveLength(0);

    const hostile = fixture();
    expect((await hostile.invoke(
      'POST', '/api/v1/hosted/billing/stripe/webhook', '{}',
      {origin: 'https://hostile.example', 'stripe-signature': 't=1788220800,v1=signaturevalue'},
    )).status).toBe(403);
    expect(hostile.calls).toHaveLength(0);
  });
});

it('routes Creem webhooks only through the configured signature verifier', async () => {
  const context = fixture('creem');
  const path = '/api/v1/hosted/billing/creem/webhook';
  expect((await context.invoke('POST', path, '{}', {'creem-signature': 'a'.repeat(64)})).status).toBe(200);
  expect(context.calls.find(call => call.name === 'reconcile')?.value).toMatchObject({provider: 'creem'});
  expect(context.identityCalls()).toBe(0);
  expect((await context.invoke('POST', path, '{}', {'stripe-signature': 'a'.repeat(64)})).status).toBe(400);
  expect((await context.invoke('POST', '/api/v1/hosted/billing/stripe/webhook', '{}', {'stripe-signature': 'a'.repeat(64)})).status).toBe(503);
});
