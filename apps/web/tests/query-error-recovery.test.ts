import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/api.js';
import { QueryErrorState } from '../src/components.js';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

describe('query error recovery', () => {
  it('renders one actionable alert with the API correlation identifier', () => {
    const markup = renderToStaticMarkup(createElement(QueryErrorState, {
      title: 'Could not load projects',
      error: new ApiError(503, {
        error: {
          code: 'READ_FAILED',
          message: 'The local read failed.',
          correlationId: 'corr-query-01',
        },
      }),
      onRetry: () => undefined,
    }));

    expect(markup.match(/role="alert"/g)).toHaveLength(1);
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('aria-atomic="true"');
    expect(markup).toContain('<strong>Could not load projects</strong>');
    expect(markup).toContain('<span>The local read failed.</span>');
    expect(markup).toContain('<code>corr-query-01</code>');
    expect(markup).toContain('Try again</button>');
  });

  it('locks the retry control without changing compact-state geometry', () => {
    const markup = renderToStaticMarkup(createElement(QueryErrorState, {
      title: 'Could not search this workspace',
      error: new Error('Search failed.'),
      onRetry: () => undefined,
      retrying: true,
      compact: true,
    }));

    expect(markup).toContain('class="query-error-state compact"');
    expect(markup).toContain('<button type="button" class="button" disabled=""');
    expect(markup).toContain('class="lucide lucide-loader-circle spinner"');
    expect(markup).toContain('Trying again</button>');
  });

  it('makes owner context, command search, projects, and saved views retryable', async () => {
    const [app, projects, savedViews] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/projects.tsx'),
      source('apps/web/src/saved-views.tsx'),
    ]);

    expect(app).toContain('const ownerContextBlockingError = (teams.data === undefined ? teams.error : null)');
    expect(app).toContain('if (teams.data === undefined && teams.error !== null) retries.push(teams.refetch());');
    expect(app).toContain('title="Could not load the local workspace"');
    expect(app).toContain('commandResults.error !== null && commandResults.data === undefined');
    expect(app).toContain('title="Could not search this workspace"');
    expect(projects).toContain('const projectListBlockingError = projects.data === undefined ? projects.error : null;');
    expect(projects).toContain('title="Could not load projects"');
    expect(projects).toContain('title="Could not load this project"');
    expect(projects).toContain('title="Could not load project milestones"');
    expect(projects).toContain('title="Could not load project activity"');
    expect(savedViews).toContain('const savedViewsBlockingError = savedViews.data === undefined ? savedViews.error : null;');
    expect(savedViews).toContain('title="Could not load saved views"');
  });

  it('keeps issue reads state-exclusive and retries only failed dependencies', async () => {
    const issues = await source('apps/web/src/issues.tsx');

    expect(issues).toContain('const issueBlockingError = issue.data === undefined ? issue.error : null;');
    expect(issues).toContain('const relationBlockingError = (relations.data === undefined ? relations.error : null)');
    expect(issues).toContain('if (relations.data === undefined && relations.error !== null) tasks.push(relations.refetch());');
    expect(issues).toContain('title="Could not load this issue"');
    expect(issues).toContain('title="Could not load issue relationships"');
    expect(issues).toContain('title="Could not load issue comments"');
    expect(issues).toContain('title="Could not load issue milestones"');
    expect(issues).toContain('title="Could not load issue activity"');
    expect(issues).toContain('const issueListBlockingError = (invalidUrlFilter === null && issues.data === undefined ? issues.error : null)');
    expect(issues).toContain('if (labels.data === undefined && labels.error !== null) tasks.push(labels.refetch());');
    expect(issues).toContain('title="Could not load issues"');
    expect(issues).toContain('error={createComment.error ?? (comments.data === undefined ? null : comments.error)}');
  });

  it('reserves responsive error geometry and contains long diagnostics', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(styles).toContain('.query-error-state { min-height: 132px; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto;');
    expect(styles).toContain('.query-error-copy strong, .query-error-copy span, .query-error-copy code { min-width: 0; overflow-wrap: anywhere; }');
    expect(styles).toContain('.query-error-state.compact { min-height: 64px; padding-block: 10px; }');
    expect(styles).toContain('.issue-secondary-query-error { grid-column: 1 / -1; min-width: 0; }');
    expect(styles).toContain('.query-error-state { grid-template-columns: 20px minmax(0, 1fr); align-items: start; }');
    expect(styles).toContain('.query-error-state > .button { grid-column: 2; justify-self: start; }');
  });
});
