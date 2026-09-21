import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const root = resolve(import.meta.dirname, '../..');
const canonical = 'https://openlinear.qiaosun.me/';

test('production serves real public content while app HTML remains excluded; rebuilding for development removes public artifacts', async () => {
  const output = await mkdtemp(resolve(tmpdir(), 'openlinear-search-test-'));
  try {
    const shell = await readFile(resolve(root, 'apps/web/hosted.html'), 'utf8');
    await writeFile(resolve(output, 'hosted.html'), shell);
    const render = environment => execFileSync(process.execPath,
      [resolve(root, 'scripts/prerender-homepage.mjs'), output], {
        cwd: root,
        env: { ...process.env, VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT: environment },
        stdio: 'pipe',
        timeout: 30_000,
      });
    render('production');
    const homepage = await readFile(resolve(output, 'homepage.html'), 'utf8');
    assert.match(homepage, /<h1[^>]*>A little less overhead\./);
    assert.match(homepage, /id="product"/);
    assert.match(homepage, /href="\?app"/);
    assert.doesNotMatch(homepage, /<div id="root"><\/div>/);
    assert.doesNotMatch(homepage, /<meta name="robots"/);
    assert.equal((homepage.match(/rel="canonical"/g) ?? []).length, 1);
    assert.ok(homepage.includes(`<link rel="canonical" href="${canonical}"`));
    const schema = JSON.parse(homepage.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    assert.equal(schema.name, 'OpenLinear');
    assert.equal(schema.url, canonical);
    assert.equal(await readFile(resolve(output, 'hosted.html'), 'utf8'), shell);
    assert.match(shell, /<meta name="robots" content="noindex, nofollow, noarchive"/);
    const robots = await readFile(resolve(output, 'robots.txt'), 'utf8');
    assert.match(robots, /^Allow: \/$/m);
    assert.doesNotMatch(robots, /^Disallow: \/$/m);
    assert.ok(robots.includes(`Sitemap: ${canonical}sitemap.xml`));
    const sitemap = await readFile(resolve(output, 'sitemap.xml'), 'utf8');
    assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [canonical]);

    render('development');
    await assert.rejects(access(resolve(output, 'homepage.html')));
    await assert.rejects(access(resolve(output, 'sitemap.xml')));
    assert.match(await readFile(resolve(output, 'robots.txt'), 'utf8'), /^Disallow: \/$/m);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('fragment deep links, app queries, and other hosts receive noindex before the application runs', async () => {
  const script = await readFile(resolve(root, 'apps/web/public/openlinear-search-policy.js'), 'utf8');
  const cases = [
    [canonical, false],
    [`${canonical}?utm_source=community#product`, false],
    [`${canonical}?app`, true],
    [`${canonical}?utm_source=mail&app`, true],
    [`${canonical}?oauth_request=example`, true],
    [`${canonical}?oauth_workspace=select`, true],
    [`${canonical}#invite=example`, true],
    [`${canonical}#issue=example`, true],
    ['https://openlinear-gray.vercel.app/', true],
    ['https://openlinear-development.vercel.app/', true],
    ['http://localhost:5173/', true],
  ];
  for (const [url, excluded] of cases) {
    let robots;
    runInNewContext(script, {
      window: { location: new URL(url) },
      URLSearchParams,
      document: {
        querySelector: () => robots,
        createElement: () => ({}),
        head: { appendChild: element => { robots = element; } },
      },
    });
    assert.equal(robots?.content.includes('noindex') ?? false, excluded, url);
  }
});
