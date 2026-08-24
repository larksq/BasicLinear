import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createPrototypeServer } from '../server.mjs';

async function start() {
  const server = createPrototypeServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server;
}

async function health(server) {
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  return response.json();
}

test('server restart preserves deterministic health contract', async () => {
  const first = await start();
  const firstHealth = await health(first);
  first.close();
  await once(first, 'close');

  const second = await start();
  const secondHealth = await health(second);
  second.close();
  await once(second, 'close');

  assert.deepEqual(firstHealth, { status: 'ready', fixture: 'ct-4', issueCount: 2000 });
  assert.deepEqual(secondHealth, firstHealth);
});

test('responsive QA framing is opt-in and same-origin only', async () => {
  const server = await start();
  const address = server.address();
  const root = `http://127.0.0.1:${address.port}`;
  const defaultResponse = await fetch(`${root}/`);
  const qaResponse = await fetch(`${root}/?qa-frame=1`);
  await Promise.all([defaultResponse.arrayBuffer(), qaResponse.arrayBuffer()]);
  server.close();
  await once(server, 'close');

  assert.match(defaultResponse.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(qaResponse.headers.get('content-security-policy'), /frame-ancestors 'self'/);
});
