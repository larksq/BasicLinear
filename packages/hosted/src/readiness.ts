/** Bound HTTP probes without accumulating reads when the dependency hangs. */
export function createReadinessProbe(check: (() => Promise<void>) | undefined): () => Promise<boolean> {
  let dependencyPending = false;
  let probe: Promise<boolean> | null = null;
  let readyUntil = 0;

  return async () => {
    if (check === undefined) return false;
    if (Date.now() < readyUntil) return true;
    if (probe !== null) return probe;
    // A timed-out Firestore call may still be retrying. Wait for it to settle
    // before starting another; its late result cannot mark this probe ready.
    if (dependencyPending) return false;
    dependencyPending = true;
    const dependency = Promise.resolve().then(check).then(
      () => { dependencyPending = false; return true; },
      () => { dependencyPending = false; return false; },
    );
    let timeout: ReturnType<typeof setTimeout>;
    probe = Promise.race([
      dependency,
      new Promise<boolean>(resolve => { timeout = setTimeout(() => resolve(false), 2_000); }),
    ]).then(ready => {
      if (ready) readyUntil = Date.now() + 5_000;
      return ready;
    }).finally(() => {
      clearTimeout(timeout);
      probe = null;
    });
    return probe;
  };
}
