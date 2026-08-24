import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingSkeleton } from '../src/components.js';

const cases = [
  { variant: 'gate', label: 'Loading application' },
  { variant: 'table', label: 'Loading projects', tableKind: 'projects' },
  { variant: 'table', label: 'Loading issues', tableKind: 'issues' },
  { variant: 'board', label: 'Loading issue board', boardDensity: 'comfortable' },
  { variant: 'detail', label: 'Loading issue details', panel: true },
  { variant: 'editor', label: 'Loading rich text editor' },
  { variant: 'command', label: 'Loading search results' },
  { variant: 'project', label: 'Loading project details' },
  { variant: 'workflow', label: 'Loading workflow statuses' },
  { variant: 'milestones', label: 'Loading project milestones' },
  { variant: 'relations', label: 'Loading issue relations' },
  { variant: 'comments', label: 'Loading issue comments' },
  { variant: 'activity', label: 'Loading issue activity' },
] as const;

describe('loading skeleton semantics', () => {
  it.each(cases)('renders one named, busy, non-interactive $variant status', (props) => {
    const markup = renderToStaticMarkup(createElement(LoadingSkeleton, props));
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain(`<span class="sr-only">${props.label}</span>`);
    expect(markup).not.toMatch(/<(?:button|input|select|textarea|a)\b/);
    expect(markup).not.toContain('tabindex=');
  });

  it('keeps each table geometry distinct', () => {
    const projects = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'table',
      tableKind: 'projects',
      label: 'Loading projects',
    }));
    const issues = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'table',
      tableKind: 'issues',
      label: 'Loading issues',
    }));
    expect(projects).toContain('loading-skeleton-table-projects');
    expect(projects.match(/skeleton-table-row/g)).toHaveLength(8);
    expect(issues).toContain('loading-skeleton-table-issues');
    expect(issues.match(/skeleton-table-row/g)).toHaveLength(8);
  });

  it('renders a stable issue-board structure at the selected density', () => {
    const board = renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant: 'board',
      boardDensity: 'compact',
      label: 'Loading issue board',
    }));
    expect(board).toContain('loading-skeleton-board-density-compact');
    expect(board.match(/class="skeleton-board-column"/g)).toHaveLength(3);
    expect(board.match(/class="skeleton-board-card"/g)).toHaveLength(9);
  });

  it('renders stable structures for the remaining read surfaces', () => {
    const render = (variant: Parameters<typeof LoadingSkeleton>[0]['variant']) => renderToStaticMarkup(createElement(LoadingSkeleton, {
      variant,
      label: `Loading ${variant}`,
    }));
    expect(render('project')).toContain('skeleton-project-overview');
    expect(render('workflow').match(/skeleton-workflow-group/g)).toHaveLength(2);
    expect(render('workflow').match(/skeleton-workflow-row/g)).toHaveLength(8);
    expect(render('milestones').match(/skeleton-milestone-row/g)).toHaveLength(4);
    expect(render('relations').match(/skeleton-relation-row/g)).toHaveLength(3);
    expect(render('comments').match(/skeleton-comment-row/g)).toHaveLength(2);
    expect(render('activity').match(/skeleton-activity-row/g)).toHaveLength(3);
  });
});
