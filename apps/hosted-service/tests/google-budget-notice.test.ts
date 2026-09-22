import type { LoginTicket, TokenPayload } from 'google-auth-library';
import { describe, expect, it } from 'vitest';
import { GoogleBudgetNoticeVerifier } from '../src/google-budget-notice.js';

const audience = 'https://api.basiclinear.example/api/v1/hosted/operations/budget-notice';
const email = 'budget-push@basiclinear-prod.iam.gserviceaccount.com';
const token = `header.${'a'.repeat(64)}.${'b'.repeat(64)}`;

function verifier(payload: TokenPayload, observed: Array<{idToken: string; audience: string}>) {
  return new GoogleBudgetNoticeVerifier({
    audience,
    serviceAccountEmail: email,
    clock: () => new Date('2026-08-01T00:30:00.000Z'),
    verifier: {
      verifyIdToken: async (input) => {
        observed.push(input);
        return {getPayload: () => payload} as LoginTicket;
      },
    },
  });
}

function validPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
  return {
    iss: 'https://accounts.google.com',
    aud: audience,
    sub: '123456789012345678901',
    email,
    email_verified: true,
    iat: Math.floor(Date.parse('2026-08-01T00:00:00.000Z') / 1_000),
    exp: Math.floor(Date.parse('2026-08-01T01:00:00.000Z') / 1_000),
    ...overrides,
  };
}

describe('GoogleBudgetNoticeVerifier', () => {
  it('binds the exact audience and service-account identity for both Google issuers', async () => {
    for (const issuer of ['https://accounts.google.com', 'accounts.google.com']) {
      const observed: Array<{idToken: string; audience: string}> = [];
      await expect(verifier(validPayload({iss: issuer}), observed).verifyPubSubToken(token))
        .resolves.toBeUndefined();
      expect(observed).toEqual([{idToken: token, audience}]);
    }
  });

  it('rejects identity, verification, chronology, and token-shape mismatches', async () => {
    for (const payload of [
      validPayload({iss: 'https://issuer.example'}),
      validPayload({aud: 'https://hostile.example/budget'}),
      validPayload({email: 'other@basiclinear-prod.iam.gserviceaccount.com'}),
      validPayload({email_verified: false}),
      validPayload({sub: 'not-numeric'}),
      validPayload({iat: Math.floor(Date.parse('2026-08-01T01:00:00.000Z') / 1_000)}),
      validPayload({exp: Math.floor(Date.parse('2026-08-01T00:29:59.000Z') / 1_000)}),
      validPayload({
        iat: Math.floor(Date.parse('2026-08-01T00:35:00.000Z') / 1_000),
        exp: Math.floor(Date.parse('2026-08-01T00:34:00.000Z') / 1_000),
      }),
    ]) {
      await expect(verifier(payload, []).verifyPubSubToken(token))
        .rejects.toThrow(/BUDGET_PUSH_IDENTITY_INVALID/u);
    }
    await expect(verifier(validPayload(), []).verifyPubSubToken('short'))
      .rejects.toThrow(/BUDGET_PUSH_IDENTITY_INVALID/u);

    const failing = new GoogleBudgetNoticeVerifier({
      audience,
      serviceAccountEmail: email,
      verifier: {verifyIdToken: async () => { throw new Error('provider unavailable'); }},
    });
    await expect(failing.verifyPubSubToken(token)).rejects.toThrow(/BUDGET_PUSH_IDENTITY_INVALID/u);
  });
});
