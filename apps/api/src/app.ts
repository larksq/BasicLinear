import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  BulkIssueMutationRequestSchema,
  CreateCommentRequestSchema,
  CreateIssueRelationRequestSchema,
  CreateIssueRequestSchema,
  CreateLabelRequestSchema,
  CreateMilestoneRequestSchema,
  CreateProjectRequestSchema,
  CreateSavedViewRequestSchema,
  CreateStatusRequestSchema,
  DeleteIssueRelationRequestSchema,
  ExpectedRevisionRequestSchema,
  PurgeIssueRequestSchema,
  PurgeMilestoneRequestSchema,
  PurgeProjectRequestSchema,
  QueryIssuesRequestSchema,
  ReorderRequestSchema,
  RetireStatusRequestSchema,
  UpdateCommentRequestSchema,
  UpdateIssueRequestSchema,
  UpdateLabelRequestSchema,
  UpdateMilestoneRequestSchema,
  UpdateProjectRequestSchema,
  UpdateSavedViewRequestSchema,
  UpdateStatusRequestSchema,
} from '@openlinear/contracts';
import {
  archiveSavedView,
  archiveComment,
  archiveIssue,
  archiveLabel,
  archiveMilestone,
  archiveProject,
  bootstrapInstance,
  bulkMutateIssues,
  createDatabase,
  createComment,
  createIssue,
  createIssueRelation,
  createLabel,
  createMilestone,
  createProject,
  createSavedView,
  createStatus,
  databaseReady,
  deleteIssueRelation,
  getIssue,
  getProject,
  listComments,
  listWorkspaceEvents,
  listIssueActivity,
  listIssueRelations,
  listIssues,
  listLabels,
  getOwnerProfile,
  listMemberships,
  listMilestones,
  listWorkspaceMilestones,
  listProjectActivity,
  listProjects,
  listSavedViews,
  listStatuses,
  listTeams,
  listWorkspaces,
  purgeIssue,
  purgeMilestone,
  purgeProject,
  reorderMilestones,
  reorderProjects,
  reorderStatuses,
  retireStatus,
  restoreMilestone,
  restoreComment,
  restoreIssue,
  restoreLabel,
  restoreProject,
  restoreSavedView,
  searchWorkspace,
  updateMilestone,
  updateComment,
  updateIssue,
  updateLabel,
  updateProject,
  updateSavedView,
  updateStatus,
  type OpenLinearDatabase,
} from '@openlinear/db/sqlite';
import { AppError } from '@openlinear/domain';
import { Type } from '@sinclair/typebox';
import { Ajv } from 'ajv';
import * as addFormats from 'ajv-formats';
import Fastify, {
  LogController,
  type FastifyInstance,
  type FastifyRequest,
} from 'fastify';
import type { ApiConfig } from './config.js';
import { resolveEventCursor, serializeWorkspaceEvents } from './events.js';
import {
  csrfRequestHeader,
  issueSession,
  issueCsrfToken,
  requireCsrf,
  requireUser,
} from './security.js';
import { sendWebApp } from './static-app.js';

const installAjvFormats = addFormats.default as unknown as (validator: Ajv) => Ajv;

const WorkspaceParamsSchema = Type.Object({ workspaceId: Type.String({ format: 'uuid' }) });
const StatusParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  statusId: Type.String({ format: 'uuid' }),
});
const TeamStatusParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  teamId: Type.String({ format: 'uuid' }),
});
const StatusQuerySchema = Type.Object({ teamId: Type.Optional(Type.String({ format: 'uuid' })) });
const ProjectParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
});
const MilestoneParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  projectId: Type.String({ format: 'uuid' }),
  milestoneId: Type.String({ format: 'uuid' }),
});
const ProjectQuerySchema = Type.Object({
  query: Type.Optional(Type.String({ maxLength: 200 })),
  teamId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(Type.Union([
    Type.Literal('planned'),
    Type.Literal('in_progress'),
    Type.Literal('paused'),
    Type.Literal('completed'),
    Type.Literal('canceled'),
  ])),
  priority: Type.Optional(Type.Union([
    Type.Literal('none'),
    Type.Literal('urgent'),
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low'),
  ])),
  leadUserId: Type.Optional(Type.String({ format: 'uuid' })),
  archiveState: Type.Optional(Type.Union([
    Type.Literal('active'),
    Type.Literal('archived'),
    Type.Literal('all'),
  ])),
  order: Type.Optional(Type.Union([
    Type.Literal('position'),
    Type.Literal('name'),
    Type.Literal('targetDate'),
    Type.Literal('updatedAt'),
  ])),
  direction: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});
const MilestoneQuerySchema = Type.Object({ includeArchived: Type.Optional(Type.Boolean()) });
const LabelParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  labelId: Type.String({ format: 'uuid' }),
});
const IssueParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  issueId: Type.String({ format: 'uuid' }),
});
const SavedViewParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  viewId: Type.String({ format: 'uuid' }),
});
const RelationParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  issueId: Type.String({ format: 'uuid' }),
  relationId: Type.String({ format: 'uuid' }),
});
const CommentParamsSchema = Type.Object({
  workspaceId: Type.String({ format: 'uuid' }),
  issueId: Type.String({ format: 'uuid' }),
  commentId: Type.String({ format: 'uuid' }),
});
const IncludeArchivedQuerySchema = Type.Object({ includeArchived: Type.Optional(Type.Boolean()) });
const IssueQuerySchema = Type.Object({
  query: Type.Optional(Type.String({ maxLength: 200 })),
  teamId: Type.Optional(Type.String({ format: 'uuid' })),
  statusId: Type.Optional(Type.String({ format: 'uuid' })),
  priority: Type.Optional(Type.Union([
    Type.Literal('none'),
    Type.Literal('urgent'),
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low'),
  ])),
  assigneeUserId: Type.Optional(Type.String({ format: 'uuid' })),
  projectId: Type.Optional(Type.String({ format: 'uuid' })),
  milestoneId: Type.Optional(Type.String({ format: 'uuid' })),
  labelId: Type.Optional(Type.String({ format: 'uuid' })),
  archiveState: Type.Optional(Type.Union([
    Type.Literal('active'),
    Type.Literal('archived'),
    Type.Literal('all'),
  ])),
  order: Type.Optional(Type.Union([
    Type.Literal('updatedAt'),
    Type.Literal('identifier'),
    Type.Literal('priority'),
    Type.Literal('dueDate'),
  ])),
  direction: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
});
const SearchQuerySchema = Type.Object({
  query: Type.String({ minLength: 1, maxLength: 200 }),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
const EventQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ pattern: '^(0|[1-9][0-9]*)$', maxLength: 19 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
});
const EmptyJsonObjectSchema = Type.Object({}, { additionalProperties: false });

export interface BuildAppOptions {
  config: ApiConfig;
  database?: OpenLinearDatabase;
  logger?: boolean;
  serveWeb?: boolean;
}

function isUnsafe(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method);
}

function isLoopbackAddress(address: string): boolean {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address.toLowerCase());
}

function safeRequestLog(request: FastifyRequest): Record<string, unknown> {
  return { requestId: request.id, method: request.method, path: request.routeOptions.url };
}

function createRequestValidator(
  coerceTypes: false | 'array',
  useDefaults: boolean,
): Ajv {
  const validator = new Ajv({
    addUsedSchema: false,
    allErrors: false,
    coerceTypes,
    removeAdditional: false,
    useDefaults,
  });
  installAjvFormats(validator);
  return validator;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config } = options;
  const db = options.database ?? createDatabase(config.databasePath);
  const app = Fastify({
    logger: options.logger === false
      ? false
      : {
          level: process.env.LOG_LEVEL ?? 'info',
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'res.headers.set-cookie',
              '*.token',
              `req.headers.${csrfRequestHeader}`,
            ],
            censor: '[REDACTED]',
          },
        },
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
    trustProxy: false,
  }).withTypeProvider<TypeBoxTypeProvider>();
  const bodyValidator = createRequestValidator(false, false);
  const transportValidator = createRequestValidator('array', true);
  app.setValidatorCompiler(({ schema, httpPart }) => {
    // Body coercion corrupts nullable and recursive anyOf branches; URL inputs still need scalar coercion.
    const validator = httpPart === 'body' ? bodyValidator : transportValidator;
    return validator.compile(schema as object);
  });

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: null,
      },
    },
    strictTransportSecurity: false,
  });
  await app.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    errorResponseBuilder: () => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Wait and try again.',
      },
    }),
  });

  const expectedHost = new URL(config.publicOrigin).host.toLowerCase();
  app.addHook('onRequest', async (request) => {
    const host = request.headers.host?.trim().toLowerCase();
    if (host !== expectedHost) {
      throw new AppError('FORBIDDEN', 'Request host is not allowed.', 403);
    }
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== config.publicOrigin) {
      throw new AppError('FORBIDDEN', 'Request origin is not allowed.', 403);
    }
    if (!isUnsafe(request.method)) return;
    if (origin === undefined) {
      throw new AppError('FORBIDDEN', 'State-changing requests require a same-origin browser request.', 403);
    }
    const path = request.url.split('?', 1)[0];
    if (path?.startsWith('/api/')) {
      const contentType = request.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase();
      if (contentType !== 'application/json') {
        throw new AppError('VALIDATION_ERROR', 'State-changing API requests must use application/json.', 415);
      }
      if (path !== '/api/v1/local-owner-session') await requireCsrf(db, config, request);
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const frameworkError = typeof error === 'object' && error !== null
      ? error as { validation?: unknown; statusCode?: number }
      : {};
    const known = error instanceof AppError;
    const validation = frameworkError.validation !== undefined;
    const status = known ? error.status : validation ? 400 : frameworkError.statusCode ?? 500;
    const code = known ? error.code : validation ? 'VALIDATION_ERROR' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
    const message = known
      ? error.message
      : validation
        ? 'The request contains invalid fields.'
        : status === 429
          ? 'Too many attempts. Wait and try again.'
          : 'The operation could not be completed.';
    const field = known ? error.field : undefined;
    const currentRevision = known ? error.currentRevision : undefined;
    const validationIssues = validation && Array.isArray(frameworkError.validation)
      ? frameworkError.validation.slice(0, 10).map((item) => {
        const issue = typeof item === 'object' && item !== null
          ? item as {
            instancePath?: unknown;
            keyword?: unknown;
            message?: unknown;
            params?: { additionalProperty?: unknown; missingProperty?: unknown };
          }
          : {};
        return {
          path: typeof issue.instancePath === 'string' ? issue.instancePath : '',
          keyword: typeof issue.keyword === 'string' ? issue.keyword : 'unknown',
          message: typeof issue.message === 'string' ? issue.message : 'invalid',
          ...(typeof issue.params?.additionalProperty === 'string'
            ? { additionalProperty: issue.params.additionalProperty }
            : {}),
          ...(typeof issue.params?.missingProperty === 'string'
            ? { missingProperty: issue.params.missingProperty }
            : {}),
        };
      })
      : undefined;
    if (status >= 500) {
      request.log.error({
        ...safeRequestLog(request),
        code,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      }, 'request failed');
    } else {
      request.log.info({
        ...safeRequestLog(request),
        code,
        status,
        ...(validationIssues === undefined ? {} : { validationIssues }),
      }, 'request rejected');
    }
    return reply.status(status).send({
      error: {
        code,
        message,
        correlationId: request.id,
        ...(field === undefined ? {} : { field }),
        ...(currentRevision === undefined ? {} : { currentRevision }),
      },
    });
  });

  app.setNotFoundHandler(async (request, reply) => {
    if (options.serveWeb === true) {
      if (await sendWebApp(config.webRoot, request, reply)) return;
    }
    return reply.status(404).send({
      error: { code: 'NOT_FOUND', message: 'Route not found.', correlationId: request.id },
    });
  });

  app.get('/health/live', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    const ready = await databaseReady(db);
    return reply.status(ready ? 200 : 503).send({ status: ready ? 'ready' : 'unavailable' });
  });
  app.get('/api/v1/meta', async () => ({
    data: { name: 'OpenLinear', version: '0.1.0', apiVersion: 'v1' },
  }));

  app.post(
    '/api/v1/local-owner-session',
    {
      schema: { body: EmptyJsonObjectSchema },
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!isLoopbackAddress(request.ip)) {
        throw new AppError('FORBIDDEN', 'The local owner session is available only on this device.', 403);
      }
      const defaults = {
        email: 'owner@openlinear.local',
        displayName: 'Owner',
        workspaceName: 'OpenLinear',
        workspaceSlug: 'openlinear',
        teamName: 'Personal',
        teamKey: 'OL',
      };
      const existingOwner = await getOwnerProfile(db);
      if (existingOwner !== undefined) {
        const owner = existingOwner;
        await issueSession(db, config, reply, owner.id);
        return {
          data: {
            user: {
              id: owner.id,
              email: owner.email,
              displayName: owner.displayName,
              revision: owner.revision,
            },
            workspaces: await listWorkspaces(db, owner.id),
          },
        };
      }
      const result = await bootstrapInstance(db, defaults);
      await issueSession(db, config, reply, result.userId);
      return reply.status(201).send({
        data: {
          user: {
            id: result.userId,
            email: defaults.email,
            displayName: defaults.displayName,
            revision: 1,
          },
          workspaces: await listWorkspaces(db, result.userId),
        },
      });
    },
  );

  app.get(
    '/api/v1/workspaces/:workspaceId/search',
    { schema: { params: WorkspaceParamsSchema, querystring: SearchQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await searchWorkspace(
          db,
          user.id,
          request.params.workspaceId,
          request.query.query,
          request.query.limit ?? 20,
        ),
      };
    },
  );

  app.get(
    '/api/v1/workspaces/:workspaceId/views',
    { schema: { params: WorkspaceParamsSchema, querystring: IncludeArchivedQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listSavedViews(
          db,
          user.id,
          request.params.workspaceId,
          request.query.includeArchived ?? false,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/views',
    { schema: { params: WorkspaceParamsSchema, body: CreateSavedViewRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const view = await createSavedView(db, user.id, request.params.workspaceId, request.body);
      return reply.status(201).header('etag', `"${view.revision}"`).send({ data: view });
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/views/:viewId',
    { schema: { params: SavedViewParamsSchema, body: UpdateSavedViewRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const view = await updateSavedView(
        db,
        user.id,
        request.params.workspaceId,
        request.params.viewId,
        request.body,
      );
      return reply.header('etag', `"${view.revision}"`).send({ data: view });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/views/:viewId/archive',
    { schema: { params: SavedViewParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const view = await archiveSavedView(
        db,
        user.id,
        request.params.workspaceId,
        request.params.viewId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${view.revision}"`).send({ data: view });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/views/:viewId/restore',
    { schema: { params: SavedViewParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const view = await restoreSavedView(
        db,
        user.id,
        request.params.workspaceId,
        request.params.viewId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${view.revision}"`).send({ data: view });
    },
  );

  app.get('/api/v1/session', async (request, reply) => {
    const user = await requireUser(db, config, request);
    await issueCsrfToken(db, config, reply, user.sessionToken);
    const { sessionToken: _sessionToken, ...publicUser } = user;
    return { data: { user: publicUser, workspaces: await listWorkspaces(db, user.id) } };
  });

  app.get('/api/v1/workspaces', async (request) => {
    const user = await requireUser(db, config, request);
    return { data: await listWorkspaces(db, user.id) };
  });
  app.get(
    '/api/v1/workspaces/:workspaceId/events',
    { schema: { params: WorkspaceParamsSchema, querystring: EventQuerySchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const cursor = resolveEventCursor(request.query.cursor, request.headers['last-event-id']);
      const events = await listWorkspaceEvents(
        db,
        user.id,
        request.params.workspaceId,
        cursor,
        request.query.limit ?? 100,
      );
      return reply
        .header('cache-control', 'no-cache, no-transform')
        .header('x-accel-buffering', 'no')
        .type('text/event-stream; charset=utf-8')
        .send(serializeWorkspaceEvents(events));
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/teams',
    { schema: { params: WorkspaceParamsSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return { data: await listTeams(db, user.id, request.params.workspaceId) };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/memberships',
    { schema: { params: WorkspaceParamsSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return { data: await listMemberships(db, user.id, request.params.workspaceId) };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/labels',
    { schema: { params: WorkspaceParamsSchema, querystring: IncludeArchivedQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listLabels(
          db,
          user.id,
          request.params.workspaceId,
          request.query.includeArchived ?? false,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/labels',
    { schema: { params: WorkspaceParamsSchema, body: CreateLabelRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const label = await createLabel(db, user.id, request.params.workspaceId, request.body);
      return reply.status(201).header('etag', `"${label.revision}"`).send({ data: label });
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/labels/:labelId',
    { schema: { params: LabelParamsSchema, body: UpdateLabelRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const label = await updateLabel(
        db,
        user.id,
        request.params.workspaceId,
        request.params.labelId,
        request.body,
      );
      return reply.header('etag', `"${label.revision}"`).send({ data: label });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/labels/:labelId/archive',
    { schema: { params: LabelParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const label = await archiveLabel(
        db,
        user.id,
        request.params.workspaceId,
        request.params.labelId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${label.revision}"`).send({ data: label });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/labels/:labelId/restore',
    { schema: { params: LabelParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const label = await restoreLabel(
        db,
        user.id,
        request.params.workspaceId,
        request.params.labelId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${label.revision}"`).send({ data: label });
    },
  );

  app.get(
    '/api/v1/workspaces/:workspaceId/issues',
    { schema: { params: WorkspaceParamsSchema, querystring: IssueQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return { data: await listIssues(db, user.id, request.params.workspaceId, request.query) };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues',
    { schema: { params: WorkspaceParamsSchema, body: CreateIssueRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const issue = await createIssue(db, user.id, request.params.workspaceId, request.body);
      return reply.status(201).header('etag', `"${issue.revision}"`).send({ data: issue });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/query',
    { schema: { params: WorkspaceParamsSchema, body: QueryIssuesRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      const { state } = request.body;
      return {
        data: await listIssues(db, user.id, request.params.workspaceId, {
          query: state.searchQuery,
          archiveState: state.archiveState,
          order: state.order.field,
          direction: state.order.direction,
          filter: state.filter,
        }),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/bulk',
    { schema: { params: WorkspaceParamsSchema, body: BulkIssueMutationRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await bulkMutateIssues(
          db,
          user.id,
          request.params.workspaceId,
          request.body,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/issues/:issueId',
    { schema: { params: IssueParamsSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const issue = await getIssue(db, user.id, request.params.workspaceId, request.params.issueId);
      return reply.header('etag', `"${issue.revision}"`).send({ data: issue });
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/issues/:issueId',
    { schema: { params: IssueParamsSchema, body: UpdateIssueRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const issue = await updateIssue(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.body,
      );
      return reply.header('etag', `"${issue.revision}"`).send({ data: issue });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/archive',
    { schema: { params: IssueParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const issue = await archiveIssue(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${issue.revision}"`).send({ data: issue });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/restore',
    { schema: { params: IssueParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const issue = await restoreIssue(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${issue.revision}"`).send({ data: issue });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/purge',
    { schema: { params: IssueParamsSchema, body: PurgeIssueRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await purgeIssue(
          db,
          user.id,
          request.params.workspaceId,
          request.params.issueId,
          request.body,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/activity',
    { schema: { params: IssueParamsSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listIssueActivity(
          db,
          user.id,
          request.params.workspaceId,
          request.params.issueId,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/relations',
    { schema: { params: IssueParamsSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listIssueRelations(
          db,
          user.id,
          request.params.workspaceId,
          request.params.issueId,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/relations',
    { schema: { params: IssueParamsSchema, body: CreateIssueRelationRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const relation = await createIssueRelation(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.body,
      );
      return reply.status(201).header('etag', `"${relation.revision}"`).send({ data: relation });
    },
  );
  app.delete(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/relations/:relationId',
    { schema: { params: RelationParamsSchema, body: DeleteIssueRelationRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      await deleteIssueRelation(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.params.relationId,
        request.body.expectedRevision,
      );
      return reply.status(204).send();
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/comments',
    { schema: { params: IssueParamsSchema, querystring: IncludeArchivedQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listComments(
          db,
          user.id,
          request.params.workspaceId,
          request.params.issueId,
          request.query.includeArchived ?? false,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/comments',
    { schema: { params: IssueParamsSchema, body: CreateCommentRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const comment = await createComment(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.body,
      );
      return reply.status(201).header('etag', `"${comment.revision}"`).send({ data: comment });
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/comments/:commentId',
    { schema: { params: CommentParamsSchema, body: UpdateCommentRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const comment = await updateComment(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.params.commentId,
        request.body,
      );
      return reply.header('etag', `"${comment.revision}"`).send({ data: comment });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/comments/:commentId/archive',
    { schema: { params: CommentParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const comment = await archiveComment(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.params.commentId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${comment.revision}"`).send({ data: comment });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/issues/:issueId/comments/:commentId/restore',
    { schema: { params: CommentParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const comment = await restoreComment(
        db,
        user.id,
        request.params.workspaceId,
        request.params.issueId,
        request.params.commentId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${comment.revision}"`).send({ data: comment });
    },
  );

  app.get(
    '/api/v1/workspaces/:workspaceId/projects',
    { schema: { params: WorkspaceParamsSchema, querystring: ProjectQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return { data: await listProjects(db, user.id, request.params.workspaceId, request.query) };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects',
    { schema: { params: WorkspaceParamsSchema, body: CreateProjectRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const project = await createProject(db, user.id, request.params.workspaceId, request.body);
      return reply.status(201).header('etag', `"${project.revision}"`).send({ data: project });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/reorder',
    { schema: { params: WorkspaceParamsSchema, body: ReorderRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await reorderProjects(db, user.id, request.params.workspaceId, request.body.items),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/projects/:projectId',
    { schema: { params: ProjectParamsSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const project = await getProject(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
      );
      return reply.header('etag', `"${project.revision}"`).send({ data: project });
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/projects/:projectId',
    { schema: { params: ProjectParamsSchema, body: UpdateProjectRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const project = await updateProject(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.body,
      );
      return reply.header('etag', `"${project.revision}"`).send({ data: project });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/archive',
    { schema: { params: ProjectParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const project = await archiveProject(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${project.revision}"`).send({ data: project });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/restore',
    { schema: { params: ProjectParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const project = await restoreProject(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${project.revision}"`).send({ data: project });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/purge',
    { schema: { params: ProjectParamsSchema, body: PurgeProjectRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await purgeProject(
          db,
          user.id,
          request.params.workspaceId,
          request.params.projectId,
          request.body,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/activity',
    { schema: { params: ProjectParamsSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listProjectActivity(
          db,
          user.id,
          request.params.workspaceId,
          request.params.projectId,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/milestones',
    { schema: { params: WorkspaceParamsSchema, querystring: IncludeArchivedQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listWorkspaceMilestones(
          db,
          user.id,
          request.params.workspaceId,
          request.query.includeArchived,
        ),
      };
    },
  );
  app.get(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones',
    { schema: { params: ProjectParamsSchema, querystring: MilestoneQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listMilestones(
          db,
          user.id,
          request.params.workspaceId,
          request.params.projectId,
          request.query.includeArchived ?? false,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones',
    { schema: { params: ProjectParamsSchema, body: CreateMilestoneRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const milestone = await createMilestone(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.body,
      );
      return reply.status(201).header('etag', `"${milestone.revision}"`).send({ data: milestone });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones/reorder',
    { schema: { params: ProjectParamsSchema, body: ReorderRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await reorderMilestones(
          db,
          user.id,
          request.params.workspaceId,
          request.params.projectId,
          request.body.items,
        ),
      };
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones/:milestoneId',
    { schema: { params: MilestoneParamsSchema, body: UpdateMilestoneRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const milestone = await updateMilestone(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.params.milestoneId,
        request.body,
      );
      return reply.header('etag', `"${milestone.revision}"`).send({ data: milestone });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones/:milestoneId/archive',
    { schema: { params: MilestoneParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const milestone = await archiveMilestone(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.params.milestoneId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${milestone.revision}"`).send({ data: milestone });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones/:milestoneId/restore',
    { schema: { params: MilestoneParamsSchema, body: ExpectedRevisionRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const milestone = await restoreMilestone(
        db,
        user.id,
        request.params.workspaceId,
        request.params.projectId,
        request.params.milestoneId,
        request.body.expectedRevision,
      );
      return reply.header('etag', `"${milestone.revision}"`).send({ data: milestone });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/projects/:projectId/milestones/:milestoneId/purge',
    { schema: { params: MilestoneParamsSchema, body: PurgeMilestoneRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await purgeMilestone(
          db,
          user.id,
          request.params.workspaceId,
          request.params.projectId,
          request.params.milestoneId,
          request.body,
        ),
      };
    },
  );

  app.get(
    '/api/v1/workspaces/:workspaceId/statuses',
    { schema: { params: WorkspaceParamsSchema, querystring: StatusQuerySchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await listStatuses(db, user.id, request.params.workspaceId, request.query.teamId),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/statuses',
    { schema: { params: WorkspaceParamsSchema, body: CreateStatusRequestSchema } },
    async (request, reply) => {
      const user = await requireUser(db, config, request);
      const status = await createStatus(db, user.id, request.params.workspaceId, request.body);
      return reply.status(201).send({ data: status });
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/teams/:teamId/statuses/reorder',
    { schema: { params: TeamStatusParamsSchema, body: ReorderRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await reorderStatuses(
          db,
          user.id,
          request.params.workspaceId,
          request.params.teamId,
          request.body.items,
        ),
      };
    },
  );
  app.patch(
    '/api/v1/workspaces/:workspaceId/statuses/:statusId',
    { schema: { params: StatusParamsSchema, body: UpdateStatusRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await updateStatus(
          db,
          user.id,
          request.params.workspaceId,
          request.params.statusId,
          request.body,
        ),
      };
    },
  );
  app.post(
    '/api/v1/workspaces/:workspaceId/statuses/:statusId/retire',
    { schema: { params: StatusParamsSchema, body: RetireStatusRequestSchema } },
    async (request) => {
      const user = await requireUser(db, config, request);
      return {
        data: await retireStatus(
          db,
          user.id,
          request.params.workspaceId,
          request.params.statusId,
          request.body,
        ),
      };
    },
  );

  app.addHook('onClose', async () => {
    if (options.database === undefined) await db.destroy();
  });
  return app;
}
