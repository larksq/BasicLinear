const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function readHostedPort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 8080;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function readAllowedOrigins(value: string | undefined): string[] {
  if (value === undefined || value.trim() === '') return [];
  return value.split(',').map((entry) => {
    const parsed = new URL(entry.trim());
    const secure = parsed.protocol === 'https:';
    const loopbackHttp = parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname);
    if (
      (!secure && !loopbackHttp)
      || parsed.pathname !== '/'
      || parsed.search !== ''
      || parsed.hash !== ''
      || parsed.username !== ''
      || parsed.password !== ''
    ) {
      throw new Error('BASICLINEAR_HOSTED_ORIGINS must contain comma-separated origins.');
    }
    return parsed.origin;
  });
}

export function readInvitationSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  const length = Buffer.byteLength(secret, 'utf8');
  if (length < 32 || length > 512) {
    throw new Error('BASICLINEAR_INVITATION_SECRET must contain between 32 and 512 bytes.');
  }
  return secret;
}

export function readCollaborationSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  const length = Buffer.byteLength(secret, 'utf8');
  if (length < 32 || length > 512) {
    throw new Error('BASICLINEAR_COLLABORATION_SECRET must contain between 32 and 512 bytes.');
  }
  return secret;
}

export function readBillingSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  const length = Buffer.byteLength(secret, 'utf8');
  if (length < 32 || length > 512) {
    throw new Error('BASICLINEAR_BILLING_SECRET must contain between 32 and 512 bytes.');
  }
  return secret;
}

function readBoundedSecret(value: string | undefined, name: string): string {
  const secret = value?.trim() ?? '';
  const length = Buffer.byteLength(secret, 'utf8');
  if (length < 32 || length > 512) {
    throw new Error(`${name} must contain between 32 and 512 bytes.`);
  }
  return secret;
}

export function readPersonalTokenSecret(value: string | undefined): string {
  return readBoundedSecret(value, 'BASICLINEAR_PERSONAL_TOKEN_SECRET');
}

export function readProjectManagementSecret(value: string | undefined): string {
  return readBoundedSecret(value, 'BASICLINEAR_PM_SECRET');
}

export function readRestCursorSecret(value: string | undefined): string {
  return readBoundedSecret(value, 'BASICLINEAR_REST_CURSOR_SECRET');
}

export function readMcpOAuthSecret(value: string | undefined): string {
  return readBoundedSecret(value, 'BASICLINEAR_MCP_OAUTH_SECRET');
}

export function readOperationsSecret(value: string | undefined): string {
  return readBoundedSecret(value, 'BASICLINEAR_OPERATIONS_SECRET');
}

export function readHostedEnvironment(value: string | undefined): 'uat' | 'production' {
  const environment = value?.trim();
  if (environment !== 'uat' && environment !== 'production') {
    throw new Error('BASICLINEAR_HOSTED_ENVIRONMENT must be uat or production.');
  }
  return environment;
}

export type HostedDeploymentEnvironment = 'development' | 'production';
export type HostedStripeMode = 'test' | 'live';
export type HostedPaymentMode = 'stripe' | 'creem' | 'verification';

export function readHostedPaymentMode(value: string | undefined): HostedPaymentMode {
  const mode = value?.trim();
  if (mode !== 'stripe' && mode !== 'creem' && mode !== 'verification') {
    throw new Error('BASICLINEAR_PAYMENT_MODE must be stripe, creem or verification.');
  }
  return mode;
}

export function readVerificationAccessEmails(value: string | undefined): string[] {
  const raw = value?.trim() ?? '';
  if (raw === '') return [];
  const emails = raw.split(',').map((entry) => entry.trim().toLowerCase());
  if (emails.length > 20 || new Set(emails).size !== emails.length
    || emails.some((email) => email.length > 254
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))) {
    throw new Error('BASICLINEAR_VERIFICATION_ACCESS_EMAILS must contain distinct email addresses.');
  }
  return emails;
}

export function readHostedDeploymentEnvironment(
  value: string | undefined,
): HostedDeploymentEnvironment {
  const environment = value?.trim();
  if (environment !== 'development' && environment !== 'production') {
    throw new Error('BASICLINEAR_DEPLOYMENT_ENVIRONMENT must be development or production.');
  }
  return environment;
}

export function readFirebaseProjectId(value: string | undefined, name: string): string {
  const projectId = value?.trim() ?? '';
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId)) {
    throw new Error(`${name} must be a canonical Firebase project ID.`);
  }
  return projectId;
}

export function readFirestoreDatabaseId(value: string | undefined): string {
  const databaseId = value?.trim() ?? '';
  if (databaseId === '(default)') return databaseId;
  if (!/^[a-z][a-z0-9-]{2,61}[a-z0-9]$/u.test(databaseId)) {
    throw new Error('BASICLINEAR_FIRESTORE_DATABASE_ID must be (default) or a canonical database ID.');
  }
  return databaseId;
}

export function hostedStripeMode(secret: string): HostedStripeMode {
  if (secret.startsWith('sk_test_')) return 'test';
  if (secret.startsWith('sk_live_')) return 'live';
  throw new Error('BASICLINEAR_STRIPE_SECRET must identify one Stripe test or live account mode.');
}

export function assertHostedDeploymentBinding(input: Readonly<{
  deploymentEnvironment: HostedDeploymentEnvironment;
  hostedEnvironment: 'uat' | 'production';
  firebaseProjectId: string;
  developmentFirebaseProjectId: string;
  productionFirebaseProjectId: string;
  googleCloudProjectId: string | null;
  paymentMode: HostedPaymentMode;
  stripeSecret: string | null;
  creemApiKey?: string | null;
  verificationAccessEmailCount: number;
}>): void {
  if (input.developmentFirebaseProjectId === input.productionFirebaseProjectId) {
    throw new Error('Development and production must use distinct Firebase projects.');
  }
  const development = input.deploymentEnvironment === 'development';
  const expectedProjectId = development
    ? input.developmentFirebaseProjectId
    : input.productionFirebaseProjectId;
  const expectedHostedEnvironment = development ? 'uat' : 'production';
  const expectedStripeMode: HostedStripeMode = development ? 'test' : 'live';
  if (input.firebaseProjectId !== expectedProjectId) {
    throw new Error('BASICLINEAR_FIREBASE_PROJECT_ID does not match the selected deployment environment.');
  }
  if (input.googleCloudProjectId !== null && input.googleCloudProjectId !== expectedProjectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT does not match the selected Firebase project.');
  }
  if (input.hostedEnvironment !== expectedHostedEnvironment) {
    throw new Error('BASICLINEAR_HOSTED_ENVIRONMENT does not match the selected deployment environment.');
  }
  if (input.paymentMode === 'stripe') {
    if (input.stripeSecret === null || hostedStripeMode(input.stripeSecret) !== expectedStripeMode) {
      throw new Error('The Stripe account mode does not match the selected deployment environment.');
    }
  } else if (input.paymentMode === 'creem') {
    const key = readCreemApiKey(input.creemApiKey ?? undefined);
    if (key.startsWith('creem_test_') !== development || input.stripeSecret !== null) {
      throw new Error('The Creem account mode does not match the selected deployment environment.');
    }
  } else if (input.stripeSecret !== null || input.verificationAccessEmailCount < 1) {
    throw new Error('Verification payment mode requires an exact server-side account allowlist and no Stripe key.');
  }
}

export function readBudgetPushAudience(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('BASICLINEAR_BUDGET_PUSH_AUDIENCE must be the exact budget push URL.');
  }
  const secure = parsed.protocol === 'https:';
  const loopbackHttp = parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname);
  if ((!secure && !loopbackHttp)
    || parsed.pathname !== '/api/v1/hosted/operations/budget-notice'
    || parsed.search !== '' || parsed.hash !== ''
    || parsed.username !== '' || parsed.password !== ''
    || raw !== parsed.href) {
    throw new Error('BASICLINEAR_BUDGET_PUSH_AUDIENCE must be the exact budget push URL.');
  }
  return parsed.href;
}

export function readBudgetPushServiceAccount(value: string | undefined): string {
  const email = value?.trim().toLowerCase() ?? '';
  if (email.length > 254
    || !/^[a-z0-9][a-z0-9._-]{2,127}@[a-z0-9-]{3,128}\.iam\.gserviceaccount\.com$/u.test(email)) {
    throw new Error('BASICLINEAR_BUDGET_PUSH_SERVICE_ACCOUNT must be an exact service-account email.');
  }
  return email;
}

export function readGoogleCloudProjectId(value: string | undefined): string | null {
  const projectId = value?.trim() ?? '';
  if (projectId === '') return null;
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(projectId)) {
    throw new Error('GOOGLE_CLOUD_PROJECT must be a canonical Google Cloud project ID.');
  }
  return projectId;
}

export function assertBudgetPushAudienceOrigin(audience: string, publicOrigin: string): void {
  if (new URL(audience).origin !== publicOrigin) {
    throw new Error('BASICLINEAR_BUDGET_PUSH_AUDIENCE must use BASICLINEAR_HOSTED_PUBLIC_ORIGIN.');
  }
}

export function requireHostedTelemetryProject(
  environment: 'uat' | 'production',
  projectId: string | null,
): string | null {
  if (environment === 'production' && projectId === null) {
    throw new Error('GOOGLE_CLOUD_PROJECT is required for production hosted telemetry.');
  }
  return projectId;
}

export function assertDistinctHostedSecrets(
  values: Readonly<Record<string, string>>,
): void {
  const entries = Object.entries(values);
  for (let index = 0; index < entries.length; index += 1) {
    const [name, value] = entries[index] as [string, string];
    for (let comparison = index + 1; comparison < entries.length; comparison += 1) {
      const [otherName, otherValue] = entries[comparison] as [string, string];
      if (value === otherValue) {
        throw new Error(`${name} and ${otherName} must use distinct secrets.`);
      }
    }
  }
}

export function readStripeSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  if (!/^sk_(?:test|live)_[A-Za-z0-9_]{16,240}$/u.test(secret)) {
    throw new Error('BASICLINEAR_STRIPE_SECRET must be a server-side Stripe secret key.');
  }
  return secret;
}

export function readStripeWebhookSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  if (!/^whsec_[A-Za-z0-9_]{16,240}$/u.test(secret)) {
    throw new Error('BASICLINEAR_STRIPE_WEBHOOK_SECRET must be a Stripe endpoint secret.');
  }
  return secret;
}

export function readStripePriceId(value: string | undefined, name: string): string {
  const priceId = value?.trim() ?? '';
  if (!/^price_[A-Za-z0-9]{8,120}$/u.test(priceId)) {
    throw new Error(`${name} must be a Stripe Price reference.`);
  }
  return priceId;
}

export function readHostedPublicOrigin(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('BASICLINEAR_HOSTED_PUBLIC_ORIGIN must be one exact origin.');
  }
  const secure = parsed.protocol === 'https:';
  const loopbackHttp = parsed.protocol === 'http:' && loopbackHosts.has(parsed.hostname);
  if ((!secure && !loopbackHttp) || raw !== parsed.origin) {
    throw new Error('BASICLINEAR_HOSTED_PUBLIC_ORIGIN must be one exact HTTPS or loopback origin.');
  }
  return parsed.origin;
}


export function readCreemApiKey(value: string | undefined): string {
  const key = value?.trim() ?? '';
  if (!/^creem_[A-Za-z0-9_-]{16,240}$/.test(key)) throw new Error('BASICLINEAR_CREEM_API_KEY must be a server-side Creem key.');
  return key;
}
export function readCreemWebhookSecret(value: string | undefined): string {
  const secret = value?.trim() ?? '';
  if (secret.length < 16 || secret.length > 256 || /\s/.test(secret)) throw new Error('BASICLINEAR_CREEM_WEBHOOK_SECRET is required.');
  return secret;
}
export function readCreemProductId(value: string | undefined, name: string): string {
  const id = value?.trim() ?? '';
  if (!/^prod_[A-Za-z0-9]{8,120}$/.test(id)) throw new Error(`${name} must be a Creem product ID.`);
  return id;
}
