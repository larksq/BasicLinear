import { describe, expect, it } from 'vitest';
import {
  ISSUE_PANEL_DEFAULT_WIDTH,
  ISSUE_PANEL_MAX_WIDTH,
  ISSUE_PANEL_MIN_WIDTH,
  clampIssuePanelWidth,
  issuePanelWidthForKey,
  issuePanelWidthForPointer,
  navigationRailDefaultCollapsed,
  readIssuePanelWidth,
  readNavigationRailPreference,
  writeIssuePanelWidth,
  writeNavigationRailCollapsed,
  type PreferenceStorage,
} from '../src/layout-preferences.js';

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('layout preferences', () => {
  it('reads only explicit navigation rail choices', () => {
    const storage = new MemoryStorage();
    expect(readNavigationRailPreference(storage)).toBeNull();
    writeNavigationRailCollapsed(storage, true);
    expect(readNavigationRailPreference(storage)).toBe(true);
    writeNavigationRailCollapsed(storage, false);
    expect(readNavigationRailPreference(storage)).toBe(false);
    storage.values.set('workspace.navigation-rail-collapsed.v1', '1');
    expect(readNavigationRailPreference(storage)).toBeNull();
  });

  it('defaults only tablet viewports to the collapsed rail', () => {
    expect(navigationRailDefaultCollapsed(767)).toBe(false);
    expect(navigationRailDefaultCollapsed(768)).toBe(true);
    expect(navigationRailDefaultCollapsed(1_024)).toBe(true);
    expect(navigationRailDefaultCollapsed(1_199)).toBe(true);
    expect(navigationRailDefaultCollapsed(1_200)).toBe(false);
  });

  it('defaults and clamps issue panel width', () => {
    const storage = new MemoryStorage();
    expect(readIssuePanelWidth(storage)).toBe(ISSUE_PANEL_DEFAULT_WIDTH);
    storage.values.set('workspace.issue-panel-width.v1', '120');
    expect(readIssuePanelWidth(storage)).toBe(ISSUE_PANEL_MIN_WIDTH);
    storage.values.set('workspace.issue-panel-width.v1', '900');
    expect(readIssuePanelWidth(storage)).toBe(ISSUE_PANEL_MAX_WIDTH);
    storage.values.set('workspace.issue-panel-width.v1', 'invalid');
    expect(readIssuePanelWidth(storage)).toBe(ISSUE_PANEL_DEFAULT_WIDTH);
    expect(clampIssuePanelWidth(521.6)).toBe(522);
  });

  it('supports bounded separator keyboard movement', () => {
    expect(issuePanelWidthForKey(560, 'ArrowLeft')).toBe(576);
    expect(issuePanelWidthForKey(560, 'ArrowRight')).toBe(544);
    expect(issuePanelWidthForKey(500, 'Home')).toBe(ISSUE_PANEL_MIN_WIDTH);
    expect(issuePanelWidthForKey(500, 'End')).toBe(ISSUE_PANEL_MAX_WIDTH);
    expect(issuePanelWidthForKey(500, 'Enter')).toBeNull();
    expect(issuePanelWidthForKey(ISSUE_PANEL_MIN_WIDTH, 'ArrowRight')).toBe(ISSUE_PANEL_MIN_WIDTH);
    expect(issuePanelWidthForKey(ISSUE_PANEL_MAX_WIDTH, 'ArrowLeft')).toBe(ISSUE_PANEL_MAX_WIDTH);
  });

  it('translates pointer movement into a clamped right-panel width', () => {
    expect(issuePanelWidthForPointer(560, 800, 760)).toBe(600);
    expect(issuePanelWidthForPointer(560, 800, 840)).toBe(520);
    expect(issuePanelWidthForPointer(560, 800, 100)).toBe(ISSUE_PANEL_MAX_WIDTH);
    expect(issuePanelWidthForPointer(560, 800, 1_000)).toBe(ISSUE_PANEL_MIN_WIDTH);
  });

  it('ignores unavailable preference storage', () => {
    const unavailable: PreferenceStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
    };
    expect(readNavigationRailPreference(unavailable)).toBeNull();
    expect(readIssuePanelWidth(unavailable)).toBe(ISSUE_PANEL_DEFAULT_WIDTH);
    expect(() => writeNavigationRailCollapsed(unavailable, true)).not.toThrow();
    expect(() => writeIssuePanelWidth(unavailable, 600)).not.toThrow();
  });
});
