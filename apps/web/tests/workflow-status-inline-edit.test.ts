import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  nextWorkflowStatusPosition,
  workflowStatusEditDraft,
  workflowStatusEditRequest,
} from '../src/workflow-status-inline-edit.js';

const status = (overrides: Record<string, unknown> = {}) => ({
  workspaceId: '10000000-0000-4000-8000-000000000001',
  teamId: '20000000-0000-4000-8000-000000000001',
  revision: 7,
  name: 'In progress',
  category: 'started' as const,
  color: '#C18C3A',
  position: 200,
  ...overrides,
});

const scope = {
  workspaceId: '10000000-0000-4000-8000-000000000001',
  teamId: '20000000-0000-4000-8000-000000000001',
};

describe('inline workflow status edit requests', () => {
  it('copies the authoritative editable fields into a controlled draft', () => {
    expect(workflowStatusEditDraft(status())).toEqual({
      name: 'In progress',
      category: 'started',
      color: '#C18C3A',
    });
  });

  it('emits a normalized sparse patch against the opening revision', () => {
    expect(workflowStatusEditRequest(status(), {
      name: '  In   review ',
      category: 'started',
      color: '#c18c3a',
    }, scope)).toEqual({ expectedRevision: 7, name: 'In review' });
    expect(workflowStatusEditRequest(status(), {
      name: 'In progress',
      category: 'completed',
      color: '#4e9f76',
    }, scope)).toEqual({
      expectedRevision: 7,
      category: 'completed',
      color: '#4E9F76',
    });
  });

  it('retains the opening revision when newer state exists elsewhere', () => {
    const opening = status();
    const background = status({ revision: 8, name: 'Server rename' });
    expect(workflowStatusEditRequest(opening, {
      ...workflowStatusEditDraft(opening),
      name: 'Retained draft',
    }, scope)).toEqual({ expectedRevision: 7, name: 'Retained draft' });
    expect(workflowStatusEditRequest(background, {
      ...workflowStatusEditDraft(background),
      name: 'Retained draft',
    }, scope)).toEqual({ expectedRevision: 8, name: 'Retained draft' });
  });

  it('suppresses semantic no-ops', () => {
    expect(workflowStatusEditRequest(status(), {
      name: '  In   progress ',
      category: 'started',
      color: '#c18c3a',
    }, scope)).toBeNull();
  });

  it('fails closed for invalid values, revisions, and scope', () => {
    const draft = workflowStatusEditDraft(status());
    expect(workflowStatusEditRequest(status(), { ...draft, name: '   ' }, scope)).toBeNull();
    expect(workflowStatusEditRequest(status(), { ...draft, name: 'x'.repeat(81) }, scope)).toBeNull();
    expect(workflowStatusEditRequest(status(), { ...draft, color: '#xyzxyz' }, scope)).toBeNull();
    expect(workflowStatusEditRequest(status(), {
      ...draft,
      category: 'unknown' as typeof draft.category,
    }, scope)).toBeNull();
    expect(workflowStatusEditRequest(status({ revision: 0 }), {
      ...draft,
      name: 'Invalid revision',
    }, scope)).toBeNull();
    expect(workflowStatusEditRequest(status(), {
      ...draft,
      name: 'Wrong workspace',
    }, { ...scope, workspaceId: '10000000-0000-4000-8000-000000000099' })).toBeNull();
    expect(workflowStatusEditRequest(status(), {
      ...draft,
      name: 'Wrong team',
    }, { ...scope, teamId: '20000000-0000-4000-8000-000000000099' })).toBeNull();
  });

  it('assigns new status positions within the selected team only', () => {
    const records = [
      status({ position: 100 }),
      status({ position: 350 }),
      status({ teamId: '20000000-0000-4000-8000-000000000002', position: 900 }),
      status({ workspaceId: '10000000-0000-4000-8000-000000000002', position: 1200 }),
    ];
    expect(nextWorkflowStatusPosition(records, scope)).toBe(450);
    expect(nextWorkflowStatusPosition([], scope)).toBe(100);
    expect(nextWorkflowStatusPosition([status({ position: Number.NaN })], scope)).toBeNull();
  });

  it('locks workflow management to inline recovery and a revisioned fixture', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [app, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/web/src/App.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(app).toContain('data-status-editor={status.id}');
    expect(app).toContain('Save status');
    expect(app).toContain('Retry draft');
    expect(app).toContain('Use server values');
    expect(app).toContain('statusMutationPending');
    expect(app).toContain('restoreAuthoritativeStatuses');
    expect(app).toContain('Server revision ${confirmed.revision} confirmed; your draft is retained.');
    expect(app).not.toContain('<Dialog title="Edit status"');
    expect(styles).toContain('.workflow-status-edit-row {');
    expect(styles).toContain('.workflow-status-edit-recovery {');
    expect(styles).toContain('.workflow-status-edit-feedback {');
    expect(fixture).toContain("fixtureName(request) === 'workflow-status-inline-edit'");
    expect(fixture).toContain('Submit at least one supported workflow status change.');
  });
});
