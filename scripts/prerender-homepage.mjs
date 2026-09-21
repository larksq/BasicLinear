import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer, loadEnv } from 'vite';

const webRoot = resolve(import.meta.dirname, '../apps/web');
const output = resolve(webRoot, process.argv[2] ?? 'dist');
const mode = process.argv[3] ?? 'openlinear-hosted-vercel';
const env = { ...loadEnv(mode, webRoot, 'VITE_'), ...process.env };
const canonical = 'https://openlinear.qiaosun.me/';

// Fail closed for local builds and development/preview provider environments.
// The default public/robots.txt and hosted.html both exclude indexing.
if (env.VITE_OPENLINEAR_DEPLOYMENT_ENVIRONMENT !== 'production') {
  await Promise.all(['homepage.html', 'sitemap.xml'].map(file => rm(resolve(output, file), { force: true })));
  await writeFile(resolve(output, 'robots.txt'), await readFile(resolve(webRoot, 'public/robots.txt')));
  console.info('Public search artifacts skipped outside the production provider environment.');
} else {
  const vite = await createServer({
    root: webRoot,
    mode,
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
  });
  let markup;
  try {
    const { Homepage } = await vite.ssrLoadModule('/src/homepage.tsx');
    markup = renderToString(createElement(Homepage));
  } finally {
    await vite.close();
  }
  if (!markup.includes('<h1') || !markup.includes('OpenLinear')) {
    throw new Error('The public homepage did not render indexable content.');
  }
  const shell = await readFile(resolve(output, 'hosted.html'), 'utf8');
  if (!shell.includes('<div id="root"></div>')) throw new Error('Hosted HTML root is missing.');
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'OpenLinear',
    alternateName: 'OpenLinear Online',
    url: canonical,
    description: 'Independent, open-source project management for projects, milestones, and issues. Run locally or use a shared workspace online.',
    inLanguage: 'en',
  };
  const metadata = [
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    '<meta property="og:site_name" content="OpenLinear" />',
    `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
  const homepage = shell
    .replace(/\s*<meta name="robots"[^>]*\/>/u, '')
    .replace('</head>', `    ${metadata}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${markup}</div>`);
  await writeFile(resolve(output, 'homepage.html'), homepage);
  await writeFile(resolve(output, 'robots.txt'), [
    '# The public homepage and its assets are crawlable. App documents use noindex.',
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /oauth/',
    'Disallow: /mcp',
    '',
    `Sitemap: ${canonical}sitemap.xml`,
    '',
  ].join('\n'));
  await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${canonical}</loc></url>\n</urlset>\n`);
  console.info('Prerendered the public homepage, canonical metadata, robots.txt, and sitemap.xml.');
}
