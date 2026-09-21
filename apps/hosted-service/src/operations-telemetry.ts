import type {
  HostedOperationsTelemetryEvent,
  HostedOperationsTelemetrySink,
} from '@openlinear/hosted';

export class ConsoleHostedOperationsTelemetrySink implements HostedOperationsTelemetrySink {
  constructor(private readonly projectId: string | null) {}

  write(event: HostedOperationsTelemetryEvent): void {
    const trace = this.projectId !== null && event.traceId !== null
      ? `projects/${this.projectId}/traces/${event.traceId}`
      : undefined;
    const entry: Record<string, unknown> = {
      severity: event.statusCode >= 500 ? 'ERROR' : event.statusCode >= 400 ? 'WARNING' : 'INFO',
      message: 'OpenLinear hosted request completed.',
      component: 'hosted-operations',
      ...event,
    };
    if (trace !== undefined) entry['logging.googleapis.com/trace'] = trace;
    console.info(JSON.stringify(entry));
  }
}
