import { OAuth2Client, type LoginTicket, type TokenPayload } from 'google-auth-library';

interface GoogleIdTokenVerifier {
  verifyIdToken(input: {idToken: string; audience: string}): Promise<LoginTicket>;
}

export class GoogleBudgetNoticeVerifier {
  readonly #audience: string;
  readonly #serviceAccountEmail: string;
  readonly #verifier: GoogleIdTokenVerifier;
  readonly #clock: () => Date;

  constructor(options: {
    audience: string;
    serviceAccountEmail: string;
    verifier?: GoogleIdTokenVerifier;
    clock?: () => Date;
  }) {
    this.#audience = options.audience;
    this.#serviceAccountEmail = options.serviceAccountEmail;
    this.#verifier = options.verifier ?? new OAuth2Client();
    this.#clock = options.clock ?? (() => new Date());
  }

  async verifyPubSubToken(token: string): Promise<void> {
    if (token.length < 64 || token.length > 8_192 || /\s/u.test(token)) {
      throw new Error('BUDGET_PUSH_IDENTITY_INVALID');
    }
    let payload: TokenPayload | undefined;
    try {
      payload = (await this.#verifier.verifyIdToken({
        idToken: token,
        audience: this.#audience,
      })).getPayload();
    } catch {
      throw new Error('BUDGET_PUSH_IDENTITY_INVALID');
    }
    const nowSeconds = Math.floor(this.#clock().getTime() / 1_000);
    if (!Number.isSafeInteger(nowSeconds)
      || payload === undefined
      || (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com')
      || payload.aud !== this.#audience
      || payload.email !== this.#serviceAccountEmail
      || payload.email_verified !== true
      || typeof payload.sub !== 'string' || !/^[0-9]{6,32}$/u.test(payload.sub)
      || !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)
      || payload.iat > nowSeconds + 300 || payload.exp <= nowSeconds || payload.exp <= payload.iat
      || payload.exp - payload.iat > 3_900 || nowSeconds - payload.iat > 3_900) {
      throw new Error('BUDGET_PUSH_IDENTITY_INVALID');
    }
  }
}
