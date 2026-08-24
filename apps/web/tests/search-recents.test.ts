import { describe, expect, it } from 'vitest';
import type { SearchResult } from '@openlinear/contracts';
import {
  addRecentSearchResult,
  readWorkspaceRecentSearch,
  workspaceRecentSearchKey,
  writeWorkspaceRecentSearch,
} from '../src/search-recents.js';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function issue(id: string, title: string): SearchResult {
  return {
    kind: 'issue',
    id,
    identifier: `QA-${id}`,
    title,
    subtitle: 'Product Quality',
    matchedBy: 'title',
    rank: 1,
  };
}

describe('workspace recent search', () => {
  it('keeps results isolated by workspace and ignores the legacy global key', () => {
    const storage = new MemoryStorage();
    const northstar = issue('1', 'Northstar result');
    const acceptance = issue('2', 'Acceptance result');
    storage.setItem('openlinear.recent-search', JSON.stringify([northstar]));

    writeWorkspaceRecentSearch(storage, 'workspace-a', [northstar]);
    writeWorkspaceRecentSearch(storage, 'workspace-b', [acceptance]);

    expect(readWorkspaceRecentSearch(storage, 'workspace-a')).toEqual([northstar]);
    expect(readWorkspaceRecentSearch(storage, 'workspace-b')).toEqual([acceptance]);
    expect(readWorkspaceRecentSearch(storage, 'workspace-c')).toEqual([]);
    expect(workspaceRecentSearchKey('workspace-a')).not.toBe(workspaceRecentSearchKey('workspace-b'));
  });

  it('deduplicates the selected result and caps history at six entries', () => {
    const existing = Array.from({ length: 6 }, (_, index) => issue(String(index), `Issue ${index}`));
    const selected = issue('3', 'Updated issue 3');

    expect(addRecentSearchResult(existing, selected)).toEqual([
      selected,
      existing[0],
      existing[1],
      existing[2],
      existing[4],
      existing[5],
    ]);
  });

  it('rejects malformed stored values without leaking or throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(workspaceRecentSearchKey('workspace-a'), '{broken');
    storage.setItem(workspaceRecentSearchKey('workspace-b'), JSON.stringify([{ title: 'partial' }]));

    expect(readWorkspaceRecentSearch(storage, 'workspace-a')).toEqual([]);
    expect(readWorkspaceRecentSearch(storage, 'workspace-b')).toEqual([]);
  });
});
