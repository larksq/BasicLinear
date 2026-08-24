import { lstat, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { AppError } from '@openlinear/domain';
import type { FastifyReply, FastifyRequest } from 'fastify';

const mediaTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export async function assertWebBuild(webRoot: string): Promise<void> {
  try {
    const [root, index] = await Promise.all([lstat(webRoot), lstat(resolve(webRoot, 'index.html'))]);
    if (!root.isDirectory() || root.isSymbolicLink() || !index.isFile() || index.isSymbolicLink()) {
      throw new Error('invalid web build');
    }
  } catch (error) {
    throw new AppError(
      'SERVICE_UNAVAILABLE',
      'The built web application is unavailable. Run npm run build before npm start.',
      503,
      { field: 'webRoot', cause: error },
    );
  }
}

async function regularFile(path: string): Promise<boolean> {
  try {
    const stat = await lstat(path);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export async function sendWebApp(
  webRoot: string,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const rawPath = request.url.split('?', 1)[0] ?? '/';
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    return false;
  }
  if (pathname.startsWith('/api/') || pathname.startsWith('/health/')) return false;

  const root = resolve(webRoot);
  const requested = resolve(root, `.${pathname}`);
  if (requested !== root && !requested.startsWith(`${root}${sep}`)) return false;
  const hasExtension = extname(pathname) !== '';
  if (hasExtension && !await regularFile(requested)) return false;
  const file = hasExtension ? requested : resolve(root, 'index.html');
  if (!await regularFile(file)) return false;

  const extension = extname(file).toLowerCase();
  const body = await readFile(file);
  reply
    .type(mediaTypes[extension] ?? 'application/octet-stream')
    .header('cache-control', extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
    .send(body);
  return true;
}
