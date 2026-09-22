# CT-18 Immutable Fixture Evidence

## Verdict

`OUTPUT_DONE_FOR_CT11`. The build stage now copies `.env.example`, allowing its locked foundation test to execute inside the exact immutable test filesystem. Only the static public fixture is copied; runtime secrets remain excluded.

## Verification

- The initial immutable image failed its foundation unit test because `.env.example` was absent. CT-18 was recorded before the production Dockerfile mutation.
- Rebuilt image `basiclinear-test:ct11-final-r2` (`sha256:b073182b066e765bdda111ffa6f32a0befba85039e6cccd2794b781913cc325d`, 442,958,382 bytes) contains the fixture and passes all 5 unit files / 20 tests.
- The same source-frozen image passes all 8 workspace type checks and 6 integration files / 16 tests against disposable PostgreSQL databases.
- `.env.example` SHA-256 is `1d6936c4b51eb8292af3b38aeef7c2581d2ce21cfc19a489cb6f72597e17a31f`. The Dockerfile SHA-256 is `41584beb04ff73aae9e2e7cdf7dd51bb33abe7bbdc9fdd709f0ef1ac5c314322`.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-109 | The immutable suite proves the locked foundation without Google, Linear, paid service, or external runtime configuration. |

## Verification Boundary

This build correction changes only test/build context composition. Production runtime commands and secret injection remain unchanged. Clean-host full-Compose rehearsal remains CT-12 scope.
