export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const NAVIGATION_RAIL_COLLAPSED_KEY = 'workspace.navigation-rail-collapsed.v1';
export const ISSUE_PANEL_WIDTH_KEY = 'workspace.issue-panel-width.v1';
export const ISSUE_PANEL_MIN_WIDTH = 480;
export const ISSUE_PANEL_MAX_WIDTH = 640;
export const ISSUE_PANEL_DEFAULT_WIDTH = 560;
export const TABLET_RAIL_MIN_WIDTH = 768;
export const TABLET_RAIL_MAX_WIDTH = 1199;

function read(storage: PreferenceStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage: PreferenceStorage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Preferences never block the primary workflow.
  }
}

export function readNavigationRailPreference(storage: PreferenceStorage): boolean | null {
  const value = read(storage, NAVIGATION_RAIL_COLLAPSED_KEY);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function navigationRailDefaultCollapsed(viewportWidth: number): boolean {
  return viewportWidth >= TABLET_RAIL_MIN_WIDTH && viewportWidth <= TABLET_RAIL_MAX_WIDTH;
}

export function writeNavigationRailCollapsed(storage: PreferenceStorage, collapsed: boolean): void {
  write(storage, NAVIGATION_RAIL_COLLAPSED_KEY, String(collapsed));
}

export function clampIssuePanelWidth(value: number): number {
  if (!Number.isFinite(value)) return ISSUE_PANEL_DEFAULT_WIDTH;
  return Math.min(ISSUE_PANEL_MAX_WIDTH, Math.max(ISSUE_PANEL_MIN_WIDTH, Math.round(value)));
}

export function readIssuePanelWidth(storage: PreferenceStorage): number {
  const value = read(storage, ISSUE_PANEL_WIDTH_KEY);
  return value === null || value.trim() === ''
    ? ISSUE_PANEL_DEFAULT_WIDTH
    : clampIssuePanelWidth(Number(value));
}

export function writeIssuePanelWidth(storage: PreferenceStorage, width: number): void {
  write(storage, ISSUE_PANEL_WIDTH_KEY, String(clampIssuePanelWidth(width)));
}

export function issuePanelWidthForPointer(startWidth: number, startX: number, currentX: number): number {
  return clampIssuePanelWidth(startWidth + startX - currentX);
}

export function issuePanelWidthForKey(current: number, key: string): number | null {
  if (key === 'Home') return ISSUE_PANEL_MIN_WIDTH;
  if (key === 'End') return ISSUE_PANEL_MAX_WIDTH;
  if (key === 'ArrowLeft') return clampIssuePanelWidth(current + 16);
  if (key === 'ArrowRight') return clampIssuePanelWidth(current - 16);
  return null;
}
