import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('dense record table semantics', () => {
  it('does not expose a team administration table', async () => {
    const app = await source('apps/web/src/App.tsx');
    expect(app).not.toContain('aria-label="Teams"');
    expect(app).not.toContain('<code role="cell">{team.key}</code>');
    expect(app).not.toContain('className="name-cell"');
  });

  it('does not expose a member or role administration table', async () => {
    const app = await source('apps/web/src/App.tsx');
    expect(app).not.toContain('aria-label="Members"');
    expect(app).not.toContain('className="member-cell"');
    expect(app).not.toContain('className="role-badge"');
  });

  it('exposes project headers and interactive rows as a multiselect grid', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain('role="grid" aria-label="Projects" aria-multiselectable={canWriteProjects || undefined}');
    expect(projects).toContain('<span role="columnheader">Project</span>');
    expect(projects).toContain('{effectiveVisibleProperties.map((property) => <span className={`project-property-header project-property-${property}`} role="columnheader" key={property}>{projectViewPropertyLabel(property)}</span>)}');
    expect(projects).toContain('<span className="sr-only" role="columnheader">Actions</span>');
    expect(projects).toContain('<div className="project-group" role="rowgroup" key={group.key}>');
    expect(projects).toContain('<span className="project-group-cell" role="rowheader" aria-colspan={2 + effectiveVisibleProperties.length}>');
    expect(projects).toContain('<span className="project-name-cell" role="gridcell">');
    expect(projects).toContain('<ProjectPropertyCell project={item} property={property} teams={teams} members={members} key={property} />');
    expect(projects).toContain('<span className="row-actions project-row-actions" role="gridcell"');
  });

  it('keeps conditional issue headers aligned with conditional data cells', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain('<span className="issue-select-cell" role="columnheader">');
    expect(issues).toContain('<span role="columnheader">Status</span><span role="columnheader">Issue</span>');
    for (const property of ['Priority', 'Assignee', 'Project', 'Labels']) {
      expect(issues).toContain(`<span role="columnheader">${property}</span>`);
    }
    expect(issues).toContain('<span role="columnheader">Due</span>');
    expect(issues).toContain('<span className="issue-action-header sr-only" role="columnheader">Actions</span>');
    expect(issues).toContain('<span className="issue-select-cell" role="cell">');
    expect(issues).toContain('className="issue-status-cell" role="cell"');
    expect(issues).toContain('className="issue-title-cell" role="cell"');
    expect(issues).toContain('<span className="issue-action-cell" role="cell">');
  });

  it('exposes grouped virtual issues through table row-group semantics', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain('<div className="issue-list-scroll" role="rowgroup"');
    expect(issues).toContain('<div className="issue-list-spacer" role="presentation"');
    expect(issues).toContain('className="issue-group-row"');
    expect(issues).toContain('role="row"');
    expect(issues).toContain('<span className="issue-group-cell" role="rowheader" aria-colspan={4 + state.visibleProperties.length}>');
    expect(issues).toContain('aria-expanded={!collapsed}');
  });

  it('uses a named native table with complete saved-view columns and row groups', async () => {
    const views = await source('apps/web/src/saved-views.tsx');
    expect(views).toContain('aria-labelledby="saved-views-title" aria-describedby="saved-views-description"');
    expect(views).toContain('<div className="saved-view-table-scroll" role="region" aria-label="Saved views table" tabIndex={0}>');
    expect(views).toContain('<table className="saved-view-table">');
    for (const column of ['View', 'Layout', 'Group', 'Filters', 'Updated', 'Actions']) {
      expect(views).toContain(`<th scope="col">${column}</th>`);
    }
    expect(views).not.toContain('<th scope="col">Access</th>');
    expect(views).toContain('<tr className="saved-view-section-row"><td colSpan={6}><strong role="heading" aria-level={2}>');
    expect(views).not.toContain('scope="rowgroup"');
    expect(views).toContain('<tr key={view.id} data-saved-view-id={view.id}>');
    expect(views).toContain('<th scope="row">');
    expect(views).toContain('<time dateTime={view.updatedAt}');
    expect(views).toContain('<div className="saved-view-actions" role="group" aria-label={`Actions for ${view.name}`}>');
    expect(views).not.toContain('<span className="sr-only">Actions for {view.name}</span>');
  });
});
