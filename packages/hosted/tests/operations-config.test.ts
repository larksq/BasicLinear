import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  hostedOperationsPolicyDigest,
  hostedOperationsPolicyV1,
} from '../src/index.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));

async function json(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(`${root}${path}`, 'utf8')) as Record<string, unknown>;
}

describe('hosted operations deployment evidence', () => {
  it('binds runtime, application limits, query budgets, budget thresholds, and cost guardrails to code', async () => {
    const candidate = await json('ops/hosted/operations-policy.json');
    expect(candidate).toMatchObject({
      schemaVersion: 'openlinear.hosted-operations-deployment.v1',
      evidenceBoundary: 'reviewed_candidate_not_applied_to_a_provider',
      applicationPolicyDigest: hostedOperationsPolicyDigest(),
      service: {
        maxInstances: hostedOperationsPolicyV1.runtime.maxInstances,
        concurrency: hostedOperationsPolicyV1.runtime.concurrency,
        maximumConcurrentRequests: hostedOperationsPolicyV1.runtime.maxInstances
          * hostedOperationsPolicyV1.runtime.concurrency,
        requestTimeoutSeconds: hostedOperationsPolicyV1.runtime.requestTimeoutSeconds,
      },
      applicationRateLimit: {
        windowSeconds: hostedOperationsPolicyV1.windowSeconds,
        maximumInstances: hostedOperationsPolicyV1.runtime.maxInstances,
        aggregateUpperBoundMultiplier: hostedOperationsPolicyV1.runtime.maxInstances,
        maxTrackedBucketsPerInstance: hostedOperationsPolicyV1.maxTrackedBuckets,
        clockRegressionToleranceSeconds: hostedOperationsPolicyV1.clockRegressionToleranceSeconds,
        limitsPerInstancePerWindow: hostedOperationsPolicyV1.limits,
      },
      queryBudget: {
        maximumPageSize: hostedOperationsPolicyV1.queries.maximumPageSize,
        maximumTransactionListRecords:
          hostedOperationsPolicyV1.queries.maximumTransactionListRecords,
        maximumExportRecords: hostedOperationsPolicyV1.queries.maximumExportRecords,
        maximumExportIssueQueries: hostedOperationsPolicyV1.queries.maximumExportIssueQueries,
        maximumRequestBytes: hostedOperationsPolicyV1.queries.maximumRequestBytes,
        maximumStripeWebhookBytes: hostedOperationsPolicyV1.queries.maximumStripeWebhookBytes,
        maximumBudgetNoticeBytes: hostedOperationsPolicyV1.queries.maximumBudgetNoticeBytes,
      },
      budget: {
        currency: hostedOperationsPolicyV1.budget.currency,
        amountMicrousd: hostedOperationsPolicyV1.budget.amountMicrousd,
        thresholdBasisPoints: hostedOperationsPolicyV1.budget.thresholdsBasisPoints,
        alertsAreHardCap: hostedOperationsPolicyV1.budget.alertsAreHardCap,
        signalFreshnessHours: hostedOperationsPolicyV1.budget.signalFreshnessHours,
        activationReviewTtlHours: hostedOperationsPolicyV1.budget.activationReviewTtlHours,
      },
      costGuardrail: {
        maximumVariableCostShareBasisPoints:
          hostedOperationsPolicyV1.economics.maximumVariableCostShareBasisPoints,
        reportFreshnessHours: hostedOperationsPolicyV1.economics.reportFreshnessHours,
      },
      telemetry: {retentionDays: hostedOperationsPolicyV1.retention.structuredTelemetryDays},
      backup: {
        restoreEvidenceRetentionDays: hostedOperationsPolicyV1.retention.restoreEvidenceDays,
      },
    });
  });

  it('keeps the public route behind Firebase Hosting/Cloud Run and omits an unused Storage runtime', async () => {
    const [firebase, cloudRun, cloudArmor, budget, backup] = await Promise.all([
      json('firebase.json'),
      json('ops/hosted/cloud-run-service.template.json'),
      json('ops/hosted/cloud-armor-policy.template.json'),
      json('ops/hosted/budget-notification.template.json'),
      json('ops/hosted/firestore-backup-policy.template.json'),
    ]);
    const serializedFirebase = JSON.stringify(firebase);
    expect(serializedFirebase).toContain('openlinear-hosted-api');
    expect(serializedFirebase).toContain('/api/**');
    expect(serializedFirebase).toContain('/mcp');
    expect(serializedFirebase).toContain('/oauth/**');
    expect(cloudRun).toMatchObject({
      evidenceBoundary: 'template_not_applied',
      ingress: 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER',
      template: {
        timeout: `${hostedOperationsPolicyV1.runtime.requestTimeoutSeconds}s`,
        maxInstanceRequestConcurrency: hostedOperationsPolicyV1.runtime.concurrency,
        scaling: {
          minInstanceCount: 0,
          maxInstanceCount: hostedOperationsPolicyV1.runtime.maxInstances,
        },
      },
    });
    expect(cloudArmor).toMatchObject({
      evidenceBoundary: 'template_not_applied',
      requiredCloudRunIngress: 'INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER',
      previewFirst: true,
    });
    expect(budget).toMatchObject({
      evidenceBoundary: 'template_not_applied',
      budget: {
        amount: {specifiedAmount: {currencyCode: 'USD', units: '25'}},
        thresholdRules: hostedOperationsPolicyV1.budget.thresholdsBasisPoints.map(
          (thresholdPercent) => ({thresholdPercent: thresholdPercent / 10_000, spendBasis: 'CURRENT_SPEND'}),
        ),
        allUpdatesRule: {schemaVersion: '1.0'},
      },
    });
    expect(JSON.stringify(budget)).toContain('oidcToken');
    expect(backup).toMatchObject({
      evidenceBoundary: 'template_not_applied',
      mode: 'PITR_ENTIRE_DATABASE',
      collectionIds: null,
      productionInPlaceRestore: false,
    });

    const servicePackage = await json('apps/hosted-service/package.json');
    expect(servicePackage.dependencies).toMatchObject({
      '@google-cloud/firestore': '8.7.1',
      'firebase-admin': '14.4.0',
      'google-auth-library': '10.9.1',
      stripe: '22.5.0',
    });
    expect(servicePackage.dependencies).not.toHaveProperty('@google-cloud/storage');
  });

  it('documents the fail-closed budget, isolated restore, and telemetry response boundaries', async () => {
    const [budget, restore, runtime, rules, environment] = await Promise.all([
      readFile(`${root}docs/operations/hosted-budget-incident-runbook.md`, 'utf8'),
      readFile(`${root}docs/operations/hosted-backup-restore-runbook.md`, 'utf8'),
      readFile(`${root}docs/operations/hosted-runtime-runbook.md`, 'utf8'),
      readFile(`${root}firestore.rules`, 'utf8'),
      readFile(`${root}.env.example`, 'utf8'),
    ]);
    expect(budget).toContain('alerts, not a spending cap');
    expect(budget).toContain('warning');
    expect(restore).toContain('synthetic_fixture');
    expect(restore).toContain('provider_drill');
    expect(restore).toContain('never authorizes an in-place production import');
    expect(runtime).toContain('maximum three instances');
    expect(runtime).toContain('internal-and-cloud-load-balancing');
    for (const collection of [
      'operationsActivation', 'operationsBudgetSignals', 'operationsBudgetState',
      'operationsRestoreDrills',
    ]) expect(rules).toContain(`match /${collection}/{recordId}`);
    for (const name of [
      'OPENLINEAR_OPERATIONS_SECRET', 'OPENLINEAR_HOSTED_ENVIRONMENT',
      'OPENLINEAR_BUDGET_PUSH_AUDIENCE', 'OPENLINEAR_BUDGET_PUSH_SERVICE_ACCOUNT',
    ]) expect(environment).toContain(name);
  });
});
