import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {HostedWorkspaceApplication} from '../src/hosted-workspace.js';

vi.mock('../src/hosted-environment.js', () => ({
  readHostedBrowserEnvironment: () => ({environment: 'production', label: 'Production'}),
}));

describe('billing return navigation', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const render = (search: string, role: 'owner' | 'member' = 'owner') => {
    vi.stubGlobal('window', {location: new URL(`https://openlinear.qiaosun.me/${search}`)});
    return renderToStaticMarkup(createElement(HostedWorkspaceApplication, {
      idToken: 'test-identity', workspaceId: 'ws_billing_return', workspaceName: 'Billing return test',
      currentUserId: 'owner', userEmail: 'owner@example.test', displayName: 'Owner', role,
      billingPanel: createElement('section', {'aria-label': 'Server billing status'}, 'Server billing status'),
    }));
  };
  it.each(['?billing=success&session_id=checkout', '?billing=cancelled', '?app&billing=success'])(
    'opens the actual Billing panel for an owner returning via %s', search => {
      expect(render(search)).toContain('aria-label="Server billing status"');
    },
  );
  it.each(['?app', '?billing=unknown', '?billing=success&billing=cancelled'])(
    'keeps normal workspace navigation for %s', search => {
      expect(render(search)).not.toContain('aria-label="Server billing status"');
    },
  );
  it('does not grant a member access to Billing from a return query', () => {
    expect(render('?billing=success', 'member')).not.toContain('aria-label="Server billing status"');
  });
});
