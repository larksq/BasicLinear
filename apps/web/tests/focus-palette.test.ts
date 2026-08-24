import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

function rule(sourceText: string, selector: string): string {
  const start = sourceText.indexOf(`${selector} {`);
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

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function luminance(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function hue(hex: string): number {
  const [red, green, blue] = channels(hex).map((channel) => channel / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return 0;
  let segment = maximum === red
    ? ((green - blue) / delta) % 6
    : maximum === green
      ? (blue - red) / delta + 2
      : (red - green) / delta + 4;
  segment *= 60;
  return segment < 0 ? segment + 360 : segment;
}

describe('semantic focus palette contract', () => {
  it('binds Light, Dark, and System Dark to the accepted cyan direction', async () => {
    const [uxDesign, tokens] = await Promise.all([
      source('docs/product/versions/v0.1.0/20-planning/ux-design.md'),
      source('packages/ui/src/tokens.css'),
    ]);
    const light = rule(tokens, ':root');
    const dark = rule(tokens, ":root[data-theme='dark']");
    const systemDark = rule(tokens, ':root:not([data-theme])');

    expect(uxDesign).toContain('cyan for selection/focus');
    expect(token(light, '--ol-focus')).toBe('#087e8c');
    expect(token(dark, '--ol-focus')).toBe('#6be7f5');
    expect(token(systemDark, '--ol-focus')).toBe('#6be7f5');
    expect(tokens.match(/--ol-focus:/gu)).toHaveLength(3);
    expect(tokens).not.toContain('#4f79da');
    expect(tokens).not.toContain('#92abef');
    expect(hue(token(light, '--ol-focus'))).toBeGreaterThanOrEqual(180);
    expect(hue(token(light, '--ol-focus'))).toBeLessThanOrEqual(195);
    expect(hue(token(dark, '--ol-focus'))).toBeGreaterThanOrEqual(180);
    expect(hue(token(dark, '--ol-focus'))).toBeLessThanOrEqual(195);
  });

  it('meets non-text contrast against every theme surface', async () => {
    const tokens = await source('packages/ui/src/tokens.css');
    const light = rule(tokens, ':root');
    const dark = rule(tokens, ":root[data-theme='dark']");
    const lightFocus = token(light, '--ol-focus');
    const darkFocus = token(dark, '--ol-focus');

    for (const surface of ['--ol-bg', '--ol-surface', '--ol-surface-subtle']) {
      expect(contrast(lightFocus, token(light, surface))).toBeGreaterThanOrEqual(3);
      expect(contrast(darkFocus, token(dark, surface))).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(darkFocus, token(dark, '--ol-primary-bg'))).toBeGreaterThanOrEqual(3);
  });

  it('does not recolor primary commands or link accents', async () => {
    const tokens = await source('packages/ui/src/tokens.css');
    const light = rule(tokens, ':root');
    const dark = rule(tokens, ":root[data-theme='dark']");

    expect(token(light, '--ol-accent')).toBe('#3366cc');
    expect(token(light, '--ol-accent-strong')).toBe('#2451ad');
    expect(token(light, '--ol-primary-bg')).toBe('#3366cc');
    expect(token(light, '--ol-primary-bg-hover')).toBe('#2451ad');
    expect(token(dark, '--ol-accent')).toBe('#7d9be8');
    expect(token(dark, '--ol-accent-strong')).toBe('#9cb2ec');
    expect(token(dark, '--ol-primary-bg')).toBe('#4f70c5');
    expect(token(dark, '--ol-primary-bg-hover')).toBe('#4263b8');
  });

  it('keeps major focus and selection surfaces on the semantic token', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(rule(styles, ':focus-visible')).toContain('outline: 2px solid var(--ol-focus);');
    expect(rule(styles, '.project-row.selected')).toContain('box-shadow: inset 2px 0 var(--ol-focus);');
    expect(rule(styles, '.segmented-tabs button.active::after')).toContain('background: var(--ol-focus);');
    expect(rule(styles, '.rich-editor:focus-within')).toContain('border-color: var(--ol-focus);');
    expect(rule(styles, '.rich-editor-content:focus-visible')).toContain('outline: 2px solid var(--ol-focus);');
    expect(rule(styles, '.rich-editor-content:focus-visible')).toContain('outline-offset: -2px;');
    expect(rule(styles, '.issue-title-editor textarea:focus-visible')).toContain('box-shadow: inset 0 -2px var(--ol-focus);');
    expect(rule(styles, '.command-search:focus-within')).toContain('outline: 2px solid var(--ol-focus);');
    expect(rule(styles, '.command-search:focus-within')).toContain('outline-offset: -2px;');
    expect(rule(styles, '.issue-due-date-control:focus-within')).toContain('outline: 2px solid var(--ol-focus);');
    expect(rule(styles, '.issue-due-date-control:focus-within')).toContain('outline-offset: -2px;');
    expect(rule(styles, '.issue-due-date-control input::-webkit-calendar-picker-indicator')).toContain('opacity: 0;');
    expect(rule(styles, '.issue-due-date-control:focus-within .issue-due-date-icon')).toContain('color: var(--ol-focus);');
    expect(rule(styles, '.issue-virtual-row.active')).toContain('box-shadow: inset 2px 0 var(--ol-focus);');
    expect(styles).toContain('.issue-virtual-row.active .issue-status-cell, .issue-virtual-row.active .issue-title-cell code');
    expect(styles).toContain('.issue-virtual-row.active .issue-due-cell:not(.overdue), .issue-virtual-row.active .label-chip { color: var(--ol-text); }');
    expect(styles).toContain('.issue-board-card.active { box-shadow: inset 2px 0 var(--ol-focus); }');
    expect(styles).toContain('accent-color: var(--ol-focus);');
    expect(styles).not.toContain('#087e8c');
    expect(styles).not.toContain('#6be7f5');
  });
});
