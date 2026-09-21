import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('hosted Linear-style issue property rail', () => {
  const source = readFileSync('apps/web/src/hosted-workspace.tsx', 'utf8');
  const styles = readFileSync('apps/web/src/hosted-workspace.css', 'utf8');

  it('uses value-first core rows and grouped project and team sections', () => {
    expect(source).toContain('<div className="ol-property-primary" aria-label="Core properties">');
    expect(source).toContain('<span className="ol-sr-only">Status</span>');
    expect(source).toContain('<span className="ol-sr-only">Priority</span>');
    expect(source).toContain('<span className="ol-sr-only">Assignee</span>');
    expect(source).toContain('<h3 id="ol-project-properties-title">Project</h3>');
    expect(source).toContain('<h3 id="ol-team-properties-title">Team</h3>');
    expect(source).toContain('className="ol-property-static-value"');
    expect(source).not.toContain('<PriorityIcon priority={selectedIssue.priority} size={15} /> Priority');
  });

  it('matches the measured Linear rail geometry without weakening menu behavior', () => {
    expect(styles).toContain('width: min(100%, 1733px)');
    expect(styles).toContain('grid-template-columns: minmax(0, 1333px) 400px');
    expect(styles).toContain('width: min(100%, 851px)');
    expect(styles).toContain('margin: 0 26px 0 auto');
    expect(styles).toContain('padding: 81px 0 54px 4px');
    expect(styles).toContain('.ol-property-row { min-width: 0; height: 32px');
    expect(styles).toContain('height: 28px');
    expect(styles).toContain('border-radius: 9999px');
    expect(styles).toContain('.ol-linear-menu-trigger:focus-visible > svg:last-child');
    expect(source).toContain('aria-haspopup="listbox"');
    expect(source).toContain("if (event.key === 'ArrowDown')");
    expect(source).toContain('triggerRef.current?.focus()');
  });

  it('keeps the rail usable when the issue detail stacks on smaller screens', () => {
    expect(styles).toContain('@media (max-width: 820px)');
    expect(styles).toContain('.ol-issue-detail, .ol-project-detail, .ol-settings-view { display: block; }');
    expect(styles).toContain('.ol-detail-body { margin: 0 auto; }');
    expect(styles).toContain('.ol-properties, .ol-milestones-panel { border-top: 1px solid var(--ol-online-border); border-left: 0; }');
  });
});
