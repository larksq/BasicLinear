# Homepage release — 2026-09-18

## Deployed environments

| Environment | Public URL | Deployment |
| --- | --- | --- |
| Development | https://openlinear-development.vercel.app | `dpl_DsyQFy5B8XCi6gge8obV3zzD441e` |
| Production | https://openlinear.qiaosun.me | `dpl_9exyLQKWnRusUnMfZ1CNimtTs1r8` |

Both deployments reached READY and their existing aliases were assigned. The production alias https://openlinear-gray.vercel.app also serves the homepage. The team-specific production alias retains its existing Vercel authentication protection.

## Homepage and login behavior

The public root and `/hosted.html` show the homepage regardless of saved authentication. Authentication preparation and workspace restoration remain inside the lazy app entry. Clicking “Open app” uses `?app`. Existing issue, invitation, and OAuth links continue to enter the app directly.

Verified with a real, previously signed-in production Chrome session:

1. Before deployment, the root displayed the authenticated workspace.
2. After deployment, reloading that same tab displayed the homepage.
3. Clicking “Open app” restored the existing workspace without a new sign-in.
4. Returning to the root displayed the homepage again. The session was not cleared.

Development homepage and explicit login entry were also verified in the in-app browser.

## Release scope and validation

Each release reused the source-file hashes from its own previous deployment and overlaid exactly eight homepage files, including the routing and saved-session regression tests. Existing environment configuration, backend rewrites, dependency locks, and unrelated source were preserved. No backend or database deployment was needed.

- Baseline development: `dpl_9LEyatgZNCrRnYvcADjUbsVXRz5H`; 529 unchanged source references + 8 homepage files.
- Baseline production: `dpl_48t9CKB3RZuiYQV45nqbXTfmwU3s`; 531 unchanged source references + 8 homepage files.
- Six focused suites passed: 26 tests, including three entry-rendering cases with a mocked saved identity and assertions that authentication/workspace restoration are never called on public entry.
- Local TypeScript and whitespace checks passed; both remote builds completed successfully with environment validation.
- Development and public production homepage, hosted entry, license, OpenAPI, and OAuth discovery checks passed. A transient TLS failure on the legacy production alias succeeded on retry. The protected team alias returned the existing Vercel login screen, not a public-app regression.
- No sign-out, workspace content edits, invitations, billing operations, or permission changes were performed during verification.

[Deployment IDs, source hashes, and HTTP evidence](evidence/homepage-release-2026-09-18.json).
