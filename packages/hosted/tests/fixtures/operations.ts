import {
  HostedOperationsControl,
  HostedOperationsService,
  MemoryHostedOperationsRepository,
  MemoryHostedOperationsTelemetrySink,
} from '../../src/index.js';

export function hostedOperationsForHttpTests(clock: () => Date = () => new Date()): {
  operationsControl: HostedOperationsControl;
  operationsService: HostedOperationsService;
  budgetNoticeVerifier: {verifyPubSubToken(token: string): Promise<void>};
} {
  const secret = 'hosted-http-operations-secret-value-0000000000000001';
  return {
    operationsControl: new HostedOperationsControl({
      secret,
      sink: new MemoryHostedOperationsTelemetrySink(),
      clock,
    }),
    operationsService: new HostedOperationsService(
      new MemoryHostedOperationsRepository(),
      {secret, environment: 'uat', clock},
    ),
    budgetNoticeVerifier: {
      verifyPubSubToken: async (token) => {
        if (token !== 'verified-pubsub-oidc-token-'.padEnd(80, 'x')) {
          throw new Error('invalid provider token');
        }
      },
    },
  };
}
