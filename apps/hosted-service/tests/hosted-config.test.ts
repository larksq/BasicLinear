import { describe, expect, it } from 'vitest';
import {
  assertDistinctHostedSecrets,
  assertHostedDeploymentBinding,
  assertBudgetPushAudienceOrigin,
  readAllowedOrigins,
  readBillingSecret,
  readBudgetPushAudience,
  readBudgetPushServiceAccount,
  readFirebaseProjectId,
  readFirestoreDatabaseId,
  readGoogleCloudProjectId,
  readHostedDeploymentEnvironment,
  readHostedEnvironment,
  readHostedPaymentMode,
  readHostedPublicOrigin,
  readCollaborationSecret,
  readHostedPort,
  readInvitationSecret,
  readMcpOAuthSecret,
  readOperationsSecret,
  readPersonalTokenSecret,
  readProjectManagementSecret,
  readRestCursorSecret,
  readStripePriceId,
  readStripeSecret,
  readStripeWebhookSecret,
  readVerificationAccessEmails,
  requireHostedTelemetryProject,
} from '../src/hosted-config.js';

describe('hosted service configuration', () => {
  it('accepts canonical HTTPS and literal loopback emulator origins', () => {
    expect(readAllowedOrigins(
      'https://basiclinear.web.app, http://127.0.0.1:5000,http://localhost:5000,http://[::1]:5000',
    )).toEqual([
      'https://basiclinear.web.app',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://[::1]:5000',
    ]);
  });

  it('rejects non-loopback HTTP and non-origin URL components', () => {
    for (const value of [
      'http://basiclinear.web.app',
      'https://basiclinear.web.app/path',
      'https://basiclinear.web.app?tenant=one',
      'https://user:secret@basiclinear.web.app',
    ]) {
      expect(() => readAllowedOrigins(value)).toThrow(/comma-separated origins/u);
    }
  });

  it('uses a bounded Cloud Run port', () => {
    expect(readHostedPort(undefined)).toBe(8080);
    expect(readHostedPort('4174')).toBe(4174);
    expect(() => readHostedPort('0')).toThrow(/between 1 and 65535/u);
  });

  it('requires a bounded server-only invitation HMAC secret', () => {
    const secret = 'hosted-invitation-secret-32-bytes-minimum';
    expect(readInvitationSecret(` ${secret} `)).toBe(secret);
    expect(() => readInvitationSecret(undefined)).toThrow(/32 and 512 bytes/u);
    expect(() => readInvitationSecret('too-short')).toThrow(/32 and 512 bytes/u);
  });

  it('requires a separate bounded collaboration idempotency HMAC secret', () => {
    const secret = 'hosted-collaboration-secret-32-bytes-minimum';
    expect(readCollaborationSecret(` ${secret} `)).toBe(secret);
    expect(() => readCollaborationSecret(undefined)).toThrow(/32 and 512 bytes/u);
    expect(() => readCollaborationSecret('too-short')).toThrow(/32 and 512 bytes/u);
  });

  it('requires distinct bounded PM, personal-token, cursor, and MCP OAuth secrets', () => {
    expect(readPersonalTokenSecret('p'.repeat(32))).toBe('p'.repeat(32));
    expect(readProjectManagementSecret('m'.repeat(32))).toBe('m'.repeat(32));
    expect(readRestCursorSecret('c'.repeat(32))).toBe('c'.repeat(32));
    expect(readMcpOAuthSecret('o'.repeat(32))).toBe('o'.repeat(32));
    expect(() => readPersonalTokenSecret('short')).toThrow(/PERSONAL_TOKEN_SECRET/u);
    expect(() => readProjectManagementSecret(undefined)).toThrow(/PM_SECRET/u);
    expect(() => readRestCursorSecret('short')).toThrow(/REST_CURSOR_SECRET/u);
    expect(() => readMcpOAuthSecret('short')).toThrow(/MCP_OAUTH_SECRET/u);
    expect(() => assertDistinctHostedSecrets({
      personal: 'p'.repeat(32),
      projectManagement: 'm'.repeat(32),
      cursor: 'c'.repeat(32),
      oauth: 'o'.repeat(32),
    })).not.toThrow();
    expect(() => assertDistinctHostedSecrets({
      personal: 'p'.repeat(32),
      projectManagement: 'm'.repeat(32),
      cursor: 'p'.repeat(32),
      oauth: 'o'.repeat(32),
    })).toThrow(/personal and cursor must use distinct secrets/u);
  });

  it('requires exact environment, budget push identity, audience, project, and operations secret', () => {
    expect(readHostedEnvironment('uat')).toBe('uat');
    expect(readHostedEnvironment('production')).toBe('production');
    expect(() => readHostedEnvironment('development')).toThrow(/uat or production/u);
    expect(readOperationsSecret('r'.repeat(32))).toBe('r'.repeat(32));
    expect(() => readOperationsSecret('short')).toThrow(/OPERATIONS_SECRET/u);
    expect(readBudgetPushAudience(
      'https://api.basiclinear.example/api/v1/hosted/operations/budget-notice',
    )).toBe('https://api.basiclinear.example/api/v1/hosted/operations/budget-notice');
    expect(readBudgetPushAudience(
      'http://127.0.0.1:8080/api/v1/hosted/operations/budget-notice',
    )).toBe('http://127.0.0.1:8080/api/v1/hosted/operations/budget-notice');
    for (const invalid of [
      'http://api.basiclinear.example/api/v1/hosted/operations/budget-notice',
      'https://api.basiclinear.example/api/v1/hosted/operations/budget-notice?bypass=1',
      'https://api.basiclinear.example/api/v1/hosted/billing/stripe/webhook',
    ]) expect(() => readBudgetPushAudience(invalid)).toThrow(/exact budget push URL/u);
    expect(readBudgetPushServiceAccount(
      'budget-push@basiclinear-prod.iam.gserviceaccount.com',
    )).toBe('budget-push@basiclinear-prod.iam.gserviceaccount.com');
    expect(() => readBudgetPushServiceAccount('owner@example.com')).toThrow(/service-account email/u);
    expect(readGoogleCloudProjectId('basiclinear-prod-1')).toBe('basiclinear-prod-1');
    expect(readGoogleCloudProjectId(undefined)).toBeNull();
    expect(() => readGoogleCloudProjectId('BasicLinear')).toThrow(/canonical/u);
    expect(() => assertBudgetPushAudienceOrigin(
      'https://online.example.com/api/v1/hosted/operations/budget-notice',
      'https://online.example.com',
    )).not.toThrow();
    expect(() => assertBudgetPushAudienceOrigin(
      'https://api.example.com/api/v1/hosted/operations/budget-notice',
      'https://online.example.com',
    )).toThrow(/must use BASICLINEAR_HOSTED_PUBLIC_ORIGIN/u);
    expect(requireHostedTelemetryProject('uat', null)).toBeNull();
    expect(requireHostedTelemetryProject('production', 'basiclinear-prod-1'))
      .toBe('basiclinear-prod-1');
    expect(() => requireHostedTelemetryProject('production', null))
      .toThrow(/required for production/u);
  });

  it('binds development and production to different Firebase projects and Stripe modes', () => {
    const testSecret = readStripeSecret(`sk_test_${'a'.repeat(24)}`);
    const liveSecret = readStripeSecret(`sk_live_${'b'.repeat(24)}`);
    expect(readHostedDeploymentEnvironment('development')).toBe('development');
    expect(readHostedDeploymentEnvironment('production')).toBe('production');
    expect(() => readHostedDeploymentEnvironment('uat')).toThrow(/development or production/u);
    expect(readFirebaseProjectId('openlinear-dev-larksq', 'DEV_PROJECT'))
      .toBe('openlinear-dev-larksq');
    expect(readFirestoreDatabaseId('(default)')).toBe('(default)');
    expect(readFirestoreDatabaseId('basiclinear-dev')).toBe('basiclinear-dev');
    expect(() => readFirestoreDatabaseId('UPPERCASE')).toThrow(/canonical database/u);

    expect(() => assertHostedDeploymentBinding({
      deploymentEnvironment: 'development',
      hostedEnvironment: 'uat',
      firebaseProjectId: 'openlinear-dev-larksq',
      developmentFirebaseProjectId: 'openlinear-dev-larksq',
      productionFirebaseProjectId: 'openlinear-prod-larksq',
      googleCloudProjectId: 'openlinear-dev-larksq',
      paymentMode: 'stripe',
      stripeSecret: testSecret,
      verificationAccessEmailCount: 0,
    })).not.toThrow();
    expect(() => assertHostedDeploymentBinding({
      deploymentEnvironment: 'production',
      hostedEnvironment: 'production',
      firebaseProjectId: 'openlinear-prod-larksq',
      developmentFirebaseProjectId: 'openlinear-dev-larksq',
      productionFirebaseProjectId: 'openlinear-prod-larksq',
      googleCloudProjectId: 'openlinear-prod-larksq',
      paymentMode: 'stripe',
      stripeSecret: liveSecret,
      verificationAccessEmailCount: 0,
    })).not.toThrow();
    expect(readHostedPaymentMode('verification')).toBe('verification');
    expect(readVerificationAccessEmails(' LarksQ@gmail.com,tester@example.com '))
      .toEqual(['larksq@gmail.com', 'tester@example.com']);
    expect(() => assertHostedDeploymentBinding({
      deploymentEnvironment: 'production',
      hostedEnvironment: 'production',
      firebaseProjectId: 'openlinear-prod-larksq',
      developmentFirebaseProjectId: 'openlinear-dev-larksq',
      productionFirebaseProjectId: 'openlinear-prod-larksq',
      googleCloudProjectId: 'openlinear-prod-larksq',
      paymentMode: 'verification',
      stripeSecret: null,
      verificationAccessEmailCount: 1,
    })).not.toThrow();

    for (const candidate of [
      {
        deploymentEnvironment: 'development' as const,
        hostedEnvironment: 'uat' as const,
        firebaseProjectId: 'openlinear-prod-larksq',
        developmentFirebaseProjectId: 'openlinear-dev-larksq',
        productionFirebaseProjectId: 'openlinear-prod-larksq',
        googleCloudProjectId: 'openlinear-prod-larksq',
        paymentMode: 'stripe' as const,
        stripeSecret: testSecret,
        verificationAccessEmailCount: 0,
      },
      {
        deploymentEnvironment: 'development' as const,
        hostedEnvironment: 'production' as const,
        firebaseProjectId: 'openlinear-dev-larksq',
        developmentFirebaseProjectId: 'openlinear-dev-larksq',
        productionFirebaseProjectId: 'openlinear-prod-larksq',
        googleCloudProjectId: 'openlinear-dev-larksq',
        paymentMode: 'stripe' as const,
        stripeSecret: testSecret,
        verificationAccessEmailCount: 0,
      },
      {
        deploymentEnvironment: 'development' as const,
        hostedEnvironment: 'uat' as const,
        firebaseProjectId: 'openlinear-dev-larksq',
        developmentFirebaseProjectId: 'openlinear-dev-larksq',
        productionFirebaseProjectId: 'openlinear-prod-larksq',
        googleCloudProjectId: 'openlinear-dev-larksq',
        paymentMode: 'stripe' as const,
        stripeSecret: liveSecret,
        verificationAccessEmailCount: 0,
      },
      {
        deploymentEnvironment: 'production' as const,
        hostedEnvironment: 'production' as const,
        firebaseProjectId: 'openlinear-prod-larksq',
        developmentFirebaseProjectId: 'openlinear-prod-larksq',
        productionFirebaseProjectId: 'openlinear-prod-larksq',
        googleCloudProjectId: 'openlinear-prod-larksq',
        paymentMode: 'stripe' as const,
        stripeSecret: liveSecret,
        verificationAccessEmailCount: 0,
      },
    ]) expect(() => assertHostedDeploymentBinding(candidate)).toThrow();
    expect(() => assertHostedDeploymentBinding({
      deploymentEnvironment: 'development',
      hostedEnvironment: 'uat',
      firebaseProjectId: 'openlinear-dev-larksq',
      developmentFirebaseProjectId: 'openlinear-dev-larksq',
      productionFirebaseProjectId: 'openlinear-prod-larksq',
      googleCloudProjectId: 'openlinear-dev-larksq',
      paymentMode: 'verification',
      stripeSecret: null,
      verificationAccessEmailCount: 0,
    })).toThrow(/allowlist/u);
    expect(() => readVerificationAccessEmails('same@example.com,SAME@example.com'))
      .toThrow(/distinct email/u);
  });
});

describe('billing configuration', () => {
  it('accepts bounded separate secrets, Stripe references, and an exact public origin', () => {
    expect(readBillingSecret('b'.repeat(32))).toBe('b'.repeat(32));
    expect(readStripeSecret(`sk_test_${'a'.repeat(24)}`)).toBe(`sk_test_${'a'.repeat(24)}`);
    expect(readStripeWebhookSecret(`whsec_${'b'.repeat(24)}`)).toBe(`whsec_${'b'.repeat(24)}`);
    expect(readStripePriceId('price_12345678', 'MONTHLY')).toBe('price_12345678');
    expect(readHostedPublicOrigin('https://online.example.com')).toBe('https://online.example.com');
    expect(readHostedPublicOrigin('http://127.0.0.1:4173')).toBe('http://127.0.0.1:4173');
  });

  it('rejects browser-exposed, malformed, public-http, and non-origin billing configuration', () => {
    expect(() => readBillingSecret('short')).toThrow(/BILLING_SECRET/u);
    expect(() => readStripeSecret('pk_test_browser_key_1234567890123456')).toThrow(/STRIPE_SECRET/u);
    expect(() => readStripeWebhookSecret('secret')).toThrow(/WEBHOOK_SECRET/u);
    expect(() => readStripePriceId('prod_wrongobject', 'ANNUAL')).toThrow(/ANNUAL/u);
    expect(() => readHostedPublicOrigin('http://online.example.com')).toThrow(/PUBLIC_ORIGIN/u);
    expect(() => readHostedPublicOrigin('https://online.example.com/path')).toThrow(/PUBLIC_ORIGIN/u);
  });
});

it('binds Creem credentials to the isolated deployment environment', () => {
  const input = {deploymentEnvironment: 'development' as const, hostedEnvironment: 'uat' as const,
    firebaseProjectId: 'openlinear-dev-larksq', developmentFirebaseProjectId: 'openlinear-dev-larksq',
    productionFirebaseProjectId: 'openlinear-prod-larksq', googleCloudProjectId: 'openlinear-dev-larksq',
    paymentMode: 'creem' as const, stripeSecret: null, verificationAccessEmailCount: 0,
    creemApiKey: 'creem_test_fake_key_for_unit_tests'};
  expect(readHostedPaymentMode('creem')).toBe('creem');
  expect(() => assertHostedDeploymentBinding(input)).not.toThrow();
  expect(() => assertHostedDeploymentBinding({...input, creemApiKey: 'creem_live_fake_key_for_unit_tests'})).toThrow();
  expect(() => assertHostedDeploymentBinding({...input, creemApiKey: undefined})).toThrow();
});
