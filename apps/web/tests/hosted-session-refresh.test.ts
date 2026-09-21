import {beforeEach, describe, expect, it, vi} from 'vitest';

const auth = vi.hoisted(() => ({
  refreshHostedGoogleIdToken: vi.fn<() => Promise<string | null>>(),
}));

vi.mock('../src/hosted-auth.js', () => ({
  refreshHostedGoogleIdToken: auth.refreshHostedGoogleIdToken,
}));

import {createHostedIssue} from '../src/hosted-api.js';

const authenticationRequired = () => new Response(JSON.stringify({
  error: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'A verified Google session is required.',
    correlationId: 'stale-session-request',
  },
}), {status: 401, headers: {'content-type': 'application/json'}});

describe('hosted Firebase session recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.refreshHostedGoogleIdToken.mockResolvedValue('fresh-firebase-id-token');
  });

  it('refreshes once and retries the same idempotent mutation without losing its draft', async () => {
    const issue = {
      schemaVersion: 1 as const,
      id: 'issue_refresh000000000000000000000001',
      workspaceId: 'ws_refresh',
      title: 'Preserved issue draft',
      description: 'The exact description survives token refresh.',
      status: 'todo' as const,
      priority: 'no_priority' as const,
      projectId: null,
      milestoneId: null,
      parentIssueId: null,
      resources: [],
      assigneeUserId: null,
      createdByUserId: 'owner_refresh',
      createdAt: '2026-08-27T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
      revision: 1,
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(authenticationRequired())
      .mockResolvedValueOnce(new Response(JSON.stringify({data: {issue}}), {
        status: 201,
        headers: {'content-type': 'application/json'},
      }));

    await expect(createHostedIssue(
      'stale-firebase-id-token',
      'ws_refresh',
      {title: issue.title, description: issue.description},
      'refresh-retry-key-0001',
      fetcher,
    )).resolves.toEqual(issue);

    expect(auth.refreshHostedGoogleIdToken).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const first = fetcher.mock.calls[0]?.[1];
    const second = fetcher.mock.calls[1]?.[1];
    expect((first?.headers as Record<string, string>).authorization).toBe('Bearer stale-firebase-id-token');
    expect(new Headers(second?.headers).get('authorization')).toBe('Bearer fresh-firebase-id-token');
    expect(second?.body).toBe(first?.body);
    expect(new Headers(second?.headers).get('idempotency-key')).toBe('refresh-retry-key-0001');
  });

  it('returns the original authentication error when Firebase has no refreshable user', async () => {
    auth.refreshHostedGoogleIdToken.mockResolvedValue(null);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(authenticationRequired());

    await expect(createHostedIssue(
      'stale-firebase-id-token',
      'ws_refresh',
      'Preserved issue draft',
      'refresh-retry-key-0002',
      fetcher,
    )).rejects.toMatchObject({status: 401, code: 'AUTHENTICATION_REQUIRED'});
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
