# CT-12 Current Acceptance Decision

Status: `PASSED` for the declared v0.1 local surface. The partial-review paragraphs below are retained as historical audit context; the Final Testing Decision is authoritative.

## Historical Partial-Review Record

Exact product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa` and tree `d106d3bb40a84184e7ee26c919134b01e4748679` pass 73 application files / 481 tests, two focused files / 13 tests, all eight workspace typechecks, 10 release-audit tests, and a warning-free 1,953-module build.

P-T19's complete e1299af accessibility-engine, mobile long-content, and forced-state matrix passes: 50 states, 38,245 passing nodes, zero violations, and five retained incomplete results resolved through live DOM and computed-contrast checks. CT-124 changes only Issue board metadata and Saved View action semantics. Six exact 5a33d28 axe-core 4.12.1 scans cover both surfaces in System, Light, and Dark with zero violations, zero incomplete items, 2,979 passing nodes, and the intended semantic delta. The complete matrix is therefore applicable to 5a33d28. CT-117 through CT-124 remain unaccepted until distinct application review.

The prior d524c5c P-T18 connected workflow remains a 21/21 baseline with exact 5a33d28 semantic and affected-surface checks. P-T20's complete e1299af pinned visual and protected-performance tranches are applicable to 5a33d28. The 60-image Light/Dark set binds 30 named states per appearance at `1440x900@1x` and `390x844@1x`, with zero structured or visual findings and combined image digest `0208b8474bdae382ff053fda6eb33d1259c56be213ed71eee85fffcade6959d2`. Against byte-identical fixtures, the two CT-124 visual surfaces in Light and Dark produce four byte-identical e1299af/5a33d28 JPEG pairs while the intended semantic delta is present. The fully warmed 20-transition performance contract passes at p75 `53.0 ms` against `100 ms`, and CT-124 leaves its protected list/detail path unchanged. The authorized live System check now passes in both directions and macOS is restored to Auto/System, so P-T20 is complete for its declared surfaces.

The live System receipt `.control-tower/evidence/CT-12/system-appearance-5a33d28.json` is mode 0600, 2,914 bytes, SHA-256 `8b5100e77ecffb93fcff10e235cc9a52fbcfd37210235d7fdd13ddaf2e0acc03`. Chrome loaded `assets/index-W0ZGkz-8.js` at `1654x875@2x`; Light resolved to `rgb(247, 247, 248)` and Dark to `rgb(23, 23, 25)`, with zero alerts in both directions. The app remained on Appearance System and the host setting was restored to Auto/System.

The exact 5a33d28 strict rehearsal passes all 21 checks and 4/4 runner contracts but is not independent. The distinct f7c3625 P-T21 receipt is historical. Exact 5a33d28 qualification is required; no self-acceptance is allowed.

The supported product boundary remains one automatic local owner, one implicit internal workspace/team, one loopback Node 24 process, one schema-2 SQLite file, and one backup directory. Login, OIDC, workspace/team switching, member or role administration, shared views, non-owner assignment, remote access, Docker, PostgreSQL server, and paid services remain unsupported or transfer-only.

CT-12 remains In Progress. No complete accessibility, cross-platform, identity, legal, accountable release, publication, or outcome decision is made.

## Final Testing Decision: 2026-08-23

Status: `PASSED` for the declared v0.1 local surface. Exact product revision `5a33d28be383b7651a4b0d6156534aa12cc423fa` and tree `d106d3bb40a84184e7ee26c919134b01e4748679` are independently accepted for Testing.

The distinct CT-117 through CT-124 closeout review passed with no findings. Actor `codex-independent-closeout-review-ct117-124`, session `CT117-124-INDEPENDENT-20260823T113057Z`, receipt `.control-tower/evidence/CT-124/independent-closeout-review-5a33d28.json`, SHA-256 `5aa09f82fcd11a47206df1f56687323495dcfaf381e12b12ff14ca13fb0edca8`.

The distinct exact-current P-T21 qualification passed 21/21 structured checks and 4/4 runner contracts, with six guarded phases, 11 network-audit records, zero outbound or subprocess attempts, accepted scale, permissions, cleanup, transfer, and source/artifact binding. Actor `codex-independent-testing-ct82-5a33d28`, session `CT82-INDEPENDENT-20260823T114800Z`, receipt `.control-tower/evidence/CT-82/qualification-5a33d28.json`, SHA-256 `7d392f18bf3e5933a954334bf83e452907d41a2889ed87ef842790bbcee00f16`.

The project-local task readback is CT-12@99 `Done`; CT-82@19 and CT-117 through CT-124 are also `Done`. The testing handoff is `passed` and routes to `ct-review-outcomes`. This decision claims neither CT-3 identity/legal approval, CT-13 accountable release approval, publication, cross-platform behavior, nor product outcomes. Provider projection remains disabled / `not_synced`; no Linear API, MCP, or UI was used for tracking.
