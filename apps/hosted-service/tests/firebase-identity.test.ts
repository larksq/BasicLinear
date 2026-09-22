import { describe, expect, it } from 'vitest';
import { HostedAuthenticationError } from '@basiclinear/hosted';
import { verifiedGoogleIdentity } from '../src/firebase-identity.js';

describe('Firebase Google identity boundary', () => {
  it('accepts only a verified Google-authenticated Firebase token', () => {
    expect(verifiedGoogleIdentity({
      uid: 'firebase-uid-1',
      email: 'owner@example.com',
      email_verified: true,
      name: 'Owner',
      firebase: { sign_in_provider: 'google.com' },
    })).toEqual({
      uid: 'firebase-uid-1',
      email: 'owner@example.com',
      emailVerified: true,
      displayName: 'Owner',
      provider: 'google.com',
    });
  });

  it.each([
    { email_verified: false, firebase: { sign_in_provider: 'google.com' } },
    { email_verified: true, firebase: { sign_in_provider: 'password' } },
    { email_verified: true, firebase: { sign_in_provider: 'google.com' }, email: null },
  ])('rejects a non-Google or unverified claim set', (override) => {
    expect(() => verifiedGoogleIdentity({
      uid: 'firebase-uid-1',
      email: 'owner@example.com',
      name: 'Owner',
      ...override,
    })).toThrow(HostedAuthenticationError);
  });
});
