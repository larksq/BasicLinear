import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  BillingServiceError,
  type BillingService,
} from './billing-service.js';
import {
  CollaborationServiceError,
  type CollaborationIssuePriority,
  type CollaborationIssueResource,
  type CollaborationIssueStatus,
  type CollaborationService,
} from './collaboration-service.js';
import {
  InvitationServiceError,
  type InvitationService,
} from './invitation-service.js';
import {
  PersonalTokenServiceError,
  personalTokenAudience,
  personalTokenScopes,
  type PersonalTokenScope,
  type PersonalTokenService,
} from './personal-token-service.js';
import {
  hostedProjectStatuses,
  ProjectManagementServiceError,
  workspaceExportMediaType,
  type HostedProjectStatus,
  type ProjectManagementService,
} from './project-management-service.js';
import {
  WorkspaceAuthorizationError,
  type WorkspaceAction,
  type WorkspacePrincipal,
} from './workspace-authorization.js';
import {
  hostedWorkflowStatusCategories, hostedWorkflowStatusIcons, hostedCycleStates,
  hostedSavedViewTypes, hostedSavedViewPredicates,
} from './workspace-configuration-service.js';

export interface RestApiHandlerOptions {
  personalTokenService: PersonalTokenService;
  projectManagementService: ProjectManagementService;
  collaborationService: CollaborationService;
  invitationService: InvitationService;
  billingService: BillingService;
  cursorSecret: string | Uint8Array;
}

export type RestApiHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  correlationId: string,
  url: URL,
) => Promise<boolean>;

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    correlationId: string;
    currentRevision?: number;
  };
}

interface CachedJsonBody {
  bytes: number;
  value: unknown;
}

interface RestMutationContract {
  maximumBytes: number;
  idempotencyKeyKind: 'bounded' | 'provider-safe' | 'invitation-safe';
  revisionRequired: boolean;
}

class RestRequestError extends Error {
  constructor(
    readonly code: 'INVALID_REQUEST' | 'REQUEST_TOO_LARGE' | 'REVISION_REQUIRED',
    readonly status: 400 | 413 | 428,
    message: string,
  ) {
    super(message);
    this.name = 'RestRequestError';
  }
}

class CursorError extends Error {
  constructor() {
    super('The pagination cursor is invalid for this collection.');
    this.name = 'CursorError';
  }
}

const workspacePath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})$/u;
const projectsPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects$/u;
const projectPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects\/(project_[a-f0-9]{32})$/u;
const projectMilestonesPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects\/(project_[a-f0-9]{32})\/milestones$/u;
const milestonePath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/milestones\/(milestone_[a-f0-9]{32})$/u;
const issuesPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues$/u;
const issuePath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})$/u;
const issueAssigneePath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/assignee$/u;
const commentsPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/comments$/u;
const commentPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/comments\/(comment_[a-f0-9]{32})$/u;
const membersPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/members$/u;
const memberPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/members\/([^/]{3,384})$/u;
const invitationsPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/invitations$/u;
const invitationActionPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/invitations\/(invite_[a-f0-9]{32})\/(resend|revoke)$/u;
const billingPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/billing$/u;
const exportPath = /^\/api\/v1\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/export$/u;
const parsedJsonBodies = new WeakMap<IncomingMessage, CachedJsonBody>();

function requestHeaderValues(request: IncomingMessage, name: string): string[] {
  const normalized = name.toLowerCase();
  const distinct = request.headersDistinct?.[normalized];
  if (distinct !== undefined) return [...distinct];
  const raw = request.rawHeaders;
  if (Array.isArray(raw) && raw.length > 0) {
    const values: string[] = [];
    for (let index = 0; index < raw.length; index += 2) {
      if (raw[index]?.toLowerCase() === normalized) values.push(raw[index + 1] ?? '');
    }
    if (values.length > 0) return values;
  }
  const collapsed = request.headers[normalized];
  if (Array.isArray(collapsed)) return [...collapsed];
  return collapsed === undefined ? [] : [collapsed];
}

function singleRequestHeader(request: IncomingMessage, name: string): string | null {
  const values = requestHeaderValues(request, name);
  if (values.length > 1) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request headers are invalid.');
  }
  return values[0] ?? null;
}

function declaredJsonMediaType(request: IncomingMessage): string | null {
  const contentType = singleRequestHeader(request, 'content-type');
  if (contentType !== null
    && !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType.trim())) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body media type is invalid.');
  }
  return contentType;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-basiclinear-request-id': correlationId,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function errorEnvelope(
  code: string,
  message: string,
  correlationId: string,
  currentRevision?: number,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      correlationId,
      ...(currentRevision === undefined ? {} : {currentRevision}),
    },
  };
}

function bearerToken(request: IncomingMessage): string {
  const values = requestHeaderValues(request, 'authorization');
  const value = values.length === 1 ? values[0] ?? null : null;
  if (value === null || !value.startsWith('Bearer ')) throw new PersonalTokenServiceError(
    'TOKEN_AUTHENTICATION_FAILED',
    'A valid personal access token is required.',
  );
  const token = value.slice('Bearer '.length).trim();
  if (token.length < 80 || token.length > 512 || /\s/u.test(token)) {
    throw new PersonalTokenServiceError('TOKEN_AUTHENTICATION_FAILED', 'A valid personal access token is required.');
  }
  return token;
}

function mutationKey(request: IncomingMessage): string {
  return singleRequestHeader(request, 'idempotency-key') ?? '';
}

function expectedRevision(request: IncomingMessage): number {
  const value = singleRequestHeader(request, 'if-match');
  const match = value === null ? null : /^"rev-([1-9][0-9]{0,14})"$/u.exec(value);
  const revision = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new RestRequestError('REVISION_REQUIRED', 428, 'Supply If-Match with the current revision ETag.');
  }
  return revision;
}

async function readJson(request: IncomingMessage, maximumBytes = 16_384): Promise<unknown> {
  const cached = parsedJsonBodies.get(request);
  if (cached !== undefined) {
    if (cached.bytes > maximumBytes) {
      throw new RestRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
    }
    return cached.value;
  }
  const lengthValue = singleRequestHeader(request, 'content-length');
  const contentType = declaredJsonMediaType(request);
  if (lengthValue !== null && !/^(?:0|[1-9][0-9]*)$/u.test(lengthValue)) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const length = lengthValue === null ? 0 : Number(lengthValue);
  if (!Number.isSafeInteger(length) || length < 0) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  if (length > maximumBytes) {
    throw new RestRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    received += buffer.byteLength;
    if (received > maximumBytes) {
      throw new RestRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
    }
    chunks.push(buffer);
  }
  if (received === 0) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  if (contentType === null) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body media type is invalid.');
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    parsedJsonBodies.set(request, {bytes: received, value});
    return value;
  } catch {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
}

function restMutationContract(pathname: string, method: string | undefined): RestMutationContract | null {
  const bounded = (revisionRequired = false, maximumBytes = 16_384): RestMutationContract => ({
    maximumBytes,
    idempotencyKeyKind: 'bounded',
    revisionRequired,
  });
  if (method === 'POST' && projectsPath.test(pathname)) return bounded();
  if (method === 'PATCH' && projectPath.test(pathname)) return bounded(true);
  if (method === 'POST' && projectMilestonesPath.test(pathname)) return bounded();
  if (method === 'PATCH' && milestonePath.test(pathname)) return bounded(true);
  if (method === 'POST' && issuesPath.test(pathname)) return bounded();
  if (method === 'PATCH' && issuePath.test(pathname)) return bounded(true);
  if (method === 'PUT' && issueAssigneePath.test(pathname)) return bounded(true);
  if (method === 'POST' && commentsPath.test(pathname)) return bounded();
  if (method === 'PATCH' && commentPath.test(pathname)) return bounded(true);
  if (method === 'DELETE' && commentPath.test(pathname)) return bounded(true, 512);
  if (method === 'DELETE' && memberPath.test(pathname)) return {
    maximumBytes: 512,
    idempotencyKeyKind: 'provider-safe',
    revisionRequired: false,
  };
  if (method === 'POST' && invitationsPath.test(pathname)) return {
    maximumBytes: 16_384,
    idempotencyKeyKind: 'invitation-safe',
    revisionRequired: false,
  };
  if (method === 'POST' && invitationActionPath.test(pathname)) return {
    maximumBytes: 512,
    idempotencyKeyKind: 'invitation-safe',
    revisionRequired: false,
  };
  return null;
}

function preflightIdempotencyKey(request: IncomingMessage, kind: RestMutationContract['idempotencyKeyKind']): void {
  const value = singleRequestHeader(request, 'idempotency-key');
  const normalized = value?.trim() ?? '';
  const maximum = kind === 'invitation-safe' ? 128 : 160;
  const validCharacters = kind === 'bounded' ? !/\s/u.test(normalized) : /^[A-Za-z0-9._:-]+$/u.test(normalized);
  if (normalized.length < 16 || normalized.length > maximum || !validCharacters) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request headers are invalid.');
  }
}

async function preflightRestMutation(
  request: IncomingMessage,
  contract: RestMutationContract,
): Promise<void> {
  if (declaredJsonMediaType(request) === null) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body media type is invalid.');
  }
  preflightIdempotencyKey(request, contract.idempotencyKeyKind);
  const revision = singleRequestHeader(request, 'if-match');
  if (contract.revisionRequired) expectedRevision(request);
  else if (revision !== null && !/^"rev-[1-9][0-9]{0,14}"$/u.test(revision)) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request headers are invalid.');
  }
  bearerToken(request);
  await readJson(request, contract.maximumBytes);
}

function exactObject(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.some((key) => !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(candidate, key))) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  return candidate;
}

function decodedMemberReference(value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request path is invalid.');
  }
  if (decoded.length < 3 || decoded.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(decoded)) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request path is invalid.');
  }
  return decoded;
}

function allowedQuery(url: URL, names: readonly string[]): void {
  for (const name of url.searchParams.keys()) {
    if (!names.includes(name) || url.searchParams.getAll(name).length !== 1) throw new CursorError();
  }
}

function exactQuery(url: URL, names: readonly string[]): void {
  for (const name of url.searchParams.keys()) {
    if (!names.includes(name)) {
      throw new RestRequestError('INVALID_REQUEST', 400, 'The request query is invalid.');
    }
    if (url.searchParams.getAll(name).length !== 1) throw new CursorError();
  }
}

interface CursorPayload {
  v: 1;
  workspaceId: string;
  resource: string;
  lastId: string;
  limit: number;
}

class CursorCodec {
  constructor(private readonly secret: string | Uint8Array) {
    const length = typeof secret === 'string' ? Buffer.byteLength(secret, 'utf8') : secret.byteLength;
    if (length < 32 || length > 512) throw new Error('REST cursor secret must contain 32 to 512 bytes.');
  }

  encode(payload: CursorPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.secret).update(encoded).digest('base64url');
    return `${encoded}.${signature}`;
  }

  decode(value: string, workspaceId: string, resource: string): CursorPayload {
    const match = /^([A-Za-z0-9_-]{20,1024})\.([A-Za-z0-9_-]{43})$/u.exec(value);
    if (match === null) throw new CursorError();
    const encoded = match[1] as string;
    const signature = match[2] as string;
    const expected = createHmac('sha256', this.secret).update(encoded).digest('base64url');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new CursorError();
    let candidate: unknown;
    try {
      candidate = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
    } catch {
      throw new CursorError();
    }
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) throw new CursorError();
    const payload = candidate as Record<string, unknown>;
    const keys = Object.keys(payload).sort();
    if (keys.join(',') !== ['lastId', 'limit', 'resource', 'v', 'workspaceId'].sort().join(',')
      || payload.v !== 1 || payload.workspaceId !== workspaceId || payload.resource !== resource
      || typeof payload.lastId !== 'string' || payload.lastId.length < 3 || payload.lastId.length > 128
      || !Number.isSafeInteger(payload.limit) || (payload.limit as number) < 1 || (payload.limit as number) > 100) {
      throw new CursorError();
    }
    return payload as unknown as CursorPayload;
  }
}

function paginate<Value extends {id: string}>(
  values: readonly Value[],
  url: URL,
  workspaceId: string,
  resource: string,
  codec: CursorCodec,
): {items: Value[]; nextCursor: string | null} {
  allowedQuery(url, ['cursor', 'limit']);
  const cursorValue = url.searchParams.get('cursor');
  const explicitLimit = url.searchParams.get('limit');
  if (explicitLimit !== null && !/^(?:[1-9]|[1-9][0-9]|100)$/u.test(explicitLimit)) throw new CursorError();
  const cursor = cursorValue === null ? null : codec.decode(cursorValue, workspaceId, resource);
  const limit = explicitLimit === null
    ? cursor?.limit ?? 50
    : Number(explicitLimit);
  if (cursor !== null && cursor.limit !== limit) throw new CursorError();
  const sorted = [...values].sort((left, right) => left.id.localeCompare(right.id));
  const start = cursor === null ? 0 : sorted.findIndex((value) => value.id === cursor.lastId) + 1;
  if (cursor !== null && start === 0) throw new CursorError();
  const page = sorted.slice(start, start + limit);
  const hasMore = start + page.length < sorted.length;
  const last = page.at(-1);
  return {
    items: page,
    nextCursor: hasMore && last !== undefined
      ? codec.encode({v: 1, workspaceId, resource, lastId: last.id, limit})
      : null,
  };
}

function etag(revision: number): Record<string, string> {
  return {etag: `"rev-${revision}"`};
}

async function principal(
  request: IncomingMessage,
  options: RestApiHandlerOptions,
  workspaceId: string,
  requiredScope: PersonalTokenScope,
  action: WorkspaceAction,
  targetEntityType: string,
  targetEntityId: string,
  correlationId: string,
): Promise<WorkspacePrincipal> {
  return options.personalTokenService.authenticate({
    rawToken: bearerToken(request),
    workspaceId,
    requiredScope,
    action,
    targetEntityType,
    targetEntityId,
    requestId: correlationId,
  });
}

function writeMethodNotAllowed(
  response: ServerResponse,
  correlationId: string,
  allow: string,
): void {
  writeJson(
    response,
    405,
    errorEnvelope('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
    correlationId,
    {allow},
  );
}

function writeError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof RestRequestError) {
    writeJson(response, error.status, errorEnvelope(error.code, error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof CursorError) {
    writeJson(response, 400, errorEnvelope('INVALID_CURSOR', error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorEnvelope(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'SERVICE_UNAVAILABLE',
        denied ? 'The requested workspace resource is unavailable.' : 'The API is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof PersonalTokenServiceError) {
    const status: Record<PersonalTokenServiceError['code'], number> = {
      INVALID_TOKEN_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      TOKEN_NOT_FOUND: 404,
      TOKEN_CONFLICT: 409,
      TOKEN_AUTHENTICATION_FAILED: 401,
      TOKEN_SCOPE_DENIED: 403,
      TOKEN_ENTITLEMENT_REQUIRED: 402,
      TOKEN_SERVICE_UNAVAILABLE: 503,
    };
    const publicCode = error.code === 'TOKEN_AUTHENTICATION_FAILED'
      ? 'API_AUTHENTICATION_REQUIRED'
      : error.code;
    writeJson(response, status[error.code], errorEnvelope(publicCode, error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof ProjectManagementServiceError) {
    const status: Record<ProjectManagementServiceError['code'], number> = {
      INVALID_PM_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      PM_NOT_FOUND: 404,
      PM_CONFLICT: 409,
      PM_FORBIDDEN: 403,
      PM_ENTITLEMENT_REQUIRED: 402,
      PM_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, status[error.code], errorEnvelope(error.code, error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof CollaborationServiceError) {
    const status: Record<CollaborationServiceError['code'], number> = {
      INVALID_COLLABORATION_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      COLLABORATION_NOT_FOUND: 404,
      COLLABORATION_CONFLICT: 409,
      COLLABORATION_FORBIDDEN: 403,
      COLLABORATION_ENTITLEMENT_REQUIRED: 402,
      ASSIGNEE_UNAVAILABLE: 409,
      COLLABORATION_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, status[error.code], errorEnvelope(error.code, error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof InvitationServiceError) {
    const status: Record<InvitationServiceError['code'], number> = {
      INVALID_INVITATION_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      INVITATION_NOT_FOUND: 404,
      INVITATION_UNAVAILABLE: 404,
      INVITATION_EMAIL_MISMATCH: 403,
      INVITATION_EXPIRED: 410,
      INVITATION_REVOKED: 410,
      INVITATION_SUPERSEDED: 409,
      INVITATION_ALREADY_ACCEPTED: 409,
      INVITATION_FINALIZED: 409,
      INVITATION_SEND_LIMIT: 409,
      INVITATION_CONFLICT: 409,
      INVITATION_ENTITLEMENT_REQUIRED: 402,
      INVITATION_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, status[error.code], errorEnvelope(error.code, error.message, correlationId), correlationId);
    return;
  }
  if (error instanceof BillingServiceError) {
    const status: Record<BillingServiceError['code'], number> = {
      INVALID_BILLING_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      BILLING_CONFLICT: 409,
      BILLING_FORBIDDEN: 403,
      BILLING_UNAVAILABLE: 503,
    };
    writeJson(response, status[error.code], errorEnvelope(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(
    response,
    503,
    errorEnvelope('SERVICE_UNAVAILABLE', 'The API is temporarily unavailable.', correlationId),
    correlationId,
  );
}

function invitationResult(result: Awaited<ReturnType<InvitationService['createOwnerInvitation']>>) {
  return {
    changed: result.changed,
    invitation: result.invitation,
    inviteUrl: result.shareToken === null
      ? null
      : `/hosted.html#invite=${encodeURIComponent(result.shareToken)}`,
  };
}

async function handleWorkspace(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') return writeMethodNotAllowed(response, correlationId, 'GET');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'workspace:read', 'workspace.read', 'workspace', workspaceId, correlationId,
  );
  const workspace = await options.projectManagementService.getWorkspace({
    principal: apiPrincipal, workspaceId, requestId: correlationId,
  });
  writeJson(response, 200, {data: {workspace}}, correlationId, etag(workspace.revision));
}

async function handleProjects(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return writeMethodNotAllowed(response, correlationId, 'GET, POST');
  }
  const write = request.method === 'POST';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'projects:write' : 'projects:read',
    write ? 'project.write' : 'project.read', 'project', write ? 'new' : 'collection', correlationId,
  );
  if (!write) {
    const projects = await options.projectManagementService.listProjects({
      principal: apiPrincipal, workspaceId, requestId: correlationId,
    });
    writeJson(response, 200, {data: paginate(projects, url, workspaceId, 'projects', codec)}, correlationId);
    return;
  }
  const body = exactObject(await readJson(request), ['name', 'summary', 'status'], ['name']);
  if (typeof body.name !== 'string'
    || (body.summary !== undefined && typeof body.summary !== 'string')
    || (body.status !== undefined && (typeof body.status !== 'string'
      || !(hostedProjectStatuses as readonly string[]).includes(body.status)))) throw new RestRequestError(
    'INVALID_REQUEST', 400, 'The request body is invalid.',
  );
  const project = await options.projectManagementService.createProject({
    principal: apiPrincipal,
    workspaceId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    name: body.name,
    ...(body.summary === undefined ? {} : {summary: body.summary as string}),
    ...(body.status === undefined ? {} : {status: body.status as HostedProjectStatus}),
  });
  writeJson(response, 201, {data: {project}}, correlationId, etag(project.revision));
}

async function handleProject(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  projectId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    return writeMethodNotAllowed(response, correlationId, 'GET, PATCH');
  }
  const write = request.method === 'PATCH';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'projects:write' : 'projects:read',
    write ? 'project.write' : 'project.read', 'project', projectId, correlationId,
  );
  if (!write) {
    const project = await options.projectManagementService.getProject({
      principal: apiPrincipal, workspaceId, projectId, requestId: correlationId,
    });
    writeJson(response, 200, {data: {project}}, correlationId, etag(project.revision));
    return;
  }
  const revision = expectedRevision(request);
  const body = exactObject(await readJson(request), ['name', 'summary', 'status'], []);
  if (Object.keys(body).length === 0 || (body.name !== undefined && typeof body.name !== 'string')
    || (body.summary !== undefined && typeof body.summary !== 'string')
    || (body.status !== undefined && (typeof body.status !== 'string'
      || !(hostedProjectStatuses as readonly string[]).includes(body.status)))) throw new RestRequestError(
    'INVALID_REQUEST', 400, 'The request body is invalid.',
  );
  const project = await options.projectManagementService.updateProject({
    principal: apiPrincipal,
    workspaceId,
    projectId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    expectedRevision: revision,
    patch: body as {name?: string; summary?: string; status?: HostedProjectStatus},
  });
  writeJson(response, 200, {data: {project}}, correlationId, etag(project.revision));
}

async function handleProjectMilestones(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  projectId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return writeMethodNotAllowed(response, correlationId, 'GET, POST');
  }
  const write = request.method === 'POST';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'milestones:write' : 'milestones:read',
    write ? 'milestone.write' : 'milestone.read', 'project', projectId, correlationId,
  );
  if (!write) {
    const milestones = await options.projectManagementService.listMilestones({
      principal: apiPrincipal, workspaceId, projectId, requestId: correlationId,
    });
    writeJson(
      response,
      200,
      {data: paginate(milestones, url, workspaceId, `project:${projectId}:milestones`, codec)},
      correlationId,
    );
    return;
  }
  const body = exactObject(
    await readJson(request),
    ['name', 'description', 'targetDate'],
    ['name'],
  );
  if (typeof body.name !== 'string'
    || (body.description !== undefined && typeof body.description !== 'string')
    || (body.targetDate !== undefined && body.targetDate !== null && typeof body.targetDate !== 'string')) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const milestone = await options.projectManagementService.createMilestone({
    principal: apiPrincipal,
    workspaceId,
    projectId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    name: body.name,
    ...(body.description === undefined ? {} : {description: body.description as string}),
    ...(body.targetDate === undefined ? {} : {targetDate: body.targetDate as string | null}),
  });
  writeJson(response, 201, {data: {milestone}}, correlationId, etag(milestone.revision));
}

async function handleMilestone(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  milestoneId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    return writeMethodNotAllowed(response, correlationId, 'GET, PATCH');
  }
  const write = request.method === 'PATCH';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'milestones:write' : 'milestones:read',
    write ? 'milestone.write' : 'milestone.read', 'milestone', milestoneId, correlationId,
  );
  if (!write) {
    const milestone = await options.projectManagementService.getMilestone({
      principal: apiPrincipal, workspaceId, milestoneId, requestId: correlationId,
    });
    writeJson(response, 200, {data: {milestone}}, correlationId, etag(milestone.revision));
    return;
  }
  const revision = expectedRevision(request);
  const body = exactObject(await readJson(request), ['name', 'description', 'targetDate'], []);
  if (Object.keys(body).length === 0 || (body.name !== undefined && typeof body.name !== 'string')
    || (body.description !== undefined && typeof body.description !== 'string')
    || (body.targetDate !== undefined && body.targetDate !== null && typeof body.targetDate !== 'string')) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const milestone = await options.projectManagementService.updateMilestone({
    principal: apiPrincipal,
    workspaceId,
    milestoneId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    expectedRevision: revision,
    patch: body as {name?: string; description?: string; targetDate?: string | null},
  });
  writeJson(response, 200, {data: {milestone}}, correlationId, etag(milestone.revision));
}

async function handleIssues(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return writeMethodNotAllowed(response, correlationId, 'GET, POST');
  }
  const write = request.method === 'POST';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'issues:write' : 'issues:read',
    write ? 'issue.write' : 'issue.read', 'issue', write ? 'new' : 'collection', correlationId,
  );
  if (!write) {
    const issues = await options.collaborationService.listIssues({
      principal: apiPrincipal, workspaceId, requestId: correlationId,
    });
    writeJson(response, 200, {data: paginate(issues, url, workspaceId, 'issues', codec)}, correlationId);
    return;
  }
  const body = exactObject(await readJson(request), [
    'title', 'description', 'projectId', 'milestoneId', 'parentIssueId', 'resources',
  ], ['title']);
  if (typeof body.title !== 'string'
    || (body.description !== undefined && typeof body.description !== 'string')
    || (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string')
    || (body.milestoneId !== undefined && body.milestoneId !== null && typeof body.milestoneId !== 'string')
    || (body.parentIssueId !== undefined && body.parentIssueId !== null && typeof body.parentIssueId !== 'string')
    || (body.resources !== undefined && !Array.isArray(body.resources))) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const issue = await options.collaborationService.createIssue({
    principal: apiPrincipal,
    workspaceId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    title: body.title,
    ...(body.description === undefined ? {} : {description: body.description as string}),
    ...(body.projectId === undefined ? {} : {projectId: body.projectId as string | null}),
    ...(body.milestoneId === undefined ? {} : {milestoneId: body.milestoneId as string | null}),
    ...(body.parentIssueId === undefined ? {} : {parentIssueId: body.parentIssueId as string | null}),
    ...(body.resources === undefined ? {} : {resources: body.resources as CollaborationIssueResource[]}),
  });
  writeJson(response, 201, {data: {issue}}, correlationId, etag(issue.revision));
}

async function handleIssue(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    return writeMethodNotAllowed(response, correlationId, 'GET, PATCH');
  }
  const write = request.method === 'PATCH';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'issues:write' : 'issues:read',
    write ? 'issue.write' : 'issue.read', 'issue', issueId, correlationId,
  );
  if (!write) {
    const issue = await options.collaborationService.getIssue({
      principal: apiPrincipal, workspaceId, issueId, requestId: correlationId,
    });
    writeJson(response, 200, {data: {issue}}, correlationId, etag(issue.revision));
    return;
  }
  const revision = expectedRevision(request);
  const body = exactObject(
    await readJson(request),
    ['title', 'description', 'status', 'priority', 'projectId', 'milestoneId', 'parentIssueId', 'resources'],
    [],
  );
  if (Object.keys(body).length === 0 || (body.title !== undefined && typeof body.title !== 'string')
    || (body.description !== undefined && typeof body.description !== 'string')
    || (body.status !== undefined && typeof body.status !== 'string')
    || (body.priority !== undefined && typeof body.priority !== 'string')
    || (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string')
    || (body.milestoneId !== undefined && body.milestoneId !== null && typeof body.milestoneId !== 'string')
    || (body.parentIssueId !== undefined && body.parentIssueId !== null && typeof body.parentIssueId !== 'string')
    || (body.resources !== undefined && !Array.isArray(body.resources))) {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const issue = await options.collaborationService.updateIssue({
    principal: apiPrincipal,
    workspaceId,
    issueId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    expectedRevision: revision,
    patch: body as {
      title?: string;
      description?: string;
      status?: CollaborationIssueStatus;
      priority?: CollaborationIssuePriority;
      projectId?: string | null;
      milestoneId?: string | null;
      parentIssueId?: string | null;
      resources?: CollaborationIssueResource[];
    },
  });
  writeJson(response, 200, {data: {issue}}, correlationId, etag(issue.revision));
}

async function handleIssueAssignee(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PUT') return writeMethodNotAllowed(response, correlationId, 'PUT');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'issues:write', 'issue.write', 'issue', issueId, correlationId,
  );
  const revision = expectedRevision(request);
  const body = exactObject(await readJson(request), ['assigneeUserId'], ['assigneeUserId']);
  if (body.assigneeUserId !== null && typeof body.assigneeUserId !== 'string') {
    throw new RestRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const issue = await options.collaborationService.assignIssue({
    principal: apiPrincipal,
    workspaceId,
    issueId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    expectedRevision: revision,
    assigneeUserId: body.assigneeUserId as string | null,
  });
  writeJson(response, 200, {data: {issue}}, correlationId, etag(issue.revision));
}

async function handleComments(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return writeMethodNotAllowed(response, correlationId, 'GET, POST');
  }
  const write = request.method === 'POST';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'comments:write' : 'comments:read',
    write ? 'comment.write' : 'comment.read', 'issue', issueId, correlationId,
  );
  if (!write) {
    const comments = await options.collaborationService.listComments({
      principal: apiPrincipal, workspaceId, issueId, requestId: correlationId,
    });
    writeJson(
      response,
      200,
      {data: paginate(comments, url, workspaceId, `issue:${issueId}:comments`, codec)},
      correlationId,
    );
    return;
  }
  const body = exactObject(await readJson(request), ['body'], ['body']);
  if (typeof body.body !== 'string') throw new RestRequestError(
    'INVALID_REQUEST', 400, 'The request body is invalid.',
  );
  const comment = await options.collaborationService.createComment({
    principal: apiPrincipal,
    workspaceId,
    issueId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    body: body.body,
  });
  writeJson(response, 201, {data: {comment}}, correlationId, etag(comment.revision));
}

async function handleComment(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  issueId: string,
  commentId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'DELETE') {
    return writeMethodNotAllowed(response, correlationId, 'GET, PATCH, DELETE');
  }
  const write = request.method !== 'GET';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'comments:write' : 'comments:read',
    write ? 'comment.write' : 'comment.read', 'comment', commentId, correlationId,
  );
  if (!write) {
    const comment = await options.collaborationService.getComment({
      principal: apiPrincipal, workspaceId, issueId, commentId, requestId: correlationId,
    });
    writeJson(response, 200, {data: {comment}}, correlationId, etag(comment.revision));
    return;
  }
  const revision = expectedRevision(request);
  if (request.method === 'PATCH') {
    const body = exactObject(await readJson(request), ['body'], ['body']);
    if (typeof body.body !== 'string') throw new RestRequestError(
      'INVALID_REQUEST', 400, 'The request body is invalid.',
    );
    const comment = await options.collaborationService.editComment({
      principal: apiPrincipal,
      workspaceId,
      issueId,
      commentId,
      requestId: correlationId,
      idempotencyKey: mutationKey(request),
      expectedRevision: revision,
      body: body.body,
    });
    writeJson(response, 200, {data: {comment}}, correlationId, etag(comment.revision));
    return;
  }
  exactObject(await readJson(request, 512), [], []);
  const comment = await options.collaborationService.deleteComment({
    principal: apiPrincipal,
    workspaceId,
    issueId,
    commentId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    expectedRevision: revision,
  });
  writeJson(response, 200, {data: {comment}}, correlationId, etag(comment.revision));
}

async function handleMembers(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') return writeMethodNotAllowed(response, correlationId, 'GET');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'members:read', 'membership.list', 'membership', 'collection', correlationId,
  );
  const members = await options.collaborationService.listMembers({
    principal: apiPrincipal, workspaceId, requestId: correlationId,
  });
  const withIds = members.map((member) => ({id: member.userId, ...member}));
  writeJson(response, 200, {data: paginate(withIds, url, workspaceId, 'members', codec)}, correlationId);
}

async function handleMember(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  encodedUserId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'DELETE') return writeMethodNotAllowed(response, correlationId, 'DELETE');
  const userId = decodedMemberReference(encodedUserId);
  const apiPrincipal = await principal(
    request, options, workspaceId, 'members:write', 'membership.manage', 'membership', userId, correlationId,
  );
  exactObject(await readJson(request, 512), [], []);
  const result = await options.billingService.removeMember({
    principal: apiPrincipal,
    workspaceId,
    userId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
  });
  writeJson(response, 200, {data: result}, correlationId);
}

async function handleInvitations(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  codec: CursorCodec,
  url: URL,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return writeMethodNotAllowed(response, correlationId, 'GET, POST');
  }
  const write = request.method === 'POST';
  const apiPrincipal = await principal(
    request, options, workspaceId, write ? 'invitations:write' : 'invitations:read',
    'invitation.manage', 'invitation', write ? 'new' : 'collection', correlationId,
  );
  if (!write) {
    const invitations = await options.invitationService.listOwnerInvitations({
      principal: apiPrincipal, workspaceId, requestId: correlationId,
    });
    writeJson(response, 200, {data: paginate(invitations, url, workspaceId, 'invitations', codec)}, correlationId);
    return;
  }
  const body = exactObject(await readJson(request), ['email'], ['email']);
  if (typeof body.email !== 'string') throw new RestRequestError(
    'INVALID_REQUEST', 400, 'The request body is invalid.',
  );
  const result = await options.invitationService.createOwnerInvitation({
    principal: apiPrincipal,
    workspaceId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
    invitedEmail: body.email,
  });
  writeJson(response, result.changed ? 201 : 200, {data: invitationResult(result)}, correlationId);
}

async function handleInvitationAction(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  invitationId: string,
  action: 'resend' | 'revoke',
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') return writeMethodNotAllowed(response, correlationId, 'POST');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'invitations:write', 'invitation.manage',
    'invitation', invitationId, correlationId,
  );
  exactObject(await readJson(request, 512), [], []);
  const command = {
    principal: apiPrincipal,
    workspaceId,
    invitationId,
    requestId: correlationId,
    idempotencyKey: mutationKey(request),
  };
  const result = action === 'resend'
    ? await options.invitationService.resendOwnerInvitation(command)
    : await options.invitationService.revokeOwnerInvitation(command);
  writeJson(response, 200, {data: invitationResult(result)}, correlationId);
}

async function handleBilling(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') return writeMethodNotAllowed(response, correlationId, 'GET');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'billing:read', 'billing.manage', 'billing', 'current', correlationId,
  );
  const billing = await options.billingService.summary({
    principal: apiPrincipal, workspaceId, requestId: correlationId,
  });
  writeJson(response, 200, {data: {billing}}, correlationId);
}

async function handleExport(
  request: IncomingMessage,
  response: ServerResponse,
  options: RestApiHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') return writeMethodNotAllowed(response, correlationId, 'GET');
  const apiPrincipal = await principal(
    request, options, workspaceId, 'workspace:export', 'workspace.export', 'workspace', workspaceId, correlationId,
  );
  const exported = await options.projectManagementService.exportWorkspace({
    principal: apiPrincipal, workspaceId, requestId: correlationId,
  });
  writeJson(response, 200, {data: exported}, correlationId, {
    'content-type': workspaceExportMediaType,
    'content-disposition': `attachment; filename="basiclinear-${workspaceId}-export-v1.json"`,
    'x-basiclinear-export-sha256': exported.sha256,
  });
}

const parameter = (name: string, location: 'path' | 'query' | 'header', required: boolean, schema: unknown) => ({
  name,
  in: location,
  required,
  schema,
});

const workspaceParameter = parameter('workspaceId', 'path', true, {
  type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._+-]{2,127}$',
});
const cursorParameters = [
  parameter('cursor', 'query', false, {type: 'string', minLength: 20, maxLength: 1068}),
  parameter('limit', 'query', false, {type: 'integer', minimum: 1, maximum: 100, default: 50}),
];
const idempotencyParameter = parameter('Idempotency-Key', 'header', true, {
  type: 'string', minLength: 16, maxLength: 160,
});
const revisionParameter = parameter('If-Match', 'header', true, {
  type: 'string', pattern: '^"rev-[1-9][0-9]{0,14}"$',
});
const jsonBody = (schema: unknown) => ({
  required: true,
  content: {'application/json': {schema}},
});

function operation(
  summary: string,
  scope: PersonalTokenScope,
  responseSchema: string,
  options: {
    parameters?: unknown[];
    requestBody?: unknown;
    created?: boolean;
    idempotentReplayOk?: boolean;
    etag?: boolean;
    responseMediaType?: string;
  } = {},
) {
  const successResponse = {
    description: 'Successful response',
    content: {
      [options.responseMediaType ?? 'application/json']: {
        schema: {$ref: `#/components/schemas/${responseSchema}`},
      },
    },
    ...(options.etag === true ? {
      headers: {
        ETag: {
          description: 'Current entity revision for If-Match.',
          schema: {type: 'string', pattern: '^"rev-[1-9][0-9]{0,14}"$'},
        },
      },
    } : {}),
  };
  return {
    summary,
    security: [{personalAccessToken: []}],
    'x-basiclinear-required-scope': scope,
    parameters: options.parameters ?? [workspaceParameter],
    ...(options.requestBody === undefined ? {} : {requestBody: options.requestBody}),
    responses: {
      [options.created === true ? '201' : '200']: successResponse,
      ...(options.idempotentReplayOk === true ? {'200': successResponse} : {}),
      '400': {$ref: '#/components/responses/BadRequest'},
      '401': {$ref: '#/components/responses/Unauthorized'},
      '402': {$ref: '#/components/responses/PaymentRequired'},
      '403': {$ref: '#/components/responses/Forbidden'},
      '404': {$ref: '#/components/responses/NotFound'},
      '409': {$ref: '#/components/responses/Conflict'},
      '410': {$ref: '#/components/responses/Gone'},
      '413': {$ref: '#/components/responses/TooLarge'},
      '405': {$ref: '#/components/responses/MethodNotAllowed'},
      '428': {$ref: '#/components/responses/PreconditionRequired'},
      '503': {$ref: '#/components/responses/Unavailable'},
    },
  };
}

export function basicLinearOpenApiDocument(): Record<string, unknown> {
  const stringId = {type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9:._@+-]{2,127}$'};
  const workspaceReference = {type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9._+-]{2,127}$'};
  const revision = {type: 'integer', minimum: 1};
  const timestamp = {type: 'string', format: 'date-time'};
  const projectIdParameter = parameter('projectId', 'path', true, {type: 'string', pattern: '^project_[a-f0-9]{32}$'});
  const milestoneIdParameter = parameter('milestoneId', 'path', true, {type: 'string', pattern: '^milestone_[a-f0-9]{32}$'});
  const issueIdParameter = parameter('issueId', 'path', true, {type: 'string', pattern: '^issue_[a-f0-9]{32}$'});
  const commentIdParameter = parameter('commentId', 'path', true, {type: 'string', pattern: '^comment_[a-f0-9]{32}$'});
  const invitationIdParameter = parameter('invitationId', 'path', true, {type: 'string', pattern: '^invite_[a-f0-9]{32}$'});
  const actionParameter = parameter('action', 'path', true, {type: 'string', enum: ['resend', 'revoke']});
  const userIdParameter = parameter('userId', 'path', true, stringId);
  const exact = (properties: Record<string, unknown>, required: string[]) => ({
    type: 'object', properties, required, additionalProperties: false,
  });
  const configurationRecord = (fields: Record<string, unknown>) => {
    const properties = {schemaVersion: {const: 1}, workspaceId: workspaceReference,
      createdAt: timestamp, updatedAt: timestamp, revision, ...fields};
    return exact(properties, Object.keys(properties));
  };
  const teamReference = {type: 'string', pattern: '^team_[a-f0-9]{32}$'};
  const statusReference = {type: 'string', pattern: '^status_[a-f0-9]{32}$'};
  const configurationColor = {type: 'string', pattern: '^#[0-9A-F]{6}$'};
  const projectWrite = exact({
    name: {type: 'string', minLength: 1, maxLength: 80},
    summary: {type: 'string', maxLength: 280},
    status: {type: 'string', enum: hostedProjectStatuses},
  }, ['name']);
  const milestoneWrite = exact({
    name: {type: 'string', minLength: 1, maxLength: 80},
    description: {type: 'string', maxLength: 4000},
    targetDate: {type: ['string', 'null'], format: 'date'},
  }, ['name']);
  const issuePlacementProperties = {
    projectId: {type: ['string', 'null'], pattern: '^project_[a-f0-9]{32}$'},
    milestoneId: {type: ['string', 'null'], pattern: '^milestone_[a-f0-9]{32}$'},
    parentIssueId: {type: ['string', 'null'], pattern: '^issue_[a-f0-9]{32}$'},
  };
  const issueResources = {
    type: 'array',
    maxItems: 25,
    items: exact({
      label: {type: 'string', minLength: 1, maxLength: 120},
      url: {type: 'string', format: 'uri', maxLength: 2048},
    }, ['label', 'url']),
  };
  const issueCreateWrite = exact({
    title: {type: 'string', minLength: 1, maxLength: 200},
    description: {type: 'string', maxLength: 10000},
    resources: issueResources,
    ...issuePlacementProperties,
  }, ['title']);
  const issueUpdateWrite = exact({
    title: {type: 'string', minLength: 1, maxLength: 200},
    description: {type: 'string', maxLength: 10000},
    status: {type: 'string', enum: ['todo', 'in_progress', 'done']},
    priority: {type: 'string', enum: ['no_priority', 'low', 'medium', 'high', 'urgent']},
    resources: issueResources,
    ...issuePlacementProperties,
  }, []);
  const pageEnvelope = (itemSchema: unknown) => exact({
    data: exact({
      items: {type: 'array', items: itemSchema},
      nextCursor: {type: ['string', 'null']},
    }, ['items', 'nextCursor']),
  }, ['data']);
  return {
    openapi: '3.1.1',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'BasicLinear Product Management API',
      version: '1.0.0',
      description: 'Workspace-scoped product-management REST API. Browser token management and billing purchase are not exposed here.',
    },
    servers: [{url: '/api/v1'}],
    tags: [
      {name: 'Workspaces'}, {name: 'Projects'}, {name: 'Milestones'}, {name: 'Issues'},
      {name: 'Comments'}, {name: 'Members'}, {name: 'Invitations'}, {name: 'Billing'}, {name: 'Export'},
    ],
    paths: {
      '/workspaces/{workspaceId}': {
        get: operation('Read a workspace', 'workspace:read', 'WorkspaceEnvelope', {etag: true}),
      },
      '/workspaces/{workspaceId}/projects': {
        get: operation('List projects', 'projects:read', 'ProjectPageEnvelope', {parameters: [workspaceParameter, ...cursorParameters]}),
        post: operation('Create a project', 'projects:write', 'ProjectEnvelope', {
          parameters: [workspaceParameter, idempotencyParameter], requestBody: jsonBody(projectWrite), created: true, etag: true,
        }),
      },
      '/workspaces/{workspaceId}/projects/{projectId}': {
        get: operation('Read a project', 'projects:read', 'ProjectEnvelope', {parameters: [workspaceParameter, projectIdParameter], etag: true}),
        patch: operation('Update a project', 'projects:write', 'ProjectEnvelope', {
          parameters: [workspaceParameter, projectIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody({...projectWrite, required: [], minProperties: 1}),
          etag: true,
        }),
      },
      '/workspaces/{workspaceId}/projects/{projectId}/milestones': {
        get: operation('List project milestones', 'milestones:read', 'MilestonePageEnvelope', {
          parameters: [workspaceParameter, projectIdParameter, ...cursorParameters],
        }),
        post: operation('Create a milestone', 'milestones:write', 'MilestoneEnvelope', {
          parameters: [workspaceParameter, projectIdParameter, idempotencyParameter],
          requestBody: jsonBody(milestoneWrite), created: true, etag: true,
        }),
      },
      '/workspaces/{workspaceId}/milestones/{milestoneId}': {
        get: operation('Read a milestone', 'milestones:read', 'MilestoneEnvelope', {parameters: [workspaceParameter, milestoneIdParameter], etag: true}),
        patch: operation('Update a milestone', 'milestones:write', 'MilestoneEnvelope', {
          parameters: [workspaceParameter, milestoneIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody({...milestoneWrite, required: [], minProperties: 1}),
          etag: true,
        }),
      },
      '/workspaces/{workspaceId}/issues': {
        get: operation('List issues', 'issues:read', 'IssuePageEnvelope', {parameters: [workspaceParameter, ...cursorParameters]}),
        post: operation('Create an issue', 'issues:write', 'IssueEnvelope', {
          parameters: [workspaceParameter, idempotencyParameter], requestBody: jsonBody(issueCreateWrite), created: true, etag: true,
        }),
      },
      '/workspaces/{workspaceId}/issues/{issueId}': {
        get: operation('Read an issue', 'issues:read', 'IssueEnvelope', {parameters: [workspaceParameter, issueIdParameter], etag: true}),
        patch: operation('Update an issue', 'issues:write', 'IssueEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody({...issueUpdateWrite, minProperties: 1}),
          etag: true,
        }),
      },
      '/workspaces/{workspaceId}/issues/{issueId}/assignee': {
        put: operation('Assign an issue', 'issues:write', 'IssueEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody(exact({assigneeUserId: {type: ['string', 'null'], maxLength: 128}}, ['assigneeUserId'])),
          etag: true,
        }),
      },
      '/workspaces/{workspaceId}/issues/{issueId}/comments': {
        get: operation('List issue comments', 'comments:read', 'CommentPageEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, ...cursorParameters],
        }),
        post: operation('Create a comment', 'comments:write', 'CommentEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, idempotencyParameter],
          requestBody: jsonBody(exact({body: {type: 'string', minLength: 1, maxLength: 4000}}, ['body'])),
          created: true, etag: true,
        }),
      },
      '/workspaces/{workspaceId}/issues/{issueId}/comments/{commentId}': {
        get: operation('Read a comment', 'comments:read', 'CommentEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, commentIdParameter], etag: true,
        }),
        patch: operation('Edit a comment', 'comments:write', 'CommentEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, commentIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody(exact({body: {type: 'string', minLength: 1, maxLength: 4000}}, ['body'])),
          etag: true,
        }),
        delete: operation('Soft-delete a comment', 'comments:write', 'CommentEnvelope', {
          parameters: [workspaceParameter, issueIdParameter, commentIdParameter, idempotencyParameter, revisionParameter],
          requestBody: jsonBody(exact({}, [])),
          etag: true,
        }),
      },
      '/workspaces/{workspaceId}/members': {
        get: operation('List active members', 'members:read', 'MemberPageEnvelope', {parameters: [workspaceParameter, ...cursorParameters]}),
      },
      '/workspaces/{workspaceId}/members/{userId}': {
        delete: operation('Remove a member', 'members:write', 'MemberRemovalEnvelope', {
          parameters: [workspaceParameter, userIdParameter, idempotencyParameter],
          requestBody: jsonBody(exact({}, [])),
        }),
      },
      '/workspaces/{workspaceId}/invitations': {
        get: operation('List invitations', 'invitations:read', 'InvitationPageEnvelope', {parameters: [workspaceParameter, ...cursorParameters]}),
        post: operation('Create an invitation', 'invitations:write', 'InvitationMutationEnvelope', {
          parameters: [workspaceParameter, idempotencyParameter],
          requestBody: jsonBody(exact({email: {type: 'string', format: 'email', maxLength: 254}}, ['email'])),
          created: true,
          idempotentReplayOk: true,
        }),
      },
      '/workspaces/{workspaceId}/invitations/{invitationId}/{action}': {
        post: operation('Resend or revoke an invitation', 'invitations:write', 'InvitationMutationEnvelope', {
          parameters: [workspaceParameter, invitationIdParameter, actionParameter, idempotencyParameter],
          requestBody: jsonBody(exact({}, [])),
        }),
      },
      '/workspaces/{workspaceId}/billing': {
        get: operation('Read billing state', 'billing:read', 'BillingEnvelope'),
      },
      '/workspaces/{workspaceId}/export': {
        get: operation('Export canonical workspace data', 'workspace:export', 'ExportEnvelope', {
          responseMediaType: workspaceExportMediaType,
        }),
      },
    },
    components: {
      securitySchemes: {
        personalAccessToken: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'BasicLinear PAT',
          description: `Owner-created, workspace-scoped token with audience ${personalTokenAudience}.`,
        },
      },
      schemas: {
        Error: exact({
          code: {type: 'string'}, message: {type: 'string'}, correlationId: {type: 'string'}, currentRevision: revision,
        }, ['code', 'message', 'correlationId']),
        ErrorEnvelope: exact({error: {$ref: '#/components/schemas/Error'}}, ['error']),
        Workspace: exact({
          schemaVersion: {const: 1}, id: workspaceReference, workspaceId: workspaceReference, name: {type: 'string'},
          ownerUserId: stringId, authority: {const: 'firebase-hosted'}, createdAt: timestamp, revision,
        }, ['schemaVersion', 'id', 'workspaceId', 'name', 'ownerUserId', 'authority', 'createdAt', 'revision']),
        Project: exact({
          schemaVersion: {const: 1}, id: {type: 'string', pattern: '^project_[a-f0-9]{32}$'}, workspaceId: workspaceReference, name: {type: 'string'},
          summary: {type: 'string'}, status: {type: 'string', enum: hostedProjectStatuses},
          createdByUserId: stringId, archivedAt: {type: 'null'}, createdAt: timestamp, updatedAt: timestamp, revision,
        }, ['schemaVersion', 'id', 'workspaceId', 'name', 'summary', 'status', 'createdByUserId', 'archivedAt', 'createdAt', 'updatedAt', 'revision']),
        Milestone: exact({
          schemaVersion: {const: 1}, id: {type: 'string', pattern: '^milestone_[a-f0-9]{32}$'}, workspaceId: workspaceReference,
          projectId: {type: 'string', pattern: '^project_[a-f0-9]{32}$'},
          name: {type: 'string'}, description: {type: 'string'}, targetDate: {type: ['string', 'null']},
          createdByUserId: stringId, archivedAt: {type: 'null'}, createdAt: timestamp, updatedAt: timestamp, revision,
        }, ['schemaVersion', 'id', 'workspaceId', 'projectId', 'name', 'description', 'targetDate', 'createdByUserId', 'archivedAt', 'createdAt', 'updatedAt', 'revision']),
        Issue: exact({
          schemaVersion: {const: 1},
          id: {type: 'string', pattern: '^issue_[a-f0-9]{32}$'},
          number: {type: 'integer', minimum: 1},
          workspaceId: workspaceReference,
          title: {type: 'string', minLength: 1, maxLength: 200},
          description: {type: 'string', maxLength: 10000},
          status: {type: 'string', enum: ['todo', 'in_progress', 'done']},
          priority: {type: 'string', enum: ['no_priority', 'low', 'medium', 'high', 'urgent']},
          teamId: teamReference,
          statusId: statusReference,
          cycleId: {type: ['string', 'null'], pattern: '^cycle_[a-f0-9]{32}$'},
          dueAt: {type: ['string', 'null'], format: 'date-time'},
          projectId: {type: ['string', 'null'], pattern: '^project_[a-f0-9]{32}$'},
          milestoneId: {type: ['string', 'null'], pattern: '^milestone_[a-f0-9]{32}$'},
          parentIssueId: {type: ['string', 'null'], pattern: '^issue_[a-f0-9]{32}$'},
          resources: issueResources,
          assigneeUserId: {type: ['string', 'null'], maxLength: 128},
          createdByUserId: stringId,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision,
        }, [
          'schemaVersion', 'id', 'number', 'workspaceId', 'title', 'description', 'status', 'priority', 'projectId',
          'milestoneId', 'parentIssueId', 'resources', 'assigneeUserId', 'createdByUserId',
          'createdAt', 'updatedAt', 'revision',
          'teamId', 'statusId', 'cycleId', 'dueAt',
        ]),
        Comment: exact({
          schemaVersion: {const: 1},
          id: {type: 'string', pattern: '^comment_[a-f0-9]{32}$'},
          workspaceId: workspaceReference,
          issueId: {type: 'string', pattern: '^issue_[a-f0-9]{32}$'},
          authorUserId: stringId,
          body: {type: ['string', 'null'], maxLength: 4000},
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: {type: ['string', 'null'], format: 'date-time'},
          revision,
        }, [
          'schemaVersion', 'id', 'workspaceId', 'issueId', 'authorUserId', 'body',
          'createdAt', 'updatedAt', 'deletedAt', 'revision',
        ]),
        Member: exact({
          id: stringId,
          userId: stringId,
          role: {type: 'string', enum: ['owner', 'member']},
        }, ['id', 'userId', 'role']),
        Invitation: exact({
          id: {type: 'string', pattern: '^invite_[a-f0-9]{32}$'},
          workspaceId: workspaceReference,
          invitedEmail: {type: 'string', format: 'email'},
          inviterDisplayName: {type: 'string'},
          workspaceName: {type: 'string'},
          role: {const: 'member'},
          state: {type: 'string', enum: ['pending', 'revoked', 'accepted', 'expired']},
          createdAt: timestamp,
          lastSentAt: timestamp,
          expiresAt: timestamp,
          acceptedAt: {type: ['string', 'null'], format: 'date-time'},
          revokedAt: {type: ['string', 'null'], format: 'date-time'},
          sendCount: {type: 'integer', minimum: 1, maximum: 10},
          activeSeatApplied: {type: 'boolean'},
          revision,
          teamIds: {type: 'array', items: teamReference, uniqueItems: true},
        }, [
          'id', 'workspaceId', 'invitedEmail', 'inviterDisplayName', 'workspaceName', 'role',
          'state', 'createdAt', 'lastSentAt', 'expiresAt', 'acceptedAt', 'revokedAt',
          'sendCount', 'activeSeatApplied', 'revision',
        ]),
        Billing: exact({
          workspaceId: workspaceReference,
          mode: {type: 'string', enum: ['trial_pro', 'paid_pro', 'free']},
          trial: exact({
            startedAt: timestamp, endsAt: timestamp, active: {type: 'boolean'},
          }, ['startedAt', 'endsAt', 'active']),
          seats: exact({
            active: {type: 'integer', minimum: 1},
            pendingInvitations: {type: 'integer', minimum: 0},
          }, ['active', 'pendingInvitations']),
          prices: exact({
            currency: {const: 'usd'},
            monthlyPerSeatCents: {const: 200},
            annualPerSeatCents: {const: 1200},
            monthlyTotalCents: {type: 'integer', minimum: 200},
            annualTotalCents: {type: 'integer', minimum: 1200},
          }, [
            'currency', 'monthlyPerSeatCents', 'annualPerSeatCents',
            'monthlyTotalCents', 'annualTotalCents',
          ]),
          subscription: {
            oneOf: [
              {type: 'null'},
              exact({
                plan: {type: 'string', enum: ['monthly', 'annual']},
                status: {
                  type: 'string',
                  enum: ['trialing', 'active', 'past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused'],
                },
                activeSeats: {type: 'integer', minimum: 1},
                paidThrough: timestamp,
                cancelAtPeriodEnd: {type: 'boolean'},
              }, ['plan', 'status', 'activeSeats', 'paidThrough', 'cancelAtPeriodEnd']),
            ],
          },
          verificationAccess: exact({
            source: {const: 'operator_allowlist'},
            endsAt: {const: '9999-12-31T23:59:59.999Z'},
            noCharge: {const: true},
          }, ['source', 'endsAt', 'noCharge']),
          free: exact({
            writerUserId: stringId,
            dataReadable: {const: true},
            exportEligible: {const: true},
            exportAvailable: {const: true},
            extraMemberWritesPaused: {const: true},
            automationWritesPaused: {const: true},
          }, [
            'writerUserId', 'dataReadable', 'exportEligible', 'exportAvailable',
            'extraMemberWritesPaused', 'automationWritesPaused',
          ]),
        }, ['workspaceId', 'mode', 'trial', 'seats', 'prices', 'subscription', 'free']),
        Team: configurationRecord({
          id: teamReference, name: {type: 'string', minLength: 1, maxLength: 80},
          key: {type: 'string', pattern: '^[A-Z][A-Z0-9]{0,9}$'}, color: configurationColor,
          description: {type: 'string', maxLength: 500}, createdByUserId: stringId, archivedAt: {type: 'null'},
        }),
        TeamMembership: configurationRecord({
          id: {type: 'string', pattern: '^team_member_[a-f0-9]{32}$'}, teamId: teamReference, userId: stringId,
          role: {type: 'string', enum: ['owner', 'member']}, status: {type: 'string', enum: ['active', 'left']},
        }),
        WorkflowStatus: configurationRecord({
          id: statusReference, teamId: teamReference, name: {type: 'string', minLength: 1, maxLength: 60},
          category: {type: 'string', enum: hostedWorkflowStatusCategories}, color: configurationColor,
          icon: {type: 'string', enum: hostedWorkflowStatusIcons}, position: {type: 'integer', minimum: 0}, isDefault: {type: 'boolean'},
        }),
        Cycle: configurationRecord({
          id: {type: 'string', pattern: '^cycle_[a-f0-9]{32}$'}, teamId: teamReference, number: {type: 'integer', minimum: 1},
          name: {type: 'string', minLength: 1, maxLength: 80}, startDate: {type: 'string', format: 'date'},
          endDate: {type: 'string', format: 'date'}, state: {type: 'string', enum: hostedCycleStates}, createdByUserId: stringId,
        }),
        SavedView: configurationRecord({
          id: {type: 'string', pattern: '^view_[a-f0-9]{32}$'}, teamId: teamReference, name: {type: 'string', minLength: 1, maxLength: 80},
          viewType: {type: 'string', enum: hostedSavedViewTypes}, predicate: {type: 'string', enum: hostedSavedViewPredicates},
          createdByUserId: stringId,
        }),
        WorkspaceExportData: exact({
          schemaVersion: {const: 'basiclinear.workspace-export.v1'},
          workspace: {$ref: '#/components/schemas/Workspace'},
          memberships: {type: 'array', items: exact({
            id: stringId, userId: stringId, role: {type: 'string', enum: ['owner', 'member']},
            status: {type: 'string', enum: ['active', 'removed']},
            createdAt: timestamp, updatedAt: {type: ['string', 'null'], format: 'date-time'},
            removedAt: {type: ['string', 'null'], format: 'date-time'}, revision,
          }, ['id', 'userId', 'role', 'status', 'createdAt', 'updatedAt', 'removedAt', 'revision'])},
          invitations: {type: 'array', items: {$ref: '#/components/schemas/Invitation'}},
          projects: {type: 'array', items: {$ref: '#/components/schemas/Project'}},
          milestones: {type: 'array', items: {$ref: '#/components/schemas/Milestone'}},
          issues: {type: 'array', items: {$ref: '#/components/schemas/Issue'}},
          comments: {type: 'array', items: {$ref: '#/components/schemas/Comment'}},
          teams: {type: 'array', items: {$ref: '#/components/schemas/Team'}},
          teamMemberships: {type: 'array', items: {$ref: '#/components/schemas/TeamMembership'}},
          workflowStatuses: {type: 'array', items: {$ref: '#/components/schemas/WorkflowStatus'}},
          cycles: {type: 'array', items: {$ref: '#/components/schemas/Cycle'}},
          savedViews: {type: 'array', items: {$ref: '#/components/schemas/SavedView'}},
        }, [
          'schemaVersion', 'workspace', 'memberships', 'invitations', 'projects',
          'milestones', 'issues', 'comments',
          'teams', 'teamMemberships', 'workflowStatuses', 'cycles', 'savedViews',
        ]),
        ProjectPageEnvelope: pageEnvelope({$ref: '#/components/schemas/Project'}),
        MilestonePageEnvelope: pageEnvelope({$ref: '#/components/schemas/Milestone'}),
        IssuePageEnvelope: pageEnvelope({$ref: '#/components/schemas/Issue'}),
        CommentPageEnvelope: pageEnvelope({$ref: '#/components/schemas/Comment'}),
        MemberPageEnvelope: pageEnvelope({$ref: '#/components/schemas/Member'}),
        InvitationPageEnvelope: pageEnvelope({$ref: '#/components/schemas/Invitation'}),
        WorkspaceEnvelope: exact({data: exact({workspace: {$ref: '#/components/schemas/Workspace'}}, ['workspace'])}, ['data']),
        ProjectEnvelope: exact({data: exact({project: {$ref: '#/components/schemas/Project'}}, ['project'])}, ['data']),
        MilestoneEnvelope: exact({data: exact({milestone: {$ref: '#/components/schemas/Milestone'}}, ['milestone'])}, ['data']),
        IssueEnvelope: exact({data: exact({issue: {$ref: '#/components/schemas/Issue'}}, ['issue'])}, ['data']),
        CommentEnvelope: exact({data: exact({comment: {$ref: '#/components/schemas/Comment'}}, ['comment'])}, ['data']),
        MemberRemovalEnvelope: exact({data: exact({
          changed: {type: 'boolean'}, userId: stringId, activeSeats: {type: 'integer', minimum: 1},
        }, ['changed', 'userId', 'activeSeats'])}, ['data']),
        InvitationMutationEnvelope: exact({data: exact({
          changed: {type: 'boolean'},
          invitation: {$ref: '#/components/schemas/Invitation'},
          inviteUrl: {type: ['string', 'null']},
        }, ['changed', 'invitation', 'inviteUrl'])}, ['data']),
        BillingEnvelope: exact({data: exact({
          billing: {$ref: '#/components/schemas/Billing'},
        }, ['billing'])}, ['data']),
        ExportEnvelope: exact({data: exact({
          mediaType: {const: 'application/vnd.basiclinear.workspace-export+json;version=1'},
          workspaceId: workspaceReference, sha256: {type: 'string', pattern: '^[a-f0-9]{64}$'},
          data: {$ref: '#/components/schemas/WorkspaceExportData'},
        }, ['mediaType', 'workspaceId', 'sha256', 'data'])}, ['data']),
      },
      responses: {
        BadRequest: {description: 'Invalid request', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        Unauthorized: {description: 'Invalid or unavailable token', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        PaymentRequired: {description: 'A Pro entitlement is required', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        Forbidden: {description: 'Workspace, role, or scope denied', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        NotFound: {description: 'Resource not found', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        Conflict: {description: 'Revision or idempotency conflict', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        Gone: {description: 'Resource is no longer actionable', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        TooLarge: {description: 'Request body is too large', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        MethodNotAllowed: {description: 'The route does not support this method', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        PreconditionRequired: {description: 'Current revision precondition is required', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
        Unavailable: {description: 'Temporarily unavailable', content: {'application/json': {schema: {$ref: '#/components/schemas/ErrorEnvelope'}}}},
      },
    },
    'x-basiclinear-personal-token-scopes': personalTokenScopes,
    'x-basiclinear-exclusions': [
      'autonomous execution', 'source-code review', 'repository data', 'pull-request data',
    ],
  };
}

export function createRestApiHandler(options: RestApiHandlerOptions): RestApiHandler {
  const codec = new CursorCodec(options.cursorSecret);
  const openApi = basicLinearOpenApiDocument();
  return async (request, response, correlationId, url): Promise<boolean> => {
    if (url.pathname === '/api/v1/openapi.json') {
      try {
        exactQuery(url, []);
        if (request.method !== 'GET') writeMethodNotAllowed(response, correlationId, 'GET');
        else writeJson(response, 200, openApi, correlationId);
      } catch (error) {
        writeError(response, error, correlationId);
      }
      return true;
    }
    if (!url.pathname.startsWith('/api/v1/workspaces/')) return false;
    try {
      const mutationContract = restMutationContract(url.pathname, request.method);
      if (mutationContract !== null) await preflightRestMutation(request, mutationContract);
      const exportMatch = exportPath.exec(url.pathname);
      if (exportMatch !== null) {
        exactQuery(url, []);
        await handleExport(request, response, options, exportMatch[1] as string, correlationId);
        return true;
      }
      const billingMatch = billingPath.exec(url.pathname);
      if (billingMatch !== null) {
        exactQuery(url, []);
        await handleBilling(request, response, options, billingMatch[1] as string, correlationId);
        return true;
      }
      const invitationActionMatch = invitationActionPath.exec(url.pathname);
      if (invitationActionMatch !== null) {
        exactQuery(url, []);
        await handleInvitationAction(
          request,
          response,
          options,
          invitationActionMatch[1] as string,
          invitationActionMatch[2] as string,
          invitationActionMatch[3] as 'resend' | 'revoke',
          correlationId,
        );
        return true;
      }
      const invitationsMatch = invitationsPath.exec(url.pathname);
      if (invitationsMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleInvitations(
          request, response, options, codec, url, invitationsMatch[1] as string, correlationId,
        );
        return true;
      }
      const memberMatch = memberPath.exec(url.pathname);
      if (memberMatch !== null) {
        exactQuery(url, []);
        await handleMember(
          request, response, options, memberMatch[1] as string, memberMatch[2] as string, correlationId,
        );
        return true;
      }
      const membersMatch = membersPath.exec(url.pathname);
      if (membersMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleMembers(request, response, options, codec, url, membersMatch[1] as string, correlationId);
        return true;
      }
      const commentMatch = commentPath.exec(url.pathname);
      if (commentMatch !== null) {
        exactQuery(url, []);
        await handleComment(
          request,
          response,
          options,
          commentMatch[1] as string,
          commentMatch[2] as string,
          commentMatch[3] as string,
          correlationId,
        );
        return true;
      }
      const commentsMatch = commentsPath.exec(url.pathname);
      if (commentsMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleComments(
          request,
          response,
          options,
          codec,
          url,
          commentsMatch[1] as string,
          commentsMatch[2] as string,
          correlationId,
        );
        return true;
      }
      const issueAssigneeMatch = issueAssigneePath.exec(url.pathname);
      if (issueAssigneeMatch !== null) {
        exactQuery(url, []);
        await handleIssueAssignee(
          request, response, options, issueAssigneeMatch[1] as string,
          issueAssigneeMatch[2] as string, correlationId,
        );
        return true;
      }
      const issueMatch = issuePath.exec(url.pathname);
      if (issueMatch !== null) {
        exactQuery(url, []);
        await handleIssue(
          request, response, options, issueMatch[1] as string, issueMatch[2] as string, correlationId,
        );
        return true;
      }
      const issuesMatch = issuesPath.exec(url.pathname);
      if (issuesMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleIssues(request, response, options, codec, url, issuesMatch[1] as string, correlationId);
        return true;
      }
      const projectMilestonesMatch = projectMilestonesPath.exec(url.pathname);
      if (projectMilestonesMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleProjectMilestones(
          request,
          response,
          options,
          codec,
          url,
          projectMilestonesMatch[1] as string,
          projectMilestonesMatch[2] as string,
          correlationId,
        );
        return true;
      }
      const milestoneMatch = milestonePath.exec(url.pathname);
      if (milestoneMatch !== null) {
        exactQuery(url, []);
        await handleMilestone(
          request, response, options, milestoneMatch[1] as string,
          milestoneMatch[2] as string, correlationId,
        );
        return true;
      }
      const projectMatch = projectPath.exec(url.pathname);
      if (projectMatch !== null) {
        exactQuery(url, []);
        await handleProject(
          request, response, options, projectMatch[1] as string,
          projectMatch[2] as string, correlationId,
        );
        return true;
      }
      const projectsMatch = projectsPath.exec(url.pathname);
      if (projectsMatch !== null) {
        exactQuery(url, request.method === 'GET' ? ['cursor', 'limit'] : []);
        await handleProjects(request, response, options, codec, url, projectsMatch[1] as string, correlationId);
        return true;
      }
      const workspaceMatch = workspacePath.exec(url.pathname);
      if (workspaceMatch !== null) {
        exactQuery(url, []);
        await handleWorkspace(request, response, options, workspaceMatch[1] as string, correlationId);
        return true;
      }
      writeJson(response, 404, errorEnvelope('NOT_FOUND', 'Route not found.', correlationId), correlationId);
      return true;
    } catch (error) {
      writeError(response, error, correlationId);
      return true;
    }
  };
}
