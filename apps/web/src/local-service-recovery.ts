import type { Session } from '@basiclinear/contracts';

interface LocalServiceRecoveryDependencies {
  renewSession: () => Promise<Session>;
  cacheSession: (session: Session) => void;
  refreshActiveQueries: () => Promise<unknown>;
}

export interface LocalServiceRecovery {
  recover: () => Promise<Session>;
}

export function createLocalServiceRecovery({
  renewSession,
  cacheSession,
  refreshActiveQueries,
}: LocalServiceRecoveryDependencies): LocalServiceRecovery {
  let inFlight: Promise<Session> | null = null;

  return {
    recover: () => {
      if (inFlight !== null) return inFlight;

      const attempt = (async () => {
        const session = await renewSession();
        cacheSession(session);
        await refreshActiveQueries();
        return session;
      })();
      inFlight = attempt;
      void attempt.then(
        () => { if (inFlight === attempt) inFlight = null; },
        () => { if (inFlight === attempt) inFlight = null; },
      );
      return attempt;
    },
  };
}
