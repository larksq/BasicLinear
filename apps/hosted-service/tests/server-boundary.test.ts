import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { runHostedServerHandler } from '../src/server-boundary.js';

async function nextTurn(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function responseFixture(input: {headersSent?: boolean} = {}) {
  let status = 0;
  let headers: Record<string, string> = {};
  let body = '';
  let ended = false;
  let destroyed = false;
  const response = {
    statusCode: 200,
    headersSent: input.headersSent ?? false,
    writableEnded: false,
    destroyed: false,
    writeHead(nextStatus: number, nextHeaders: Record<string, string>) {
      status = nextStatus;
      headers = nextHeaders;
      response.headersSent = true;
      return response;
    },
    end(value?: string) {
      body = value ?? '';
      ended = true;
      response.writableEnded = true;
      return response;
    },
    destroy() {
      destroyed = true;
      response.destroyed = true;
      return response;
    },
  } as unknown as ServerResponse;
  return {
    response,
    snapshot: () => ({status, headers, body, ended, destroyed}),
  };
}

describe('hosted top-level server boundary', () => {
  it('contains an unexpected handler rejection with one generic redacted 503', async () => {
    const context = responseFixture();
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runHostedServerHandler(
      async () => { throw new Error('private handler failure'); },
      {} as IncomingMessage,
      context.response,
      () => 'server-contained-request-0001',
    );
    await nextTurn();
    expect(context.snapshot()).toMatchObject({
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'connection': 'close',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
        'x-basiclinear-request-id': 'server-contained-request-0001',
      },
      ended: true,
      destroyed: false,
    });
    expect(JSON.parse(context.snapshot().body)).toEqual({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The hosted service is temporarily unavailable.',
        correlationId: 'server-contained-request-0001',
      },
    });
    expect(stderr).toHaveBeenCalledOnce();
    expect(JSON.stringify(stderr.mock.calls)).not.toContain('private handler failure');
    stderr.mockRestore();
  });

  it('only ends an already-started response after an unexpected rejection', async () => {
    const context = responseFixture({headersSent: true});
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    runHostedServerHandler(
      async () => { throw new Error('after headers'); },
      {} as IncomingMessage,
      context.response,
      () => 'server-contained-request-0002',
    );
    await nextTurn();
    expect(context.snapshot()).toEqual({
      status: 0,
      headers: {},
      body: '',
      ended: true,
      destroyed: false,
    });
    expect(stderr).toHaveBeenCalledOnce();
    stderr.mockRestore();
  });
});
