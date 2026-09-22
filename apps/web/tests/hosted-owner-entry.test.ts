import {describe, expect, it, vi} from 'vitest';
import type {HostedBootstrapResponse} from '../src/hosted-api.js';
import type {HostedGoogleIdentity} from '../src/hosted-auth.js';
import {completeHostedOwnerSignIn} from '../src/hosted-owner-entry.js';

const bootstrapResponse = {
  created: true,
  user: {id: 'owner-1', email: 'owner@example.com', displayName: 'Owner', provider: 'google.com'},
  workspace: {id: 'workspace-1', name: 'BasicLinear workspace', authority: 'firebase-hosted'},
  membership: {id: 'membership-1', role: 'owner', status: 'active'},
  trial: {
    id: 'trial-1',
    plan: 'pro',
    status: 'active',
    startedAt: '2026-08-26T00:00:00.000Z',
    endsAt: '2026-09-25T00:00:00.000Z',
    durationDays: 30,
  },
} as HostedBootstrapResponse;

function identity(): HostedGoogleIdentity & {getIdToken: ReturnType<typeof vi.fn>} {
  return {
    uid: 'owner-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    getIdToken: vi.fn().mockResolvedValue('firebase-id-token'),
  };
}

describe('hosted owner Google sign-in', () => {
  it('allows a development identity check without requesting a token or calling the backend', async () => {
    const googleIdentity = identity();
    const bootstrap = vi.fn().mockResolvedValue(bootstrapResponse);

    await expect(completeHostedOwnerSignIn('configuring', googleIdentity, bootstrap)).resolves.toEqual({
      kind: 'identity-only',
      email: 'owner@example.com',
      displayName: 'Owner',
    });
    expect(googleIdentity.getIdToken).not.toHaveBeenCalled();
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('continues a provider-ready sign-in through the existing workspace bootstrap', async () => {
    const googleIdentity = identity();
    const bootstrap = vi.fn().mockResolvedValue(bootstrapResponse);

    await expect(completeHostedOwnerSignIn('ready', googleIdentity, bootstrap)).resolves.toEqual({
      kind: 'workspace',
      value: bootstrapResponse,
      idToken: 'firebase-id-token',
    });
    expect(googleIdentity.getIdToken).toHaveBeenCalledOnce();
    expect(bootstrap).toHaveBeenCalledWith('firebase-id-token', 'owner-1');
  });
});
