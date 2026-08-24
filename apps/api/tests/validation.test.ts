import {
  CreateProjectRequestSchema,
  PurgeMilestoneRequestSchema,
  PurgeProjectRequestSchema,
  QueryIssuesRequestSchema,
} from '@openlinear/contracts';
import type { OpenLinearDatabase } from '@openlinear/db';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { ApiConfig } from '../src/config.js';

const config: ApiConfig = {
  host: '127.0.0.1',
  port: 3000,
  environment: 'test',
  publicOrigin: 'http://openlinear.test',
  dataDirectory: '/tmp/openlinear-validation',
  databasePath: ':memory:',
  backupDirectory: '/tmp/openlinear-validation/backups',
  webRoot: '/tmp/openlinear-validation/web',
  sessionCookieName: 'ol_local_session',
  sessionTtlSeconds: 3600,
};

const projectPayload = {
  teamId: '30000000-0000-4000-8000-000000000054',
  name: 'Recursive validation',
  overviewDocument: {
    version: 1,
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Delivery plan' }],
      },
      {
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'Preserve every nested field.' }],
          }],
        }],
      },
    ],
  },
  idempotencyKey: 'ct54-project-validation',
} as const;

const issueQueryPayload = {
  state: {
    version: 1,
    layout: 'list',
    groupBy: 'milestone',
    order: { field: 'updatedAt', direction: 'desc' },
    visibleProperties: ['milestone', 'priority'],
    density: 'default',
    filter: {
      version: 1,
      root: {
        type: 'group',
        operator: 'and',
        children: [{
          type: 'condition',
          field: 'milestoneId',
          operator: 'isNotEmpty',
          value: null,
        }],
      },
    },
    searchQuery: '',
    archiveState: 'active',
    collapsedGroups: [],
  },
} as const;

describe('API recursive route validation', () => {
  it('preserves matching union branches while rejecting unknown properties', async () => {
    const app = await buildApp({
      config,
      database: {} as OpenLinearDatabase,
      logger: false,
    });
    app.post(
      '/__tests/project-validation',
      { schema: { body: CreateProjectRequestSchema } },
      async (request) => ({ data: request.body }),
    );
    app.post(
      '/__tests/issue-query-validation',
      { schema: { body: QueryIssuesRequestSchema } },
      async (request) => ({ data: request.body }),
    );
    app.post(
      '/__tests/project-purge-validation',
      { schema: { body: PurgeProjectRequestSchema } },
      async (request) => ({ data: request.body }),
    );
    app.post(
      '/__tests/milestone-purge-validation',
      { schema: { body: PurgeMilestoneRequestSchema } },
      async (request) => ({ data: request.body }),
    );

    try {
      const project = await app.inject({
        method: 'POST',
        url: '/__tests/project-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: projectPayload,
      });
      expect(project.statusCode).toBe(200);
      expect(project.json()).toEqual({ data: projectPayload });

      const query = await app.inject({
        method: 'POST',
        url: '/__tests/issue-query-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: issueQueryPayload,
      });
      expect(query.statusCode).toBe(200);
      expect(query.json()).toEqual({ data: issueQueryPayload });

      const purge = await app.inject({
        method: 'POST',
        url: '/__tests/project-purge-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: { expectedRevision: 4, confirmation: 'Recursive validation' },
      });
      expect(purge.statusCode).toBe(200);
      expect(purge.json()).toEqual({
        data: { expectedRevision: 4, confirmation: 'Recursive validation' },
      });

      const milestonePurge = await app.inject({
        method: 'POST',
        url: '/__tests/milestone-purge-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: { expectedRevision: 3, confirmation: 'Candidate' },
      });
      expect(milestonePurge.statusCode).toBe(200);
      expect(milestonePurge.json()).toEqual({
        data: { expectedRevision: 3, confirmation: 'Candidate' },
      });

      const unknownProperty = await app.inject({
        method: 'POST',
        url: '/__tests/project-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: { ...projectPayload, unexpected: true },
      });
      expect(unknownProperty.statusCode).toBe(400);
      expect(unknownProperty.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });

      const purgeUnknownProperty = await app.inject({
        method: 'POST',
        url: '/__tests/project-purge-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: { expectedRevision: 4, confirmation: 'Recursive validation', cascade: true },
      });
      expect(purgeUnknownProperty.statusCode).toBe(400);
      expect(purgeUnknownProperty.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });

      const milestonePurgeUnknownProperty = await app.inject({
        method: 'POST',
        url: '/__tests/milestone-purge-validation',
        headers: { host: 'openlinear.test', origin: config.publicOrigin },
        payload: { expectedRevision: 3, confirmation: 'Candidate', cascade: true },
      });
      expect(milestonePurgeUnknownProperty.statusCode).toBe(400);
      expect(milestonePurgeUnknownProperty.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR' },
      });
    } finally {
      await app.close();
    }
  });
});
