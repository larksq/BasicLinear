import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  projectContentDraft,
  projectContentRequest,
  projectInlinePropertyRequest,
  projectLeadOptions,
} from '../src/project-inline-edit.js';

const workspaceId = 'workspace-a';
const document = { version: 1 as const, type: 'doc' as const, content: [] };
const project = (overrides: Record<string, unknown> = {}) => ({
  workspaceId,
  revision: 7,
  status: 'in_progress' as const,
  priority: 'high' as const,
  leadUserId: 'user-a',
  startDate: '2026-09-01',
  targetDate: '2026-10-01',
  name: 'Launch quality',
  summary: 'Prepare the public release.',
  icon: 'rocket' as const,
  color: '#C65D4B',
  overviewDocument: document,
  resources: [{ id: 'resource-a', position: 100, label: 'Runbook', url: 'https://example.test/runbook' }],
  archivedAt: null,
  ...overrides,
});
const members = [
  { workspaceId, userId: 'user-a' },
  { workspaceId, userId: 'user-b' },
];

describe('project inline edit requests', () => {
  it('emits one minimal revision-bearing patch for each mutable property', () => {
    const current = project();
    expect(projectInlinePropertyRequest(current, { field: 'status', value: 'completed' }, members))
      .toEqual({ expectedRevision: 7, status: 'completed' });
    expect(projectInlinePropertyRequest(current, { field: 'priority', value: 'urgent' }, members))
      .toEqual({ expectedRevision: 7, priority: 'urgent' });
    expect(projectInlinePropertyRequest(current, { field: 'leadUserId', value: 'user-b' }, members))
      .toEqual({ expectedRevision: 7, leadUserId: 'user-b' });
    expect(projectInlinePropertyRequest(current, { field: 'leadUserId', value: null }, members))
      .toEqual({ expectedRevision: 7, leadUserId: null });
    expect(projectInlinePropertyRequest(current, { field: 'startDate', value: '2026-09-08' }, members))
      .toEqual({ expectedRevision: 7, startDate: '2026-09-08' });
    expect(projectInlinePropertyRequest(current, { field: 'targetDate', value: null }, members))
      .toEqual({ expectedRevision: 7, targetDate: null });
  });

  it('keeps only workspace-unique lead identities and rejects unavailable assignments', () => {
    const duplicate = { workspaceId, userId: 'duplicate' };
    expect(projectLeadOptions(project(), [
      ...members,
      { workspaceId: 'workspace-b', userId: 'other' },
      duplicate,
      { ...duplicate },
    ]).map((member) => member.userId)).toEqual(['user-a', 'user-b']);
    expect(projectInlinePropertyRequest(project(), {
      field: 'leadUserId', value: 'duplicate',
    }, [duplicate, { ...duplicate }])).toBeNull();
    expect(projectInlinePropertyRequest(project(), {
      field: 'leadUserId', value: 'other',
    }, [{ workspaceId: 'workspace-b', userId: 'other' }])).toBeNull();
  });

  it('rejects invalid and reversed dates without issuing a request', () => {
    const current = project();
    expect(projectInlinePropertyRequest(current, { field: 'startDate', value: '2026-02-30' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'startDate', value: '2026-10-02' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'targetDate', value: '2026-08-31' }, members)).toBeNull();
  });

  it('suppresses unchanged properties and every edit to an archived project', () => {
    const current = project();
    expect(projectInlinePropertyRequest(current, { field: 'status', value: 'in_progress' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'priority', value: 'high' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'leadUserId', value: 'user-a' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'startDate', value: '2026-09-01' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(current, { field: 'targetDate', value: '2026-10-01' }, members)).toBeNull();
    expect(projectInlinePropertyRequest(project({ archivedAt: '2026-08-20T00:00:00.000Z' }), {
      field: 'status', value: 'completed',
    }, members)).toBeNull();
  });
});

describe('project content requests', () => {
  it('builds a normalized sparse content patch and retains the authoritative revision', () => {
    const current = project();
    const draft = projectContentDraft(current);
    expect(projectContentRequest(current, {
      ...draft,
      name: '  Launch   readiness  ',
      summary: '  Ship safely.\r\n',
      color: '#c65d4b',
      resources: [{ label: ' Runbook ', url: 'https://example.test/runbook' }],
    })).toEqual({
      expectedRevision: 7,
      name: 'Launch readiness',
      summary: 'Ship safely.',
    });
  });

  it('includes only changed icon, color, overview, and normalized resources', () => {
    const current = project();
    const draft = projectContentDraft(current);
    const overviewDocument = {
      version: 1 as const,
      type: 'doc' as const,
      content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'Updated' }] }],
    };
    expect(projectContentRequest(current, {
      ...draft,
      icon: 'compass',
      color: '#3f8b75',
      overviewDocument,
      resources: [{ label: 'Plan', url: 'https://example.test/plan' }],
    })).toEqual({
      expectedRevision: 7,
      icon: 'compass',
      color: '#3F8B75',
      overviewDocument,
      resources: [{ label: 'Plan', url: 'https://example.test/plan' }],
    });
  });

  it('suppresses semantic no-ops and rejects invalid content locally', () => {
    const current = project();
    expect(projectContentRequest(current, projectContentDraft(current))).toBeNull();
    expect(projectContentRequest(current, { ...projectContentDraft(current), name: '   ' })).toBeNull();
    expect(projectContentRequest(current, { ...projectContentDraft(current), color: '#XYZXYZ' })).toBeNull();
    expect(projectContentRequest(current, {
      ...projectContentDraft(current),
      resources: [{ label: 'Private', url: 'https://user:pass@example.test/' }],
    })).toBeNull();
    expect(projectContentRequest(project({ archivedAt: '2026-08-20T00:00:00.000Z' }), {
      ...projectContentDraft(current), name: 'Archived edit',
    })).toBeNull();
  });

  it('locks the source surface to inline project editing and a stateful fixture', async () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const [projects, styles, fixture] = await Promise.all([
      readFile(join(root, 'apps/web/src/projects.tsx'), 'utf8'),
      readFile(join(root, 'apps/web/src/styles.css'), 'utf8'),
      readFile(join(root, 'scripts/serve-visual-fixture.mjs'), 'utf8'),
    ]);
    expect(projects).toContain('Save project content');
    expect(projects).toContain("onChange('Status', { field: 'status'");
    expect(projects).toContain('Project team');
    expect(projects).toContain('Server values restored at revision ${confirmed.revision}.');
    expect(projects).not.toContain('<Dialog title="Edit project"');
    expect(styles).toContain('.project-property-feedback {');
    expect(styles).toContain('.project-content-actions {');
    expect(fixture).toContain("fixtureName(request) === 'project-inline-edit'");
    expect(fixture).toContain('Submit one project property or a supported content patch.');
  });
});
