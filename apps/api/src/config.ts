import { fileURLToPath } from 'node:url';
import { resolveLocalStoragePaths, type LocalPathRuntime } from '@openlinear/db/sqlite';
import { AppError } from '@openlinear/domain';

export interface ApiConfig {
  host: '127.0.0.1' | '::1';
  port: number;
  environment: 'development' | 'test' | 'production';
  publicOrigin: string;
  dataDirectory: string;
  databasePath: string;
  backupDirectory: string;
  webRoot: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
}

function serviceError(message: string, field: string): AppError {
  return new AppError('SERVICE_UNAVAILABLE', message, 503, { field });
}

export function loadApiConfig(
  env: NodeJS.ProcessEnv = process.env,
  runtime: LocalPathRuntime = {},
): ApiConfig {
  const environmentValue = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(environmentValue)) {
    throw serviceError('NODE_ENV is invalid.', 'NODE_ENV');
  }

  const host = (env.OPENLINEAR_HOST ?? env.HOST ?? '127.0.0.1').trim();
  if (host !== '127.0.0.1' && host !== '::1') {
    throw serviceError(
      'OpenLinear supports loopback access only. OPENLINEAR_HOST must be 127.0.0.1 or ::1.',
      'OPENLINEAR_HOST',
    );
  }

  const port = Number(env.OPENLINEAR_PORT ?? env.PORT ?? '4174');
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw serviceError('OPENLINEAR_PORT must be an integer from 1 to 65535.', 'OPENLINEAR_PORT');
  }

  const sessionTtlSeconds = Number(env.OPENLINEAR_SESSION_TTL_SECONDS ?? 60 * 60 * 12);
  if (!Number.isSafeInteger(sessionTtlSeconds) || sessionTtlSeconds < 300 || sessionTtlSeconds > 86_400) {
    throw serviceError(
      'OPENLINEAR_SESSION_TTL_SECONDS must be an integer from 300 to 86400.',
      'OPENLINEAR_SESSION_TTL_SECONDS',
    );
  }

  const storage = resolveLocalStoragePaths(env, runtime);
  const originHost = host === '::1' ? '[::1]' : host;
  return {
    host,
    port,
    environment: environmentValue as ApiConfig['environment'],
    publicOrigin: `http://${originHost}:${port}`,
    ...storage,
    webRoot: env.OPENLINEAR_WEB_ROOT?.trim()
      || fileURLToPath(new URL('../../web/dist', import.meta.url)),
    sessionCookieName: 'ol_local_session',
    sessionTtlSeconds,
  };
}
