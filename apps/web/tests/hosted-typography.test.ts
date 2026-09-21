import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('hosted Linear typography system', () => {
  const packageJson = JSON.parse(readFileSync('apps/web/package.json', 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const hostedEntry = readFileSync('apps/web/src/hosted-main.tsx', 'utf8');
  const localEntry = readFileSync('apps/web/src/main.tsx', 'utf8');
  const styles = readFileSync('apps/web/src/hosted-workspace.css', 'utf8');

  it('self-hosts the same variable Inter family in both application entries', () => {
    expect(packageJson.dependencies['@fontsource-variable/inter']).toBe('5.3.0');
    expect(hostedEntry).toContain("import '@fontsource-variable/inter/wght.css';");
    expect(localEntry).toContain("import '@fontsource-variable/inter/wght.css';");
    expect(styles).toContain('--ol-online-font-family: "Inter Variable", "SF Pro Display"');
    expect(styles).toContain('font-family: var(--ol-online-font-family);');
    expect(styles).toContain('font-optical-sizing: auto;');
  });

  it('defines the measured Linear display, section, body, UI, and metadata scale', () => {
    expect(styles).toContain('--ol-type-display-size: 24px;');
    expect(styles).toContain('--ol-type-display-line: 32px;');
    expect(styles).toContain('--ol-type-section-size: 15px;');
    expect(styles).toContain('--ol-type-section-line: 23px;');
    expect(styles).toContain('--ol-type-body-size: 15px;');
    expect(styles).toContain('--ol-type-body-line: 24px;');
    expect(styles).toContain('--ol-type-ui-size: 13px;');
    expect(styles).toContain('--ol-type-ui-line: 20px;');
    expect(styles).toContain('--ol-type-meta-size: 12px;');
    expect(styles).toContain('--ol-type-meta-line: 16.8px;');
  });

  it('applies the shared hierarchy across shell, records, properties, forms, and settings', () => {
    expect(styles).toContain('.ol-global-nav button,');
    expect(styles).toContain('.ol-title-editor textarea,');
    expect(styles).toContain('.ol-description-copy,');
    expect(styles).toContain('.ol-record-section-heading h2,');
    expect(styles).toContain('.ol-issue-group li strong,');
    expect(styles).toContain('.ol-event-list p,');
    expect(styles).toContain('.ol-property-static-value,');
    expect(styles).toContain('.ol-settings-content .hosted-section-heading h2,');
    expect(styles).toContain('.ol-modal input,');
    expect(styles).toContain(
      '.ol-issue-tabs button,\n.ol-team-home-tabs button { font-weight: 500; }',
    );
    expect(styles).toContain('letter-spacing: -.16px;');
    expect(styles).toContain('letter-spacing: -.1px;');
    expect(styles).toContain('letter-spacing: -.26px;');
  });
});
