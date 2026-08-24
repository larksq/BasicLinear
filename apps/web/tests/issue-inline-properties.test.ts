import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  issueDetailLabelOptions,
  issueDetailMembers,
  issueDetailMilestoneOptions,
  issueDetailProjectOptions,
  issueDetailStatuses,
  issueDueDateCommitDecision,
  issueDueDateInputShouldSync,
  issueInlinePropertyRequest,
  type IssueInlinePropertyLookups,
} from '../src/issue-inline-properties.js';

const workspaceId = 'workspace-a';
const teamId = 'team-a';
const archivedAt = '2026-08-20T00:00:00.000Z';

const issue = (overrides: Record<string, unknown> = {}) => ({
  workspaceId,
  teamId,
  revision: 7,
  statusId: 'status-backlog',
  priority: 'medium' as const,
  assigneeUserId: 'user-a',
  dueDate: '2026-09-01',
  projectId: 'project-a',
  milestoneId: 'milestone-a',
  labels: [{ id: 'label-a' }, { id: 'label-archived' }],
  ...overrides,
});

const project = (
  id: string,
  overrides: Partial<{ workspaceId: string; teamId: string; archivedAt: string | null }> = {},
) => ({ id, workspaceId, teamId, archivedAt: null, ...overrides });

const milestone = (
  id: string,
  projectId = 'project-a',
  overrides: Partial<{ workspaceId: string; archivedAt: string | null }> = {},
) => ({ id, workspaceId, projectId, archivedAt: null, ...overrides });

const label = (
  id: string,
  overrides: Partial<{ workspaceId: string; archivedAt: string | null }> = {},
) => ({ id, workspaceId, archivedAt: null, ...overrides });

const lookups = (overrides: Partial<IssueInlinePropertyLookups> = {}): IssueInlinePropertyLookups => ({
  statuses: [
    { id: 'status-backlog', workspaceId, teamId },
    { id: 'status-started', workspaceId, teamId },
  ],
  members: [
    { workspaceId, userId: 'user-a' },
    { workspaceId, userId: 'user-b' },
  ],
  projects: [project('project-a'), project('project-b')],
  milestones: [milestone('milestone-a'), milestone('milestone-b')],
  labels: [label('label-a'), label('label-b'), label('label-archived', { archivedAt })],
  ...overrides,
});

describe('issue detail property options', () => {
  it('keeps only unique records in the issue workspace and team', () => {
    const currentIssue = issue();
    const duplicateStatus = { id: 'status-duplicate', workspaceId, teamId };
    expect(issueDetailStatuses(currentIssue, [
      ...lookups().statuses,
      { id: 'status-other-team', workspaceId, teamId: 'team-b' },
      { id: 'status-other-workspace', workspaceId: 'workspace-b', teamId },
      duplicateStatus,
      { ...duplicateStatus },
    ]).map((status) => status.id)).toEqual(['status-backlog', 'status-started']);

    const duplicateMember = { workspaceId, userId: 'user-duplicate' };
    expect(issueDetailMembers(currentIssue, [
      ...lookups().members,
      { workspaceId: 'workspace-b', userId: 'user-other' },
      duplicateMember,
      { ...duplicateMember },
    ]).map((member) => member.userId)).toEqual(['user-a', 'user-b']);
  });

  it('shows a current archived project but no other archived or ambiguous project', () => {
    const duplicate = project('project-duplicate');
    const options = issueDetailProjectOptions(
      issue({ projectId: 'project-archived' }),
      [
        project('project-a'),
        project('project-archived', { archivedAt }),
        project('project-hidden', { archivedAt }),
        project('project-other-team', { teamId: 'team-b' }),
        project('project-other-workspace', { workspaceId: 'workspace-b' }),
        duplicate,
        { ...duplicate },
      ],
    );
    expect(options.map((option) => option.id)).toEqual(['project-a', 'project-archived']);
  });

  it('shows unique active milestones plus the current archived assignment for an active project', () => {
    const duplicate = milestone('milestone-duplicate');
    const options = issueDetailMilestoneOptions(
      issue({ milestoneId: 'milestone-archived' }),
      'project-a',
      [project('project-a')],
      [
        milestone('milestone-a'),
        milestone('milestone-archived', 'project-a', { archivedAt }),
        milestone('milestone-hidden', 'project-a', { archivedAt }),
        milestone('milestone-other', 'project-b'),
        milestone('milestone-other-workspace', 'project-a', { workspaceId: 'workspace-b' }),
        duplicate,
        { ...duplicate },
      ],
    );
    expect(options.map((option) => option.id)).toEqual(['milestone-a', 'milestone-archived']);
  });

  it('fails milestone options closed for an ambiguous project and only retains the current assignment on an archived project', () => {
    const currentIssue = issue({ projectId: 'project-archived', milestoneId: 'milestone-current' });
    expect(issueDetailMilestoneOptions(
      currentIssue,
      'project-archived',
      [project('project-archived', { archivedAt }), project('project-archived', { archivedAt })],
      [milestone('milestone-current', 'project-archived')],
    )).toEqual([]);
    expect(issueDetailMilestoneOptions(
      currentIssue,
      'project-archived',
      [project('project-archived', { archivedAt })],
      [milestone('milestone-current', 'project-archived'), milestone('milestone-new', 'project-archived')],
    ).map((option) => option.id)).toEqual(['milestone-current']);
  });

  it('keeps active labels and the current archived label while excluding ambiguous labels', () => {
    const duplicate = label('label-duplicate');
    expect(issueDetailLabelOptions(issue(), [
      label('label-a'),
      label('label-b'),
      label('label-archived', { archivedAt }),
      label('label-hidden', { archivedAt }),
      label('label-other-workspace', { workspaceId: 'workspace-b' }),
      duplicate,
      { ...duplicate },
    ]).map((option) => option.id)).toEqual(['label-a', 'label-b', 'label-archived']);
  });
});

describe('inline issue property requests', () => {
  it('emits one minimal revision-bearing patch for each scalar property', () => {
    const currentIssue = issue();
    const values = lookups();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'statusId', value: 'status-started' }, values))
      .toEqual({ expectedRevision: 7, statusId: 'status-started' });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'priority', value: 'urgent' }, values))
      .toEqual({ expectedRevision: 7, priority: 'urgent' });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'assigneeUserId', value: 'user-b' }, values))
      .toEqual({ expectedRevision: 7, assigneeUserId: 'user-b' });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'assigneeUserId', value: null }, values))
      .toEqual({ expectedRevision: 7, assigneeUserId: null });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'dueDate', value: '2026-10-02' }, values))
      .toEqual({ expectedRevision: 7, dueDate: '2026-10-02' });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'dueDate', value: null }, values))
      .toEqual({ expectedRevision: 7, dueDate: null });
  });

  it('clears the milestone in the same project patch and validates milestone ownership', () => {
    const currentIssue = issue();
    const values = lookups();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'projectId', value: 'project-b' }, values))
      .toEqual({ expectedRevision: 7, projectId: 'project-b', milestoneId: null });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'projectId', value: null }, values))
      .toEqual({ expectedRevision: 7, projectId: null, milestoneId: null });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'milestoneId', value: 'milestone-b' }, values))
      .toEqual({ expectedRevision: 7, milestoneId: 'milestone-b' });
    expect(issueInlinePropertyRequest(currentIssue, { field: 'milestoneId', value: null }, values))
      .toEqual({ expectedRevision: 7, milestoneId: null });
  });

  it('preserves label order, including archived assignments, while adding or removing one label', () => {
    const currentIssue = issue();
    const values = lookups();
    expect(issueInlinePropertyRequest(currentIssue, {
      field: 'label', labelId: 'label-b', selected: true,
    }, values)).toEqual({
      expectedRevision: 7,
      labelIds: ['label-a', 'label-archived', 'label-b'],
    });
    expect(issueInlinePropertyRequest(currentIssue, {
      field: 'label', labelId: 'label-archived', selected: false,
    }, values)).toEqual({ expectedRevision: 7, labelIds: ['label-a'] });
  });

  it('suppresses unchanged values without issuing a revision mutation', () => {
    const currentIssue = issue();
    const values = lookups();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'statusId', value: 'status-backlog' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'priority', value: 'medium' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'assigneeUserId', value: 'user-a' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'dueDate', value: '2026-09-01' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'projectId', value: 'project-a' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'milestoneId', value: 'milestone-a' }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'label', labelId: 'label-a', selected: true }, values)).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'label', labelId: 'label-b', selected: false }, values)).toBeNull();
  });

  it('rejects stale, archived-new, cross-scope, ambiguous, and invalid property values', () => {
    const currentIssue = issue();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'statusId', value: 'missing' }, lookups())).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'statusId', value: 'status-started' }, lookups({
      statuses: [
        { id: 'status-started', workspaceId, teamId },
        { id: 'status-started', workspaceId, teamId },
      ],
    }))).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'assigneeUserId', value: 'other' }, lookups({
      members: [{ userId: 'other', workspaceId: 'workspace-b' }],
    }))).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'dueDate', value: '2026-02-30' }, lookups())).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'projectId', value: 'archived' }, lookups({
      projects: [project('archived', { archivedAt })],
    }))).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'milestoneId', value: 'other' }, lookups({
      milestones: [milestone('other', 'project-b')],
    }))).toBeNull();
    expect(issueInlinePropertyRequest(currentIssue, { field: 'label', labelId: 'archived-new', selected: true }, lookups({
      labels: [label('archived-new', { archivedAt })],
    }))).toBeNull();
  });

  it('rejects duplicate current labels and additions above the 50-label contract limit', () => {
    const duplicateLabels = issue({ labels: [{ id: 'label-a' }, { id: 'label-a' }] });
    expect(issueInlinePropertyRequest(duplicateLabels, {
      field: 'label', labelId: 'label-b', selected: true,
    }, lookups())).toBeNull();

    const fullLabels = Array.from({ length: 50 }, (_, index) => ({ id: `label-${index}` }));
    expect(issueInlinePropertyRequest(issue({ labels: fullLabels }), {
      field: 'label', labelId: 'label-new', selected: true,
    }, lookups({ labels: [label('label-new')] }))).toBeNull();
  });
});

describe('inline issue due-date commit', () => {
  it('commits only complete changed values and deliberate clears', () => {
    expect(issueDueDateCommitDecision('2026-09-01', '2026-09-01', '2026-10-02', true))
      .toEqual({ action: 'commit', value: '2026-10-02' });
    expect(issueDueDateCommitDecision('2026-09-01', '2026-09-01', '', true))
      .toEqual({ action: 'commit', value: null });
  });

  it('suppresses unchanged values and restores invalid native edits', () => {
    expect(issueDueDateCommitDecision('2026-09-01', '2026-09-01', '2026-09-01', true))
      .toEqual({ action: 'none' });
    expect(issueDueDateCommitDecision(null, null, '', true)).toEqual({ action: 'none' });
    expect(issueDueDateCommitDecision('2026-09-01', '2026-09-01', '', false))
      .toEqual({ action: 'restore', value: '2026-09-01' });
    expect(issueDueDateCommitDecision(null, null, '2026-02-30', true))
      .toEqual({ action: 'restore', value: '' });
  });

  it('restores newer authority instead of committing a draft from a stale focus baseline', () => {
    expect(issueDueDateCommitDecision(
      '2026-10-02',
      '2026-09-01',
      '2026-11-03',
      true,
    )).toEqual({ action: 'restore', value: '2026-10-02' });
    expect(issueDueDateCommitDecision(
      null,
      '2026-09-01',
      '2026-11-03',
      true,
    )).toEqual({ action: 'restore', value: '' });
  });

  it('synchronizes authority unless a focused input contains a user draft', () => {
    expect(issueDueDateInputShouldSync(false, false)).toBe(true);
    expect(issueDueDateInputShouldSync(false, true)).toBe(true);
    expect(issueDueDateInputShouldSync(true, false)).toBe(true);
    expect(issueDueDateInputShouldSync(true, true)).toBe(false);
  });

  it('treats empty serialized native partial input as a focused draft', async () => {
    const bufferedDateInput = await readFile(
      join(process.cwd(), 'apps/web/src/buffered-date-input.tsx'),
      'utf8',
    );
    const inputStart = bufferedDateInput.indexOf('onInput={() => {');
    const inputEnd = bufferedDateInput.indexOf('}}', inputStart);
    const inputHandler = bufferedDateInput.slice(inputStart, inputEnd);
    expect(inputHandler).toContain('dirtyRef.current = true;');
    expect(inputHandler).not.toContain('event.currentTarget.value');
    expect(issueDueDateInputShouldSync(true, true)).toBe(false);
    expect(issueDueDateCommitDecision(null, null, '', false))
      .toEqual({ action: 'restore', value: '' });
  });
});

describe('inline property source contract', () => {
  it('separates content saving from immediate property controls and keeps feedback geometry stable', async () => {
    const [issues, bufferedDateInput, styles, fixture] = await Promise.all([
      readFile(join(process.cwd(), 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'apps/web/src/buffered-date-input.tsx'), 'utf8'),
      readFile(join(process.cwd(), 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(process.cwd(), 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    const propertiesStart = issues.indexOf('function IssuePropertiesEditor');
    const propertiesEnd = issues.indexOf('function IssueRelationSection', propertiesStart);
    const properties = issues.slice(propertiesStart, propertiesEnd);
    expect(issues).toContain('Save content</button>');
    expect(properties).not.toContain('Save changes');
    expect(properties).toContain("onChange('Status', { field: 'statusId'");
    expect(properties).toContain("onChange('Labels', { field: 'label'");
    expect(issues).toContain('function IssueDueDateEditor');
    expect(issues).toContain('<BufferedDateInput label="Issue due date"');
    expect(bufferedDateInput).toContain("defaultValue={value ?? ''}");
    expect(bufferedDateInput).toContain('const baselineRef = useRef<string | null>(value);');
    expect(bufferedDateInput).toContain('const dirtyRef = useRef(false);');
    expect(bufferedDateInput).toContain('nativeDateInputShouldSync(');
    expect(bufferedDateInput).toContain('onInput={() => {');
    expect(bufferedDateInput).toContain('dirtyRef.current = true;');
    expect(bufferedDateInput).toContain('baselineRef.current,');
    expect(bufferedDateInput).not.toContain('}, [value]);');
    expect(bufferedDateInput).not.toContain('}, [disabled, value]);');
    expect(bufferedDateInput).toContain('nativeDateCommitDecision(');
    expect(bufferedDateInput).toContain("event.key === 'Escape'");
    expect(bufferedDateInput).toContain('event.stopPropagation();');
    expect(bufferedDateInput).toContain("event.key === 'Enter'");
    expect(properties).toContain("onCommit={(value) => onChange('Due date'");
    expect(properties).not.toContain("onChange={(event) => onChange('Due date'");
    expect(issues).toContain("api.milestones(workspaceId, issue.data?.projectId ?? '', true)");
    expect(issues).toContain('Server values restored at revision ${confirmed.revision}.');
    expect(issues).toContain('const issueContentFormKey = [');
    expect(issues).not.toContain('editFormRevisionKey');
    expect(styles).toContain('.issue-property-feedback { min-width: 0; height: 27px;');
    expect(styles).toContain('.issue-content-save { margin-top: 14px; }');
    expect(fixture).toContain("fixtureName(request) === 'issue-inline-properties'");
    expect(fixture).toContain('currentRevision: current.revision');
    expect(fixture).toContain('Submit exactly one inline issue property.');
    expect(fixture).toContain('issueInlinePropertyIssue = {');
    expect(fixture).toContain("url.searchParams.get('includeArchived') === 'true' ? [milestoneArchived] : []");
  });
});
