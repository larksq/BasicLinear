import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

function rule(sourceText: string, selector: string): string {
  const start = sourceText.lastIndexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sourceText.indexOf('}', start);
  expect(end).toBeGreaterThan(start);
  return sourceText.slice(start, end + 1);
}

function token(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6});`, 'iu').exec(block);
  expect(match).not.toBeNull();
  return match?.[1].toLowerCase() ?? '';
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('semantic token integrity', () => {
  it('defines the accepted subtle text token in every appearance mode', async () => {
    const [uxDesign, tokens] = await Promise.all([
      source('docs/product/versions/v0.1.0/20-planning/ux-design.md'),
      source('packages/ui/src/tokens.css'),
    ]);
    const light = rule(tokens, ':root');
    const dark = rule(tokens, ":root[data-theme='dark']");
    const systemDark = rule(tokens, ':root:not([data-theme])');

    expect(uxDesign).toContain('Light and dark themes use the same semantic token names and meet contrast requirements.');
    expect(token(light, '--ol-text-subtle')).toBe('#6d6e74');
    expect(token(dark, '--ol-text-subtle')).toBe('#8b8b94');
    expect(token(systemDark, '--ol-text-subtle')).toBe('#8b8b94');
    expect(tokens.match(/--ol-text-subtle:/gu)).toHaveLength(3);
  });

  it('keeps subtle text lower emphasis while meeting text contrast on every surface', async () => {
    const tokens = await source('packages/ui/src/tokens.css');
    const light = rule(tokens, ':root');
    const dark = rule(tokens, ":root[data-theme='dark']");

    for (const [theme, block] of [['Light', light], ['Dark', dark]] as const) {
      const subtle = token(block, '--ol-text-subtle');
      const muted = token(block, '--ol-text-muted');
      for (const surface of ['--ol-bg', '--ol-surface', '--ol-surface-subtle']) {
        const background = token(block, surface);
        expect(contrast(subtle, background), `${theme} ${surface}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(subtle, background), `${theme} ${surface} emphasis`).toBeLessThan(
          contrast(muted, background),
        );
      }
    }
  });

  it('keeps success feedback readable on every surface and appearance', async () => {
    const tokens = await source('packages/ui/src/tokens.css');
    const appearances = [
      ['Light', rule(tokens, ':root'), '#237d47'],
      ['Dark', rule(tokens, ":root[data-theme='dark']"), '#5fbf84'],
      ['System dark', rule(tokens, ':root:not([data-theme])'), '#5fbf84'],
    ] as const;

    for (const [appearance, block, expected] of appearances) {
      const success = token(block, '--ol-success');
      expect(success, appearance).toBe(expected);
      for (const surface of ['--ol-bg', '--ol-surface', '--ol-surface-subtle']) {
        expect(contrast(success, token(block, surface)), `${appearance} ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(tokens.match(/--ol-success:/gu)).toHaveLength(3);
  });

  it('keeps solid danger actions readable without dimming danger foregrounds', async () => {
    const [tokens, styles] = await Promise.all([
      source('packages/ui/src/tokens.css'),
      source('apps/web/src/styles.css'),
    ]);
    const appearances = [
      ['Light', rule(tokens, ':root')],
      ['Dark', rule(tokens, ":root[data-theme='dark']")],
      ['System dark', rule(tokens, ':root:not([data-theme])')],
    ] as const;

    for (const [appearance, block] of appearances) {
      const solid = token(block, '--ol-danger-solid');
      expect(contrast('#ffffff', solid), appearance).toBeGreaterThanOrEqual(4.5);
    }
    expect(token(appearances[1][1], '--ol-danger-solid')).not.toBe(
      token(appearances[1][1], '--ol-danger'),
    );
    expect(tokens.match(/--ol-danger-solid:/gu)).toHaveLength(3);
    expect(rule(styles, '.danger-button')).toContain('border-color: var(--ol-danger-solid);');
    expect(rule(styles, '.danger-button')).toContain('background: var(--ol-danger-solid);');
    expect(rule(styles, '.danger-button:hover')).toContain('var(--ol-danger-solid)');
  });

  it('resolves every shipped semantic token consumer', async () => {
    const [tokens, styles] = await Promise.all([
      source('packages/ui/src/tokens.css'),
      source('apps/web/src/styles.css'),
    ]);
    const definitions = new Set([...tokens.matchAll(/(--ol-[a-z0-9-]+)\s*:/giu)].map((match) => match[1]));
    const consumers = new Set([...`${tokens}\n${styles}`.matchAll(/var\((--ol-[a-z0-9-]+)/giu)].map((match) => match[1]));
    const undefinedConsumers = [...consumers].filter((name) => !definitions.has(name)).sort();

    expect(undefinedConsumers).toEqual([]);
  });

  it('keeps recovery metadata, workflow reordering, and shell hierarchy on the subtle token', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(rule(styles, '.connection-banner-copy code')).toContain('color: var(--ol-text-subtle);');
    expect(rule(styles, '.query-error-copy code')).toContain('color: var(--ol-text-subtle);');
    expect(rule(styles, '.workflow-status-drag-handle')).toContain('color: var(--ol-text-subtle);');
    expect(rule(styles, '.owner-brand small')).toContain('color: var(--ol-text-subtle);');
    expect(styles).toContain('.sidebar-section > span { display: block; padding: 0 8px 6px; color: var(--ol-text-subtle);');
    expect(styles).toContain('.topbar-context > span { overflow: hidden; color: var(--ol-text-subtle);');
    expect(styles).not.toContain('#6d6e74');
    expect(styles).not.toContain('#8b8b94');
  });

  it('uses primary text for warning-tinted archive and command content', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(rule(styles, '.archive-banner')).toContain('color: var(--ol-text);');
    expect(rule(styles, '.command-list mark')).toContain('color: var(--ol-text);');
  });
});
