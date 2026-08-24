import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('mobile navigation Escape contract', () => {
  it('owns Escape before route-level dismissal and removes the same listener', async () => {
    const app = await readFile(join(root, 'apps/web/src/App.tsx'), 'utf8');
    const effect = app.slice(
      app.indexOf("if (!mobileOpen) return undefined;"),
      app.indexOf('  }, [mobileOpen]);') + '  }, [mobileOpen]);'.length,
    );

    expect(effect).toContain("if (event.key !== 'Escape') return;");
    expect(effect).toContain('event.preventDefault();');
    expect(effect).toContain('event.stopPropagation();');
    expect(effect).toContain('closeMobileNavigation();');
    expect(effect).toContain("window.addEventListener('keydown', close, { capture: true });");
    expect(effect).toContain("window.removeEventListener('keydown', close, { capture: true });");
  });
});
