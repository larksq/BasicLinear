import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

describe('hosted Linear-style team home layout', () => {
  const source = readFileSync('apps/web/src/hosted-workspace.tsx', 'utf8');
  const styles = readFileSync('apps/web/src/hosted-workspace.css', 'utf8');

  it('keeps recent issue identifiers on one line and gives titles the flexible track', () => {
    expect(source).toContain('className="ol-home-issue-key">{issueKey(issue)}</span>');
    expect(styles).toContain('grid-template-columns: 15px 78px minmax(0, 1fr) auto 13px');
    expect(styles).toContain('.ol-home-issue-key { white-space: nowrap; }');
    expect(styles).toContain('.ol-home-section li strong { overflow: hidden;');
    expect(styles).toContain('text-overflow: ellipsis; white-space: nowrap; }');
  });

  it('preserves full-row issue navigation', () => {
    expect(source).toContain('<li key={issue.id}><button type="button" onClick={() => openIssue(issue)}>');
  });
});
