import { Readable } from 'node:stream';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  CollaborationService,
  createHostedHttpHandler,
  InvitationService,
  MemoryCollaborationRepository,
  MemoryInvitationRepository,
  MemoryOwnerBootstrapRepository,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  OwnerBootstrapService,
  WorkspaceAuthorizationService,
  type VerifiedGoogleIdentity,
} from '../src/index.js';
import { hostedOperationsForHttpTests } from './fixtures/operations.js';
import { noopBillingSeatReconcilerForTests, proEntitlementPolicyForTests } from './fixtures/entitlement.js';

const workspaceId = 'ws_http_collaboration';
const owner: VerifiedGoogleIdentity = {
  uid: 'owner_http_collaboration', email: 'owner@example.com', emailVerified: true,
  displayName: 'Owner', provider: 'google.com',
};
const member: VerifiedGoogleIdentity = {
  uid: 'member_http_collaboration', email: 'member@example.com', emailVerified: true,
  displayName: 'Member', provider: 'google.com',
};

interface TestResponse { status: number; headers: Record<string, string>; body: unknown }

function fixture() {
  const memberships = new MemoryWorkspaceMembershipReader();
  const repository = new MemoryCollaborationRepository();
  let sequence = 1;
  const idFactory = () => (sequence++).toString(16).padStart(32, '0');
  for (const [identity, role] of [[owner, 'owner'], [member, 'member']] as const) {
    memberships.set({
      schemaVersion: 1, workspaceId, userId: identity.uid, role,
      status: 'active', revision: 1,
    });
    repository.seedDocument(`workspaces/${workspaceId}/memberships/${identity.uid}`, {
      schemaVersion: 1, id: `mem_${identity.uid}`, workspaceId, userId: identity.uid,
      role, status: 'active', createdAt: '2026-12-01T00:00:00.000Z', revision: 1,
    });
  }
  const authorization = new WorkspaceAuthorizationService(
    memberships,
    new MemoryWorkspaceAuthorizationEvidenceWriter(),
    { clock: () => new Date('2026-12-03T00:00:00.000Z'), idFactory },
  );
  const handler = createHostedHttpHandler({
    ...hostedOperationsForHttpTests(() => new Date('2026-12-01T00:00:00.000Z')),
    identityVerifier: {
      verifyGoogleIdToken: async (token) => {
        if (token === 'owner-google-token-123456789') return owner;
        if (token === 'member-google-token-123456789') return member;
        throw new Error('invalid token');
      },
    },
    bootstrapService: new OwnerBootstrapService(new MemoryOwnerBootstrapRepository()),
    workspaceAuthorizationService: authorization,
    invitationService: new InvitationService(
      new MemoryInvitationRepository(),
      authorization,
      {
        secret: 'http-invitation-secret-at-least-32-bytes-long',
        entitlementPolicy: proEntitlementPolicyForTests,
        seatReconciler: noopBillingSeatReconcilerForTests,
      },
    ),
    collaborationService: new CollaborationService(repository, authorization, {
      secret: 'http-collaboration-secret-at-least-32-bytes-long',
      entitlementPolicy: proEntitlementPolicyForTests,
      clock: () => new Date('2026-12-03T00:00:00.000Z'),
      idFactory,
    }),
  });
  const invoke = async (
    method: string,
    path: string,
    headers: IncomingHttpHeaders = {},
    body = '',
  ): Promise<TestResponse> => {
    const request = Readable.from(body === '' ? [] : [body]) as unknown as IncomingMessage;
    Object.assign(request, { method, url: path, headers: { host: 'basiclinear.test', ...headers } });
    let status = 0;
    let responseHeaders: Record<string, string> = {};
    let payload = '';
    const response = {
      writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
        status = nextStatus;
        responseHeaders = nextHeaders;
        return response;
      },
      end(value?: string) {
        payload = value ?? '';
        return response;
      },
    } as unknown as ServerResponse;
    await handler(request, response);
    return { status, headers: responseHeaders, body: payload === '' ? null : JSON.parse(payload) };
  };
  return { repository, invoke };
}

const headers = (kind: 'owner' | 'member', key?: string): IncomingHttpHeaders => ({
  authorization: `Bearer ${kind}-google-token-123456789`,
  'content-type': 'application/json',
  ...(key === undefined ? {} : { 'idempotency-key': key }),
});

describe('hosted collaboration HTTP boundary', () => {
  it('completes the exact owner assignment, member action, and comment chain', async () => {
    const { invoke } = fixture();
    const created = await invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/issues`,
      headers('owner', 'http-create-issue-key-0001'), JSON.stringify({
        title: 'Ship hosted tasks',
        description: 'Deliver a launch-ready hosted workspace.',
        resources: [{label: 'Launch brief', url: 'https://example.com/launch'}],
      }),
    );
    expect(created.status).toBe(201);
    const issue = (created.body as {data: {issue: {
      id: string;
      number: number;
      revision: number;
      description: string;
      resources: Array<{label: string; url: string}>;
    }}}).data.issue;
    expect(issue).toMatchObject({
      number: 1,
      description: 'Deliver a launch-ready hosted workspace.',
      resources: [{label: 'Launch brief', url: 'https://example.com/launch'}],
    });

    const assigned = await invoke(
      'PUT', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}/assignee`,
      headers('owner', 'http-assign-issue-key-0001'),
      JSON.stringify({ expectedRevision: issue.revision, assigneeUserId: member.uid }),
    );
    expect(assigned.status).toBe(200);
    const assignedIssue = (assigned.body as {data: {issue: {revision: number}}}).data.issue;

    const updated = await invoke(
      'PATCH', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}`,
      headers('member', 'http-update-issue-key-0001'),
      JSON.stringify({ expectedRevision: assignedIssue.revision, status: 'in_progress' }),
    );
    expect(updated.status).toBe(200);

    const commented = await invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}/comments`,
      headers('member', 'http-create-comment-key-0001'),
      JSON.stringify({ body: 'The hosted task is underway.' }),
    );
    expect(commented.status).toBe(201);
    const comments = await invoke(
      'GET', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}/comments`,
      headers('owner'),
    );
    expect(comments.status).toBe(200);
    expect(comments.body).toMatchObject({ data: { comments: [
      { authorUserId: member.uid, body: 'The hosted task is underway.', revision: 1 },
    ] } });
    const activity = await invoke(
      'GET', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}/activity`,
      headers('owner'),
    );
    expect(activity.status).toBe(200);
    expect(activity.body).toMatchObject({data: {activity: [
      {action: 'issue.created', actorUserId: owner.uid},
      {action: 'issue.assigned', actorUserId: owner.uid},
      {action: 'issue.status.changed', actorUserId: member.uid},
      {action: 'comment.created', actorUserId: member.uid},
    ]}});
  });

  it('returns bounded redacted errors for stale revisions, invalid bodies, and missing identity', async () => {
    const { invoke } = fixture();
    const created = await invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/issues`,
      headers('owner', 'http-create-conflict-key-0001'), JSON.stringify({ title: 'Conflict task' }),
    );
    const issue = (created.body as {data: {issue: {id: string}}}).data.issue;
    const stale = await invoke(
      'PATCH', `/api/v1/hosted/workspaces/${workspaceId}/issues/${issue.id}`,
      headers('owner', 'http-stale-conflict-key-0001'),
      JSON.stringify({ expectedRevision: 99, title: 'Attacker private stale title' }),
    );
    const injected = await invoke(
      'POST', `/api/v1/hosted/workspaces/${workspaceId}/issues`,
      headers('owner', 'http-injected-body-key-0001'),
      JSON.stringify({ title: 'Valid', agentPrompt: 'excluded' }),
    );
    const missing = await invoke('GET', `/api/v1/hosted/workspaces/${workspaceId}/issues`);
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: { code: 'COLLABORATION_CONFLICT' } });
    expect(JSON.stringify(stale.body)).not.toContain('Attacker private stale title');
    expect(injected.status).toBe(400);
    expect(missing.status).toBe(401);
    expect(stale.headers['cache-control']).toBe('no-store');
  });

  it('lists only the active assignment roster through the trusted API', async () => {
    const { invoke } = fixture();
    const response = await invoke(
      'GET', `/api/v1/hosted/workspaces/${workspaceId}/members`, headers('member'),
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { members: [
      { userId: member.uid, role: 'member', displayName: null },
      { userId: owner.uid, role: 'owner', displayName: null },
    ] } });
    expect(JSON.stringify(response.body)).not.toContain('@example.com');
  });
});
