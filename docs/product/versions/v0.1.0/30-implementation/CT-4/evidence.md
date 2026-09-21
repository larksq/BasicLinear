# CT-4 Architecture and UX Prototype Evidence

## Verdict

`PASS_FOR_CT6` on 2026-08-19. The disposable prototype supports the bounded architecture assumption `C-012`: a focused TypeScript-compatible web surface and PostgreSQL topology can provide workspace isolation, explicit revision conflicts, dense interaction, deterministic visual fixtures, responsive context, and restart persistence. This verdict permits `CT-6`; it does not accept O-002, public release, a license, a public name, or final production quality.

The repository is unborn and has no Git `HEAD`, so the evidence is bound to Control Tower issue `CT-4` revision `2`, Planning package SHA-256 `d161247c9c523e004a14d6e31ebcf9d12aab9764015b312383e13a0bb851f834`, the files under `prototypes/ct-4/`, and the screenshot hashes below.

## Environment

- macOS `26.5.2`, arm64.
- Node.js `v24.18.0`; npm `11.16.0`.
- Active Chrome process `150.0.7871.184`; installed Chrome binary `151.0.7922.138`.
- Docker `20.10.21`; `postgres:16-alpine`; disposable service `ct-4-db-1` bound to `127.0.0.1:55432`.
- Synthetic data only: 2 workspaces, overlapping issue identifier `ENG-1`, and 2,000 deterministic UI issues.
- No Linear API, Linear MCP, provider projection, Google dependency, paid service, or private reference screenshot was used.

## Automated Checks

| Check | Result | Evidence |
|---|---|---|
| `npm test` | Pass, 7/7, 0 failures, 145 ms | Server restart, QA frame CSP, deterministic fixture, UI contract, scoped reads, accepted revision, stale conflict |
| `npm run verify:postgres` | Pass | Application role is `NOBYPASSRLS`; the authorized workspace returns one `ENG-1`; the other workspace returns zero; accepted update reaches revision 2; stale update affects zero rows |
| PostgreSQL restart | Pass | `docker compose restart db`; post-restart `count(*), sum(revision)` returned `2|2` |
| `git diff --check` | Pass | No whitespace errors |
| Browser runtime diagnostics | Pass | 0 runtime errors, 0 unhandled rejections, 0 duplicate IDs, 0 unnamed buttons, and 0 document-level overflow |

The accepted mutation increments `revision` and appends one activity record in the same transaction. A stale expected revision changes no issue and appends no activity. Direct reads include both workspace membership and workspace identity. Database row policies repeat that boundary for the normal application role.

## Interaction Evidence

- The fixed-height 36 px list renders 2,000 issues while keeping 50 or fewer virtual rows in the DOM across the tested wide viewport; approved baseline viewports render 36-38 rows.
- Sixty sequential keyboard moves produced host-observed latencies of 23 ms minimum, 26 ms p50, 29 ms p75, 56 ms p95, and 82 ms maximum. The sample includes Chrome automation dispatch overhead.
- `ArrowDown` and `J` move through adjacent issues in visible grouped order. `Enter` opens context, and `Escape` returns focus to the selected issue.
- At nonzero list position, issue `FOC-340` retained `scrollTop=1008` before open, while open, and after close; focus returned to `FOC-340`.
- `Meta+K` opens the command dialog; `C` opens create; both close with `Escape`. Search reduced the fixture to 202 matching issues and keyboard clear restored 2,000.
- Detail focus lands on `Close issue details`. Desktop detail uses a 576 px split panel, tablet detail is a fixed 720 px right overlay, and mobile detail fills exactly `390x844`.

## Visual Evidence

Fresh load and reload produced byte-identical PNGs at every baseline viewport. Detail screenshots were separately inspected for fit, focus, overflow, and readable property layout.

| Artifact | SHA-256 |
|---|---|
| `prototypes/ct-4/evidence/desktop-1440x900.png` | `6a7202c3a12cb362f1885eb41fdff33f9896b606de0baf8e5bac29ab8536aea1` |
| `prototypes/ct-4/evidence/desktop-detail-1440x900.png` | `3f50c00e856d891c28ea6bcd9d53550238b03bc648f019fed2b3a7549f2973a3` |
| `prototypes/ct-4/evidence/tablet-1024x768.png` | `d9555c5932c19bb665560d79cae0127524f3968ccce65b039bc129af9682a340` |
| `prototypes/ct-4/evidence/tablet-detail-1024x768.png` | `10783a90af8f2712cd4e206990812e8e73a1e00bfed887816ac956c033d35625` |
| `prototypes/ct-4/evidence/mobile-390x844.png` | `31943bebf176132a52f33fbf518d0b8237e5896d5dcee0c7a2cf552fb465644a` |
| `prototypes/ct-4/evidence/mobile-detail-390x844.png` | `9b1c94daec3aeb5e6a826938149b41d79299ac416adc7381836cafb929daea0a` |

The Chrome review found and corrected three issues before acceptance: implicit grid minimums displaced the sidebar footer by the virtual height; grouped keyboard navigation followed source order instead of visual order; and raw navigation text overflowed the collapsed tablet rail. Mobile header clipping, excess intrinsic list width, visible horizontal scrollbar, and desktop split-view overflow were also corrected and rechecked.

## Accepted Implementation Constraints

1. Production persistence uses PostgreSQL with a normal `NOBYPASSRLS` application role. Every protected record carries `workspace_id`; every request resolves membership in the service and sets transaction-local user/workspace context for row policies.
2. Mutations require an expected revision. The update predicate includes workspace, record ID, and revision; an accepted transaction increments once and appends activity once; zero affected rows returns an explicit conflict.
3. Dense lists use stable row geometry and virtualization. The CT-9 regression budget is at most 70 mounted virtual rows for 2,000 issues at viewports through `2154x1340`.
4. The initial CT-9 controlled interaction budget is p75 at or below 100 ms for adjacent selection and visible-row reconciliation with 2,000 seeded issues. This is an architecture budget, not the unresolved O-002 reference-efficiency target.
5. Stable synthetic visual fixtures must reproduce exactly in the pinned CI environment. Intentional source, browser, or font changes require reviewed baseline replacement; overlap, clipping, silent information loss, or document-level overflow always fails regardless of pixel count.
6. Responsive boundaries follow the Planning contract: expanded desktop at 1200 px and above, collapsed rail/tablet overlay at 768-1199 px, and mobile navigation/full detail below 768 px.
7. Real-time events remain reconciliation hints. PostgreSQL revisions remain authoritative after reconnect or retry.

## Discarded Shortcuts

- Service-only authorization was rejected; database row policy remains a second boundary.
- Globally unique identifiers without workspace predicates were rejected.
- Rendering all 2,000 rows was rejected in favor of fixed-height virtualization.
- Raw text nodes in collapsed navigation were rejected because CSS could not hide them reliably.
- A permanent desktop-width detail column on tablet was rejected in favor of a fixed near-full overlay.
- The prototype's dependency-free DOM implementation is evidence, not a production framework decision or reusable production module.

## Residual Risk

- O-002 remains `baseline_needed` under `CT-2`; no comparison with Linear interaction efficiency is accepted.
- Automated axe and manual assistive-technology passes belong to independent testing in `CT-12`; this spike covers semantics, names, focus, keyboard behavior, reduced-motion CSS, and layout only.
- The latency sample is host-observed interaction time rather than browser trace telemetry. CT-9 must add pinned in-page performance marks and CT-12 must verify them independently.
- Production migration, local authentication/recovery, network-denied Compose operation, secret-safe logs, and event reconnect belong to `CT-6` and later issues.
- License, public identity, provenance, and clean-room publication remain blocked by `CT-3` and `CT-13`.

## Handoff

Proceed to `CT-6` with the constraints above. Do not copy prototype DOM code into production wholesale. Build the governed monorepo, local auth/recovery, workspace/team/membership/status core, migrations, health checks, and supported Compose topology; preserve the proven isolation and revision semantics in production tests.
