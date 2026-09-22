import { describe, expect, it } from 'vitest';
import { readHostedBrowserEnvironment } from '../src/hosted-environment.js';

const projects = {
  VITE_BASICLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID: 'openlinear-dev-larksq',
  VITE_BASICLINEAR_PRODUCTION_FIREBASE_PROJECT_ID: 'openlinear-prod-larksq',
};

describe('hosted browser environment', () => {
  it('renders an explicitly incomplete development preview without claiming production', () => {
    expect(readHostedBrowserEnvironment({
      ...projects,
      VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT: 'development',
      VITE_BASICLINEAR_PROVIDER_STATUS: 'configuring',
      VITE_FIREBASE_PROJECT_ID: 'openlinear-dev-larksq',
    })).toEqual({
      environment: 'development',
      providerStatus: 'configuring',
      firebaseProjectId: 'openlinear-dev-larksq',
      label: 'Development preview',
    });
  });

  it('allows production only when the production provider binding is ready', () => {
    expect(readHostedBrowserEnvironment({
      ...projects,
      VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT: 'production',
      VITE_BASICLINEAR_PROVIDER_STATUS: 'ready',
      VITE_FIREBASE_PROJECT_ID: 'openlinear-prod-larksq',
    }).label).toBe('Production');
    expect(() => readHostedBrowserEnvironment({
      ...projects,
      VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT: 'production',
      VITE_BASICLINEAR_PROVIDER_STATUS: 'configuring',
      VITE_FIREBASE_PROJECT_ID: 'openlinear-prod-larksq',
    })).toThrow(/cannot advertise an incomplete/u);
  });

  it('rejects shared or cross-environment Firebase projects', () => {
    expect(() => readHostedBrowserEnvironment({
      ...projects,
      VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT: 'development',
      VITE_BASICLINEAR_PROVIDER_STATUS: 'ready',
      VITE_FIREBASE_PROJECT_ID: 'openlinear-prod-larksq',
    })).toThrow(/does not match/u);
    expect(() => readHostedBrowserEnvironment({
      VITE_BASICLINEAR_DEVELOPMENT_FIREBASE_PROJECT_ID: 'basiclinear-shared-larksq',
      VITE_BASICLINEAR_PRODUCTION_FIREBASE_PROJECT_ID: 'basiclinear-shared-larksq',
      VITE_BASICLINEAR_DEPLOYMENT_ENVIRONMENT: 'development',
      VITE_BASICLINEAR_PROVIDER_STATUS: 'ready',
      VITE_FIREBASE_PROJECT_ID: 'basiclinear-shared-larksq',
    })).toThrow(/distinct Firebase projects/u);
  });
});
