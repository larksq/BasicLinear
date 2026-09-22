import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createHostedPersonalToken,
  getHostedWorkspaceExport,
  listHostedPersonalTokens,
  revokeHostedPersonalToken,
} from '../src/hosted-api.js';
import { hostedPersonalTokenStatus } from '../src/hosted-app.js';

const tokenView = {
  id: `pat_${'1'.repeat(32)}`,
  workspaceId: 'ws_automation_client',
  name: 'Product workflow',
  prefix: 'ol_pat_v1.11111111',
  scopes: ['projects:read', 'issues:write'],
  audience: 'basiclinear-api-v1',
  createdAt: '2027-01-01T00:00:00.000Z',
  expiresAt: '2027-04-01T00:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  revision: 1,
} as const;

const response = (data: unknown, status = 200) => new Response(
  JSON.stringify({data}),
  {status, headers: {'content-type': 'application/json'}},
);

describe('hosted automation and export client', () => {
  it('uses only same-origin browser-user routes and never puts credentials in URLs', async () => {
    const rawToken = `ol_pat_v1.${'1'.repeat(32)}.d3NfYXV0b21hdGlvbl9jbGllbnQ.${'a'.repeat(43)}`;
    const exported = {
      mediaType: 'application/vnd.basiclinear.workspace-export+json;version=1' as const,
      workspaceId: 'ws_automation_client', sha256: 'b'.repeat(64),
      data: {schemaVersion: 'basiclinear.workspace-export.v1'},
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({tokens: [tokenView]}))
      .mockResolvedValueOnce(response({changed: true, token: tokenView, rawToken}, 201))
      .mockResolvedValueOnce(response({changed: true, token: {...tokenView, revokedAt: tokenView.createdAt, revision: 2}}))
      .mockResolvedValueOnce(response(exported));

    await listHostedPersonalTokens('firebase-id-token', tokenView.workspaceId, fetcher);
    const created = await createHostedPersonalToken(
      'firebase-id-token', tokenView.workspaceId,
      {name: tokenView.name, scopes: ['projects:read', 'issues:write'], expiresInDays: 90},
      'automation-create-key-0001', fetcher,
    );
    await revokeHostedPersonalToken(
      'firebase-id-token', tokenView.workspaceId, tokenView.id, 'automation-revoke-key-0001', fetcher,
    );
    expect(await getHostedWorkspaceExport('firebase-id-token', tokenView.workspaceId, fetcher)).toEqual(exported);
    expect(created.rawToken).toBe(rawToken);

    expect(fetcher.mock.calls.map(([path]) => String(path))).toEqual([
      '/api/v1/hosted/workspaces/ws_automation_client/tokens',
      '/api/v1/hosted/workspaces/ws_automation_client/tokens',
      `/api/v1/hosted/workspaces/ws_automation_client/tokens/${tokenView.id}`,
      '/api/v1/hosted/workspaces/ws_automation_client/export',
    ]);
    for (const [path, init] of fetcher.mock.calls) {
      expect(String(path)).not.toContain('firebase-id-token');
      expect(String(path)).not.toContain(rawToken);
      expect(init).toMatchObject({credentials: 'same-origin'});
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer firebase-id-token');
    }
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        name: tokenView.name,
        scopes: ['projects:read', 'issues:write'],
        expiresInDays: 90,
      }),
      headers: expect.objectContaining({'idempotency-key': 'automation-create-key-0001'}),
    });
    expect(fetcher.mock.calls[2]?.[1]).toMatchObject({
      method: 'DELETE', body: '{}',
      headers: expect.objectContaining({'idempotency-key': 'automation-revoke-key-0001'}),
    });
  });

  it('renders explicit one-time-secret, scope, revocation, export, and MCP-boundary copy', () => {
    const source = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const styles = readFileSync('apps/web/src/hosted.css', 'utf8');
    expect(source).toContain('Save this token now. It is shown once.');
    expect(source).toContain('Never paste a personal access token into chat, issue text, comments, logs, or source control.');
    expect(source).toContain('Open OpenAPI 3.1.1');
    expect(source).toContain('Download workspace export');
    expect(source).toContain('MCP 2026-07-28');
    expect(source).toContain('REST personal tokens are not accepted by MCP.');
    expect(source).toContain('Token revoked. Its next API call will be denied.');
    expect(source).toContain(".catch(() => setStatus('Copy failed. Select the token and copy it manually.'))");
    expect(source).toContain("setStatus('Download failed. Select the token and save it manually.')");
    expect(source).toContain('URL.revokeObjectURL(url);\n    throw error;');
    expect(styles).toContain('.hosted-token-secret');
    expect(styles).toContain('.hosted-scope-grid');
    expect(source).not.toMatch(/agent configuration|code review|repository token|pull request/iu);
  });

  it('distinguishes active, expired, and revoked credentials in the owner roster', () => {
    const now = Date.parse('2027-01-02T00:00:00.000Z');
    expect(hostedPersonalTokenStatus({expiresAt: '2027-01-03T00:00:00.000Z', revokedAt: null}, now)).toBe('Active');
    expect(hostedPersonalTokenStatus({expiresAt: '2027-01-02T00:00:00.000Z', revokedAt: null}, now)).toBe('Expired');
    expect(hostedPersonalTokenStatus({
      expiresAt: '2027-01-03T00:00:00.000Z', revokedAt: '2027-01-01T00:00:00.000Z',
    }, now)).toBe('Revoked');
  });
});
