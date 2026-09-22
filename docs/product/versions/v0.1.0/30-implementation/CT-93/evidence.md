# CT-93 Local-Service Recovery Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. BasicLinear now treats same-origin loopback availability as an app-wide state, keeps cached work reachable during interruption, separates transport failure from owner authorization, and refreshes active reads after recovery.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Transport boundary | Every API fetch uses same-origin credentials; fetch rejection becomes `TransportError` with stable code and message. |
| Readiness | Only `/health/ready` is probed, with no-store caching and no external request. |
| Network independence | Query and mutation defaults use `networkMode: 'always'`; no product logic depends on `navigator.onLine`. |
| Initial bootstrap | Only exact `AUTHENTICATION_REQUIRED` enters owner provisioning; service or session failures expose retryable gate states. |
| Cached workspace | Existing workspace content remains mounted during interruption, preserving local navigation and in-memory drafts. |
| Disconnect | One app-wide named alert explains retained data and exposes `Try now`; retry locks only while checking. |
| Reconnect | One polite status is announced, active non-health queries invalidate once, and the status clears after three seconds. |
| Polling | Ready probes run every 15 seconds and failure probes every 3 seconds, including in the background. |
| Responsive state | The full-width banner has stable desktop/mobile tracks and wraps long messages and correlation identifiers. |

## Verification

| Check | Result |
| --- | --- |
| Focused tests | 1 file / 6 tests passed |
| Complete regression | 60 files / 410 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,947 modules / 109 files / 1,874,334 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Loopback readiness | `ready` on port 4275 |
| Served candidate | `index-B_cOWNaR.js` and `index-DpGYXKwV.css` returned |
| Rendered Chrome evidence | 0 captures; blocked before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/api.ts` | `6a13ce826b5aa6f55e4c2d95147f0e3d413e9a320a688634dbf12a57f7c4fcfd` |
| `apps/web/src/components.tsx` | `903edff2ae548270b579f4e0af4520488e69af198fb18fa10ccfe72b229f0ffd` |
| `apps/web/src/App.tsx` | `594de943cb6c60f7fe2dd89d571d3ef0c0ad8c0ebf68f27c46a465aee07173de` |
| `apps/web/src/main.tsx` | `708bb7871943364e32be94b4536f56efebe60f8a6b6f6e1d24996022639ce687` |
| `apps/web/src/issues.tsx` | `5ae900dd0b72547ade077c1c3cc9bfad6c4eff6cd9e6876d40364fd207e17c7b` |
| `apps/web/src/styles.css` | `1ed1306c455335e5d4d0e21f045927de929ddc3aabde0f32993d77ef91660fca` |
| `apps/web/tests/local-service-recovery.test.ts` | `6e3ba6e7702e0fede76fb77f287181a795faf17cd849cf16f374c10352dcbec3` |

## Protected Gates

No rendered acceptance is inferred from source inspection, tests, typechecks, build output, loopback health, or served HTML. CT-12 must stop and restart the local service while lists, details, and drafts are open; verify the single alert and reconnect announcement, native retry focus, owner-bootstrap separation, exact restored data, long diagnostics, responsive geometry, and pinned Light/Dark contrast in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
