import type { PreferenceStorage } from './layout-preferences.js';

export const APPEARANCE_PREFERENCE_KEY = 'appearance.theme.v1';
export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const;

export type AppearancePreference = typeof APPEARANCE_PREFERENCES[number];
export type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;

export const APPEARANCE_THEME_COLORS: Record<ResolvedAppearance, string> = {
  light: '#f7f7f8',
  dark: '#171719',
};

export function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value !== null && APPEARANCE_PREFERENCES.includes(value as AppearancePreference);
}

export function readAppearancePreference(storage: PreferenceStorage): AppearancePreference {
  try {
    const value = storage.getItem(APPEARANCE_PREFERENCE_KEY);
    return isAppearancePreference(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeAppearancePreference(
  storage: PreferenceStorage,
  preference: AppearancePreference,
): void {
  try {
    storage.setItem(APPEARANCE_PREFERENCE_KEY, preference);
  } catch {
    // Appearance preferences never block the primary workflow.
  }
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemPrefersDark: boolean,
): ResolvedAppearance {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

export function appearanceMenuIndex(current: number, key: string): number | null {
  const last = APPEARANCE_PREFERENCES.length - 1;
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key === 'ArrowDown' || key === 'ArrowRight') return current >= last ? 0 : current + 1;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return current <= 0 ? last : current - 1;
  return null;
}

export function appearanceLabel(preference: AppearancePreference): string {
  return `${preference.slice(0, 1).toUpperCase()}${preference.slice(1)}`;
}
