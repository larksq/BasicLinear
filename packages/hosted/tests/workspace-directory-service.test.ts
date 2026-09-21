import {describe, expect, it} from 'vitest';
import {
  MemoryWorkspaceDirectoryRepository,
  WorkspaceDirectoryService,
} from '../src/index.js';

const createdAt = '2026-12-01T00:00:00.000Z';

describe('WorkspaceDirectoryService', () => {
  it('restores every active owner and invited-member workspace after a fresh sign-in', async () => {
    const repository = new MemoryWorkspaceDirectoryRepository();
    const userId = 'member_directory';
    for (const [workspaceId, name, role] of [
      ['ws_member_directory', 'Shared product workspace', 'member'],
      ['ws_owner_directory', 'Personal workspace', 'owner'],
    ] as const) {
      repository.seedDocument(`workspaces/${workspaceId}`, {
        schemaVersion: 1, id: workspaceId, workspaceId, name,
        ownerUid: role === 'owner' ? userId : 'other_owner',
        authority: 'firebase-hosted', createdAt, revision: 1,
      });
      repository.seedDocument(`workspaces/${workspaceId}/memberships/${userId}`, {
        schemaVersion: 1, id: `mem_${workspaceId}`, workspaceId, userId, role,
        status: 'active', createdAt, revision: 1,
      });
    }
    repository.seedDocument(`workspaces/ws_removed_directory/memberships/${userId}`, {
      schemaVersion: 1, id: 'mem_removed_directory', workspaceId: 'ws_removed_directory',
      userId, role: 'member', status: 'removed', createdAt,
      updatedAt: '2026-12-02T00:00:00.000Z', removedAt: '2026-12-02T00:00:00.000Z', revision: 2,
    });

    await expect(new WorkspaceDirectoryService(repository).listUserWorkspaces(userId)).resolves.toEqual([
      {id: 'ws_owner_directory', name: 'Personal workspace', role: 'owner'},
      {id: 'ws_member_directory', name: 'Shared product workspace', role: 'member'},
    ]);
  });
});
