import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

function rule(styles: string, selector: string): string {
  const start = styles.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = styles.indexOf('}', start);
  expect(end).toBeGreaterThan(start);
  return styles.slice(start, end + 1);
}

describe('application shell geometry contract', () => {
  it('binds the shared header token to the accepted UX value', async () => {
    const [uxDesign, tokens] = await Promise.all([
      source('docs/product/versions/v0.1.0/20-planning/ux-design.md'),
      source('packages/ui/src/tokens.css'),
    ]);

    expect(uxDesign).toContain('- Top view header: `44px`;');
    expect(tokens).toContain('--ol-topbar-height: 44px;');
  });

  it('uses an opaque, unblurred topbar at the shared height', async () => {
    const styles = await source('apps/web/src/styles.css');
    const topbar = rule(styles, '.topbar');

    expect(topbar).toContain('height: var(--ol-topbar-height);');
    expect(topbar).toContain('background: var(--ol-bg);');
    expect(topbar).not.toContain('transparent');
    expect(topbar).not.toContain('backdrop-filter');
    expect(styles).not.toContain('49px');
  });

  it('derives recovery and responsive detail geometry from the same token', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(rule(styles, '.connection-banner')).toContain('top: var(--ol-topbar-height);');
    expect(rule(styles, '.issue-detail-panel')).toContain('max-height: calc(100vh - var(--ol-topbar-height) - 25px);');
    expect(styles).toContain('.issues-view.detail-open .issue-detail-panel { position: sticky; top: calc(var(--ol-topbar-height) + 13px);');
    expect(styles).toContain('.issue-panel-resizer { position: sticky; top: calc(var(--ol-topbar-height) + 13px); height: calc(100vh - var(--ol-topbar-height) - 25px);');
    expect(styles).toContain('.issue-detail-panel { position: fixed; z-index: 14; inset: var(--ol-topbar-height) 0 0 auto;');
  });
});
