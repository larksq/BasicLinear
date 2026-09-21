import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  acceptHostedInvitation,
  createHostedInvitation,
  inspectHostedInvitation,
  listHostedInvitations,
  resendHostedInvitation,
  revokeHostedInvitation,
} from '../src/hosted-api.js';

const invitation = {
  id: 'invite_0123456789abcdef0123456789abcdef',
  workspaceId: 'ws_hosted_invitation',
  invitedEmail: 'member@example.com',
  inviterDisplayName: 'Product Owner',
  workspaceName: 'Product workspace',
  role: 'member' as const,
  state: 'pending' as const,
  createdAt: '2026-12-01T00:00:00.000Z',
  lastSentAt: '2026-12-01T00:00:00.000Z',
  expiresAt: '2026-12-08T00:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
  sendCount: 1,
  activeSeatApplied: false,
  revision: 1,
};

describe('hosted invitation browser contract', () => {
  it('keeps the raw secret out of request URLs and sends it only in no-store JSON bodies', async () => {
    const rawToken = 'inv_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        ...invitation,
        invitationId: invitation.id,
        state: 'pending',
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        state: 'accepted',
        firstAcceptance: true,
        activeSeatAdded: true,
        workspace: { id: invitation.workspaceId, name: invitation.workspaceName },
        membership: { userId: 'member-user', role: 'member', status: 'active', revision: 1 },
      } }), { status: 200 }));

    await inspectHostedInvitation(rawToken, fetcher);
    await acceptHostedInvitation(rawToken, 'firebase-id-token', 'accept-retry-key-0001', fetcher);

    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/v1/hosted/invitations/inspect');
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/v1/hosted/invitations/accept');
    for (const [path, init] of fetcher.mock.calls) {
      expect(String(path)).not.toContain(rawToken);
      expect(init).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'same-origin' });
      expect(init?.body).toBe(JSON.stringify({ token: rawToken }));
    }
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toMatchObject({ authorization: expect.anything() });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer firebase-id-token',
      'idempotency-key': 'accept-retry-key-0001',
    });
  });

  it('uses owner-authenticated same-origin lifecycle routes with bounded JSON inputs', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { invitations: [invitation] } }), { status: 200 }))
      .mockImplementation(async () => new Response(JSON.stringify({ data: {
        changed: true,
        invitation,
        inviteUrl: '/hosted.html#invite=inv_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      } }), { status: 200 }));

    await listHostedInvitations('owner-token', invitation.workspaceId, fetcher);
    await createHostedInvitation(
      'owner-token', invitation.workspaceId, invitation.invitedEmail, 'create-key-00000001', fetcher,
    );
    await resendHostedInvitation(
      'owner-token', invitation.workspaceId, invitation.id, 'resend-key-00000001', fetcher,
    );
    await revokeHostedInvitation(
      'owner-token', invitation.workspaceId, invitation.id, 'revoke-key-00000001', fetcher,
    );

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/hosted/workspaces/ws_hosted_invitation/invitations',
      '/api/v1/hosted/workspaces/ws_hosted_invitation/invitations',
      '/api/v1/hosted/workspaces/ws_hosted_invitation/invitations/invite_0123456789abcdef0123456789abcdef/resend',
      '/api/v1/hosted/workspaces/ws_hosted_invitation/invitations/invite_0123456789abcdef0123456789abcdef/revoke',
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe('same-origin');
      expect(init?.headers).toMatchObject({ authorization: 'Bearer owner-token' });
    }
    expect(fetcher.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ email: invitation.invitedEmail }));
    expect(fetcher.mock.calls[2]?.[1]?.body).toBe('{}');
    expect(fetcher.mock.calls[3]?.[1]?.body).toBe('{}');
  });

  it('renders the required owner and invitee facts, states, recovery, and fragment boundary', () => {
    const source = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const server = readFileSync('packages/hosted/src/hosted-http.ts', 'utf8');
    expect(source).toContain('Pending invitations are not billed and do not count as active seats.');
    expect(source).toContain('Invited Google email');
    expect(source).toContain('Inviter');
    expect(source).toContain('Workspace');
    expect(source).toContain('Role');
    expect(source).toContain('Sign out and try another Google account');
    expect(source).toContain('invitationAcceptanceStorageKey(preview.invitationId, identity.uid)');
    expect(source).toContain('error.code === \'INVITATION_EMAIL_MISMATCH\'');
    expect(source).not.toContain("const storageKey = 'openlinear.hosted.invitation.accept'");
    expect(source).toContain('expired:');
    expect(source).toContain('revoked:');
    expect(source).toContain('superseded:');
    expect(source).toContain('accepted:');
    expect(source).toContain('window.location.hash');
    expect(server).toContain('/hosted.html#invite=');
    expect(source).not.toMatch(/notification|mention|reaction|attachment/i);
    expect(source).not.toMatch(/code review|pull request|repository/i);
  });
});
