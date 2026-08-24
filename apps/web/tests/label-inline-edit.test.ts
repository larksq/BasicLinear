import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  labelEditDraft,
  labelEditRequest,
} from '../src/label-inline-edit.js';

const label = (overrides: Record<string, unknown> = {}) => ({
  revision: 7,
  name: 'Interaction review',
  color: '#5279C7',
  archivedAt: null,
  ...overrides,
});

describe('inline label edit requests', () => {
  it('copies the authoritative editable fields into a controlled draft', () => {
    expect(labelEditDraft(label())).toEqual({
      name: 'Interaction review',
      color: '#5279C7',
    });
  });

  it('emits a normalized sparse patch against the opening revision', () => {
    expect(labelEditRequest(label(), {
      name: '  Interaction quality ',
      color: '#5279c7',
    })).toEqual({ expectedRevision: 7, name: 'Interaction quality' });
    expect(labelEditRequest(label(), {
      name: 'Interaction review',
      color: '#3f8b75',
    })).toEqual({ expectedRevision: 7, color: '#3F8B75' });
  });

  it('retains the opening revision even when a newer record exists elsewhere', () => {
    const opening = label();
    const background = label({ revision: 8, name: 'Server rename' });
    expect(labelEditRequest(opening, {
      ...labelEditDraft(opening),
      name: 'Retained draft',
    })).toEqual({ expectedRevision: 7, name: 'Retained draft' });
    expect(labelEditRequest(background, {
      ...labelEditDraft(background),
      name: 'Retained draft',
    })).toEqual({ expectedRevision: 8, name: 'Retained draft' });
  });

  it('suppresses semantic no-ops', () => {
    expect(labelEditRequest(label(), {
      name: '  Interaction review ',
      color: '#5279c7',
    })).toBeNull();
  });

  it('fails closed for invalid, archived, or non-revisioned edits', () => {
    const draft = labelEditDraft(label());
    expect(labelEditRequest(label(), { ...draft, name: '   ' })).toBeNull();
    expect(labelEditRequest(label(), { ...draft, name: 'x'.repeat(61) })).toBeNull();
    expect(labelEditRequest(label(), { ...draft, color: '#xyzxyz' })).toBeNull();
    expect(labelEditRequest(label({ archivedAt: '2026-08-20T00:00:00.000Z' }), {
      ...draft,
      name: 'Archived edit',
    })).toBeNull();
    expect(labelEditRequest(label({ revision: 0 }), {
      ...draft,
      name: 'Invalid revision',
    })).toBeNull();
  });

  it('locks the manager to inline recovery and a stateful fixture', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [issues, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/web/src/issues.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(issues).toContain('Save label');
    expect(issues).toContain('Retry draft');
    expect(issues).toContain('Use server values');
    expect(issues).toContain('labelMutationPending');
    expect(issues).toContain('api.labels(workspaceId, true)');
    expect(issues).toContain('data-label-editor={label.id}');
    expect(styles).toContain('.label-edit-recovery {');
    expect(styles).toContain('.label-edit-feedback {');
    expect(fixture).toContain("fixtureName(request) === 'label-inline-edit'");
    expect(fixture).toContain('Submit at least one supported label change.');
  });
});
