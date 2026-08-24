import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  milestoneEditDraft,
  milestoneEditRequest,
} from '../src/milestone-inline-edit.js';

const milestone = (overrides: Record<string, unknown> = {}) => ({
  revision: 7,
  name: 'Release readiness',
  description: 'Confirm the public release path.',
  targetDate: '2026-10-01',
  archivedAt: null,
  ...overrides,
});

describe('milestone inline edit requests', () => {
  it('copies the authoritative editable fields into a controlled draft', () => {
    expect(milestoneEditDraft(milestone())).toEqual({
      name: 'Release readiness',
      description: 'Confirm the public release path.',
      targetDate: '2026-10-01',
    });
  });

  it('emits only the changed field with the baseline revision', () => {
    expect(milestoneEditRequest(milestone(), {
      ...milestoneEditDraft(milestone()),
      name: 'Release control',
    })).toEqual({ expectedRevision: 7, name: 'Release control' });
    expect(milestoneEditRequest(milestone(), {
      ...milestoneEditDraft(milestone()),
      targetDate: null,
    })).toEqual({ expectedRevision: 7, targetDate: null });
  });

  it('normalizes a multi-field content save without adding unchanged values', () => {
    expect(milestoneEditRequest(milestone(), {
      name: '  Release   control ',
      description: '  Confirm ownership.\r\nThen rehearse.  ',
      targetDate: '2026-10-08',
    })).toEqual({
      expectedRevision: 7,
      name: 'Release control',
      description: 'Confirm ownership.\nThen rehearse.',
      targetDate: '2026-10-08',
    });
  });

  it('suppresses semantic no-ops', () => {
    expect(milestoneEditRequest(milestone(), {
      name: '  Release   readiness ',
      description: '  Confirm the public release path.  ',
      targetDate: '2026-10-01',
    })).toBeNull();
  });

  it('fails closed for invalid, archived, or non-revisioned edits', () => {
    const draft = milestoneEditDraft(milestone());
    expect(milestoneEditRequest(milestone(), { ...draft, name: '   ' })).toBeNull();
    expect(milestoneEditRequest(milestone(), {
      ...draft,
      description: 'x'.repeat(4001),
    })).toBeNull();
    expect(milestoneEditRequest(milestone(), { ...draft, targetDate: '2026-02-30' })).toBeNull();
    expect(milestoneEditRequest(milestone({ archivedAt: '2026-08-20T00:00:00.000Z' }), {
      ...draft,
      name: 'Archived edit',
    })).toBeNull();
    expect(milestoneEditRequest(milestone({ revision: 0 }), {
      ...draft,
      name: 'Invalid revision',
    })).toBeNull();
  });

  it('locks the surface to inline recovery and the stateful milestone fixture', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [projects, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/web/src/projects.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(projects).toContain('Save milestone');
    expect(projects).toContain('Retry draft');
    expect(projects).toContain('Use server values');
    expect(projects).toContain('milestoneRevisionMutationPending');
    expect(projects).not.toContain('<Dialog title="Edit milestone"');
    expect(styles).toContain('.milestone-edit-recovery {');
    expect(styles).toContain('.milestone-edit-feedback {');
    expect(fixture).toContain("fixtureName(request) === 'milestone-inline-edit'");
    expect(fixture).toContain('Submit at least one supported milestone change.');
  });
});
