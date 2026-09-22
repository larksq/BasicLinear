import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WorkflowStatus } from '@basiclinear/contracts';
import {
  workflowStatusRetirementDraft,
  workflowStatusRetireRequest,
} from '../src/workflow-status-retire.js';

const appPath = fileURLToPath(new URL('../src/App.tsx', import.meta.url));
const apiPath = fileURLToPath(new URL('../../api/src/app.ts', import.meta.url));
const repositoryPath = fileURLToPath(new URL('../../../packages/db/src/sqlite/repository.ts', import.meta.url));
const stylesPath = fileURLToPath(new URL('../src/styles.css', import.meta.url));
const fixturePath = fileURLToPath(new URL('../../../scripts/serve-visual-fixture.mjs', import.meta.url));

const scope = {
  workspaceId: '10000000-0000-4000-8000-000000000001',
  teamId: '20000000-0000-4000-8000-000000000001',
};
const timestamp = '2026-08-21T00:00:00.000Z';
const status = (
  id: string,
  name: string,
  revision: number,
  overrides: Partial<WorkflowStatus> = {},
): WorkflowStatus => ({
  id,
  ...scope,
  name,
  category: 'unstarted',
  color: '#6279C6',
  position: revision * 100,
  isDefault: false,
  revision,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});
const records = [
  status('30000000-0000-4000-8000-000000000001', 'Backlog', 3),
  status('30000000-0000-4000-8000-000000000002', 'In progress', 5),
  status('30000000-0000-4000-8000-000000000003', 'Done', 7, { category: 'completed' }),
];

describe('workflow status retirement request', () => {
  it('captures an authoritative source and distinct same-team replacement candidates', () => {
    const draft = workflowStatusRetirementDraft(records[1]!, records, scope);
    expect(draft).toEqual({
      source: records[1],
      candidates: [records[0], records[2]],
      replacementStatusId: records[0]?.id,
    });
    expect(draft?.candidates).not.toBe(records);
  });

  it('emits both opening revisions for the selected distinct replacement', () => {
    const draft = workflowStatusRetirementDraft(records[1]!, records, scope);
    expect(draft).not.toBeNull();
    expect(workflowStatusRetireRequest({
      ...draft!,
      replacementStatusId: records[2]!.id,
    }, scope)).toEqual({
      expectedRevision: 5,
      replacementStatusId: records[2]!.id,
      replacementExpectedRevision: 7,
    });
  });

  it.each([
    ['the final team status', [records[0]!], records[0]!],
    ['a source outside the workspace', records, { ...records[0]!, workspaceId: 'wrong' }],
    ['a source outside the team', records, { ...records[0]!, teamId: 'wrong' }],
    ['a stale source copy', records, { ...records[0]!, revision: 99 }],
    ['a duplicate record collection', [records[0]!, records[0]!], records[0]!],
    ['an invalid record revision', [records[0]!, { ...records[1]!, revision: 0 }], records[0]!],
    ['a mixed-team collection', [records[0]!, { ...records[1]!, teamId: 'wrong' }], records[0]!],
  ] as const)('rejects %s', (_label, input, source) => {
    expect(workflowStatusRetirementDraft(source, input, scope)).toBeNull();
  });

  it('fails closed when a retained draft is malformed or no longer scoped', () => {
    const draft = workflowStatusRetirementDraft(records[0]!, records, scope)!;
    expect(workflowStatusRetireRequest({ ...draft, replacementStatusId: draft.source.id }, scope))
      .toBeNull();
    expect(workflowStatusRetireRequest({ ...draft, replacementStatusId: 'missing' }, scope))
      .toBeNull();
    expect(workflowStatusRetireRequest({
      ...draft,
      candidates: [draft.candidates[0]!, draft.candidates[0]!],
    }, scope)).toBeNull();
    expect(workflowStatusRetireRequest({
      ...draft,
      candidates: [{ ...draft.candidates[0]!, teamId: 'wrong' }],
    }, scope)).toBeNull();
    expect(workflowStatusRetireRequest(draft, { ...scope, workspaceId: 'wrong' })).toBeNull();
  });
});

describe('workflow status retirement integration contract', () => {
  it('binds a revisioned route to one atomic reassignment and deletion transaction', async () => {
    const [api, repository] = await Promise.all([
      readFile(apiPath, 'utf8'),
      readFile(repositoryPath, 'utf8'),
    ]);
    expect(api).toContain("'/api/v1/workspaces/:workspaceId/statuses/:statusId/retire'");
    expect(api).toContain('data: await retireStatus(');
    expect(repository).toContain('export async function retireStatus(');
    expect(repository).toContain('requireRevision(input.expectedRevision, source.revision);');
    expect(repository).toContain('requireRevision(input.replacementExpectedRevision, replacement.revision);');
    expect(repository).toContain('return db.write(() => {');
    expect(repository).toContain("action: 'workflow_status.retired'");
    expect(repository).toContain("db.sqlite.prepare('DELETE FROM workflow_statuses WHERE id = ?').run(source.id)");
    expect(repository).toContain('reassignedIssueCount: affected.length');
  });

  it('uses a destructive confirmation, serialized controls, readback, and focus recovery', async () => {
    const [app, styles] = await Promise.all([
      readFile(appPath, 'utf8'),
      readFile(stylesPath, 'utf8'),
    ]);
    expect(app).toContain('data-status-retire={status.id}');
    expect(app).toContain('data-status-retirement-replacement');
    expect(app).toContain('including archived issues');
    expect(app).toContain('Reassigning issues and retiring status...');
    expect(app).toContain('const confirmed = await restoreAuthoritativeStatuses();');
    expect(app).toContain('focusStatusRetirementSelect();');
    expect(app).toContain('focusStatusControl(replacementFromReceipt?.id ?? receipt.replacementStatusId);');
    expect(app).toContain('|| retireStatus.isPending;');
    expect(styles).toContain('.workflow-status-retire-feedback { min-height: 32px;');
    expect(styles).toContain('.workflow-status-retire-actions { display: flex; justify-content: flex-end;');
  });

  it('serves a stateful retirement fixture with conflicts and archived reassignment', async () => {
    const fixture = await readFile(fixturePath, 'utf8');
    expect(fixture).toContain("'workflow-status-retire'");
    expect(fixture).toContain('reassignedIssueCount');
    expect(fixture).toContain('workflowStatusRetirementIssues');
    expect(fixture).toContain("apiError(response, 'CONFLICT'");
    expect(fixture).toContain('A team must keep at least one workflow status.');
  });
});
