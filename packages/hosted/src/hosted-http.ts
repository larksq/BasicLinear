import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadinessProbe } from './readiness.js';
import {
  OwnerBootstrapInputError,
  type OwnerBootstrapResult,
  type OwnerBootstrapService,
  type VerifiedGoogleIdentity,
} from './owner-bootstrap.js';
import {
  InvitationServiceError,
  type InvitationAcceptanceResult,
  type InvitationMutationResult,
  type InvitationOwnerView,
  type InvitationPreview,
  type InvitationService,
} from './invitation-service.js';
import {
  actionsForWorkspaceRole,
  WorkspaceAuthorizationError,
  type WorkspaceAuthorizationService,
} from './workspace-authorization.js';
import {
  WorkspaceDirectoryServiceError,
  type WorkspaceDirectoryService,
} from './workspace-directory-service.js';
import {
  CollaborationServiceError,
  type CollaborationService,
  type CollaborationIssuePriority,
  type CollaborationIssueResource,
  type CollaborationIssueStatus,
} from './collaboration-service.js';
import {
  IssueObservationServiceError,
  type IssueObservationService,
} from './issue-observation-service.js';
import {
  BillingServiceError,
  type BillingService,
  type VerifiedBillingNotice,
} from './billing-service.js';
import {
  PersonalTokenServiceError,
  type PersonalTokenService,
} from './personal-token-service.js';
import {
  ProjectManagementServiceError,
  workspaceExportMediaType,
  type HostedProjectStatus,
  type ProjectManagementService,
} from './project-management-service.js';
import {
  WorkspaceConfigurationServiceError,
  type HostedSavedViewPredicate,
  type HostedSavedViewType,
  type HostedWorkflowStatusCategory,
  type HostedWorkflowStatusIcon,
  type WorkspaceConfigurationService,
} from './workspace-configuration-service.js';
import type { RestApiHandler } from './rest-api.js';
import type { McpHttpHandler } from './mcp-server.js';
import {
  hostedOperationsPolicyV1,
  HostedOperationsControlError,
  type HostedOperationsAdmission,
  type HostedOperationsControl,
} from './operations-control.js';
import {
  HostedOperationsServiceError,
  type HostedBudgetNoticeInput,
  type HostedOperationsService,
} from './operations-service.js';

export interface GoogleIdentityVerifier {
  verifyGoogleIdToken(token: string): Promise<VerifiedGoogleIdentity>;
}

export interface HostedHttpHandlerOptions {
  /** Read-only dependency access check. Omission makes readiness fail closed. */
  readinessCheck?: () => Promise<void>;
  identityVerifier: GoogleIdentityVerifier;
  bootstrapService: OwnerBootstrapService;
  workspaceAuthorizationService: WorkspaceAuthorizationService;
  workspaceDirectoryService?: WorkspaceDirectoryService;
  invitationService: InvitationService;
  collaborationService?: CollaborationService;
  issueObservationService?: IssueObservationService;
  billingService?: BillingService;
  billingWebhookProvider?: VerifiedBillingNotice['provider'];
  billingWebhookVerifier?: {
    verifyWebhook(rawBody: Buffer, signature: string): VerifiedBillingNotice | null;
  };
  personalTokenService?: PersonalTokenService;
  projectManagementService?: ProjectManagementService;
  workspaceConfigurationService?: WorkspaceConfigurationService;
  restApiHandler?: RestApiHandler;
  mcpHttpHandler?: McpHttpHandler;
  allowedOrigins?: readonly string[];
  operationsControl: HostedOperationsControl;
  operationsService: HostedOperationsService;
  budgetNoticeVerifier: {
    verifyPubSubToken(token: string): Promise<void>;
  };
}

export class HostedAuthenticationError extends Error {
  readonly code = 'AUTHENTICATION_REQUIRED';

  constructor() {
    super('A verified Google session is required.');
    this.name = 'HostedAuthenticationError';
  }
}

interface ErrorBody {
  error: {code: string; message: string; correlationId: string};
}

class HostedRequestError extends Error {
  readonly code: 'INVALID_REQUEST' | 'REQUEST_TOO_LARGE';
  readonly status: 400 | 413;

  constructor(code: HostedRequestError['code'], status: HostedRequestError['status'], message: string) {
    super(message);
    this.name = 'HostedRequestError';
    this.code = code;
    this.status = status;
  }
}

const headerValue = (value: string | string[] | undefined): string | null => {
  if (Array.isArray(value)) return value.length === 1 ? value[0] ?? null : null;
  return value ?? null;
};

const writeJson = (
  response: ServerResponse,
  status: number,
  body: unknown,
  correlationId: string,
  extraHeaders: Record<string, string> = {},
): void => {
  response.statusCode = status;
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-basiclinear-request-id': correlationId,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
};

function requestHeaderValues(request: IncomingMessage, name: string): string[] {
  const lower = name.toLowerCase();
  const raw = request.rawHeaders;
  if (Array.isArray(raw) && raw.length > 0) {
    const values: string[] = [];
    for (let index = 0; index < raw.length; index += 2) {
      if ((raw[index] ?? '').toLowerCase() === lower) values.push(raw[index + 1] ?? '');
    }
    return values;
  }
  const value = request.headers[lower];
  if (Array.isArray(value)) return [...value];
  return value === undefined ? [] : [value];
}

function strictUtf8(value: Buffer): string | null {
  const text = value.toString('utf8');
  return Buffer.from(text, 'utf8').equals(value) ? text : null;
}

function hasDuplicateJsonKey(text: string): boolean {
  const stack: Array<Set<string> | null> = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '{') {
      stack.push(new Set<string>());
      continue;
    }
    if (character === '[') {
      stack.push(null);
      continue;
    }
    if (character === '}' || character === ']') {
      stack.pop();
      continue;
    }
    if (character !== '"') continue;
    const start = index;
    for (index += 1; index < text.length; index += 1) {
      if (text[index] === '\\') {
        index += 1;
        continue;
      }
      if (text[index] === '"') break;
    }
    let cursor = index + 1;
    while (/\s/u.test(text[cursor] ?? '')) cursor += 1;
    const current = stack.at(-1);
    if (text[cursor] !== ':' || current === null || current === undefined) continue;
    const key = JSON.parse(text.slice(start, index + 1)) as string;
    if (current.has(key)) return true;
    current.add(key);
  }
  return false;
}

function exactBase64(value: string): Buffer | null {
  if (value.length === 0
    || value.length > hostedOperationsPolicyV1.queries.maximumBudgetNoticeBytes
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded : null;
}

function canonicalProviderTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

async function readBudgetPushJson(request: IncomingMessage): Promise<unknown> {
  const contentTypes = requestHeaderValues(request, 'content-type');
  const lengths = requestHeaderValues(request, 'content-length');
  if (contentTypes.length !== 1
    || !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentTypes[0] as string)
    || lengths.length > 1
    || (lengths.length === 1 && !/^(?:0|[1-9][0-9]*)$/u.test(lengths[0] as string))) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const declared = lengths.length === 1 ? Number(lengths[0]) : null;
  if (declared !== null && (!Number.isSafeInteger(declared)
    || declared > hostedOperationsPolicyV1.queries.maximumBudgetNoticeBytes)) {
    throw new HostedRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
  }
  const body = await readRawBody(
    request,
    hostedOperationsPolicyV1.queries.maximumBudgetNoticeBytes,
  );
  if (body.byteLength === 0 || (declared !== null && declared !== body.byteLength)) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const text = strictUtf8(body);
  if (text === null) throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  try {
    const value = JSON.parse(text) as unknown;
    if (hasDuplicateJsonKey(text)) throw new Error('duplicate key');
    return value;
  } catch {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
}

function budgetPushBearer(request: IncomingMessage): string {
  const values = requestHeaderValues(request, 'authorization');
  if (values.length !== 1 || !(values[0] as string).startsWith('Bearer ')) {
    throw new HostedAuthenticationError();
  }
  const token = (values[0] as string).slice('Bearer '.length).trim();
  if (token.length < 64 || token.length > 8_192 || /\s/u.test(token)) {
    throw new HostedAuthenticationError();
  }
  return token;
}

function parseBudgetPushEnvelope(value: unknown): HostedBudgetNoticeInput {
  const envelope = allowedObject(value, ['deliveryAttempt', 'message', 'subscription'], ['message', 'subscription']);
  if (typeof envelope.subscription !== 'string'
    || (envelope.deliveryAttempt !== undefined
      && (!Number.isSafeInteger(envelope.deliveryAttempt) || (envelope.deliveryAttempt as number) < 1))) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const message = allowedObject(
    envelope.message,
    ['attributes', 'data', 'messageId', 'message_id', 'orderingKey', 'publishTime', 'publish_time'],
    ['attributes', 'data'],
  );
  const messageId = typeof message.messageId === 'string' ? message.messageId
    : typeof message.message_id === 'string' ? message.message_id : null;
  const publishTimeRaw = typeof message.publishTime === 'string' ? message.publishTime
    : typeof message.publish_time === 'string' ? message.publish_time : null;
  if (messageId === null || publishTimeRaw === null
    || (message.messageId !== undefined && message.message_id !== undefined
      && message.messageId !== message.message_id)
    || (message.publishTime !== undefined && message.publish_time !== undefined
      && message.publishTime !== message.publish_time)
    || (message.orderingKey !== undefined && typeof message.orderingKey !== 'string')
    || typeof message.data !== 'string') {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const attributes = exactObject(message.attributes, ['billingAccountId', 'budgetId', 'schemaVersion']);
  if (typeof attributes.billingAccountId !== 'string'
    || typeof attributes.budgetId !== 'string' || attributes.schemaVersion !== '1.0') {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const decoded = exactBase64(message.data);
  const publishTime = canonicalProviderTimestamp(publishTimeRaw);
  if (decoded === null || publishTime === null) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const decodedText = strictUtf8(decoded);
  if (decodedText === null || hasDuplicateJsonKey(decodedText)) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  let payload: Record<string, unknown>;
  try {
    payload = allowedObject(
      JSON.parse(decodedText) as unknown,
      [
        'alertThresholdExceeded', 'budgetAmount', 'budgetAmountType', 'budgetDisplayName',
        'costAmount', 'costIntervalStart', 'currencyCode', 'forecastThresholdExceeded',
      ],
      ['budgetAmount', 'budgetAmountType', 'budgetDisplayName', 'costAmount', 'costIntervalStart', 'currencyCode'],
    );
  } catch {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const costIntervalStart = canonicalProviderTimestamp(payload.costIntervalStart);
  if (typeof payload.budgetDisplayName !== 'string'
    || typeof payload.costAmount !== 'number' || typeof payload.budgetAmount !== 'number'
    || payload.budgetAmountType !== 'SPECIFIED_AMOUNT' || payload.currencyCode !== 'USD'
    || costIntervalStart === null
    || (payload.alertThresholdExceeded !== undefined && typeof payload.alertThresholdExceeded !== 'number')
    || (payload.forecastThresholdExceeded !== undefined && typeof payload.forecastThresholdExceeded !== 'number')) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  return {
    messageId,
    publishTime,
    subscription: envelope.subscription,
    billingAccountId: attributes.billingAccountId,
    budgetId: attributes.budgetId,
    schemaVersion: '1.0',
    budgetDisplayName: payload.budgetDisplayName,
    costAmount: payload.costAmount,
    costIntervalStart,
    budgetAmount: payload.budgetAmount,
    budgetAmountType: 'SPECIFIED_AMOUNT',
    currencyCode: 'USD',
    alertThresholdExceeded: typeof payload.alertThresholdExceeded === 'number'
      ? payload.alertThresholdExceeded : null,
    forecastThresholdExceeded: typeof payload.forecastThresholdExceeded === 'number'
      ? payload.forecastThresholdExceeded : null,
  };
}

async function handleBudgetNotice(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'POST'});
    return;
  }
  let notice: HostedBudgetNoticeInput;
  try {
    notice = parseBudgetPushEnvelope(await readBudgetPushJson(request));
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    await options.budgetNoticeVerifier.verifyPubSubToken(budgetPushBearer(request));
  } catch {
    writeJson(response, 401, errorBody('AUTHENTICATION_REQUIRED', 'A trusted provider identity is required.', correlationId), correlationId);
    return;
  }
  try {
    await options.operationsService.acceptBudgetNotice(notice);
    writeJson(response, 200, {received: true}, correlationId);
  } catch (error) {
    if (error instanceof HostedOperationsServiceError && error.code === 'INVALID_BUDGET_NOTICE') {
      writeJson(response, 400, errorBody('INVALID_BUDGET_NOTICE', 'The budget notice is invalid.', correlationId), correlationId);
      return;
    }
    writeJson(response, 503, errorBody('OPERATIONS_UNAVAILABLE', 'Hosted operations controls are temporarily unavailable.', correlationId), correlationId);
  }
}

function operationsWorkspaceId(pathname: string): string | null {
  const match = /^\/api\/v1\/(?:hosted\/)?workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})(?:\/|$)/u.exec(pathname);
  return match?.[1] ?? null;
}

function operationsTraceId(request: IncomingMessage): string | null {
  const values = requestHeaderValues(request, 'x-cloud-trace-context');
  if (values.length !== 1) return null;
  const match = /^([a-fA-F0-9]{32})(?:\/[0-9]+)?(?:;o=[01])?$/u.exec(values[0] as string);
  return match?.[1]?.toLowerCase() ?? null;
}

const errorBody = (code: string, message: string, correlationId: string): ErrorBody => ({
  error: { code, message, correlationId },
});

function bearerToken(request: IncomingMessage): string {
  const authorization = headerValue(request.headers.authorization);
  if (authorization === null || !authorization.startsWith('Bearer ')) {
    throw new HostedAuthenticationError();
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (token.length < 20 || token.length > 8_192 || /\s/.test(token)) {
    throw new HostedAuthenticationError();
  }
  return token;
}

function idempotencyKey(request: IncomingMessage): string {
  return headerValue(request.headers['idempotency-key']) ?? '';
}

async function readJsonBody(request: IncomingMessage, maximumBytes = 4_096): Promise<unknown> {
  const declaredLength = Number(headerValue(request.headers['content-length']) ?? '0');
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  if (declaredLength > maximumBytes) {
    throw new HostedRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    received += buffer.byteLength;
    if (received > maximumBytes) {
      throw new HostedRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
    }
    chunks.push(buffer);
  }
  if (received === 0) return {};
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  return body;
}

async function readRawBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const declaredLength = Number(headerValue(request.headers['content-length']) ?? '0');
  if (!Number.isFinite(declaredLength) || declaredLength < 0) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  if (declaredLength > maximumBytes) {
    throw new HostedRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    received += buffer.byteLength;
    if (received > maximumBytes) {
      throw new HostedRequestError('REQUEST_TOO_LARGE', 413, 'The request body is too large.');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function exactObject(
  body: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const candidate = body as Record<string, unknown>;
  const actual = Object.keys(candidate).sort();
  const expected = [...expectedKeys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  return candidate;
}

async function readBootstrapBody(request: IncomingMessage): Promise<void> {
  exactObject(await readJsonBody(request, 1_024), []);
}

function requestOriginAllowed(
  request: IncomingMessage,
  configuredOrigins: ReadonlySet<string>,
): boolean {
  if (request.headers.origin === undefined) return true;
  const origin = headerValue(request.headers.origin);
  if (origin === null) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return origin === parsed.origin && configuredOrigins.has(origin);
}

const publicResult = (result: OwnerBootstrapResult) => ({
  created: result.created,
  user: {
    id: result.record.uid,
    email: result.record.email,
    displayName: result.record.displayName,
    provider: 'google.com' as const,
  },
  workspace: {
    id: result.record.workspaceId,
    name: result.record.workspaceName,
    authority: 'firebase-hosted' as const,
  },
  membership: {
    id: result.record.membershipId,
    role: result.record.role,
    status: 'active' as const,
  },
  trial: {
    id: result.record.trialId,
    plan: result.record.trialPlan,
    status: result.record.trialStatus,
    startedAt: result.record.trialStartedAt,
    endsAt: result.record.trialEndsAt,
    durationDays: 30 as const,
  },
});

const workspaceAccessPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/access$/u;
const userWorkspacesPath = '/api/v1/hosted/workspaces';
const workspaceInvitationsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/invitations$/u;
const workspaceInvitationActionPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/invitations\/(invite_[a-f0-9]{32})\/(resend|revoke)$/u;
const workspaceMembersPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/members$/u;
const workspaceMemberPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/members\/([^/]{3,384})$/u;
const workspaceIssuesPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues$/u;
const workspaceIssuePath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})$/u;
const workspaceIssueAssignmentPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/assignee$/u;
const workspaceIssueActivityPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/activity$/u;
const workspaceIssueSubscriptionPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/subscription$/u;
const workspaceIssueNotificationsReadPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/notifications\/read$/u;
const workspaceNotificationsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/notifications$/u;
const workspaceIssueCommentsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/comments$/u;
const workspaceIssueCommentPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/issues\/(issue_[a-f0-9]{32})\/comments\/(comment_[a-f0-9]{32})$/u;
const workspaceProjectsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects$/u;
const workspaceProjectPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects\/(project_[a-f0-9]{32})$/u;
const workspaceProjectMilestonesPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/projects\/(project_[a-f0-9]{32})\/milestones$/u;
const workspaceMilestonePath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/milestones\/(milestone_[a-f0-9]{32})$/u;
const workspaceBillingPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/billing$/u;
const workspaceBillingCheckoutPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/billing\/checkout$/u;
const workspaceTokensPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/tokens$/u;
const workspaceTokenPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/tokens\/(pat_[a-f0-9]{32})$/u;
const workspaceExportPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/export$/u;
const workspaceConfigurationBootstrapPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/configuration\/bootstrap$/u;
const workspaceTeamsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/teams$/u;
const workspaceTeamMembersPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/teams\/(team_[a-f0-9]{32})\/members$/u;
const workspaceTeamPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/teams\/(team_[a-f0-9]{32})$/u;
const workspaceStatusesPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/workflow-statuses$/u;
const workspaceStatusPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/workflow-statuses\/(status_[a-f0-9]{32})$/u;
const workspaceSavedViewsPath = /^\/api\/v1\/hosted\/workspaces\/([A-Za-z0-9][A-Za-z0-9._+-]{2,127})\/saved-views$/u;

const publicInvitation = (invitation: InvitationOwnerView) => ({ ...invitation });

const invitationUrl = (token: string | null): string | null => token === null
  ? null
  : `/hosted.html#invite=${encodeURIComponent(token)}`;

const publicInvitationMutation = (result: InvitationMutationResult) => ({
  changed: result.changed,
  invitation: publicInvitation(result.invitation),
  inviteUrl: invitationUrl(result.shareToken),
});

const publicInvitationPreview = (preview: InvitationPreview) => ({ ...preview });

const publicInvitationAcceptance = (result: InvitationAcceptanceResult) => ({ ...result });

function decodedMemberReference(value: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  return decoded.length >= 3 && decoded.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9:._@+-]*$/u.test(decoded)
    ? decoded
    : null;
}

function writeRequestError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  const requestError = error instanceof HostedRequestError
    ? error
    : new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  writeJson(
    response,
    requestError.status,
    errorBody(requestError.code, requestError.message, correlationId),
    correlationId,
  );
}

function writeIssueObservationError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    writeJson(
      response,
      error.code === 'WORKSPACE_ACCESS_DENIED' ? 403 : 503,
      errorBody(
        error.code,
        error.code === 'WORKSPACE_ACCESS_DENIED'
          ? 'The requested workspace resource is unavailable.'
          : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  const issueError = error instanceof IssueObservationServiceError ? error : null;
  const status = issueError?.code === 'INVALID_OBSERVATION_REQUEST'
    || issueError?.code === 'INVALID_IDEMPOTENCY_KEY' ? 400
    : issueError?.code === 'OBSERVATION_CONFLICT' ? 409
      : issueError?.code === 'OBSERVATION_NOT_FOUND' ? 404 : 503;
  writeJson(
    response,
    status,
    errorBody(
      issueError?.code ?? 'OBSERVATION_SERVICE_UNAVAILABLE',
      issueError?.message ?? 'Issue observation is temporarily unavailable.',
      correlationId,
    ),
    correlationId,
  );
}

function writeInvitationServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    if (error.code === 'WORKSPACE_ACCESS_DENIED') {
      writeJson(
        response,
        403,
        errorBody(
          'WORKSPACE_ACCESS_DENIED',
          'The requested workspace resource is unavailable.',
          correlationId,
        ),
        correlationId,
      );
      return;
    }
    writeJson(
      response,
      503,
      errorBody(
        'AUTHORIZATION_UNAVAILABLE',
        'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof InvitationServiceError) {
    const statusByCode: Record<InvitationServiceError['code'], number> = {
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
    writeJson(
      response,
      statusByCode[error.code],
      errorBody(error.code, error.message, correlationId),
      correlationId,
    );
    return;
  }
  writeJson(
    response,
    503,
    errorBody(
      'INVITATION_SERVICE_UNAVAILABLE',
      'Invitation service is temporarily unavailable.',
      correlationId,
    ),
    correlationId,
  );
}

function writeCollaborationServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorBody(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'AUTHORIZATION_UNAVAILABLE',
        denied
          ? 'The requested workspace resource is unavailable.'
          : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof CollaborationServiceError) {
    const statusByCode: Record<CollaborationServiceError['code'], number> = {
      INVALID_COLLABORATION_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      COLLABORATION_NOT_FOUND: 404,
      COLLABORATION_CONFLICT: 409,
      COLLABORATION_FORBIDDEN: 403,
      COLLABORATION_ENTITLEMENT_REQUIRED: 402,
      ASSIGNEE_UNAVAILABLE: 409,
      COLLABORATION_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, statusByCode[error.code], errorBody(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(
    response,
    503,
    errorBody('COLLABORATION_SERVICE_UNAVAILABLE', 'Collaboration is temporarily unavailable.', correlationId),
    correlationId,
  );
}

function writeBillingServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorBody(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'AUTHORIZATION_UNAVAILABLE',
        denied ? 'The requested workspace resource is unavailable.' : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof BillingServiceError) {
    const statusByCode: Record<BillingServiceError['code'], number> = {
      INVALID_BILLING_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      BILLING_CONFLICT: 409,
      BILLING_FORBIDDEN: 403,
      BILLING_UNAVAILABLE: 503,
    };
    writeJson(response, statusByCode[error.code], errorBody(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(response, 503, errorBody('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.', correlationId), correlationId);
}

function writePersonalTokenServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorBody(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'AUTHORIZATION_UNAVAILABLE',
        denied ? 'The requested workspace resource is unavailable.' : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof PersonalTokenServiceError) {
    const statusByCode: Record<PersonalTokenServiceError['code'], number> = {
      INVALID_TOKEN_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      TOKEN_NOT_FOUND: 404,
      TOKEN_CONFLICT: 409,
      TOKEN_AUTHENTICATION_FAILED: 401,
      TOKEN_SCOPE_DENIED: 403,
      TOKEN_ENTITLEMENT_REQUIRED: 402,
      TOKEN_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, statusByCode[error.code], errorBody(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(
    response,
    503,
    errorBody('TOKEN_SERVICE_UNAVAILABLE', 'Personal tokens are temporarily unavailable.', correlationId),
    correlationId,
  );
}

function writeProjectManagementServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorBody(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'AUTHORIZATION_UNAVAILABLE',
        denied ? 'The requested workspace resource is unavailable.' : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof ProjectManagementServiceError) {
    const statusByCode: Record<ProjectManagementServiceError['code'], number> = {
      INVALID_PM_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      PM_NOT_FOUND: 404,
      PM_CONFLICT: 409,
      PM_FORBIDDEN: 403,
      PM_ENTITLEMENT_REQUIRED: 402,
      PM_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, statusByCode[error.code], errorBody(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(
    response,
    503,
    errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId),
    correlationId,
  );
}

function writeWorkspaceConfigurationServiceError(
  response: ServerResponse,
  error: unknown,
  correlationId: string,
): void {
  if (error instanceof WorkspaceAuthorizationError) {
    const denied = error.code === 'WORKSPACE_ACCESS_DENIED';
    writeJson(
      response,
      denied ? 403 : 503,
      errorBody(
        denied ? 'WORKSPACE_ACCESS_DENIED' : 'AUTHORIZATION_UNAVAILABLE',
        denied ? 'The requested workspace resource is unavailable.' : 'Workspace authorization is temporarily unavailable.',
        correlationId,
      ),
      correlationId,
    );
    return;
  }
  if (error instanceof WorkspaceConfigurationServiceError) {
    const statusByCode: Record<WorkspaceConfigurationServiceError['code'], number> = {
      INVALID_CONFIGURATION_REQUEST: 400,
      INVALID_IDEMPOTENCY_KEY: 400,
      CONFIGURATION_NOT_FOUND: 404,
      CONFIGURATION_CONFLICT: 409,
      CONFIGURATION_FORBIDDEN: 403,
      CONFIGURATION_ENTITLEMENT_REQUIRED: 402,
      CONFIGURATION_SERVICE_UNAVAILABLE: 503,
    };
    writeJson(response, statusByCode[error.code], errorBody(error.code, error.message, correlationId), correlationId);
    return;
  }
  writeJson(
    response,
    503,
    errorBody('CONFIGURATION_SERVICE_UNAVAILABLE', 'Workspace configuration is temporarily unavailable.', correlationId),
    correlationId,
  );
}

function allowedObject(
  body: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  const candidate = body as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (keys.some((key) => !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(candidate, key))) {
    throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
  }
  return candidate;
}

async function collaborationIdentity(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<VerifiedGoogleIdentity | null> {
  try {
    return await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return null;
  }
}

function unavailableCollaboration(
  response: ServerResponse,
  correlationId: string,
): boolean {
  writeJson(
    response,
    503,
    errorBody('COLLABORATION_SERVICE_UNAVAILABLE', 'Collaboration is temporarily unavailable.', correlationId),
    correlationId,
  );
  return true;
}

async function handleWorkspaceMembers(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'GET' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const members = await options.collaborationService.listMembers({
      principal: { kind: 'user', userId: identity.uid, source: 'web' }, workspaceId,
      requestId: correlationId,
    });
    writeJson(response, 200, { data: { members } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceMember(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  userId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'DELETE') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'DELETE'});
    return;
  }
  if (options.billingService === undefined) {
    writeJson(response, 503, errorBody('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  try {
    exactObject(await readJsonBody(request, 512), []);
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const result = await options.billingService.removeMember({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      userId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    });
    writeJson(response, 200, {data: result}, correlationId);
  } catch (error) {
    writeBillingServiceError(response, error, correlationId);
  }
}

async function configurationIdentity(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
) {
  return collaborationIdentity(request, response, options, correlationId);
}

async function handleWorkspaceConfigurationBootstrap(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'POST'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  try {
    exactObject(await readJsonBody(request, 512), []);
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const result = await options.workspaceConfigurationService.ensureDefaults({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    });
    writeJson(response, 200, {data: result}, correlationId);
  } catch (error) {
    writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceTeams(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const teams = await options.workspaceConfigurationService.listTeams({principal, workspaceId, requestId: correlationId});
      writeJson(response, 200, {data: {teams}}, correlationId);
    } catch (error) {
      writeWorkspaceConfigurationServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(await readJsonBody(request, 4_096), ['name', 'key', 'color', 'description'], ['name', 'key']);
    if (typeof body.name !== 'string' || typeof body.key !== 'string'
      || (body.color !== undefined && typeof body.color !== 'string')
      || (body.description !== undefined && typeof body.description !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const result = await options.workspaceConfigurationService.createTeam({
      principal, workspaceId, requestId: correlationId, idempotencyKey: idempotencyKey(request),
      name: body.name, key: body.key,
      ...(typeof body.color === 'string' ? {color: body.color} : {}),
      ...(typeof body.description === 'string' ? {description: body.description} : {}),
    });
    writeJson(response, 201, {data: result}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceTeam(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  teamId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PATCH') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'PATCH'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const body = allowedObject(await readJsonBody(request, 4_096), ['expectedRevision', 'name', 'key', 'color', 'description'], ['expectedRevision']);
    const patchKeys = Object.keys(body).filter((key) => key !== 'expectedRevision');
    if (typeof body.expectedRevision !== 'number' || patchKeys.length === 0
      || (body.name !== undefined && typeof body.name !== 'string')
      || (body.key !== undefined && typeof body.key !== 'string')
      || (body.color !== undefined && typeof body.color !== 'string')
      || (body.description !== undefined && typeof body.description !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const patch: {name?: string; key?: string; color?: string; description?: string} = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.key === 'string') patch.key = body.key;
    if (typeof body.color === 'string') patch.color = body.color;
    if (typeof body.description === 'string') patch.description = body.description;
    const team = await options.workspaceConfigurationService.updateTeam({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId, teamId, requestId: correlationId, idempotencyKey: idempotencyKey(request),
      expectedRevision: body.expectedRevision, patch,
    });
    writeJson(response, 200, {data: {team}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceTeamMembers(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  teamId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'DELETE') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST, DELETE'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  try {
    if (request.method !== 'GET') exactObject(await readJsonBody(request, 512), []);
    if (request.method === 'POST') {
      const membership = await options.workspaceConfigurationService.joinTeam({
        principal,
        workspaceId,
        teamId,
        requestId: correlationId,
        idempotencyKey: idempotencyKey(request),
      });
      writeJson(response, 200, {data: {membership}}, correlationId);
      return;
    }
    if (request.method === 'DELETE') {
      const membership = await options.workspaceConfigurationService.leaveTeam({
        principal,
        workspaceId,
        teamId,
        requestId: correlationId,
        idempotencyKey: idempotencyKey(request),
      });
      writeJson(response, 200, {data: {membership}}, correlationId);
      return;
    }
    const memberships = await options.workspaceConfigurationService.listTeamMemberships({
      principal,
      workspaceId,
      teamId,
      requestId: correlationId,
    });
    writeJson(response, 200, {data: {memberships}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceStatuses(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const statuses = await options.workspaceConfigurationService.listStatuses({principal, workspaceId, requestId: correlationId});
      writeJson(response, 200, {data: {statuses}}, correlationId);
    } catch (error) {
      writeWorkspaceConfigurationServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(await readJsonBody(request, 4_096), ['teamId', 'name', 'category', 'color', 'icon', 'position'], ['teamId', 'name', 'category', 'color']);
    if (typeof body.teamId !== 'string' || typeof body.name !== 'string'
      || typeof body.category !== 'string' || typeof body.color !== 'string'
      || (body.icon !== undefined && typeof body.icon !== 'string')
      || (body.position !== undefined && typeof body.position !== 'number')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const status = await options.workspaceConfigurationService.createStatus({
      principal, workspaceId, requestId: correlationId, idempotencyKey: idempotencyKey(request),
      teamId: body.teamId, name: body.name,
      category: body.category as HostedWorkflowStatusCategory, color: body.color,
      ...(typeof body.icon === 'string' ? {icon: body.icon as HostedWorkflowStatusIcon} : {}),
      ...(typeof body.position === 'number' ? {position: body.position} : {}),
    });
    writeJson(response, 201, {data: {status}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceStatus(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  statusId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PATCH') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'PATCH'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const body = allowedObject(await readJsonBody(request, 4_096), ['expectedRevision', 'name', 'category', 'color', 'icon', 'position'], ['expectedRevision']);
    const patchKeys = Object.keys(body).filter((key) => key !== 'expectedRevision');
    if (typeof body.expectedRevision !== 'number' || patchKeys.length === 0
      || (body.name !== undefined && typeof body.name !== 'string')
      || (body.category !== undefined && typeof body.category !== 'string')
      || (body.color !== undefined && typeof body.color !== 'string')
      || (body.icon !== undefined && typeof body.icon !== 'string')
      || (body.position !== undefined && typeof body.position !== 'number')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const value: {name?: string; category?: HostedWorkflowStatusCategory; color?: string; icon?: HostedWorkflowStatusIcon; position?: number} = {};
    if (typeof body.name === 'string') value.name = body.name;
    if (typeof body.category === 'string') value.category = body.category as HostedWorkflowStatusCategory;
    if (typeof body.color === 'string') value.color = body.color;
    if (typeof body.icon === 'string') value.icon = body.icon as HostedWorkflowStatusIcon;
    if (typeof body.position === 'number') value.position = body.position;
    const status = await options.workspaceConfigurationService.updateStatus({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId, statusId, requestId: correlationId, idempotencyKey: idempotencyKey(request),
      expectedRevision: body.expectedRevision, patch: value,
    });
    writeJson(response, 200, {data: {status}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceSavedViews(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.workspaceConfigurationService === undefined) {
    writeWorkspaceConfigurationServiceError(response, null, correlationId);
    return;
  }
  const identity = await configurationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const views = await options.workspaceConfigurationService.listSavedViews({principal, workspaceId, requestId: correlationId});
      writeJson(response, 200, {data: {views}}, correlationId);
    } catch (error) {
      writeWorkspaceConfigurationServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = exactObject(await readJsonBody(request, 4_096), ['teamId', 'name', 'viewType', 'predicate']);
    if (typeof body.teamId !== 'string' || typeof body.name !== 'string'
      || typeof body.viewType !== 'string' || typeof body.predicate !== 'string') {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const view = await options.workspaceConfigurationService.createSavedView({
      principal, workspaceId, requestId: correlationId, idempotencyKey: idempotencyKey(request),
      teamId: body.teamId, name: body.name,
      viewType: body.viewType as HostedSavedViewType,
      predicate: body.predicate as HostedSavedViewPredicate,
    });
    writeJson(response, 201, {data: {view}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeWorkspaceConfigurationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceProjects(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.projectManagementService === undefined) {
    writeJson(response, 503, errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const projects = await options.projectManagementService.listProjects({
        principal, workspaceId, requestId: correlationId,
      });
      writeJson(response, 200, {data: {projects}}, correlationId);
    } catch (error) {
      writeProjectManagementServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(
      await readJsonBody(request, 4_096),
      ['name', 'summary', 'status'],
      ['name'],
    );
    if (typeof body.name !== 'string'
      || (body.summary !== undefined && typeof body.summary !== 'string')
      || (body.status !== undefined && typeof body.status !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const project = await options.projectManagementService.createProject({
      principal,
      workspaceId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      name: body.name,
      ...(body.summary === undefined ? {} : {summary: body.summary}),
      ...(body.status === undefined ? {} : {status: body.status as HostedProjectStatus}),
    });
    writeJson(response, 201, {data: {project}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeProjectManagementServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceProject(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  projectId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, PATCH'});
    return;
  }
  if (options.projectManagementService === undefined) {
    writeJson(response, 503, errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const project = await options.projectManagementService.getProject({
        principal, workspaceId, projectId, requestId: correlationId,
      });
      writeJson(response, 200, {data: {project}}, correlationId);
    } catch (error) {
      writeProjectManagementServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(
      await readJsonBody(request, 4_096),
      ['expectedRevision', 'name', 'summary', 'status'],
      ['expectedRevision'],
    );
    const patchKeys = Object.keys(body).filter((key) => key !== 'expectedRevision');
    if (typeof body.expectedRevision !== 'number' || patchKeys.length === 0
      || (body.name !== undefined && typeof body.name !== 'string')
      || (body.summary !== undefined && typeof body.summary !== 'string')
      || (body.status !== undefined && typeof body.status !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const patch: {name?: string; summary?: string; status?: HostedProjectStatus} = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.summary === 'string') patch.summary = body.summary;
    if (typeof body.status === 'string') patch.status = body.status as HostedProjectStatus;
    const project = await options.projectManagementService.updateProject({
      principal,
      workspaceId,
      projectId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      expectedRevision: body.expectedRevision,
      patch,
    });
    writeJson(response, 200, {data: {project}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeProjectManagementServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceProjectMilestones(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  projectId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.projectManagementService === undefined) {
    writeJson(response, 503, errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const milestones = await options.projectManagementService.listMilestones({
        principal, workspaceId, projectId, requestId: correlationId,
      });
      writeJson(response, 200, {data: {milestones}}, correlationId);
    } catch (error) {
      writeProjectManagementServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(
      await readJsonBody(request, 8_192),
      ['name', 'description', 'targetDate'],
      ['name'],
    );
    if (typeof body.name !== 'string'
      || (body.description !== undefined && typeof body.description !== 'string')
      || (body.targetDate !== undefined && body.targetDate !== null && typeof body.targetDate !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const milestone = await options.projectManagementService.createMilestone({
      principal,
      workspaceId,
      projectId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      name: body.name,
      ...(body.description === undefined ? {} : {description: body.description}),
      ...(body.targetDate === undefined ? {} : {targetDate: body.targetDate as string | null}),
    });
    writeJson(response, 201, {data: {milestone}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeProjectManagementServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceMilestone(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  milestoneId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PATCH') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, PATCH'});
    return;
  }
  if (options.projectManagementService === undefined) {
    writeJson(response, 503, errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  if (request.method === 'GET') {
    try {
      const milestone = await options.projectManagementService.getMilestone({
        principal, workspaceId, milestoneId, requestId: correlationId,
      });
      writeJson(response, 200, {data: {milestone}}, correlationId);
    } catch (error) {
      writeProjectManagementServiceError(response, error, correlationId);
    }
    return;
  }
  try {
    const body = allowedObject(
      await readJsonBody(request, 8_192),
      ['expectedRevision', 'name', 'description', 'targetDate'],
      ['expectedRevision'],
    );
    const patchKeys = Object.keys(body).filter((key) => key !== 'expectedRevision');
    if (typeof body.expectedRevision !== 'number' || patchKeys.length === 0
      || (body.name !== undefined && typeof body.name !== 'string')
      || (body.description !== undefined && typeof body.description !== 'string')
      || (body.targetDate !== undefined && body.targetDate !== null && typeof body.targetDate !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const patch: {name?: string; description?: string; targetDate?: string | null} = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.description === 'string') patch.description = body.description;
    if (body.targetDate === null || typeof body.targetDate === 'string') patch.targetDate = body.targetDate;
    const milestone = await options.projectManagementService.updateMilestone({
      principal,
      workspaceId,
      milestoneId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      expectedRevision: body.expectedRevision,
      patch,
    });
    writeJson(response, 200, {data: {milestone}}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writeProjectManagementServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssues(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'GET, POST' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = { kind: 'user' as const, userId: identity.uid, source: 'web' as const };
  if (request.method === 'GET') {
    try {
      const issues = await options.collaborationService.listIssues({ principal, workspaceId, requestId: correlationId });
      writeJson(response, 200, { data: { issues } }, correlationId);
    } catch (error) {
      writeCollaborationServiceError(response, error, correlationId);
    }
    return;
  }
  let title: string;
  let description: string | undefined;
  let teamId: string | undefined;
  let statusId: string | undefined;
  let projectId: string | null | undefined;
  let milestoneId: string | null | undefined;
  let parentIssueId: string | null | undefined;
  let resources: CollaborationIssueResource[] | undefined;
  let dueAt: string | null | undefined;
  try {
    const body = allowedObject(
      await readJsonBody(request, 32_768),
      ['title', 'description', 'teamId', 'statusId', 'projectId', 'milestoneId', 'parentIssueId', 'resources', 'dueAt'],
      ['title'],
    );
    if (typeof body.title !== 'string'
      || (body.description !== undefined && typeof body.description !== 'string')
      || (body.teamId !== undefined && typeof body.teamId !== 'string')
      || (body.statusId !== undefined && typeof body.statusId !== 'string')
      || (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string')
      || (body.milestoneId !== undefined && body.milestoneId !== null && typeof body.milestoneId !== 'string')
      || (body.parentIssueId !== undefined && body.parentIssueId !== null && typeof body.parentIssueId !== 'string')
      || (body.dueAt !== undefined && body.dueAt !== null && typeof body.dueAt !== 'string')
      || (body.resources !== undefined && (!Array.isArray(body.resources) || body.resources.some((resource) => {
        const value = resource !== null && typeof resource === 'object' && !Array.isArray(resource)
          ? resource as Record<string, unknown>
          : null;
        return value === null || Object.keys(value).sort().join(',') !== 'label,url'
          || typeof value.label !== 'string' || typeof value.url !== 'string';
      })))) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    title = body.title;
    description = body.description as string | undefined;
    teamId = body.teamId as string | undefined;
    statusId = body.statusId as string | undefined;
    projectId = body.projectId as string | null | undefined;
    milestoneId = body.milestoneId as string | null | undefined;
    parentIssueId = body.parentIssueId as string | null | undefined;
    resources = body.resources as CollaborationIssueResource[] | undefined;
    dueAt = body.dueAt as string | null | undefined;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const issue = await options.collaborationService.createIssue({
      principal, workspaceId, requestId: correlationId, idempotencyKey: idempotencyKey(request), title,
      ...(description === undefined ? {} : {description}),
      ...(teamId === undefined ? {} : {teamId}),
      ...(statusId === undefined ? {} : {statusId}),
      ...(projectId === undefined ? {} : {projectId}),
      ...(milestoneId === undefined ? {} : {milestoneId}),
      ...(parentIssueId === undefined ? {} : {parentIssueId}),
      ...(resources === undefined ? {} : {resources}),
      ...(dueAt === undefined ? {} : {dueAt}),
    });
    writeJson(response, 201, { data: { issue } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssue(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PATCH') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'PATCH' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  let expectedRevision: number;
  let patch: {
    title?: string;
    description?: string;
    status?: CollaborationIssueStatus;
    priority?: CollaborationIssuePriority;
    teamId?: string;
    statusId?: string;
    projectId?: string | null;
    milestoneId?: string | null;
    parentIssueId?: string | null;
    resources?: CollaborationIssueResource[];
    dueAt?: string | null;
  };
  try {
    const body = allowedObject(
      await readJsonBody(request, 32_768),
      ['expectedRevision', 'title', 'description', 'status', 'priority', 'teamId', 'statusId', 'projectId', 'milestoneId', 'parentIssueId', 'resources', 'dueAt'],
      ['expectedRevision'],
    );
    if (typeof body.expectedRevision !== 'number'
      || Object.keys(body).filter((key) => key !== 'expectedRevision').length === 0
      || (body.title !== undefined && typeof body.title !== 'string')
      || (body.description !== undefined && typeof body.description !== 'string')
      || (body.status !== undefined && typeof body.status !== 'string')
      || (body.priority !== undefined && typeof body.priority !== 'string')
      || (body.teamId !== undefined && typeof body.teamId !== 'string')
      || (body.statusId !== undefined && typeof body.statusId !== 'string')
      || (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string')
      || (body.milestoneId !== undefined && body.milestoneId !== null && typeof body.milestoneId !== 'string')
      || (body.parentIssueId !== undefined && body.parentIssueId !== null && typeof body.parentIssueId !== 'string')
      || (body.dueAt !== undefined && body.dueAt !== null && typeof body.dueAt !== 'string')
      || (body.resources !== undefined && (!Array.isArray(body.resources) || body.resources.some((resource) => {
        const value = resource !== null && typeof resource === 'object' && !Array.isArray(resource)
          ? resource as Record<string, unknown>
          : null;
        return value === null || Object.keys(value).sort().join(',') !== 'label,url'
          || typeof value.label !== 'string' || typeof value.url !== 'string';
      })))) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    expectedRevision = body.expectedRevision;
    patch = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.description === 'string') patch.description = body.description;
    if (typeof body.status === 'string') patch.status = body.status as CollaborationIssueStatus;
    if (typeof body.priority === 'string') patch.priority = body.priority as CollaborationIssuePriority;
    if (typeof body.teamId === 'string') patch.teamId = body.teamId;
    if (typeof body.statusId === 'string') patch.statusId = body.statusId;
    if (body.projectId === null || typeof body.projectId === 'string') patch.projectId = body.projectId;
    if (body.milestoneId === null || typeof body.milestoneId === 'string') patch.milestoneId = body.milestoneId;
    if (body.parentIssueId === null || typeof body.parentIssueId === 'string') patch.parentIssueId = body.parentIssueId;
    if (Array.isArray(body.resources)) patch.resources = body.resources as CollaborationIssueResource[];
    if (body.dueAt === null || typeof body.dueAt === 'string') patch.dueAt = body.dueAt;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const issue = await options.collaborationService.updateIssue({
      principal: { kind: 'user', userId: identity.uid, source: 'web' }, workspaceId, issueId,
      requestId: correlationId, idempotencyKey: idempotencyKey(request), expectedRevision, patch,
    });
    writeJson(response, 200, { data: { issue } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueAssignment(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PUT') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'PUT' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  let expectedRevision: number;
  let assigneeUserId: string | null;
  try {
    const body = exactObject(await readJsonBody(request, 1_024), ['expectedRevision', 'assigneeUserId']);
    if (typeof body.expectedRevision !== 'number'
      || (body.assigneeUserId !== null && typeof body.assigneeUserId !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    expectedRevision = body.expectedRevision;
    assigneeUserId = body.assigneeUserId;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const issue = await options.collaborationService.assignIssue({
      principal: { kind: 'user', userId: identity.uid, source: 'web' }, workspaceId, issueId,
      requestId: correlationId, idempotencyKey: idempotencyKey(request), expectedRevision, assigneeUserId,
    });
    writeJson(response, 200, { data: { issue } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueComments(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'GET, POST' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = { kind: 'user' as const, userId: identity.uid, source: 'web' as const };
  if (request.method === 'GET') {
    try {
      const comments = await options.collaborationService.listComments({ principal, workspaceId, issueId, requestId: correlationId });
      writeJson(response, 200, { data: { comments } }, correlationId);
    } catch (error) {
      writeCollaborationServiceError(response, error, correlationId);
    }
    return;
  }
  let bodyValue: string;
  try {
    const body = exactObject(await readJsonBody(request, 5_120), ['body']);
    if (typeof body.body !== 'string') throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    bodyValue = body.body;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const comment = await options.collaborationService.createComment({
      principal, workspaceId, issueId, requestId: correlationId,
      idempotencyKey: idempotencyKey(request), body: bodyValue,
    });
    writeJson(response, 201, { data: { comment } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueActivity(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET'});
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const activity = await options.collaborationService.listIssueActivity({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      issueId,
      requestId: correlationId,
    });
    writeJson(response, 200, {data: {activity}}, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueSubscription(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'PUT') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, PUT'});
    return;
  }
  if (options.issueObservationService === undefined) {
    writeJson(response, 503, errorBody('OBSERVATION_SERVICE_UNAVAILABLE', 'Issue observation is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  let subscribed: boolean | null = null;
  if (request.method === 'PUT') {
    try {
      const body = exactObject(await readJsonBody(request, 512), ['subscribed']);
      if (typeof body.subscribed !== 'boolean') throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
      subscribed = body.subscribed;
    } catch (error) {
      writeRequestError(response, error, correlationId);
      return;
    }
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  try {
    const observation = request.method === 'GET'
      ? await options.issueObservationService.getIssueObservation({
        principal, workspaceId, issueId, requestId: correlationId,
      })
      : await options.issueObservationService.setIssueSubscription({
        principal, workspaceId, issueId, requestId: correlationId,
        idempotencyKey: idempotencyKey(request), subscribed: subscribed as boolean,
      });
    writeJson(response, 200, {data: {observation}}, correlationId);
  } catch (error) {
    writeIssueObservationError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueNotificationsRead(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'POST'});
    return;
  }
  if (options.issueObservationService === undefined) {
    writeJson(response, 503, errorBody('OBSERVATION_SERVICE_UNAVAILABLE', 'Issue observation is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  try {
    exactObject(await readJsonBody(request, 256), []);
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const observation = await options.issueObservationService.markIssueNotificationsRead({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      issueId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    });
    writeJson(response, 200, {data: {observation}}, correlationId);
  } catch (error) {
    writeIssueObservationError(response, error, correlationId);
  }
}

async function handleWorkspaceNotifications(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET'});
    return;
  }
  if (options.issueObservationService === undefined) {
    writeJson(response, 503, errorBody('OBSERVATION_SERVICE_UNAVAILABLE', 'Issue observation is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const notifications = await options.issueObservationService.listNotifications({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      requestId: correlationId,
    });
    writeJson(response, 200, {data: {notifications}}, correlationId);
  } catch (error) {
    writeIssueObservationError(response, error, correlationId);
  }
}

async function handleWorkspaceIssueComment(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  issueId: string,
  commentId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'PATCH' && request.method !== 'DELETE') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'PATCH, DELETE' });
    return;
  }
  if (options.collaborationService === undefined) {
    unavailableCollaboration(response, correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  let expectedRevision: number;
  let bodyValue: string | null = null;
  try {
    const body = request.method === 'PATCH'
      ? exactObject(await readJsonBody(request, 5_120), ['expectedRevision', 'body'])
      : exactObject(await readJsonBody(request, 1_024), ['expectedRevision']);
    if (typeof body.expectedRevision !== 'number'
      || (request.method === 'PATCH' && typeof body.body !== 'string')) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    expectedRevision = body.expectedRevision;
    if (typeof body.body === 'string') bodyValue = body.body;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  const command = {
    principal: { kind: 'user' as const, userId: identity.uid, source: 'web' as const },
    workspaceId, issueId, commentId, requestId: correlationId,
    idempotencyKey: idempotencyKey(request), expectedRevision,
  };
  try {
    const comment = request.method === 'PATCH'
      ? await options.collaborationService.editComment({ ...command, body: bodyValue as string })
      : await options.collaborationService.deleteComment(command);
    writeJson(response, 200, { data: { comment } }, correlationId);
  } catch (error) {
    writeCollaborationServiceError(response, error, correlationId);
  }
}

async function verifiedIdentity(
  request: IncomingMessage,
  verifier: GoogleIdentityVerifier,
): Promise<VerifiedGoogleIdentity> {
  const token = bearerToken(request);
  return verifier.verifyGoogleIdToken(token);
}

async function handleWorkspaceAccess(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      { allow: 'GET' },
    );
    return;
  }

  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return;
  }

  try {
    const grant = await options.workspaceAuthorizationService.authorize({
      principal: { kind: 'user', userId: identity.uid, source: 'web' },
      workspaceId,
      action: 'workspace.read',
      targetEntityType: 'workspace',
      targetEntityId: workspaceId,
      requestId: correlationId,
    });
    writeJson(response, 200, {
      data: {
        workspace: { id: grant.workspaceId },
        membership: { role: grant.role, status: 'active' },
        capabilities: actionsForWorkspaceRole(grant.role),
      },
    }, correlationId);
  } catch (error) {
    if (
      error instanceof WorkspaceAuthorizationError
      && error.code === 'WORKSPACE_ACCESS_DENIED'
    ) {
      writeJson(
        response,
        403,
        errorBody('WORKSPACE_ACCESS_DENIED', 'The requested workspace resource is unavailable.', correlationId),
        correlationId,
      );
      return;
    }
    writeJson(
      response,
      503,
      errorBody('AUTHORIZATION_UNAVAILABLE', 'Workspace authorization is temporarily unavailable.', correlationId),
      correlationId,
    );
  }
}

async function handleUserWorkspaces(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      {allow: 'GET'},
    );
    return;
  }
  if (options.workspaceDirectoryService === undefined) {
    writeJson(
      response,
      503,
      errorBody('WORKSPACE_DIRECTORY_UNAVAILABLE', 'The workspace directory is temporarily unavailable.', correlationId),
      correlationId,
    );
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return;
  }
  try {
    const workspaces = await options.workspaceDirectoryService.listUserWorkspaces(identity.uid);
    writeJson(response, 200, {data: {workspaces}}, correlationId);
  } catch (error) {
    const unavailable = error instanceof WorkspaceDirectoryServiceError
      ? error
      : new WorkspaceDirectoryServiceError(
        'WORKSPACE_DIRECTORY_UNAVAILABLE',
        'The workspace directory is temporarily unavailable.',
      );
    writeJson(
      response,
      unavailable.code === 'INVALID_WORKSPACE_DIRECTORY_REQUEST' ? 400 : 503,
      errorBody(unavailable.code, unavailable.message, correlationId),
      correlationId,
    );
  }
}

async function handleWorkspaceInvitations(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      { allow: 'GET, POST' },
    );
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return;
  }
  if (request.method === 'GET') {
    try {
      const invitations = await options.invitationService.listOwnerInvitations({
        principal: { kind: 'user', userId: identity.uid, source: 'web' },
        workspaceId,
        requestId: correlationId,
      });
      writeJson(response, 200, { data: { invitations: invitations.map(publicInvitation) } }, correlationId);
    } catch (error) {
      writeInvitationServiceError(response, error, correlationId);
    }
    return;
  }

  let email: string;
  let teamIds: string[] | undefined;
  try {
    const body = allowedObject(await readJsonBody(request), ['email', 'teamIds'], ['email']);
    if (typeof body.email !== 'string') {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    if (body.teamIds !== undefined && (!Array.isArray(body.teamIds)
      || body.teamIds.some((teamId) => typeof teamId !== 'string'))) {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    email = body.email;
    teamIds = body.teamIds as string[] | undefined;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const result = await options.invitationService.createOwnerInvitation({
      principal: { kind: 'user', userId: identity.uid, source: 'web' },
      workspaceId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      invitedEmail: email,
      ...(teamIds === undefined ? {} : {teamIds}),
      inviterEmail: identity.email,
      inviterDisplayName: identity.displayName,
    });
    writeJson(
      response,
      result.changed ? 201 : 200,
      { data: publicInvitationMutation(result) },
      correlationId,
    );
  } catch (error) {
    writeInvitationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceInvitationAction(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  invitationId: string,
  action: 'resend' | 'revoke',
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      { allow: 'POST' },
    );
    return;
  }
  try {
    exactObject(await readJsonBody(request, 1_024), []);
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return;
  }
  try {
    const command = {
      principal: { kind: 'user' as const, userId: identity.uid, source: 'web' as const },
      workspaceId,
      invitationId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    };
    const result = action === 'resend'
      ? await options.invitationService.resendOwnerInvitation(command)
      : await options.invitationService.revokeOwnerInvitation(command);
    writeJson(response, 200, { data: publicInvitationMutation(result) }, correlationId);
  } catch (error) {
    writeInvitationServiceError(response, error, correlationId);
  }
}

async function handleInvitationInspect(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      { allow: 'POST' },
    );
    return;
  }
  let token: string;
  try {
    const body = exactObject(await readJsonBody(request, 1_024), ['token']);
    if (typeof body.token !== 'string') {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    token = body.token;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  try {
    const preview = await options.invitationService.inspectInvitation(token);
    writeJson(response, 200, { data: publicInvitationPreview(preview) }, correlationId);
  } catch (error) {
    writeInvitationServiceError(response, error, correlationId);
  }
}

async function handleInvitationAccept(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(
      response,
      405,
      errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId),
      correlationId,
      { allow: 'POST' },
    );
    return;
  }
  let token: string;
  try {
    const body = exactObject(await readJsonBody(request, 1_024), ['token']);
    if (typeof body.token !== 'string') {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    token = body.token;
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(
      response,
      401,
      errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
      correlationId,
    );
    return;
  }
  try {
    const result = await options.invitationService.acceptInvitation({
      token,
      identity: {
        uid: identity.uid,
        email: identity.email,
        displayName: identity.displayName,
      },
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    });
    writeJson(response, 200, { data: publicInvitationAcceptance(result) }, correlationId);
  } catch (error) {
    writeInvitationServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceBilling(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (options.billingService === undefined) {
    writeJson(response, 503, errorBody('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  if (request.method !== 'GET') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET'});
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(response, 401, errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId), correlationId);
    return;
  }
  try {
    const summary = await options.billingService.summary({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      requestId: correlationId,
    });
    writeJson(response, 200, {data: summary}, correlationId);
  } catch (error) {
    writeBillingServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceBillingCheckout(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (options.billingService === undefined) {
    writeJson(response, 503, errorBody('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  if (request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'POST'});
    return;
  }
  let body: Record<string, unknown>;
  try {
    body = exactObject(await readJsonBody(request, 512), ['plan']);
    if (body.plan !== 'monthly' && body.plan !== 'annual') throw new Error('INVALID_PLAN');
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  let identity: VerifiedGoogleIdentity;
  try {
    identity = await verifiedIdentity(request, options.identityVerifier);
  } catch {
    writeJson(response, 401, errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId), correlationId);
    return;
  }
  try {
    const checkout = await options.billingService.createCheckout({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      plan: body.plan as 'monthly' | 'annual',
    });
    writeJson(response, 201, {data: checkout}, correlationId);
  } catch (error) {
    writeBillingServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceTokens(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET, POST'});
    return;
  }
  if (options.personalTokenService === undefined) {
    writeJson(response, 503, errorBody('TOKEN_SERVICE_UNAVAILABLE', 'Personal tokens are temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  const principal = {kind: 'user' as const, userId: identity.uid, source: 'web' as const};
  try {
    if (request.method === 'GET') {
      const tokens = await options.personalTokenService.listTokens({
        principal, workspaceId, requestId: correlationId,
      });
      writeJson(response, 200, {data: {tokens}}, correlationId);
      return;
    }
    const body = exactObject(await readJsonBody(request, 8_192), ['name', 'scopes', 'expiresInDays']);
    if (typeof body.name !== 'string' || !Array.isArray(body.scopes)
      || body.scopes.some((scope) => typeof scope !== 'string')
      || typeof body.expiresInDays !== 'number') {
      throw new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
    }
    const result = await options.personalTokenService.createToken({
      principal,
      workspaceId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
      name: body.name,
      scopes: body.scopes as string[],
      expiresInDays: body.expiresInDays,
    });
    writeJson(response, result.changed ? 201 : 200, {data: result}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writePersonalTokenServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceToken(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  tokenId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'DELETE') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'DELETE'});
    return;
  }
  if (options.personalTokenService === undefined) {
    writeJson(response, 503, errorBody('TOKEN_SERVICE_UNAVAILABLE', 'Personal tokens are temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    exactObject(await readJsonBody(request, 512), []);
    const result = await options.personalTokenService.revokeToken({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      tokenId,
      requestId: correlationId,
      idempotencyKey: idempotencyKey(request),
    });
    writeJson(response, 200, {data: result}, correlationId);
  } catch (error) {
    if (error instanceof HostedRequestError) writeRequestError(response, error, correlationId);
    else writePersonalTokenServiceError(response, error, correlationId);
  }
}

async function handleWorkspaceExport(
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  workspaceId: string,
  correlationId: string,
): Promise<void> {
  if (request.method !== 'GET') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET'});
    return;
  }
  if (options.projectManagementService === undefined) {
    writeJson(response, 503, errorBody('PM_SERVICE_UNAVAILABLE', 'Product management is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  const identity = await collaborationIdentity(request, response, options, correlationId);
  if (identity === null) return;
  try {
    const exported = await options.projectManagementService.exportWorkspace({
      principal: {kind: 'user', userId: identity.uid, source: 'web'},
      workspaceId,
      requestId: correlationId,
    });
    writeJson(response, 200, {data: exported}, correlationId, {
      'content-type': workspaceExportMediaType,
      'content-disposition': `attachment; filename="basiclinear-${workspaceId}-export-v1.json"`,
      'x-basiclinear-export-sha256': exported.sha256,
    });
  } catch (error) {
    writeProjectManagementServiceError(response, error, correlationId);
  }
}

async function handleBillingWebhook(
  provider: VerifiedBillingNotice['provider'],
  request: IncomingMessage,
  response: ServerResponse,
  options: HostedHttpHandlerOptions,
  correlationId: string,
): Promise<void> {
  if ((options.billingWebhookProvider ?? 'stripe') !== provider
    || options.billingService === undefined || options.billingWebhookVerifier === undefined) {
    writeJson(response, 503, errorBody('BILLING_UNAVAILABLE', 'Billing is temporarily unavailable.', correlationId), correlationId);
    return;
  }
  if (request.method !== 'POST') {
    writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'POST'});
    return;
  }
  const signature = headerValue(request.headers[`${provider}-signature`]);
  if (signature === null || signature.length < 16 || signature.length > 2_048 || /[\r\n]/u.test(signature)) {
    writeJson(response, 400, errorBody('INVALID_WEBHOOK', 'The webhook is invalid.', correlationId), correlationId);
    return;
  }
  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(
      request,
      hostedOperationsPolicyV1.queries.maximumStripeWebhookBytes,
    );
  } catch (error) {
    writeRequestError(response, error, correlationId);
    return;
  }
  let notice: VerifiedBillingNotice | null;
  try {
    notice = options.billingWebhookVerifier.verifyWebhook(rawBody, signature);
    if (notice !== null && notice.provider !== provider) throw new Error('BILLING_PROVIDER_MISMATCH');
  } catch {
    writeJson(response, 400, errorBody('INVALID_WEBHOOK', 'The webhook is invalid.', correlationId), correlationId);
    return;
  }
  if (notice === null) {
    writeJson(response, 200, {received: true, processed: false}, correlationId);
    return;
  }
  try {
    await options.billingService.reconcileNotice(notice);
    writeJson(response, 200, {received: true, processed: true}, correlationId);
  } catch (error) {
    writeBillingServiceError(response, error, correlationId);
  }
}

export function createHostedHttpHandler(options: HostedHttpHandlerOptions) {
  const configuredOrigins = new Set(options.allowedOrigins ?? []);
  const probeReadiness = createReadinessProbe(options.readinessCheck);
  const dispatch = async (
    request: IncomingMessage,
    response: ServerResponse,
    correlationId: string,
    url: URL,
  ): Promise<void> => {
    if (url.pathname === '/health/ready') {
      if (request.method !== 'GET') {
        writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'GET' });
        return;
      }
      if (await probeReadiness()) {
        writeJson(response, 200, { status: 'ready', authority: 'firebase-hosted' }, correlationId);
      } else {
        writeJson(response, 503, errorBody('SERVICE_UNAVAILABLE', 'The hosted service is not ready.', correlationId), correlationId);
      }
      return;
    }
    if (options.mcpHttpHandler !== undefined
      && await options.mcpHttpHandler(request, response, correlationId, url)) {
      return;
    }
    if (url.pathname === '/api/v1/hosted/operations/budget-notice') {
      await handleBudgetNotice(request, response, options, correlationId);
      return;
    }
    if (url.pathname === '/api/v1/hosted/billing/stripe/webhook'
      || url.pathname === '/api/v1/hosted/billing/creem/webhook') {
      const provider = url.pathname.includes('/creem/') ? 'creem' : 'stripe';
      await handleBillingWebhook(provider, request, response, options, correlationId);
      return;
    }
    if (url.pathname === '/api/v1/hosted/invitations/inspect') {
      await handleInvitationInspect(request, response, options, correlationId);
      return;
    }
    if (url.pathname === '/api/v1/hosted/invitations/accept') {
      await handleInvitationAccept(request, response, options, correlationId);
      return;
    }
    if (url.pathname === userWorkspacesPath) {
      await handleUserWorkspaces(request, response, options, correlationId);
      return;
    }
    const workspaceExportMatch = workspaceExportPath.exec(url.pathname);
    if (workspaceExportMatch !== null) {
      await handleWorkspaceExport(
        request,
        response,
        options,
        workspaceExportMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceTokenMatch = workspaceTokenPath.exec(url.pathname);
    if (workspaceTokenMatch !== null) {
      await handleWorkspaceToken(
        request,
        response,
        options,
        workspaceTokenMatch[1] as string,
        workspaceTokenMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceTokensMatch = workspaceTokensPath.exec(url.pathname);
    if (workspaceTokensMatch !== null) {
      await handleWorkspaceTokens(
        request,
        response,
        options,
        workspaceTokensMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceBillingCheckoutMatch = workspaceBillingCheckoutPath.exec(url.pathname);
    if (workspaceBillingCheckoutMatch !== null) {
      await handleWorkspaceBillingCheckout(
        request,
        response,
        options,
        workspaceBillingCheckoutMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceBillingMatch = workspaceBillingPath.exec(url.pathname);
    if (workspaceBillingMatch !== null) {
      await handleWorkspaceBilling(
        request,
        response,
        options,
        workspaceBillingMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceConfigurationBootstrapMatch = workspaceConfigurationBootstrapPath.exec(url.pathname);
    if (workspaceConfigurationBootstrapMatch !== null) {
      await handleWorkspaceConfigurationBootstrap(
        request,
        response,
        options,
        workspaceConfigurationBootstrapMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceTeamMembersMatch = workspaceTeamMembersPath.exec(url.pathname);
    if (workspaceTeamMembersMatch !== null) {
      await handleWorkspaceTeamMembers(
        request,
        response,
        options,
        workspaceTeamMembersMatch[1] as string,
        workspaceTeamMembersMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceTeamMatch = workspaceTeamPath.exec(url.pathname);
    if (workspaceTeamMatch !== null) {
      await handleWorkspaceTeam(
        request,
        response,
        options,
        workspaceTeamMatch[1] as string,
        workspaceTeamMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceTeamsMatch = workspaceTeamsPath.exec(url.pathname);
    if (workspaceTeamsMatch !== null) {
      await handleWorkspaceTeams(
        request,
        response,
        options,
        workspaceTeamsMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceStatusMatch = workspaceStatusPath.exec(url.pathname);
    if (workspaceStatusMatch !== null) {
      await handleWorkspaceStatus(
        request,
        response,
        options,
        workspaceStatusMatch[1] as string,
        workspaceStatusMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceStatusesMatch = workspaceStatusesPath.exec(url.pathname);
    if (workspaceStatusesMatch !== null) {
      await handleWorkspaceStatuses(
        request,
        response,
        options,
        workspaceStatusesMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceSavedViewsMatch = workspaceSavedViewsPath.exec(url.pathname);
    if (workspaceSavedViewsMatch !== null) {
      await handleWorkspaceSavedViews(
        request,
        response,
        options,
        workspaceSavedViewsMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceProjectMilestonesMatch = workspaceProjectMilestonesPath.exec(url.pathname);
    if (workspaceProjectMilestonesMatch !== null) {
      await handleWorkspaceProjectMilestones(
        request,
        response,
        options,
        workspaceProjectMilestonesMatch[1] as string,
        workspaceProjectMilestonesMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceNotificationsMatch = workspaceNotificationsPath.exec(url.pathname);
    if (workspaceNotificationsMatch !== null) {
      await handleWorkspaceNotifications(
        request,
        response,
        options,
        workspaceNotificationsMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceMilestoneMatch = workspaceMilestonePath.exec(url.pathname);
    if (workspaceMilestoneMatch !== null) {
      await handleWorkspaceMilestone(
        request,
        response,
        options,
        workspaceMilestoneMatch[1] as string,
        workspaceMilestoneMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceProjectMatch = workspaceProjectPath.exec(url.pathname);
    if (workspaceProjectMatch !== null) {
      await handleWorkspaceProject(
        request,
        response,
        options,
        workspaceProjectMatch[1] as string,
        workspaceProjectMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceProjectsMatch = workspaceProjectsPath.exec(url.pathname);
    if (workspaceProjectsMatch !== null) {
      await handleWorkspaceProjects(
        request,
        response,
        options,
        workspaceProjectsMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueCommentMatch = workspaceIssueCommentPath.exec(url.pathname);
    if (workspaceIssueCommentMatch !== null) {
      await handleWorkspaceIssueComment(
        request,
        response,
        options,
        workspaceIssueCommentMatch[1] as string,
        workspaceIssueCommentMatch[2] as string,
        workspaceIssueCommentMatch[3] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueCommentsMatch = workspaceIssueCommentsPath.exec(url.pathname);
    if (workspaceIssueCommentsMatch !== null) {
      await handleWorkspaceIssueComments(
        request,
        response,
        options,
        workspaceIssueCommentsMatch[1] as string,
        workspaceIssueCommentsMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueActivityMatch = workspaceIssueActivityPath.exec(url.pathname);
    if (workspaceIssueActivityMatch !== null) {
      await handleWorkspaceIssueActivity(
        request,
        response,
        options,
        workspaceIssueActivityMatch[1] as string,
        workspaceIssueActivityMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueNotificationsReadMatch = workspaceIssueNotificationsReadPath.exec(url.pathname);
    if (workspaceIssueNotificationsReadMatch !== null) {
      await handleWorkspaceIssueNotificationsRead(
        request,
        response,
        options,
        workspaceIssueNotificationsReadMatch[1] as string,
        workspaceIssueNotificationsReadMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueSubscriptionMatch = workspaceIssueSubscriptionPath.exec(url.pathname);
    if (workspaceIssueSubscriptionMatch !== null) {
      await handleWorkspaceIssueSubscription(
        request,
        response,
        options,
        workspaceIssueSubscriptionMatch[1] as string,
        workspaceIssueSubscriptionMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueAssignmentMatch = workspaceIssueAssignmentPath.exec(url.pathname);
    if (workspaceIssueAssignmentMatch !== null) {
      await handleWorkspaceIssueAssignment(
        request,
        response,
        options,
        workspaceIssueAssignmentMatch[1] as string,
        workspaceIssueAssignmentMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssueMatch = workspaceIssuePath.exec(url.pathname);
    if (workspaceIssueMatch !== null) {
      await handleWorkspaceIssue(
        request,
        response,
        options,
        workspaceIssueMatch[1] as string,
        workspaceIssueMatch[2] as string,
        correlationId,
      );
      return;
    }
    const workspaceIssuesMatch = workspaceIssuesPath.exec(url.pathname);
    if (workspaceIssuesMatch !== null) {
      await handleWorkspaceIssues(
        request,
        response,
        options,
        workspaceIssuesMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceMemberMatch = workspaceMemberPath.exec(url.pathname);
    if (workspaceMemberMatch !== null) {
      const memberUserId = decodedMemberReference(workspaceMemberMatch[2] as string);
      if (memberUserId === null) {
        writeJson(response, 400, errorBody('INVALID_REQUEST', 'The request path is invalid.', correlationId), correlationId);
        return;
      }
      await handleWorkspaceMember(
        request,
        response,
        options,
        workspaceMemberMatch[1] as string,
        memberUserId,
        correlationId,
      );
      return;
    }
    const workspaceMembersMatch = workspaceMembersPath.exec(url.pathname);
    if (workspaceMembersMatch !== null) {
      await handleWorkspaceMembers(
        request,
        response,
        options,
        workspaceMembersMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceInvitationActionMatch = workspaceInvitationActionPath.exec(url.pathname);
    if (workspaceInvitationActionMatch !== null) {
      await handleWorkspaceInvitationAction(
        request,
        response,
        options,
        workspaceInvitationActionMatch[1] as string,
        workspaceInvitationActionMatch[2] as string,
        workspaceInvitationActionMatch[3] as 'resend' | 'revoke',
        correlationId,
      );
      return;
    }
    const workspaceInvitationsMatch = workspaceInvitationsPath.exec(url.pathname);
    if (workspaceInvitationsMatch !== null) {
      await handleWorkspaceInvitations(
        request,
        response,
        options,
        workspaceInvitationsMatch[1] as string,
        correlationId,
      );
      return;
    }
    const workspaceAccessMatch = workspaceAccessPath.exec(url.pathname);
    if (workspaceAccessMatch !== null) {
      await handleWorkspaceAccess(
        request,
        response,
        options,
        workspaceAccessMatch[1] as string,
        correlationId,
      );
      return;
    }
    if (options.restApiHandler !== undefined
      && await options.restApiHandler(request, response, correlationId, url)) {
      return;
    }
    if (url.pathname !== '/api/v1/hosted/bootstrap') {
      writeJson(response, 404, errorBody('NOT_FOUND', 'Route not found.', correlationId), correlationId);
      return;
    }
    if (request.method !== 'POST') {
      writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, { allow: 'POST' });
      return;
    }

    try {
      await readBootstrapBody(request);
    } catch (error) {
      const requestError = error instanceof HostedRequestError
        ? error
        : new HostedRequestError('INVALID_REQUEST', 400, 'The request body is invalid.');
      writeJson(
        response,
        requestError.status,
        errorBody(requestError.code, requestError.message, correlationId),
        correlationId,
      );
      return;
    }

    let identity: VerifiedGoogleIdentity;
    try {
      identity = await verifiedIdentity(request, options.identityVerifier);
    } catch {
      writeJson(
        response,
        401,
        errorBody('AUTHENTICATION_REQUIRED', 'A verified Google session is required.', correlationId),
        correlationId,
      );
      return;
    }

    try {
      const result = await options.bootstrapService.bootstrap(identity, idempotencyKey(request));
      writeJson(
        response,
        result.created ? 201 : 200,
        { data: publicResult(result) },
        correlationId,
        { 'x-basiclinear-bootstrap': result.created ? 'created' : 'existing' },
      );
    } catch (error) {
      if (error instanceof OwnerBootstrapInputError) {
        writeJson(response, 400, errorBody(error.code, error.message, correlationId), correlationId);
        return;
      }
      writeJson(
        response,
        500,
        errorBody('INTERNAL_ERROR', 'The hosted workspace could not be prepared.', correlationId),
        correlationId,
      );
    }
  };
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const correlationId = randomUUID();
    const url = new URL(request.url ?? '/', 'https://basiclinear.invalid');
    if (!requestOriginAllowed(request, configuredOrigins)) {
      writeJson(
        response,
        403,
        errorBody('ORIGIN_NOT_ALLOWED', 'This origin is not allowed.', correlationId),
        correlationId,
      );
      return;
    }
    // Liveness must not restart a healthy process because a dependency or the
    // operations admission controls are unavailable.
    if (url.pathname === '/health/live') {
      if (request.method !== 'GET') {
        writeJson(response, 405, errorBody('METHOD_NOT_ALLOWED', 'Method not allowed.', correlationId), correlationId, {allow: 'GET'});
      } else {
        writeJson(response, 200, {status: 'live', authority: 'firebase-hosted'}, correlationId);
      }
      return;
    }
    const admissionInput = {
      correlationId,
      method: request.method ?? 'UNKNOWN',
      pathname: url.pathname,
      networkAddress: request.socket?.remoteAddress ?? null,
      authorization: headerValue(request.headers.authorization),
      workspaceId: operationsWorkspaceId(url.pathname),
      traceId: operationsTraceId(request),
    };
    let admission: HostedOperationsAdmission;
    try {
      admission = options.operationsControl.admit(admissionInput);
    } catch (error) {
      const operationError = error instanceof HostedOperationsControlError
        ? error
        : new HostedOperationsControlError(
          'OPERATIONS_UNAVAILABLE',
          'Hosted operations controls are temporarily unavailable.',
          1,
        );
      const limited = operationError.code === 'OPERATIONS_RATE_LIMITED';
      try {
        writeJson(
          response,
          limited ? 429 : 503,
          errorBody(
            limited ? 'RATE_LIMITED' : 'OPERATIONS_UNAVAILABLE',
            limited
              ? 'The request rate is temporarily limited.'
              : 'Hosted operations controls are temporarily unavailable.',
            correlationId,
          ),
          correlationId,
          {'retry-after': String(operationError.retryAfterSeconds)},
        );
      } finally {
        try {
          options.operationsControl.recordAdmissionFailure(admissionInput, operationError);
        } catch {
          // The generic HTTP rejection remains authoritative if telemetry is unavailable.
        }
      }
      return;
    }
    try {
      await dispatch(request, response, correlationId, url);
    } catch {
      if (response.headersSent !== true
        && response.writableEnded !== true
        && response.destroyed !== true) {
        writeJson(
          response,
          503,
          errorBody(
            'SERVICE_UNAVAILABLE',
            'The hosted service is temporarily unavailable.',
            correlationId,
          ),
          correlationId,
        );
      }
    } finally {
      options.operationsControl.complete(admission, {statusCode: response.statusCode});
    }
  };
}
