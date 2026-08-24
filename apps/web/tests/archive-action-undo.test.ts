import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentsPath = fileURLToPath(new URL('../src/components.tsx', import.meta.url));
const issuesPath = fileURLToPath(new URL('../src/issues.tsx', import.meta.url));
const projectsPath = fileURLToPath(new URL('../src/projects.tsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));

describe('single-record archive Undo', () => {
  it('uses one visible, named, pending-aware status band', async () => {
    const [components, styles] = await Promise.all([
      readFile(componentsPath, 'utf8'),
      readFile(stylesPath, 'utf8'),
    ]);

    expect(components).toContain('className={`archive-action-notice ${tone}`}');
    expect(components).toContain("role={tone === 'error' ? 'alert' : 'status'}");
    expect(components).toContain("aria-live={tone === 'error' ? 'assertive' : 'polite'}");
    expect(components).toContain('aria-atomic="true"');
    expect(components).toContain('aria-busy={pending}');
    expect(components).toContain('aria-label={undoLabel}');
    expect(components).toContain("{pending ? 'Restoring' : 'Undo'}");
    expect(components).toContain('aria-label="Dismiss archive notice"');
    expect(styles).toContain('.archive-action-notice { width: 100%; min-width: 0; min-height: 42px;');
    expect(styles).toContain('.archive-action-notice-copy > span { min-width: 0; overflow-wrap: anywhere; }');
    expect(styles).toContain('.archive-action-notice.error { border-color:');
    expect(styles).toContain('.archive-action-notice { grid-template-columns: minmax(0, 1fr); align-items: start; }');
  });

  it('restores an issue detail from the exact archived response revision', async () => {
    const issues = await readFile(issuesPath, 'utf8');

    expect(issues).toContain('api.archiveIssue(workspaceId, current.id, current.revision)');
    expect(issues).toContain('api.restoreIssue(workspaceId, current.id, current.revision)');
    expect(issues).toContain('undoTarget: archived ? updated : null');
    expect(issues).toContain("setArchive.mutate({ current: archiveNotice.undoTarget, source: 'undo' });");
    expect(issues).toContain("setArchive.isPending && setArchive.variables?.source === 'undo'");
    expect(issues).toContain("setArchive.variables?.source === 'undo' ? null : setArchive.error");
    expect(issues).toContain('It remains archived; use Restore here or in Archive to retry.');
    expect(issues).toContain('if (archived) focusArchiveUndo();');
    expect(issues).toContain('else focusArchiveAction();');
  });

  it('restores a list or board issue from the exact archived response revision', async () => {
    const issues = await readFile(issuesPath, 'utf8');

    expect(issues).toContain('? { targetWorkspaceId: variables.targetWorkspaceId, issue: updated }');
    expect(issues).toContain("setRowArchive.mutate({ ...rowArchiveNotice.undoTarget, source: 'undo' });");
    expect(issues).toContain("setRowArchive.variables?.source === 'undo'");
    expect(issues).toContain("setRowArchive.variables.source !== 'undo' ? setRowArchive.error : null");
    expect(issues).toContain('It remains in Archive, where you can retry.');
    expect(issues).toContain('if (archived) focusRowArchiveUndo();');
    expect(issues).toContain('else focusIssueRecord(updated.id);');
  });

  it('restores projects and milestones from their exact archived response revisions', async () => {
    const projects = await readFile(projectsPath, 'utf8');

    expect(projects).toContain("undoTarget: archived ? { kind: 'project', record: updated } : null");
    expect(projects).toContain("undoTarget: archived ? { kind: 'milestone', record: updated } : null");
    expect(projects).toContain("setProjectArchive.mutate({ current: target.record, source: 'undo' });");
    expect(projects).toContain("setMilestoneArchive.mutate({ current: target.record, source: 'undo' });");
    expect(projects).toContain('api.restoreProject(workspaceId, current.id, current.revision)');
    expect(projects).toContain('api.restoreMilestone(workspaceId, current.projectId, current.id, current.revision)');
    expect(projects).toContain('data-milestone-archive={milestone.id}');
    expect(projects).toContain("setProjectArchive.variables?.source === 'undo' ? null : setProjectArchive.error");
    expect(projects).toContain("setMilestoneArchive.variables?.source === 'undo' ? null : setMilestoneArchive.error");
  });

  it('refreshes activity caches and leaves bulk archive flows separate', async () => {
    const [issues, projects] = await Promise.all([
      readFile(issuesPath, 'utf8'),
      readFile(projectsPath, 'utf8'),
    ]);

    expect(issues).toContain("client.invalidateQueries({ queryKey: ['issue-activity', targetWorkspaceId, issueId] })");
    expect(projects).toContain("client.invalidateQueries({ queryKey: ['project-activity', workspaceId, projectId] })");
    expect(issues).toContain("bulk.mutate({ items: selectedIssues.map((issue) => ({ id: issue.id, expectedRevision: issue.revision })), mutation: { type: viewState.archiveState === 'archived' ? 'restore' : 'archive' } })");
    expect(projects).toContain('setSelectedProjectArchive.mutate(selectedProjects);');
  });
});
