import type { Session } from '@openlinear/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createLocalServiceRecovery } from '../src/local-service-recovery.js';

const session: Session = {
  user: {
    id: 'owner-1',
    email: 'owner@openlinear.local',
    displayName: 'Owner',
    revision: 1,
  },
  workspaces: [{
    id: 'workspace-1',
    name: 'OpenLinear',
    slug: 'openlinear',
    role: 'owner',
    revision: 1,
    createdAt: '2026-08-22T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  }],
};

describe('local owner session recovery', () => {
  it('renews once, caches the session, and only then refreshes active queries', async () => {
    const order: string[] = [];
    let resolveRenewal: ((value: Session) => void) | undefined;
    const renewSession = vi.fn(() => new Promise<Session>((resolve) => {
      order.push('renew');
      resolveRenewal = resolve;
    }));
    const cacheSession = vi.fn(() => { order.push('cache'); });
    const refreshActiveQueries = vi.fn(async () => { order.push('refresh'); });
    const recovery = createLocalServiceRecovery({ renewSession, cacheSession, refreshActiveQueries });

    const first = recovery.recover();
    const duplicate = recovery.recover();
    expect(duplicate).toBe(first);
    expect(renewSession).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['renew']);

    resolveRenewal?.(session);
    await expect(first).resolves.toBe(session);
    expect(order).toEqual(['renew', 'cache', 'refresh']);
    expect(cacheSession).toHaveBeenCalledWith(session);
    expect(refreshActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('keeps failed renewal visible to the caller and permits an explicit retry', async () => {
    const renewSession = vi.fn()
      .mockRejectedValueOnce(new Error('session renewal failed'))
      .mockResolvedValueOnce(session);
    const cacheSession = vi.fn();
    const refreshActiveQueries = vi.fn(async () => undefined);
    const recovery = createLocalServiceRecovery({ renewSession, cacheSession, refreshActiveQueries });

    await expect(recovery.recover()).rejects.toThrow('session renewal failed');
    expect(cacheSession).not.toHaveBeenCalled();
    expect(refreshActiveQueries).not.toHaveBeenCalled();

    await expect(recovery.recover()).resolves.toBe(session);
    expect(renewSession).toHaveBeenCalledTimes(2);
    expect(cacheSession).toHaveBeenCalledTimes(1);
    expect(refreshActiveQueries).toHaveBeenCalledTimes(1);
  });

  it('does not hide a protected-query refresh failure', async () => {
    const renewSession = vi.fn().mockResolvedValue(session);
    const cacheSession = vi.fn();
    const refreshActiveQueries = vi.fn()
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValueOnce(undefined);
    const recovery = createLocalServiceRecovery({ renewSession, cacheSession, refreshActiveQueries });

    await expect(recovery.recover()).rejects.toThrow('refresh failed');
    expect(cacheSession).toHaveBeenCalledWith(session);

    await expect(recovery.recover()).resolves.toBe(session);
    expect(renewSession).toHaveBeenCalledTimes(2);
    expect(refreshActiveQueries).toHaveBeenCalledTimes(2);
  });
});
