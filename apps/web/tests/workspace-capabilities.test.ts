import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(join(process.cwd(), path), 'utf8');

describe('workspace capability projection', () => {
  it('uses the domain capability matrix for owner operations without exposing administration', async () => {
    const app = await source('apps/web/src/App.tsx');
    expect(app).not.toContain("hasCapability(workspace.role, 'team:manage')");
    expect(app).not.toContain("hasCapability(workspace.role, 'membership:manage')");
    expect(app).toContain("hasCapability(workspace.role, 'status:manage')");
    expect(app).toContain("hasCapability(workspace.role, 'issue:write')");
    expect(app).not.toContain('canManageTeams');
    expect(app).not.toContain('canManageMemberships');
    expect(app).toContain('disabled={!canManageStatuses || systemTeam === undefined || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}');
    expect(app).toContain('disabled={!canManageStatuses || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}');
    expect(app).toContain('|| retireStatus.isPending;');
    expect(app).toContain('disabled={!canManageStatuses || index <= 0 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}');
    expect(app).toContain('disabled={!canManageStatuses || index >= teamOrder.length - 1 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}');
    expect(app).toContain('data-status-retire={status.id}');
    expect(app).toContain('disabled={!canManageStatuses || teamOrder.length <= 1 || statusMutationPending || statusEdit !== null || statusRetirement !== null || statusDrag !== null}');
    expect(app).toContain('open={dialog === \'status\' && canManageStatuses && statusEdit === null && statusRetirement === null}');
    expect(app).toContain('open={statusRetirement !== null && canManageStatuses}');
    expect(app).toContain('if (canManageStatuses) return;');
    expect(app).toContain("const unauthorized = dialog === 'status' && !canManageStatuses;");
    expect(app).toContain("if (action !== 'create-issue' || !canWriteIssues) return;");
    expect(app).toContain('disabled={!canWriteIssues}');
    expect(app).not.toContain('aria-label="Teams"');
    expect(app).not.toContain('aria-label="Members"');
  });

  it('keeps project navigation available while gating every project and milestone mutation family', async () => {
    const projects = await source('apps/web/src/projects.tsx');
    expect(projects).toContain("const canWriteProjects = hasCapability(workspaceRole, 'project:write');");
    expect(projects).toContain("const canPurgeProjects = hasCapability(workspaceRole, 'project:purge');");
    expect(projects).toContain("const canPurgeMilestones = hasCapability(workspaceRole, 'milestone:purge');");
    expect(projects).toContain('selectionEnabled: canWriteProjects');
    expect(projects).toContain('disabled={!canWriteProjects || (systemTeam === undefined ? teams.length === 0 : false)}');
    expect(projects).toContain('disabled={!canWriteProjects || setSelectedProjectArchive.isPending}');
    expect(projects).toContain('disabled={!canWriteProjects || current.archivedAt !== null || projectRevisionMutationPending}');
    expect(projects).toContain('disabled={!canWriteProjects || current.archivedAt !== null || milestoneInteractionLocked}');
    expect(projects).toContain('open={dialog === \'create\' && canWriteProjects}');
    expect(projects).toContain('canWrite={canWriteProjects}');
    expect(projects).toContain('const controlsDisabled = !canWrite || project.archivedAt !== null || locked;');
    expect(projects).not.toContain('open={dialog === \'edit\' && canWriteProjects}');
    expect(projects).toContain('{canWriteProjects ? <button type="button" role="menuitem"');
    expect(projects).toContain('if (!canPurgeProjects) setProjectPurgeOpen(false);');
    expect(projects).toContain('if (!canPurgeMilestones) setMilestonePurgeTarget(null);');
    expect(projects).toContain('projectPurgeOpen && canPurgeProjects && current.archivedAt !== null');
    expect(projects).toContain('canPurgeMilestones && milestone.archivedAt !== null');
  });

  it('renders guest issue detail as read-only and guards write-only collection actions', async () => {
    const issues = await source('apps/web/src/issues.tsx');
    expect(issues).toContain("const canWriteIssues = hasCapability(workspaceRole, 'issue:write');");
    expect(issues).toContain("const canPurgeIssues = hasCapability(workspaceRole, 'issue:purge');");
    expect(issues).toContain('canWrite={canWriteIssues}');
    expect(issues).toContain('required readOnly={!canWrite || locked} disabled={issue.archivedAt !== null}');
    expect(issues).toContain('label="Issue description" disabled={locked}');
    expect(issues).toContain('const handledCreateSignal = useRef(0);');
    expect(issues).toContain('if (!canPurgeIssues) setPurgeOpen(false);');
    expect(issues).toContain('disabled={!canWriteIssues || issueRevisionMutationPending || commentInteractionLocked || relationInteractionLocked}');
    expect(issues).toContain('removeDisabled={!canWriteIssues || current.archivedAt !== null || relationInteractionLocked || issueRevisionMutationPending}');
    expect(issues).toContain('{canWriteIssues && current.archivedAt === null ? <form className="comment-create"');
    expect(issues).toContain('disabled={!canEditCommentRecord(comment) || commentInteractionLocked}');
    expect(issues).toContain('comment.author?.id === currentUserId');
    expect(issues).toContain('disabled={!canWrite || invalidUrlFilter !== null}');
    expect(issues).toContain('disabled={!canWrite || bulk.isPending}');
    expect(issues).toContain('<span className="sr-only">Bulk project</span>');
    expect(issues).toContain('<span className="sr-only">Bulk milestone</span>');
    expect(issues).toContain('<span className="sr-only">Bulk due date</span>');
    expect(issues).toContain("disabled={!canWrite || bulk.isPending || bulkDraft.projectId === issueBulkClearValue}");
    expect(issues).toContain('{canWrite ? <details className="toolbar-menu bulk-label-menu">');
    expect(issues).toContain('aria-label="Bulk label operation"');
    expect(issues).toContain('disabled={bulk.isPending || bulkLabelRequest === null}');
    expect(issues).toContain('open={createOpen && canWrite}');
    expect(issues).toContain('open={labelsOpen && canWrite}');
    expect(issues).toContain('{labelsOpen && canWrite ? <LabelManager');
    expect(issues).not.toContain("workspaceRole !== 'guest'");
  });

  it('requires issue write capability and ownership for saved-view management', async () => {
    const views = await source('apps/web/src/saved-views.tsx');
    expect(views).toContain("const canWrite = hasCapability(workspaceRole, 'issue:write');");
    expect(views).toContain('const manageable = canManageSavedView(view, currentUserId, canWrite);');
    expect(views).toContain('expectedRevision: view.revision');
    expect(views).toContain("{manageable && view.archivedAt === null ? <button");
    expect(views).toContain("{manageable ? <button");
    expect(views).toContain('disabled={!canWrite}');
    expect(views).not.toContain("workspaceRole !== 'guest'");
  });

  it('automatically establishes the local owner session without setup or login UI', async () => {
    const [app, api] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/api.ts'),
    ]);
    expect(app).toContain('mutationFn: api.localOwnerSession');
    expect(app).toContain('<LocalOwnerGate onAuthenticated={authenticated} />');
    expect(app).not.toContain('api.setupState');
    expect(app).not.toContain('LoginScreen');
    expect(api).toContain("localOwnerSession: () => request<Session>('/api/v1/local-owner-session', {");
    expect(api).toContain("'x-openlinear-csrf': csrfToken");
  });
});
