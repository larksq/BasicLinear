# CT-48 Implementation Session

- Issue: `CT-48`, stable ID `135569dd-b489-4adc-b305-1dc9b5d15cf3`, implementation revision `2`.
- Implementation session: `codex-optional-oidc` / `CT48-IMPL-20260820T095851Z`.
- Scope: implement the accepted optional OIDC path across configuration, standards protocol, exact identity mapping, local-session linking, canonical backup/restore, API, web account controls, Compose, dependency notices, synthetic fixture, and tests.
- Standards boundary: production protocol behavior uses `openid-client` 6.8.6 for issuer discovery, authorization URL construction, authorization-code redemption, and ID-token validation. Authorization requests use PKCE S256, state, nonce, a separate browser-binding cookie, and a ten-minute one-time database request.
- Account boundary: linking starts only from an origin-protected POST and a valid local session. The callback requires the same local user session. Login resolves only an existing exact issuer-plus-subject mapping. Email claims are neither requested nor read and never select or join a local account.
- Recovery boundary: local email/password setup, sign-in, password rotation, and operator recovery remain unconditional. Provider discovery is lazy and outside readiness. A discovery failure does not affect local login and may retry on a later request.
- Transfer boundary: durable identity mappings are hash-bound database-backup records and restore after users. Sessions, provider tokens, authorization codes, and short-lived OIDC authorization requests are excluded. Restore requires an empty migrated authentication target.
- Review loop: the first route design allowed authenticated linking to start through GET. Review replaced it with an origin-protected POST returning the provider URL, while retaining GET only for unauthenticated login initiation.
- Automated result: three focused files and 12 tests pass, all 30 files and 183 complete tests pass, all eight workspaces typecheck, and the 1,926-module production build passes without a chunk warning.
- Database boundary: the PostgreSQL integration runner collected seven files and 17 tests but skipped all because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent. Migration 009, exact mapping, replay, restart, transfer, and populated pre-009 upgrade execution are not claimed.
- Browser boundary: the refreshed deterministic fixture responds at `http://127.0.0.1:4181/`, and four host HTTP/API checks pass. No screenshot or rendered interaction assertion is claimed because the approved browser surface remains unavailable under the active security policy.
- External identity boundary: no Google or other provider credential was needed or used. No Chrome account, authenticated Linear data, provider token, or private claim enters repository evidence.
- Status boundary: CT-48 remains In Progress. CT-12 remains In Progress, CT-13 remains Todo, and O-001 through O-005 remain pending.
