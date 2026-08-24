import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const publicRoot = join(moduleDir, 'public');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

function safePath(root, pathname) {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const candidate = normalize(join(root, relativePath));
  return candidate.startsWith(`${root}/`) || candidate === root ? candidate : null;
}

export function createPrototypeServer({ root = publicRoot } = {}) {
  return createHttpServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') {
      response.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(JSON.stringify({ status: 'ready', fixture: 'ct-4', issueCount: 2000 }));
      return;
    }

    const candidate = safePath(root, url.pathname);
    if (!candidate || !existsSync(candidate) || !statSync(candidate).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-type': contentTypes.get(extname(candidate)) ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': `default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors ${url.searchParams.get('qa-frame') === '1' ? "'self'" : "'none'"}`,
    });
    createReadStream(candidate).pipe(response);
  });
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  const port = Number.parseInt(process.env.PORT ?? '4174', 10);
  const server = createPrototypeServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`CT-4 prototype ready at http://127.0.0.1:${port}`);
  });
}
