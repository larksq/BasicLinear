import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const development = JSON.parse(readFileSync(
  resolve(root, 'ops/hosted/environments/development.json'),
  'utf8',
));
const production = JSON.parse(readFileSync(
  resolve(root, 'ops/hosted/environments/production.json'),
  'utf8',
));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

invariant(development.deploymentEnvironment === 'development', 'Development manifest identity is invalid.');
invariant(production.deploymentEnvironment === 'production', 'Production manifest identity is invalid.');
invariant(development.hostedControlEnvironment === 'uat', 'Development must use the UAT control environment.');
invariant(production.hostedControlEnvironment === 'production', 'Production must use the production control environment.');
invariant(development.stripeMode === 'test', 'Development must use Stripe test mode.');
invariant(production.stripeMode === 'live', 'Production must use Stripe live mode.');
invariant(development.googleSignInEnabled === true, 'Development Google sign-in must be recorded as enabled.');
invariant(production.googleSignInEnabled === true, 'Production Google sign-in must be recorded as enabled.');
invariant(development.googleCloudBillingEnabled === true, 'Development Cloud Run billing must be enabled.');
invariant(production.googleCloudBillingEnabled === true, 'Production Cloud Run billing must be enabled.');
for (const manifest of [development, production]) {
  invariant(['verification', 'stripe', 'creem'].includes(manifest.paymentMode), 'Unknown payment mode.');
  if (manifest.paymentMode === 'verification') {
    invariant(manifest.stripeConnected === false && manifest.creemConnected !== true,
      'Verification deployments must not claim a connected payment provider.');
    invariant(manifest.verificationAccountCount === 1,
      'Each verification deployment must record one server-side test account.');
  } else if (manifest.paymentMode === 'creem') {
    invariant(manifest.creemConnected === true && manifest.stripeConnected === false,
      'Creem deployments must record their connected provider.');
    invariant(manifest.creemMode === (manifest.deploymentEnvironment === 'development' ? 'test' : 'live'),
      'Creem mode must match the isolated deployment environment.');
  } else {
    invariant(manifest.stripeConnected === true && manifest.creemConnected !== true,
      'Stripe deployments must record their connected provider.');
  }
}
invariant(development.backend.status === 'deployed' && production.backend.status === 'deployed',
  'Both isolated Cloud Run services must be deployed.');
invariant(development.frontend.providerStatus === 'ready', 'Development providers must be ready.');
invariant(
  development.frontend.url === 'https://basiclinear-development.vercel.app',
  'Development preview URL is not the BasicLinear Vercel alias.',
);
invariant(production.frontend.providerStatus === 'ready',
  'Production frontend must be ready.');
invariant(production.frontend.url === 'https://basiclinear.qiaosun.me',
  'Production must use the BasicLinear canonical origin.');
invariant(
  development.firebaseProjectId !== production.firebaseProjectId,
  'Development and production must use distinct Firebase projects.',
);
invariant(
  development.firebaseWebAppId !== production.firebaseWebAppId,
  'Development and production must use distinct Firebase Web Apps.',
);
invariant(
  development.firebaseAuthDomain !== production.firebaseAuthDomain,
  'Development and production must use distinct Firebase Auth domains.',
);
invariant(
  development.backend.service !== production.backend.service,
  'Development and production must use distinct backend services.',
);
invariant(
  development.frontend.project !== production.frontend.project,
  'Development and production must use distinct Vercel projects.',
);

const buildIndex = process.argv.indexOf('--build');
if (buildIndex !== -1) {
  const selected = process.argv[buildIndex + 1];
  invariant(selected === 'development' || selected === 'production', '--build requires development or production.');
  const manifest = selected === 'development' ? development : production;
  invariant(
    process.env.VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT === selected,
    'The browser deployment environment does not match the selected build.',
  );
  invariant(
    process.env.VITE_BASICLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID === development.firebaseProjectId,
    'The development Firebase project does not match the environment manifest.',
  );
  invariant(
    process.env.VITE_BASICLINEAR_PRODUCTION_FIREBASE_PROJECT_ID === production.firebaseProjectId,
    'The production Firebase project does not match the environment manifest.',
  );
  invariant(
    process.env.VITE_FIREBASE_PROJECT_ID === manifest.firebaseProjectId,
    'The browser Firebase project does not match the selected environment manifest.',
  );
  const providerStatus = process.env.VITE_BASICLINEAR_PROVIDER_STATUS;
  invariant(providerStatus === 'configuring' || providerStatus === 'ready', 'The provider status is invalid.');
  invariant(selected !== 'production' || providerStatus === 'ready', 'Production cannot be built with incomplete providers.');
  if (providerStatus === 'ready') {
    for (const name of [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_APP_ID',
    ]) invariant((process.env[name] ?? '').trim() !== '', `${name} is required for a provider-ready build.`);
  }
}

console.info('Hosted development/production environment contract is valid.');
