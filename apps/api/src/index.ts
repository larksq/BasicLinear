import { prepareLocalStorage } from '@basiclinear/db/sqlite';
import { buildApp } from './app.js';
import { loadApiConfig } from './config.js';
import { assertWebBuild } from './static-app.js';

try {
  const config = loadApiConfig();
  prepareLocalStorage(config);
  await assertWebBuild(config.webRoot);
  const app = await buildApp({ config, serveWeb: true });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await app.close();
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);

  await app.listen({ host: config.host, port: config.port });
  app.log.info({
    origin: config.publicOrigin,
    database: config.databasePath,
    backups: config.backupDirectory,
  }, 'BasicLinear local runtime ready');
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  process.stderr.write(`BasicLinear could not start: ${message}\n`);
  process.exitCode = 1;
}
