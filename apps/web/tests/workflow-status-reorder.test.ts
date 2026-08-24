import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  reorderWorkflowStatusForDrop,
  reorderWorkflowStatusForMove,
  workflowStatusDragThresholdExceeded,
  workflowStatusDropEdge,
  workflowStatusPositionAnnouncement,
} from '../src/workflow-status-reorder.js';

const appPath = fileURLToPath(new URL('../src/App.tsx', import.meta.url));
const apiPath = fileURLToPath(new URL('../../api/src/app.ts', import.meta.url));
const repositoryPath = fileURLToPath(new URL('../../../packages/db/src/sqlite/repository.ts', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));
const fixturePath = fileURLToPath(new URL('../../../scripts/serve-visual-fixture.mjs', import.meta.url));

const scope = { workspaceId: 'workspace-a', teamId: 'team-a' };
const records = [
  { id: 'status-a', ...scope, revision: 1, name: 'Backlog' },
  { id: 'status-b', ...scope, revision: 2, name: 'Started' },
  { id: 'status-c', ...scope, revision: 3, name: 'Done' },
];

describe('workflow status keyboard reordering', () => {
  it('moves a status by stable identity without mutating the confirmed source order', () => {
    const ordered = reorderWorkflowStatusForMove(records, 'status-b', -1, scope);
    expect(ordered?.map(({ id }) => id)).toEqual(['status-b', 'status-a', 'status-c']);
    expect(records.map(({ id }) => id)).toEqual(['status-a', 'status-b', 'status-c']);
  });

  it.each([
    ['first item up', records, 'status-a', -1],
    ['last item down', records, 'status-c', 1],
    ['missing identity', records, 'status-missing', 1],
    ['duplicate identity', [records[0]!, records[0]!], 'status-a', 1],
    ['cross-team collection', [records[0]!, { ...records[1]!, teamId: 'team-b' }], 'status-a', 1],
    ['invalid revision', [{ ...records[0]!, revision: 0 }, records[1]!], 'status-a', 1],
  ] as const)('rejects %s', (_label, input, statusId, offset) => {
    expect(reorderWorkflowStatusForMove(input, statusId, offset, scope)).toBeNull();
  });
});

describe('workflow status pointer reordering', () => {
  it('drops before or after a stable target without mutating the source', () => {
    expect(reorderWorkflowStatusForDrop(records, 'status-c', 'status-a', 'before', scope)
      ?.map(({ id }) => id)).toEqual(['status-c', 'status-a', 'status-b']);
    expect(reorderWorkflowStatusForDrop(records, 'status-a', 'status-b', 'after', scope)
      ?.map(({ id }) => id)).toEqual(['status-b', 'status-a', 'status-c']);
    expect(records.map(({ id }) => id)).toEqual(['status-a', 'status-b', 'status-c']);
  });

  it('rejects self, missing, invalid-scope, and adjacent no-op drops', () => {
    expect(reorderWorkflowStatusForDrop(records, 'status-b', 'status-b', 'after', scope)).toBeNull();
    expect(reorderWorkflowStatusForDrop(records, 'missing', 'status-a', 'before', scope)).toBeNull();
    expect(reorderWorkflowStatusForDrop(records, 'status-a', 'missing', 'before', scope)).toBeNull();
    expect(reorderWorkflowStatusForDrop(records, 'status-b', 'status-c', 'before', scope)).toBeNull();
    expect(reorderWorkflowStatusForDrop(records, 'status-a', 'status-c', 'sideways' as 'before', scope))
      .toBeNull();
  });

  it('derives bounded drop edges and a six-pixel activation threshold', () => {
    expect(workflowStatusDropEdge(109, 100, 20)).toBe('before');
    expect(workflowStatusDropEdge(110, 100, 20)).toBe('after');
    expect(workflowStatusDropEdge(110, 100, 0)).toBeNull();
    expect(workflowStatusDropEdge(Number.NaN, 100, 20)).toBeNull();
    expect(workflowStatusDragThresholdExceeded(10, 10, 15, 12)).toBe(false);
    expect(workflowStatusDragThresholdExceeded(10, 10, 16, 10)).toBe(true);
    expect(workflowStatusDragThresholdExceeded(10, 10, 10, 10, -1)).toBe(false);
  });

  it('announces the committed one-based position and team collection size', () => {
    expect(workflowStatusPositionAnnouncement('Started', records, 'status-b'))
      .toBe('Started moved to position 2 of 3.');
    expect(workflowStatusPositionAnnouncement('Missing', records, 'status-missing')).toBeNull();
  });
});

describe('workflow status reorder integration contract', () => {
  it('binds a team-scoped atomic route to the complete-order repository transaction', async () => {
    const [api, repository] = await Promise.all([
      readFile(apiPath, 'utf8'),
      readFile(repositoryPath, 'utf8'),
    ]);
    expect(api).toContain("'/api/v1/workspaces/:workspaceId/teams/:teamId/statuses/reorder'");
    expect(api).toContain('data: await reorderStatuses(');
    expect(repository).toContain('export async function reorderStatuses(');
    expect(repository).toContain('assertUniqueOrder(items);');
    expect(repository).toContain('Order every workflow status exactly once.');
    expect(repository).toContain("db.sqlite.exec('UPDATE workflow_statuses SET position = position + 1000000')");
    expect(repository).toContain("'workflow_status.reordered'");
    expect(repository).toContain("'Workflow status order is unchanged.'");
  });

  it('keeps confirmed order until settlement and exposes pointer plus named keyboard paths', async () => {
    const app = await readFile(appPath, 'utf8');
    expect(app).toContain('reorderWorkflowStatusForMove(');
    expect(app).toContain('reorderWorkflowStatusForDrop(');
    expect(app).toContain('setPointerCapture(event.pointerId)');
    expect(app).toContain('baseline: teamOrder,');
    expect(app).toContain('const teamOrder = drag.baseline;');
    expect(app).toContain("closest<HTMLElement>('[data-status-drop-id]')");
    expect(app).toContain('onPointerCancel={(event) => finishWorkflowStatusDrag(event, true)}');
    expect(app).toContain('onLostPointerCapture={(event) => finishWorkflowStatusDrag(event, true)}');
    expect(app).toContain('data-status-move="up"');
    expect(app).toContain('data-status-move="down"');
    expect(app).toContain('const confirmed = await restoreAuthoritativeStatuses();');
    expect(app).not.toContain("setCachedTeamStatuses(variables.teamId, variables.ordered)");
  });

  it('uses fixed drag geometry and non-shifting before/after indicators', async () => {
    const styles = await readFile(stylesPath, 'utf8');
    expect(styles).toContain('.workflow-status-drag-handle { width: 24px; height: 32px;');
    expect(styles).toContain('touch-action: none;');
    expect(styles).toContain('.workflow-status-order-item.drop-before::before, .workflow-status-order-item.drop-after::after');
    expect(styles).toContain('.workflow-status-order-item.drop-before::before { top: -1px; }');
    expect(styles).toContain('.workflow-status-order-item.drop-after::after { bottom: -1px; }');
  });

  it('serves a separate stateful fixture with complete-set, conflict, and no-op rejection', async () => {
    const fixture = await readFile(fixturePath, 'utf8');
    expect(fixture).toContain("'workflow-status-reorder'");
    expect(fixture).toContain("statuses\\/reorder$/i");
    expect(fixture).toContain('Order every workflow status in the team exactly once.');
    expect(fixture).toContain("apiError(response, 'CONFLICT'");
    expect(fixture).toContain("'Workflow status order is unchanged.'");
    expect(fixture).toContain("nextPositions.get(status.id)");
  });
});
