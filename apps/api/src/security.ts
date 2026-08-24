import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  addSessionCsrfToken,
  createSession,
  resolveSession,
  sessionAcceptsCsrfToken,
  type OpenLinearDatabase,
} from '@openlinear/db/sqlite';
import { AppError } from '@openlinear/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiConfig } from './config.js';

export const csrfRequestHeader = 'x-openlinear-csrf';
export const csrfResponseHeader = 'x-openlinear-csrf-token';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  revision: number;
  sessionToken: string;
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function tokenMatches(actual: string, expected: string): boolean {
  const actualDigest = Buffer.from(hashOpaqueToken(actual), 'hex');
  const expectedDigest = Buffer.from(hashOpaqueToken(expected), 'hex');
  return timingSafeEqual(actualDigest, expectedDigest);
}

function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function issueSession(
  db: OpenLinearDatabase,
  config: ApiConfig,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const sessionToken = opaqueToken();
  const csrfToken = opaqueToken();
  await createSession(db, {
    id: randomUUID(),
    userId,
    tokenHash: hashOpaqueToken(sessionToken),
    csrfTokenHash: hashOpaqueToken(csrfToken),
    expiresAt: new Date(Date.now() + config.sessionTtlSeconds * 1000),
  });
  reply.setCookie(config.sessionCookieName, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    path: '/',
  });
  reply.header(csrfResponseHeader, csrfToken);
}

export async function issueCsrfToken(
  db: OpenLinearDatabase,
  _config: ApiConfig,
  reply: FastifyReply,
  sessionToken: string,
): Promise<void> {
  const csrfToken = opaqueToken();
  const accepted = await addSessionCsrfToken(
    db,
    hashOpaqueToken(sessionToken),
    hashOpaqueToken(csrfToken),
  );
  if (!accepted) throw new AppError('AUTHENTICATION_REQUIRED', 'The local session has expired.', 401);
  reply.header(csrfResponseHeader, csrfToken);
}

export async function requireUser(
  db: OpenLinearDatabase,
  config: ApiConfig,
  request: FastifyRequest,
): Promise<AuthenticatedUser> {
  const token = request.cookies[config.sessionCookieName];
  if (!token) throw new AppError('AUTHENTICATION_REQUIRED', 'Open the local application to continue.', 401);
  const user = await resolveSession(db, hashOpaqueToken(token));
  if (user === undefined) throw new AppError('AUTHENTICATION_REQUIRED', 'The local session has expired.', 401);
  return { ...user, sessionToken: token };
}

export async function requireCsrf(
  db: OpenLinearDatabase,
  config: ApiConfig,
  request: FastifyRequest,
): Promise<void> {
  const sessionToken = request.cookies[config.sessionCookieName];
  const csrfToken = request.headers[csrfRequestHeader];
  if (!sessionToken || typeof csrfToken !== 'string') {
    throw new AppError('FORBIDDEN', 'The request is missing local CSRF proof.', 403);
  }
  const accepted = await sessionAcceptsCsrfToken(
    db,
    hashOpaqueToken(sessionToken),
    hashOpaqueToken(csrfToken),
  );
  if (!accepted) throw new AppError('FORBIDDEN', 'The local CSRF proof is invalid or expired.', 403);
}
