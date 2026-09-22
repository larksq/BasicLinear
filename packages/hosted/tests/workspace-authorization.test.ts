import { describe, expect, it } from 'vitest';
import {
  actionsForWorkspaceRole,
  FirestoreWorkspaceAuthorizationEvidenceWriter,
  FirestoreWorkspaceMembershipReader,
  MemoryWorkspaceAuthorizationEvidenceWriter,
  MemoryWorkspaceMembershipReader,
  WorkspaceAuthorizationError,
  WorkspaceAuthorizationService,
  workspaceActions,
  type FirestoreAuthorizationBatchLike,
  type FirestoreAuthorizationDocumentReferenceLike,
  type FirestoreAuthorizationLike,
  type WorkspaceAction,
  type WorkspaceAuthorizationRequest,
  type WorkspaceMembershipRecord,
  type WorkspacePrincipal,
} from '../src/index.js';

const workspaceAlpha = 'ws_alpha';
const workspaceBeta = 'ws_beta';
const ownerId = 'firebase-owner';
const memberId = 'firebase-member';

const membership = (
  userId: string,
  role: WorkspaceMembershipRecord['role'],
  status: WorkspaceMembershipRecord['status'] = 'active',
  workspaceId = workspaceAlpha,
): WorkspaceMembershipRecord => ({
  schemaVersion: 1,
  workspaceId,
  userId,
  role,
  status,
  revision: 1,
});

const ids = () => {
  let value = 0;
  return () => `00000000-0000-4000-8000-${String(++value).padStart(12, '0')}`;
};

const request = (
  principal: WorkspacePrincipal,
  action: WorkspaceAction,
  sequence: number,
  workspaceId = workspaceAlpha,
) => ({
  principal,
  workspaceId,
  action,
  targetEntityType: action.split('.')[0] ?? 'workspace',
  targetEntityId: `target:${sequence}`,
  requestId: `request:authorization:${sequence}`,
});

const owner: WorkspacePrincipal = { kind: 'user', userId: ownerId, source: 'web' };
const member: WorkspacePrincipal = { kind: 'user', userId: memberId, source: 'web' };

describe('workspace authorization', () => {
  it('implements the complete owner/member action matrix with exactly two roles', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(ownerId, 'owner'));
    memberships.set(membership(memberId, 'member'));
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });

    expect(actionsForWorkspaceRole('owner')).toEqual(workspaceActions);
    expect(actionsForWorkspaceRole('member')).toEqual([
      'workspace.read', 'membership.list', 'project.read', 'project.write',
      'milestone.read', 'milestone.write', 'issue.read', 'issue.write',
      'comment.read', 'comment.write', 'automation.execute',
    ]);

    let sequence = 0;
    for (const action of workspaceActions) {
      const ownerGrant = await service.authorize(request(owner, action, ++sequence));
      expect(ownerGrant.role).toBe('owner');
      if (actionsForWorkspaceRole('member').includes(action)) {
        const memberGrant = await service.authorize(request(member, action, ++sequence));
        expect(memberGrant.role).toBe('member');
      } else {
        await expect(service.authorize(request(member, action, ++sequence)))
          .rejects.toMatchObject({
            code: 'WORKSPACE_ACCESS_DENIED',
            reason: 'role_forbidden',
          } satisfies Partial<WorkspaceAuthorizationError>);
      }
    }

    expect(evidence.records).toHaveLength(sequence);
    expect(evidence.records.every((entry) => (
      entry.event.attributes.operationSucceeded === false
      && entry.event.attributes.protectedReadDisclosed === false
      && entry.event.attributes.protectedStateChanged === false
    ))).toBe(true);
  });

  it('denies removed, unrelated, malformed-role, foreign-workspace, and token-scope callers safely', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(memberId, 'member', 'removed'));
    memberships.setRaw(workspaceAlpha, 'custom-role-user', {
      schemaVersion: 1,
      workspaceId: workspaceAlpha,
      userId: 'custom-role-user',
      role: 'admin',
      status: 'active',
      revision: 1,
    });
    memberships.setRaw(workspaceAlpha, 'extra-field-user', {
      schemaVersion: 1,
      workspaceId: workspaceAlpha,
      userId: 'extra-field-user',
      role: 'member',
      status: 'active',
      revision: 1,
      privateSecret: 'must-not-authorize',
    });
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });
    const cases: Array<{principal: WorkspacePrincipal; workspaceId?: string; reason: string}> = [
      { principal: member, reason: 'membership_inactive' },
      { principal: { kind: 'user', userId: 'unrelated-user', source: 'web' }, reason: 'membership_missing' },
      { principal: { kind: 'user', userId: 'custom-role-user', source: 'web' }, reason: 'membership_invalid' },
      { principal: { kind: 'user', userId: 'extra-field-user', source: 'web' }, reason: 'membership_invalid' },
      { principal: owner, workspaceId: workspaceBeta, reason: 'membership_missing' },
      {
        principal: {
          kind: 'personal_token',
          userId: ownerId,
          tokenReference: 'tokref_0123456789abcdef0123456789abcdef',
          credentialWorkspaceId: workspaceAlpha,
          source: 'rest',
        },
        workspaceId: workspaceBeta,
        reason: 'credential_workspace_mismatch',
      },
    ];

    let sequence = 100;
    for (const item of cases) {
      await expect(service.authorize(request(
        item.principal,
        'workspace.read',
        ++sequence,
        item.workspaceId ?? workspaceAlpha,
      ))).rejects.toMatchObject({
        code: 'WORKSPACE_ACCESS_DENIED',
        reason: item.reason,
      });
    }
    expect(evidence.records).toHaveLength(cases.length);
    expect(evidence.records.every((entry) => entry.audit.result === 'denied')).toBe(true);
    const serialized = JSON.stringify(evidence.records);
    expect(serialized).not.toContain('rawToken');
    expect(serialized).not.toContain('comment body');
  });

  it('rejects undeclared runtime actions for both roles and records only a safe operation label', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(ownerId, 'owner'));
    memberships.set(membership(memberId, 'member'));
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });

    for (const [sequence, principal] of [[501, owner], [502, member]] as const) {
      const malformed = {
        ...request(principal, 'workspace.read', sequence),
        action: 'workspace.destroy',
      } as unknown as WorkspaceAuthorizationRequest;
      await expect(service.authorize(malformed)).rejects.toMatchObject({
        code: 'WORKSPACE_ACCESS_DENIED',
        reason: 'action_unsupported',
      });
    }

    expect(evidence.records).toHaveLength(2);
    expect(evidence.records.every((entry) => (
      entry.denialReason === 'action_unsupported'
      && entry.event.attributes.operation === 'unsupported'
      && entry.event.attributes.authorized === false
      && entry.audit.action === 'authorization.unsupported'
      && entry.audit.result === 'denied'
    ))).toBe(true);
    expect(JSON.stringify(evidence.records)).not.toContain('workspace.destroy');
  });

  it('accepts only server-generated opaque token references and never persists rejected input', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(ownerId, 'owner'));
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });
    const rejectedReferences = [
      'owner@example.com',
      'opl_live_7H4K9M2P8Q6R5T3V1W0X',
      'tokref_0123456789ABCDEF0123456789ABCDEF',
      'tokref_short',
    ];

    let sequence = 600;
    for (const tokenReference of rejectedReferences) {
      const principal: WorkspacePrincipal = {
        kind: 'personal_token',
        userId: ownerId,
        tokenReference,
        credentialWorkspaceId: workspaceAlpha,
        source: 'rest',
      };
      await expect(service.authorize(request(principal, 'workspace.read', ++sequence)))
        .rejects.toMatchObject({
          code: 'WORKSPACE_ACCESS_DENIED',
          reason: 'principal_reference_invalid',
        });
    }

    const validReference = 'tokref_0123456789abcdef0123456789abcdef';
    await expect(service.authorize(request({
      kind: 'personal_token',
      userId: ownerId,
      tokenReference: validReference,
      credentialWorkspaceId: workspaceAlpha,
      source: 'mcp',
    }, 'workspace.read', ++sequence))).resolves.toMatchObject({ role: 'owner' });

    const serialized = JSON.stringify(evidence.records);
    for (const rejectedReference of rejectedReferences) {
      expect(serialized).not.toContain(rejectedReference);
    }
    expect(evidence.records.slice(0, rejectedReferences.length).every((entry) => (
      entry.event.actor.id === 'patref:invalid'
      && entry.audit.actor.id === 'patref:invalid'
      && entry.event.attributes.authorized === false
    ))).toBe(true);
    expect(evidence.records.at(-1)?.event.actor.id).toBe(`patref:${validReference}`);
  });

  it('rechecks membership per request so the same stale credential fails immediately after removal', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(memberId, 'member'));
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });

    await expect(service.authorize(request(member, 'issue.write', 201))).resolves.toMatchObject({
      role: 'member',
    });
    memberships.set(membership(memberId, 'member', 'removed'));
    await expect(service.authorize(request(member, 'issue.write', 202))).rejects.toMatchObject({
      code: 'WORKSPACE_ACCESS_DENIED',
      reason: 'membership_inactive',
    });

    expect(memberships.reads).toBe(2);
    expect(evidence.records[1]).toMatchObject({
      denialReason: 'membership_inactive',
      event: { attributes: { authorized: false, protectedStateChanged: false } },
      audit: { result: 'denied', changes: [] },
    });
  });

  it('fails closed when privacy-safe evidence cannot be recorded', async () => {
    const memberships = new MemoryWorkspaceMembershipReader();
    memberships.set(membership(ownerId, 'owner'));
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    evidence.fail = true;
    const service = new WorkspaceAuthorizationService(memberships, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });
    await expect(service.authorize(request(owner, 'workspace.read', 301))).rejects.toMatchObject({
      code: 'AUTHORIZATION_EVIDENCE_UNAVAILABLE',
      reason: 'evidence_unavailable',
    });
  });

  it('classifies a membership-store outage as unavailable after privacy-safe evidence', async () => {
    const evidence = new MemoryWorkspaceAuthorizationEvidenceWriter();
    const service = new WorkspaceAuthorizationService({
      readMembership: async () => { throw new Error('private Firestore outage detail'); },
    }, evidence, {
      clock: () => new Date('2026-12-01T00:00:00.000Z'),
      idFactory: ids(),
    });

    await expect(service.authorize(request(owner, 'workspace.read', 701))).rejects.toMatchObject({
      code: 'AUTHORIZATION_UNAVAILABLE',
      reason: 'membership_lookup_unavailable',
    });
    expect(evidence.records).toHaveLength(1);
    expect(evidence.records[0]).toMatchObject({
      denialReason: 'membership_lookup_unavailable',
      event: { attributes: { authorized: false } },
      audit: { result: 'denied' },
    });
    expect(JSON.stringify(evidence.records)).not.toContain('private Firestore outage detail');
  });
});

class TestAuthorizationFirestore implements FirestoreAuthorizationLike {
  readonly documents = new Map<string, unknown>();
  readonly created: Array<{path: string; data: Record<string, unknown>}> = [];
  commits = 0;

  doc(path: string): FirestoreAuthorizationDocumentReferenceLike {
    return {
      path,
      get: async () => {
        const value = this.documents.get(path);
        return { exists: value !== undefined, data: () => structuredClone(value) };
      },
    };
  }

  batch(): FirestoreAuthorizationBatchLike {
    return {
      create: (reference, data) => {
        this.created.push({ path: reference.path, data: structuredClone(data) });
      },
      commit: async () => {
        this.commits += 1;
      },
    };
  }
}

describe('Firestore workspace authorization adapters', () => {
  it('reads the exact membership path and atomically writes workspace-scoped event/audit evidence', async () => {
    const firestore = new TestAuthorizationFirestore();
    firestore.documents.set(
      `workspaces/${workspaceAlpha}/memberships/${ownerId}`,
      membership(ownerId, 'owner'),
    );
    const service = new WorkspaceAuthorizationService(
      new FirestoreWorkspaceMembershipReader(firestore),
      new FirestoreWorkspaceAuthorizationEvidenceWriter(firestore),
      {
        clock: () => new Date('2026-12-01T00:00:00.000Z'),
        idFactory: () => '00000000-0000-4000-8000-000000000001',
      },
    );

    await expect(service.authorize(request(owner, 'billing.manage', 401))).resolves.toMatchObject({
      workspaceId: workspaceAlpha,
      role: 'owner',
    });
    expect(firestore.commits).toBe(1);
    expect(firestore.created.map((entry) => entry.path)).toEqual([
      expect.stringMatching(`^workspaces/${workspaceAlpha}/authorizationEvents/event:authorization:`),
      expect.stringMatching(`^workspaces/${workspaceAlpha}/authorizationAudits/audit:authorization:`),
    ]);
    expect(firestore.created[1]?.data).toMatchObject({
      workspaceId: workspaceAlpha,
      result: 'succeeded',
      denialReason: null,
    });
  });
});
