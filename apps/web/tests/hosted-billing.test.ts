import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createHostedBillingCheckout,
  getHostedBillingSummary,
  removeHostedMember,
} from '../src/hosted-api.js';

const response = (data: unknown, status = 200) => new Response(
  JSON.stringify({data}),
  {status, headers: {'content-type': 'application/json'}},
);

describe('hosted billing client', () => {
  it('uses same-origin GET and plan-only checkout requests without a browser amount or quantity', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({
        workspaceId: 'ws_billing_client', mode: 'trial_pro',
        trial: {startedAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-31T00:00:00.000Z', active: true},
        seats: {active: 3, pendingInvitations: 2},
        prices: {currency: 'usd', monthlyPerSeatCents: 200, annualPerSeatCents: 1200,
          monthlyTotalCents: 600, annualTotalCents: 3600},
        subscription: null,
        free: {writerUserId: 'owner_client', dataReadable: true,
          exportEligible: true, exportAvailable: true,
          extraMemberWritesPaused: true, automationWritesPaused: true},
      }))
      .mockResolvedValueOnce(response({
        checkoutSessionId: 'cs_billing_client', checkoutUrl: 'https://checkout.stripe.test/client',
        plan: 'annual', activeSeats: 3, totalCents: 3600, currency: 'usd',
        expiresAt: '2026-08-20T01:00:00.000Z',
      }, 201))
      .mockResolvedValueOnce(response({
        changed: true, userId: 'member_client', activeSeats: 2,
      }));

    const summary = await getHostedBillingSummary('firebase-token', 'ws_billing_client', fetcher);
    const checkout = await createHostedBillingCheckout(
      'firebase-token', 'ws_billing_client', 'annual', 'billing-client-key-0001', fetcher,
    );
    const removal = await removeHostedMember(
      'firebase-token', 'ws_billing_client', 'member_client', 'billing-remove-key-0001', fetcher,
    );
    expect(summary.prices).toMatchObject({monthlyTotalCents: 600, annualTotalCents: 3600});
    expect(checkout.totalCents).toBe(3600);
    expect(removal).toEqual({changed: true, userId: 'member_client', activeSeats: 2});
    expect(fetcher.mock.calls).toHaveLength(3);
    expect(fetcher.mock.calls[0]).toEqual([
      '/api/v1/hosted/workspaces/ws_billing_client/billing',
      expect.objectContaining({method: 'GET', credentials: 'same-origin'}),
    ]);
    const [, init] = fetcher.mock.calls[1] ?? [];
    expect(init).toMatchObject({
      method: 'POST', credentials: 'same-origin',
      headers: expect.objectContaining({
        authorization: 'Bearer firebase-token',
        'idempotency-key': 'billing-client-key-0001',
      }),
      body: '{"plan":"annual"}',
    });
    expect(String(init?.body)).not.toMatch(/amount|quantity|customer|metadata|successUrl|trial/iu);
    expect(fetcher.mock.calls[2]).toEqual([
      '/api/v1/hosted/workspaces/ws_billing_client/members/member_client',
      expect.objectContaining({
        method: 'DELETE', credentials: 'same-origin', body: '{}',
        headers: expect.objectContaining({'idempotency-key': 'billing-remove-key-0001'}),
      }),
    ]);
  });

  it('renders exact active-seat totals, explicit choice, no-auto-charge, pending-seat, and Free recovery copy', () => {
    const source = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const styles = readFileSync('apps/web/src/hosted.css', 'utf8');
    expect(source).toContain('$2 × {summary.seats.active} active');
    expect(source).toContain('$12 × {summary.seats.active} active');
    expect(source).toContain('Pending invitations');
    expect(source).toContain('not billed');
    expect(source).toContain('Choose monthly');
    expect(source).toContain('Choose annual');
    expect(source).toContain('USD before tax');
    expect(source).toContain('Applicable tax is calculated automatically in Checkout');
    expect(source).toContain('No paid plan starts without your explicit choice');
    expect(source).toContain('eligible for the workspace export below');
    expect(source).toContain('export remains available');
    expect(source).not.toContain('readable and exportable');
    expect(source).toContain('extra-member and automation writes pause');
    expect(source).toContain('Reduce active seats');
    expect(source).toContain('Tasks and comments stay preserved');
    expect(source).toContain('Remove member');
    expect(source).toContain('explicit proration');
    expect(source).toContain('Seat reconciliation is pending');
    expect(source).toContain('it will not duplicate the seat change');
    expect(source).toContain('Paid access appears only after a signed provider confirmation');
    expect(styles).toContain('.hosted-plan-grid');
    expect(styles).toContain('@media (max-width: 820px)');
    expect(source).not.toMatch(/adjustable_quantity|trial_period_days|sk_live|whsec_/u);
  });
});
