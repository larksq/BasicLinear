import { describe, expect, it } from 'vitest';
import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  buildHostedOutcomeReport,
  deduplicateHostedEvents,
  HostedMeasurementError,
  hostedMeasurementSchemaVersion,
  type HostedEventAttributes,
  type HostedEventName,
  type HostedEconomicsRecord,
  type HostedMutationAuditRecord,
  type HostedProductEvent,
} from '../src/index.js';

interface EventOptions {
  id?: string;
  source?: HostedProductEvent['source'];
  workspaceId?: string;
  actorId?: string;
  actorKind?: HostedProductEvent['actor']['kind'];
  requestId?: string;
  correlationId?: string;
  receivedAt?: string;
}

interface AuditOptions {
  id: string;
  workspaceId?: string;
  actorId?: string;
  actorKind?: HostedMutationAuditRecord['actor']['kind'];
  source?: HostedMutationAuditRecord['source'];
  action: string;
  result: HostedMutationAuditRecord['result'];
  requestId?: string;
  entityType?: string;
  entityId: string;
  occurredAt: string;
}

function event<Name extends HostedEventName>(
  name: Name,
  occurredAt: string,
  attributes: HostedEventAttributes[Name],
  options: EventOptions = {},
): Extract<HostedProductEvent, { name: Name }> {
  const id = options.id ?? `evt:${name}:${occurredAt}`;
  return {
    schemaVersion: hostedMeasurementSchemaVersion,
    id,
    name,
    source: options.source ?? 'web',
    occurredAt,
    receivedAt: options.receivedAt ?? occurredAt,
    workspaceId: options.workspaceId ?? 'workspace:alpha',
    actor: { kind: options.actorKind ?? 'user', id: options.actorId ?? 'user:owner' },
    requestId: options.requestId ?? `request:${id}`,
    correlationId: options.correlationId ?? 'journey:alpha',
    attributes,
  } as Extract<HostedProductEvent, { name: Name }>;
}

function mutationAudit(options: AuditOptions): HostedMutationAuditRecord {
  return {
    schemaVersion: hostedMeasurementSchemaVersion,
    id: options.id,
    workspaceId: options.workspaceId ?? 'workspace:alpha',
    actor: {
      kind: options.actorKind ?? 'user',
      id: options.actorId ?? 'user:owner',
    },
    source: options.source ?? 'web',
    occurredAt: options.occurredAt,
    requestId: options.requestId ?? `request:${options.id}`,
    entity: {
      type: options.entityType ?? 'measurement_subject',
      id: options.entityId,
      revisionBefore: null,
      revisionAfter: options.result === 'succeeded' ? 1 : null,
    },
    action: options.action,
    result: options.result,
    changes: [],
  };
}

const audit: HostedMutationAuditRecord = {
  schemaVersion: hostedMeasurementSchemaVersion,
  id: 'audit:001',
  workspaceId: 'workspace:alpha',
  actor: { kind: 'user', id: 'user:owner' },
  source: 'web',
  occurredAt: '2026-11-05T00:04:00.000Z',
  requestId: 'request:001',
  entity: {
    type: 'issue',
    id: 'issue:001',
    revisionBefore: null,
    revisionAfter: 1,
  },
  action: 'issue.create',
  result: 'succeeded',
  changes: [{ field: 'title', beforeSha256: null, afterSha256: 'a'.repeat(64) }],
};

function syntheticReport(
  events: readonly HostedProductEvent[],
  audits: readonly HostedMutationAuditRecord[] = [],
  economics: readonly HostedEconomicsRecord[] = [],
) {
  return buildHostedOutcomeReport({
    generatedAt: '2027-02-08T00:00:00.000Z',
    completenessWatermark: null,
    evidenceClass: 'synthetic_fixture',
    events,
    audits,
    economics,
  });
}

describe('hosted measurement contract', () => {
  it('rejects raw credentials, comment bodies, and unknown payload fields', () => {
    const leakedEvent = {
      ...event('owner.google_sign_in.completed', '2026-11-05T00:00:00.000Z', { eligible: true }),
      attributes: { eligible: true, rawToken: 'secret' },
    };
    expect(() => assertHostedProductEvent(leakedEvent)).toThrowError(HostedMeasurementError);

    const leakedAudit = {
      ...audit,
      changes: [{
        field: 'comment.body',
        beforeSha256: null,
        afterSha256: 'b'.repeat(64),
        commentBody: 'private text',
      }],
    };
    expect(() => assertHostedMutationAuditRecord(leakedAudit)).toThrowError(HostedMeasurementError);

    const leakedActor = event(
      'automation.task.completed',
      '2026-10-05T00:00:00.000Z',
      {
        runId: 'run:001',
        taskId: 'issue.create',
        surface: 'rest',
        role: 'owner',
        environment: 'uat',
        succeeded: true,
      },
      { source: 'rest', actorKind: 'personal_token', actorId: 'sk_live_rawCredentialExample123' },
    );
    expect(() => assertHostedProductEvent(leakedActor)).toThrowError(/reference, never a credential/u);

    const leakedCorrelation = event(
      'owner.google_sign_in.completed',
      '2026-11-05T00:00:00.000Z',
      { eligible: true },
      { correlationId: 'journey:sk_live_rawCredentialExample123' },
    );
    expect(() => assertHostedProductEvent(leakedCorrelation)).toThrowError(/never a credential/u);

    const inconsistentStripe = event(
      'subscription.activated',
      '2026-12-15T00:00:00.000Z',
      { plan: 'monthly', activeSeats: 1, amountMicrousd: 2_000_000 },
      { source: 'stripe', actorKind: 'user', actorId: 'user:owner' },
    );
    expect(() => assertHostedProductEvent(inconsistentStripe)).toThrowError(/source and actor kind/u);
  });

  it('requires an exact 30-day trial window', () => {
    const valid = event(
      'workspace.bootstrap.completed',
      '2026-11-05T00:00:01.000Z',
      {
        trialStartedAt: '2026-11-05T00:00:01.000Z',
        trialEndsAt: '2026-12-05T00:00:01.000Z',
      },
    );
    expect(() => assertHostedProductEvent(valid)).not.toThrow();

    const invalid = {
      ...valid,
      attributes: { ...valid.attributes, trialEndsAt: '2026-12-04T00:00:01.000Z' },
    };
    expect(() => assertHostedProductEvent(invalid)).toThrowError(/exactly 30 consecutive days/u);
  });

  it('deduplicates retries and rejects a conflicting event identity', () => {
    const original = event(
      'project.created',
      '2026-11-05T00:03:00.000Z',
      { projectId: 'project:001' },
      { id: 'evt:retry' },
    );
    expect(deduplicateHostedEvents([original, structuredClone(original)])).toHaveLength(1);
    const conflict = { ...original, attributes: { projectId: 'project:002' } };
    expect(() => deduplicateHostedEvents([original, conflict])).toThrowError(/conflicting payloads/u);
  });
});

describe('hosted outcome reporting fixture', () => {
  it('reproduces O-201 through O-204 and G-201 through G-204 without claiming outcomes', () => {
    const events: HostedProductEvent[] = [
      event('owner.google_sign_in.completed', '2026-11-05T00:00:00.000Z', { eligible: true }, { id: 'evt:signin:1' }),
      event('workspace.bootstrap.completed', '2026-11-05T00:01:00.000Z', {
        trialStartedAt: '2026-11-05T00:01:00.000Z',
        trialEndsAt: '2026-12-05T00:01:00.000Z',
      }, { id: 'evt:bootstrap:1' }),
      event('project.created', '2026-11-05T00:03:00.000Z', { projectId: 'project:001' }, { id: 'evt:project:1' }),
      event('issue.created', '2026-11-05T00:04:00.000Z', { issueId: 'issue:001' }, { id: 'evt:issue:1' }),
      event('owner.google_sign_in.completed', '2026-11-06T00:00:00.000Z', { eligible: true }, {
        id: 'evt:signin:2', workspaceId: 'workspace:beta', actorId: 'user:owner-beta', correlationId: 'journey:beta',
      }),
      event('workspace.bootstrap.failed', '2026-11-06T00:00:05.000Z', {
        attemptId: 'attempt:beta:1', reasonCode: 'bootstrap_unrecoverable', disposition: 'terminal',
      }, {
        id: 'evt:bootstrap:failed', workspaceId: 'workspace:beta', actorId: 'user:owner-beta', correlationId: 'journey:beta',
      }),
      event('invitation.sent', '2026-11-07T00:00:00.000Z', {
        invitationId: 'invite:001',
        eligibleTrialWorkspace: true,
        auditId: 'audit:invite:001',
      }, { id: 'evt:invite:1' }),
      event('membership.accepted', '2026-11-08T00:00:00.000Z', {
        invitationId: 'invite:001',
        memberUserId: 'user:member',
        emailMatched: true,
        validInvitation: true,
        firstAcceptance: true,
        auditId: 'audit:accept:001',
      }, { id: 'evt:accept:1', actorId: 'user:member', correlationId: 'invite:001' }),
      event('issue.assigned', '2026-11-09T00:00:00.000Z', {
        issueId: 'issue:001', assigneeUserId: 'user:member', actorRole: 'owner',
      }, { id: 'evt:assign:1', actorId: 'user:owner', correlationId: 'invite:001' }),
      event('issue.member_action.completed', '2026-11-09T00:01:00.000Z', {
        issueId: 'issue:001', memberUserId: 'user:member', action: 'status_changed',
      }, { id: 'evt:member-action:1', actorId: 'user:member', correlationId: 'invite:001' }),
      event('comment.created', '2026-11-09T00:02:00.000Z', {
        issueId: 'issue:001', authorUserId: 'user:member', actorRole: 'member',
      }, { id: 'evt:comment:1', actorId: 'user:member', correlationId: 'invite:001' }),
      event('membership.accepted', '2026-11-10T00:00:00.000Z', {
        invitationId: 'invite:replay',
        memberUserId: 'user:attacker',
        emailMatched: false,
        validInvitation: false,
        firstAcceptance: false,
        auditId: 'audit:accept:invalid',
      }, { id: 'evt:accept:invalid', workspaceId: 'workspace:beta', actorId: 'user:attacker', correlationId: 'invite:replay' }),
      event('trial.ended', '2026-12-10T00:00:00.000Z', { eligible: true }, {
        id: 'evt:trial:1', source: 'system', actorKind: 'system', actorId: 'system:entitlement',
      }),
      event('subscription.activated', '2026-12-15T00:00:00.000Z', {
        plan: 'monthly', activeSeats: 2, amountMicrousd: 4_000_000,
      }, { id: 'evt:subscription:1', source: 'stripe', actorKind: 'stripe', actorId: 'stripe:event:001' }),
      event('automation.task.completed', '2026-10-05T00:00:00.000Z', {
        runId: 'run:001', taskId: 'issue.create', surface: 'rest', role: 'owner', environment: 'uat', succeeded: true,
      }, { id: 'evt:automation:rest', source: 'rest', actorKind: 'personal_token', actorId: 'patref:001' }),
      event('automation.task.completed', '2026-10-05T00:01:00.000Z', {
        runId: 'run:001', taskId: 'issue.create', surface: 'mcp', role: 'owner', environment: 'uat', succeeded: false,
      }, { id: 'evt:automation:mcp', source: 'mcp', actorKind: 'personal_token', actorId: 'patref:001' }),
      event('authorization.checked', '2026-10-05T00:02:00.000Z', {
        operation: 'issue.create',
        principalWorkspaceId: 'workspace:beta',
        targetWorkspaceId: 'workspace:alpha',
        targetEntityType: 'issue',
        targetEntityId: 'issue:foreign',
        authorized: false,
        operationSucceeded: true,
        protectedReadDisclosed: false,
        protectedStateChanged: true,
        auditId: 'audit:authorization:1',
      }, { id: 'evt:authorization:1', source: 'rest', actorKind: 'personal_token', actorId: 'patref:attacker' }),
    ];
    const report = buildHostedOutcomeReport({
      generatedAt: '2027-02-08T00:00:00.000Z',
      completenessWatermark: null,
      evidenceClass: 'synthetic_fixture',
      events: [...events, structuredClone(events[0]!)],
      audits: [
        audit,
        structuredClone(audit),
        mutationAudit({
          id: 'audit:invite:001', action: 'invitation.send', result: 'succeeded',
          requestId: 'request:evt:invite:1', entityType: 'invitation', entityId: 'invite:001',
          occurredAt: '2026-11-07T00:00:00.000Z',
        }),
        mutationAudit({
          id: 'audit:accept:001', actorId: 'user:member', action: 'membership.accept', result: 'succeeded',
          requestId: 'request:evt:accept:1', entityType: 'invitation', entityId: 'invite:001',
          occurredAt: '2026-11-08T00:00:00.000Z',
        }),
        mutationAudit({
          id: 'audit:accept:invalid', workspaceId: 'workspace:beta', actorId: 'user:attacker',
          action: 'membership.accept', result: 'denied', requestId: 'request:evt:accept:invalid',
          entityType: 'invitation', entityId: 'invite:replay',
          occurredAt: '2026-11-10T00:00:00.000Z',
        }),
        mutationAudit({
          id: 'audit:authorization:1', actorKind: 'personal_token', actorId: 'patref:attacker',
          source: 'rest', action: 'issue.create', result: 'succeeded',
          requestId: 'request:evt:authorization:1', entityType: 'issue', entityId: 'issue:foreign',
          occurredAt: '2026-10-05T00:02:00.000Z',
        }),
      ],
      economics: [
        {
          schemaVersion: hostedMeasurementSchemaVersion,
          id: 'economics:firebase:001',
          workspaceId: 'workspace:alpha',
          provider: 'firebase',
          kind: 'variable_cost',
          category: 'firestore_and_compute',
          periodStart: '2026-12-01T00:00:00.000Z',
          periodEnd: '2027-01-01T00:00:00.000Z',
          amountMicrousd: 3_000,
          activePaidSeats: 2,
          sourceRef: 'firebase:billing-export:2026-12',
          retrievedAt: '2027-01-02T00:00:00.000Z',
        },
        {
          schemaVersion: hostedMeasurementSchemaVersion,
          id: 'economics:stripe:cost:001',
          workspaceId: 'workspace:alpha',
          provider: 'stripe',
          kind: 'variable_cost',
          category: 'payment_fee',
          periodStart: '2026-12-01T00:00:00.000Z',
          periodEnd: '2027-01-01T00:00:00.000Z',
          amountMicrousd: 2_000,
          activePaidSeats: 2,
          sourceRef: 'stripe:balance:2026-12',
          retrievedAt: '2027-01-02T00:00:00.000Z',
        },
        {
          schemaVersion: hostedMeasurementSchemaVersion,
          id: 'economics:stripe:revenue:001',
          workspaceId: 'workspace:alpha',
          provider: 'stripe',
          kind: 'recognized_revenue',
          category: 'subscription_revenue',
          periodStart: '2026-12-01T00:00:00.000Z',
          periodEnd: '2027-01-01T00:00:00.000Z',
          amountMicrousd: 20_000,
          activePaidSeats: 2,
          sourceRef: 'stripe:revenue:2026-12',
          retrievedAt: '2027-01-02T00:00:00.000Z',
        },
      ],
    });

    expect(report.claimBoundary).toBe('measurement_only_no_outcome_claim');
    expect(report.provenance).toMatchObject({
      completenessWatermark: null,
      eventCount: 17,
      auditCount: 5,
      economicsRecordCount: 3,
    });
    expect(report.outcomes).toEqual([
      expect.objectContaining({ id: 'O-201', status: 'fixture_only', numerator: 1, denominator: 2, value: 50 }),
      expect.objectContaining({ id: 'O-202', status: 'fixture_only', numerator: 1, denominator: 1, value: 100 }),
      expect.objectContaining({ id: 'O-203', status: 'fixture_only', numerator: 1, denominator: 1, value: 100 }),
      expect.objectContaining({ id: 'O-204', status: 'fixture_only', numerator: 1, denominator: 2, value: 50 }),
    ]);
    expect(report.guardrails).toEqual([
      expect.objectContaining({ id: 'G-201', numerator: 1, denominator: 2, value: 50 }),
      expect.objectContaining({ id: 'G-202', numerator: 1, denominator: 2, value: 50 }),
      expect.objectContaining({ id: 'G-203', numerator: 5_000, denominator: 20_000, value: 25 }),
      expect.objectContaining({ id: 'G-204', numerator: 1, denominator: null, value: 1 }),
    ]);
  });

  it('keeps an empty production cohort baseline-needed', () => {
    const report = buildHostedOutcomeReport({
      generatedAt: '2027-02-08T00:00:00.000Z',
      completenessWatermark: '2027-02-08T00:00:00.000Z',
      evidenceClass: 'production_baseline',
      events: [],
      audits: [],
      economics: [],
    });
    expect(report.outcomes.every((item) => item.status === 'baseline_needed')).toBe(true);
    expect(report.outcomes.every((item) => item.value === null)).toBe(true);
  });

  it('requires the accepted member to act and comment on the assigned issue in sequence', () => {
    const invite = event('invitation.sent', '2026-11-07T00:00:00.000Z', {
      invitationId: 'invite:adversarial',
      eligibleTrialWorkspace: true,
      auditId: 'audit:invite:adversarial',
    }, { id: 'evt:invite:adversarial' });
    const acceptance = event('membership.accepted', '2026-11-08T00:00:00.000Z', {
      invitationId: 'invite:adversarial',
      memberUserId: 'user:member',
      emailMatched: true,
      validInvitation: true,
      firstAcceptance: true,
      auditId: 'audit:accept:adversarial',
    }, { id: 'evt:accept:adversarial', actorId: 'user:member' });
    const report = syntheticReport([
      invite,
      event('issue.assigned', '2026-11-07T12:00:00.000Z', {
        issueId: 'issue:assigned', assigneeUserId: 'user:someone-else', actorRole: 'owner',
      }, { id: 'evt:assign:adversarial' }),
      acceptance,
      event('issue.member_action.completed', '2026-11-08T01:00:00.000Z', {
        issueId: 'issue:different', memberUserId: 'user:member', action: 'status_changed',
      }, { id: 'evt:action:adversarial', actorId: 'user:member' }),
      event('comment.created', '2026-11-08T02:00:00.000Z', {
        issueId: 'issue:another', authorUserId: 'user:member', actorRole: 'member',
      }, { id: 'evt:comment:adversarial', actorId: 'user:member' }),
    ], [
      mutationAudit({
        id: 'audit:invite:adversarial', action: 'invitation.send', result: 'succeeded',
        requestId: invite.requestId, entityType: 'invitation',
        entityId: 'invite:adversarial', occurredAt: invite.occurredAt,
      }),
      mutationAudit({
        id: 'audit:accept:adversarial', actorId: 'user:member', action: 'membership.accept',
        result: 'succeeded', requestId: acceptance.requestId, entityType: 'invitation',
        entityId: 'invite:adversarial', occurredAt: acceptance.occurredAt,
      }),
    ]);
    expect(report.outcomes.find((item) => item.id === 'O-202')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
  });

  it('finds a complete O-202 chain after an earlier unused assignment', () => {
    const invite = event('invitation.sent', '2026-11-07T00:00:00.000Z', {
      invitationId: 'invite:complete-chain', eligibleTrialWorkspace: true, auditId: 'audit:invite:complete-chain',
    }, { id: 'evt:invite:complete-chain' });
    const acceptance = event('membership.accepted', '2026-11-08T00:00:00.000Z', {
      invitationId: 'invite:complete-chain', memberUserId: 'user:member', emailMatched: true,
      validInvitation: true, firstAcceptance: true, auditId: 'audit:accept:complete-chain',
    }, { id: 'evt:accept:complete-chain', actorId: 'user:member' });
    const report = syntheticReport([
      invite,
      acceptance,
      event('issue.assigned', '2026-11-08T01:00:00.000Z', {
        issueId: 'issue:unused', assigneeUserId: 'user:member', actorRole: 'owner',
      }, { id: 'evt:assign:a' }),
      event('issue.assigned', '2026-11-08T02:00:00.000Z', {
        issueId: 'issue:complete', assigneeUserId: 'user:member', actorRole: 'owner',
      }, { id: 'evt:assign:z' }),
      event('issue.member_action.completed', '2026-11-08T03:00:00.000Z', {
        issueId: 'issue:complete', memberUserId: 'user:member', action: 'status_changed',
      }, { id: 'evt:action:complete', actorId: 'user:member' }),
      event('comment.created', '2026-11-08T04:00:00.000Z', {
        issueId: 'issue:complete', authorUserId: 'user:member', actorRole: 'member',
      }, { id: 'evt:comment:complete', actorId: 'user:member' }),
    ], [
      mutationAudit({
        id: 'audit:invite:complete-chain', requestId: invite.requestId, entityType: 'invitation',
        entityId: 'invite:complete-chain', action: 'invitation.send', result: 'succeeded',
        occurredAt: invite.occurredAt,
      }),
      mutationAudit({
        id: 'audit:accept:complete-chain', requestId: acceptance.requestId, entityType: 'invitation',
        entityId: 'invite:complete-chain', actorId: 'user:member', action: 'membership.accept',
        result: 'succeeded', occurredAt: acceptance.occurredAt,
      }),
    ]);
    expect(report.outcomes.find((item) => item.id === 'O-202')).toMatchObject({
      numerator: 1,
      denominator: 1,
      value: 100,
    });
  });

  it('reconciles G-202 against every invitation while keeping one workspace denominator', () => {
    const firstInvite = event('invitation.sent', '2026-11-07T00:00:00.000Z', {
      invitationId: 'invite:first', eligibleTrialWorkspace: true, auditId: 'audit:invite:first',
    }, { id: 'evt:invite:first' });
    const secondInvite = event('invitation.sent', '2026-11-08T00:00:00.000Z', {
      invitationId: 'invite:second', eligibleTrialWorkspace: true, auditId: 'audit:invite:second',
    }, { id: 'evt:invite:second' });
    const acceptance = event('membership.accepted', '2026-11-09T00:00:00.000Z', {
      invitationId: 'invite:second', memberUserId: 'user:second-member', emailMatched: true,
      validInvitation: true, firstAcceptance: true, auditId: 'audit:accept:second',
    }, { id: 'evt:accept:second', actorId: 'user:second-member' });
    const report = syntheticReport([firstInvite, secondInvite, acceptance], [
      mutationAudit({
        id: 'audit:invite:first', requestId: firstInvite.requestId, entityType: 'invitation',
        entityId: 'invite:first', action: 'invitation.send', result: 'succeeded', occurredAt: firstInvite.occurredAt,
      }),
      mutationAudit({
        id: 'audit:invite:second', requestId: secondInvite.requestId, entityType: 'invitation',
        entityId: 'invite:second', action: 'invitation.send', result: 'succeeded', occurredAt: secondInvite.occurredAt,
      }),
      mutationAudit({
        id: 'audit:accept:second', requestId: acceptance.requestId, entityType: 'invitation',
        entityId: 'invite:second', actorId: 'user:second-member', action: 'membership.accept',
        result: 'succeeded', occurredAt: acceptance.occurredAt,
      }),
    ]);
    expect(report.outcomes.find((item) => item.id === 'O-202')?.denominator).toBe(1);
    expect(report.guardrails.find((item) => item.id === 'G-202')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
  });

  it('reconciles a valid acceptance to the applicable resend instead of the original send', () => {
    const original = event('invitation.sent', '2026-11-01T00:00:00.000Z', {
      invitationId: 'invite:resent-late', eligibleTrialWorkspace: true, auditId: 'audit:invite:original',
    }, { id: 'evt:invite:a-original' });
    const resend = event('invitation.sent', '2026-11-09T00:00:00.000Z', {
      invitationId: 'invite:resent-late', eligibleTrialWorkspace: true, auditId: 'audit:invite:resend',
    }, { id: 'evt:invite:z-resend' });
    const acceptance = event('membership.accepted', '2026-11-09T01:00:00.000Z', {
      invitationId: 'invite:resent-late', memberUserId: 'user:resent-member', emailMatched: true,
      validInvitation: true, firstAcceptance: true, auditId: 'audit:accept:resent-late',
    }, { id: 'evt:accept:resent-late', actorId: 'user:resent-member' });
    const report = syntheticReport([original, resend, acceptance], [
      mutationAudit({
        id: 'audit:invite:original', requestId: original.requestId, entityType: 'invitation',
        entityId: 'invite:resent-late', action: 'invitation.send', result: 'succeeded',
        occurredAt: original.occurredAt,
      }),
      mutationAudit({
        id: 'audit:invite:resend', requestId: resend.requestId, entityType: 'invitation',
        entityId: 'invite:resent-late', action: 'invitation.send', result: 'succeeded',
        occurredAt: resend.occurredAt,
      }),
      mutationAudit({
        id: 'audit:accept:resent-late', requestId: acceptance.requestId,
        entityType: 'invitation', entityId: 'invite:resent-late', actorId: 'user:resent-member',
        action: 'membership.accept', result: 'succeeded', occurredAt: acceptance.occurredAt,
      }),
    ]);

    expect(report.outcomes.find((item) => item.id === 'O-202')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
    expect(report.guardrails.find((item) => item.id === 'G-202')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
  });

  it('reconciles a G-202 acceptance to a valid invitation sent just before the denominator window', () => {
    const invite = event('invitation.sent', '2026-10-31T23:00:00.000Z', {
      invitationId: 'invite:pre-window', eligibleTrialWorkspace: true, auditId: 'audit:invite:pre-window',
    }, { id: 'evt:invite:pre-window' });
    const acceptance = event('membership.accepted', '2026-11-01T01:00:00.000Z', {
      invitationId: 'invite:pre-window', memberUserId: 'user:pre-window', emailMatched: true,
      validInvitation: true, firstAcceptance: true, auditId: 'audit:accept:pre-window',
    }, { id: 'evt:accept:pre-window', actorId: 'user:pre-window' });
    const report = syntheticReport([invite, acceptance], [
      mutationAudit({
        id: 'audit:invite:pre-window', requestId: invite.requestId, entityType: 'invitation',
        entityId: 'invite:pre-window', action: 'invitation.send', result: 'succeeded', occurredAt: invite.occurredAt,
      }),
      mutationAudit({
        id: 'audit:accept:pre-window', requestId: acceptance.requestId, entityType: 'invitation',
        entityId: 'invite:pre-window', actorId: 'user:pre-window', action: 'membership.accept',
        result: 'succeeded', occurredAt: acceptance.occurredAt,
      }),
    ]);
    expect(report.outcomes.find((item) => item.id === 'O-202')?.denominator).toBe(0);
    expect(report.guardrails.find((item) => item.id === 'G-202')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
  });

  it('limits G-203 economics to fully contained records for eligible cohort workspaces', () => {
    const trial = event('trial.ended', '2026-12-10T00:00:00.000Z', { eligible: true }, {
      id: 'evt:trial:cohort', source: 'system', actorKind: 'system', actorId: 'system:entitlement',
    });
    const economics = (workspaceId: string, id: string, kind: HostedEconomicsRecord['kind'], amountMicrousd: number): HostedEconomicsRecord => ({
      schemaVersion: hostedMeasurementSchemaVersion,
      id,
      workspaceId,
      provider: kind === 'variable_cost' ? 'firebase' : 'stripe',
      kind,
      category: kind,
      periodStart: '2026-12-01T00:00:00.000Z',
      periodEnd: '2027-01-01T00:00:00.000Z',
      amountMicrousd,
      activePaidSeats: 1,
      sourceRef: `provider:${id}`,
      retrievedAt: '2027-01-02T00:00:00.000Z',
    });
    const report = syntheticReport([trial], [], [
      economics('workspace:alpha', 'economics:alpha:cost', 'variable_cost', 100_000),
      economics('workspace:alpha', 'economics:alpha:revenue', 'recognized_revenue', 1_000_000),
      economics('workspace:beta', 'economics:beta:cost', 'variable_cost', 900_000),
    ]);
    expect(report.guardrails.find((item) => item.id === 'G-203')).toMatchObject({
      numerator: 100_000,
      denominator: 1_000_000,
      value: 10,
    });

    const partial = {
      ...economics('workspace:alpha', 'economics:alpha:partial', 'variable_cost', 10_000),
      periodStart: '2026-11-15T00:00:00.000Z',
    };
    expect(() => syntheticReport([trial], [], [partial])).toThrowError(/pre-allocated/u);
  });

  it('uses collision-free automation identities with role and environment dimensions', () => {
    const report = syntheticReport([
      event('automation.task.completed', '2026-10-05T00:00:00.000Z', {
        runId: 'a:b', taskId: 'c', surface: 'rest', role: 'owner', environment: 'uat', succeeded: true,
      }, { id: 'evt:tuple:1', source: 'rest', actorKind: 'personal_token', actorId: 'patref:tuple' }),
      event('automation.task.completed', '2026-10-05T00:01:00.000Z', {
        runId: 'a', taskId: 'b:c', surface: 'rest', role: 'owner', environment: 'uat', succeeded: false,
      }, { id: 'evt:tuple:2', source: 'rest', actorKind: 'personal_token', actorId: 'patref:tuple' }),
    ]);
    expect(report.outcomes.find((item) => item.id === 'O-204')).toMatchObject({
      numerator: 1,
      denominator: 2,
      value: 50,
    });
  });

  it('keeps a populated production cohort collecting until the window and watermark mature', () => {
    const report = buildHostedOutcomeReport({
      generatedAt: '2026-11-02T00:00:00.000Z',
      completenessWatermark: '2026-11-02T00:00:00.000Z',
      evidenceClass: 'production_baseline',
      events: [event('owner.google_sign_in.completed', '2026-11-01T00:00:00.000Z', { eligible: true })],
      audits: [],
      economics: [],
    });
    expect(report.outcomes.find((item) => item.id === 'O-201')?.status).toBe('collecting');

    const conversionTail = buildHostedOutcomeReport({
      generatedAt: '2027-02-01T00:00:00.000Z',
      completenessWatermark: '2027-02-01T00:00:00.000Z',
      evidenceClass: 'production_baseline',
      events: [event('trial.ended', '2027-01-31T00:00:00.000Z', { eligible: true }, {
        id: 'evt:trial:tail', source: 'system', actorKind: 'system', actorId: 'system:entitlement',
      })],
      audits: [],
      economics: [],
    });
    expect(conversionTail.outcomes.find((item) => item.id === 'O-203')?.status).toBe('collecting');
  });

  it('reconciles retry outcomes and counts only a terminal final bootstrap failure', () => {
    const journeyOptions = { workspaceId: 'workspace:retry', actorId: 'user:retry', correlationId: 'journey:retry' };
    const report = syntheticReport([
      event('owner.google_sign_in.completed', '2026-11-05T00:00:00.000Z', { eligible: true }, {
        ...journeyOptions, id: 'evt:retry:signin',
      }),
      event('workspace.bootstrap.failed', '2026-11-05T00:00:30.000Z', {
        attemptId: 'attempt:retry:1', reasonCode: 'transaction_conflict', disposition: 'recoverable',
      }, { ...journeyOptions, id: 'evt:retry:recoverable' }),
      event('workspace.bootstrap.completed', '2026-11-05T00:01:00.000Z', {
        trialStartedAt: '2026-11-05T00:01:00.000Z',
        trialEndsAt: '2026-12-05T00:01:00.000Z',
      }, { ...journeyOptions, id: 'evt:retry:bootstrap' }),
      event('project.created', '2026-11-05T00:02:00.000Z', { projectId: 'project:retry' }, {
        ...journeyOptions, id: 'evt:retry:project',
      }),
      event('issue.created', '2026-11-05T00:03:00.000Z', { issueId: 'issue:retry' }, {
        ...journeyOptions, id: 'evt:retry:issue',
      }),
    ]);
    expect(report.guardrails.find((item) => item.id === 'G-201')).toMatchObject({
      numerator: 0,
      denominator: 1,
      value: 0,
    });
  });

  it('fails report generation when a security-sensitive event lacks matching audit evidence', () => {
    const authorization = event('authorization.checked', '2026-10-05T00:02:00.000Z', {
      operation: 'issue.read',
      principalWorkspaceId: 'workspace:beta',
      targetWorkspaceId: 'workspace:alpha',
      targetEntityType: 'issue',
      targetEntityId: 'issue:foreign',
      authorized: false,
      operationSucceeded: true,
      protectedReadDisclosed: true,
      protectedStateChanged: false,
      auditId: 'audit:missing',
    }, {
      id: 'evt:authorization:missing', source: 'rest', actorKind: 'personal_token', actorId: 'patref:attacker',
    });
    expect(() => syntheticReport([authorization])).toThrowError(/does not reconcile to audit/u);
  });

  it('rejects an audit reference for the wrong entity even when actor and action match', () => {
    const invite = event('invitation.sent', '2026-11-07T00:00:00.000Z', {
      invitationId: 'invite:entity-check', eligibleTrialWorkspace: true, auditId: 'audit:entity-check',
    }, { id: 'evt:invite:entity-check' });
    const unrelatedAudit = mutationAudit({
      id: 'audit:entity-check', requestId: invite.requestId, entityType: 'issue', entityId: 'issue:unrelated',
      action: 'invitation.send', result: 'succeeded', occurredAt: invite.occurredAt,
    });
    expect(() => syntheticReport([invite], [unrelatedAudit])).toThrowError(/does not reconcile to audit/u);
  });
});
