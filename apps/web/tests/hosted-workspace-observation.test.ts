import {readFileSync} from 'node:fs';
import {describe, expect, it, vi} from 'vitest';
import {
  getHostedIssueObservation,
  listHostedNotifications,
  listHostedWorkspaces,
  markHostedIssueNotificationsRead,
  setHostedIssueSubscription,
} from '../src/hosted-api.js';

const response = (data: unknown) => new Response(JSON.stringify({data}), {
  status: 200,
  headers: {'content-type': 'application/json'},
});

describe('hosted workspace switching and observation client', () => {
  it('uses same-origin routes for the durable workspace and observation journey', async () => {
    const observation = {
      issueId: 'issue_00000000000000000000000000000001',
      subscribed: true,
      mode: 'explicit',
      readThroughAt: '2026-12-01T00:00:00.000Z',
      revision: 1,
      subscriberUserIds: ['owner_client'],
    } as const;
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({workspaces: [{id: 'ws_client', name: 'Client', role: 'owner'}]}))
      .mockResolvedValueOnce(response({observation}))
      .mockResolvedValueOnce(response({observation}))
      .mockResolvedValueOnce(response({notifications: []}))
      .mockResolvedValueOnce(response({observation}));

    await listHostedWorkspaces('token-value', fetcher);
    await getHostedIssueObservation('token-value', 'ws_client', observation.issueId, fetcher);
    await setHostedIssueSubscription('token-value', 'ws_client', observation.issueId, true, 'subscribe-key-0001', fetcher);
    await listHostedNotifications('token-value', 'ws_client', fetcher);
    await markHostedIssueNotificationsRead('token-value', 'ws_client', observation.issueId, 'read-key-000000001', fetcher);

    expect(fetcher.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/hosted/workspaces',
      `/api/v1/hosted/workspaces/ws_client/issues/${observation.issueId}/subscription`,
      `/api/v1/hosted/workspaces/ws_client/issues/${observation.issueId}/subscription`,
      '/api/v1/hosted/workspaces/ws_client/notifications',
      `/api/v1/hosted/workspaces/ws_client/issues/${observation.issueId}/notifications/read`,
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'GET', 'PUT', 'GET', 'POST']);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe('same-origin');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer token-value');
    }
  });

  it('renders a real switcher, Google member names, subscribers, and a notification inbox', () => {
    const app = readFileSync('apps/web/src/hosted-app.tsx', 'utf8');
    const workspace = readFileSync('apps/web/src/hosted-workspace.tsx', 'utf8');
    expect(app).toContain('listHostedWorkspaces(result.idToken)');
    expect(app).toContain('activeWorkspaceStorageKey(identity.uid)');
    expect(workspace).toContain('aria-label="Switch workspace"');
    expect(workspace).toContain('member.displayName?.trim()');
    expect(workspace).toContain("observation?.subscribed ? 'Unsubscribe' : 'Subscribe'");
    expect(workspace).toContain('Issue activity you follow');
    expect(workspace).toContain('markHostedIssueNotificationsRead(');
  });
});
