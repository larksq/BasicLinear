import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import {
  hostedClientErrorResponse,
  installHostedClientErrorHandler,
} from '../src/client-error.js';

describe('hosted parser-error response', () => {
  it('returns a redacted JSON error with the universal security headers', () => {
    const response = hostedClientErrorResponse('parser-request-id');
    const [head, serialized] = response.toString('utf8').split('\r\n\r\n');
    expect(head).toContain('HTTP/1.1 400 Bad Request');
    expect(head).toContain('Connection: close');
    expect(head).toContain('Cache-Control: no-store');
    expect(head).toContain('Content-Type: application/json; charset=utf-8');
    expect(head).toContain('X-Content-Type-Options: nosniff');
    expect(head).toContain('X-OpenLinear-Request-Id: parser-request-id');
    expect(JSON.parse(serialized ?? '')).toEqual({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request framing is invalid.',
        correlationId: 'parser-request-id',
      },
    });
    expect(head).toContain(`Content-Length: ${Buffer.byteLength(serialized ?? '', 'utf8')}`);
  });

  it('installs one fail-closed clientError listener without echoing parser input', () => {
    const server = createServer();
    installHostedClientErrorHandler(server, () => 'fixed-parser-id');
    const writes: Buffer[] = [];
    const socket = {
      writable: true,
      end(value: Buffer) {
        writes.push(value);
        return socket;
      },
    };
    server.emit('clientError', new Error('raw private malformed framing'), socket);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.toString('utf8')).toContain('fixed-parser-id');
    expect(writes[0]?.toString('utf8')).not.toContain('raw private malformed framing');
    server.close();
  });
});
