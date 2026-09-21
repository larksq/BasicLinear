import { describe, expect, it } from 'vitest';
import {
  assertHostedRestoreDrillEvidence,
  buildHostedCostPerPaidSeatReport,
  buildHostedRestoreDrillEvidence,
  HostedOperationsService,
  MemoryHostedOperationsRepository,
  type HostedBudgetNoticeInput,
  type HostedEconomicsRecord,
  type HostedOperationsActivationReviewInput,
} from '../src/index.js';

const secret = 'operations-service-test-secret-000000000000000000001';
const periodStart = '2026-07-01T00:00:00.000Z';
const periodEnd = '2026-08-01T00:00:00.000Z';

function economics(): HostedEconomicsRecord[] {
  return [
    {
      schemaVersion: 'openlinear.hosted-measurement.v1',
      id: 'economics:firebase:workspace-1:2026-07',
      workspaceId: 'workspace-operations-1',
      provider: 'firebase',
      kind: 'variable_cost',
      category: 'firestore-and-hosted-runtime',
      periodStart,
      periodEnd,
      amountMicrousd: 400_000,
      activePaidSeats: 2,
      sourceRef: 'billing-export:firebase-row-1',
      retrievedAt: '2026-08-01T01:00:00.000Z',
    },
    {
      schemaVersion: 'openlinear.hosted-measurement.v1',
      id: 'economics:stripe-fee:workspace-1:2026-07',
      workspaceId: 'workspace-operations-1',
      provider: 'stripe',
      kind: 'variable_cost',
      category: 'payment-processing',
      periodStart,
      periodEnd,
      amountMicrousd: 200_000,
      activePaidSeats: 2,
      sourceRef: 'stripe-balance:fee-row-1',
      retrievedAt: '2026-08-01T01:00:00.000Z',
    },
    {
      schemaVersion: 'openlinear.hosted-measurement.v1',
      id: 'economics:stripe-revenue:workspace-1:2026-07',
      workspaceId: 'workspace-operations-1',
      provider: 'stripe',
      kind: 'recognized_revenue',
      category: 'subscription-revenue',
      periodStart,
      periodEnd,
      amountMicrousd: 4_000_000,
      activePaidSeats: 2,
      sourceRef: 'stripe-balance:revenue-row-1',
      retrievedAt: '2026-08-01T01:00:00.000Z',
    },
  ];
}

function activationInput(
  evidenceClass: 'synthetic_fixture' | 'production_baseline' = 'production_baseline',
): HostedOperationsActivationReviewInput {
  const source = economics();
  return {
    reviewId: 'review-operations-2026-08-01',
    environment: 'uat',
    reviewedAt: '2026-08-01T03:00:00.000Z',
    expiresAt: '2026-08-02T03:00:00.000Z',
    budgetIntervalStart: '2026-08-01T00:00:00.000Z',
    providerReferences: {
      budgetDisplayName: 'OpenLinear pilot budget',
      billingAccountId: '000AAA-BBB111-CCC222',
      budgetId: 'budget-operations-1',
      pubsubSubscription: 'projects/openlinear-uat/subscriptions/budget-alerts',
      cloudRunService: 'openlinear-hosted-api',
      cloudArmorPolicy: 'openlinear-hosted-edge',
      billingExportDataset: 'openlinear_billing_export',
      backupBucket: 'openlinear-firestore-backups',
      restoreProject: 'restore-drill-openlinear-uat',
    },
    paidWorkspaceIds: ['workspace-operations-1'],
    economics: source,
    costReport: buildHostedCostPerPaidSeatReport({
      generatedAt: '2026-08-01T02:00:00.000Z',
      periodStart,
      periodEnd,
      evidenceClass,
      paidWorkspaceIds: ['workspace-operations-1'],
      economics: source,
    }),
  };
}

function notice(overrides: Partial<HostedBudgetNoticeInput> = {}): HostedBudgetNoticeInput {
  return {
    messageId: '1234567890',
    publishTime: '2026-08-01T04:00:00.000Z',
    subscription: 'projects/openlinear-uat/subscriptions/budget-alerts',
    billingAccountId: '000AAA-BBB111-CCC222',
    budgetId: 'budget-operations-1',
    schemaVersion: '1.0',
    budgetDisplayName: 'OpenLinear pilot budget',
    costAmount: 13,
    costIntervalStart: '2026-08-01T00:00:00.000Z',
    budgetAmount: 25,
    budgetAmountType: 'SPECIFIED_AMOUNT',
    currencyCode: 'USD',
    alertThresholdExceeded: null,
    forecastThresholdExceeded: null,
    ...overrides,
  };
}

function fixture(environment: 'uat' | 'production' = 'uat') {
  let now = new Date('2026-08-01T05:00:00.000Z');
  const repository = new MemoryHostedOperationsRepository();
  const service = new HostedOperationsService(repository, {
    secret,
    environment,
    clock: () => now,
  });
  return {
    repository,
    service,
    setNow(value: string) { now = new Date(value); },
  };
}

describe('hosted operations cost and activation evidence', () => {
  it('reconciles observed economics into an exact guardrail-only cost-per-paid-seat report', () => {
    const report = buildHostedCostPerPaidSeatReport({
      generatedAt: '2026-08-01T02:00:00.000Z',
      periodStart,
      periodEnd,
      evidenceClass: 'production_baseline',
      paidWorkspaceIds: ['workspace-operations-1'],
      economics: economics(),
    });
    expect(report).toMatchObject({
      claimBoundary: 'guardrail_only_no_outcome_claim',
      workspaceCount: 1,
      activePaidSeats: 2,
      variableCostMicrousd: 600_000,
      recognizedRevenueMicrousd: 4_000_000,
      variableCostPerPaidSeatMicrousd: 300_000,
      recognizedRevenuePerPaidSeatMicrousd: 2_000_000,
      variableCostShareBasisPoints: 1_500,
      maximumVariableCostShareBasisPoints: 5_000,
      decision: 'allow',
    });
    expect(report.economicsDigest).toMatch(/^[a-f0-9]{64}$/u);
    expect(report.reportDigest).toMatch(/^[a-f0-9]{64}$/u);

    const incomplete = economics().filter((entry) => entry.kind === 'variable_cost');
    expect(() => buildHostedCostPerPaidSeatReport({
      generatedAt: '2026-08-01T02:00:00.000Z',
      periodStart,
      periodEnd,
      evidenceClass: 'production_baseline',
      paidWorkspaceIds: ['workspace-operations-1'],
      economics: incomplete,
    })).toThrowError(expect.objectContaining({code: 'INVALID_COST_REPORT'}));

    const justOverGuardrail = economics();
    justOverGuardrail[0] = {
      ...(justOverGuardrail[0] as HostedEconomicsRecord),
      amountMicrousd: 1_800_001,
    };
    expect(buildHostedCostPerPaidSeatReport({
      generatedAt: '2026-08-01T02:00:00.000Z',
      periodStart,
      periodEnd,
      evidenceClass: 'production_baseline',
      paidWorkspaceIds: ['workspace-operations-1'],
      economics: justOverGuardrail,
    })).toMatchObject({variableCostShareBasisPoints: 5_001, decision: 'stop'});
    expect(() => buildHostedCostPerPaidSeatReport({
      generatedAt: '2026-08-01T02:00:00.000Z',
      periodStart,
      periodEnd,
      evidenceClass: 'production_baseline',
      paidWorkspaceIds: ['workspace-operations-1', 'workspace-omitted-2'],
      economics: economics(),
    })).toThrowError(expect.objectContaining({code: 'INVALID_COST_REPORT'}));
  });

  it('rebuilds source economics before signing activation and blocks fabricated or synthetic production evidence', async () => {
    const uat = fixture();
    const valid = activationInput();
    await expect(uat.service.installActivationEvidence(valid)).resolves.toBeUndefined();
    const snapshot = uat.repository.snapshot();
    expect(snapshot['operationsActivation/current']).toMatchObject({
      id: 'current', environment: 'uat', costReportDecision: 'allow', revision: 1,
    });
    expect(JSON.stringify(snapshot)).not.toContain('000AAA-BBB111-CCC222');
    expect(JSON.stringify(snapshot)).not.toContain('OpenLinear pilot budget');
    expect(JSON.stringify(snapshot)).not.toContain('billing-export:firebase-row-1');

    const fabricated = activationInput();
    fabricated.costReport = {
      ...fabricated.costReport,
      variableCostMicrousd: 0,
    };
    await expect(fixture().service.installActivationEvidence(fabricated))
      .rejects.toMatchObject({code: 'INVALID_OPERATIONS_REVIEW'});

    const production = fixture('production');
    const synthetic = activationInput('synthetic_fixture');
    synthetic.environment = 'production';
    await expect(production.service.installActivationEvidence(synthetic))
      .rejects.toMatchObject({code: 'INVALID_OPERATIONS_REVIEW'});
    expect(production.repository.snapshot()).toEqual({});
  });
});

describe('hosted budget signals and paid activation', () => {
  it('uses actual spend when alerts omit a threshold, is idempotent across receipt time, and blocks warning spend', async () => {
    const context = fixture();
    await context.service.installActivationEvidence(activationInput());
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-operations-activation-1',
    })).resolves.toBeUndefined();

    const concurrent = await Promise.all([
      context.service.acceptBudgetNotice(notice()),
      context.service.acceptBudgetNotice(notice()),
    ]);
    expect(concurrent).toEqual([
      {changed: true, currentUpdated: true, severity: 'notice'},
      {changed: false, currentUpdated: false, severity: 'notice'},
    ]);
    const afterFirst = context.repository.snapshot();
    expect(afterFirst['operationsBudgetState/current']).toMatchObject({
      costAmountMicrousd: 13_000_000,
      actualThresholdBasisPoints: 5_200,
      severity: 'notice',
      revision: 2,
    });

    context.setNow('2026-08-01T06:00:00.000Z');
    await expect(context.service.acceptBudgetNotice(notice())).resolves.toEqual({
      changed: false,
      currentUpdated: false,
      severity: 'notice',
    });
    expect(context.repository.snapshot()).toEqual(afterFirst);

    const beforeCollision = context.repository.snapshot();
    await expect(context.service.acceptBudgetNotice(notice({costAmount: 14})))
      .rejects.toMatchObject({code: 'INVALID_BUDGET_NOTICE'});
    expect(context.repository.snapshot()).toEqual(beforeCollision);

    await expect(context.service.acceptBudgetNotice(notice({
      messageId: '1234567891',
      publishTime: '2026-08-01T06:01:00.000Z',
      costAmount: 21,
    }))).resolves.toMatchObject({severity: 'warning', currentUpdated: true});
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-operations-activation-2',
    })).rejects.toMatchObject({code: 'OPERATIONS_ACTIVATION_BLOCKED'});
  });

  it('records late delivery without regressing current state and fails closed on signed-state tamper', async () => {
    const context = fixture();
    await context.service.installActivationEvidence(activationInput());
    await context.service.acceptBudgetNotice(notice({
      messageId: 'newer-message-123',
      publishTime: '2026-08-01T05:00:00.000Z',
      costAmount: 10,
    }));
    const beforeLate = context.repository.snapshot();
    context.setNow('2026-08-01T06:00:00.000Z');
    await expect(context.service.acceptBudgetNotice(notice({
      messageId: 'older-message-123',
      publishTime: '2026-08-01T04:00:00.000Z',
      costAmount: 1,
    }))).resolves.toEqual({changed: true, currentUpdated: false, severity: 'healthy'});
    const afterLate = context.repository.snapshot();
    expect(afterLate['operationsBudgetState/current']).toEqual(beforeLate['operationsBudgetState/current']);
    expect(Object.keys(afterLate).filter((path) => path.startsWith('operationsBudgetSignals/')))
      .toHaveLength(2);

    context.repository.seed('operationsBudgetState/current', {
      ...(afterLate['operationsBudgetState/current'] as Record<string, unknown>),
      severity: 'critical',
    });
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-operations-tamper-1',
    })).rejects.toMatchObject({code: 'OPERATIONS_ACTIVATION_BLOCKED'});
  });

  it('binds current budget state and signal ids to each activation review', async () => {
    const context = fixture();
    const firstReview = activationInput();
    await context.service.installActivationEvidence(firstReview);
    await context.service.acceptBudgetNotice(notice({
      messageId: 'activation-bound-message',
      costAmount: 21,
    }));
    const oldState = context.repository.snapshot()['operationsBudgetState/current'] as Record<string, unknown>;
    const oldSignalPaths = Object.keys(context.repository.snapshot())
      .filter((path) => path.startsWith('operationsBudgetSignals/'));

    context.setNow('2026-08-01T07:00:00.000Z');
    const secondReview = activationInput();
    secondReview.reviewId = 'review-operations-2026-08-01-second';
    secondReview.reviewedAt = '2026-08-01T06:00:00.000Z';
    secondReview.expiresAt = '2026-08-02T06:00:00.000Z';
    await context.service.installActivationEvidence(secondReview);
    expect(context.repository.snapshot()['operationsBudgetState/current']).toMatchObject({
      costAmountMicrousd: 21_000_000,
      severity: 'warning',
      observedAt: '2026-08-01T05:00:00.000Z',
    });
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-preserved-warning-state',
    })).rejects.toMatchObject({code: 'OPERATIONS_ACTIVATION_BLOCKED'});
    await expect(context.service.acceptBudgetNotice(notice({
      messageId: 'activation-bound-message',
    }))).resolves.toMatchObject({changed: true});
    const newSignalPaths = Object.keys(context.repository.snapshot())
      .filter((path) => path.startsWith('operationsBudgetSignals/'));
    expect(newSignalPaths).toHaveLength(oldSignalPaths.length + 1);

    const validSecondState = context.repository.snapshot()['operationsBudgetState/current'] as Record<string, unknown>;
    context.repository.seed('operationsBudgetState/current', oldState);
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-old-state-replay',
    })).rejects.toMatchObject({code: 'OPERATIONS_ACTIVATION_BLOCKED'});
    context.repository.seed('operationsBudgetState/current', validSecondState);

    context.setNow('2026-08-02T02:00:00.000Z');
    const nextInterval = activationInput();
    nextInterval.reviewId = 'review-operations-2026-08-02-next-interval';
    nextInterval.reviewedAt = '2026-08-02T01:00:00.000Z';
    nextInterval.expiresAt = '2026-08-03T01:00:00.000Z';
    nextInterval.budgetIntervalStart = '2026-08-02T00:00:00.000Z';
    await context.service.installActivationEvidence(nextInterval);
    expect(context.repository.snapshot()['operationsBudgetState/current']).toMatchObject({
      costIntervalStart: '2026-08-02T00:00:00.000Z',
      costAmountMicrousd: 0,
      severity: 'healthy',
    });
    await expect(context.service.assertBillingActivationAllowed({
      workspaceId: 'workspace-operations-1',
      ownerUserId: 'owner-operations-1',
      requestId: 'request-new-budget-interval',
    })).resolves.toBeUndefined();
  });
});

describe('hosted Firestore restore-drill evidence', () => {
  it('binds an entire-database PITR restore into an isolated project and rejects chronology tamper', async () => {
    const drillInput = {
      drillId: 'drill-2026-08-01',
      evidenceClass: 'synthetic_fixture',
      sourceProject: 'openlinear-production',
      destinationProject: 'restore-drill-openlinear-20260801',
      pointInTime: '2026-08-01T00:00:00.000Z',
      exportRequestedAt: '2026-08-01T00:05:00.000Z',
      exportCompletedAt: '2026-08-01T00:20:00.000Z',
      importStartedAt: '2026-08-01T00:21:00.000Z',
      importCompletedAt: '2026-08-01T00:40:00.000Z',
      verifiedAt: '2026-08-01T00:45:00.000Z',
      destinationDeletionScheduledAt: '2026-08-02T00:45:00.000Z',
      collectionGroups: [
        '_invitationTokens', '_ownerTrialEligibility', 'activity', 'authorizationAudits',
        'authorizationEvents',
        'billing', 'billingCheckoutLocks', 'billingCheckoutSessions', 'billingCheckouts',
        'billingIdempotency', 'billingWebhooks', 'collaborationIdempotency', 'comments',
        'configurationIdempotency', 'creemCheckoutAttempts', 'cycles',
        'entitlements', 'hostedUsers', 'invitationIdempotency', 'invitations', 'issues',
        'issueObservationIdempotency', 'issueObservers', 'issueSequences',
        'memberships', 'milestones', 'mutationAudits', 'oauthAccessTokens',
        'oauthAuthorizationCodes', 'oauthAuthorizationRequests', 'oauthClients',
        'oauthGrants', 'oauthRefreshTokens', 'oauthTokenFamilies', 'operationsActivation',
        'operationsBudgetSignals', 'operationsBudgetState', 'operationsRestoreDrills',
        'personalTokens', 'pmIdempotency', 'productEvents', 'projects', 'tokenIdempotency',
        'savedViews', 'teamMemberships', 'teams', 'verificationAccess', 'workflowStatuses',
        'workspaces',
      ].reverse(),
      sourceDocumentCount: 12_345,
      restoredDocumentCount: 12_345,
      sourceManifestSha256: 'a'.repeat(64),
      restoredManifestSha256: 'a'.repeat(64),
      applicationSmokePassed: true,
      rulesIsolationPassed: true,
    } satisfies Parameters<typeof buildHostedRestoreDrillEvidence>[0];
    const evidence = buildHostedRestoreDrillEvidence(drillInput, secret);
    expect(() => assertHostedRestoreDrillEvidence(evidence, secret)).not.toThrow();
    for (const omitted of ['teams', 'teamMemberships', 'workflowStatuses', 'cycles', 'savedViews',
      'configurationIdempotency', 'issueObservers', 'issueObservationIdempotency', 'issueSequences',
      'creemCheckoutAttempts', 'verificationAccess']) {
      const incomplete = {...evidence, collectionGroups: evidence.collectionGroups.filter(group => group !== omitted)};
      expect(() => assertHostedRestoreDrillEvidence(incomplete, secret), omitted)
        .toThrowError(expect.objectContaining({code: 'INVALID_RESTORE_DRILL'}));
      expect(() => buildHostedRestoreDrillEvidence({...drillInput, collectionGroups: incomplete.collectionGroups}, secret), omitted)
        .toThrowError(expect.objectContaining({code: 'INVALID_RESTORE_DRILL'}));
    }
    const context = fixture();
    await expect(context.service.recordRestoreDrill(evidence)).resolves.toEqual({changed: true});
    await expect(context.service.recordRestoreDrill(evidence)).resolves.toEqual({changed: false});

    const tampered = {
      ...evidence,
      importCompletedAt: '2026-08-01T00:10:00.000Z',
    };
    expect(() => assertHostedRestoreDrillEvidence(tampered, secret))
      .toThrowError(expect.objectContaining({code: 'INVALID_RESTORE_DRILL'}));
  });
});
