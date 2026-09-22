import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type HostedServerHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<void>;

function reportContainedFailure(correlationId: string): void {
  try {
    console.error(JSON.stringify({
      severity: 'ERROR',
      message: 'BasicLinear hosted request handler rejected unexpectedly.',
      component: 'hosted-server-boundary',
      correlationId,
    }));
  } catch {
    // The final containment boundary must not create another rejected promise.
  }
}

function closeOrWriteUnavailable(response: ServerResponse, correlationId: string): void {
  try {
    if (response.destroyed || response.writableEnded) return;
    if (response.headersSent) {
      response.end();
      return;
    }
    const body = JSON.stringify({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The hosted service is temporarily unavailable.',
        correlationId,
      },
    });
    response.writeHead(503, {
      'cache-control': 'no-store',
      'connection': 'close',
      'content-length': String(Buffer.byteLength(body, 'utf8')),
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'x-basiclinear-request-id': correlationId,
    });
    response.end(body);
  } catch {
    try {
      response.destroy();
    } catch {
      // Nothing remains to contain after the response transport itself fails.
    }
  }
}

export function runHostedServerHandler(
  handler: HostedServerHandler,
  request: IncomingMessage,
  response: ServerResponse,
  correlationIdFactory: () => string = randomUUID,
): void {
  void Promise.resolve()
    .then(async () => handler(request, response))
    .catch(() => {
      let correlationId = 'hosted-server-failure';
      try {
        correlationId = correlationIdFactory();
      } catch {
        // Keep a fixed non-private identifier when entropy is unavailable.
      }
      reportContainedFailure(correlationId);
      closeOrWriteUnavailable(response, correlationId);
    });
}
