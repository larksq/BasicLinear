import { createServer } from 'node:http';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import {
  createHostedHttpHandler,
  createRestApiHandler,
  createMcpHttpHandler,
  BillingService,
  FirestoreBillingRepository,
  CollaborationService,
  FirestoreCollaborationRepository,
  FirestoreInvitationRepository,
  FirestoreHostedOperationsRepository,
  FirestoreOwnerBootstrapRepository,
  FirestoreWorkspaceAuthorizationEvidenceWriter,
  FirestoreWorkspaceDirectoryRepository,
  FirestoreWorkspaceMembershipReader,
  InvitationService,
  IssueObservationService,
  HostedOperationsControl,
  HostedOperationsService,
  McpOAuthService,
  OwnerBootstrapService,
  PersonalTokenService,
  ProjectManagementService,
  WorkspaceConfigurationService,
  WorkspaceDirectoryService,
  WorkspaceAuthorizationService,
  type FirestoreAuthorizationLike,
  type FirestoreBillingLike,
  type FirestoreCollaborationLike,
  type FirestoreInvitationLike,
  type FirestoreLike,
  type FirestoreWorkspaceDirectoryLike,
  type FirestoreOperationsLike,
} from '@basiclinear/hosted';
import { verifiedGoogleIdentity } from './firebase-identity.js';
import { installHostedClientErrorHandler } from './client-error.js';
import { FirestoreCreemCheckoutAttemptStore } from './creem-checkout-attempts.js';
import { CreemBillingProvider } from './creem-billing.js';
import { StripeBillingProvider } from './stripe-billing.js';
import { VerificationBillingProvider } from './verification-billing.js';
import { GoogleBudgetNoticeVerifier } from './google-budget-notice.js';
import { ConsoleHostedOperationsTelemetrySink } from './operations-telemetry.js';
import { runHostedServerHandler } from './server-boundary.js';
import {
  assertDistinctHostedSecrets,
  assertHostedDeploymentBinding,
  assertBudgetPushAudienceOrigin,
  readAllowedOrigins,
  readBillingSecret,
  readBudgetPushAudience,
  readBudgetPushServiceAccount,
  readCollaborationSecret,
  readHostedPort,
  readHostedEnvironment,
  readHostedDeploymentEnvironment,
  readHostedPaymentMode,
  readHostedPublicOrigin,
  readInvitationSecret,
  readMcpOAuthSecret,
  readOperationsSecret,
  readPersonalTokenSecret,
  readProjectManagementSecret,
  readRestCursorSecret,
  readCreemApiKey,
  readCreemProductId,
  readCreemWebhookSecret,
  readStripePriceId,
  readStripeSecret,
  readStripeWebhookSecret,
  readVerificationAccessEmails,
  readFirebaseProjectId,
  readFirestoreDatabaseId,
  readGoogleCloudProjectId,
  requireHostedTelemetryProject,
} from './hosted-config.js';

const deploymentEnvironment = readHostedDeploymentEnvironment(
  process.env.BASICLINEAR_DEPLOYMENT_ENVIRONMENT,
);
const developmentFirebaseProjectId = readFirebaseProjectId(
  process.env.BASICLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID,
  'BASICLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID',
);
const productionFirebaseProjectId = readFirebaseProjectId(
  process.env.BASICLINEAR_PRODUCTION_FIREBASE_PROJECT_ID,
  'BASICLINEAR_PRODUCTION_FIREBASE_PROJECT_ID',
);
const firebaseProjectId = readFirebaseProjectId(
  process.env.BASICLINEAR_FIREBASE_PROJECT_ID,
  'BASICLINEAR_FIREBASE_PROJECT_ID',
);
const firestoreDatabaseId = readFirestoreDatabaseId(
  process.env.BASICLINEAR_FIRESTORE_DATABASE_ID,
);
const hostedEnvironment = readHostedEnvironment(process.env.BASICLINEAR_HOSTED_ENVIRONMENT);
const configuredGoogleCloudProjectId = readGoogleCloudProjectId(
  process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT,
);
const paymentMode = readHostedPaymentMode(process.env.BASICLINEAR_PAYMENT_MODE);
const verificationAccessEmails = readVerificationAccessEmails(
  process.env.BASICLINEAR_VERIFICATION_ACCESS_EMAILS,
);
const verificationAccessEmailSet = new Set(verificationAccessEmails);
const stripeSecret = paymentMode === 'stripe'
  ? readStripeSecret(process.env.BASICLINEAR_STRIPE_SECRET)
  : null;
const creemApiKey = paymentMode === 'creem' ? readCreemApiKey(process.env.BASICLINEAR_CREEM_API_KEY) : null;
assertHostedDeploymentBinding({
  deploymentEnvironment,
  hostedEnvironment,
  firebaseProjectId,
  developmentFirebaseProjectId,
  productionFirebaseProjectId,
  googleCloudProjectId: configuredGoogleCloudProjectId,
  paymentMode,
  stripeSecret,
  creemApiKey,
  verificationAccessEmailCount: verificationAccessEmails.length,
});

const existingFirebaseApp = getApps()[0];
if (
  existingFirebaseApp !== undefined
  && existingFirebaseApp.options.projectId !== undefined
  && existingFirebaseApp.options.projectId !== firebaseProjectId
) {
  throw new Error('The initialized Firebase app does not match BASICLINEAR_FIREBASE_PROJECT_ID.');
}
const firebaseApp = existingFirebaseApp ?? initializeApp({projectId: firebaseProjectId});

const auth = getAuth(firebaseApp);
const runtimeFirestore = getFirestore(firebaseApp, firestoreDatabaseId);
const firestore = runtimeFirestore as unknown as FirestoreLike
  & FirestoreAuthorizationLike
  & FirestoreBillingLike
  & FirestoreInvitationLike
  & FirestoreCollaborationLike
  & FirestoreOperationsLike;
const repository = new FirestoreOwnerBootstrapRepository(firestore);
const workspaceAuthorizationService = new WorkspaceAuthorizationService(
  new FirestoreWorkspaceMembershipReader(firestore),
  new FirestoreWorkspaceAuthorizationEvidenceWriter(firestore),
);
const allowedOrigins = readAllowedOrigins(process.env.BASICLINEAR_HOSTED_ORIGINS);
const publicOrigin = readHostedPublicOrigin(process.env.BASICLINEAR_HOSTED_PUBLIC_ORIGIN);
if (!allowedOrigins.includes(publicOrigin)) {
  throw new Error('BASICLINEAR_HOSTED_PUBLIC_ORIGIN must appear in BASICLINEAR_HOSTED_ORIGINS.');
}
const monthlyPriceId = paymentMode === 'stripe'
  ? readStripePriceId(
    process.env.BASICLINEAR_STRIPE_MONTHLY_PRICE_ID,
    'BASICLINEAR_STRIPE_MONTHLY_PRICE_ID',
  )
  : paymentMode === 'creem'
    ? readCreemProductId(process.env.BASICLINEAR_CREEM_MONTHLY_PRODUCT_ID, 'BASICLINEAR_CREEM_MONTHLY_PRODUCT_ID')
    : 'price_verification_monthly_v1';
const annualPriceId = paymentMode === 'stripe'
  ? readStripePriceId(
    process.env.BASICLINEAR_STRIPE_ANNUAL_PRICE_ID,
    'BASICLINEAR_STRIPE_ANNUAL_PRICE_ID',
  )
  : paymentMode === 'creem'
    ? readCreemProductId(process.env.BASICLINEAR_CREEM_ANNUAL_PRODUCT_ID, 'BASICLINEAR_CREEM_ANNUAL_PRODUCT_ID')
    : 'price_verification_annual_v1';
const billingSecret = readBillingSecret(process.env.BASICLINEAR_BILLING_SECRET);
const invitationSecret = readInvitationSecret(process.env.BASICLINEAR_INVITATION_SECRET);
const collaborationSecret = readCollaborationSecret(process.env.BASICLINEAR_COLLABORATION_SECRET);
const personalTokenSecret = readPersonalTokenSecret(process.env.BASICLINEAR_PERSONAL_TOKEN_SECRET);
const projectManagementSecret = readProjectManagementSecret(process.env.BASICLINEAR_PM_SECRET);
const restCursorSecret = readRestCursorSecret(process.env.BASICLINEAR_REST_CURSOR_SECRET);
const mcpOAuthSecret = readMcpOAuthSecret(process.env.BASICLINEAR_MCP_OAUTH_SECRET);
const operationsSecret = readOperationsSecret(process.env.BASICLINEAR_OPERATIONS_SECRET);
const googleCloudProjectId = requireHostedTelemetryProject(
  hostedEnvironment,
  configuredGoogleCloudProjectId,
);
const budgetPushAudience = readBudgetPushAudience(
  process.env.BASICLINEAR_BUDGET_PUSH_AUDIENCE,
);
assertBudgetPushAudienceOrigin(budgetPushAudience, publicOrigin);
assertDistinctHostedSecrets({
  BASICLINEAR_BILLING_SECRET: billingSecret,
  BASICLINEAR_INVITATION_SECRET: invitationSecret,
  BASICLINEAR_COLLABORATION_SECRET: collaborationSecret,
  BASICLINEAR_PERSONAL_TOKEN_SECRET: personalTokenSecret,
  BASICLINEAR_PM_SECRET: projectManagementSecret,
  BASICLINEAR_REST_CURSOR_SECRET: restCursorSecret,
  BASICLINEAR_MCP_OAUTH_SECRET: mcpOAuthSecret,
  BASICLINEAR_OPERATIONS_SECRET: operationsSecret,
});
const operationsService = new HostedOperationsService(
  new FirestoreHostedOperationsRepository(firestore),
  {secret: operationsSecret, environment: hostedEnvironment},
);
const operationsControl = new HostedOperationsControl({
  secret: operationsSecret,
  sink: new ConsoleHostedOperationsTelemetrySink(googleCloudProjectId),
});
const budgetNoticeVerifier = new GoogleBudgetNoticeVerifier({
  audience: budgetPushAudience,
  serviceAccountEmail: readBudgetPushServiceAccount(
    process.env.BASICLINEAR_BUDGET_PUSH_SERVICE_ACCOUNT,
  ),
});
const billingProvider = paymentMode === 'stripe'
  ? new StripeBillingProvider({
    secretKey: stripeSecret as string,
    webhookSecret: readStripeWebhookSecret(process.env.BASICLINEAR_STRIPE_WEBHOOK_SECRET),
    monthlyPriceId,
    annualPriceId,
    publicOrigin,
  })
  : paymentMode === 'creem'
    ? new CreemBillingProvider({
      checkoutAttemptStore: new FirestoreCreemCheckoutAttemptStore(getFirestore(firebaseApp, firestoreDatabaseId)),
      apiKey: creemApiKey as string,
      webhookSecret: readCreemWebhookSecret(process.env.BASICLINEAR_CREEM_WEBHOOK_SECRET),
      mode: deploymentEnvironment === 'production' ? 'live' : 'test',
      monthlyProductId: monthlyPriceId, annualProductId: annualPriceId, publicOrigin,
    })
    : new VerificationBillingProvider();
const billingService = new BillingService(
  new FirestoreBillingRepository(firestore),
  workspaceAuthorizationService,
  billingProvider,
  {secret: billingSecret, monthlyPriceId, annualPriceId, activationPolicy: operationsService},
);
const bootstrapService = new OwnerBootstrapService(repository, {
  postBootstrap: async (identity, result) => {
    if (!verificationAccessEmailSet.has(identity.email)) return;
    await billingService.ensureVerificationAccess({
      workspaceId: result.record.workspaceId,
      ownerUserId: identity.uid,
      ownerEmail: identity.email,
    });
  },
});
const entitlementPolicy = billingService.entitlementPolicy();
const collaborationRepository = new FirestoreCollaborationRepository(firestore);
const workspaceDirectoryService = new WorkspaceDirectoryService(
  new FirestoreWorkspaceDirectoryRepository(firestore as unknown as FirestoreWorkspaceDirectoryLike),
);
const invitationService = new InvitationService(
  new FirestoreInvitationRepository(firestore),
  workspaceAuthorizationService,
  {
    secret: invitationSecret,
    entitlementPolicy,
    seatReconciler: billingService,
  },
);
const collaborationService = new CollaborationService(
  collaborationRepository,
  workspaceAuthorizationService,
  {
    secret: collaborationSecret,
    entitlementPolicy,
  },
);
const issueObservationService = new IssueObservationService(
  collaborationRepository,
  workspaceAuthorizationService,
  {secret: collaborationSecret},
);
const projectManagementService = new ProjectManagementService(
  collaborationRepository,
  workspaceAuthorizationService,
  {
    secret: projectManagementSecret,
    entitlementPolicy,
  },
);
const workspaceConfigurationService = new WorkspaceConfigurationService(
  collaborationRepository,
  workspaceAuthorizationService,
  {
    secret: projectManagementSecret,
    entitlementPolicy,
  },
);
const personalTokenService = new PersonalTokenService(
  collaborationRepository,
  workspaceAuthorizationService,
  {
    secret: personalTokenSecret,
    entitlementPolicy,
  },
);
const restApiHandler = createRestApiHandler({
  personalTokenService,
  projectManagementService,
  collaborationService,
  invitationService,
  billingService,
  cursorSecret: restCursorSecret,
});
const identityVerifier = {
  verifyGoogleIdToken: async (token: string) => verifiedGoogleIdentity(
    await auth.verifyIdToken(token, true),
  ),
};
const mcpOAuthService = new McpOAuthService(
  collaborationRepository,
  workspaceAuthorizationService,
  {secret: mcpOAuthSecret, publicOrigin},
);
const mcpHttpHandler = createMcpHttpHandler({
  oauthService: mcpOAuthService,
  identityVerifier,
  projectManagementService,
  collaborationService,
  invitationService,
  billingService,
});
const handler = createHostedHttpHandler({
  readinessCheck: async () => {
    // A missing document is fine: a completed read proves database/IAM access.
    // Never write health state or inspect customer documents for this probe.
    await runtimeFirestore.doc('_health/readiness').get();
  },
  identityVerifier,
  bootstrapService,
  workspaceAuthorizationService,
  workspaceDirectoryService,
  invitationService,
  collaborationService,
  issueObservationService,
  billingService,
  billingWebhookVerifier: billingProvider,
  billingWebhookProvider: paymentMode === 'creem' ? 'creem' : 'stripe',
  personalTokenService,
  projectManagementService,
  workspaceConfigurationService,
  restApiHandler,
  mcpHttpHandler,
  allowedOrigins,
  operationsControl,
  operationsService,
  budgetNoticeVerifier,
});

const server = createServer((request, response) => {
  runHostedServerHandler(handler, request, response);
});
installHostedClientErrorHandler(server);

const port = readHostedPort(process.env.PORT);
server.listen(port, '0.0.0.0', () => {
  console.info(`BasicLinear hosted service listening on port ${port}.`);
});

const close = (): void => {
  server.close((error) => {
    if (error !== undefined) {
      console.error('BasicLinear hosted service shutdown failed.');
      process.exitCode = 1;
    }
  });
};

process.once('SIGTERM', close);
process.once('SIGINT', close);
