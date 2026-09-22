import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

async function text(path: string): Promise<string> {
  return readFile(join(root, path), 'utf8');
}

async function runtimeFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await runtimeFiles(relative));
    else output.push(relative);
  }
  return output;
}

describe('P-T03 locked foundation', () => {
  it('publishes the exact shared TypeScript configuration and typechecks this workspace', async () => {
    const [manifestText, rootConfigText, sharedConfigText] = await Promise.all([
      text('packages/config/package.json'),
      text('tsconfig.json'),
      text('packages/config/typescript.json'),
    ]);
    const manifest = JSON.parse(manifestText) as {
      scripts?: Record<string, string>;
      exports?: Record<string, string>;
    };
    expect(manifest.scripts?.typecheck).toBe('tsc -p tsconfig.json --noEmit');
    expect(manifest.exports?.['./typescript']).toBe('./typescript.json');
    expect(JSON.parse(sharedConfigText)).toEqual(JSON.parse(rootConfigText));
  });

  it('locks one loopback Node process to one embedded SQLite file', async () => {
    const [pkg, config, entry, database, paths] = await Promise.all([
      text('package.json'),
      text('apps/api/src/config.ts'),
      text('apps/api/src/index.ts'),
      text('packages/db/src/sqlite/client.ts'),
      text('packages/db/src/sqlite/paths.ts'),
    ]);
    expect(pkg).toContain('"start": "node apps/api/dist/index.js"');
    expect(pkg).not.toContain('"start": "npm run start -w @basiclinear/api"');
    expect(pkg).toContain('"build": "node scripts/clean-build-output.mjs');
    expect(pkg).not.toContain('compose:');
    expect(config).toContain("host !== '127.0.0.1' && host !== '::1'");
    expect(config).toContain("publicOrigin: `http://${originHost}:${port}`");
    expect(entry).toContain('buildApp({ config, serveWeb: true })');
    expect(entry).toContain('app.listen({ host: config.host, port: config.port })');
    expect(database).toContain("from 'node:sqlite'");
    expect(paths).toContain("databasePath: join(dataDirectory, 'basiclinear.sqlite3')");
  });

  it('uses a single exact npm lock without ranged external versions', async () => {
    const lock = JSON.parse(await text('package-lock.json')) as {
      lockfileVersion: number;
      packages: Record<string, { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>;
    };
    expect(lock.lockfileVersion).toBe(3);
    for (const [path, pkg] of Object.entries(lock.packages)) {
      if (path.includes('node_modules')) continue;
      for (const [name, version] of Object.entries({
        ...pkg.dependencies,
        ...pkg.devDependencies,
      })) {
        if (name.startsWith('@basiclinear/')) expect(version).toBe('*');
        else expect(version).not.toMatch(/^[~^><=*]/);
      }
    }
  });

  it('keeps local mode credential-free and separates documented hosted configuration', async () => {
    const files = [
      ...await runtimeFiles('apps'),
      ...await runtimeFiles('packages'),
      ...await runtimeFiles('ops'),
    ].filter((path) => !path.includes('/dist/'));
    const runtime = (await Promise.all(files.map(text))).join('\n');
    expect(runtime).not.toMatch(/https?:\/\/(?:[^\s/]+\.)?(?:linear\.app|googleapis\.com)/i);
    const environment = await text('.env.example');
    expect(environment).toContain('needs no environment file');
    const [localEnvironment = '', hostedEnvironment = ''] = environment.split(
      '# BasicLinear Online public Firebase web configuration.',
    );
    expect(localEnvironment).not.toMatch(/TOKEN|PASSWORD|DATABASE_URL|OIDC/);
    expect(hostedEnvironment).toContain('BASICLINEAR_PERSONAL_TOKEN_SECRET=');
    expect(hostedEnvironment).toContain('BASICLINEAR_REST_CURSOR_SECRET=');
    for (const line of hostedEnvironment.split('\n')) {
      if (/^(?:BASICLINEAR_.+_SECRET|VITE_FIREBASE_API_KEY)=/u.test(line)) {
        expect(line.endsWith('=')).toBe(true);
      }
    }
    const vite = await text('apps/web/vite.config.ts');
    expect(vite).toContain("'/api': 'http://127.0.0.1:4174'");
    expect(vite).toContain('sourcemap: false');
  });
});
