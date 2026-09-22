import {
  assertHostedMutationAuditRecord,
  assertHostedProductEvent,
  deduplicateHostedAudits,
  deduplicateHostedEconomics,
  deduplicateHostedEvents,
  HostedMeasurementError,
  type HostedEconomicsRecord,
  type HostedMutationAuditRecord,
  type HostedProductEvent,
} from './measurement-contract.js';

export const hostedOutcomeMeasurementContractV1 = Object.freeze({
  schemaVersion: 'basiclinear.hosted-outcomes.v1',
  outcomes: {
    'O-201': {
      metric: 'ten-minute hosted activation rate',
      window: { start: '2026-11-01T00:00:00.000Z', end: '2026-11-30T23:59:59.999Z' },
      maturesAt: '2026-12-01T00:09:59.999Z',
      unit: 'percent',
    },
    'O-202': {
      metric: 'seven-day collaboration-loop completion rate',
      window: { start: '2026-11-01T00:00:00.000Z', end: '2026-12-15T23:59:59.999Z' },
      maturesAt: '2026-12-22T23:59:59.999Z',
      unit: 'percent',
    },
    'O-203': {
      metric: 'seven-day paid conversion rate',
      window: { start: '2026-12-01T00:00:00.000Z', end: '2027-01-31T23:59:59.999Z' },
      maturesAt: '2027-02-07T23:59:59.999Z',
      unit: 'percent',
    },
    'O-204': {
      metric: 'canonical automation task success rate',
      window: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-31T23:59:59.999Z' },
      maturesAt: '2026-10-31T23:59:59.999Z',
      unit: 'percent',
    },
  },
  guardrails: {
    'G-201': 'bootstrap error rate',
    'G-202': 'unwanted or duplicate accepted membership rate',
    'G-203': 'variable hosted and payment cost as a share of recognized subscription revenue',
    'G-204': 'successful unauthorized cross-workspace operations',
  },
} as const);

type OutcomeId = keyof typeof hostedOutcomeMeasurementContractV1.outcomes;
type GuardrailId = keyof typeof hostedOutcomeMeasurementContractV1.guardrails;
type EvidenceClass = 'synthetic_fixture' | 'production_baseline';

export interface HostedOutcomeMetric {
  id: OutcomeId;
  metric: string;
  status: 'fixture_only' | 'collecting' | 'baseline_needed' | 'baseline_ready';
  numerator: number;
  denominator: number;
  value: number | null;
  unit: 'percent';
  window: { start: string; end: string };
  maturesAt: string;
}

export interface HostedGuardrailMetric {
  id: GuardrailId;
  metric: string;
  numerator: number;
  denominator: number | null;
  value: number | null;
  unit: 'percent' | 'count';
}

export interface HostedOutcomeReport {
  schemaVersion: typeof hostedOutcomeMeasurementContractV1.schemaVersion;
  generatedAt: string;
  evidenceClass: EvidenceClass;
  claimBoundary: 'measurement_only_no_outcome_claim';
  provenance: {
    completenessWatermark: string | null;
    eventCount: number;
    auditCount: number;
    economicsRecordCount: number;
    eventSources: Record<'web' | 'rest' | 'mcp' | 'system' | 'stripe' | 'creem', number>;
    economicsProviders: Record<'firebase' | 'stripe' | 'creem', number>;
  };
  outcomes: HostedOutcomeMetric[];
  guardrails: HostedGuardrailMetric[];
}

export interface BuildHostedOutcomeReportInput {
  generatedAt: string;
  completenessWatermark: string | null;
  evidenceClass: EvidenceClass;
  events: readonly HostedProductEvent[];
  audits: readonly HostedMutationAuditRecord[];
  economics: readonly HostedEconomicsRecord[];
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new HostedMeasurementError('INVALID_TIMESTAMP', `${label} must be a canonical ISO timestamp.`);
  }
  return parsed;
}

function within(value: string, start: string, end: string): boolean {
  const time = Date.parse(value);
  return time >= Date.parse(start) && time <= Date.parse(end);
}

function afterWithin(value: string, start: string, durationMs: number): boolean {
  const time = Date.parse(value);
  const beginning = Date.parse(start);
  return time >= beginning && time <= beginning + durationMs;
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100_000) / 1_000;
}

function outcomeStatus(
  evidenceClass: EvidenceClass,
  denominator: number,
  generatedAt: string,
  completenessWatermark: string | null,
  maturesAt: string,
): HostedOutcomeMetric['status'] {
  if (evidenceClass === 'synthetic_fixture') return 'fixture_only';
  if (Date.parse(generatedAt) < Date.parse(maturesAt)
    || completenessWatermark === null
    || Date.parse(completenessWatermark) < Date.parse(maturesAt)) {
    return 'collecting';
  }
  return denominator === 0 ? 'baseline_needed' : 'baseline_ready';
}

function outcome(
  id: OutcomeId,
  evidenceClass: EvidenceClass,
  numerator: number,
  denominator: number,
  generatedAt: string,
  completenessWatermark: string | null,
): HostedOutcomeMetric {
  const contract = hostedOutcomeMeasurementContractV1.outcomes[id];
  return {
    id,
    metric: contract.metric,
    status: outcomeStatus(
      evidenceClass,
      denominator,
      generatedAt,
      completenessWatermark,
      contract.maturesAt,
    ),
    numerator,
    denominator,
    value: percentage(numerator, denominator),
    unit: contract.unit,
    window: { ...contract.window },
    maturesAt: contract.maturesAt,
  };
}

function eventOf<Name extends HostedProductEvent['name']>(
  events: readonly HostedProductEvent[],
  name: Name,
): Array<Extract<HostedProductEvent, { name: Name }>> {
  return events.filter((event): event is Extract<HostedProductEvent, { name: Name }> => event.name === name);
}

function earliestBy<T>(values: readonly T[], key: (value: T) => string, at: (value: T) => string): T[] {
  const result = new Map<string, T>();
  for (const value of values) {
    const existing = result.get(key(value));
    if (!existing || Date.parse(at(value)) < Date.parse(at(existing))) result.set(key(value), value);
  }
  return [...result.values()].sort((left, right) => key(left).localeCompare(key(right), 'en'));
}

function isSameActor(
  left: HostedProductEvent['actor'],
  right: HostedMutationAuditRecord['actor'],
): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function requireAudit(
  audits: readonly HostedMutationAuditRecord[],
  event: HostedProductEvent,
  auditId: string,
  expected: { action: string; result: HostedMutationAuditRecord['result'] },
  entity: { type: string; id: string },
): HostedMutationAuditRecord {
  const audit = audits.find((candidate) => candidate.id === auditId);
  if (!audit
    || audit.workspaceId !== event.workspaceId
    || audit.source !== event.source
    || !isSameActor(event.actor, audit.actor)
    || audit.requestId !== event.requestId
    || audit.occurredAt !== event.occurredAt
    || audit.action !== expected.action
    || audit.result !== expected.result
    || audit.entity.type !== entity.type
    || audit.entity.id !== entity.id) {
    throw new HostedMeasurementError(
      'UNRECONCILED_AUDIT',
      `Event ${event.id} does not reconcile to audit ${auditId}.`,
    );
  }
  return audit;
}

function assertUniqueAuditReferences(events: readonly HostedProductEvent[]): void {
  const references = new Map<string, string>();
  for (const event of events) {
    let auditId: string | undefined;
    if (event.name === 'invitation.sent'
      || event.name === 'membership.accepted'
      || event.name === 'authorization.checked') {
      auditId = event.attributes.auditId;
    }
    if (auditId === undefined) continue;
    const existing = references.get(auditId);
    if (existing !== undefined && existing !== event.id) {
      throw new HostedMeasurementError(
        'AUDIT_REFERENCE_REUSED',
        `Audit ${auditId} is referenced by both ${existing} and ${event.id}.`,
      );
    }
    references.set(auditId, event.id);
  }
}

interface OutcomeContext {
  evidenceClass: EvidenceClass;
  generatedAt: string;
  completenessWatermark: string | null;
}

function activationMetrics(events: readonly HostedProductEvent[], context: OutcomeContext): {
  outcome: HostedOutcomeMetric;
  guardrail: HostedGuardrailMetric;
} {
  const contract = hostedOutcomeMeasurementContractV1.outcomes['O-201'];
  const eligibleSignIns = earliestBy(
    eventOf(events, 'owner.google_sign_in.completed').filter((event) => (
      event.attributes.eligible && within(event.occurredAt, contract.window.start, contract.window.end)
    )),
    (event) => event.actor.id,
    (event) => event.occurredAt,
  );
  const bootstraps = eventOf(events, 'workspace.bootstrap.completed');
  const projects = eventOf(events, 'project.created');
  const issues = eventOf(events, 'issue.created');
  const failures = eventOf(events, 'workspace.bootstrap.failed');
  const tenMinutes = 10 * 60 * 1_000;
  let activated = 0;
  let failed = 0;
  for (const signIn of eligibleSignIns) {
    const sameJourney = (event: HostedProductEvent): boolean => (
      event.workspaceId === signIn.workspaceId
      && event.actor.id === signIn.actor.id
      && event.correlationId === signIn.correlationId
      && afterWithin(event.occurredAt, signIn.occurredAt, tenMinutes)
    );
    const bootstrap = bootstraps.filter(sameJourney)
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt))[0];
    const project = projects.filter(sameJourney).find((event) => (
      bootstrap !== undefined && Date.parse(event.occurredAt) >= Date.parse(bootstrap.occurredAt)
    ));
    const issue = issues.filter(sameJourney).find((event) => (
      project !== undefined && Date.parse(event.occurredAt) >= Date.parse(project.occurredAt)
    ));
    if (bootstrap && project && issue) activated += 1;

    const bootstrapOutcomes = [...bootstraps.filter(sameJourney), ...failures.filter(sameJourney)]
      .sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    const finalOutcome = bootstrapOutcomes.at(-1);
    if (finalOutcome?.name === 'workspace.bootstrap.failed'
      && finalOutcome.attributes.disposition === 'terminal') failed += 1;
  }
  return {
    outcome: outcome(
      'O-201',
      context.evidenceClass,
      activated,
      eligibleSignIns.length,
      context.generatedAt,
      context.completenessWatermark,
    ),
    guardrail: {
      id: 'G-201',
      metric: hostedOutcomeMeasurementContractV1.guardrails['G-201'],
      numerator: failed,
      denominator: eligibleSignIns.length,
      value: percentage(failed, eligibleSignIns.length),
      unit: 'percent',
    },
  };
}

function collaborationMetrics(
  events: readonly HostedProductEvent[],
  audits: readonly HostedMutationAuditRecord[],
  context: OutcomeContext,
): {
  outcome: HostedOutcomeMetric;
  guardrail: HostedGuardrailMetric;
} {
  const contract = hostedOutcomeMeasurementContractV1.outcomes['O-202'];
  const invitationLedger = eventOf(events, 'invitation.sent');
  for (const invitation of invitationLedger) {
    requireAudit(audits, invitation, invitation.attributes.auditId, {
      action: 'invitation.send',
      result: 'succeeded',
    }, { type: 'invitation', id: invitation.attributes.invitationId });
  }
  const eligibleInvitations = invitationLedger.filter((event) => (
      event.attributes.eligibleTrialWorkspace && within(event.occurredAt, contract.window.start, contract.window.end)
  ));
  const invitations = earliestBy(
    eligibleInvitations,
    (event) => event.workspaceId,
    (event) => event.occurredAt,
  );
  const acceptances = eventOf(events, 'membership.accepted');
  const assignments = eventOf(events, 'issue.assigned');
  const memberActions = eventOf(events, 'issue.member_action.completed');
  const comments = eventOf(events, 'comment.created');
  const sevenDays = 7 * 24 * 60 * 60 * 1_000;
  let completed = 0;
  for (const invitation of invitations) {
    const accepted = acceptances.find((event) => (
      event.workspaceId === invitation.workspaceId
      && event.attributes.invitationId === invitation.attributes.invitationId
      && event.actor.kind === 'user'
      && event.actor.id === event.attributes.memberUserId
      && event.attributes.validInvitation
      && event.attributes.firstAcceptance
      && event.attributes.emailMatched
      && afterWithin(event.occurredAt, invitation.occurredAt, sevenDays)
    ));
    if (!accepted) continue;
    requireAudit(audits, accepted, accepted.attributes.auditId, {
      action: 'membership.accept',
      result: 'succeeded',
    }, { type: 'invitation', id: accepted.attributes.invitationId });
    const memberId = accepted.attributes.memberUserId;
    const hasCompleteChain = assignments.some((assigned) => {
      if (assigned.workspaceId !== invitation.workspaceId
        || assigned.attributes.assigneeUserId !== memberId
        || Date.parse(assigned.occurredAt) < Date.parse(accepted.occurredAt)
        || !afterWithin(assigned.occurredAt, invitation.occurredAt, sevenDays)) return false;
      return memberActions.some((memberAction) => {
        if (memberAction.workspaceId !== invitation.workspaceId
          || memberAction.attributes.issueId !== assigned.attributes.issueId
          || memberAction.actor.id !== memberId
          || memberAction.attributes.memberUserId !== memberId
          || Date.parse(memberAction.occurredAt) < Date.parse(assigned.occurredAt)
          || !afterWithin(memberAction.occurredAt, invitation.occurredAt, sevenDays)) return false;
        return comments.some((comment) => (
          comment.workspaceId === invitation.workspaceId
          && comment.attributes.issueId === assigned.attributes.issueId
          && comment.actor.id === memberId
          && comment.attributes.authorUserId === memberId
          && comment.attributes.actorRole === 'member'
          && Date.parse(comment.occurredAt) >= Date.parse(memberAction.occurredAt)
          && afterWithin(comment.occurredAt, invitation.occurredAt, sevenDays)
        ));
      });
    });
    if (hasCompleteChain) completed += 1;
  }
  const acceptanceWindowEnd = new Date(Date.parse(contract.window.end) + sevenDays).toISOString();
  const observedAcceptances = acceptances.filter((event) => (
    within(event.occurredAt, contract.window.start, acceptanceWindowEnd)
  ));
  const invalidAcceptances = observedAcceptances.filter((event) => {
    const invitation = invitationLedger
      .filter((candidate) => (
        candidate.workspaceId === event.workspaceId
        && candidate.attributes.invitationId === event.attributes.invitationId
        && afterWithin(event.occurredAt, candidate.occurredAt, sevenDays)
      ))
      .sort((left, right) => (
        Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
        || right.id.localeCompare(left.id, 'en')
      ))[0];
    const valid = invitation !== undefined
      && event.actor.kind === 'user'
      && event.actor.id === event.attributes.memberUserId
      && event.attributes.validInvitation
      && event.attributes.firstAcceptance
      && event.attributes.emailMatched;
    requireAudit(audits, event, event.attributes.auditId, {
      action: 'membership.accept',
      result: valid ? 'succeeded' : 'denied',
    }, { type: 'invitation', id: event.attributes.invitationId });
    return !valid;
  });
  return {
    outcome: outcome(
      'O-202',
      context.evidenceClass,
      completed,
      invitations.length,
      context.generatedAt,
      context.completenessWatermark,
    ),
    guardrail: {
      id: 'G-202',
      metric: hostedOutcomeMeasurementContractV1.guardrails['G-202'],
      numerator: invalidAcceptances.length,
      denominator: observedAcceptances.length,
      value: percentage(invalidAcceptances.length, observedAcceptances.length),
      unit: 'percent',
    },
  };
}

function conversionMetrics(
  events: readonly HostedProductEvent[],
  economics: readonly HostedEconomicsRecord[],
  context: OutcomeContext,
): { outcome: HostedOutcomeMetric; guardrail: HostedGuardrailMetric } {
  const contract = hostedOutcomeMeasurementContractV1.outcomes['O-203'];
  const trials = earliestBy(
    eventOf(events, 'trial.ended').filter((event) => (
      event.attributes.eligible && within(event.occurredAt, contract.window.start, contract.window.end)
    )),
    (event) => event.workspaceId,
    (event) => event.occurredAt,
  );
  const activations = eventOf(events, 'subscription.activated');
  const sevenDays = 7 * 24 * 60 * 60 * 1_000;
  const converted = trials.filter((trial) => activations.some((event) => (
    event.workspaceId === trial.workspaceId
    && afterWithin(event.occurredAt, trial.occurredAt, sevenDays)
  ))).length;
  const cohortWorkspaceIds = new Set(trials.map((trial) => trial.workspaceId));
  const overlappingCohortEconomics = economics.filter((item) => (
    cohortWorkspaceIds.has(item.workspaceId)
    && Date.parse(item.periodEnd) > Date.parse(contract.window.start)
    && Date.parse(item.periodStart) <= Date.parse(contract.window.end)
  ));
  const partialPeriod = overlappingCohortEconomics.find((item) => (
    Date.parse(item.periodStart) < Date.parse(contract.window.start)
    || Date.parse(item.periodEnd) > Date.parse(contract.window.end)
  ));
  if (partialPeriod) {
    throw new HostedMeasurementError(
      'PARTIAL_ECONOMICS_PERIOD',
      `Economics record ${partialPeriod.id} must be pre-allocated to the O-203 window.`,
    );
  }
  const relevantEconomics = overlappingCohortEconomics;
  const variableCost = relevantEconomics
    .filter((item) => item.kind === 'variable_cost')
    .reduce((sum, item) => sum + item.amountMicrousd, 0);
  const revenue = relevantEconomics
    .filter((item) => item.kind === 'recognized_revenue')
    .reduce((sum, item) => sum + item.amountMicrousd, 0);
  return {
    outcome: outcome(
      'O-203',
      context.evidenceClass,
      converted,
      trials.length,
      context.generatedAt,
      context.completenessWatermark,
    ),
    guardrail: {
      id: 'G-203',
      metric: hostedOutcomeMeasurementContractV1.guardrails['G-203'],
      numerator: variableCost,
      denominator: revenue,
      value: percentage(variableCost, revenue),
      unit: 'percent',
    },
  };
}

function automationMetrics(
  events: readonly HostedProductEvent[],
  audits: readonly HostedMutationAuditRecord[],
  context: OutcomeContext,
): {
  outcome: HostedOutcomeMetric;
  guardrail: HostedGuardrailMetric;
} {
  const contract = hostedOutcomeMeasurementContractV1.outcomes['O-204'];
  const tasks = earliestBy(
    eventOf(events, 'automation.task.completed').filter((event) => (
      within(event.occurredAt, contract.window.start, contract.window.end)
    )),
    (event) => JSON.stringify([
      event.workspaceId,
      event.attributes.runId,
      event.attributes.taskId,
      event.attributes.surface,
      event.attributes.role,
      event.attributes.environment,
    ]),
    (event) => event.occurredAt,
  );
  const successful = tasks.filter((event) => event.attributes.succeeded).length;
  const authorizationChecks = eventOf(events, 'authorization.checked').filter((event) => (
    within(event.occurredAt, contract.window.start, contract.window.end)
  ));
  for (const event of authorizationChecks) {
    requireAudit(audits, event, event.attributes.auditId, {
      action: event.attributes.operation,
      result: event.attributes.operationSucceeded ? 'succeeded' : 'denied',
    }, {
      type: event.attributes.targetEntityType,
      id: event.attributes.targetEntityId,
    });
  }
  const unauthorizedSuccesses = authorizationChecks.filter((event) => (
    !event.attributes.authorized
    && event.attributes.principalWorkspaceId !== event.attributes.targetWorkspaceId
    && event.attributes.operationSucceeded
    && (event.attributes.protectedReadDisclosed || event.attributes.protectedStateChanged)
  )).length;
  return {
    outcome: outcome(
      'O-204',
      context.evidenceClass,
      successful,
      tasks.length,
      context.generatedAt,
      context.completenessWatermark,
    ),
    guardrail: {
      id: 'G-204',
      metric: hostedOutcomeMeasurementContractV1.guardrails['G-204'],
      numerator: unauthorizedSuccesses,
      denominator: null,
      value: unauthorizedSuccesses,
      unit: 'count',
    },
  };
}

export function buildHostedOutcomeReport(input: BuildHostedOutcomeReportInput): HostedOutcomeReport {
  timestamp(input.generatedAt, 'generatedAt');
  if (input.completenessWatermark !== null) {
    timestamp(input.completenessWatermark, 'completenessWatermark');
    if (Date.parse(input.completenessWatermark) > Date.parse(input.generatedAt)) {
      throw new HostedMeasurementError(
        'INVALID_COMPLETENESS_WATERMARK',
        'The completeness watermark cannot be later than report generation.',
      );
    }
  }
  if (input.evidenceClass !== 'synthetic_fixture' && input.evidenceClass !== 'production_baseline') {
    throw new HostedMeasurementError('INVALID_EVIDENCE_CLASS', 'The report evidence class is unsupported.');
  }
  for (const event of input.events) assertHostedProductEvent(event);
  for (const audit of input.audits) assertHostedMutationAuditRecord(audit);
  const events = deduplicateHostedEvents(input.events);
  const audits = deduplicateHostedAudits(input.audits);
  const economics = deduplicateHostedEconomics(input.economics);
  assertUniqueAuditReferences(events);
  const context: OutcomeContext = {
    evidenceClass: input.evidenceClass,
    generatedAt: input.generatedAt,
    completenessWatermark: input.completenessWatermark,
  };
  const activation = activationMetrics(events, context);
  const collaboration = collaborationMetrics(events, audits, context);
  const conversion = conversionMetrics(events, economics, context);
  const automation = automationMetrics(events, audits, context);
  const eventSources: HostedOutcomeReport['provenance']['eventSources'] = {
    web: 0,
    rest: 0,
    mcp: 0,
    system: 0,
    stripe: 0,
    creem: 0,
  };
  for (const event of events) eventSources[event.source] += 1;
  const economicsProviders: HostedOutcomeReport['provenance']['economicsProviders'] = {
    firebase: 0,
    stripe: 0,
    creem: 0,
  };
  for (const item of economics) economicsProviders[item.provider] += 1;
  return {
    schemaVersion: hostedOutcomeMeasurementContractV1.schemaVersion,
    generatedAt: input.generatedAt,
    evidenceClass: input.evidenceClass,
    claimBoundary: 'measurement_only_no_outcome_claim',
    provenance: {
      completenessWatermark: input.completenessWatermark,
      eventCount: events.length,
      auditCount: audits.length,
      economicsRecordCount: economics.length,
      eventSources,
      economicsProviders,
    },
    outcomes: [activation.outcome, collaboration.outcome, conversion.outcome, automation.outcome],
    guardrails: [activation.guardrail, collaboration.guardrail, conversion.guardrail, automation.guardrail],
  };
}
