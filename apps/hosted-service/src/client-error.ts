import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

interface ClientErrorEnvelope {
  error: {
    code: 'INVALID_REQUEST';
    message: string;
    correlationId: string;
  };
}

export function hostedClientErrorResponse(correlationId: string): Buffer {
  const body: ClientErrorEnvelope = {
    error: {
      code: 'INVALID_REQUEST',
      message: 'The request framing is invalid.',
      correlationId,
    },
  };
  const serialized = JSON.stringify(body);
  return Buffer.from([
    'HTTP/1.1 400 Bad Request',
    'Connection: close',
    'Cache-Control: no-store',
    'Content-Type: application/json; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(serialized, 'utf8')}`,
    'X-Content-Type-Options: nosniff',
    `X-OpenLinear-Request-Id: ${correlationId}`,
    '',
    serialized,
  ].join('\r\n'), 'utf8');
}

export function installHostedClientErrorHandler(
  server: Server,
  correlationIdFactory: () => string = randomUUID,
): void {
  server.on('clientError', (_error, socket) => {
    if (!socket.writable) return;
    socket.end(hostedClientErrorResponse(correlationIdFactory()));
  });
}
