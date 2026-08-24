import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_PREFERENCE_KEY,
  APPEARANCE_PREFERENCES,
  APPEARANCE_THEME_COLORS,
  appearanceLabel,
  appearanceMenuIndex,
  readAppearancePreference,
  resolveAppearance,
  writeAppearancePreference,
} from '../src/appearance-preferences.js';
import type { PreferenceStorage } from '../src/layout-preferences.js';

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('appearance preferences', () => {
  it('reads and persists only the accepted appearance values', () => {
    const storage = new MemoryStorage();
    expect(readAppearancePreference(storage)).toBe('system');
    for (const preference of APPEARANCE_PREFERENCES) {
      writeAppearancePreference(storage, preference);
      expect(storage.values.get(APPEARANCE_PREFERENCE_KEY)).toBe(preference);
      expect(readAppearancePreference(storage)).toBe(preference);
    }
    storage.values.set(APPEARANCE_PREFERENCE_KEY, 'sepia');
    expect(readAppearancePreference(storage)).toBe('system');
  });

  it('keeps unavailable storage outside the primary workflow', () => {
    const unavailable: PreferenceStorage = {
      getItem: () => { throw new Error('unavailable'); },
      setItem: () => { throw new Error('unavailable'); },
    };
    expect(readAppearancePreference(unavailable)).toBe('system');
    expect(() => writeAppearancePreference(unavailable, 'dark')).not.toThrow();
  });

  it('resolves system changes without overriding explicit choices', () => {
    expect(resolveAppearance('system', false)).toBe('light');
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('dark', false)).toBe('dark');
    expect(APPEARANCE_THEME_COLORS.light).toBe('#f7f7f8');
    expect(APPEARANCE_THEME_COLORS.dark).toBe('#171719');
  });

  it('supports complete wrapped menu-radio keyboard navigation', () => {
    expect(appearanceMenuIndex(1, 'Home')).toBe(0);
    expect(appearanceMenuIndex(1, 'End')).toBe(2);
    expect(appearanceMenuIndex(0, 'ArrowUp')).toBe(2);
    expect(appearanceMenuIndex(2, 'ArrowDown')).toBe(0);
    expect(appearanceMenuIndex(0, 'ArrowRight')).toBe(1);
    expect(appearanceMenuIndex(1, 'ArrowLeft')).toBe(0);
    expect(appearanceMenuIndex(1, 'Enter')).toBeNull();
    expect(appearanceLabel('system')).toBe('System');
  });

  it('applies the persisted choice before the application module and uses semantic tokens', async () => {
    const root = process.cwd();
    const [html, bootstrap, app, tokens, styles] = await Promise.all([
      readFile(join(root, 'apps/web/index.html'), 'utf8'),
      readFile(join(root, 'apps/web/public/theme-bootstrap.js'), 'utf8'),
      readFile(join(root, 'apps/web/src/App.tsx'), 'utf8'),
      readFile(join(root, 'packages/ui/src/tokens.css'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
    ]);
    expect(html.indexOf('/theme-bootstrap.js')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('/theme-bootstrap.js')).toBeLessThan(html.indexOf('/src/main.tsx'));
    expect(bootstrap).toContain('appearance.theme.v1');
    expect(app).toContain('role="menuitemradio"');
    expect(app).toContain('aria-label={`Appearance: ${appearanceLabel(value)}`}');
    expect(app).toContain("media.addEventListener('change', apply)");
    expect(tokens).toContain(":root[data-theme='dark']");
    expect(tokens).toContain(':root:not([data-theme])');
    expect(styles).toContain('.appearance-popover');
  });
});
