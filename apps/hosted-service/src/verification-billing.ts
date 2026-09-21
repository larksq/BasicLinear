import type {
  BillingProvider,
  BillingProviderCheckoutSession,
  BillingProviderSubscription,
  BillingProviderSubscriptionUpdateExpectation,
  BillingPlan,
  VerifiedBillingNotice,
} from '@openlinear/hosted';

const disabled = (): Error => new Error('VERIFICATION_PAYMENT_PROVIDER_DISABLED');

export class VerificationBillingProvider implements BillingProvider {
  createCheckoutSession(_input: {
    checkoutReference: string;
    workspaceId: string;
    ownerUserId: string;
    plan: BillingPlan;
    priceId: string;
    quantity: number;
    idempotencyReference: string;
  }): Promise<BillingProviderCheckoutSession> {
    return Promise.reject(disabled());
  }

  recoverCheckoutSessions(_input: {
    checkoutReference: string;
    createdAt: string;
    attemptedAt: string;
  }): Promise<BillingProviderCheckoutSession[]> {
    return Promise.reject(disabled());
  }

  retrieveCheckoutSession(_sessionId: string): Promise<BillingProviderCheckoutSession> {
    return Promise.reject(disabled());
  }

  expireCheckoutSession(_sessionId: string): Promise<void> {
    return Promise.reject(disabled());
  }

  retrieveSubscription(_subscriptionId: string): Promise<BillingProviderSubscription> {
    return Promise.reject(disabled());
  }

  updateSubscriptionQuantity(_input: {
    subscriptionId: string;
    expected: BillingProviderSubscriptionUpdateExpectation;
    quantity: number;
    idempotencyReference: string;
    prorationBehavior: 'create_prorations';
  }): Promise<BillingProviderSubscription> {
    return Promise.reject(disabled());
  }

  verifyWebhook(_rawBody: Buffer, _signature: string): VerifiedBillingNotice | null {
    throw disabled();
  }
}
