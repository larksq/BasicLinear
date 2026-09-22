import type { Firestore } from '@google-cloud/firestore';

export interface CreemCheckoutAttemptStore {
  claim(id: string): Promise<{state: 'new'} | {state: 'pending'} | {state: 'created'; checkoutId: string}>;
  complete(id: string, checkoutId: string): Promise<void>;
}

// Persist intent before contacting Creem: request_id is a tracking reference,
// and sandbox observations show that it does not deduplicate session creation.
export class FirestoreCreemCheckoutAttemptStore implements CreemCheckoutAttemptStore {
  constructor(private readonly firestore: Firestore) {}
  async claim(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('CREEM_ATTEMPT_INVALID');
    const ref = this.firestore.collection('creemCheckoutAttempts').doc(id);
    return this.firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        transaction.create(ref, {state: 'pending', createdAt: new Date().toISOString()});
        return {state: 'new' as const};
      }
      const data = snapshot.data();
      if (data?.state === 'created' && typeof data.checkoutId === 'string') {
        return {state: 'created' as const, checkoutId: data.checkoutId};
      }
      return {state: 'pending' as const};
    });
  }
  async complete(id: string, checkoutId: string) {
    const ref = this.firestore.collection('creemCheckoutAttempts').doc(id);
    await this.firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.data()?.state !== 'pending') throw new Error('CREEM_ATTEMPT_CONFLICT');
      transaction.update(ref, {state: 'created', checkoutId});
    });
  }
}

export class MemoryCreemCheckoutAttemptStore implements CreemCheckoutAttemptStore {
  private readonly attempts = new Map<string, string | null>();
  async claim(id: string) {
    if (!this.attempts.has(id)) {this.attempts.set(id, null); return {state: 'new' as const};}
    const checkoutId = this.attempts.get(id);
    return checkoutId ? {state: 'created' as const, checkoutId} : {state: 'pending' as const};
  }
  async complete(id: string, checkoutId: string) {this.attempts.set(id, checkoutId);}
}
