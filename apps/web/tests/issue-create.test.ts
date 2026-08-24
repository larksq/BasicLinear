import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  contextualIssueCreateMilestoneId,
  defaultIssueCreateStatusId,
  issueCreateMilestones,
  reconcileIssueCreateMilestoneId,
  reconcileIssueCreateStatusId,
} from '../src/issue-create.js';

const active = (id: string, projectId = 'project-a') => ({ id, projectId, archivedAt: null });
const archived = (id: string, projectId = 'project-a') => ({
  id,
  projectId,
  archivedAt: '2026-08-20T00:00:00.000Z',
});
const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('issue creation milestone state', () => {
  it('keeps only unique active milestones owned by the selected project', () => {
    const duplicate = active('duplicate');
    expect(issueCreateMilestones('project-a', [
      active('first'),
      archived('archived'),
      active('other-project', 'project-b'),
      duplicate,
      { ...duplicate },
      active('second'),
    ])).toEqual([active('first'), active('second')]);
  });

  it.each([
    ['missing milestone', 'missing', 'project-a', [active('current')]],
    ['cleared project', 'current', '', [active('current')]],
    ['different project', 'current', 'project-b', [active('current')]],
    ['archived milestone', 'current', 'project-a', [archived('current')]],
    ['duplicate identity', 'current', 'project-a', [active('current'), active('current')]],
  ])('fails closed for a %s', (_label, milestoneId, projectId, milestones) => {
    expect(reconcileIssueCreateMilestoneId(milestoneId, projectId, milestones)).toBe('');
  });

  it('preserves a valid selection and an active contextual default', () => {
    const milestones = [active('current'), active('later')];
    expect(reconcileIssueCreateMilestoneId('later', 'project-a', milestones)).toBe('later');
    expect(contextualIssueCreateMilestoneId({ id: 'current' }, 'project-a', milestones)).toBe('current');
  });
});

describe('issue creation status state', () => {
  const statuses = [
    { id: 'started', teamId: 'team-a', category: 'started' as const },
    { id: 'backlog', teamId: 'team-a', category: 'unstarted' as const },
    { id: 'other-team', teamId: 'team-b', category: 'unstarted' as const },
  ];

  it('prefers the team unstarted status and preserves a valid explicit status', () => {
    expect(defaultIssueCreateStatusId('team-a', statuses)).toBe('backlog');
    expect(reconcileIssueCreateStatusId('started', 'team-a', statuses)).toBe('started');
  });

  it('replaces stale and cross-team status state with the selected team default', () => {
    expect(reconcileIssueCreateStatusId('other-team', 'team-a', statuses)).toBe('backlog');
    expect(reconcileIssueCreateStatusId('missing', 'team-a', statuses)).toBe('backlog');
    expect(defaultIssueCreateStatusId('missing-team', statuses)).toBe('');
  });
});

describe('title-first issue creation source contract', () => {
  it('keeps title before compact defaults, progressive details, and one submit command', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    const title = issues.indexOf('<Field label="Title"');
    const defaults = issues.indexOf('<dl className="issue-create-defaults"');
    const details = issues.indexOf('<details className="form-details issue-create-details">');
    const submit = issues.indexOf('<button type="submit" className="button primary"');

    expect(title).toBeGreaterThan(-1);
    expect(defaults).toBeGreaterThan(title);
    expect(details).toBeGreaterThan(defaults);
    expect(submit).toBeGreaterThan(details);
    expect(issues).toContain('aria-label="Issue defaults"');
    expect(issues).toContain('<summary><ChevronRight size={14} aria-hidden="true" /><span>Details</span></summary>');
  });

  it('submits controlled defaults and clears milestone state when its scope changes', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain('statusId,\n        priority,');
    expect(issues).toContain('milestoneId: milestoneId || null');
    expect(issues).toContain('value={milestoneId} disabled={projectId === \'\' || milestoneLoading}');
    expect(issues).toContain("setProjectId('');\n              setMilestoneId('');");
    expect(issues).toContain("setProjectId(event.target.value);\n              setMilestoneId('');");
    expect(issues).not.toContain('defaultValue={initialMilestoneId}');
  });

  it('bounds compact defaults and disclosure geometry across responsive layouts', async () => {
    const styles = await source('apps/web/src/styles.css');
    expect(styles).toContain('.issue-create-defaults { display: flex; flex-wrap: wrap;');
    expect(styles).toContain('.issue-create-defaults > div { min-width: 0; max-width: 100%; height: 27px;');
    expect(styles).toContain('.issue-create-defaults dd { min-width: 0; max-width: 150px;');
    expect(styles).toContain('.issue-create-details[open] summary svg { transform: rotate(90deg); }');
    expect(styles).toContain('.issue-create-defaults dd { max-width: 112px; }');
  });

  it('provides a stateful fixture for valid pair creation and invalid pair rejection', async () => {
    const fixture = await source('scripts/serve-visual-fixture.mjs');
    expect(fixture).toContain("fixtureName(request) === 'issue-create'");
    expect(fixture).toContain("const availableProjects = [project, projectD];");
    expect(fixture).toContain("const availableMilestones = [milestone, milestoneD];");
    expect(fixture).toContain("apiError(response, 'INVALID_ASSIGNMENT'");
    expect(fixture).toContain('issueCreateIssues = [...issues, created];');
    expect(fixture).toContain('json(response, created, 201);');
  });
});
