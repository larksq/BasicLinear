import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { build, type Plugin, type UserConfig, type UserConfigFnObject } from 'vite';
import { bootstrapHostedOwner, HostedApiError } from '../src/hosted-api.js';
import viteConfig, {
  hostedBuildMode,
  localBuildMode,
  vercelHostedBuildMode,
} from '../vite.config.js';

const read = (path: string): string => readFileSync(path, 'utf8');
const productionConfig = (mode: string): UserConfig => (viteConfig as UserConfigFnObject)({
  command: 'build',
  mode,
});
const stableBuildArtifacts = (result: unknown): Array<Record<string, unknown>> => {
  const builds = (Array.isArray(result) ? result : [result]) as Array<{
    output: Array<{fileName: string; type: string; code?: string; source?: string | Uint8Array}>;
  }>;
  return builds.flatMap(({ output }) => output.map((artifact) => ({
    fileName: artifact.fileName,
    type: artifact.type,
    content: artifact.code
      ?? (typeof artifact.source === 'string'
        ? artifact.source
        : artifact.source === undefined
          ? null
          : Array.from(artifact.source)),
  }))).sort((left, right) => String(left.fileName).localeCompare(String(right.fileName)));
};

describe('hosted entry and Firebase Hosting contract', () => {
  it('keeps local and hosted HTML entries separate', () => {
    const local = read('apps/web/index.html');
    const hosted = read('apps/web/hosted.html');
    expect(local).toContain('/src/main.tsx');
    expect(local).not.toContain('/src/hosted-main.tsx');
    expect(hosted).toContain('/src/hosted-main.tsx');
    expect(hosted).not.toContain('/src/main.tsx');
  });

  it('builds hosted production assets in a graph that cannot load the local entry', async () => {
    const packageManifest = JSON.parse(read('apps/web/package.json')) as {scripts: {build: string}};
    expect(packageManifest.scripts.build).toContain(`vite build --mode ${localBuildMode}`);
    expect(packageManifest.scripts.build).toContain(`vite build --mode ${hostedBuildMode}`);

    const local = productionConfig(localBuildMode);
    const hosted = productionConfig(hostedBuildMode);
    const vercelHosted = productionConfig(vercelHostedBuildMode);
    expect(local.build?.emptyOutDir).toBe(true);
    expect(local.build?.rolldownOptions?.input).toEqual({
      local: resolve('apps/web/index.html'),
    });
    expect(hosted.build?.emptyOutDir).toBe(false);
    expect(hosted.build?.rolldownOptions?.input).toEqual({
      hosted: resolve('apps/web/hosted.html'),
    });
    expect(vercelHosted.build?.emptyOutDir).toBe(true);
    expect(vercelHosted.build?.rolldownOptions?.input).toEqual({
      hosted: resolve('apps/web/hosted.html'),
    });

    const transformedHtmlEntries: string[] = [];
    const transformedModules: string[] = [];
    const boundaryProbe: Plugin = {
      name: 'openlinear-hosted-build-boundary-probe',
      enforce: 'pre',
      transformIndexHtml(html, context) {
        transformedHtmlEntries.push(context.filename);
        return html;
      },
      transform(_code, id) {
        const sourcePath = id.split('?', 1)[0]?.replaceAll('\\', '/') ?? id;
        transformedModules.push(sourcePath);
        if (sourcePath.endsWith('/src/main.tsx')) {
          throw new Error('The hosted build loaded the local application entry.');
        }
        return null;
      },
    };

    const hostedBuildOptions: UserConfig = {
      ...hosted,
      configFile: false,
      mode: hostedBuildMode,
      root: resolve('apps/web'),
      logLevel: 'silent',
      plugins: [...(hosted.plugins ?? []), boundaryProbe],
      build: {
        ...hosted.build,
        emptyOutDir: false,
        write: false,
      },
    };
    const baselineOutput = await build(hostedBuildOptions);

    let localMutationApplications = 0;
    const localEntryMutation: Plugin = {
      name: 'openlinear-local-entry-mutation-probe',
      enforce: 'pre',
      transformIndexHtml(html, context) {
        if (context.filename.replaceAll('\\', '/').endsWith('/apps/web/index.html')) {
          localMutationApplications += 1;
          return html.replace('/src/main.tsx', '/src/hosted-main.tsx');
        }
        return html;
      },
    };
    const mutatedLocalEntryOutput = await build({
      ...hostedBuildOptions,
      plugins: [...(hostedBuildOptions.plugins ?? []), localEntryMutation],
    });

    expect(new Set(transformedHtmlEntries.map((entry) => entry.replaceAll('\\', '/')))).toEqual(new Set([
      resolve('apps/web/hosted.html').replaceAll('\\', '/'),
    ]));
    expect(localMutationApplications).toBe(0);
    expect(stableBuildArtifacts(mutatedLocalEntryOutput)).toEqual(stableBuildArtifacts(baselineOutput));
    expect(transformedModules.some((id) => id.endsWith('/src/hosted-main.tsx'))).toBe(true);
    expect(transformedModules.some((id) => id.endsWith('/src/main.tsx'))).toBe(false);
  });

  it('routes only API, MCP, and OAuth service paths to the trusted Cloud Run service', () => {
    const config = JSON.parse(read('firebase.json')) as {
      hosting: {public: string; ignore: string[]; rewrites: Array<Record<string, unknown>>};
      firestore: {rules: string};
    };
    expect(config.hosting.public).toBe('apps/web/dist');
    expect(config.hosting.ignore).toContain('index.html');
    expect(config.firestore.rules).toBe('firestore.rules');
    expect(config.hosting.rewrites).toEqual([
      { source: '/.well-known/**', run: { serviceId: 'openlinear-hosted-api', region: 'us-central1' } },
      { source: '/api/**', run: { serviceId: 'openlinear-hosted-api', region: 'us-central1' } },
      { source: '/mcp', run: { serviceId: 'openlinear-hosted-api', region: 'us-central1' } },
      { source: '/oauth/**', run: { serviceId: 'openlinear-hosted-api', region: 'us-central1' } },
      { source: '**', destination: '/hosted.html' },
    ]);
    expect(read('firestore.rules')).toContain('allow read, write: if false;');
  });

  it('keeps Google entry and separate local authority without app-entry marketing', () => {
    const source = read('apps/web/src/hosted-app.tsx');
    const login = read('apps/web/src/hosted-login.tsx');
    expect(login).toContain('Continue with Google');
    expect(login).toContain('Signing in won’t upload your local workspaces.');
    expect(login).not.toContain('hosted-price-row');
    expect(source).toContain('Google sign-in works.');
    expect(source).toContain('No workspace, trial, Firestore application record, Checkout session, subscription, or charge was created.');
    expect(source).not.toContain('local-owner-session');
    expect(source).not.toMatch(/code review|pull request|repository/i);
  });

  it('sends the Firebase ID token and retry key only to the same-origin bootstrap route', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: {
      created: true,
      user: { id: 'uid', email: 'owner@example.com', displayName: null, provider: 'google.com' },
      workspace: { id: 'ws_1', name: 'OpenLinear workspace', authority: 'firebase-hosted' },
      membership: { id: 'mem_1', role: 'owner', status: 'active' },
      trial: {
        id: 'trial_1', plan: 'pro', status: 'active',
        startedAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-01-31T00:00:00.000Z', durationDays: 30,
      },
    } }), { status: 201, headers: { 'content-type': 'application/json' } }));

    const result = await bootstrapHostedOwner('firebase-id-token-value', 'retry-key-value-0001', fetcher);
    expect(result.workspace.authority).toBe('firebase-hosted');
    expect(fetcher).toHaveBeenCalledOnce();
    const [path, init] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe('/api/v1/hosted/bootstrap');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        authorization: 'Bearer firebase-id-token-value',
        'idempotency-key': 'retry-key-value-0001',
      },
    });
  });

  it('returns a bounded API error without echoing the submitted token', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'A verified Google session is required.', correlationId: 'request-1' },
    }), { status: 401, headers: { 'content-type': 'application/json' } }));
    const promise = bootstrapHostedOwner('never-echo-this-token', 'retry-key-value-0002', fetcher);
    await expect(promise).rejects.toBeInstanceOf(HostedApiError);
    await expect(promise).rejects.not.toThrow(/never-echo-this-token/);
  });
});
