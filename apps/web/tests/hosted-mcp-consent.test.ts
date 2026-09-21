import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
import {
  decideHostedOAuthConsent,
  getHostedOAuthConsent,
} from '../src/hosted-api.js';
import {
  HostedOAuthClientIdentity,
  oauthWorkspaceSelectionFromSearch,
} from '../src/hosted-app.js';

const requestId = `oauthreq_${'1'.repeat(32)}`;
const consentView = {
  requestId,
  client: {id: `olm_client_${'2'.repeat(32)}`, name: 'Product planning client'},
  redirectUri: 'https://client.example.com/callback',
  workspace: {id: 'ws_mcp_consent', name: 'MCP consent workspace'},
  scopes: ['workspace:read', 'projects:write'],
  state: 'pending',
  expiresAt: '2027-01-02T00:10:00.000Z',
} as const;

const response = (data: unknown) => new Response(JSON.stringify({data}), {
  status: 200, headers: {'content-type': 'application/json'},
});

describe('hosted MCP OAuth consent client', () => {
  it('accepts exactly one backend-validated workspace-selection boundary and preserves OAuth values', () => {
    const search = new URLSearchParams({
      oauth_workspace: 'select', response_type: 'code', client_id: `olm_client_${'2'.repeat(32)}`,
      redirect_uri: 'http://127.0.0.1:49152/callback/session', scope: 'issues:read issues:write workspace:read',
      state: 'opaque-state-value-at-least-sixteen', code_challenge: 'a'.repeat(43),
      code_challenge_method: 'S256', resource: 'https://openlinear.example/mcp',
    });
    expect(oauthWorkspaceSelectionFromSearch(`?${search.toString()}`)).toEqual({
      responseType: 'code', clientId: `olm_client_${'2'.repeat(32)}`,
      redirectUri: 'http://127.0.0.1:49152/callback/session',
      scope: 'issues:read issues:write workspace:read', state: 'opaque-state-value-at-least-sixteen',
      codeChallenge: 'a'.repeat(43), codeChallengeMethod: 'S256',
      resource: 'https://openlinear.example/mcp',
    });
    search.append('scope', 'workspace:read');
    expect(oauthWorkspaceSelectionFromSearch(`?${search.toString()}`)).toBeNull();
    expect(oauthWorkspaceSelectionFromSearch('?oauth_workspace=select&unexpected=value')).toBeNull();
  });

  it('uses the verified Firebase credential only in same-origin consent headers', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response(consentView))
      .mockResolvedValueOnce(response({
        decision: 'approved', redirectUri: 'https://client.example.com/callback?code=opaque&state=preserved',
      }));
    expect(await getHostedOAuthConsent('firebase-id-token', requestId, fetcher)).toEqual(consentView);
    expect(await decideHostedOAuthConsent('firebase-id-token', requestId, 'approve', fetcher)).toMatchObject({
      decision: 'approved',
    });
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      `/oauth/consent/${requestId}`,
      `/oauth/consent/${requestId}`,
    ]);
    for (const [path, init] of fetcher.mock.calls) {
      expect(String(path)).not.toContain('firebase-id-token');
      expect(init).toMatchObject({
        credentials: 'same-origin',
        headers: expect.objectContaining({authorization: 'Bearer firebase-id-token'}),
      });
    }
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST', body: JSON.stringify({decision: 'approve'}),
    });
  });

  it('renders the exact client, redirect, workspace, scopes, denial, and account recovery boundaries', () => {
    const source = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const styles = readFileSync('apps/web/src/hosted.css', 'utf8');
    expect(source).toContain('Review a product-management connection.');
    expect(source).toContain('Choose the workspace your AI client can request.');
    expect(source).toContain('Continue to scope review');
    expect(source).toContain('Choosing does not grant access');
    expect(source).toContain('No workspace access was granted.');
    expect(source).toContain('Exact redirect');
    expect(source).toContain('Client ID');
    expect(source).toContain('Requested scopes');
    expect(source).toContain('Allow requested access');
    expect(source).toContain('Deny');
    expect(source).toContain('Use another Google account');
    expect(source).toContain('Start a new authorization request from the client and return here.');
    expect(source).toContain('MCP-only, audience-bound access token');
    expect(source).toContain("window.location.assign(result.redirectUri)");
    expect(source).toContain("/^oauthreq_[a-f0-9]{32}$/u");
    expect(styles).toContain('.hosted-oauth-consent');
    expect(styles).toContain('.hosted-workspace-options');
    expect(styles).toContain('.hosted-oauth-actions');
    expect(source).not.toMatch(/agent runtime|code review|repository integration|pull request workflow/iu);
  });

  it('renders immutable client IDs so same-name registrations remain distinguishable', () => {
    const name = 'Same display name';
    const firstId = `olm_client_${'a'.repeat(32)}`;
    const secondId = `olm_client_${'b'.repeat(32)}`;
    const first = renderToStaticMarkup(createElement(HostedOAuthClientIdentity, {
      client: {id: firstId, name},
    }));
    const second = renderToStaticMarkup(createElement(HostedOAuthClientIdentity, {
      client: {id: secondId, name},
    }));
    expect(first).toContain('Client ID');
    expect(first).toContain(firstId);
    expect(first).not.toContain(secondId);
    expect(second).toContain(secondId);
    expect(second).not.toBe(first);
  });
});
