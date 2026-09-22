import type { SearchResult } from '@basiclinear/contracts';

interface RecentSearchStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const recentSearchPrefix = 'basiclinear.recent-search:';
const resultKinds = new Set<SearchResult['kind']>(['issue', 'project']);
const matchKinds = new Set<SearchResult['matchedBy']>([
  'identifier',
  'title',
  'description',
  'label',
  'summary',
]);

function isSearchResult(value: unknown): value is SearchResult {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return resultKinds.has(candidate.kind as SearchResult['kind'])
    && typeof candidate.id === 'string'
    && (typeof candidate.identifier === 'string' || candidate.identifier === null)
    && typeof candidate.title === 'string'
    && typeof candidate.subtitle === 'string'
    && matchKinds.has(candidate.matchedBy as SearchResult['matchedBy'])
    && Number.isSafeInteger(candidate.rank)
    && Number(candidate.rank) >= 0;
}

export function workspaceRecentSearchKey(workspaceId: string): string {
  return `${recentSearchPrefix}${workspaceId}`;
}

export function readWorkspaceRecentSearch(
  storage: RecentSearchStorage,
  workspaceId: string,
): SearchResult[] {
  if (workspaceId === '') return [];
  try {
    const parsed = JSON.parse(storage.getItem(workspaceRecentSearchKey(workspaceId)) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSearchResult).slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function addRecentSearchResult(
  current: readonly SearchResult[],
  result: SearchResult,
): SearchResult[] {
  return [
    result,
    ...current.filter((item) => item.kind !== result.kind || item.id !== result.id),
  ].slice(0, 6);
}

export function writeWorkspaceRecentSearch(
  storage: RecentSearchStorage,
  workspaceId: string,
  results: readonly SearchResult[],
): void {
  if (workspaceId === '') return;
  try {
    storage.setItem(workspaceRecentSearchKey(workspaceId), JSON.stringify(results));
  } catch {
    // Search remains usable when browser storage is unavailable or full.
  }
}
