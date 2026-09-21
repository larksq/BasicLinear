import assert from 'node:assert/strict';

const origin = 'https://openlinear.qiaosun.me';
const results = [];
async function inspect(path, options = {}) {
  const url = new URL(path, origin);
  let response;
  // Retry transient transport failures, never failed HTTP or indexing assertions.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...options });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  const text = await response.text();
  const headers = Object.fromEntries(response.headers);
  results.push({ url: url.href, status: response.status, robots: headers['x-robots-tag'] ?? null,
    type: headers['content-type'], bytes: Buffer.byteLength(text) });
  return { response, text, headers };
}

const homepage = await inspect('/');
assert.equal(homepage.response.status, 200);
assert.ok(!homepage.headers['x-robots-tag']?.includes('noindex'));
assert.doesNotMatch(homepage.text, /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/i);
assert.match(homepage.text, /<h1[^>]*>A little less overhead\./);
assert.equal((homepage.text.match(/rel="canonical"/g) ?? []).length, 1);
assert.ok(homepage.text.includes(`<link rel="canonical" href="${origin}/"`));
assert.ok(homepage.text.includes('application/ld+json'));

const checks = [
  (async () => {
    const { response, text } = await inspect('/robots.txt');
    assert.equal(response.status, 200);
    assert.match(text, /^Allow: \/$/m);
    assert.doesNotMatch(text, /^Disallow: \/$/m);
    assert.ok(text.includes(`Sitemap: ${origin}/sitemap.xml`));
  })(),
  (async () => {
    const { response, text, headers } = await inspect('/sitemap.xml');
    assert.equal(response.status, 200);
    assert.match(headers['content-type'], /xml/);
    assert.deepEqual([...text.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [`${origin}/`]);
  })(),
  ...['/?app', '/?source=search&app', '/?oauth_request=seo-probe', '/?oauth_workspace=select', '/hosted.html'].map(async path => {
    const { response, text, headers } = await inspect(path);
    assert.equal(response.status, 200, path);
    assert.match(headers['x-robots-tag'] ?? '', /noindex/, path);
    assert.match(text, /<meta name="robots" content="noindex/, path);
    assert.doesNotMatch(text, /<h1[^>]*>A little less overhead\./, path);
  }),
  ...['https://openlinear-gray.vercel.app/', 'https://openlinear-development.vercel.app/'].map(async url => {
    const { response, headers } = await inspect(url);
    assert.equal(response.status, 200, url);
    assert.match(headers['x-robots-tag'] ?? '', /noindex/, url);
  }),
  (async () => {
    const { response, headers } = await inspect('/homepage.html');
    assert.equal(response.status, 308);
    assert.equal(headers.location, '/');
  })(),
  (async () => {
    const { response } = await inspect('/seo-missing-page-probe');
    assert.equal(response.status, 404);
  })(),
  (async () => {
    const { text, headers, response } = await inspect('/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    });
    assert.equal(response.status, 200);
    assert.ok(!headers['x-robots-tag']?.includes('noindex'));
    assert.equal(text, homepage.text, 'Googlebot and visitors must receive the same public content.');
  })(),
  ...[...homepage.text.matchAll(/(?:src|href)="(\/assets\/[^\"]+\.(?:js|css))"/g)].map(async ([, asset]) => {
    const { response, headers } = await inspect(asset);
    assert.equal(response.status, 200, asset);
    assert.ok(!headers['x-robots-tag']?.includes('noindex'), asset);
  }),
];
const settled = await Promise.allSettled(checks);
const failures = settled.filter(result => result.status === 'rejected');
console.info(JSON.stringify({ checkedAt: new Date().toISOString(), passed: failures.length === 0, results }, null, 2));
if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'Live search indexing checks failed.');
