import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';

describe('public homepage destinations', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  const render = async (repository = '') => {
    vi.stubEnv('VITE_BASICLINEAR_REPOSITORY_URL', repository);
    vi.resetModules();
    const {Homepage} = await import('../src/homepage.js');
    return renderToStaticMarkup(createElement(Homepage));
  };

  it('links every in-page navigation target to a real section and uses genuine app/home/license destinations', async () => {
    const html = await render();
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    const links = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => match[1] as string);
    expect(links.length).toBeGreaterThan(10);
    for (const href of links) {
      expect(href).not.toBe('');
      expect(href).not.toBe('#');
      if (href.startsWith('#')) expect(ids.has(href.slice(1)), href).toBe(true);
      else expect(['/', '?app', '/basiclinear-license.txt']).toContain(href);
    }
    expect(html).toContain('The source repository is not public yet.');
    expect(html).not.toContain('coming soon');
  });

  it('offers the configured source only when it is a GitHub repository URL', async () => {
    expect(await render('https://github.com/larksq/basiclinear')).toContain('href="https://github.com/larksq/basiclinear"');
    for (const invalid of ['javascript:alert(1)', 'https://github.com.attacker.test/repo/name']) {
      const html = await render(invalid);
      expect(html).not.toContain(invalid);
      expect(html).toContain('Read the AGPL-3.0 license');
    }
  });
});
