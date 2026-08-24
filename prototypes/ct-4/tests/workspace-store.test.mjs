import assert from 'node:assert/strict';
import test from 'node:test';
import { AccessDeniedError, RevisionConflictError, WorkspaceStore } from '../src/workspace-store.mjs';

function fixture() {
  const store = new WorkspaceStore();
  store.addMembership({ userId: 'alice', workspaceId: 'workspace-a' });
  store.addMembership({ userId: 'bob', workspaceId: 'workspace-b' });
  store.seedIssue({ id: 'shared-human-id-a', workspaceId: 'workspace-a', identifier: 'ENG-1', title: 'Alpha' });
  store.seedIssue({ id: 'shared-human-id-b', workspaceId: 'workspace-b', identifier: 'ENG-1', title: 'Beta' });
  return store;
}

test('list and direct reads remain workspace scoped', () => {
  const store = fixture();
  assert.deepEqual(store.listIssues({ userId: 'alice', workspaceId: 'workspace-a' }).map((issue) => issue.title), ['Alpha']);
  assert.throws(
    () => store.getIssue({ userId: 'alice', workspaceId: 'workspace-a', issueId: 'shared-human-id-b' }),
    (error) => error instanceof AccessDeniedError && error.code === 'NOT_FOUND',
  );
  assert.throws(
    () => store.listIssues({ userId: 'alice', workspaceId: 'workspace-b' }),
    (error) => error instanceof AccessDeniedError,
  );
});

test('accepted update increments revision and writes one activity entry', () => {
  const store = fixture();
  const updated = store.updateIssue({
    userId: 'alice',
    workspaceId: 'workspace-a',
    issueId: 'shared-human-id-a',
    expectedRevision: 1,
    patch: { title: 'Alpha revised' },
  });
  assert.equal(updated.revision, 2);
  assert.equal(updated.title, 'Alpha revised');
  assert.deepEqual(store.activity({ userId: 'alice', workspaceId: 'workspace-a' }), [{
    workspaceId: 'workspace-a',
    issueId: 'shared-human-id-a',
    actorId: 'alice',
    beforeRevision: 1,
    afterRevision: 2,
  }]);
});

test('stale update fails without overwriting state or appending activity', () => {
  const store = fixture();
  store.updateIssue({
    userId: 'alice',
    workspaceId: 'workspace-a',
    issueId: 'shared-human-id-a',
    expectedRevision: 1,
    patch: { title: 'Committed' },
  });
  assert.throws(
    () => store.updateIssue({
      userId: 'alice',
      workspaceId: 'workspace-a',
      issueId: 'shared-human-id-a',
      expectedRevision: 1,
      patch: { title: 'Stale overwrite' },
    }),
    (error) => error instanceof RevisionConflictError && error.currentRevision === 2,
  );
  assert.equal(store.getIssue({ userId: 'alice', workspaceId: 'workspace-a', issueId: 'shared-human-id-a' }).title, 'Committed');
  assert.equal(store.activity({ userId: 'alice', workspaceId: 'workspace-a' }).length, 1);
});
