import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, TransportError } from '../src/api.js';
import { ConnectionBanner } from '../src/components.js';

const root = process.cwd();

async function source(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local service recovery', () => {
  it('normalizes same-origin transport failures without leaking browser diagnostics', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Browser-specific fetch failure'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.session()).rejects.toEqual(expect.objectContaining({
      name: 'TransportError',
      code: 'LOCAL_SERVICE_UNAVAILABLE',
      message: 'The local OpenLinear service could not be reached.',
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/session', expect.objectContaining({
      credentials: 'same-origin',
    }));
    expect(new TransportError()).toBeInstanceOf(Error);
  });

  it('probes only the loopback health route and rejects non-ready responses', async () => {
    const readyFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ready' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', readyFetch);
    await expect(api.health()).resolves.toEqual({ status: 'ready' });
    expect(readyFetch).toHaveBeenCalledWith('/health/ready', {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' },
    });

    const unavailableFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'unavailable' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', unavailableFetch);
    await expect(api.health()).rejects.toEqual(expect.objectContaining({
      name: 'ApiError',
      status: 503,
      code: 'LOCAL_SERVICE_NOT_READY',
    }));
  });

  it('renders one actionable disconnect alert and one non-interactive reconnect status', () => {
    const unavailable = renderToStaticMarkup(createElement(ConnectionBanner, {
      error: new ApiError(503, {
        error: {
          code: 'LOCAL_SERVICE_NOT_READY',
          message: 'The database is still opening.',
          correlationId: 'corr-service-01',
        },
      }),
      reconnected: false,
      checking: false,
      onRetry: () => undefined,
    }));
    expect(unavailable.match(/role="alert"/g)).toHaveLength(1);
    expect(unavailable).toContain('aria-live="assertive"');
    expect(unavailable).toContain('<strong>Local service unavailable</strong>');
    expect(unavailable).toContain('Open drafts stay on this page while it reconnects.');
    expect(unavailable).toContain('<code>corr-service-01</code>');
    expect(unavailable).toContain('Try now</button>');

    const reconnected = renderToStaticMarkup(createElement(ConnectionBanner, {
      error: null,
      reconnected: true,
      checking: false,
      onRetry: () => undefined,
    }));
    expect(reconnected.match(/role="status"/g)).toHaveLength(1);
    expect(reconnected).toContain('aria-live="polite"');
    expect(reconnected).toContain('<strong>Local service reconnected</strong>');
    expect(reconnected).not.toContain('<button');
    expect(reconnected).not.toContain('role="alert"');
  });

  it('distinguishes owner-session recovery progress and failure from a service outage', () => {
    const recovering = renderToStaticMarkup(createElement(ConnectionBanner, {
      error: null,
      recoveryError: null,
      reconnected: false,
      checking: false,
      recovering: true,
      onRetry: () => undefined,
    }));
    expect(recovering.match(/role="status"/g)).toHaveLength(1);
    expect(recovering).toContain('<strong>Restoring local session</strong>');
    expect(recovering).not.toContain('role="alert"');
    expect(recovering).not.toContain('<button');

    const failed = renderToStaticMarkup(createElement(ConnectionBanner, {
      error: null,
      recoveryError: new ApiError(401, {
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'The local session could not be restored.',
          correlationId: 'corr-session-01',
        },
      }),
      reconnected: false,
      checking: false,
      recovering: false,
      onRetry: () => undefined,
    }));
    expect(failed.match(/role="alert"/g)).toHaveLength(1);
    expect(failed).toContain('<strong>Local session recovery failed</strong>');
    expect(failed).toContain('<code>corr-session-01</code>');
    expect(failed).toContain('Try now</button>');
  });

  it('locks retry only during a health check', () => {
    const markup = renderToStaticMarkup(createElement(ConnectionBanner, {
      error: new TransportError(),
      reconnected: false,
      checking: true,
      onRetry: () => undefined,
    }));
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('<button type="button" class="button" disabled=""');
    expect(markup).toContain('class="lucide lucide-loader-circle spinner"');
    expect(markup).toContain('Checking</button>');
  });

  it('binds bootstrap, polling, reconnect refresh, and navigator-independent queries', async () => {
    const [app, main, issues] = await Promise.all([
      source('apps/web/src/App.tsx'),
      source('apps/web/src/main.tsx'),
      source('apps/web/src/issues.tsx'),
    ]);

    expect(app).toContain("queryKey: ['local-service-health']");
    expect(app).toContain('queryFn: api.health');
    expect(app).toContain('LOCAL_SERVICE_READY_INTERVAL_MS');
    expect(app).toContain('LOCAL_SERVICE_RETRY_INTERVAL_MS');
    expect(app).toContain('renewSession: api.localOwnerSession');
    expect(app.indexOf('renewSession: api.localOwnerSession')).toBeLessThan(
      app.indexOf('refreshActiveQueries: () => client.invalidateQueries'),
    );
    expect(app).toContain("query.queryKey[0] !== 'local-service-health'");
    expect(app).toContain('[client, workspaceId, serviceSessionEpoch]');
    expect(app).toContain("session.error instanceof ApiError && session.error.code === 'AUTHENTICATION_REQUIRED'");
    expect(app.indexOf('if (serviceHealth.error !== null) return (')).toBeLessThan(
      app.indexOf("session.error instanceof ApiError && session.error.code === 'AUTHENTICATION_REQUIRED'"),
    );
    expect(app).toContain('<ConnectionBanner');
    expect(main).toContain("queries: { staleTime: 20_000, retry: false, refetchOnWindowFocus: false, networkMode: 'always' }");
    expect(main).toContain("mutations: { retry: false, networkMode: 'always' }");
    expect(issues).not.toContain('navigator.onLine');
    expect(issues).not.toContain("window.addEventListener('offline'");
    expect(issues).not.toContain('className="offline-banner"');
  });

  it('reserves app-wide desktop and mobile geometry for long diagnostics', async () => {
    const styles = await source('apps/web/src/styles.css');

    expect(styles).toContain('.connection-banner { position: sticky; top: var(--ol-topbar-height); z-index: 9; min-height: 46px; display: grid; grid-template-columns: 20px minmax(0, 1fr) auto;');
    expect(styles).toContain('.connection-banner-copy strong, .connection-banner-copy span, .connection-banner-copy code { min-width: 0; overflow-wrap: anywhere; }');
    expect(styles).toContain('.connection-banner.reconnected { grid-template-columns: 20px minmax(0, 1fr);');
    expect(styles).toContain('.connection-banner { grid-template-columns: 20px minmax(0, 1fr); align-items: start; padding-inline: 14px; }');
    expect(styles).toContain('.connection-banner > .button { grid-column: 2; justify-self: start; }');
    expect(styles).not.toContain('.offline-banner, .archive-banner');
  });
});
