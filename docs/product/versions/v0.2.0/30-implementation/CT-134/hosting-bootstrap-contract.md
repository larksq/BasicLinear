# CT-134 hosted identity and bootstrap contract

## Accepted slice

CT-134 implements I-202 only: R-201, R-202, R-203, R-216, R-220 and P-T202. It does not add invitations, general workspace authorization, billing checkout, REST tokens, MCP tools, autonomous behavior, code review, repository data, or production deployment credentials.

## Separate entry and authority

The Vite build has two independent HTML entries. `index.html` continues to boot the local product and its SQLite-backed local-owner session. `hosted.html` boots BasicLinear Online and never calls the local-owner endpoint. Firebase Hosting serves `apps/web/dist` but explicitly excludes the local `index.html` from deployment, preserves generated static assets, sends only `/api/**`, `/mcp`, and `/oauth/**` to the named `basiclinear-hosted-api` Cloud Run service, and falls back product routes to `hosted.html`.

The online entry says that hosted workspace data is stored on Firebase and that a local workspace is never uploaded or synchronized automatically. No sync or import code was added. Firestore client access remains default-deny; this slice performs privileged writes only through the trusted service.

## Google identity boundary

The browser initializes Firebase from the four public `VITE_FIREBASE_*` identifiers and starts `signInWithPopup` with `GoogleAuthProvider`. It stores Firebase browser persistence, not an BasicLinear password. The Firebase ID token is sent only in the same-origin `Authorization` header to `POST /api/v1/hosted/bootstrap`; it is never placed in a URL, response, checkpoint, or log.

The trusted service verifies the ID token with Firebase Admin and revocation checking. It accepts only `firebase.sign_in_provider = google.com`, `email_verified = true`, and a non-empty UID/email. Provider, verification, and identity constraints are checked again by the bootstrap service. Authentication failures return a bounded generic response.

Local Auth and Firestore emulator bindings are explicit and loopback-only. Production uses Cloud Run Application Default Credentials. No service-account key or provider credential is committed.

## Transaction and one-time trial

The server validates and hashes the browser idempotency key, takes the trusted server UTC time, calculates exactly 30 consecutive 24-hour days, and proposes opaque workspace, membership, and trial IDs. `FirestoreOwnerBootstrapRepository` then runs one transaction keyed by `_ownerTrialEligibility/{firebaseUid}`.

If eligibility already exists, the transaction returns the original record without a write. Otherwise the same transaction writes:

- `hostedUsers/{uid}` with Google identity metadata;
- `workspaces/{workspaceId}` with `authority = firebase-hosted`;
- `workspaces/{workspaceId}/memberships/{uid}` with one active owner membership;
- `workspaces/{workspaceId}/entitlements/current` with an active Pro trial and exact start/end timestamps; and
- `_ownerTrialEligibility/{uid}` with a permanent consumed flag, workspace reference, idempotency digest, and canonical bootstrap record.

Firestore transaction conflicts therefore converge retried tabs with different request keys on one UID eligibility record. The raw retry key is not stored. A later retry, changed clock, or new request key returns the original workspace and trial rather than granting another trial.

## HTTP and privacy behavior

The service exposes only `GET /health/ready` and `POST /api/v1/hosted/bootstrap` in this slice. A browser request carrying `Origin` must match one complete canonical origin from the deployment-owned `BASICLINEAR_HOSTED_ORIGINS` allowlist, including scheme, host, and port. The handler never derives trust from `Host`, `X-Forwarded-Host`, or other caller-controlled forwarding metadata. HTTPS is required except for literal loopback emulator origins; an empty allowlist rejects every browser-origin request while non-browser bearer requests without `Origin` remain authenticated normally. Unsupported routes and methods fail closed. Store failures return a redacted `INTERNAL_ERROR`, while identity failures return `AUTHENTICATION_REQUIRED`; neither response echoes the ID token, retry key, Firestore detail, or account data from another workspace.

## Runtime dependency profile

Firebase client `12.18.0`, Firebase Admin `14.3.0`, and Cloud Firestore `8.7.1` are pinned. Firestore is a direct runtime dependency because Firebase Admin declares both Firestore and unused Cloud Storage as optional. The supported hosted runtime install profile is `--omit=dev --omit=optional`: direct Firestore remains installed, unused optional Cloud Storage is excluded, and `npm run audit:hosted-runtime` reports zero vulnerabilities. A full development install includes Firebase Admin's unused optional Storage tree and currently reports six moderate `uuid@9` advisories; public packaging must preserve the verified runtime omission in CT-141 rather than claim the development tree is a production image.

## Evidence boundary

Deterministic local fixtures cover concurrent tabs, repeat visits, UTC/timezone boundaries, exact duration, transaction paths, Google-only claims, exact-origin allowlisting, scheme mismatch, forwarded-host spoofing, duplicate origin headers, direct Cloud Run ingress, authentication failures, redaction, rewrite allowlisting, entry separation, visible trial/price/data-boundary copy, and same-origin token exchange. The production build emits both HTML entries and all seven referenced hosted assets resolve. This is implementation evidence only: O-201, O-203, and O-204 remain baseline-needed until valid observation windows and release gates exist.
