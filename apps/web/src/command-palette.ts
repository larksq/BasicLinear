export const STATIC_COMMAND_COUNT = 4;

export interface SearchHighlightSegment {
  text: string;
  highlighted: boolean;
}

export type CommandResultPhase = 'ready' | 'loading' | 'error';

export function commandOptionCount(resultCount: number): number {
  return STATIC_COMMAND_COUNT + Math.max(0, Math.trunc(resultCount));
}

export function clampCommandIndex(index: number, optionCount: number): number {
  const lastIndex = Math.max(0, Math.trunc(optionCount) - 1);
  return Math.max(0, Math.min(lastIndex, Math.trunc(index)));
}

export function moveCommandIndex(
  index: number,
  direction: 'next' | 'previous',
  optionCount: number,
): number {
  return clampCommandIndex(index + (direction === 'next' ? 1 : -1), optionCount);
}

export function commandNavigationIndex(
  index: number,
  key: string,
  optionCount: number,
  disabledIndexes: readonly number[] = [],
): number | null {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) return null;
  const count = Math.max(0, Math.trunc(optionCount));
  const disabled = new Set(disabledIndexes.map((value) => Math.trunc(value)));
  const enabled = Array.from({ length: count }, (_, value) => value)
    .filter((value) => !disabled.has(value));
  if (enabled.length === 0) return null;
  if (key === 'Home') return enabled[0] ?? null;
  if (key === 'End') return enabled.at(-1) ?? null;

  const current = clampCommandIndex(index, count);
  if (key === 'ArrowDown') {
    return enabled.find((value) => value > current)
      ?? (disabled.has(current) ? enabled.at(-1) ?? null : current);
  }
  return enabled.findLast((value) => value < current)
    ?? (disabled.has(current) ? enabled[0] ?? null : current);
}

export function searchHighlightSegments(value: string, query: string): SearchHighlightSegment[] {
  if (value === '') return [];
  const terms = [...new Set(query.trim().split(/\s+/u)
    .map((term) => term.toLocaleLowerCase('en-US'))
    .filter((term) => term !== ''))]
    .sort((left, right) => right.length - left.length);
  if (terms.length === 0) return [{ text: value, highlighted: false }];

  const source = value.toLocaleLowerCase('en-US');
  const segments: SearchHighlightSegment[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    let matchIndex = -1;
    let matchTerm = '';
    for (const term of terms) {
      const index = source.indexOf(term, cursor);
      if (index < 0) continue;
      if (matchIndex < 0 || index < matchIndex || (index === matchIndex && term.length > matchTerm.length)) {
        matchIndex = index;
        matchTerm = term;
      }
    }
    if (matchIndex < 0) {
      segments.push({ text: value.slice(cursor), highlighted: false });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({ text: value.slice(cursor, matchIndex), highlighted: false });
    }
    const matchEnd = matchIndex + matchTerm.length;
    segments.push({ text: value.slice(matchIndex, matchEnd), highlighted: true });
    cursor = matchEnd;
  }
  return segments;
}

export function commandResultSummary(
  query: string,
  resultCount: number,
  phase: CommandResultPhase,
): string {
  const normalizedQuery = query.trim();
  const count = Math.max(0, Math.trunc(resultCount));
  if (normalizedQuery === '') return `${count} recent ${count === 1 ? 'item' : 'items'}`;
  if (phase === 'loading') return 'Searching workspace';
  if (phase === 'error') return 'Search unavailable';
  if (count === 0) return `No results for "${normalizedQuery}"`;
  return `${count} ${count === 1 ? 'result' : 'results'}`;
}

export function commandOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${Math.max(0, Math.trunc(index))}`;
}
