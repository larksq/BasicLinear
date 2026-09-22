import {beforeEach, describe, expect, it, vi} from 'vitest';

const firebase = vi.hoisted(() => {
  const initializePopupResolver = vi.fn().mockResolvedValue(undefined);
  const user = {
    uid: 'owner-1',
    email: 'owner@example.com',
    emailVerified: true,
    displayName: 'Owner',
    providerData: [{providerId: 'google.com'}],
    getIdToken: vi.fn().mockResolvedValue('id-token'),
  };
  const auth = {
    name: 'hosted-auth',
    _popupRedirectResolver: {_initialize: initializePopupResolver},
    currentUser: user,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  };
  return {
    app: {name: 'basiclinear-hosted'},
    auth,
    getApps: vi.fn((): Array<{name: string}> => []),
    initializeApp: vi.fn(() => ({name: 'basiclinear-hosted'})),
    getAuth: vi.fn(() => auth),
    initializePopupResolver,
    setPersistence: vi.fn().mockResolvedValue(undefined),
    signInWithPopup: vi.fn().mockResolvedValue({
      user,
    }),
  };
});

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => firebase.app),
  getApps: firebase.getApps,
  initializeApp: firebase.initializeApp,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: {name: 'local'},
  connectAuthEmulator: vi.fn(),
  getAuth: firebase.getAuth,
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  setPersistence: firebase.setPersistence,
  signInWithPopup: firebase.signInWithPopup,
  signOut: vi.fn(),
}));

describe('hosted Google authentication preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_FIREBASE_API_KEY', 'firebase-api-key');
    vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', 'basiclinear-dev.example.test');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'basiclinear-dev-test');
    vi.stubEnv('VITE_FIREBASE_APP_ID', 'firebase-app-id');
  });

  it('finishes local persistence before the first popup is requested', async () => {
    const {
      prepareHostedGoogleSignIn,
      refreshHostedGoogleIdToken,
      restoreHostedGoogleIdentity,
      signInWithGoogle,
      subscribeHostedGoogleIdToken,
    } = await import('../src/hosted-auth.js');

    await prepareHostedGoogleSignIn();
    expect(firebase.setPersistence).toHaveBeenCalledOnce();
    expect(firebase.initializePopupResolver).toHaveBeenCalledOnce();

    await expect(restoreHostedGoogleIdentity()).resolves.toMatchObject({
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner',
    });
    expect(firebase.auth.authStateReady).toHaveBeenCalledOnce();
    expect(firebase.signInWithPopup).not.toHaveBeenCalled();

    await expect(signInWithGoogle()).resolves.toMatchObject({
      uid: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Owner',
    });
    expect(firebase.signInWithPopup).toHaveBeenCalledOnce();
    expect(firebase.setPersistence.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.signInWithPopup.mock.invocationCallOrder[0] ?? 0,
    );
    expect(firebase.initializePopupResolver.mock.invocationCallOrder[0]).toBeLessThan(
      firebase.signInWithPopup.mock.invocationCallOrder[0] ?? 0,
    );

    const refreshedTokens: string[] = [];
    const unsubscribe = subscribeHostedGoogleIdToken((idToken) => refreshedTokens.push(idToken));
    await expect(refreshHostedGoogleIdToken()).resolves.toBe('id-token');
    expect(firebase.auth.currentUser.getIdToken).toHaveBeenLastCalledWith(true);
    expect(refreshedTokens).toEqual(['id-token']);
    unsubscribe();
  });
});
