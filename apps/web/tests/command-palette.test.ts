import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  clampCommandIndex,
  commandNavigationIndex,
  commandOptionCount,
  commandOptionId,
  commandResultSummary,
  moveCommandIndex,
  searchHighlightSegments,
} from '../src/command-palette.js';

describe('command palette active option', () => {
  it('counts the four fixed commands and clamps stale result indices', () => {
    expect(commandOptionCount(0)).toBe(4);
    expect(commandOptionCount(4)).toBe(8);
    expect(clampCommandIndex(-1, 8)).toBe(0);
    expect(clampCommandIndex(9, 8)).toBe(7);
  });

  it('moves without wrapping beyond the available options', () => {
    expect(moveCommandIndex(0, 'previous', 5)).toBe(0);
    expect(moveCommandIndex(0, 'next', 5)).toBe(1);
    expect(moveCommandIndex(4, 'next', 5)).toBe(4);
  });

  it('supports Home and End while skipping a disabled create command', () => {
    expect(commandNavigationIndex(1, 'ArrowUp', 7, [0])).toBe(1);
    expect(commandNavigationIndex(0, 'ArrowDown', 7, [0])).toBe(1);
    expect(commandNavigationIndex(4, 'Home', 7, [0])).toBe(1);
    expect(commandNavigationIndex(4, 'End', 7, [0])).toBe(6);
    expect(commandNavigationIndex(4, 'PageDown', 7, [0])).toBeNull();
    expect(commandNavigationIndex(0, 'Home', 1, [0])).toBeNull();
  });

  it('emphasizes every literal query term without treating it as markup or a pattern', () => {
    expect(searchHighlightSegments('API api migration', 'api API')).toEqual([
      { text: 'API', highlighted: true },
      { text: ' ', highlighted: false },
      { text: 'api', highlighted: true },
      { text: ' migration', highlighted: false },
    ]);
    expect(searchHighlightSegments('Literal .* and <b> text', '.* <b>')).toEqual([
      { text: 'Literal ', highlighted: false },
      { text: '.*', highlighted: true },
      { text: ' and ', highlighted: false },
      { text: '<b>', highlighted: true },
      { text: ' text', highlighted: false },
    ]);
    expect(searchHighlightSegments('No match', 'missing')).toEqual([
      { text: 'No match', highlighted: false },
    ]);
  });

  it('describes recent, loading, failed, empty, and populated result states', () => {
    expect(commandResultSummary('', 1, 'ready')).toBe('1 recent item');
    expect(commandResultSummary('', 0, 'ready')).toBe('0 recent items');
    expect(commandResultSummary('alpha', 0, 'loading')).toBe('Searching workspace');
    expect(commandResultSummary('alpha', 0, 'error')).toBe('Search unavailable');
    expect(commandResultSummary(' alpha ', 0, 'ready')).toBe('No results for "alpha"');
    expect(commandResultSummary('alpha', 2, 'ready')).toBe('2 results');
  });

  it('derives stable option IDs from the controlled listbox', () => {
    expect(commandOptionId('command-list', 0)).toBe('command-list-option-0');
    expect(commandOptionId('command-list', 4)).toBe('command-list-option-4');
  });

  it('wires the focused input to selected, non-tabbable listbox options', async () => {
    const app = await readFile(join(process.cwd(), 'apps/web/src/App.tsx'), 'utf8');
    const components = await readFile(join(process.cwd(), 'apps/web/src/components.tsx'), 'utf8');
    expect(app).toContain('role="combobox"');
    expect(app).toContain('aria-autocomplete="list"');
    expect(app).toContain('aria-controls={commandListId}');
    expect(app).toContain('aria-expanded={commandOpen}');
    expect(app).toContain('aria-activedescendant={commandOpen ? activeCommandOptionId : undefined}');
    expect(app).toContain('role="listbox"');
    expect(app).toContain('role="option"');
    expect(app).toContain('aria-selected={selected}');
    expect(app).toContain('tabIndex={-1}');
    expect(components).toContain('element.tabIndex >= 0 && element.getClientRects().length > 0');
    expect(app).toContain("?.scrollIntoView({ block: 'nearest' });");
    expect(app).toContain('if (moveCommandSelection(event.key))');
    expect(app).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(app).toContain('<HighlightedSearchText value={result.identifier');
    expect(app).toContain('<mark key={index}>{segment.text}</mark>');
    expect(app).not.toContain('dangerouslySetInnerHTML');
  });

  it('keeps four fixed command indices aligned with dynamic search results', async () => {
    const app = await readFile(join(process.cwd(), 'apps/web/src/App.tsx'), 'utf8');
    expect(app).toContain('onSelect={() => runCommand(3)}');
    expect(app).toContain('const optionIndex = index + 4;');
    expect(app).toContain('const result = visibleCommandResults[index - 4];');
    expect(app).toContain('<strong>My work</strong>');
  });

  it('keeps result metadata and emphasis inside stable single-line geometry', async () => {
    const styles = await readFile(join(process.cwd(), 'apps/web/src/styles.css'), 'utf8');
    expect(styles).toContain('.command-result-meta { min-height: 24px;');
    expect(styles).toContain('.command-list strong, .command-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
    expect(styles).toContain('.command-list mark { padding: 0;');
  });
});
