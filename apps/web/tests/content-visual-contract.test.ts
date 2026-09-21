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

describe('document geometry and title-scale contract', () => {
  it('binds shared tokens to the accepted spatial and typography values', async () => {
    const [uxDesign, tokens] = await Promise.all([
      source('docs/product/versions/v0.1.0/20-planning/ux-design.md'),
      source('packages/ui/src/tokens.css'),
    ]);

    expect(uxDesign).toContain('- Content maximum for document-like overview: `920px`; tables and work views remain fluid.');
    expect(uxDesign).toContain('`20px` page title, and restrained `24px` project title.');
    expect(tokens).toContain('--ol-document-content-width: 920px;');
    expect(tokens).toContain('--ol-page-title-size: 20px;');
    expect(tokens).toContain('--ol-project-title-size: 24px;');
  });

  it('caps only the project overview while letting work surfaces use the available width', async () => {
    const [projects, styles] = await Promise.all([
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/styles.css'),
    ]);

    expect(projects).toContain('className={`project-detail project-detail-${tab}`}');
    expect(rule(styles, '.project-detail-overview')).toContain('max-width: var(--ol-document-content-width);');
    expect(rule(styles, '.project-detail-overview')).toContain('margin-inline: auto;');
    expect(rule(styles, '.content-projects')).toContain('width: 100%;');
    expect(rule(styles, '.content')).toContain('width: 100%;');
    expect(styles).not.toContain('.project-detail-issues {');
    expect(styles).not.toContain('.project-detail-activity {');
  });

  it('keeps accepted title sizes stable across responsive breakpoints', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(rule(styles, '.section-heading h1')).toContain('font-size: var(--ol-page-title-size);');
    expect(rule(styles, '.project-hero h1')).toContain('font-size: var(--ol-project-title-size);');
    expect(rule(styles, '.project-hero-copy-editor input')).toContain('font-size: var(--ol-project-title-size);');
    expect(styles).not.toContain('  .section-heading h1 { font-size:');
    expect(styles).not.toContain('  .project-hero h1 { font-size:');
    expect(styles).not.toContain('  .project-hero-copy-editor input { font-size:');
  });

  it('retains dialog dimming without any blurred application backdrop', async () => {
    const styles = await source('apps/web/src/styles.css');
    const backdrop = rule(styles, '.dialog::backdrop');

    expect(backdrop).toContain('background: rgb(15 16 18 / 42%);');
    expect(backdrop).not.toContain('backdrop-filter');
    expect(styles).not.toContain('backdrop-filter');
  });
});
