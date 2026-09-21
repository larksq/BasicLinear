import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';

export interface HostedGoogleIdentity {
  uid: string;
  email: string;
  displayName: string | null;
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

let hostedAuth: Promise<Auth> | null = null;
let readyHostedAuth: Auth | null = null;
const hostedIdTokenListeners = new Set<(idToken: string) => void>();

interface HostedPopupResolver {
  _initialize(auth: Auth): Promise<unknown>;
}

function popupResolver(auth: Auth): HostedPopupResolver {
  const resolver = (auth as Auth & {_popupRedirectResolver?: HostedPopupResolver})._popupRedirectResolver;
  if (resolver === undefined) throw new Error('Google popup authentication is unavailable.');
  return resolver;
}

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is required for OpenLinear Online.`);
  }
  return value.trim();
}

export function hostedFirebaseOptions(env: ImportMetaEnv = import.meta.env): FirebaseOptions {
  return {
    apiKey: required(env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
    authDomain: required(env.VITE_FIREBASE_AUTH_DOMAIN, 'VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: required(env.VITE_FIREBASE_PROJECT_ID, 'VITE_FIREBASE_PROJECT_ID'),
    appId: required(env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  };
}

async function authClient(): Promise<Auth> {
  if (hostedAuth !== null) return hostedAuth;
  hostedAuth = (async () => {
    const app = getApps().some((candidate) => candidate.name === 'openlinear-hosted')
      ? getApp('openlinear-hosted')
      : initializeApp(hostedFirebaseOptions(), 'openlinear-hosted');
    const auth = getAuth(app);
    const emulator = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL?.trim();
    if (emulator !== undefined && emulator !== '') {
      const parsed = new URL(emulator);
      if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) {
        throw new Error('VITE_FIREBASE_AUTH_EMULATOR_URL must be a loopback HTTP origin.');
      }
      connectAuthEmulator(auth, parsed.origin, { disableWarnings: true });
    }
    await setPersistence(auth, browserLocalPersistence);
    // Firebase initializes its desktop popup iframe lazily on the first popup
    // request. Doing that work before rendering preserves the first click's
    // user activation for the actual Google window.
    await popupResolver(auth)._initialize(auth);
    readyHostedAuth = auth;
    return auth;
  })();
  return hostedAuth;
}

export async function prepareHostedGoogleSignIn(): Promise<void> {
  await authClient();
}

function publishHostedIdToken(idToken: string): void {
  for (const listener of hostedIdTokenListeners) listener(idToken);
}

function publicIdentity(user: User): HostedGoogleIdentity {
  return {
    uid: user.uid,
    email: user.email as string,
    displayName: user.displayName,
    getIdToken: async (forceRefresh = false) => {
      const idToken = await user.getIdToken(forceRefresh);
      publishHostedIdToken(idToken);
      return idToken;
    },
  };
}

export function subscribeHostedGoogleIdToken(listener: (idToken: string) => void): () => void {
  hostedIdTokenListeners.add(listener);
  return () => { hostedIdTokenListeners.delete(listener); };
}

export async function refreshHostedGoogleIdToken(): Promise<string | null> {
  const auth = readyHostedAuth ?? (hostedAuth === null ? null : await hostedAuth);
  if (auth === null) return null;
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user === null || user.email === null || !user.emailVerified
    || !user.providerData.some((entry) => entry.providerId === 'google.com')) return null;
  return publicIdentity(user).getIdToken(true);
}

export async function restoreHostedGoogleIdentity(): Promise<HostedGoogleIdentity | null> {
  const auth = await authClient();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (user === null) return null;
  const googleLinked = user.providerData.some((entry) => entry.providerId === 'google.com');
  if (!googleLinked || !user.emailVerified || user.email === null) {
    await signOut(auth);
    return null;
  }
  return publicIdentity(user);
}

export async function signInWithGoogle(): Promise<HostedGoogleIdentity> {
  // When preparation completed before the click, the popup opens in the same
  // user-activation task instead of waiting for IndexedDB persistence setup.
  const auth = readyHostedAuth ?? await authClient();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const googleLinked = user.providerData.some((entry) => entry.providerId === 'google.com');
  if (!googleLinked || !user.emailVerified || user.email === null) {
    await signOut(auth);
    throw new Error('A verified Google account is required.');
  }
  return publicIdentity(user);
}

export async function signOutHostedUser(): Promise<void> {
  if (hostedAuth === null) return;
  await signOut(await hostedAuth);
}
