import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleHostedOperationsTelemetrySink } from '../src/operations-telemetry.js';

describe('ConsoleHostedOperationsTelemetrySink', () => {
  afterEach(() => vi.restoreAllMocks());

  it('emits one structured Cloud Logging event with trace correlation and opaque fingerprints only', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    new ConsoleHostedOperationsTelemetrySink('openlinear-prod-1').write({
      schemaVersion: 'openlinear.hosted-operations-telemetry.v1',
      id: 'request:request-telemetry-00000001',
      occurredAt: '2026-08-01T00:00:00.000Z',
      correlationId: 'request-telemetry-00000001',
      routeClass: 'authenticated_write',
      method: 'POST',
      statusCode: 429,
      outcome: 'rejected',
      durationMilliseconds: 12,
      networkFingerprint: 'a'.repeat(64),
      credentialFingerprint: 'b'.repeat(64),
      workspaceFingerprint: 'c'.repeat(64),
      traceId: 'd'.repeat(32),
      limited: true,
    });
    expect(info).toHaveBeenCalledTimes(1);
    const raw = info.mock.calls[0]?.[0] as string;
    expect(JSON.parse(raw)).toMatchObject({
      severity: 'WARNING',
      component: 'hosted-operations',
      statusCode: 429,
      limited: true,
      ['logging.googleapis.com/trace']: `projects/openlinear-prod-1/traces/${'d'.repeat(32)}`,
    });
    expect(raw).not.toContain('Bearer ');
    expect(raw).not.toContain('example.com');
  });
});
