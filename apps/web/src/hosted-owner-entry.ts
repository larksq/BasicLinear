import type {HostedBootstrapResponse} from './hosted-api.js';
import type {HostedGoogleIdentity} from './hosted-auth.js';
import type {HostedProviderStatus} from './hosted-environment.js';

export type HostedOwnerSignInResult =
  | {
      kind: 'identity-only';
      email: string;
      displayName: string | null;
    }
  | {
      kind: 'workspace';
      value: HostedBootstrapResponse;
      idToken: string;
    };

export async function completeHostedOwnerSignIn(
  providerStatus: HostedProviderStatus,
  identity: HostedGoogleIdentity,
  bootstrap: (idToken: string, uid: string) => Promise<HostedBootstrapResponse>,
): Promise<HostedOwnerSignInResult> {
  if (providerStatus === 'configuring') {
    return {
      kind: 'identity-only',
      email: identity.email,
      displayName: identity.displayName,
    };
  }
  const idToken = await identity.getIdToken();
  return {
    kind: 'workspace',
    value: await bootstrap(idToken, identity.uid),
    idToken,
  };
}
