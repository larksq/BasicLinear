import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  milestoneDragThresholdExceeded,
  milestoneDropEdge,
  milestonePositionAnnouncement,
  reorderMilestoneForDrop,
  reorderMilestoneForMove,
} from '../src/milestone-interactions.js';

const projectsSourcePath = fileURLToPath(new URL('../src/projects.tsx', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));
const fixturePath = fileURLToPath(new URL('../../../scripts/serve-visual-fixture.mjs', import.meta.url));

const records = [
  { id: 'milestone-a', name: 'Alpha' },
  { id: 'milestone-b', name: 'Beta' },
  { id: 'milestone-c', name: 'Gamma' },
];

describe('milestone keyboard reordering', () => {
  it('moves a milestone by stable identity without mutating the source order', () => {
    const ordered = reorderMilestoneForMove(records, 'milestone-b', -1);

    expect(ordered?.map((record) => record.id)).toEqual([
      'milestone-b',
      'milestone-a',
      'milestone-c',
    ]);
    expect(records.map((record) => record.id)).toEqual([
      'milestone-a',
      'milestone-b',
      'milestone-c',
    ]);
  });

  it.each([
    ['first item up', 'milestone-a', -1],
    ['last item down', 'milestone-c', 1],
    ['missing identity', 'milestone-missing', 1],
  ] as const)('rejects %s', (_label, milestoneId, offset) => {
    expect(reorderMilestoneForMove(records, milestoneId, offset)).toBeNull();
  });

  it('rejects duplicate identities instead of choosing an ambiguous record', () => {
    expect(reorderMilestoneForMove(
      [{ id: 'duplicate' }, { id: 'duplicate' }],
      'duplicate',
      1,
    )).toBeNull();
  });

  it('announces the committed one-based position and collection size', () => {
    expect(milestonePositionAnnouncement('Beta', records, 'milestone-b'))
      .toBe('Beta moved to position 2 of 3.');
    expect(milestonePositionAnnouncement('Missing', records, 'milestone-missing'))
      .toBeNull();
  });

  it('drops a milestone before or after a stable target without mutating source order', () => {
    expect(reorderMilestoneForDrop(records, 'milestone-c', 'milestone-a', 'before')
      ?.map((record) => record.id)).toEqual([
      'milestone-c',
      'milestone-a',
      'milestone-b',
    ]);
    expect(reorderMilestoneForDrop(records, 'milestone-a', 'milestone-b', 'after')
      ?.map((record) => record.id)).toEqual([
      'milestone-b',
      'milestone-a',
      'milestone-c',
    ]);
    expect(records.map((record) => record.id)).toEqual([
      'milestone-a',
      'milestone-b',
      'milestone-c',
    ]);
  });

  it('rejects ambiguous, missing, self, and no-op drops', () => {
    expect(reorderMilestoneForDrop(records, 'milestone-b', 'milestone-b', 'after')).toBeNull();
    expect(reorderMilestoneForDrop(records, 'missing', 'milestone-a', 'before')).toBeNull();
    expect(reorderMilestoneForDrop(records, 'milestone-a', 'missing', 'before')).toBeNull();
    expect(reorderMilestoneForDrop(records, 'milestone-b', 'milestone-c', 'before')).toBeNull();
    expect(reorderMilestoneForDrop(
      [{ id: 'duplicate' }, { id: 'duplicate' }, { id: 'target' }],
      'duplicate',
      'target',
      'before',
    )).toBeNull();
  });

  it('derives bounded drop edges and a six-pixel pointer activation threshold', () => {
    expect(milestoneDropEdge(109, 100, 20)).toBe('before');
    expect(milestoneDropEdge(110, 100, 20)).toBe('after');
    expect(milestoneDropEdge(110, 100, 0)).toBeNull();
    expect(milestoneDropEdge(Number.NaN, 100, 20)).toBeNull();
    expect(milestoneDragThresholdExceeded(10, 10, 15, 12)).toBe(false);
    expect(milestoneDragThresholdExceeded(10, 10, 16, 10)).toBe(true);
    expect(milestoneDragThresholdExceeded(10, 10, 10, 10, -1)).toBe(false);
  });

  it('binds the inline editor, ordered rows, Escape recovery, and live status', async () => {
    const source = await readFile(projectsSourcePath, 'utf8');

    expect(source).toContain('id="milestone-inline-editor"');
    expect(source).toContain('aria-label="New milestone"');
    expect(source).toContain("pending || event.key !== 'Escape'");
    expect(source).toContain('autoFocus required');
    expect(source).toContain('<ol ref={milestoneListRef} className="milestone-order"');
    expect(source).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(source).toContain('data-milestone-move="up"');
    expect(source).toContain('data-milestone-move="down"');
    expect(source).not.toContain("setDialog('milestone-create')");
  });

  it('keeps the inline editor on the established milestone tracks', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toContain('.milestone-list { border-top: 1px solid var(--ol-border); }');
    expect(styles).toContain('.milestone-order { margin: 0; padding: 0; list-style: none; }');
    expect(styles).toContain('.milestone-inline-row { margin: 0;');
    expect(styles).toContain('.milestone-inline-error { min-width: 0; grid-column: 2 / -1; }');
    expect(styles).toContain('.milestone-row.milestone-inline-row .milestone-inline-date { display: flex; grid-column: 2; grid-row: 2; }');
    expect(styles).toContain('.milestone-row.milestone-inline-row .milestone-issues { grid-column: 2; grid-row: 3; }');
    expect(styles).toContain('.milestone-edit-row .milestone-edit-recovery { grid-row: 4; }');
    expect(styles).toContain('.milestone-row:focus-visible { outline-offset: -2px; }');
  });

  it('binds pointer capture to the pure drop contract while retaining keyboard controls', async () => {
    const source = await readFile(projectsSourcePath, 'utf8');

    expect(source).toContain('setPointerCapture(event.pointerId)');
    expect(source).toContain('milestoneDragThresholdExceeded(');
    expect(source).toContain("closest<HTMLElement>('[data-milestone-drop-id]')");
    expect(source).toContain('milestoneDropEdge(');
    expect(source).toContain('reorderMilestoneForDrop(');
    expect(source).toContain("direction: 'drag'");
    expect(source).toContain('onPointerCancel={(event) => finishMilestoneDrag(event, true)}');
    expect(source).toContain('onLostPointerCapture={(event) => finishMilestoneDrag(event, true)}');
    expect(source).toContain("`${source.name} picked up. `");
    expect(source).toContain('data-milestone-move="up"');
    expect(source).toContain('data-milestone-move="down"');
  });

  it('keeps pointer drag geometry stable and explicitly indicates the drop edge', async () => {
    const styles = await readFile(stylesPath, 'utf8');

    expect(styles).toContain('.milestone-drag-handle { width: 24px; height: 32px;');
    expect(styles).toContain('touch-action: none;');
    expect(styles).toContain('.milestone-row.drop-before::before, .milestone-row.drop-after::after');
    expect(styles).toContain('.milestone-row.drop-before::before { top: -1px; }');
    expect(styles).toContain('.milestone-row.drop-after::after { bottom: -1px; }');
  });

  it('serves three revision-bearing milestones and a stateful reorder endpoint', async () => {
    const fixture = await readFile(fixturePath, 'utf8');

    expect(fixture).toContain("fixtureName(request) === 'milestone-drag'");
    expect(fixture).toContain('let milestoneDragMilestones = [milestone, milestoneB, milestoneC]');
    expect(fixture).toContain('path.endsWith(`/projects/${ids.project}/milestones/reorder`)');
    expect(fixture).toContain("apiError(response, 'REVISION_CONFLICT'");
    expect(fixture).toContain('json(response, milestoneDragMilestones)');
  });
});
