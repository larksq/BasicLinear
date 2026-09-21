export type HostedBrowserEnvironment = 'development' | 'production';
export type HostedProviderStatus = 'configuring' | 'ready';

export interface HostedBrowserEnvironmentConfig {
  environment: HostedBrowserEnvironment;
  providerStatus: HostedProviderStatus;
  firebaseProjectId: string;
  label: 'Development preview' | 'Production';
}

interface HostedBrowserEnvironmentInput {
  VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT?: string;
  VITE_OPENLINEAR_PROVIDER_STATUS?: string;
  VITE_OPENLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID?: string;
  VITE_OPENLINEAR_PRODUCTION_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim() ?? '';
  if (normalized === '') throw new Error(`${name} is required for OpenLinear Online.`);
  return normalized;
}

export function readHostedBrowserEnvironment(
  input?: HostedBrowserEnvironmentInput,
): HostedBrowserEnvironmentConfig {
  const env: HostedBrowserEnvironmentInput = input ?? {
    VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT: import.meta.env.VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT,
    VITE_OPENLINEAR_PROVIDER_STATUS: import.meta.env.VITE_OPENLINEAR_PROVIDER_STATUS,
    VITE_OPENLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID: import.meta.env.VITE_OPENLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID,
    VITE_OPENLINEAR_PRODUCTION_FIREBASE_PROJECT_ID: import.meta.env.VITE_OPENLINEAR_PRODUCTION_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  };
  const environment = required(
    env.VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT,
    'VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT',
  );
  if (environment !== 'development' && environment !== 'production') {
    throw new Error('VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT must be development or production.');
  }
  const providerStatus = required(
    env.VITE_OPENLINEAR_PROVIDER_STATUS,
    'VITE_OPENLINEAR_PROVIDER_STATUS',
  );
  if (providerStatus !== 'configuring' && providerStatus !== 'ready') {
    throw new Error('VITE_OPENLINEAR_PROVIDER_STATUS must be configuring or ready.');
  }
  if (environment === 'production' && providerStatus !== 'ready') {
    throw new Error('The production browser build cannot advertise an incomplete provider setup.');
  }
  const developmentFirebaseProjectId = required(
    env.VITE_OPENLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID,
    'VITE_OPENLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID',
  );
  const productionFirebaseProjectId = required(
    env.VITE_OPENLINEAR_PRODUCTION_FIREBASE_PROJECT_ID,
    'VITE_OPENLINEAR_PRODUCTION_FIREBASE_PROJECT_ID',
  );
  if (developmentFirebaseProjectId === productionFirebaseProjectId) {
    throw new Error('Development and production browser builds must use distinct Firebase projects.');
  }
  const firebaseProjectId = required(env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID');
  const expectedProjectId = environment === 'development'
    ? developmentFirebaseProjectId
    : productionFirebaseProjectId;
  if (firebaseProjectId !== expectedProjectId) {
    throw new Error('VITE_FIREBASE_PROJECT_ID does not match the selected browser environment.');
  }
  return {
    environment,
    providerStatus,
    firebaseProjectId,
    label: environment === 'development' ? 'Development preview' : 'Production',
  };
}
