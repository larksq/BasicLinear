import {
  HostedAuthenticationError,
  type VerifiedGoogleIdentity,
} from '@basiclinear/hosted';

export interface DecodedFirebaseIdentity {
  uid?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  firebase?: {sign_in_provider?: unknown} | null;
}

export function verifiedGoogleIdentity(claims: DecodedFirebaseIdentity): VerifiedGoogleIdentity {
  const provider = claims.firebase?.sign_in_provider;
  const uid = typeof claims.uid === 'string' ? claims.uid.trim() : '';
  const email = typeof claims.email === 'string' ? claims.email.trim() : '';
  const displayName = typeof claims.name === 'string' && claims.name.trim() !== ''
    ? claims.name.trim()
    : null;
  if (
    provider !== 'google.com'
    || claims.email_verified !== true
    || uid === ''
    || email === ''
  ) {
    throw new HostedAuthenticationError();
  }
  return {
    uid,
    email,
    emailVerified: true,
    displayName,
    provider: 'google.com',
  };
}
