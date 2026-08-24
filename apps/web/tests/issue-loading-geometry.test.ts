import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingSkeleton } from '../src/components.js';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('issue loading geometry', () => {
  it.each([
    ['compact', 32, 258],
    ['default', 36, 286],
    ['comfortable', 44, 342],
  ] as const)('binds %s list loading rows to %dpx final rows', async (density, rowHeight, minimumHeight) => {
    const markup = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'table',
      tableKind: 'issues',
      tableDensity: density,
      label: 'Loading issues',
    }));
    const styles = await source('../src/styles.css');

    expect(markup).toContain(`loading-skeleton-issue-density-${density}`);
    expect(styles).toMatch(new RegExp(`loading-skeleton-issue-density-${density}[^}]+min-height: ${minimumHeight}px`));
    expect(styles).toMatch(new RegExp(`loading-skeleton-issue-density-${density}[^}]+\\.skeleton-table-row:not\\(\\.skeleton-table-header\\)[^}]+height: ${rowHeight}px`));
  });

  it.each([
    ['compact', 90],
    ['default', 102],
    ['comfortable', 114],
  ] as const)('binds %s board loading cards to %dpx final cards', async (density, cardHeight) => {
    const markup = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'board',
      boardDensity: density,
      label: 'Loading issue board',
    }));
    const styles = await source('../src/styles.css');

    expect(markup).toContain(`loading-skeleton-board-density-${density}`);
    expect(styles).toMatch(new RegExp(`loading-skeleton-board-density-${density}[^}]+\\.skeleton-board-card[^}]+height: ${cardHeight}px`));
  });

  it('switches the loading surface from the same persisted layout and density state', async () => {
    const [issues, configuration, styles] = await Promise.all([
      source('../src/issues.tsx'),
      source('../src/issue-view-configuration.ts'),
      source('../src/styles.css'),
    ]);

    expect(issues).toContain("issues.isLoading || projects.isLoading || workspaceMilestones.isLoading ? viewState.layout === 'list'");
    expect(issues).toContain('tableDensity={viewState.density}');
    expect(issues).toContain('tableColumnCount={4 + viewState.visibleProperties.length}');
    expect(issues).toContain('tableGridTemplate={issueGridTemplate(viewState.visibleProperties)}');
    expect(configuration).toContain("'28px',");
    expect(configuration).toContain('...canonicalIssueViewProperties(properties).map((property) => widths[property]),');
    expect(issues).toContain('boardDensity={viewState.density}');
    expect(issues).toMatch(/const issueRowHeights[\s\S]+compact: 32,[\s\S]+default: 36,[\s\S]+comfortable: 44/);
    expect(issues).toMatch(/const issueBoardItemHeights:[\s\S]+compact: 96,[\s\S]+default: 108,[\s\S]+comfortable: 120/);
    expect(issues).toContain('const height = issueBoardItemHeights[density];');
    expect(issues).toContain('style={{ height: virtualCard.size - 6, transform: `translateY(${virtualCard.start}px)` }}');
    expect(styles).toContain('grid-auto-columns: minmax(260px, 300px)');
    expect(styles).toContain('grid-template-columns: var(--loading-table-grid');
    expect(styles).toContain('.skeleton-board-cards { min-height: 300px;');
  });

  it.each([
    ['compact', 90, 6, 4],
    ['default', 102, 9, 7],
    ['comfortable', 114, 11, 9],
  ] as const)('fits the full board title line inside %s cards', async (density, cardHeight, padding, gap) => {
    const styles = await source('../src/styles.css');
    const minimumHeight = 2 + 2 * padding + 24 + 17 + 20 + 2 * gap;

    expect(cardHeight).toBeGreaterThanOrEqual(minimumHeight);
    expect(styles).toContain('grid-template-rows: 24px minmax(17px, 1fr) 20px;');
    expect(styles).toContain('.issue-board-card > strong { min-height: 17px;');
    if (density === 'compact') {
      expect(styles).toContain('.issue-board-column.density-compact .issue-board-card { gap: 4px; padding: 6px 8px; }');
    } else if (density === 'comfortable') {
      expect(styles).toContain('.issue-board-column.density-comfortable .issue-board-card { gap: 9px; padding: 11px 12px; }');
    } else {
      expect(styles).toContain('gap: 7px; padding: 9px 10px; overflow: hidden;');
    }
  });

  it('renders the requested number of placeholders with the selected grid tracks', () => {
    const markup = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'table',
      tableKind: 'issues',
      tableColumnCount: 5,
      tableGridTemplate: '28px 104px minmax(240px, 1.6fr) 92px 98px',
      label: 'Loading issues',
    }));

    expect(markup).toContain('--loading-table-grid:28px 104px minmax(240px, 1.6fr) 92px 98px');
    expect(markup.match(/class="skeleton-block"/g)).toHaveLength(40);
  });
});
