import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../src/components.js';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('core empty-state actions', () => {
  it('renders one optional action region without adding an empty wrapper', () => {
    const informative = renderToStaticMarkup(createElement(EmptyState, {
      icon: createElement('span', { 'aria-hidden': true }),
      title: 'No activity',
    }));
    const actionable = renderToStaticMarkup(createElement(EmptyState, {
      icon: createElement('span', { 'aria-hidden': true }),
      title: 'No projects',
      action: createElement('button', { type: 'button' }, 'New project'),
    }));

    expect(informative).not.toContain('empty-state-action');
    expect(actionable.match(/empty-state-action/g)).toHaveLength(1);
    expect(actionable).toContain('<button type="button">New project</button>');
  });

  it('distinguishes empty, filtered, archived, and milestone project states', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain("? 'No matching projects'");
    expect(projects).toContain('onClick={clearProjectFilters}>Clear filters</button>');
    expect(projects).toContain("onClick={() => setArchiveState('active')}>View active</button>");
    expect(projects).toContain('onClick={openProjectCreate}><Plus size={15} />New project</button>');
    expect(projects).toContain('onClick={openMilestoneCreate}><Plus size={15} />Add milestone</button>');
  });

  it('preserves issue context while clearing only result filters', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain("? 'No matching issues'");
    expect(issues).toContain('searchQuery: \'\'');
    expect(issues).toContain('filter: cloneIssueViewState(initialIssueViewState).filter');
    expect(issues).toContain('`No issues in ${contextMilestone.name}`');
    expect(issues).toContain('`No issues in ${contextProject.name}`');
    expect(issues).toContain('onClick={openIssueCreate}><Plus size={15} />New issue</button>');
  });

  it('makes saved-view search and archive dead ends recoverable', async () => {
    const views = await source('apps/web/src/saved-views.tsx');
    expect(views).toContain('onClick={() => setQuery(\'\')}>Clear search</button>');
    expect(views).toContain('onClick={() => setMode(\'active\')}>View active</button>');
    expect(views).toContain('onClick={onBuildView}><Plus size={15} />Build view</button>');
  });

  it('keeps action geometry stable and long labels contained', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.empty-state strong { max-width: min(100%, 420px); overflow-wrap: anywhere; }');
    expect(styles).toContain('.empty-state-action { min-height: 30px; display: flex; align-items: center; justify-content: center; }');
  });
});
