import { createDatabase } from '@openlinear/db/sqlite';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { ApiConfig } from '../src/config.js';

const config: ApiConfig = {
  host: '127.0.0.1',
  port: 3000,
  environment: 'test',
  publicOrigin: 'http://openlinear.test',
  dataDirectory: '/tmp/openlinear-api-sqlite',
  databasePath: ':memory:',
  backupDirectory: '/tmp/openlinear-api-sqlite/backups',
  webRoot: '/tmp/openlinear-api-sqlite/web',
  sessionCookieName: 'ol_local_session',
  sessionTtlSeconds: 3_600,
};

describe('SQLite-backed API workflow', () => {
  it('bootstraps the local owner and serves project, milestone, and issue mutations', async () => {
    const database = createDatabase(':memory:');
    const app = await buildApp({ config, database, logger: false });
    const baseHeaders = { host: 'openlinear.test' };
    const unsafeHeaders = {
      ...baseHeaders,
      origin: config.publicOrigin,
      'content-type': 'application/json',
    };
    try {
      expect((await app.inject({ url: '/health/ready', headers: baseHeaders })).statusCode).toBe(200);
      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: unsafeHeaders,
        payload: {},
      });
      expect(ownerResponse.statusCode).toBe(201);
      const owner = ownerResponse.json().data as {
        user: { id: string };
        workspaces: Array<{ id: string }>;
      };
      const workspaceId = owner.workspaces[0]!.id;
      const cookie = ownerResponse.headers['set-cookie']!.split(';', 1)[0]!;
      const csrf = String(ownerResponse.headers['x-openlinear-csrf-token']);
      const headers = { ...unsafeHeaders, cookie, 'x-openlinear-csrf': csrf };

      const teamsResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${workspaceId}/teams`,
        headers: { ...baseHeaders, cookie },
      });
      expect(teamsResponse.statusCode).toBe(200);
      const teamId = (teamsResponse.json().data as Array<{ id: string }>)[0]!.id;

      const projectResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects`,
        headers,
        payload: {
          teamId,
          name: 'Local release',
          idempotencyKey: 'api-project-local-release',
        },
      });
      expect(projectResponse.statusCode).toBe(201);
      const project = projectResponse.json().data as { id: string; name: string; revision: number };

      const milestoneResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/milestones`,
        headers,
        payload: { name: 'Candidate', idempotencyKey: 'api-milestone-candidate' },
      });
      expect(milestoneResponse.statusCode).toBe(201);
      const milestone = milestoneResponse.json().data as {
        id: string;
        name: string;
        revision: number;
      };
      const retainedMilestoneResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/milestones`,
        headers,
        payload: { name: 'Retained until project purge', idempotencyKey: 'api-milestone-retained' },
      });
      expect(retainedMilestoneResponse.statusCode).toBe(201);

      const issueResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/issues`,
        headers,
        payload: {
          teamId,
          title: 'Verify embedded runtime',
          assigneeUserId: owner.user.id,
          projectId: project.id,
          milestoneId: milestone.id,
          idempotencyKey: 'api-issue-embedded-runtime',
        },
      });
      expect(issueResponse.statusCode).toBe(201);
      expect(issueResponse.json().data).toMatchObject({
        identifier: 'OL-1',
        projectId: project.id,
        milestoneId: milestone.id,
      });

      const searchResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${workspaceId}/search?query=OL-1`,
        headers: { ...baseHeaders, cookie },
      });
      expect(searchResponse.statusCode).toBe(200);
      expect(searchResponse.json().data[0]).toMatchObject({ kind: 'issue', rank: 0 });

      const archivedMilestoneResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/milestones/${milestone.id}/archive`,
        headers,
        payload: { expectedRevision: milestone.revision },
      });
      expect(archivedMilestoneResponse.statusCode).toBe(200);
      const archivedMilestone = archivedMilestoneResponse.json().data as { revision: number };
      const wrongMilestoneConfirmation = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/milestones/${milestone.id}/purge`,
        headers,
        payload: { expectedRevision: archivedMilestone.revision, confirmation: 'candidate' },
      });
      expect(wrongMilestoneConfirmation.statusCode).toBe(400);
      expect(wrongMilestoneConfirmation.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', field: 'confirmation' },
      });
      const milestonePurgeResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/milestones/${milestone.id}/purge`,
        headers,
        payload: { expectedRevision: archivedMilestone.revision, confirmation: milestone.name },
      });
      expect(milestonePurgeResponse.statusCode).toBe(200);
      expect(milestonePurgeResponse.json().data).toMatchObject({
        id: milestone.id,
        projectId: project.id,
        name: milestone.name,
        detachedIssueCount: 1,
      });
      const issueAfterMilestonePurge = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${workspaceId}/issues/${(issueResponse.json().data as { id: string }).id}`,
        headers: { ...baseHeaders, cookie },
      });
      expect(issueAfterMilestonePurge.statusCode).toBe(200);
      expect(issueAfterMilestonePurge.json().data).toMatchObject({
        projectId: project.id,
        milestoneId: null,
      });

      const archivedProjectResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/archive`,
        headers,
        payload: { expectedRevision: project.revision },
      });
      expect(archivedProjectResponse.statusCode).toBe(200);
      const archivedProject = archivedProjectResponse.json().data as { revision: number };
      const wrongConfirmation = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/purge`,
        headers,
        payload: { expectedRevision: archivedProject.revision, confirmation: 'Local Release' },
      });
      expect(wrongConfirmation.statusCode).toBe(400);
      expect(wrongConfirmation.json()).toMatchObject({
        error: { code: 'VALIDATION_ERROR', field: 'confirmation' },
      });
      const purgeResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}/purge`,
        headers,
        payload: { expectedRevision: archivedProject.revision, confirmation: project.name },
      });
      expect(purgeResponse.statusCode).toBe(200);
      expect(purgeResponse.json().data).toMatchObject({
        id: project.id,
        name: project.name,
        detachedIssueCount: 1,
        removedMilestoneCount: 1,
      });
      const preservedIssueResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${workspaceId}/issues/${(issueResponse.json().data as { id: string }).id}`,
        headers: { ...baseHeaders, cookie },
      });
      expect(preservedIssueResponse.statusCode).toBe(200);
      expect(preservedIssueResponse.json().data).toMatchObject({
        identifier: 'OL-1',
        projectId: null,
        milestoneId: null,
      });
      expect((await app.inject({
        method: 'GET',
        url: `/api/v1/workspaces/${workspaceId}/projects/${project.id}`,
        headers: { ...baseHeaders, cookie },
      })).statusCode).toBe(404);
    } finally {
      await app.close();
      database.close();
    }
  });
});
