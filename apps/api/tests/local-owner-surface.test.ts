import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { ApiConfig } from '../src/config.js';

const config: ApiConfig = {
  host: '127.0.0.1',
  port: 3000,
  environment: 'test',
  publicOrigin: 'http://basiclinear.test',
  dataDirectory: '/tmp/basiclinear-owner-surface',
  databasePath: ':memory:',
  backupDirectory: '/tmp/basiclinear-owner-surface/backups',
  webRoot: '/tmp/basiclinear-owner-surface/web',
  sessionCookieName: 'ol_local_session',
  sessionTtlSeconds: 3_600,
};

describe('CT-78 automatic local owner surface', () => {
  it('bootstraps or recovers fixed local defaults without accepting account or scope input', async () => {
    const app = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
    const route = app.slice(
      app.indexOf("'/api/v1/local-owner-session'"),
      app.indexOf("app.get(\n    '/api/v1/workspaces/:workspaceId/search'"),
    );

    expect(route).toContain("email: 'owner@basiclinear.local'");
    expect(route).toContain("workspaceName: 'BasicLinear'");
    expect(route).toContain("teamName: 'Personal'");
    expect(route).toContain('if (!isLoopbackAddress(request.ip))');
    expect(route).toContain('await getOwnerProfile(db)');
    expect(route).toContain('await issueSession(db, config, reply, owner.id)');
    expect(route).toContain('await bootstrapInstance(db, defaults)');
    expect(route).toContain('await issueSession(db, config, reply, result.userId)');
    expect(route).not.toContain('requireUser(');
    expect(route).not.toContain('request.body');
    expect(route).not.toContain('password');
    expect(route).not.toContain('external');
  });

  it('rejects the automatic owner endpoint before database access for a non-loopback peer', async () => {
    const app = await buildApp({ config, database: {} as never, logger: false });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/local-owner-session',
      remoteAddress: '203.0.113.8',
      headers: {
        host: 'basiclinear.test',
        origin: config.publicOrigin,
        'content-type': 'application/json',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      error: {
        code: 'FORBIDDEN',
        message: 'The local owner session is available only on this device.',
      },
    });
    await app.close();
  });
});
