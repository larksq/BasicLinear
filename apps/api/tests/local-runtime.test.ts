import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase, prepareLocalStorage } from '@openlinear/db/sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadApiConfig, type ApiConfig } from '../src/config.js';

const directories: string[] = [];

async function temporaryDirectory(name: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), `${name}-`));
  directories.push(directory);
  return directory;
}

function testConfig(root: string, webRoot = join(root, 'web')): ApiConfig {
  return {
    host: '127.0.0.1',
    port: 4174,
    environment: 'test',
    publicOrigin: 'http://127.0.0.1:4174',
    dataDirectory: root,
    databasePath: join(root, 'openlinear.sqlite3'),
    backupDirectory: join(root, 'backups'),
    webRoot,
    sessionCookieName: 'ol_local_session',
    sessionTtlSeconds: 3_600,
  };
}

function host(config: ApiConfig): string {
  return new URL(config.publicOrigin).host;
}

function unsafe(config: ApiConfig, extra: Record<string, string> = {}): Record<string, string> {
  return {
    host: host(config),
    origin: config.publicOrigin,
    'content-type': 'application/json',
    ...extra,
  };
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe('CT-81 local runtime configuration', () => {
  it('uses platform-standard data directories without mandatory configuration', () => {
    expect(loadApiConfig({}, { platform: 'darwin', homeDirectory: '/Users/local' })).toMatchObject({
      host: '127.0.0.1',
      port: 4174,
      publicOrigin: 'http://127.0.0.1:4174',
      dataDirectory: '/Users/local/Library/Application Support/OpenLinear',
      databasePath: '/Users/local/Library/Application Support/OpenLinear/openlinear.sqlite3',
      backupDirectory: '/Users/local/Library/Application Support/OpenLinear/backups',
    });
    expect(loadApiConfig({}, { platform: 'linux', homeDirectory: '/home/local' }).dataDirectory)
      .toBe('/home/local/.local/share/openlinear');
    expect(loadApiConfig(
      { LOCALAPPDATA: 'C:\\Users\\local\\AppData\\Local' },
      { platform: 'win32', homeDirectory: 'C:\\Users\\local' },
    ).dataDirectory).toContain('OpenLinear');
  });

  it('fails closed on remote binds and invalid local runtime values', () => {
    expect(() => loadApiConfig({ OPENLINEAR_HOST: '0.0.0.0' }))
      .toThrow('supports loopback access only');
    expect(() => loadApiConfig({ HOST: '192.0.2.10' }))
      .toThrow('supports loopback access only');
    expect(() => loadApiConfig({ OPENLINEAR_PORT: '70000' }))
      .toThrow('must be an integer from 1 to 65535');
    expect(() => loadApiConfig({ OPENLINEAR_SESSION_TTL_SECONDS: '0' }))
      .toThrow('must be an integer from 300 to 86400');
  });

  it('rejects a file where the dedicated data directory must exist', async () => {
    const root = await temporaryDirectory('openlinear-path');
    const dataDirectory = join(root, 'not-a-directory');
    await writeFile(dataDirectory, 'blocked');
    expect(() => prepareLocalStorage({
      dataDirectory,
      databasePath: join(dataDirectory, 'openlinear.sqlite3'),
      backupDirectory: join(dataDirectory, 'backups'),
    })).toThrow('must be a regular directory');
  });
});

describe('CT-81 loopback HTTP boundary', () => {
  it('completes first use and a project workflow with outbound fetch denied', async () => {
    const outbound = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network denied'));
    const root = await temporaryDirectory('openlinear-offline');
    const config = testConfig(root);
    const database = createDatabase(':memory:');
    const app = await buildApp({ config, database, logger: false });
    try {
      const owner = await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: unsafe(config),
        payload: {},
      });
      const data = owner.json().data as { workspaces: Array<{ id: string }> };
      const workspaceId = data.workspaces[0]!.id;
      const cookie = String(owner.headers['set-cookie']).split(';', 1)[0]!;
      const csrf = String(owner.headers['x-openlinear-csrf-token']);
      const teams = await app.inject({
        url: `/api/v1/workspaces/${workspaceId}/teams`,
        headers: { host: host(config), cookie },
      });
      const teamId = (teams.json().data as Array<{ id: string }>)[0]!.id;
      const project = await app.inject({
        method: 'POST',
        url: `/api/v1/workspaces/${workspaceId}/projects`,
        headers: unsafe(config, { cookie, 'x-openlinear-csrf': csrf }),
        payload: { teamId, name: 'Offline workflow', idempotencyKey: 'offline-workflow' },
      });
      expect(project.statusCode).toBe(201);
      expect(outbound).not.toHaveBeenCalled();
    } finally {
      await app.close();
      database.close();
      outbound.mockRestore();
    }
  });

  it('enforces Host, Origin, JSON, strict cookies, and independent per-tab CSRF proof', async () => {
    const root = await temporaryDirectory('openlinear-security');
    const config = testConfig(root);
    const database = createDatabase(':memory:');
    const app = await buildApp({ config, database, logger: false });
    try {
      expect((await app.inject({ url: '/api/v1/meta' })).statusCode).toBe(403);
      expect((await app.inject({
        url: '/api/v1/meta',
        headers: { host: 'attacker.example' },
      })).statusCode).toBe(403);
      expect((await app.inject({
        url: '/api/v1/meta',
        headers: { host: host(config), origin: 'https://attacker.example' },
      })).statusCode).toBe(403);
      expect((await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: { host: host(config), 'content-type': 'application/json' },
        payload: {},
      })).statusCode).toBe(403);
      expect((await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: {
          host: host(config),
          origin: config.publicOrigin,
          'content-type': 'text/plain',
        },
        payload: '{}',
      })).statusCode).toBe(415);

      const ownerResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: unsafe(config),
        payload: {},
      });
      expect(ownerResponse.statusCode).toBe(201);
      const setCookie = String(ownerResponse.headers['set-cookie']);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Strict');
      expect(setCookie).not.toContain('Max-Age');
      const cookie = setCookie.split(';', 1)[0]!;
      const csrfOne = String(ownerResponse.headers['x-openlinear-csrf-token']);
      const session = ownerResponse.json().data as {
        user: { id: string };
        workspaces: Array<{ id: string }>;
      };
      const workspaceId = session.workspaces[0]!.id;
      const teams = await app.inject({
        url: `/api/v1/workspaces/${workspaceId}/teams`,
        headers: { host: host(config), cookie },
      });
      const teamId = (teams.json().data as Array<{ id: string }>)[0]!.id;

      const mutation = {
        method: 'POST' as const,
        url: `/api/v1/workspaces/${workspaceId}/projects`,
        payload: { teamId, name: 'Protected mutation', idempotencyKey: 'protected-mutation' },
      };
      expect((await app.inject({
        ...mutation,
        headers: unsafe(config, { cookie }),
      })).statusCode).toBe(403);
      expect((await app.inject({
        ...mutation,
        headers: unsafe(config, { cookie, 'x-openlinear-csrf': 'invalid' }),
      })).statusCode).toBe(403);

      const tabTwoSession = await app.inject({
        url: '/api/v1/session',
        headers: { host: host(config), cookie },
      });
      expect(tabTwoSession.statusCode).toBe(200);
      const csrfTwo = String(tabTwoSession.headers['x-openlinear-csrf-token']);
      expect(csrfTwo).not.toBe(csrfOne);
      expect((await app.inject({
        ...mutation,
        headers: unsafe(config, { cookie, 'x-openlinear-csrf': csrfOne }),
      })).statusCode).toBe(201);
      expect((await app.inject({
        ...mutation,
        payload: { ...mutation.payload, name: 'Second tab', idempotencyKey: 'second-tab' },
        headers: unsafe(config, { cookie, 'x-openlinear-csrf': csrfTwo }),
      })).statusCode).toBe(201);

      expect((await app.inject({
        method: 'POST',
        url: '/api/v1/workspaces',
        headers: unsafe(config, { cookie, 'x-openlinear-csrf': csrfTwo }),
        payload: {},
      })).statusCode).toBe(404);
      expect((await app.inject({
        url: '/api/v1/auth/oidc/start',
        headers: { host: host(config) },
      })).statusCode).toBe(404);
    } finally {
      await app.close();
      database.close();
    }
  });

  it('serves immutable assets and SPA routes from the same Fastify process', async () => {
    const root = await temporaryDirectory('openlinear-static');
    const webRoot = join(root, 'web');
    await mkdir(join(webRoot, 'assets'), { recursive: true });
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>Local app</title>');
    await writeFile(join(webRoot, 'assets', 'app.js'), 'globalThis.openlinear = true;');
    const config = testConfig(root, webRoot);
    const database = createDatabase(':memory:');
    const app = await buildApp({ config, database, logger: false, serveWeb: true });
    try {
      const index = await app.inject({ url: '/projects/active', headers: { host: host(config) } });
      expect(index.statusCode).toBe(200);
      expect(index.headers['content-type']).toContain('text/html');
      expect(index.headers['content-security-policy']).toContain("default-src 'self'");
      expect(index.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
      expect(index.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
      expect(index.body).toContain('Local app');

      const asset = await app.inject({ url: '/assets/app.js', headers: { host: host(config) } });
      expect(asset.statusCode).toBe(200);
      expect(asset.headers['cache-control']).toContain('immutable');
      expect(asset.headers['content-type']).toContain('text/javascript');
      expect((await app.inject({
        url: '/assets/missing.js',
        headers: { host: host(config) },
      })).statusCode).toBe(404);
      expect((await app.inject({
        url: '/api/unknown',
        headers: { host: host(config) },
      })).statusCode).toBe(404);
    } finally {
      await app.close();
      database.close();
    }
  });
});

describe('CT-81 restart and migration behavior', () => {
  it('persists local workflow data while renewing the in-memory session after restart', async () => {
    const root = await temporaryDirectory('openlinear-restart');
    const config = testConfig(root);
    prepareLocalStorage(config);
    let app = await buildApp({ config, logger: false });
    const ownerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/local-owner-session',
      headers: unsafe(config),
      payload: {},
    });
    const first = ownerResponse.json().data as { user: { id: string }; workspaces: Array<{ id: string }> };
    const workspaceId = first.workspaces[0]!.id;
    const staleCookie = String(ownerResponse.headers['set-cookie']).split(';', 1)[0]!;
    const csrf = String(ownerResponse.headers['x-openlinear-csrf-token']);
    const teams = await app.inject({
      url: `/api/v1/workspaces/${workspaceId}/teams`,
      headers: { host: host(config), cookie: staleCookie },
    });
    const teamId = (teams.json().data as Array<{ id: string }>)[0]!.id;
    expect((await app.inject({
      method: 'POST',
      url: `/api/v1/workspaces/${workspaceId}/projects`,
      headers: unsafe(config, { cookie: staleCookie, 'x-openlinear-csrf': csrf }),
      payload: { teamId, name: 'Restart proof', idempotencyKey: 'restart-proof' },
    })).statusCode).toBe(201);
    await app.close();
    expect(existsSync(`${config.databasePath}-shm`)).toBe(false);
    expect(existsSync(`${config.databasePath}-wal`)).toBe(false);

    app = await buildApp({ config, logger: false });
    try {
      expect((await app.inject({
        url: '/api/v1/session',
        headers: { host: host(config), cookie: staleCookie },
      })).statusCode).toBe(401);
      const renewed = await app.inject({
        method: 'POST',
        url: '/api/v1/local-owner-session',
        headers: unsafe(config),
        payload: {},
      });
      expect(renewed.statusCode).toBe(200);
      expect(renewed.json().data).toMatchObject({
        user: { id: first.user.id },
        workspaces: [{ id: workspaceId }],
      });
      const renewedCookie = String(renewed.headers['set-cookie']).split(';', 1)[0]!;
      const projects = await app.inject({
        url: `/api/v1/workspaces/${workspaceId}/projects`,
        headers: { host: host(config), cookie: renewedCookie },
      });
      expect(projects.json().data).toEqual([expect.objectContaining({ name: 'Restart proof' })]);
    } finally {
      await app.close();
    }
  });

  it('reports corrupt files and rolls back a rejected schema migration', async () => {
    const root = await temporaryDirectory('openlinear-migration');
    const corrupt = join(root, 'corrupt.sqlite3');
    await writeFile(corrupt, 'not a SQLite database');
    expect(() => createDatabase(corrupt)).toThrow('database is corrupt');

    const rejected = join(root, 'rejected.sqlite3');
    const raw = new DatabaseSync(rejected);
    raw.exec(`
      CREATE TABLE owner_profile (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        id TEXT NOT NULL,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        revision INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 1;
    `);
    raw.close();
    expect(() => createDatabase(rejected)).toThrow('could not be opened or migrated');
    const readback = new DatabaseSync(rejected, { readOnly: true });
    expect((readback.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
      .toBe(1);
    expect((readback.prepare('PRAGMA table_info(owner_profile)').all() as Array<{ name: string }>)
      .map((column) => column.name)).not.toContain('password_hash');
    readback.close();
  });
});
