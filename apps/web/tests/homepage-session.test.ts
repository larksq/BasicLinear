import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

const session = vi.hoisted(() => ({
  render: vi.fn(),
  prepare: vi.fn().mockResolvedValue(undefined),
  restore: vi.fn().mockResolvedValue({ uid: 'signed-in-owner', email: 'owner@example.test' }),
}));

vi.mock('react-dom/client', () => ({ createRoot: () => ({ render: session.render }) }));
vi.mock('../src/hosted-auth.js', () => ({
  prepareHostedGoogleSignIn: session.prepare,
  restoreHostedGoogleIdentity: session.restore,
}));

describe('homepage with an existing hosted session', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('document', { getElementById: () => ({}) });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it.each([
    { pathname: '/', search: '', hash: '' },
    { pathname: '/hosted.html', search: '', hash: '' },
    { pathname: '/', search: '?utm_source=returning-user', hash: '#getting-started' },
  ])('keeps $pathname$search$hash public without restoring a saved login', async location => {
    vi.stubGlobal('window', { location });
    await import('../src/hosted-main.js');
    const tree = session.render.mock.calls[0]?.[0] as ReactNode;
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('A little less overhead.');
    expect(html).toContain('href="?app"');
    expect(html).not.toContain('Opening your workspace');
    expect(session.prepare).not.toHaveBeenCalled();
    expect(session.restore).not.toHaveBeenCalled();
  });
});
