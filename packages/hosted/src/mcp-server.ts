import {setImmediate as nextTurn} from 'node:timers/promises';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {
  BillingServiceError,
  type BillingService,
} from './billing-service.js';
import {
  CollaborationServiceError,
  collaborationIssuePriorities,
  collaborationIssueStatuses,
  type CollaborationService,
} from './collaboration-service.js';
import {
  InvitationServiceError,
  type InvitationService,
} from './invitation-service.js';
import {
  McpOAuthServiceError,
  mcpOAuthScopeAllowed,
  mcpProtocolVersion,
  type McpAccessGrant,
  type McpOAuthScope,
  type McpOAuthService,
} from './mcp-oauth-service.js';
import type {GoogleIdentityVerifier} from './hosted-http.js';
import {
  hostedProjectStatuses,
  ProjectManagementServiceError,
  type ProjectManagementService,
} from './project-management-service.js';
import {WorkspaceAuthorizationError} from './workspace-authorization.js';

export const mcpServerName = 'openlinear-product-management' as const;
export const mcpServerVersion = '0.2.0' as const;
export const mcpStandardProtocolVersion = '2025-06-18' as const;
export const mcpJsonSchemaDialect = 'https://json-schema.org/draft/2020-12/schema' as const;
export const mcpProductManagementToolNames = [
  'billing.get',
  'comment.create',
  'comment.delete',
  'comment.get',
  'comment.list',
  'comment.update',
  'invitation.create',
  'invitation.list',
  'invitation.resend',
  'invitation.revoke',
  'issue.assign',
  'issue.create',
  'issue.get',
  'issue.list',
  'issue.update',
  'member.list',
  'member.remove',
  'milestone.create',
  'milestone.get',
  'milestone.list',
  'milestone.update',
  'project.create',
  'project.get',
  'project.list',
  'project.update',
  'workspace.export',
  'workspace.get',
] as const;

export interface McpHttpHandlerOptions {
  oauthService: McpOAuthService;
  identityVerifier: GoogleIdentityVerifier;
  projectManagementService: ProjectManagementService;
  collaborationService: CollaborationService;
  invitationService: InvitationService;
  billingService: BillingService;
}

export type McpHttpHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  correlationId: string,
  url: URL,
) => Promise<boolean>;

type JsonRpcId = string | number;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: 'server/discover' | 'tools/list' | 'tools/call';
  params: Record<string, unknown>;
}

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  scope: McpOAuthScope;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  annotations: {
    title: string;
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: false;
  };
  execute(
    grant: McpAccessGrant,
    argumentsValue: Record<string, unknown>,
    correlationId: string,
  ): Promise<unknown>;
}

class McpHttpError extends Error {
  constructor(
    readonly status: number,
    readonly rpcCode: number,
    readonly rpcMessage: string,
    readonly rpcData?: Record<string, unknown>,
    readonly requiredScope?: McpOAuthScope,
  ) {
    super(rpcMessage);
    this.name = 'McpHttpError';
  }
}

class OAuthHttpError extends Error {
  constructor(
    readonly status: number,
    readonly oauthCode: string,
    readonly description: string,
  ) {
    super(description);
    this.name = 'OAuthHttpError';
  }
}

const workspacePattern = '^[A-Za-z0-9][A-Za-z0-9._+-]{2,127}$';
const projectPattern = '^project_[a-f0-9]{32}$';
const milestonePattern = '^milestone_[a-f0-9]{32}$';
const issuePattern = '^issue_[a-f0-9]{32}$';
const commentPattern = '^comment_[a-f0-9]{32}$';
const invitationPattern = '^invite_[a-f0-9]{32}$';

const stringSchema = (
  minimum: number,
  maximum: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({type: 'string', minLength: minimum, maxLength: maximum, ...extra});

const workspaceProperty = {
  ...stringSchema(3, 128, {pattern: workspacePattern}),
  description: 'Explicit OpenLinear workspace identifier. It must match the OAuth grant.',
  'x-mcp-header': 'Workspace-Id',
};
const idempotencyProperty = stringSchema(16, 160, {
  description: 'Stable retry key for exactly one logical mutation. Reuse it only for an identical retry.',
});
const revisionProperty = {
  type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER,
  description: 'Current entity revision used for optimistic concurrency.',
};
const nullableReference = (pattern: string): Record<string, unknown> => ({
  anyOf: [stringSchema(3, 128, {pattern}), {type: 'null'}],
});
const identifier = (pattern: string): Record<string, unknown> => stringSchema(3, 128, {pattern});
const issueResourcesSchema = {
  type: 'array',
  maxItems: 25,
  items: {
    type: 'object',
    properties: {
      label: stringSchema(1, 120),
      url: stringSchema(1, 2_048, {format: 'uri'}),
    },
    required: ['label', 'url'],
    additionalProperties: false,
  },
};
const outputSchema = {
  $schema: mcpJsonSchemaDialect,
  type: 'object',
  properties: {data: {}},
  required: ['data'],
  additionalProperties: false,
};

function objectSchema(
  properties: Record<string, unknown>,
  required: readonly string[],
): Record<string, unknown> {
  return {
    $schema: mcpJsonSchemaDialect,
    type: 'object',
    properties: {workspaceId: workspaceProperty, ...properties},
    required: ['workspaceId', ...required],
    additionalProperties: false,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactObject(
  value: unknown,
  allowed: readonly string[],
  required: readonly string[],
): Record<string, unknown> {
  const candidate = record(value);
  if (candidate === null
    || Object.keys(candidate).some((key) => !allowed.includes(key))
    || required.some((key) => !Object.hasOwn(candidate, key))) throw invalidParams();
  return candidate;
}

function conformsToSchema(value: unknown, schemaValue: unknown): boolean {
  const schema = record(schemaValue);
  if (schema === null) return true;
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((candidate) => conformsToSchema(value, candidate));
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false;
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) return false;
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return false;
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value)) return false;
      } catch {
        return false;
      }
    }
    if (schema.format === 'date') {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
      if (match === null) return false;
      const date = new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
    }
    if (schema.format === 'email'
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)) return false;
    return true;
  }
  if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value)) return false;
    if (typeof schema.minimum === 'number' && (value as number) < schema.minimum) return false;
    if (typeof schema.maximum === 'number' && (value as number) > schema.maximum) return false;
    return true;
  }
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'object') {
    const candidate = record(value);
    if (candidate === null) return false;
    const properties = record(schema.properties) ?? {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === 'string')
      : [];
    if (required.some((key) => !Object.hasOwn(candidate, key))) return false;
    if (schema.additionalProperties === false
      && Object.keys(candidate).some((key) => !Object.hasOwn(properties, key))) return false;
    return Object.entries(candidate).every(([key, item]) => (
      !Object.hasOwn(properties, key) || conformsToSchema(item, properties[key])
    ));
  }
  return true;
}

function requiredString(
  value: unknown,
  minimum = 1,
  maximum = 4_000,
  pattern?: RegExp,
): string {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum
    || (pattern !== undefined && !pattern.test(value))) throw invalidParams();
  return value;
}

function nullableString(value: unknown, pattern: RegExp): string | null {
  return value === null ? null : requiredString(value, 3, 128, pattern);
}

function requiredRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw invalidParams();
  return value as number;
}

function workspaceIdFrom(value: Record<string, unknown>): string {
  return requiredString(value.workspaceId, 3, 128, /^[A-Za-z0-9][A-Za-z0-9._+-]*$/u);
}

function requestHeaderValues(request: IncomingMessage, name: string): string[] {
  const normalized = name.toLowerCase();
  const distinct = request.headersDistinct?.[normalized];
  if (distinct !== undefined) return [...distinct];
  const values: string[] = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (request.rawHeaders[index]?.toLowerCase() === normalized) {
      values.push(request.rawHeaders[index + 1] ?? '');
    }
  }
  if (values.length > 0) return values;
  const collapsed = request.headers[normalized];
  if (Array.isArray(collapsed)) return [...collapsed];
  return collapsed === undefined ? [] : [collapsed];
}

function singleHeader(request: IncomingMessage, name: string): string | null {
  const values = requestHeaderValues(request, name);
  if (values.length > 1) throw headerMismatch();
  return values[0] ?? null;
}

function decodedMirroredHeader(request: IncomingMessage, name: string): string | null {
  const value = singleHeader(request, name);
  if (value === null) return null;
  const match = /^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/u.exec(value);
  if (match !== null) {
    try {
      const encoded = match[1] ?? '';
      const decoded = Buffer.from(encoded, 'base64');
      if (decoded.toString('base64') !== encoded || decoded.byteLength === 0) throw new Error();
      const text = decoded.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(decoded)) throw new Error();
      return text;
    } catch {
      throw headerMismatch();
    }
  }
  if (value.startsWith('=?base64?') || value.endsWith('?=')
    || !/^[\x20-\x7E]*$/u.test(value) || value.trim() !== value) throw headerMismatch();
  return value;
}

function exactQuery(url: URL, allowed: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key) || seen.has(key)) throw invalidOAuthRequest();
    seen.add(key);
  }
}

async function readBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const lengthValues = requestHeaderValues(request, 'content-length');
  if (lengthValues.length > 1) throw new OAuthHttpError(400, 'invalid_request', 'The request framing is invalid.');
  const declared = lengthValues[0];
  if (declared !== undefined && !/^(?:0|[1-9][0-9]*)$/u.test(declared)) {
    throw new OAuthHttpError(400, 'invalid_request', 'The request framing is invalid.');
  }
  const declaredLength = declared === undefined ? null : Number(declared);
  if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) || declaredLength > maximumBytes)) {
    throw new OAuthHttpError(413, 'invalid_request', 'The request body is too large.');
  }
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const rawChunk of request) {
    const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as Uint8Array);
    received += chunk.byteLength;
    if (received > maximumBytes) {
      throw new OAuthHttpError(413, 'invalid_request', 'The request body is too large.');
    }
    chunks.push(chunk);
  }
  if (declaredLength !== null && declaredLength !== received) {
    throw new OAuthHttpError(400, 'invalid_request', 'The request framing is invalid.');
  }
  return Buffer.concat(chunks);
}

function strictUtf8(body: Buffer): string | null {
  const text = body.toString('utf8');
  return Buffer.from(text, 'utf8').equals(body) ? text : null;
}

async function readJson(request: IncomingMessage, maximumBytes: number): Promise<unknown> {
  const contentType = singleHeaderForOAuth(request, 'content-type');
  if (contentType === null || !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)) {
    throw new OAuthHttpError(400, 'invalid_request', 'The request media type is invalid.');
  }
  const body = await readBody(request, maximumBytes);
  if (body.byteLength === 0) throw new OAuthHttpError(400, 'invalid_request', 'The request body is invalid.');
  const text = strictUtf8(body);
  if (text === null) throw new OAuthHttpError(400, 'invalid_request', 'The request body is invalid.');
  try {
    const parsed = JSON.parse(text) as unknown;
    if (hasDuplicateTopLevelJsonKey(text)) {
      throw new OAuthHttpError(400, 'invalid_request', 'The request body is invalid.');
    }
    return parsed;
  } catch {
    throw new OAuthHttpError(400, 'invalid_request', 'The request body is invalid.');
  }
}

function hasDuplicateTopLevelJsonKey(text: string): boolean {
  const keys = new Set<string>();
  let objectDepth = 0;
  let arrayDepth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '{') {
      objectDepth += 1;
      continue;
    }
    if (character === '}') {
      objectDepth -= 1;
      continue;
    }
    if (character === '[') {
      arrayDepth += 1;
      continue;
    }
    if (character === ']') {
      arrayDepth -= 1;
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
    if (objectDepth !== 1 || arrayDepth !== 0) continue;
    let cursor = index + 1;
    while (/\s/u.test(text[cursor] ?? '')) cursor += 1;
    if (text[cursor] !== ':') continue;
    const key = JSON.parse(text.slice(start, index + 1)) as string;
    if (keys.has(key)) return true;
    keys.add(key);
  }
  return false;
}

async function readMcpJson(request: IncomingMessage): Promise<unknown> {
  let contentType: string | null;
  try {
    contentType = singleHeader(request, 'content-type');
  } catch {
    throw headerMismatch();
  }
  if (contentType === null || !/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)) {
    throw new McpHttpError(400, -32600, 'Invalid Request');
  }
  let body: Buffer;
  try {
    body = await readBody(request, 64 * 1_024);
  } catch (error) {
    if (error instanceof OAuthHttpError && error.status === 413) {
      throw new McpHttpError(413, -32600, 'Invalid Request');
    }
    throw new McpHttpError(400, -32600, 'Invalid Request');
  }
  if (body.byteLength === 0) throw new McpHttpError(400, -32700, 'Parse error');
  const text = strictUtf8(body);
  if (text === null) throw new McpHttpError(400, -32700, 'Parse error');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new McpHttpError(400, -32700, 'Parse error');
  }
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const contentType = singleHeaderForOAuth(request, 'content-type');
  if (contentType === null
    || !/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/iu.test(contentType)) {
    throw new OAuthHttpError(400, 'invalid_request', 'The request media type is invalid.');
  }
  const body = await readBody(request, 8 * 1_024);
  if (body.byteLength === 0) throw invalidOAuthRequest();
  const text = strictUtf8(body);
  if (text === null) throw invalidOAuthRequest();
  return new URLSearchParams(text);
}

function exactForm(form: URLSearchParams, allowed: readonly string[], required: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of form.keys()) {
    if (!allowed.includes(key) || seen.has(key)) throw invalidOAuthRequest();
    seen.add(key);
  }
  if (required.some((key) => !seen.has(key))) throw invalidOAuthRequest();
}

function singleHeaderForOAuth(request: IncomingMessage, name: string): string | null {
  const values = requestHeaderValues(request, name);
  if (values.length > 1) throw invalidOAuthRequest();
  return values[0] ?? null;
}

function bearer(request: IncomingMessage): string {
  let value: string | null;
  try {
    value = singleHeader(request, 'authorization');
  } catch {
    throw oauthAuthenticationRequired();
  }
  if (value === null || !value.startsWith('Bearer ')) throw oauthAuthenticationRequired();
  const token = value.slice('Bearer '.length).trim();
  if (!/^olm_at_[A-Za-z0-9_-]{43}$/u.test(token)) throw oauthAuthenticationRequired();
  return token;
}

function firebaseBearer(request: IncomingMessage): string {
  const value = singleHeaderForOAuth(request, 'authorization');
  if (value === null || !value.startsWith('Bearer ')) throw new OAuthHttpError(
    401, 'authentication_required', 'A verified Google session is required.',
  );
  const token = value.slice('Bearer '.length).trim();
  if (token.length < 20 || token.length > 8_192 || /\s/u.test(token)) throw new OAuthHttpError(
    401, 'authentication_required', 'A verified Google session is required.',
  );
  return token;
}

const httpToken = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

function splitHttpHeader(value: string, delimiter: ',' | ';'): string[] | null {
  const values: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    const code = character.charCodeAt(0);
    if ((code < 0x20 && character !== '\t') || code === 0x7f) return null;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && character === '\\') {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && character === delimiter) {
      values.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  if (quoted || escaped) return null;
  values.push(value.slice(start).trim());
  return values;
}

function validQuotedHeaderValue(value: string): boolean {
  if (value.length < 2 || value[0] !== '"' || value.at(-1) !== '"') return false;
  for (let index = 1; index < value.length - 1; index += 1) {
    const character = value[index] ?? '';
    const code = character.charCodeAt(0);
    if (character === '"' || code === 0x7f || (code < 0x20 && character !== '\t')) return false;
    if (character === '\\') {
      index += 1;
      if (index >= value.length - 1) return false;
      const escapedCode = (value[index] ?? '').charCodeAt(0);
      if (escapedCode === 0x7f || (escapedCode < 0x20 && escapedCode !== 0x09)) return false;
    }
  }
  return true;
}

function decodedHeaderParameter(value: string): string | null {
  if (httpToken.test(value)) return value;
  if (!validQuotedHeaderValue(value)) return null;
  return value.slice(1, -1).replace(/\\([\t\x20-\x7E])/gu, '$1');
}

function acceptsMcp(request: IncomingMessage): boolean {
  let value: string | null;
  try {
    value = singleHeader(request, 'accept');
  } catch {
    return false;
  }
  if (value === null) return false;
  const items = splitHttpHeader(value, ',');
  if (items === null || items.some((item) => item === '')) return false;
  const supported = new Set<string>();
  for (const item of items) {
    const parts = splitHttpHeader(item, ';');
    if (parts === null || parts.some((part) => part === '')) return false;
    const [rawMedia, ...parameters] = parts;
    const media = (rawMedia ?? '').trim().toLowerCase();
    const [type, subtype, ...extraMediaParts] = media.split('/');
    if (type === undefined || subtype === undefined || extraMediaParts.length !== 0
      || !httpToken.test(type) || !httpToken.test(subtype)
      || (type === '*' && subtype !== '*')) return false;
    let quality = 1;
    let qualitySeen = false;
    let representationMatches = true;
    const parameterNames = new Set<string>();
    for (const rawParameter of parameters) {
      const parameter = rawParameter.trim();
      const equalsAt = parameter.indexOf('=');
      if (equalsAt < 1) return false;
      const name = parameter.slice(0, equalsAt);
      const rawParameterValue = parameter.slice(equalsAt + 1);
      if (!httpToken.test(name) || rawParameterValue === '') return false;
      const normalizedName = name.toLowerCase();
      if (parameterNames.has(normalizedName)) return false;
      parameterNames.add(normalizedName);
      if (normalizedName === 'q') {
        if (qualitySeen || !/^(?:0(?:\.[0-9]{0,3})?|1(?:\.0{0,3})?)$/u.test(rawParameterValue)) {
          return false;
        }
        qualitySeen = true;
        quality = Number(rawParameterValue);
        continue;
      }
      if (qualitySeen) return false;
      const decoded = decodedHeaderParameter(rawParameterValue);
      if (decoded === null) return false;
      if (normalizedName !== 'charset' || decoded.toLowerCase() !== 'utf-8') {
        representationMatches = false;
      }
    }
    if (quality !== 0 && representationMatches) supported.add(media);
  }
  return supported.has('application/json') && supported.has('text/event-stream');
}

function parseRpcRequest(value: unknown): JsonRpcRequest {
  const body = exactObject(value, ['jsonrpc', 'id', 'method', 'params'], ['jsonrpc', 'id', 'method', 'params']);
  if (body.jsonrpc !== '2.0'
    || (typeof body.id !== 'string' && typeof body.id !== 'number')
    || (typeof body.id === 'number' && !Number.isSafeInteger(body.id))
    || (body.method !== 'server/discover' && body.method !== 'tools/list' && body.method !== 'tools/call')) {
    if (typeof body.method === 'string') throw methodNotFound();
    throw new McpHttpError(400, -32600, 'Invalid Request');
  }
  const params = record(body.params);
  if (params === null) throw invalidParams();
  return body as unknown as JsonRpcRequest;
}

function validMetaKey(value: string): boolean {
  const label = '[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?';
  const prefix = `(?:${label}\\.)*${label}/`;
  const name = '[A-Za-z0-9](?:[A-Za-z0-9_.-]*[A-Za-z0-9])?';
  return value === '' || new RegExp(`^(?:${prefix})?${name}$`, 'u').test(value);
}

function metadataString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum
    && !/[\u0000-\u001F\u007F]/u.test(value);
}

function metadataUri(value: unknown): value is string {
  if (!metadataString(value, 1, 8_192)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol !== '';
  } catch {
    return false;
  }
}

function validClientIcon(value: unknown): boolean {
  const icon = record(value);
  if (icon === null || !metadataUri(icon.src)) return false;
  if (icon.mimeType !== undefined && !metadataString(icon.mimeType, 1, 128)) return false;
  if (icon.sizes !== undefined && (!Array.isArray(icon.sizes)
    || icon.sizes.length > 32
    || !icon.sizes.every((size) => metadataString(size, 1, 64)))) return false;
  return icon.theme === undefined || icon.theme === 'light' || icon.theme === 'dark';
}

function validClientInfo(value: unknown): boolean {
  const info = record(value);
  if (info === null
    || !metadataString(info.name, 1, 128)
    || !metadataString(info.version, 1, 64)
    || (info.title !== undefined && !metadataString(info.title, 1, 256))
    || (info.description !== undefined && !metadataString(info.description, 0, 2_048))
    || (info.websiteUrl !== undefined && !metadataUri(info.websiteUrl))
    || (info.icons !== undefined && (!Array.isArray(info.icons)
      || info.icons.length > 16 || !info.icons.every(validClientIcon)))) return false;
  return true;
}

function objectValues(value: unknown): boolean {
  const candidate = record(value);
  return candidate !== null && Object.values(candidate).every((item) => record(item) !== null);
}

function validClientCapabilities(value: unknown): boolean {
  const capabilities = record(value);
  if (capabilities === null) return false;
  if (capabilities.experimental !== undefined && !objectValues(capabilities.experimental)) return false;
  if (capabilities.roots !== undefined && record(capabilities.roots) === null) return false;
  const sampling = capabilities.sampling === undefined ? null : record(capabilities.sampling);
  if (capabilities.sampling !== undefined && (sampling === null
    || (sampling.context !== undefined && record(sampling.context) === null)
    || (sampling.tools !== undefined && record(sampling.tools) === null))) return false;
  const elicitation = capabilities.elicitation === undefined ? null : record(capabilities.elicitation);
  if (capabilities.elicitation !== undefined && (elicitation === null
    || (elicitation.form !== undefined && record(elicitation.form) === null)
    || (elicitation.url !== undefined && record(elicitation.url) === null))) return false;
  if (capabilities.extensions !== undefined) {
    const extensions = record(capabilities.extensions);
    if (extensions === null || Object.entries(extensions).some(([key, item]) => (
      !key.includes('/') || !validMetaKey(key) || record(item) === null
    ))) return false;
  }
  return true;
}

function validateMeta(params: Record<string, unknown>): void {
  const meta = record(params._meta);
  if (meta === null) throw invalidParams();
  const protocolVersion = meta['io.modelcontextprotocol/protocolVersion'];
  const rawClientInfo = meta['io.modelcontextprotocol/clientInfo'];
  const logLevel = meta['io.modelcontextprotocol/logLevel'];
  const progressToken = meta.progressToken;
  if (typeof protocolVersion !== 'string' || protocolVersion.length < 1 || protocolVersion.length > 32
    || Object.keys(meta).some((key) => !validMetaKey(key))
    || !validClientCapabilities(meta['io.modelcontextprotocol/clientCapabilities'])
    || (rawClientInfo !== undefined && !validClientInfo(rawClientInfo))
    || (logLevel !== undefined && ![
      'debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency',
    ].includes(String(logLevel)))
    || (progressToken !== undefined
      && typeof progressToken !== 'string'
      && (!Number.isSafeInteger(progressToken)))) throw invalidParams();
}

function validateMirroredHeaders(request: IncomingMessage, rpc: JsonRpcRequest): void {
  let version: string | null;
  let method: string | null;
  try {
    version = singleHeader(request, 'mcp-protocol-version');
    method = singleHeader(request, 'mcp-method');
  } catch {
    throw headerMismatch();
  }
  const bodyVersion = record(rpc.params._meta)?.['io.modelcontextprotocol/protocolVersion'];
  if (version === null || version !== bodyVersion) throw headerMismatch();
  if (version !== mcpProtocolVersion) {
    throw new McpHttpError(400, -32022, 'Unsupported protocol version', {
      supported: [mcpProtocolVersion],
      requested: version,
    });
  }
  if (method !== rpc.method) throw headerMismatch();
  const name = decodedMirroredHeader(request, 'mcp-name');
  if (rpc.method === 'tools/call') {
    if (name === null || name !== rpc.params.name) throw headerMismatch();
  } else if (name !== null) {
    throw headerMismatch();
  }
}

function validateStandardHeaders(
  request: IncomingMessage,
  method: string,
  initialize = false,
): void {
  let version: string | null;
  let mirroredMethod: string | null;
  try {
    version = singleHeader(request, 'mcp-protocol-version');
    mirroredMethod = singleHeader(request, 'mcp-method');
  } catch {
    throw headerMismatch();
  }
  if ((!initialize && version !== mcpStandardProtocolVersion)
    || (initialize && version !== null && version !== mcpStandardProtocolVersion)
    || (mirroredMethod !== null && mirroredMethod !== method)) {
    throw new McpHttpError(400, -32022, 'Unsupported protocol version', {
      supported: [mcpStandardProtocolVersion],
      requested: version,
    });
  }
}

function validateWorkspaceMirror(
  request: IncomingMessage,
  argumentsValue: Record<string, unknown>,
): void {
  const expected = workspaceIdFrom(argumentsValue);
  const mirrored = decodedMirroredHeader(request, 'mcp-param-workspace-id');
  if (mirrored !== expected) throw headerMismatch();
}

function rpcErrorBody(id: JsonRpcId | null, error: McpHttpError): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: error.rpcCode,
      message: error.rpcMessage,
      ...(error.rpcData === undefined ? {} : {data: error.rpcData}),
    },
  };
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
    'x-openlinear-request-id': correlationId,
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

function writeMetadata(
  response: ServerResponse,
  body: unknown,
  correlationId: string,
): void {
  response.writeHead(200, {
    'cache-control': 'public, max-age=3600',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-openlinear-request-id': correlationId,
  });
  response.end(JSON.stringify(body));
}

function writeOAuthError(response: ServerResponse, error: OAuthHttpError, correlationId: string): void {
  writeJson(response, error.status, {
    error: error.oauthCode,
    error_description: error.description,
  }, correlationId);
}

function methodNotAllowed(response: ServerResponse, correlationId: string, allow: string): void {
  writeJson(response, 405, {
    error: {code: 'METHOD_NOT_ALLOWED', message: 'The request method is unavailable.', correlationId},
  }, correlationId, {allow});
}

function oauthAuthenticationRequired(): McpHttpError {
  return new McpHttpError(401, -32001, 'Authentication required');
}

function oauthInsufficientScope(scope: McpOAuthScope): McpHttpError {
  return new McpHttpError(
    403,
    -32003,
    'Insufficient scope',
    {requiredScope: scope},
    scope,
  );
}

function oauthWorkspaceDenied(): McpHttpError {
  return new McpHttpError(403, -32003, 'Access denied');
}

function headerMismatch(): McpHttpError {
  return new McpHttpError(400, -32020, 'Header mismatch');
}

function methodNotFound(): McpHttpError {
  return new McpHttpError(404, -32601, 'Method not found');
}

function invalidParams(): McpHttpError {
  return new McpHttpError(400, -32602, 'Invalid params');
}

function invalidOAuthRequest(): OAuthHttpError {
  return new OAuthHttpError(400, 'invalid_request', 'The OAuth request is invalid.');
}

function knownToolError(error: unknown): {code: string; message: string} {
  if (error instanceof ProjectManagementServiceError) return {
    code: error.code,
    message: error.code === 'PM_CONFLICT'
      ? 'The entity changed or this retry key has a different request.'
      : error.code === 'PM_NOT_FOUND'
        ? 'The requested product-management entity was not found.'
        : error.code === 'PM_ENTITLEMENT_REQUIRED'
          ? 'This write requires an active Pro entitlement.'
          : error.code === 'PM_FORBIDDEN'
            ? 'This product-management operation is not permitted.'
            : error.code === 'PM_SERVICE_UNAVAILABLE'
              ? 'The product-management service is temporarily unavailable.'
              : 'The product-management request is invalid.',
  };
  if (error instanceof CollaborationServiceError) return {
    code: error.code,
    message: error.code === 'COLLABORATION_CONFLICT'
      ? 'The entity changed or this retry key has a different request.'
      : error.code === 'COLLABORATION_NOT_FOUND'
        ? 'The requested collaboration entity was not found.'
        : error.code === 'ASSIGNEE_UNAVAILABLE'
          ? 'The selected assignee is unavailable.'
          : error.code === 'COLLABORATION_ENTITLEMENT_REQUIRED'
            ? 'This write requires an active Pro entitlement.'
            : error.code === 'COLLABORATION_FORBIDDEN'
              ? 'This collaboration operation is not permitted.'
              : error.code === 'COLLABORATION_SERVICE_UNAVAILABLE'
                ? 'The collaboration service is temporarily unavailable.'
                : 'The collaboration request is invalid.',
  };
  if (error instanceof InvitationServiceError) return {
    code: error.code,
    message: error.code === 'INVITATION_CONFLICT'
      ? 'The invitation changed or this retry key has a different request.'
      : error.code === 'INVITATION_NOT_FOUND'
        ? 'The requested invitation was not found.'
        : error.code === 'INVITATION_ENTITLEMENT_REQUIRED'
          ? 'This invitation write requires an active Pro entitlement.'
          : error.code === 'INVITATION_SERVICE_UNAVAILABLE'
            ? 'The invitation service is temporarily unavailable.'
            : 'The invitation request cannot be completed.',
  };
  if (error instanceof BillingServiceError) return {
    code: error.code,
    message: error.code === 'BILLING_FORBIDDEN'
      ? 'This billing or membership operation is not permitted.'
      : error.code === 'BILLING_UNAVAILABLE'
        ? 'Billing is temporarily unavailable.'
        : error.code === 'BILLING_CONFLICT'
          ? 'Billing or membership state changed; refresh before retrying.'
          : 'The billing request is invalid.',
  };
  if (error instanceof WorkspaceAuthorizationError) return {
    code: error.code,
    message: error.code === 'WORKSPACE_ACCESS_DENIED'
      ? 'The workspace operation is not permitted.'
      : 'Workspace authorization is temporarily unavailable.',
  };
  return {code: 'MCP_TOOL_UNAVAILABLE', message: 'The tool is temporarily unavailable.'};
}

function toolSuccess(value: unknown): Record<string, unknown> {
  const structuredContent = {data: value};
  return {
    resultType: 'complete',
    content: [{type: 'text', text: JSON.stringify(structuredContent)}],
    structuredContent,
    isError: false,
    _meta: {'io.modelcontextprotocol/serverInfo': {name: mcpServerName, version: mcpServerVersion}},
  };
}

function toolFailure(error: unknown): Record<string, unknown> {
  const safe = knownToolError(error);
  const structuredContent = {data: {error: safe}};
  return {
    resultType: 'complete',
    content: [{type: 'text', text: JSON.stringify(structuredContent)}],
    structuredContent,
    isError: true,
    _meta: {'io.modelcontextprotocol/serverInfo': {name: mcpServerName, version: mcpServerVersion}},
  };
}

function defineTool(
  scope: McpOAuthScope,
  name: string,
  title: string,
  description: string,
  schema: Record<string, unknown>,
  behavior: {readOnly: boolean; destructive?: boolean; idempotent?: boolean},
  execute: ToolDefinition['execute'],
): ToolDefinition {
  return {
    name,
    title,
    description,
    scope,
    inputSchema: schema,
    outputSchema,
    annotations: {
      title,
      readOnlyHint: behavior.readOnly,
      destructiveHint: behavior.destructive ?? false,
      idempotentHint: behavior.idempotent ?? behavior.readOnly,
      openWorldHint: false,
    },
    execute,
  };
}

function publicTool(tool: ToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    annotations: tool.annotations,
  };
}

function publicStandardTool(tool: ToolDefinition): Record<string, unknown> {
  const inputSchema = structuredClone(tool.inputSchema);
  const properties = record(inputSchema.properties);
  if (properties === null) throw new Error('The MCP tool input schema is invalid.');
  delete properties.workspaceId;
  if (Array.isArray(inputSchema.required)) {
    inputSchema.required = inputSchema.required.filter((name) => name !== 'workspaceId');
  }
  return {...publicTool(tool), inputSchema};
}

function createTools(options: McpHttpHandlerOptions): ToolDefinition[] {
  const base = (grant: McpAccessGrant, args: Record<string, unknown>, correlationId: string) => ({
    principal: grant.principal,
    workspaceId: workspaceIdFrom(args),
    requestId: correlationId,
  });
  const mutation = (grant: McpAccessGrant, args: Record<string, unknown>, correlationId: string) => ({
    ...base(grant, args, correlationId),
    idempotencyKey: requiredString(args.idempotencyKey, 16, 160),
  });
  const tools: ToolDefinition[] = [
    defineTool('workspace:read', 'workspace.get', 'Get workspace', 'Read the explicit workspace.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.projectManagementService.getWorkspace(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('projects:read', 'project.list', 'List projects', 'List projects in deterministic identifier order.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.projectManagementService.listProjects(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('projects:read', 'project.get', 'Get project', 'Read one project by identifier.',
      objectSchema({projectId: identifier(projectPattern)}, ['projectId']), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'projectId'], ['workspaceId', 'projectId']);
        return options.projectManagementService.getProject({
          ...base(grant, value, requestId), projectId: requiredString(value.projectId, 3, 128, /^project_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('projects:write', 'project.create', 'Create project', 'Create one planned product project with an idempotent retry key.',
      objectSchema({
        name: stringSchema(1, 120), summary: stringSchema(0, 280),
        status: {type: 'string', enum: hostedProjectStatuses}, idempotencyKey: idempotencyProperty,
      }, ['name', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'name', 'summary', 'status', 'idempotencyKey'], ['workspaceId', 'name', 'idempotencyKey']);
        const status = value.status;
        if (status !== undefined && !hostedProjectStatuses.includes(status as never)) throw invalidParams();
        return options.projectManagementService.createProject({
          ...mutation(grant, value, requestId),
          name: requiredString(value.name, 1, 120),
          ...(value.summary === undefined ? {} : {summary: requiredString(value.summary, 0, 280)}),
          ...(status === undefined ? {} : {status: status as (typeof hostedProjectStatuses)[number]}),
        });
      }),
    defineTool('projects:write', 'project.update', 'Update project', 'Update project fields with revision and idempotency protection.',
      objectSchema({
        projectId: identifier(projectPattern), expectedRevision: revisionProperty,
        name: stringSchema(1, 120), summary: stringSchema(0, 280),
        status: {type: 'string', enum: hostedProjectStatuses}, idempotencyKey: idempotencyProperty,
      }, ['projectId', 'expectedRevision', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'projectId', 'expectedRevision', 'name', 'summary', 'status', 'idempotencyKey'], ['workspaceId', 'projectId', 'expectedRevision', 'idempotencyKey']);
        const patch: {name?: string; summary?: string; status?: (typeof hostedProjectStatuses)[number]} = {};
        if (value.name !== undefined) patch.name = requiredString(value.name, 1, 120);
        if (value.summary !== undefined) patch.summary = requiredString(value.summary, 0, 280);
        if (value.status !== undefined) {
          if (!hostedProjectStatuses.includes(value.status as never)) throw invalidParams();
          patch.status = value.status as (typeof hostedProjectStatuses)[number];
        }
        if (Object.keys(patch).length === 0) throw invalidParams();
        return options.projectManagementService.updateProject({
          ...mutation(grant, value, requestId),
          projectId: requiredString(value.projectId, 3, 128, /^project_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision), patch,
        });
      }),
    defineTool('milestones:read', 'milestone.list', 'List milestones', 'List all milestones or those for one project.',
      objectSchema({projectId: identifier(projectPattern)}, []), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'projectId'], ['workspaceId']);
        return options.projectManagementService.listMilestones({
          ...base(grant, value, requestId),
          ...(value.projectId === undefined ? {} : {projectId: requiredString(value.projectId, 3, 128, /^project_[a-f0-9]{32}$/u)}),
        });
      }),
    defineTool('milestones:read', 'milestone.get', 'Get milestone', 'Read one milestone by identifier.',
      objectSchema({milestoneId: identifier(milestonePattern)}, ['milestoneId']), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'milestoneId'], ['workspaceId', 'milestoneId']);
        return options.projectManagementService.getMilestone({
          ...base(grant, value, requestId), milestoneId: requiredString(value.milestoneId, 3, 128, /^milestone_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('milestones:write', 'milestone.create', 'Create milestone', 'Create a milestone under one project with an idempotent retry key.',
      objectSchema({
        projectId: identifier(projectPattern), name: stringSchema(1, 120),
        description: stringSchema(0, 4_000), targetDate: {anyOf: [stringSchema(10, 10, {format: 'date'}), {type: 'null'}]},
        idempotencyKey: idempotencyProperty,
      }, ['projectId', 'name', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'projectId', 'name', 'description', 'targetDate', 'idempotencyKey'], ['workspaceId', 'projectId', 'name', 'idempotencyKey']);
        if (value.targetDate !== undefined && value.targetDate !== null) requiredString(value.targetDate, 10, 10, /^\d{4}-\d{2}-\d{2}$/u);
        return options.projectManagementService.createMilestone({
          ...mutation(grant, value, requestId),
          projectId: requiredString(value.projectId, 3, 128, /^project_[a-f0-9]{32}$/u),
          name: requiredString(value.name, 1, 120),
          ...(value.description === undefined ? {} : {description: requiredString(value.description, 0, 4_000)}),
          ...(value.targetDate === undefined ? {} : {targetDate: value.targetDate as string | null}),
        });
      }),
    defineTool('milestones:write', 'milestone.update', 'Update milestone', 'Update milestone fields with revision and idempotency protection.',
      objectSchema({
        milestoneId: identifier(milestonePattern), expectedRevision: revisionProperty,
        name: stringSchema(1, 120), description: stringSchema(0, 4_000),
        targetDate: {anyOf: [stringSchema(10, 10, {format: 'date'}), {type: 'null'}]},
        idempotencyKey: idempotencyProperty,
      }, ['milestoneId', 'expectedRevision', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'milestoneId', 'expectedRevision', 'name', 'description', 'targetDate', 'idempotencyKey'], ['workspaceId', 'milestoneId', 'expectedRevision', 'idempotencyKey']);
        const patch: {name?: string; description?: string; targetDate?: string | null} = {};
        if (value.name !== undefined) patch.name = requiredString(value.name, 1, 120);
        if (value.description !== undefined) patch.description = requiredString(value.description, 0, 4_000);
        if (value.targetDate !== undefined) {
          if (value.targetDate !== null) requiredString(value.targetDate, 10, 10, /^\d{4}-\d{2}-\d{2}$/u);
          patch.targetDate = value.targetDate as string | null;
        }
        if (Object.keys(patch).length === 0) throw invalidParams();
        return options.projectManagementService.updateMilestone({
          ...mutation(grant, value, requestId),
          milestoneId: requiredString(value.milestoneId, 3, 128, /^milestone_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision), patch,
        });
      }),
    defineTool('issues:read', 'issue.list', 'List issues', 'List workspace issues in stable updated order.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.collaborationService.listIssues(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('issues:read', 'issue.get', 'Get issue', 'Read one issue by identifier.',
      objectSchema({issueId: identifier(issuePattern)}, ['issueId']), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId'], ['workspaceId', 'issueId']);
        return options.collaborationService.getIssue({
          ...base(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('issues:write', 'issue.create', 'Create issue', 'Create one product-management issue with an idempotent retry key.',
      objectSchema({
        title: stringSchema(1, 200), description: stringSchema(0, 10_000),
        projectId: nullableReference(projectPattern), milestoneId: nullableReference(milestonePattern),
        parentIssueId: nullableReference(issuePattern), resources: issueResourcesSchema,
        idempotencyKey: idempotencyProperty,
      }, ['title', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, [
          'workspaceId', 'title', 'description', 'projectId', 'milestoneId', 'parentIssueId', 'resources', 'idempotencyKey',
        ], ['workspaceId', 'title', 'idempotencyKey']);
        return options.collaborationService.createIssue({
          ...mutation(grant, value, requestId), title: requiredString(value.title, 1, 200),
          ...(value.description === undefined ? {} : {description: requiredString(value.description, 0, 10_000)}),
          ...(value.projectId === undefined ? {} : {projectId: nullableString(value.projectId, /^project_[a-f0-9]{32}$/u)}),
          ...(value.milestoneId === undefined ? {} : {milestoneId: nullableString(value.milestoneId, /^milestone_[a-f0-9]{32}$/u)}),
          ...(value.parentIssueId === undefined ? {} : {parentIssueId: nullableString(value.parentIssueId, /^issue_[a-f0-9]{32}$/u)}),
          ...(value.resources === undefined ? {} : {resources: value.resources as Array<{label: string; url: string}>}),
        });
      }),
    defineTool('issues:write', 'issue.update', 'Update issue', 'Update issue fields with revision and idempotency protection.',
      objectSchema({
        issueId: identifier(issuePattern), expectedRevision: revisionProperty, title: stringSchema(1, 200),
        description: stringSchema(0, 10_000),
        status: {type: 'string', enum: collaborationIssueStatuses},
        priority: {type: 'string', enum: collaborationIssuePriorities},
        projectId: nullableReference(projectPattern), milestoneId: nullableReference(milestonePattern),
        parentIssueId: nullableReference(issuePattern), resources: issueResourcesSchema,
        idempotencyKey: idempotencyProperty,
      }, ['issueId', 'expectedRevision', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, [
          'workspaceId', 'issueId', 'expectedRevision', 'title', 'description', 'status', 'priority', 'projectId',
          'milestoneId', 'parentIssueId', 'resources', 'idempotencyKey',
        ], ['workspaceId', 'issueId', 'expectedRevision', 'idempotencyKey']);
        const patch: {
          title?: string; description?: string; status?: (typeof collaborationIssueStatuses)[number];
          priority?: (typeof collaborationIssuePriorities)[number]; projectId?: string | null;
          milestoneId?: string | null; parentIssueId?: string | null; resources?: Array<{label: string; url: string}>;
        } = {};
        if (value.title !== undefined) patch.title = requiredString(value.title, 1, 200);
        if (value.description !== undefined) patch.description = requiredString(value.description, 0, 10_000);
        if (value.status !== undefined) {
          if (!collaborationIssueStatuses.includes(value.status as never)) throw invalidParams();
          patch.status = value.status as (typeof collaborationIssueStatuses)[number];
        }
        if (value.priority !== undefined) {
          if (!collaborationIssuePriorities.includes(value.priority as never)) throw invalidParams();
          patch.priority = value.priority as (typeof collaborationIssuePriorities)[number];
        }
        if (value.projectId !== undefined) patch.projectId = nullableString(value.projectId, /^project_[a-f0-9]{32}$/u);
        if (value.milestoneId !== undefined) patch.milestoneId = nullableString(value.milestoneId, /^milestone_[a-f0-9]{32}$/u);
        if (value.parentIssueId !== undefined) patch.parentIssueId = nullableString(value.parentIssueId, /^issue_[a-f0-9]{32}$/u);
        if (value.resources !== undefined) patch.resources = value.resources as Array<{label: string; url: string}>;
        if (Object.keys(patch).length === 0) throw invalidParams();
        return options.collaborationService.updateIssue({
          ...mutation(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision), patch,
        });
      }),
    defineTool('issues:write', 'issue.assign', 'Assign issue', 'Assign or unassign one active member. Owner only; revision and retry protected.',
      objectSchema({
        issueId: identifier(issuePattern), expectedRevision: revisionProperty,
        assigneeUserId: {anyOf: [stringSchema(3, 128), {type: 'null'}]}, idempotencyKey: idempotencyProperty,
      }, ['issueId', 'expectedRevision', 'assigneeUserId', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId', 'expectedRevision', 'assigneeUserId', 'idempotencyKey'], ['workspaceId', 'issueId', 'expectedRevision', 'assigneeUserId', 'idempotencyKey']);
        return options.collaborationService.assignIssue({
          ...mutation(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision),
          assigneeUserId: value.assigneeUserId === null ? null : requiredString(value.assigneeUserId, 3, 128),
        });
      }),
    defineTool('comments:read', 'comment.list', 'List comments', 'List durable comments for one issue.',
      objectSchema({issueId: identifier(issuePattern)}, ['issueId']), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId'], ['workspaceId', 'issueId']);
        return options.collaborationService.listComments({
          ...base(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('comments:read', 'comment.get', 'Get comment', 'Read one comment by issue and comment identifier.',
      objectSchema({issueId: identifier(issuePattern), commentId: identifier(commentPattern)}, ['issueId', 'commentId']), {readOnly: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId', 'commentId'], ['workspaceId', 'issueId', 'commentId']);
        return options.collaborationService.getComment({
          ...base(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          commentId: requiredString(value.commentId, 3, 128, /^comment_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('comments:write', 'comment.create', 'Create comment', 'Create a durable issue comment with an idempotent retry key.',
      objectSchema({issueId: identifier(issuePattern), body: stringSchema(1, 8_000), idempotencyKey: idempotencyProperty}, ['issueId', 'body', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId', 'body', 'idempotencyKey'], ['workspaceId', 'issueId', 'body', 'idempotencyKey']);
        return options.collaborationService.createComment({
          ...mutation(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          body: requiredString(value.body, 1, 8_000),
        });
      }),
    defineTool('comments:write', 'comment.update', 'Update comment', 'Edit a comment with revision and idempotency protection.',
      objectSchema({
        issueId: identifier(issuePattern), commentId: identifier(commentPattern), expectedRevision: revisionProperty,
        body: stringSchema(1, 8_000), idempotencyKey: idempotencyProperty,
      }, ['issueId', 'commentId', 'expectedRevision', 'body', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId', 'commentId', 'expectedRevision', 'body', 'idempotencyKey'], ['workspaceId', 'issueId', 'commentId', 'expectedRevision', 'body', 'idempotencyKey']);
        return options.collaborationService.editComment({
          ...mutation(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          commentId: requiredString(value.commentId, 3, 128, /^comment_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision), body: requiredString(value.body, 1, 8_000),
        });
      }),
    defineTool('comments:write', 'comment.delete', 'Delete comment', 'Soft-delete a comment. Confirm before calling; revision and retry protected.',
      objectSchema({
        issueId: identifier(issuePattern), commentId: identifier(commentPattern), expectedRevision: revisionProperty,
        idempotencyKey: idempotencyProperty,
      }, ['issueId', 'commentId', 'expectedRevision', 'idempotencyKey']), {readOnly: false, destructive: true, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'issueId', 'commentId', 'expectedRevision', 'idempotencyKey'], ['workspaceId', 'issueId', 'commentId', 'expectedRevision', 'idempotencyKey']);
        return options.collaborationService.deleteComment({
          ...mutation(grant, value, requestId), issueId: requiredString(value.issueId, 3, 128, /^issue_[a-f0-9]{32}$/u),
          commentId: requiredString(value.commentId, 3, 128, /^comment_[a-f0-9]{32}$/u),
          expectedRevision: requiredRevision(value.expectedRevision),
        });
      }),
    defineTool('members:read', 'member.list', 'List members', 'List active owner/member records without private identity data.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.collaborationService.listMembers(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('members:write', 'member.remove', 'Remove member', 'Remove a member and reconcile seats. Owner only; confirm before calling.',
      objectSchema({userId: stringSchema(3, 128), idempotencyKey: idempotencyProperty}, ['userId', 'idempotencyKey']), {readOnly: false, destructive: true, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'userId', 'idempotencyKey'], ['workspaceId', 'userId', 'idempotencyKey']);
        return options.billingService.removeMember({
          ...mutation(grant, value, requestId), userId: requiredString(value.userId, 3, 128),
        });
      }),
    defineTool('invitations:read', 'invitation.list', 'List invitations', 'List owner-visible invitation lifecycle records.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.invitationService.listOwnerInvitations(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('invitations:write', 'invitation.create', 'Create invitation', 'Create an email-bound invitation. The share token is returned only for this authorized response.',
      objectSchema({email: stringSchema(3, 320, {format: 'email'}), idempotencyKey: idempotencyProperty}, ['email', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'email', 'idempotencyKey'], ['workspaceId', 'email', 'idempotencyKey']);
        return options.invitationService.createOwnerInvitation({
          ...mutation(grant, value, requestId), invitedEmail: requiredString(value.email, 3, 320),
        });
      }),
    defineTool('invitations:write', 'invitation.resend', 'Resend invitation', 'Rotate and resend a pending invitation with an idempotent retry key.',
      objectSchema({invitationId: identifier(invitationPattern), idempotencyKey: idempotencyProperty}, ['invitationId', 'idempotencyKey']), {readOnly: false, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'invitationId', 'idempotencyKey'], ['workspaceId', 'invitationId', 'idempotencyKey']);
        return options.invitationService.resendOwnerInvitation({
          ...mutation(grant, value, requestId), invitationId: requiredString(value.invitationId, 3, 128, /^invite_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('invitations:write', 'invitation.revoke', 'Revoke invitation', 'Revoke a pending invitation. Owner only; confirm before calling.',
      objectSchema({invitationId: identifier(invitationPattern), idempotencyKey: idempotencyProperty}, ['invitationId', 'idempotencyKey']), {readOnly: false, destructive: true, idempotent: true}, async (grant, args, requestId) => {
        const value = exactObject(args, ['workspaceId', 'invitationId', 'idempotencyKey'], ['workspaceId', 'invitationId', 'idempotencyKey']);
        return options.invitationService.revokeOwnerInvitation({
          ...mutation(grant, value, requestId), invitationId: requiredString(value.invitationId, 3, 128, /^invite_[a-f0-9]{32}$/u),
        });
      }),
    defineTool('billing:read', 'billing.get', 'Get billing summary', 'Read entitlement, trial, seat, price, and subscription summary. This tool never purchases billing.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.billingService.summary(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
    defineTool('workspace:export', 'workspace.export', 'Export workspace', 'Read the canonical versioned export for exactly one owner workspace.',
      objectSchema({}, []), {readOnly: true}, async (grant, args, requestId) => (
        options.projectManagementService.exportWorkspace(base(grant, exactObject(args, ['workspaceId'], ['workspaceId']), requestId))
      )),
  ];
  return tools.sort((left, right) => left.name.localeCompare(right.name));
}

function mapOAuthServiceError(error: McpOAuthServiceError): OAuthHttpError {
  switch (error.code) {
    case 'OAUTH_CLIENT_NOT_FOUND':
      return new OAuthHttpError(400, 'invalid_client', 'The OAuth client is unavailable.');
    case 'OAUTH_ACCESS_DENIED':
    case 'OAUTH_SCOPE_DENIED':
      return new OAuthHttpError(403, 'access_denied', 'The requested OAuth access is unavailable.');
    case 'OAUTH_INVALID_GRANT':
      return new OAuthHttpError(400, 'invalid_grant', 'The OAuth grant is invalid or expired.');
    case 'OAUTH_INVALID_TOKEN':
      return new OAuthHttpError(401, 'invalid_token', 'The OAuth access token is invalid or expired.');
    case 'OAUTH_SERVICE_UNAVAILABLE':
      return new OAuthHttpError(503, 'temporarily_unavailable', 'The OAuth service is temporarily unavailable.');
    default:
      return invalidOAuthRequest();
  }
}

function oauthRegistrationBody(value: unknown): {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: 'none';
  grantTypes: string[];
  responseTypes: string[];
  scope?: string;
} {
  const body = exactObject(value, [
    'application_type', 'client_name', 'redirect_uris', 'token_endpoint_auth_method', 'grant_types',
    'response_types', 'scope',
  ], ['client_name', 'redirect_uris', 'token_endpoint_auth_method', 'grant_types', 'response_types']);
  if (typeof body.client_name !== 'string' || !Array.isArray(body.redirect_uris)
    || !body.redirect_uris.every((item) => typeof item === 'string')
    || (body.application_type !== undefined
      && body.application_type !== 'web' && body.application_type !== 'native')
    || body.token_endpoint_auth_method !== 'none' || !Array.isArray(body.grant_types)
    || !body.grant_types.every((item) => typeof item === 'string') || !Array.isArray(body.response_types)
    || !body.response_types.every((item) => typeof item === 'string')
    || (body.scope !== undefined && typeof body.scope !== 'string')) throw invalidOAuthRequest();
  return {
    clientName: body.client_name,
    redirectUris: body.redirect_uris,
    tokenEndpointAuthMethod: 'none',
    grantTypes: body.grant_types,
    responseTypes: body.response_types,
    ...(body.scope === undefined ? {} : {scope: body.scope}),
  };
}

async function handleOAuthRoute(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  correlationId: string,
  options: McpHttpHandlerOptions,
): Promise<boolean> {
  if (url.pathname === '/.well-known/oauth-protected-resource'
    || url.pathname === '/.well-known/oauth-protected-resource/mcp') {
    if (request.method !== 'GET') methodNotAllowed(response, correlationId, 'GET');
    else if (url.search !== '') writeOAuthError(response, invalidOAuthRequest(), correlationId);
    else writeMetadata(response, options.oauthService.protectedResourceMetadata(), correlationId);
    return true;
  }
  if (url.pathname === '/.well-known/oauth-authorization-server') {
    if (request.method !== 'GET') methodNotAllowed(response, correlationId, 'GET');
    else if (url.search !== '') writeOAuthError(response, invalidOAuthRequest(), correlationId);
    else writeMetadata(response, options.oauthService.authorizationServerMetadata(), correlationId);
    return true;
  }
  if (url.pathname === '/oauth/register') {
    if (request.method !== 'POST') methodNotAllowed(response, correlationId, 'POST');
    else {
      try {
        if (url.search !== '') throw invalidOAuthRequest();
        const result = await options.oauthService.registerClient(oauthRegistrationBody(await readJson(request, 8_192)));
        writeJson(response, 201, result, correlationId);
      } catch (error) {
        writeOAuthError(response, error instanceof McpOAuthServiceError ? mapOAuthServiceError(error)
          : error instanceof OAuthHttpError ? error : invalidOAuthRequest(), correlationId);
      }
    }
    return true;
  }
  if (url.pathname === '/oauth/authorize') {
    if (request.method !== 'GET') methodNotAllowed(response, correlationId, 'GET');
    else {
      try {
        exactQuery(url, [
          'response_type', 'client_id', 'redirect_uri', 'workspace_id', 'scope', 'state',
          'code_challenge', 'code_challenge_method', 'resource',
        ]);
        const authorizationInput = {
          responseType: url.searchParams.get('response_type') ?? '',
          clientId: url.searchParams.get('client_id') ?? '',
          redirectUri: url.searchParams.get('redirect_uri') ?? '',
          scope: url.searchParams.get('scope') ?? '',
          state: url.searchParams.get('state') ?? '',
          codeChallenge: url.searchParams.get('code_challenge') ?? '',
          codeChallengeMethod: url.searchParams.get('code_challenge_method') ?? '',
          resource: url.searchParams.get('resource') ?? '',
        };
        const location = url.searchParams.has('workspace_id')
          ? (await options.oauthService.startAuthorization({
            ...authorizationInput,
            workspaceId: url.searchParams.get('workspace_id') ?? '',
          })).consentUri
          : await options.oauthService.authorizationSelectionUri(authorizationInput);
        response.writeHead(302, {
          'cache-control': 'no-store', location,
          'x-content-type-options': 'nosniff', 'x-openlinear-request-id': correlationId,
        });
        response.end();
      } catch (error) {
        writeOAuthError(response, error instanceof McpOAuthServiceError ? mapOAuthServiceError(error)
          : error instanceof OAuthHttpError ? error : invalidOAuthRequest(), correlationId);
      }
    }
    return true;
  }
  const consentMatch = /^\/oauth\/consent\/(oauthreq_[a-f0-9]{32})$/u.exec(url.pathname);
  if (consentMatch !== null) {
    if (request.method !== 'GET' && request.method !== 'POST') {
      methodNotAllowed(response, correlationId, 'GET, POST');
      return true;
    }
    try {
      if (url.search !== '') throw invalidOAuthRequest();
      const decisionBody = request.method === 'POST'
        ? exactObject(await readJson(request, 1_024), ['decision'], ['decision'])
        : null;
      if (decisionBody !== null && decisionBody.decision !== 'approve' && decisionBody.decision !== 'deny') {
        throw invalidOAuthRequest();
      }
      const identity = await options.identityVerifier.verifyGoogleIdToken(firebaseBearer(request));
      if (request.method === 'GET') {
        const view = await options.oauthService.consentView(consentMatch[1] ?? '', identity, correlationId);
        writeJson(response, 200, {data: view}, correlationId);
      } else {
        const result = await options.oauthService.decideConsent({
          requestId: consentMatch[1] ?? '', identity,
          decision: decisionBody?.decision as 'approve' | 'deny', requestReference: correlationId,
        });
        writeJson(response, 200, {data: result}, correlationId);
      }
    } catch (error) {
      writeOAuthError(response, error instanceof McpOAuthServiceError ? mapOAuthServiceError(error)
        : error instanceof OAuthHttpError ? error
          : new OAuthHttpError(401, 'authentication_required', 'A verified Google session is required.'), correlationId);
    }
    return true;
  }
  if (url.pathname === '/oauth/token') {
    if (request.method !== 'POST') methodNotAllowed(response, correlationId, 'POST');
    else {
      try {
        if (url.search !== '') throw invalidOAuthRequest();
        const form = await readForm(request);
        const grantType = form.get('grant_type');
        let result;
        if (grantType === 'authorization_code') {
          exactForm(form, ['grant_type', 'code', 'client_id', 'redirect_uri', 'code_verifier', 'resource'],
            ['grant_type', 'code', 'client_id', 'redirect_uri', 'code_verifier', 'resource']);
          result = await options.oauthService.exchangeAuthorizationCode({
            code: form.get('code') ?? '', clientId: form.get('client_id') ?? '',
            redirectUri: form.get('redirect_uri') ?? '', codeVerifier: form.get('code_verifier') ?? '',
            resource: form.get('resource') ?? '',
          });
        } else if (grantType === 'refresh_token') {
          exactForm(form, ['grant_type', 'refresh_token', 'client_id', 'resource', 'scope'],
            ['grant_type', 'refresh_token', 'client_id']);
          result = await options.oauthService.refreshAccessToken({
            refreshToken: form.get('refresh_token') ?? '', clientId: form.get('client_id') ?? '',
            ...(form.has('resource') ? {resource: form.get('resource') ?? ''} : {}),
            ...(form.has('scope') ? {scope: form.get('scope') ?? ''} : {}),
          });
        } else {
          throw new OAuthHttpError(400, 'unsupported_grant_type', 'The OAuth grant type is unsupported.');
        }
        writeJson(response, 200, result, correlationId, {pragma: 'no-cache'});
      } catch (error) {
        writeOAuthError(response, error instanceof McpOAuthServiceError ? mapOAuthServiceError(error)
          : error instanceof OAuthHttpError ? error : invalidOAuthRequest(), correlationId);
      }
    }
    return true;
  }
  if (url.pathname === '/oauth/revoke') {
    if (request.method !== 'POST') methodNotAllowed(response, correlationId, 'POST');
    else {
      try {
        if (url.search !== '') throw invalidOAuthRequest();
        const form = await readForm(request);
        exactForm(form, ['token', 'client_id', 'token_type_hint'], ['token', 'client_id']);
        const hint = form.get('token_type_hint');
        if (hint !== null && hint !== 'access_token' && hint !== 'refresh_token') throw invalidOAuthRequest();
        await options.oauthService.revokeToken({token: form.get('token') ?? '', clientId: form.get('client_id') ?? ''});
        response.writeHead(200, {
          'cache-control': 'no-store', 'content-length': '0', 'x-content-type-options': 'nosniff',
          'x-openlinear-request-id': correlationId,
        });
        response.end();
      } catch (error) {
        writeOAuthError(response, error instanceof McpOAuthServiceError ? mapOAuthServiceError(error)
          : error instanceof OAuthHttpError ? error : invalidOAuthRequest(), correlationId);
      }
    }
    return true;
  }
  return false;
}

export function createMcpHttpHandler(options: McpHttpHandlerOptions): McpHttpHandler {
  const tools = createTools(options);
  if (tools.length !== mcpProductManagementToolNames.length
    || new Set(tools.map((tool) => tool.name)).size !== tools.length
    || JSON.stringify(tools.map((tool) => tool.name)) !== JSON.stringify(mcpProductManagementToolNames)) {
    throw new Error('The MCP product-management tool allowlist is invalid.');
  }
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  return async (request, response, correlationId, url) => {
    const handledOAuth = await handleOAuthRoute(request, response, url, correlationId, options);
    if (handledOAuth) return true;
    if (url.pathname !== '/mcp') return false;
    if (request.method !== 'POST') {
      methodNotAllowed(response, correlationId, 'POST');
      return true;
    }
    let rpcId: JsonRpcId | null = null;
    let challengeScope: McpOAuthScope = 'workspace:read';
    let cancellationListenersAttached = false;
    let cancellationObserved = request.aborted || response.destroyed;
    const observeCancellation = () => { cancellationObserved = true; };
    const isCancelled = () => cancellationObserved || request.aborted || response.destroyed;
    try {
      if (url.search !== '' || !acceptsMcp(request)) {
        throw new McpHttpError(400, -32600, 'Invalid Request');
      }
      const rpcBody = await readMcpJson(request);
      const candidate = record(rpcBody);
      const candidateMethod = typeof candidate?.method === 'string' ? candidate.method : null;
      if (candidateMethod === 'notifications/initialized') {
        const notification = exactObject(
          candidate ?? {}, ['jsonrpc', 'method', 'params'], ['jsonrpc', 'method'],
        );
        if (notification.jsonrpc !== '2.0') throw new McpHttpError(400, -32600, 'Invalid Request');
        if (notification.params !== undefined && record(notification.params) === null) throw invalidParams();
        validateStandardHeaders(request, candidateMethod);
        await options.oauthService.authenticateAccessToken(bearer(request));
        response.writeHead(202, {
          'cache-control': 'no-store', 'content-length': '0',
          'mcp-protocol-version': mcpStandardProtocolVersion,
          'x-content-type-options': 'nosniff', 'x-openlinear-request-id': correlationId,
        });
        response.end();
        return true;
      }
      if (candidateMethod === 'initialize') {
        const initialize = exactObject(
          candidate ?? {}, ['jsonrpc', 'id', 'method', 'params'], ['jsonrpc', 'id', 'method', 'params'],
        );
        if (initialize.jsonrpc !== '2.0'
          || (typeof initialize.id !== 'string' && typeof initialize.id !== 'number')
          || (typeof initialize.id === 'number' && !Number.isSafeInteger(initialize.id))) {
          throw new McpHttpError(400, -32600, 'Invalid Request');
        }
        rpcId = initialize.id;
        const params = exactObject(
          initialize.params, ['protocolVersion', 'capabilities', 'clientInfo', '_meta'],
          ['protocolVersion', 'capabilities', 'clientInfo'],
        );
        if (params.protocolVersion !== mcpStandardProtocolVersion
          || record(params.capabilities) === null || !validClientInfo(params.clientInfo)) {
          throw new McpHttpError(400, -32022, 'Unsupported protocol version', {
            supported: [mcpStandardProtocolVersion], requested: params.protocolVersion,
          });
        }
        validateStandardHeaders(request, candidateMethod, true);
        const grant = await options.oauthService.authenticateAccessToken(bearer(request));
        writeJson(response, 200, {
          jsonrpc: '2.0', id: initialize.id, result: {
            protocolVersion: mcpStandardProtocolVersion,
            capabilities: {tools: {listChanged: false}},
            serverInfo: {name: mcpServerName, title: 'OpenLinear product management', version: mcpServerVersion},
            instructions: `Operate only the OAuth-authorized workspace ${grant.workspaceId}. Read before writing, preserve revision and idempotency keys, and confirm destructive operations.`,
          },
        }, correlationId, {'mcp-protocol-version': mcpStandardProtocolVersion});
        return true;
      }
      if (candidateMethod === 'ping' || candidateMethod === 'resources/list'
        || candidateMethod === 'resources/templates/list' || candidateMethod === 'prompts/list') {
        const standard = exactObject(
          candidate ?? {}, ['jsonrpc', 'id', 'method', 'params'], ['jsonrpc', 'id', 'method'],
        );
        if (standard.jsonrpc !== '2.0'
          || (typeof standard.id !== 'string' && typeof standard.id !== 'number')
          || (typeof standard.id === 'number' && !Number.isSafeInteger(standard.id))
          || (standard.params !== undefined && record(standard.params) === null)) {
          throw new McpHttpError(400, -32600, 'Invalid Request');
        }
        rpcId = standard.id;
        validateStandardHeaders(request, candidateMethod);
        await options.oauthService.authenticateAccessToken(bearer(request));
        const result = candidateMethod === 'resources/list' ? {resources: []}
          : candidateMethod === 'resources/templates/list' ? {resourceTemplates: []}
            : candidateMethod === 'prompts/list' ? {prompts: []} : {};
        writeJson(response, 200, {jsonrpc: '2.0', id: standard.id, result}, correlationId, {
          'mcp-protocol-version': mcpStandardProtocolVersion,
        });
        return true;
      }
      const rpc = parseRpcRequest(rpcBody);
      rpcId = rpc.id;
      if (rpc.method === 'tools/call' && typeof rpc.params.name === 'string') {
        challengeScope = toolMap.get(rpc.params.name)?.scope ?? challengeScope;
      }
      const enhancedTransport = rpc.method === 'server/discover'
        || record(rpc.params._meta)?.['io.modelcontextprotocol/protocolVersion'] !== undefined;
      if (enhancedTransport) {
        validateMeta(rpc.params);
        validateMirroredHeaders(request, rpc);
      } else {
        validateStandardHeaders(request, rpc.method);
      }
      if (rpc.method === 'tools/call') {
        request.once('aborted', observeCancellation);
        response.once('close', observeCancellation);
        cancellationListenersAttached = true;
        if (isCancelled()) return true;
      }
      if (rpc.method === 'server/discover') {
        exactObject(rpc.params, ['_meta'], ['_meta']);
        writeJson(response, 200, {
          jsonrpc: '2.0', id: rpc.id, result: {
            resultType: 'complete', supportedVersions: [mcpProtocolVersion], capabilities: {tools: {}},
            _meta: {'io.modelcontextprotocol/serverInfo': {name: mcpServerName, version: mcpServerVersion}},
            instructions: 'Use only the explicit workspace-scoped product-management tools. Read before writing, preserve revision and idempotency keys, and confirm destructive operations.',
            ttlMs: 3_600_000, cacheScope: 'public',
          },
        }, correlationId);
        return true;
      }
      const rawToken = bearer(request);
      const grant = await options.oauthService.authenticateAccessToken(rawToken);
      if (rpc.method === 'tools/call' && isCancelled()) return true;
      if (grant.resource !== options.oauthService.resource) throw oauthAuthenticationRequired();
      if (rpc.method === 'tools/list') {
        const params = exactObject(rpc.params, ['_meta', 'cursor'], enhancedTransport ? ['_meta'] : []);
        if (params.cursor !== undefined) throw invalidParams();
        writeJson(response, 200, {
          jsonrpc: '2.0', id: rpc.id, result: {
            resultType: 'complete',
            tools: tools.filter((tool) => mcpOAuthScopeAllowed(grant.scopes, tool.scope))
              .map(enhancedTransport ? publicTool : publicStandardTool),
            _meta: {'io.modelcontextprotocol/serverInfo': {name: mcpServerName, version: mcpServerVersion}},
            ttlMs: 300_000, cacheScope: 'private',
          },
        }, correlationId);
        return true;
      }
      const params = exactObject(
        rpc.params, ['_meta', 'name', 'arguments'], enhancedTransport ? ['_meta', 'name', 'arguments'] : ['name'],
      );
      const name = requiredString(params.name, 1, 128, /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/u);
      const tool = toolMap.get(name);
      if (tool === undefined) throw invalidParams();
      const rawArguments = params.arguments === undefined ? {} : record(params.arguments);
      if (rawArguments === null) throw invalidParams();
      const argumentsValue = enhancedTransport
        ? rawArguments
        : {...rawArguments, workspaceId: grant.workspaceId};
      if (!conformsToSchema(argumentsValue, tool.inputSchema)) throw invalidParams();
      if (enhancedTransport) validateWorkspaceMirror(request, argumentsValue);
      const workspaceId = workspaceIdFrom(argumentsValue);
      if (workspaceId !== grant.workspaceId) throw oauthWorkspaceDenied();
      if (!mcpOAuthScopeAllowed(grant.scopes, tool.scope)) throw oauthInsufficientScope(tool.scope);
      if (isCancelled()) return true;
      response.writeHead(200, {
        'cache-control': 'no-store', 'content-type': 'text/event-stream; charset=utf-8',
        'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff',
        'x-openlinear-request-id': correlationId,
      });
      response.flushHeaders();
      await nextTurn();
      if (isCancelled()) return true;
      let result: Record<string, unknown>;
      try {
        result = toolSuccess(await tool.execute(grant, argumentsValue, correlationId));
      } catch (error) {
        result = error instanceof McpHttpError
          ? toolFailure(new ProjectManagementServiceError('INVALID_PM_REQUEST', 'Invalid request.'))
          : toolFailure(error);
      }
      if (!isCancelled()) {
        response.write(`data: ${JSON.stringify({jsonrpc: '2.0', id: rpc.id, result})}\n\n`);
        response.end();
      }
      return true;
    } catch (error) {
      if (cancellationListenersAttached && isCancelled()) return true;
      const mapped = error instanceof McpOAuthServiceError
        ? oauthAuthenticationRequired()
        : error instanceof McpHttpError ? error : new McpHttpError(500, -32603, 'Internal error');
      if (!response.headersSent) {
        const resourceMetadata = options.oauthService.resource.replace(
          /\/mcp$/u,
          '/.well-known/oauth-protected-resource/mcp',
        );
        const authenticate = mapped.status === 401
          ? `Bearer resource_metadata="${resourceMetadata}", scope="${challengeScope}"`
          : mapped.status === 403 && mapped.requiredScope !== undefined
            ? `Bearer error="insufficient_scope", scope="${mapped.requiredScope}", resource_metadata="${resourceMetadata}"`
            : null;
        writeJson(
          response,
          mapped.status,
          rpcErrorBody(rpcId, mapped),
          correlationId,
          authenticate === null ? {} : {'www-authenticate': authenticate},
        );
      } else if (!response.destroyed) {
        response.end();
      }
      return true;
    } finally {
      if (cancellationListenersAttached) {
        request.off('aborted', observeCancellation);
        response.off('close', observeCancellation);
      }
    }
  };
}
