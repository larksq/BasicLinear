import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  issuePropertiesInspectorBreakpoint,
  issuePropertiesInspectorDesktopQuery,
  issuePropertiesInspectorInitialOpen,
  issuePropertiesInspectorState,
} from '../src/issue-properties-inspector.js';

describe('issue properties inspector state', () => {
  it('shares the accepted mobile boundary with issue detail presentation', () => {
    expect(issuePropertiesInspectorBreakpoint).toBe(768);
    expect(issuePropertiesInspectorDesktopQuery).toBe('(min-width: 768px)');
    expect(issuePropertiesInspectorInitialOpen(false)).toBe(false);
    expect(issuePropertiesInspectorInitialOpen(true)).toBe(true);
  });

  it('toggles only the current mobile disclosure state', () => {
    expect(issuePropertiesInspectorState(false, { type: 'toggle' })).toBe(true);
    expect(issuePropertiesInspectorState(true, { type: 'toggle' })).toBe(false);
  });

  it('synchronizes live breakpoint changes without retaining a stale disclosure state', () => {
    expect(issuePropertiesInspectorState(false, { type: 'viewport', desktop: true })).toBe(true);
    expect(issuePropertiesInspectorState(true, { type: 'viewport', desktop: false })).toBe(false);
  });

  it('resets each issue to the current viewport default', () => {
    expect(issuePropertiesInspectorState(true, { type: 'issue', desktop: false })).toBe(false);
    expect(issuePropertiesInspectorState(false, { type: 'issue', desktop: true })).toBe(true);
  });

  it('cannot conceal pending or failed property recovery', () => {
    expect(issuePropertiesInspectorState(false, { type: 'require-visible' })).toBe(true);
    expect(issuePropertiesInspectorState(true, { type: 'require-visible' })).toBe(true);
  });
});

describe('issue properties inspector source contract', () => {
  it('exposes one named controlled region without changing property controls', async () => {
    const [issues, bufferedDateInput] = await Promise.all([
      readFile(join(process.cwd(), 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'apps/web/src/buffered-date-input.tsx'), 'utf8'),
    ]);
    const start = issues.indexOf('function IssuePropertiesEditor');
    const end = issues.indexOf('function IssueRelationSection', start);
    const properties = issues.slice(start, end);

    expect(properties).toContain('className="issue-properties-inspector-toggle"');
    expect(properties).toContain('aria-controls={inspectorRegionId}');
    expect(properties).toContain('aria-expanded={inspectorVisible}');
    expect(properties).toContain('aria-disabled={inspectorRequiresVisibility || undefined}');
    expect(properties).toContain('hidden={!inspectorVisible}');
    expect(properties).toContain("type: 'require-visible'");
    expect(properties).toContain("type: 'issue'");
    expect(properties).toContain("type: 'viewport'");
    for (const label of [
      'Issue status',
      'Issue priority',
      'Issue project',
      'Issue milestone',
      'Labels',
    ]) {
      expect(properties).toContain(label);
    }
    expect(issues).toContain('<BufferedDateInput label="Issue due date"');
    expect(bufferedDateInput).toContain('aria-label={label}');
    expect(issues).toContain('className="issue-due-date-control"');
    expect(issues).toContain('className="issue-due-date-icon"');
    expect(properties).toContain('<IssueDueDateEditor');
  });

  it('keeps the inspector mobile-only with stable disclosure geometry', async () => {
    const styles = await readFile(join(process.cwd(), 'apps/web/src/styles.css'), 'utf8');
    const responsiveStart = styles.indexOf('@media (max-width: 899px)');
    const mobileStart = styles.indexOf('@media (max-width: 767px)', responsiveStart);
    const responsiveStyles = styles.slice(responsiveStart, mobileStart);

    expect(styles).toContain('.issue-properties-inspector-toggle { display: none; }');
    expect(styles).toContain('.issue-properties[hidden] { display: none; }');
    expect(styles).toContain('@media (max-width: 767px)');
    expect(styles).toContain('.issue-properties-inspector-toggle { width: 100%; min-height: 42px; display: grid;');
    expect(styles).toContain('grid-template-columns: 18px minmax(0, 1fr) 18px;');
    expect(styles).toContain(".issue-properties-inspector-toggle[aria-expanded='true'] .issue-properties-inspector-chevron { transform: rotate(180deg); }");
    expect(styles).toContain('.issue-properties-inspector .issue-properties { padding: 10px 4px 4px; }');
    expect(responsiveStyles).toContain('.issue-properties-inspector { order: 2; }');
    expect(responsiveStyles).not.toContain('.issue-properties { order: 2; }');
  });
});
