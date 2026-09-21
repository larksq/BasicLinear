import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type {
  CollaborationRepository,
  CollaborationTransaction,
} from './collaboration-service.js';
import {
  personalTokenScopes,
  type PersonalTokenScope,
} from './personal-token-service.js';
import {
  type WorkspaceAction,
  type WorkspaceAuthorizationService,
  type WorkspacePrincipal,
  type WorkspaceRole,
} from './workspace-authorization.js';

export const mcpProtocolVersion = '2026-07-28' as const;
export const mcpAccessTokenLifetimeSeconds = 10 * 60;
export const mcpRefreshTokenLifetimeSeconds = 30 * 24 * 60 * 60;
export const mcpAuthorizationRequestLifetimeSeconds = 10 * 60;
export const mcpAuthorizationCodeLifetimeSeconds = 5 * 60;
export const mcpOAuthScopes = personalTokenScopes;
export type McpOAuthScope = PersonalTokenScope;

const clientKeys = [
  'schemaVersion', 'id', 'name', 'redirectUris', 'tokenEndpointAuthMethod', 'grantTypes',
  'responseTypes', 'createdAt', 'revision', 'binding',
] as const;
const requestKeys = [
  'schemaVersion', 'id', 'clientId', 'redirectUri', 'workspaceId', 'scopes', 'state',
  'codeChallenge', 'codeChallengeMethod', 'resource', 'status', 'userId', 'createdAt',
  'expiresAt', 'decidedAt', 'codeDigest', 'revision', 'binding',
] as const;
const codeKeys = [
  'schemaVersion', 'digest', 'requestId', 'clientId', 'redirectUri', 'workspaceId',
  'userId', 'scopes', 'codeChallenge', 'resource', 'createdAt', 'expiresAt', 'usedAt',
  'familyId', 'revision', 'binding',
] as const;
const grantKeys = [
  'schemaVersion', 'id', 'clientId', 'workspaceId', 'userId', 'membershipRevision',
  'scopes', 'resource', 'createdAt', 'updatedAt', 'revokedAt', 'revision', 'binding',
] as const;
const familyKeys = [
  'schemaVersion', 'id', 'grantId', 'clientId', 'workspaceId', 'userId', 'scopes',
  'resource', 'currentRefreshDigest', 'createdAt', 'expiresAt', 'revokedAt', 'revision',
  'binding',
] as const;
const accessKeys = [
  'schemaVersion', 'digest', 'familyId', 'grantId', 'clientId', 'workspaceId', 'userId',
  'scopes', 'resource', 'createdAt', 'expiresAt', 'revokedAt', 'revision', 'binding',
] as const;
const refreshKeys = [
  'schemaVersion', 'digest', 'familyId', 'grantId', 'clientId', 'workspaceId', 'userId',
  'scopes', 'resource', 'createdAt', 'expiresAt', 'usedAt', 'replacedByDigest',
  'revokedAt', 'revision', 'binding',
] as const;

const paths = {
  client: (clientId: string) => `oauthClients/${clientId}`,
  request: (requestId: string) => `oauthAuthorizationRequests/${requestId}`,
  code: (digest: string) => `oauthAuthorizationCodes/${digest}`,
  grant: (grantId: string) => `oauthGrants/${grantId}`,
  family: (familyId: string) => `oauthTokenFamilies/${familyId}`,
  access: (digest: string) => `oauthAccessTokens/${digest}`,
  refresh: (digest: string) => `oauthRefreshTokens/${digest}`,
  workspace: (workspaceId: string) => `workspaces/${workspaceId}`,
  membership: (workspaceId: string, userId: string) => (
    `workspaces/${workspaceId}/memberships/${userId}`
  ),
};

interface StoredOAuthClient {
  schemaVersion: 1;
  id: string;
  name: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: 'none';
  grantTypes: ['authorization_code', 'refresh_token'];
  responseTypes: ['code'];
  createdAt: string;
  revision: 1;
  binding: string;
}

type AuthorizationRequestStatus = 'pending' | 'approved' | 'denied';

interface StoredAuthorizationRequest {
  schemaVersion: 1;
  id: string;
  clientId: string;
  redirectUri: string;
  workspaceId: string;
  scopes: McpOAuthScope[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  resource: string;
  status: AuthorizationRequestStatus;
  userId: string | null;
  createdAt: string;
  expiresAt: string;
  decidedAt: string | null;
  codeDigest: string | null;
  revision: number;
  binding: string;
}

interface StoredAuthorizationCode {
  schemaVersion: 1;
  digest: string;
  requestId: string;
  clientId: string;
  redirectUri: string;
  workspaceId: string;
  userId: string;
  scopes: McpOAuthScope[];
  codeChallenge: string;
  resource: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  familyId: string | null;
  revision: number;
  binding: string;
}

interface StoredOAuthGrant {
  schemaVersion: 1;
  id: string;
  clientId: string;
  workspaceId: string;
  userId: string;
  membershipRevision: number;
  scopes: McpOAuthScope[];
  resource: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
  revision: number;
  binding: string;
}

interface StoredTokenFamily {
  schemaVersion: 1;
  id: string;
  grantId: string;
  clientId: string;
  workspaceId: string;
  userId: string;
  scopes: McpOAuthScope[];
  resource: string;
  currentRefreshDigest: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revision: number;
  binding: string;
}

interface StoredAccessToken {
  schemaVersion: 1;
  digest: string;
  familyId: string;
  grantId: string;
  clientId: string;
  workspaceId: string;
  userId: string;
  scopes: McpOAuthScope[];
  resource: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  revision: number;
  binding: string;
}

interface StoredRefreshToken {
  schemaVersion: 1;
  digest: string;
  familyId: string;
  grantId: string;
  clientId: string;
  workspaceId: string;
  userId: string;
  scopes: McpOAuthScope[];
  resource: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  replacedByDigest: string | null;
  revokedAt: string | null;
  revision: number;
  binding: string;
}

interface StoredMembership {
  userId: string;
  role: WorkspaceRole;
  status: 'active' | 'removed';
  createdAt: string;
  updatedAt: string | null;
  removedAt: string | null;
  revision: number;
}

interface StoredWorkspace {
  id: string;
  workspaceId: string;
  name: string;
  ownerUid: string;
  createdAt: string;
}

export interface McpOAuthServiceOptions {
  secret: string | Uint8Array;
  publicOrigin: string;
  clock?: () => Date;
  idFactory?: () => string;
  randomSecret?: () => Uint8Array;
}

export interface OAuthClientRegistrationInput {
  clientName: string;
  redirectUris: readonly string[];
  tokenEndpointAuthMethod: 'none';
  grantTypes: readonly string[];
  responseTypes: readonly string[];
  scope?: string;
}

export interface OAuthClientRegistrationResult {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  token_endpoint_auth_method: 'none';
  grant_types: ['authorization_code', 'refresh_token'];
  response_types: ['code'];
  scope?: string;
}

export interface OAuthAuthorizationInput {
  responseType: string;
  clientId: string;
  redirectUri: string;
  workspaceId: string;
  scope: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
}

export type OAuthAuthorizationSelectionInput = Omit<OAuthAuthorizationInput, 'workspaceId'>;

export interface OAuthAuthorizationStart {
  requestId: string;
  consentUri: string;
}

export interface OAuthConsentView {
  requestId: string;
  client: {id: string; name: string};
  redirectUri: string;
  workspace: {id: string; name: string};
  scopes: McpOAuthScope[];
  state: AuthorizationRequestStatus;
  expiresAt: string;
}

export interface OAuthConsentResult {
  decision: 'approved' | 'denied';
  redirectUri: string;
}

export interface OAuthTokenResult {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
  resource: string;
}

export interface McpAccessGrant {
  principal: WorkspacePrincipal & {kind: 'user'; source: 'mcp'};
  workspaceId: string;
  clientId: string;
  scopes: McpOAuthScope[];
  role: WorkspaceRole;
  resource: string;
  expiresAt: string;
}

export class McpOAuthServiceError extends Error {
  readonly code:
    | 'INVALID_OAUTH_REQUEST'
    | 'OAUTH_CLIENT_NOT_FOUND'
    | 'OAUTH_ACCESS_DENIED'
    | 'OAUTH_INVALID_GRANT'
    | 'OAUTH_INVALID_TOKEN'
    | 'OAUTH_SCOPE_DENIED'
    | 'OAUTH_SERVICE_UNAVAILABLE';

  constructor(code: McpOAuthServiceError['code'], message: string) {
    super(message);
    this.name = 'McpOAuthServiceError';
    this.code = code;
  }
}

const clone = <Value>(value: Value): Value => structuredClone(value);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const candidate = value as Record<string, unknown>;
  return `{${Object.keys(candidate).sort().map((key) => (
    `${JSON.stringify(key)}:${stable(candidate[key])}`
  )).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmac(secret: string | Uint8Array, value: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function equalHex(left: unknown, right: string): boolean {
  return typeof left === 'string' && /^[a-f0-9]{64}$/u.test(left)
    && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

function exactDuration(start: unknown, end: unknown, seconds: number): boolean {
  return canonicalTimestamp(start) && canonicalTimestamp(end)
    && Date.parse(end) - Date.parse(start) === seconds * 1_000;
}

function safeReference(value: unknown, minimum = 3, maximum = 128): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(value);
}

function safeWorkspaceId(value: string): string {
  const normalized = value.trim();
  if (value !== normalized || normalized.length < 3 || normalized.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(normalized)) throw invalid();
  return normalized;
}

function clientName(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length < 1 || normalized.length > 80
    || /[\u0000-\u001F\u007F]/u.test(normalized)) throw invalid();
  return normalized;
}

function oauthState(value: string): string {
  if (value.length < 16 || value.length > 512 || /[\u0000-\u001F\u007F]/u.test(value)) {
    throw invalid();
  }
  return value;
}

function pkceChallenge(value: string): string {
  if (!/^[A-Za-z0-9_-]{43,128}$/u.test(value)) throw invalid();
  return value;
}

function pkceVerifier(value: string): string {
  if (!/^[A-Za-z0-9._~-]{43,128}$/u.test(value)) throw invalidGrant();
  return value;
}

function exactHttpsOrLoopbackRedirect(value: string): string {
  if (value.length < 1 || value.length > 2_048 || value !== value.trim()
    || /[\u0000-\u001F\u007F]/u.test(value)) throw invalid();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalid();
  }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback))
    || parsed.username !== '' || parsed.password !== '' || parsed.hash !== '') throw invalid();
  return value;
}

function normalizedRedirects(values: readonly string[]): string[] {
  if (values.length < 1 || values.length > 8) throw invalid();
  const redirects = values.map(exactHttpsOrLoopbackRedirect);
  const unique = [...new Set(redirects)].sort();
  if (unique.length !== redirects.length) throw invalid();
  return unique;
}

function storedRedirect(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return exactHttpsOrLoopbackRedirect(value) === value;
  } catch {
    return false;
  }
}

function storedRedirects(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8
    || !value.every(storedRedirect)) return false;
  const sorted = [...new Set(value)].sort();
  return sorted.length === value.length && sorted.every((item, index) => item === value[index]);
}

function storedClientName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return clientName(value) === value;
  } catch {
    return false;
  }
}

function storedWorkspaceId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 3 && value.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u.test(value);
}

function storedState(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return oauthState(value) === value;
  } catch {
    return false;
  }
}

function storedChallenge(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43,128}$/u.test(value);
}

function normalizedScopes(value: string | readonly string[]): McpOAuthScope[] {
  const raw = typeof value === 'string' ? value.trim().split(/\s+/u).filter(Boolean) : [...value];
  if (raw.length < 1 || raw.length > mcpOAuthScopes.length) throw invalid();
  const unique = [...new Set(raw)].sort();
  if (unique.length !== raw.length
    || unique.some((scope) => !(mcpOAuthScopes as readonly string[]).includes(scope))) throw invalid();
  return unique as McpOAuthScope[];
}

function storedScopes(value: unknown): value is McpOAuthScope[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > mcpOAuthScopes.length
    || value.some((scope) => typeof scope !== 'string'
      || !(mcpOAuthScopes as readonly string[]).includes(scope))) return false;
  const sorted = [...new Set(value)].sort();
  return sorted.length === value.length
    && sorted.every((scope, index) => scope === value[index]);
}

function idPart(value: string): string {
  const normalized = value.replaceAll('-', '').toLowerCase();
  if (!/^[a-f0-9]{32}$/u.test(normalized)) throw unavailable();
  return normalized;
}

function opaqueId(prefix: string, idFactory: () => string): string {
  return `${prefix}_${idPart(idFactory())}`;
}

function tokenValue(prefix: 'olm_at' | 'olm_rt', randomSecret: () => Uint8Array): string {
  const secret = Buffer.from(randomSecret());
  if (secret.byteLength !== 32) throw unavailable();
  return `${prefix}_${secret.toString('base64url')}`;
}

function storedTokenValue(value: string, prefix: 'olm_at' | 'olm_rt'): boolean {
  return new RegExp(`^${prefix}_[A-Za-z0-9_-]{43}$`, 'u').test(value);
}

function invalid(): McpOAuthServiceError {
  return new McpOAuthServiceError('INVALID_OAUTH_REQUEST', 'The OAuth request is invalid.');
}

function invalidGrant(): McpOAuthServiceError {
  return new McpOAuthServiceError('OAUTH_INVALID_GRANT', 'The OAuth grant is invalid or expired.');
}

function invalidToken(): McpOAuthServiceError {
  return new McpOAuthServiceError('OAUTH_INVALID_TOKEN', 'The MCP access token is invalid or expired.');
}

function unavailable(): McpOAuthServiceError {
  return new McpOAuthServiceError('OAUTH_SERVICE_UNAVAILABLE', 'MCP authorization is temporarily unavailable.');
}

function binding<Value extends {binding: string}>(
  secret: string | Uint8Array,
  value: Value,
): string {
  const {binding: _ignored, ...unsigned} = value;
  return hmac(secret, stable(unsigned));
}

function bind<Value extends {binding: string}>(
  secret: string | Uint8Array,
  value: Omit<Value, 'binding'>,
): Value {
  const {binding: _discarded, ...unsigned} = value as Omit<Value, 'binding'> & {binding?: string};
  return {...unsigned, binding: hmac(secret, stable(unsigned))} as Value;
}

function validateBinding<Value extends {binding: string}>(
  secret: string | Uint8Array,
  value: Value,
): void {
  if (!equalHex(value.binding, binding(secret, value))) throw unavailable();
}

function membership(value: unknown, workspaceId: string, userId: string): StoredMembership {
  const candidate = record(value);
  const baseKeys = [
    'schemaVersion', 'id', 'workspaceId', 'userId', 'role', 'status', 'createdAt', 'revision',
  ];
  const expandedKeys = [...baseKeys, 'updatedAt', 'removedAt'];
  if (candidate === null
    || (!exactKeys(candidate, baseKeys) && !exactKeys(candidate, expandedKeys))
    || candidate.schemaVersion !== 1
    || candidate.workspaceId !== workspaceId
    || candidate.userId !== userId
    || !safeReference(candidate.id)
    || (candidate.role !== 'owner' && candidate.role !== 'member')
    || (candidate.status !== 'active' && candidate.status !== 'removed')
    || !canonicalTimestamp(candidate.createdAt)
    || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) throw unavailable();
  const updatedAt = 'updatedAt' in candidate ? candidate.updatedAt : null;
  const removedAt = 'removedAt' in candidate ? candidate.removedAt : null;
  if ((updatedAt !== null && !canonicalTimestamp(updatedAt))
    || (removedAt !== null && !canonicalTimestamp(removedAt))
    || (updatedAt !== null && Date.parse(updatedAt) < Date.parse(candidate.createdAt))
    || (candidate.status === 'active' && removedAt !== null)
    || (candidate.status === 'removed'
      && (updatedAt === null || removedAt !== updatedAt || (candidate.revision as number) < 2))) {
    throw unavailable();
  }
  return {
    userId,
    role: candidate.role,
    status: candidate.status,
    createdAt: candidate.createdAt,
    updatedAt,
    removedAt,
    revision: candidate.revision as number,
  };
}

function workspace(value: unknown, workspaceId: string): StoredWorkspace {
  const candidate = record(value);
  const keys = [
    'schemaVersion', 'id', 'workspaceId', 'name', 'ownerUid', 'authority', 'createdAt', 'revision',
  ];
  if (candidate === null || !exactKeys(candidate, keys) || candidate.schemaVersion !== 1
    || candidate.id !== workspaceId || candidate.workspaceId !== workspaceId
    || typeof candidate.name !== 'string' || candidate.name !== candidate.name.trim()
    || candidate.name.length < 1 || candidate.name.length > 160
    || !safeReference(candidate.ownerUid) || candidate.authority !== 'firebase-hosted'
    || !canonicalTimestamp(candidate.createdAt) || !Number.isSafeInteger(candidate.revision)
    || (candidate.revision as number) < 1) throw unavailable();
  return {
    id: workspaceId,
    workspaceId,
    name: candidate.name,
    ownerUid: candidate.ownerUid,
    createdAt: candidate.createdAt,
  };
}

function membershipEffectiveAt(value: StoredMembership): number {
  return Date.parse(value.updatedAt ?? value.createdAt);
}

function trustedClient(
  secret: string | Uint8Array,
  value: unknown,
  expectedId?: string,
): StoredOAuthClient {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, clientKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || !storedClientName(candidate.name)
    || !storedRedirects(candidate.redirectUris)
    || candidate.tokenEndpointAuthMethod !== 'none'
    || stable(candidate.grantTypes) !== stable(['authorization_code', 'refresh_token'])
    || stable(candidate.responseTypes) !== stable(['code'])
    || !canonicalTimestamp(candidate.createdAt) || candidate.revision !== 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const client = candidate as unknown as StoredOAuthClient;
  validateBinding(secret, client);
  return clone(client);
}

function trustedRequest(
  secret: string | Uint8Array,
  value: unknown,
  expectedId?: string,
): StoredAuthorizationRequest {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, requestKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^oauthreq_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedRedirect(candidate.redirectUri)
    || !storedWorkspaceId(candidate.workspaceId)
    || !storedScopes(candidate.scopes) || !storedState(candidate.state)
    || !storedChallenge(candidate.codeChallenge)
    || candidate.codeChallengeMethod !== 'S256' || typeof candidate.resource !== 'string'
    || !['pending', 'approved', 'denied'].includes(String(candidate.status))
    || (candidate.userId !== null && !safeReference(candidate.userId))
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.expiresAt)
    || !exactDuration(
      candidate.createdAt,
      candidate.expiresAt,
      mcpAuthorizationRequestLifetimeSeconds,
    )
    || (candidate.decidedAt !== null && (!canonicalTimestamp(candidate.decidedAt)
      || Date.parse(candidate.decidedAt) < Date.parse(candidate.createdAt)
      || Date.parse(candidate.decidedAt) >= Date.parse(candidate.expiresAt)))
    || (candidate.codeDigest !== null && (typeof candidate.codeDigest !== 'string'
      || !/^[a-f0-9]{64}$/u.test(candidate.codeDigest)))
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  if ((candidate.status === 'pending'
    && (candidate.userId !== null || candidate.decidedAt !== null || candidate.codeDigest !== null
      || candidate.revision !== 1))
    || (candidate.status === 'approved'
      && (candidate.userId === null || candidate.decidedAt === null || candidate.codeDigest === null
        || candidate.revision !== 2))
    || (candidate.status === 'denied'
      && (candidate.userId === null || candidate.decidedAt === null || candidate.codeDigest !== null
        || candidate.revision !== 2))) throw unavailable();
  const request = candidate as unknown as StoredAuthorizationRequest;
  validateBinding(secret, request);
  return clone(request);
}

function trustedCode(
  secret: string | Uint8Array,
  value: unknown,
  expectedDigest?: string,
): StoredAuthorizationCode {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, codeKeys) || candidate.schemaVersion !== 1
    || typeof candidate.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.digest)
    || (expectedDigest !== undefined && candidate.digest !== expectedDigest)
    || typeof candidate.requestId !== 'string' || !/^oauthreq_[a-f0-9]{32}$/u.test(candidate.requestId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedRedirect(candidate.redirectUri) || !storedWorkspaceId(candidate.workspaceId)
    || !safeReference(candidate.userId) || !storedScopes(candidate.scopes)
    || !storedChallenge(candidate.codeChallenge)
    || typeof candidate.resource !== 'string'
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.expiresAt)
    || !exactDuration(candidate.createdAt, candidate.expiresAt, mcpAuthorizationCodeLifetimeSeconds)
    || (candidate.usedAt !== null && (!canonicalTimestamp(candidate.usedAt)
      || Date.parse(candidate.usedAt) < Date.parse(candidate.createdAt)
      || Date.parse(candidate.usedAt) >= Date.parse(candidate.expiresAt)))
    || (candidate.familyId !== null && (typeof candidate.familyId !== 'string'
      || !/^oauthfam_[a-f0-9]{32}$/u.test(candidate.familyId)))
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  if ((candidate.usedAt === null && (candidate.familyId !== null || candidate.revision !== 1))
    || (candidate.usedAt !== null && (candidate.familyId === null || candidate.revision !== 2))) {
    throw unavailable();
  }
  const code = candidate as unknown as StoredAuthorizationCode;
  validateBinding(secret, code);
  return clone(code);
}

function assertConsentCodeBoundary(
  request: StoredAuthorizationRequest,
  code: StoredAuthorizationCode,
  now: string,
): void {
  if (request.status !== 'approved' || request.codeDigest !== code.digest
    || code.requestId !== request.id || code.clientId !== request.clientId
    || code.redirectUri !== request.redirectUri || code.workspaceId !== request.workspaceId
    || code.userId !== request.userId || stable(code.scopes) !== stable(request.scopes)
    || code.codeChallenge !== request.codeChallenge || code.resource !== request.resource
    || code.createdAt !== request.decidedAt
    || code.usedAt !== null || code.familyId !== null || code.revision !== 1
    || Date.parse(code.createdAt) < Date.parse(request.createdAt)
    || Date.parse(code.createdAt) > Date.parse(now)
    || Date.parse(code.expiresAt) <= Date.parse(now)) throw accessDenied();
}

function trustedGrant(
  secret: string | Uint8Array,
  value: unknown,
  expectedId?: string,
): StoredOAuthGrant {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, grantKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^oauthgrant_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedWorkspaceId(candidate.workspaceId)
    || !safeReference(candidate.userId)
    || !Number.isSafeInteger(candidate.membershipRevision)
    || (candidate.membershipRevision as number) < 1
    || !storedScopes(candidate.scopes)
    || typeof candidate.resource !== 'string' || !canonicalTimestamp(candidate.createdAt)
    || candidate.updatedAt !== candidate.createdAt || candidate.revokedAt !== null
    || candidate.revision !== 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const grant = candidate as unknown as StoredOAuthGrant;
  validateBinding(secret, grant);
  return clone(grant);
}

function trustedFamily(
  secret: string | Uint8Array,
  value: unknown,
  expectedId?: string,
): StoredTokenFamily {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, familyKeys) || candidate.schemaVersion !== 1
    || typeof candidate.id !== 'string' || !/^oauthfam_[a-f0-9]{32}$/u.test(candidate.id)
    || (expectedId !== undefined && candidate.id !== expectedId)
    || typeof candidate.grantId !== 'string' || !/^oauthgrant_[a-f0-9]{32}$/u.test(candidate.grantId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedWorkspaceId(candidate.workspaceId) || !safeReference(candidate.userId)
    || !storedScopes(candidate.scopes) || typeof candidate.resource !== 'string'
    || typeof candidate.currentRefreshDigest !== 'string'
    || !/^[a-f0-9]{64}$/u.test(candidate.currentRefreshDigest)
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.expiresAt)
    || !exactDuration(candidate.createdAt, candidate.expiresAt, mcpRefreshTokenLifetimeSeconds)
    || (candidate.revokedAt !== null && (!canonicalTimestamp(candidate.revokedAt)
      || Date.parse(candidate.revokedAt) < Date.parse(candidate.createdAt)
      || (candidate.revision as number) < 2))
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const family = candidate as unknown as StoredTokenFamily;
  validateBinding(secret, family);
  return clone(family);
}

function trustedAccess(
  secret: string | Uint8Array,
  value: unknown,
  expectedDigest?: string,
): StoredAccessToken {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, accessKeys) || candidate.schemaVersion !== 1
    || typeof candidate.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.digest)
    || (expectedDigest !== undefined && candidate.digest !== expectedDigest)
    || typeof candidate.familyId !== 'string' || !/^oauthfam_[a-f0-9]{32}$/u.test(candidate.familyId)
    || typeof candidate.grantId !== 'string' || !/^oauthgrant_[a-f0-9]{32}$/u.test(candidate.grantId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedWorkspaceId(candidate.workspaceId)
    || !safeReference(candidate.userId) || !storedScopes(candidate.scopes)
    || typeof candidate.resource !== 'string'
    || !canonicalTimestamp(candidate.createdAt) || !canonicalTimestamp(candidate.expiresAt)
    || !exactDuration(candidate.createdAt, candidate.expiresAt, mcpAccessTokenLifetimeSeconds)
    || candidate.revokedAt !== null
    || candidate.revision !== 1
    || typeof candidate.binding !== 'string') throw unavailable();
  const access = candidate as unknown as StoredAccessToken;
  validateBinding(secret, access);
  return clone(access);
}

function trustedRefresh(
  secret: string | Uint8Array,
  value: unknown,
  expectedDigest?: string,
): StoredRefreshToken {
  const candidate = record(value);
  if (candidate === null || !exactKeys(candidate, refreshKeys) || candidate.schemaVersion !== 1
    || typeof candidate.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(candidate.digest)
    || (expectedDigest !== undefined && candidate.digest !== expectedDigest)
    || typeof candidate.familyId !== 'string' || !/^oauthfam_[a-f0-9]{32}$/u.test(candidate.familyId)
    || typeof candidate.grantId !== 'string' || !/^oauthgrant_[a-f0-9]{32}$/u.test(candidate.grantId)
    || typeof candidate.clientId !== 'string' || !/^olm_client_[a-f0-9]{32}$/u.test(candidate.clientId)
    || !storedWorkspaceId(candidate.workspaceId)
    || !safeReference(candidate.userId) || !storedScopes(candidate.scopes)
    || typeof candidate.resource !== 'string' || !canonicalTimestamp(candidate.createdAt)
    || !canonicalTimestamp(candidate.expiresAt) || Date.parse(candidate.expiresAt) <= Date.parse(candidate.createdAt)
    || (candidate.usedAt !== null && (!canonicalTimestamp(candidate.usedAt)
      || Date.parse(candidate.usedAt) < Date.parse(candidate.createdAt)
      || Date.parse(candidate.usedAt) >= Date.parse(candidate.expiresAt)))
    || (candidate.replacedByDigest !== null && (typeof candidate.replacedByDigest !== 'string'
      || !/^[a-f0-9]{64}$/u.test(candidate.replacedByDigest)))
    || candidate.revokedAt !== null
    || !Number.isSafeInteger(candidate.revision) || (candidate.revision as number) < 1
    || typeof candidate.binding !== 'string') throw unavailable();
  if ((candidate.usedAt === null && (candidate.replacedByDigest !== null || candidate.revision !== 1))
    || (candidate.usedAt !== null && (candidate.replacedByDigest === null
      || candidate.revision !== 2))) throw unavailable();
  const refresh = candidate as unknown as StoredRefreshToken;
  validateBinding(secret, refresh);
  return clone(refresh);
}

const scopeAction: Record<McpOAuthScope, WorkspaceAction> = {
  'workspace:read': 'workspace.read',
  'projects:read': 'project.read',
  'projects:write': 'project.write',
  'milestones:read': 'milestone.read',
  'milestones:write': 'milestone.write',
  'issues:read': 'issue.read',
  'issues:write': 'issue.write',
  'comments:read': 'comment.read',
  'comments:write': 'comment.write',
  'members:read': 'membership.list',
  'members:write': 'membership.manage',
  'invitations:read': 'invitation.manage',
  'invitations:write': 'invitation.manage',
  'billing:read': 'billing.manage',
  'workspace:export': 'workspace.export',
};

const memberForbiddenScopes = new Set<McpOAuthScope>([
  'members:write', 'invitations:read', 'invitations:write', 'billing:read', 'workspace:export',
]);

function assertScopesForRole(scopes: readonly McpOAuthScope[], role: WorkspaceRole): void {
  if (role === 'member' && scopes.some((scope) => memberForbiddenScopes.has(scope))) {
    throw new McpOAuthServiceError('OAUTH_SCOPE_DENIED', 'The requested MCP scope is unavailable.');
  }
}

function subset(requested: readonly McpOAuthScope[], allowed: readonly McpOAuthScope[]): boolean {
  const available = new Set(allowed);
  return requested.every((scope) => available.has(scope));
}

function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function grantIdentifier(
  secret: string | Uint8Array,
  clientId: string,
  userId: string,
  workspaceId: string,
  resource: string,
  scopes: readonly McpOAuthScope[],
  membershipRevision: number,
): string {
  return `oauthgrant_${hmac(
    secret,
    stable({clientId, userId, workspaceId, resource, scopes, membershipRevision}),
  ).slice(0, 32)}`;
}

function appendOAuthResult(
  redirectUri: string,
  values: Readonly<Record<string, string>>,
): string {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) target.searchParams.set(key, value);
  return target.toString();
}

export class McpOAuthService {
  readonly #repository: CollaborationRepository;
  readonly #authorization: WorkspaceAuthorizationService;
  readonly #secret: string | Uint8Array;
  readonly #publicOrigin: string;
  readonly #resource: string;
  readonly #clock: () => Date;
  readonly #idFactory: () => string;
  readonly #randomSecret: () => Uint8Array;

  constructor(
    repository: CollaborationRepository,
    authorization: WorkspaceAuthorizationService,
    options: McpOAuthServiceOptions,
  ) {
    const secretLength = typeof options.secret === 'string'
      ? Buffer.byteLength(options.secret, 'utf8')
      : options.secret.byteLength;
    if (secretLength < 32 || secretLength > 512) {
      throw new Error('MCP OAuth secret must contain 32 to 512 bytes.');
    }
    const origin = new URL(options.publicOrigin);
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
    if (origin.origin !== options.publicOrigin
      || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback))) {
      throw new Error('MCP OAuth public origin must be exact HTTPS or loopback HTTP.');
    }
    this.#repository = repository;
    this.#authorization = authorization;
    this.#secret = options.secret;
    this.#publicOrigin = options.publicOrigin;
    this.#resource = `${options.publicOrigin}/mcp`;
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? randomUUID;
    this.#randomSecret = options.randomSecret ?? (() => randomBytes(32));
  }

  get resource(): string {
    return this.#resource;
  }

  protectedResourceMetadata(): Record<string, unknown> {
    return {
      resource: this.#resource,
      authorization_servers: [this.#publicOrigin],
      bearer_methods_supported: ['header'],
      scopes_supported: [...mcpOAuthScopes],
      resource_documentation: `${this.#publicOrigin}/hosted.html#mcp`,
    };
  }

  authorizationServerMetadata(): Record<string, unknown> {
    return {
      issuer: this.#publicOrigin,
      authorization_endpoint: `${this.#publicOrigin}/oauth/authorize`,
      token_endpoint: `${this.#publicOrigin}/oauth/token`,
      registration_endpoint: `${this.#publicOrigin}/oauth/register`,
      revocation_endpoint: `${this.#publicOrigin}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      // Codex CLI 0.144.x drops `iss` while relaying its loopback callback, then
      // rejects the response when RFC 9207 support is advertised. Keep emitting
      // `iss` in authorization responses, but do not require affected clients to
      // validate it until their callback relay preserves the parameter.
      authorization_response_iss_parameter_supported: false,
      scopes_supported: [...mcpOAuthScopes],
      resource_indicators_supported: true,
      service_documentation: `${this.#publicOrigin}/hosted.html#mcp`,
    };
  }

  async registerClient(input: OAuthClientRegistrationInput): Promise<OAuthClientRegistrationResult> {
    const grantTypes = [...new Set(input.grantTypes)].sort();
    const responseTypes = [...new Set(input.responseTypes)].sort();
    if (input.tokenEndpointAuthMethod !== 'none'
      || stable(grantTypes) !== stable(['authorization_code', 'refresh_token'])
      || stable(responseTypes) !== stable(['code'])
      || grantTypes.length !== input.grantTypes.length
      || responseTypes.length !== input.responseTypes.length) throw invalid();
    const name = clientName(input.clientName);
    const redirectUris = normalizedRedirects(input.redirectUris);
    const scope = input.scope === undefined ? undefined : normalizedScopes(input.scope).join(' ');
    const now = this.#trustedNow();
    const id = opaqueId('olm_client', this.#idFactory);
    const client = bind<StoredOAuthClient>(this.#secret, {
      schemaVersion: 1,
      id,
      name,
      redirectUris,
      tokenEndpointAuthMethod: 'none',
      grantTypes: ['authorization_code', 'refresh_token'],
      responseTypes: ['code'],
      createdAt: now,
      revision: 1,
    });
    try {
      await this.#repository.runTransaction(async (transaction) => {
        if (await transaction.get(paths.client(id)) !== null) throw unavailable();
        transaction.create(paths.client(id), {...client});
      });
      return {
        client_id: client.id,
        client_name: client.name,
        redirect_uris: clone(client.redirectUris),
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        ...(scope === undefined ? {} : {scope}),
      };
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async startAuthorization(input: OAuthAuthorizationInput): Promise<OAuthAuthorizationStart> {
    if (input.responseType !== 'code' || input.codeChallengeMethod !== 'S256') throw invalid();
    const clientId = this.#clientId(input.clientId);
    const redirectUri = exactHttpsOrLoopbackRedirect(input.redirectUri);
    const workspaceId = safeWorkspaceId(input.workspaceId);
    const scopes = normalizedScopes(input.scope);
    const state = oauthState(input.state);
    const challenge = pkceChallenge(input.codeChallenge);
    if (input.resource !== this.#resource) throw invalid();
    const nowDate = this.#clockDate();
    const now = nowDate.toISOString();
    const requestId = opaqueId('oauthreq', this.#idFactory);
    const request = bind<StoredAuthorizationRequest>(this.#secret, {
      schemaVersion: 1,
      id: requestId,
      clientId,
      redirectUri,
      workspaceId,
      scopes,
      state,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      resource: this.#resource,
      status: 'pending',
      userId: null,
      createdAt: now,
      expiresAt: new Date(
        nowDate.getTime() + mcpAuthorizationRequestLifetimeSeconds * 1_000,
      ).toISOString(),
      decidedAt: null,
      codeDigest: null,
      revision: 1,
    });
    try {
      await this.#repository.runTransaction(async (transaction) => {
        const client = trustedClient(this.#secret, await transaction.get(paths.client(clientId)), clientId);
        if (!client.redirectUris.includes(redirectUri)) throw invalid();
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(workspaceId)),
          workspaceId,
        );
        if (Date.parse(client.createdAt) > nowDate.getTime()
          || Date.parse(storedWorkspace.createdAt) > nowDate.getTime()
          || await transaction.get(paths.request(requestId)) !== null) throw unavailable();
        transaction.create(paths.request(requestId), {...request});
      });
      return {
        requestId,
        consentUri: `${this.#publicOrigin}/hosted.html?oauth_request=${encodeURIComponent(requestId)}`,
      };
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async authorizationSelectionUri(input: OAuthAuthorizationSelectionInput): Promise<string> {
    if (input.responseType !== 'code' || input.codeChallengeMethod !== 'S256') throw invalid();
    const clientId = this.#clientId(input.clientId);
    const redirectUri = exactHttpsOrLoopbackRedirect(input.redirectUri);
    const scopes = normalizedScopes(input.scope);
    const state = oauthState(input.state);
    const challenge = pkceChallenge(input.codeChallenge);
    if (input.resource !== this.#resource) throw invalid();
    const nowDate = this.#clockDate();
    try {
      await this.#repository.runTransaction(async (transaction) => {
        const client = trustedClient(this.#secret, await transaction.get(paths.client(clientId)), clientId);
        if (!client.redirectUris.includes(redirectUri)) throw invalid();
        if (Date.parse(client.createdAt) > nowDate.getTime()) throw unavailable();
      });
      const target = new URL('/hosted.html', this.#publicOrigin);
      for (const [key, value] of [
        ['oauth_workspace', 'select'],
        ['response_type', 'code'],
        ['client_id', clientId],
        ['redirect_uri', redirectUri],
        ['scope', scopes.join(' ')],
        ['state', state],
        ['code_challenge', challenge],
        ['code_challenge_method', 'S256'],
        ['resource', this.#resource],
      ] as const) target.searchParams.set(key, value);
      return target.toString();
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async consentView(
    requestIdValue: string,
    identity: {uid: string},
    requestId: string,
  ): Promise<OAuthConsentView> {
    const authorizationRequestId = this.#requestId(requestIdValue);
    const userId = this.#userId(identity.uid);
    const now = this.#trustedNow();
    try {
      const snapshot = await this.#repository.runTransaction(async (transaction) => {
        const request = trustedRequest(
          this.#secret,
          await transaction.get(paths.request(authorizationRequestId)),
          authorizationRequestId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(request.clientId)),
          request.clientId,
        );
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(request.workspaceId)),
          request.workspaceId,
        );
        const storedMembership = membership(
          await transaction.get(paths.membership(request.workspaceId, userId)),
          request.workspaceId,
          userId,
        );
        if (request.resource !== this.#resource
          || !client.redirectUris.includes(request.redirectUri)
          || Date.parse(client.createdAt) > Date.parse(request.createdAt)
          || Date.parse(storedWorkspace.createdAt) > Date.parse(request.createdAt)
          || Date.parse(request.createdAt) > Date.parse(now)
          || Date.parse(request.expiresAt) <= Date.parse(now)
          || Date.parse(storedWorkspace.createdAt) > Date.parse(now)
          || Date.parse(storedMembership.createdAt) > Date.parse(now)
          || membershipEffectiveAt(storedMembership) > Date.parse(now)
          || storedMembership.status !== 'active'
          || (request.userId !== null && request.userId !== userId)) throw accessDenied();
        assertScopesForRole(request.scopes, storedMembership.role);
        if (request.status === 'approved') {
          const code = trustedCode(
            this.#secret,
            await transaction.get(paths.code(request.codeDigest ?? '')),
            request.codeDigest ?? '',
          );
          assertConsentCodeBoundary(request, code, now);
        }
        return {request, client, workspace: storedWorkspace};
      });
      await this.#authorizeScopes(
        snapshot.request.scopes,
        userId,
        snapshot.request.workspaceId,
        requestId,
        'web',
      );
      return {
        requestId: snapshot.request.id,
        client: {id: snapshot.client.id, name: snapshot.client.name},
        redirectUri: snapshot.request.redirectUri,
        workspace: {id: snapshot.workspace.id, name: snapshot.workspace.name},
        scopes: clone(snapshot.request.scopes),
        state: snapshot.request.status,
        expiresAt: snapshot.request.expiresAt,
      };
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async decideConsent(input: {
    requestId: string;
    identity: {uid: string};
    decision: 'approve' | 'deny';
    requestReference: string;
  }): Promise<OAuthConsentResult> {
    const authorizationRequestId = this.#requestId(input.requestId);
    const userId = this.#userId(input.identity.uid);
    if (!safeReference(input.requestReference, 3, 96)) throw invalid();
    const preview = await this.consentView(
      authorizationRequestId,
      input.identity,
      input.requestReference,
    );
    if (preview.state !== 'pending') {
      return this.#replayConsent(authorizationRequestId, userId, input.decision);
    }
    const now = this.#trustedNow();
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const request = trustedRequest(
          this.#secret,
          await transaction.get(paths.request(authorizationRequestId)),
          authorizationRequestId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(request.clientId)),
          request.clientId,
        );
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(request.workspaceId)),
          request.workspaceId,
        );
        const storedMembership = membership(
          await transaction.get(paths.membership(request.workspaceId, userId)),
          request.workspaceId,
          userId,
        );
        if (request.resource !== this.#resource
          || !client.redirectUris.includes(request.redirectUri)
          || Date.parse(client.createdAt) > Date.parse(request.createdAt)
          || Date.parse(storedWorkspace.createdAt) > Date.parse(request.createdAt)
          || Date.parse(request.createdAt) > Date.parse(now)
          || Date.parse(request.expiresAt) <= Date.parse(now)
          || storedMembership.status !== 'active'
          || Date.parse(storedMembership.createdAt) > Date.parse(now)
          || membershipEffectiveAt(storedMembership) > Date.parse(now)) throw accessDenied();
        assertScopesForRole(request.scopes, storedMembership.role);
        if (request.status !== 'pending') {
          if (request.userId !== userId) throw accessDenied();
          return this.#consentResult(request, input.decision);
        }
        if (input.decision === 'deny') {
          const denied = bind<StoredAuthorizationRequest>(this.#secret, {
            ...request,
            status: 'denied',
            userId,
            decidedAt: now,
            revision: request.revision + 1,
          });
          transaction.set(paths.request(request.id), {...denied});
          return this.#consentResult(denied, 'deny');
        }
        const rawCode = this.#authorizationCodeValue(request.id);
        const digest = sha256(rawCode);
        const rawExistingCode = await transaction.get(paths.code(digest));
        if (rawExistingCode !== null) throw unavailable();
        const code = bind<StoredAuthorizationCode>(this.#secret, {
          schemaVersion: 1,
          digest,
          requestId: request.id,
          clientId: request.clientId,
          redirectUri: request.redirectUri,
          workspaceId: request.workspaceId,
          userId,
          scopes: clone(request.scopes),
          codeChallenge: request.codeChallenge,
          resource: request.resource,
          createdAt: now,
          expiresAt: new Date(
            Date.parse(now) + mcpAuthorizationCodeLifetimeSeconds * 1_000,
          ).toISOString(),
          usedAt: null,
          familyId: null,
          revision: 1,
        });
        const approved = bind<StoredAuthorizationRequest>(this.#secret, {
          ...request,
          status: 'approved',
          userId,
          decidedAt: now,
          codeDigest: digest,
          revision: request.revision + 1,
        });
        transaction.create(paths.code(digest), {...code});
        transaction.set(paths.request(request.id), {...approved});
        return this.#consentResult(approved, 'approve');
      });
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string;
  }): Promise<OAuthTokenResult> {
    const clientId = this.#clientId(input.clientId);
    const redirectUri = exactHttpsOrLoopbackRedirect(input.redirectUri);
    const verifier = pkceVerifier(input.codeVerifier);
    if (input.resource !== this.#resource || !/^olm_ac_[A-Za-z0-9_-]{43}$/u.test(input.code)) {
      throw invalidGrant();
    }
    const codeDigest = sha256(input.code);
    const accessValue = tokenValue('olm_at', this.#randomSecret);
    const refreshValue = tokenValue('olm_rt', this.#randomSecret);
    const accessDigest = sha256(accessValue);
    const refreshDigest = sha256(refreshValue);
    const nowDate = this.#clockDate();
    const now = nowDate.toISOString();
    try {
      const result = await this.#repository.runTransaction(async (transaction) => {
        const code = trustedCode(
          this.#secret,
          await transaction.get(paths.code(codeDigest)),
          codeDigest,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(code.clientId)),
          code.clientId,
        );
        if (code.clientId !== clientId || client.id !== clientId || code.redirectUri !== redirectUri
          || !client.redirectUris.includes(code.redirectUri)
          || code.resource !== input.resource || code.usedAt !== null
          || Date.parse(client.createdAt) > Date.parse(code.createdAt)
          || Date.parse(code.createdAt) > nowDate.getTime()
          || Date.parse(code.expiresAt) <= nowDate.getTime()
          || pkceS256(verifier) !== code.codeChallenge) throw invalidGrant();
        const request = trustedRequest(
          this.#secret,
          await transaction.get(paths.request(code.requestId)),
          code.requestId,
        );
        if (request.status !== 'approved' || request.codeDigest !== code.digest
          || request.userId !== code.userId || request.clientId !== code.clientId
          || request.workspaceId !== code.workspaceId || request.resource !== code.resource
          || request.redirectUri !== code.redirectUri || stable(request.scopes) !== stable(code.scopes)
          || request.decidedAt !== code.createdAt
          || Date.parse(client.createdAt) > Date.parse(request.createdAt)
          || Date.parse(request.createdAt) > Date.parse(code.createdAt)) {
          throw unavailable();
        }
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(code.workspaceId)),
          code.workspaceId,
        );
        const storedMembership = membership(
          await transaction.get(paths.membership(code.workspaceId, code.userId)),
          code.workspaceId,
          code.userId,
        );
        if (storedMembership.status !== 'active'
          || Date.parse(storedWorkspace.createdAt) > Date.parse(request.createdAt)
          || Date.parse(storedWorkspace.createdAt) > nowDate.getTime()
          || Date.parse(storedMembership.createdAt) > Date.parse(code.createdAt)
          || membershipEffectiveAt(storedMembership) > Date.parse(code.createdAt)
          || membershipEffectiveAt(storedMembership) > nowDate.getTime()) throw invalidGrant();
        assertScopesForRole(code.scopes, storedMembership.role);
        if (await transaction.get(paths.access(accessDigest)) !== null
          || await transaction.get(paths.refresh(refreshDigest)) !== null) throw unavailable();
        const grantId = grantIdentifier(
          this.#secret,
          code.clientId,
          code.userId,
          code.workspaceId,
          code.resource,
          code.scopes,
          storedMembership.revision,
        );
        const familyId = opaqueId('oauthfam', this.#idFactory);
        const rawGrant = await transaction.get(paths.grant(grantId));
        let grant: StoredOAuthGrant;
        if (rawGrant === null) {
          grant = bind<StoredOAuthGrant>(this.#secret, {
            schemaVersion: 1,
            id: grantId,
            clientId: code.clientId,
            workspaceId: code.workspaceId,
            userId: code.userId,
            membershipRevision: storedMembership.revision,
            scopes: clone(code.scopes),
            resource: code.resource,
            createdAt: now,
            updatedAt: now,
            revokedAt: null,
            revision: 1,
          });
          transaction.create(paths.grant(grant.id), {...grant});
        } else {
          grant = trustedGrant(this.#secret, rawGrant, grantId);
          if (grant.clientId !== code.clientId
            || grant.workspaceId !== code.workspaceId || grant.userId !== code.userId
            || grant.membershipRevision !== storedMembership.revision
            || grant.resource !== code.resource || stable(grant.scopes) !== stable(code.scopes)
            || Date.parse(grant.createdAt) > Date.parse(code.createdAt)
            || Date.parse(grant.updatedAt) > nowDate.getTime()) throw invalidGrant();
        }
        const familyExpiresAt = new Date(
          nowDate.getTime() + mcpRefreshTokenLifetimeSeconds * 1_000,
        ).toISOString();
        const family = bind<StoredTokenFamily>(this.#secret, {
          schemaVersion: 1,
          id: familyId,
          grantId,
          clientId: code.clientId,
          workspaceId: code.workspaceId,
          userId: code.userId,
          scopes: clone(code.scopes),
          resource: code.resource,
          currentRefreshDigest: refreshDigest,
          createdAt: now,
          expiresAt: familyExpiresAt,
          revokedAt: null,
          revision: 1,
        });
        const access = bind<StoredAccessToken>(this.#secret, {
          schemaVersion: 1,
          digest: accessDigest,
          familyId,
          grantId,
          clientId: code.clientId,
          workspaceId: code.workspaceId,
          userId: code.userId,
          scopes: clone(code.scopes),
          resource: code.resource,
          createdAt: now,
          expiresAt: new Date(
            nowDate.getTime() + mcpAccessTokenLifetimeSeconds * 1_000,
          ).toISOString(),
          revokedAt: null,
          revision: 1,
        });
        const refresh = bind<StoredRefreshToken>(this.#secret, {
          schemaVersion: 1,
          digest: refreshDigest,
          familyId,
          grantId,
          clientId: code.clientId,
          workspaceId: code.workspaceId,
          userId: code.userId,
          scopes: clone(code.scopes),
          resource: code.resource,
          createdAt: now,
          expiresAt: familyExpiresAt,
          usedAt: null,
          replacedByDigest: null,
          revokedAt: null,
          revision: 1,
        });
        const usedCode = bind<StoredAuthorizationCode>(this.#secret, {
          ...code,
          usedAt: now,
          familyId,
          revision: code.revision + 1,
        });
        transaction.create(paths.family(familyId), {...family});
        transaction.create(paths.access(accessDigest), {...access});
        transaction.create(paths.refresh(refreshDigest), {...refresh});
        transaction.set(paths.code(code.digest), {...usedCode});
        return {scopes: code.scopes};
      });
      return this.#tokenResult(accessValue, refreshValue, result.scopes);
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async refreshAccessToken(input: {
    refreshToken: string;
    clientId: string;
    resource?: string;
    scope?: string;
  }): Promise<OAuthTokenResult> {
    const clientId = this.#clientId(input.clientId);
    const resource = input.resource ?? this.#resource;
    if (resource !== this.#resource || !storedTokenValue(input.refreshToken, 'olm_rt')) {
      throw invalidGrant();
    }
    const digest = sha256(input.refreshToken);
    const nextAccessValue = tokenValue('olm_at', this.#randomSecret);
    const nextRefreshValue = tokenValue('olm_rt', this.#randomSecret);
    const nextAccessDigest = sha256(nextAccessValue);
    const nextRefreshDigest = sha256(nextRefreshValue);
    const nowDate = this.#clockDate();
    const now = nowDate.toISOString();
    try {
      const outcome = await this.#repository.runTransaction(async (transaction) => {
        const refresh = trustedRefresh(
          this.#secret,
          await transaction.get(paths.refresh(digest)),
          digest,
        );
        const family = trustedFamily(
          this.#secret,
          await transaction.get(paths.family(refresh.familyId)),
          refresh.familyId,
        );
        const grant = trustedGrant(
          this.#secret,
          await transaction.get(paths.grant(refresh.grantId)),
          refresh.grantId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(refresh.clientId)),
          refresh.clientId,
        );
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(refresh.workspaceId)),
          refresh.workspaceId,
        );
        if (client.id !== clientId || refresh.clientId !== clientId
          || refresh.resource !== resource || family.resource !== resource
          || grant.resource !== resource || family.grantId !== refresh.grantId
          || grant.id !== refresh.grantId || family.clientId !== refresh.clientId
          || family.workspaceId !== refresh.workspaceId || family.userId !== refresh.userId
          || grant.clientId !== refresh.clientId || grant.workspaceId !== refresh.workspaceId
          || grant.userId !== refresh.userId || !subset(refresh.scopes, family.scopes)
          || stable(grant.scopes) !== stable(family.scopes)
          || grant.id !== grantIdentifier(
            this.#secret,
            grant.clientId,
            grant.userId,
            grant.workspaceId,
            grant.resource,
            grant.scopes,
            grant.membershipRevision,
          )
          || refresh.expiresAt !== family.expiresAt
          || Date.parse(grant.createdAt) < Date.parse(client.createdAt)
          || Date.parse(family.createdAt) < Date.parse(grant.createdAt)
          || Date.parse(refresh.createdAt) < Date.parse(family.createdAt)) throw invalidGrant();
        if (Date.parse(refresh.createdAt) > nowDate.getTime()
          || Date.parse(family.createdAt) > nowDate.getTime()
          || Date.parse(grant.createdAt) > nowDate.getTime()
          || Date.parse(grant.updatedAt) > nowDate.getTime()
          || Date.parse(client.createdAt) > nowDate.getTime()
          || Date.parse(storedWorkspace.createdAt) > nowDate.getTime()
          || Date.parse(storedWorkspace.createdAt) > Date.parse(grant.createdAt)) throw unavailable();
        const expired = Date.parse(refresh.expiresAt) <= nowDate.getTime()
          || Date.parse(family.expiresAt) <= nowDate.getTime();
        const replayed = refresh.usedAt !== null || family.currentRefreshDigest !== refresh.digest;
        if (family.revokedAt !== null || grant.revokedAt !== null || refresh.revokedAt !== null
          || expired || replayed) {
          if (refresh.usedAt !== null && Date.parse(refresh.usedAt) > nowDate.getTime()) {
            throw unavailable();
          }
          if (family.revokedAt === null) {
            const revoked = bind<StoredTokenFamily>(this.#secret, {
              ...family,
              revokedAt: now,
              revision: family.revision + 1,
            });
            transaction.set(paths.family(family.id), {...revoked});
          }
          return {kind: 'invalid' as const};
        }
        const storedMembership = membership(
          await transaction.get(paths.membership(refresh.workspaceId, refresh.userId)),
          refresh.workspaceId,
          refresh.userId,
        );
        if (Date.parse(storedMembership.createdAt) > nowDate.getTime()) throw unavailable();
        if (membershipEffectiveAt(storedMembership) > nowDate.getTime()
          || Date.parse(storedMembership.createdAt) > Date.parse(grant.createdAt)
          || membershipEffectiveAt(storedMembership) > Date.parse(grant.createdAt)) throw unavailable();
        if (storedMembership.status !== 'active'
          || storedMembership.revision !== grant.membershipRevision) {
          const revoked = bind<StoredTokenFamily>(this.#secret, {
            ...family,
            revokedAt: now,
            revision: family.revision + 1,
          });
          transaction.set(paths.family(family.id), {...revoked});
          return {kind: 'invalid' as const};
        }
        if (Date.parse(family.expiresAt) - nowDate.getTime()
          < mcpAccessTokenLifetimeSeconds * 1_000) return {kind: 'invalid' as const};
        const scopes = input.scope === undefined ? clone(refresh.scopes) : normalizedScopes(input.scope);
        if (!subset(scopes, refresh.scopes)) return {kind: 'invalid' as const};
        assertScopesForRole(scopes, storedMembership.role);
        if (await transaction.get(paths.access(nextAccessDigest)) !== null
          || await transaction.get(paths.refresh(nextRefreshDigest)) !== null) throw unavailable();
        const accessExpiresAt = new Date(
          nowDate.getTime() + mcpAccessTokenLifetimeSeconds * 1_000,
        ).toISOString();
        const nextAccess = bind<StoredAccessToken>(this.#secret, {
          schemaVersion: 1,
          digest: nextAccessDigest,
          familyId: family.id,
          grantId: grant.id,
          clientId,
          workspaceId: refresh.workspaceId,
          userId: refresh.userId,
          scopes: clone(scopes),
          resource: refresh.resource,
          createdAt: now,
          expiresAt: accessExpiresAt,
          revokedAt: null,
          revision: 1,
        });
        const nextRefresh = bind<StoredRefreshToken>(this.#secret, {
          schemaVersion: 1,
          digest: nextRefreshDigest,
          familyId: family.id,
          grantId: grant.id,
          clientId,
          workspaceId: refresh.workspaceId,
          userId: refresh.userId,
          scopes: clone(scopes),
          resource: refresh.resource,
          createdAt: now,
          expiresAt: family.expiresAt,
          usedAt: null,
          replacedByDigest: null,
          revokedAt: null,
          revision: 1,
        });
        const usedRefresh = bind<StoredRefreshToken>(this.#secret, {
          ...refresh,
          usedAt: now,
          replacedByDigest: nextRefreshDigest,
          revision: refresh.revision + 1,
        });
        const nextFamily = bind<StoredTokenFamily>(this.#secret, {
          ...family,
          currentRefreshDigest: nextRefreshDigest,
          revision: family.revision + 1,
        });
        transaction.create(paths.access(nextAccessDigest), {...nextAccess});
        transaction.create(paths.refresh(nextRefreshDigest), {...nextRefresh});
        transaction.set(paths.refresh(refresh.digest), {...usedRefresh});
        transaction.set(paths.family(family.id), {...nextFamily});
        return {kind: 'issued' as const, scopes};
      });
      if (outcome.kind === 'invalid') throw invalidGrant();
      return this.#tokenResult(nextAccessValue, nextRefreshValue, outcome.scopes);
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async revokeToken(input: {token: string; clientId: string}): Promise<void> {
    const clientId = this.#clientId(input.clientId);
    if (input.token.length < 20 || input.token.length > 512 || /\s/u.test(input.token)) return;
    const digest = sha256(input.token);
    const now = this.#trustedNow();
    try {
      await this.#repository.runTransaction(async (transaction) => {
        const rawAccess = await transaction.get(paths.access(digest));
        const rawRefresh = await transaction.get(paths.refresh(digest));
        if (rawAccess === null && rawRefresh === null) return;
        if (rawAccess !== null && rawRefresh !== null) throw unavailable();
        const token = rawAccess !== null
          ? trustedAccess(this.#secret, rawAccess, digest)
          : trustedRefresh(this.#secret, rawRefresh, digest);
        const tokenUsedAt = rawRefresh === null ? null : (token as StoredRefreshToken).usedAt;
        if (token.clientId !== clientId) return;
        const family = trustedFamily(
          this.#secret,
          await transaction.get(paths.family(token.familyId)),
          token.familyId,
        );
        const grant = trustedGrant(
          this.#secret,
          await transaction.get(paths.grant(token.grantId)),
          token.grantId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(clientId)),
          clientId,
        );
        const currentRefresh = trustedRefresh(
          this.#secret,
          await transaction.get(paths.refresh(family.currentRefreshDigest)),
          family.currentRefreshDigest,
        );
        if (family.clientId !== clientId
          || token.familyId !== family.id || token.grantId !== family.grantId
          || token.clientId !== family.clientId || token.workspaceId !== family.workspaceId
          || token.userId !== family.userId || token.resource !== family.resource
          || !subset(token.scopes, family.scopes)
          || (rawRefresh !== null && token.expiresAt !== family.expiresAt)
          || grant.id !== family.grantId || grant.clientId !== client.id
          || grant.workspaceId !== family.workspaceId || grant.userId !== family.userId
          || grant.resource !== family.resource || stable(grant.scopes) !== stable(family.scopes)
          || grant.id !== grantIdentifier(
            this.#secret,
            grant.clientId,
            grant.userId,
            grant.workspaceId,
            grant.resource,
            grant.scopes,
            grant.membershipRevision,
          )
          || currentRefresh.familyId !== family.id || currentRefresh.grantId !== grant.id
          || currentRefresh.clientId !== client.id
          || currentRefresh.workspaceId !== family.workspaceId
          || currentRefresh.userId !== family.userId || currentRefresh.resource !== family.resource
          || currentRefresh.expiresAt !== family.expiresAt
          || !subset(currentRefresh.scopes, family.scopes)
          || currentRefresh.usedAt !== null || currentRefresh.replacedByDigest !== null) {
          throw unavailable();
        }
        if (Date.parse(token.createdAt) > Date.parse(now)
          || Date.parse(family.createdAt) > Date.parse(now)
          || Date.parse(grant.createdAt) > Date.parse(now)
          || Date.parse(grant.updatedAt) > Date.parse(now)
          || Date.parse(client.createdAt) > Date.parse(now)
          || Date.parse(currentRefresh.createdAt) > Date.parse(now)
          || (family.revokedAt !== null && Date.parse(family.revokedAt) > Date.parse(now))
          || (tokenUsedAt !== null && Date.parse(tokenUsedAt) > Date.parse(now))
          || Date.parse(grant.createdAt) < Date.parse(client.createdAt)
          || Date.parse(family.createdAt) < Date.parse(grant.createdAt)
          || Date.parse(currentRefresh.createdAt) < Date.parse(family.createdAt)
          || Date.parse(token.createdAt) < Date.parse(family.createdAt)
          || Date.parse(token.createdAt) < Date.parse(grant.createdAt)
          || (rawAccess !== null && Date.parse(token.expiresAt) > Date.parse(family.expiresAt))) {
          throw unavailable();
        }
        if (family.revokedAt !== null) return;
        const revoked = bind<StoredTokenFamily>(this.#secret, {
          ...family,
          revokedAt: now,
          revision: family.revision + 1,
        });
        transaction.set(paths.family(family.id), {...revoked});
      });
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  async authenticateAccessToken(rawToken: string): Promise<McpAccessGrant> {
    if (!storedTokenValue(rawToken, 'olm_at')) throw invalidToken();
    const digest = sha256(rawToken);
    const nowDate = this.#clockDate();
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const access = trustedAccess(
          this.#secret,
          await transaction.get(paths.access(digest)),
          digest,
        );
        const family = trustedFamily(
          this.#secret,
          await transaction.get(paths.family(access.familyId)),
          access.familyId,
        );
        const grant = trustedGrant(
          this.#secret,
          await transaction.get(paths.grant(access.grantId)),
          access.grantId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(access.clientId)),
          access.clientId,
        );
        const currentRefresh = trustedRefresh(
          this.#secret,
          await transaction.get(paths.refresh(family.currentRefreshDigest)),
          family.currentRefreshDigest,
        );
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(access.workspaceId)),
          access.workspaceId,
        );
        if (access.resource !== this.#resource || family.resource !== this.#resource
          || grant.resource !== this.#resource || access.familyId !== family.id
          || access.grantId !== family.grantId || access.grantId !== grant.id
          || access.clientId !== family.clientId || access.clientId !== grant.clientId
          || access.clientId !== client.id
          || access.workspaceId !== family.workspaceId || access.workspaceId !== grant.workspaceId
          || access.userId !== family.userId || access.userId !== grant.userId
          || !subset(access.scopes, family.scopes) || stable(family.scopes) !== stable(grant.scopes)
          || grant.id !== grantIdentifier(
            this.#secret,
            grant.clientId,
            grant.userId,
            grant.workspaceId,
            grant.resource,
            grant.scopes,
            grant.membershipRevision,
          )
          || currentRefresh.familyId !== family.id || currentRefresh.grantId !== grant.id
          || currentRefresh.clientId !== client.id || currentRefresh.workspaceId !== access.workspaceId
          || currentRefresh.userId !== access.userId || currentRefresh.resource !== access.resource
          || !subset(currentRefresh.scopes, family.scopes) || currentRefresh.usedAt !== null
          || currentRefresh.replacedByDigest !== null || currentRefresh.revokedAt !== null
          || currentRefresh.expiresAt !== family.expiresAt
          || access.revokedAt !== null || family.revokedAt !== null || grant.revokedAt !== null
          || Date.parse(client.createdAt) > nowDate.getTime()
          || Date.parse(access.createdAt) > nowDate.getTime()
          || Date.parse(family.createdAt) > nowDate.getTime()
          || Date.parse(grant.createdAt) > nowDate.getTime()
          || Date.parse(grant.updatedAt) > nowDate.getTime()
          || Date.parse(currentRefresh.createdAt) > nowDate.getTime()
          || Date.parse(storedWorkspace.createdAt) > nowDate.getTime()
          || Date.parse(access.expiresAt) <= nowDate.getTime()
          || Date.parse(family.expiresAt) <= nowDate.getTime()
          || Date.parse(currentRefresh.expiresAt) <= nowDate.getTime()
          || Date.parse(grant.createdAt) < Date.parse(client.createdAt)
          || Date.parse(family.createdAt) < Date.parse(grant.createdAt)
          || Date.parse(access.createdAt) < Date.parse(family.createdAt)
          || Date.parse(access.createdAt) < Date.parse(grant.createdAt)
          || Date.parse(access.expiresAt) > Date.parse(family.expiresAt)
          || Date.parse(currentRefresh.createdAt) < Date.parse(family.createdAt)
          || Date.parse(currentRefresh.createdAt) < Date.parse(grant.createdAt)
          || Date.parse(storedWorkspace.createdAt) > Date.parse(grant.createdAt)) throw invalidToken();
        const storedMembership = membership(
          await transaction.get(paths.membership(access.workspaceId, access.userId)),
          access.workspaceId,
          access.userId,
        );
        if (storedMembership.status !== 'active'
          || storedMembership.revision !== grant.membershipRevision
          || Date.parse(storedMembership.createdAt) > nowDate.getTime()
          || membershipEffectiveAt(storedMembership) > nowDate.getTime()
          || Date.parse(storedMembership.createdAt) > Date.parse(grant.createdAt)
          || membershipEffectiveAt(storedMembership) > Date.parse(grant.createdAt)) throw invalidToken();
        assertScopesForRole(access.scopes, storedMembership.role);
        return {
          principal: {kind: 'user', userId: access.userId, source: 'mcp'},
          workspaceId: access.workspaceId,
          clientId: access.clientId,
          scopes: clone(access.scopes),
          role: storedMembership.role,
          resource: access.resource,
          expiresAt: access.expiresAt,
        };
      });
    } catch (error) {
      if (error instanceof McpOAuthServiceError && error.code === 'OAUTH_INVALID_TOKEN') throw error;
      throw invalidToken();
    }
  }

  async #authorizeScopes(
    scopes: readonly McpOAuthScope[],
    userId: string,
    workspaceId: string,
    requestId: string,
    source: 'web' | 'mcp',
  ): Promise<void> {
    const actions = [...new Set(scopes.map((scope) => scopeAction[scope]))];
    for (const action of actions) {
      await this.#authorization.authorize({
        principal: {kind: 'user', userId, source},
        workspaceId,
        action,
        targetEntityType: 'oauth_scope',
        targetEntityId: action.replaceAll('.', '_'),
        requestId,
      });
    }
  }

  async #replayConsent(
    requestId: string,
    userId: string,
    decision: 'approve' | 'deny',
  ): Promise<OAuthConsentResult> {
    const now = this.#trustedNow();
    try {
      return await this.#repository.runTransaction(async (transaction) => {
        const request = trustedRequest(
          this.#secret,
          await transaction.get(paths.request(requestId)),
          requestId,
        );
        const client = trustedClient(
          this.#secret,
          await transaction.get(paths.client(request.clientId)),
          request.clientId,
        );
        const storedWorkspace = workspace(
          await transaction.get(paths.workspace(request.workspaceId)),
          request.workspaceId,
        );
        const storedMembership = membership(
          await transaction.get(paths.membership(request.workspaceId, userId)),
          request.workspaceId,
          userId,
        );
        if (request.userId !== userId || request.resource !== this.#resource
          || !client.redirectUris.includes(request.redirectUri)
          || Date.parse(client.createdAt) > Date.parse(request.createdAt)
          || Date.parse(storedWorkspace.createdAt) > Date.parse(request.createdAt)
          || Date.parse(request.createdAt) > Date.parse(now)
          || Date.parse(request.expiresAt) <= Date.parse(now)
          || storedMembership.status !== 'active'
          || Date.parse(storedMembership.createdAt) > Date.parse(now)
          || membershipEffectiveAt(storedMembership) > Date.parse(now)) throw accessDenied();
        assertScopesForRole(request.scopes, storedMembership.role);
        const expectedDecision = request.status === 'approved' ? 'approve' : 'deny';
        if (expectedDecision !== decision) throw invalid();
        if (request.status === 'approved') {
          const code = trustedCode(
            this.#secret,
            await transaction.get(paths.code(request.codeDigest ?? '')),
            request.codeDigest ?? '',
          );
          assertConsentCodeBoundary(request, code, now);
        }
        return this.#consentResult(request, decision);
      });
    } catch (error) {
      if (error instanceof McpOAuthServiceError) throw error;
      throw unavailable();
    }
  }

  #consentResult(
    request: StoredAuthorizationRequest,
    requestedDecision: 'approve' | 'deny',
  ): OAuthConsentResult {
    if (request.status === 'pending') throw unavailable();
    const expectedDecision = request.status === 'approved' ? 'approve' : 'deny';
    if (expectedDecision !== requestedDecision) throw invalid();
    if (request.status === 'denied') {
      return {
        decision: 'denied',
        redirectUri: appendOAuthResult(request.redirectUri, {
          error: 'access_denied',
          state: request.state,
          iss: this.#publicOrigin,
        }),
      };
    }
    const code = this.#authorizationCodeValue(request.id);
    if (request.codeDigest !== sha256(code)) throw unavailable();
    return {
      decision: 'approved',
      redirectUri: appendOAuthResult(request.redirectUri, {
        code,
        state: request.state,
        iss: this.#publicOrigin,
      }),
    };
  }

  #authorizationCodeValue(requestId: string): string {
    return `olm_ac_${Buffer.from(
      hmac(this.#secret, `oauth-code:${requestId}`),
      'hex',
    ).toString('base64url')}`;
  }

  #tokenResult(
    accessToken: string,
    refreshToken: string,
    scopes: readonly McpOAuthScope[],
  ): OAuthTokenResult {
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: mcpAccessTokenLifetimeSeconds,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
      resource: this.#resource,
    };
  }

  #trustedNow(): string {
    return this.#clockDate().toISOString();
  }

  #clockDate(): Date {
    const now = this.#clock();
    if (!Number.isFinite(now.getTime())) throw unavailable();
    return now;
  }

  #clientId(value: string): string {
    if (!/^olm_client_[a-f0-9]{32}$/u.test(value)) throw invalid();
    return value;
  }

  #requestId(value: string): string {
    if (!/^oauthreq_[a-f0-9]{32}$/u.test(value)) throw invalid();
    return value;
  }

  #userId(value: string): string {
    if (value !== value.trim() || !safeReference(value)) throw accessDenied();
    return value;
  }
}

function accessDenied(): McpOAuthServiceError {
  return new McpOAuthServiceError(
    'OAUTH_ACCESS_DENIED',
    'The requested OAuth interaction is unavailable.',
  );
}

export function oauthScopeAction(scope: McpOAuthScope): WorkspaceAction {
  return scopeAction[scope];
}

export function mcpOAuthScopeAllowed(
  granted: readonly McpOAuthScope[],
  required: McpOAuthScope,
): boolean {
  return granted.includes(required);
}

export function cloneMcpAccessGrant(grant: McpAccessGrant): McpAccessGrant {
  return clone(grant);
}

export async function inspectOAuthRepositoryRecord(
  repository: CollaborationRepository,
  path: string,
): Promise<unknown | null> {
  return repository.runTransaction((transaction: CollaborationTransaction) => transaction.get(path));
}
