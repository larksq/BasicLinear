# OpenLinear workspace design QA

## Open-source UI alignment and AI onboarding — 2026-09-01

- Hosted reference: `outputs/ui-alignment-audit-2026-09-01/01-hosted-reference.png`.
- Pre-change open-source capture: `outputs/ui-alignment-audit-2026-09-01/02-open-source-before.png`.
- Same-viewport final comparison: hosted reference and `outputs/ui-alignment-audit-2026-09-01/05-open-source-aligned-dark.png`, both 2359 × 1204 pixels and inspected together in one comparison input.
- Fresh rebuilt desktop capture: `outputs/ui-alignment-audit-2026-09-01/06-open-source-final-dark.png` at 1512 × 728.
- Fresh AI-guide capture: `outputs/ui-alignment-audit-2026-09-01/07-ai-guide-final-dark.png` at 1512 × 728.

### Comparison result

The open-source edition now uses the hosted product's shell hierarchy: a fixed 238px navigation rail, 44px breadcrumb/search bar, full-width content surface, Inter typography, compact controls, and bottom-left utility placement. The compared content states intentionally differ—the hosted reference is a populated project detail while the local implementation is an empty Projects list—but the shared frame, alignment, density, tokens, icon family, dividers, and navigation rhythm match. Local-only labels and the SQLite authority boundary remain intentionally distinct.

The bottom-left AI entry is visible without competing with primary navigation. Its native dialog fits inside the desktop viewport, uses existing Lucide icons and OpenLinear tokens, contains real Codex and Claude Code commands, and wraps long commands without horizontal document overflow. No placeholder image, custom SVG, CSS illustration, or fake product asset was introduced.

### Interaction, accessibility, and viewport evidence

1. Chrome opened the guide from the bottom-left trigger, exposed a labelled dialog, copied the Codex command block, closed through the labelled close button, and restored keyboard focus to the trigger.
2. The rebuilt desktop page reports document width equal to viewport width (1512px), no broken images, and no open-dialog residue after close.
3. The 720px mobile contract keeps the dialog within 16px of the viewport, stacks the two client cards to one column, and stacks the endpoint row. The existing 390 × 844 responsive workspace capture remains applicable to the unchanged shell breakpoint; a focused static regression test now protects the new guide rules.
4. The guide uses semantic buttons, links, headings, regions, a native modal dialog, visible focus restoration, reduced-motion inheritance, and copy status announcements. The compact trigger retains an accessible full label when its visual copy collapses with the navigation rail.
5. No actionable P0, P1, or P2 visual, responsive, content, icon, or accessibility defect remains in this scope.

## Selected visual target

- Reference: `/var/folders/07/v7lgsxcd0gx9n1wksl_qgfjc0000gq/T/codex-clipboard-5aa2d7fe-dba7-4831-a2a8-cbf76803821d.png`
- Target: the supplied Linear issue workspace: fixed dark sidebar, compact top bar, issue canvas, activity thread, and right-hand properties rail.
- Existing-product constraint: the hosted Firebase, collaboration, billing, REST, MCP, and Google identity services remain authoritative; the redesign replaces only the temporary stacked console with the operating product shell.

## Captured evidence

- Superseded thin-shell baseline: `docs/product/versions/v0.2.0/30-implementation/CT-143/audit-current/`
- Final development Chrome captures for Home, Issues, Views, Cycles, Projects, project detail, rich issue detail, View options, every issue-property menu, invitation modal, People, Billing, and API/MCP: `docs/product/versions/v0.2.0/30-implementation/CT-143/audit-final/`
- Final persisted rich issue: `docs/product/versions/v0.2.0/30-implementation/CT-143/audit-final/15-dev-final-rich-issue.jpg`
- Final production issue detail and invitation flow: `docs/product/versions/v0.2.0/30-implementation/CT-143/audit-final/16-production-issue-detail.jpg` and `18-production-invite-modal.jpg`
- Combined same-height reference/implementation comparison: `docs/product/versions/v0.2.0/30-implementation/CT-143/audit-final/13-linear-reference-comparison.jpg`
- Earlier responsive Chrome capture retained at 390 × 844 CSS viewport: `docs/product/versions/v0.2.0/30-implementation/CT-143/screenshots/dev-workspace-mobile.png`

## Visual comparison

The new combined comparison was inspected as one image at equal height after the live Chrome pass. The implementation matches the reference hierarchy and proportions: fixed workspace navigation, compact command bar, centered issue canvas, detailed activity and comment flow, and a persistent right-hand properties rail. It uses the existing OpenLinear mark and Lucide icon assets rather than simulated symbols or drawn placeholders.

The shell is now the operating product rather than a temporary information page. Workspace-level navigation exposes Projects and Views. Team-level navigation exposes Home, Issues, Cycles, Projects, and Views. The issue page contains description, sub-issues, resources, durable activity, comments, and clickable Status, Priority, Assignee, Project, and Milestone menus.

## QA history

1. The pre-change audit reproduced the duplicate Workspace/Issues information architecture, absent Views/Cycles/Home pages, thin issue detail, settings-only invitation flow, inert View options, and undersized property controls.
2. Development Chrome navigation passed for Home, Issues, Views, Cycles, Projects, project detail, General, People, Billing, and API/MCP.
3. View options passed live grouping by status and priority plus All, My active, Unassigned, High priority, and Completed saved filters.
4. Workspace switcher and Product team arrows passed expand/collapse behavior. Every issue-property arrow opened a labelled listbox with visible options.
5. The invitation modal passed multi-email input, seat/billing copy, private-link boundary, member-management route, and no-overflow containment. Chrome found the initial wide-layout overflow; the corrected modal was rebuilt, redeployed, and recaptured.
6. A real development issue persisted a description, resource, sub-issue, and comment through reload. Its durable activity feed refreshed correctly. Chrome found and closed a duplicate comment-audit count, leaving four visible activity records instead of five.
7. The isolated production deployment loaded its existing Firebase data in Chrome. Views, View options, invitation modal, and all five issue-property listboxes passed without mutating production records.
8. The earlier 390 × 844 Chrome QA remains applicable to the unchanged responsive shell breakpoints: navigation drawer, single-column issue body, stacked properties, and scroll containment.
9. Development and production remain distinct Firebase/Cloud Run/Vercel authorities. Both accounts retain no-charge verification access; checkout remains disabled.

## CT-144 issue-property rail correction — 2026-08-28

- Source visual truth: authenticated Linear capture at `/private/tmp/openlinear-ct144-properties/04-linear-current.jpg`.
- Rendered implementation: deployed production capture at `/private/tmp/openlinear-ct144-properties/14-production-clean.jpg`.
- Viewport normalization: both captures are 2461 CSS px wide. The Linear source is 2461 × 1382 and production is 2461 × 1326; both report device pixel ratio 2 while the browser capture is delivered in CSS-pixel dimensions. The focused comparison uses the same absolute 400 × 560 crop at x=1571, y=74.
- State: dark desktop issue detail with the property rail visible; dynamic issue names and values intentionally differ, while hierarchy, rail geometry, typography, spacing, icons, and interaction treatment are compared.
- Full-view evidence: `/private/tmp/openlinear-ct144-properties/17-full-comparison-clean.jpg`.
- Focused final evidence: `/private/tmp/openlinear-ct144-properties/16-rail-comparison-clean.jpg`.

### Comparison history

1. The pre-fix OpenLinear rail was 284px wide, pinned to the far-right viewport edge, and rendered every value in a compressed 92px label/value table. Its title began at x=2196 while Linear's 400px rail began at x=1571.
2. The first correction introduced the measured 1733px issue composition, 400px rail, 851px issue document, value-first 32px rows, 28px pill controls, 13px typography, grouped Project/Team sections, and an avatar-bearing static assignee state. Development evidence: `/private/tmp/openlinear-ct144-properties/03-development-pass1.jpg`.
3. The final production capture measures the issue title at x=724, width=791 and the property rail at x=1571, width=400, matching the Linear source's x=724.5/width=791 and x=1571.5/width=400 geometry. Its neutral focused crop has no actionable P0/P1/P2 visual difference within OpenLinear's supported property set.

### Required fidelity surfaces

- Fonts and typography: 13px/500 value and section text now matches Linear's measured Inter Variable fallback hierarchy; headings and values no longer use the prior 11px compressed table treatment.
- Spacing and layout rhythm: 32px row pitch, 28px controls, 31px section separation, 400px rail, and issue/rail horizontal positions match the reference geometry.
- Colors and visual tokens: muted heading and bright value tokens preserve the existing OpenLinear dark system while matching the reference foreground balance; focus and hover states remain visible.
- Image quality and assets: existing Lucide property icons, workflow glyphs, team color, and real member avatars are used. No drawn, placeholder, or generated asset was introduced.
- Copy and content: the visible hierarchy is `Properties`, core values, `Project`, and `Team`; dynamic OpenLinear property values remain authoritative and are not replaced with reference fixtures.

### Interaction and responsive evidence

- On the deployed development candidate, Status, Priority, Project, Team, Cycle, and Milestone each opened a labelled listbox with real options, closed with Escape, restored focus to its trigger, and made no data change.
- The deployed production issue reloaded with the persisted status, priority, assignee, project, milestone, team, and cycle values intact. The member-only static assignee now uses the same avatar/value treatment as the reference.
- The focused source contract preserves the existing stacked rail below 820px and centers the issue document after the two-column layout collapses.

No unresolved P0, P1, or P2 visual defect remains in the selected property-rail implementation. Due date, labels, and dependency relationships are separate product-model capabilities and were not represented as fake controls in this UI-only correction.

## CT-144 Team Overview issue-key correction — 2026-08-31

- Source visual truth: user-supplied Team Overview screenshot at `/var/folders/07/v7lgsxcd0gx9n1wksl_qgfjc0000gq/T/codex-clipboard-cf4fa222-4559-4553-b9a6-b7f2a12760cb.png`, corroborated by the fresh production pre-fix capture at `/private/tmp/openlinear-ct144-home-nowrap/01-production-before.png`.
- Rendered implementation: deployed production capture at `/private/tmp/openlinear-ct144-home-nowrap/04-production-1286-after.png`.
- Viewport and normalization: the fresh before/after production captures are both 2461 × 1326 CSS pixels at device pixel ratio 2 and show the same signed-in workspace, Product team, Overview tab, five issue rows, data, theme, and interaction state. No density normalization was required.
- Full-view comparison evidence: `/private/tmp/openlinear-ct144-home-nowrap/05-production-before-after.png`.
- Focused row comparison evidence: `/private/tmp/openlinear-ct144-home-nowrap/06-row-before-after.png`.

### Comparison history

1. The pre-fix audit reproduced one P2 responsive typography defect: a 70px identifier grid track allowed four of five 13px issue keys to wrap after `OL-`, doubling their text height to 30px while the 38px row and title stayed single-line.
2. The correction gives the identifier a dedicated `ol-home-issue-key` role, a 78px aligned track, and explicit `white-space: nowrap`; the title retains the only flexible `minmax(0, 1fr)` track and ellipsis behavior.
3. The first development capture showed all three development identifiers at 78 × 15 CSS pixels. The narrower 1286 × 900 check kept all keys and titles at 15px height with no document overflow.
4. The final same-state production capture shows all five identifiers at 78 × 15 CSS pixels, every row at 38px, and the title column aligned at x=377. No actionable P0/P1/P2 difference remains.

### Required fidelity surfaces

- Fonts and typography: the existing Inter 13px identifier treatment is preserved; only unintended wrapping is removed. Titles remain single-line and ellipsized when space is constrained.
- Spacing and layout rhythm: the status icon, fixed identifier column, flexible title, relative time, and chevron keep one dense 38px row rhythm. The eight-pixel track increase is absorbed by the title rather than widening the page.
- Colors and visual tokens: no color, border, hover, or focus token changed.
- Image quality and assets: existing workflow/status and chevron icons remain unchanged; no new image or simulated icon was introduced.
- Copy and content: authoritative issue keys, titles, and relative timestamps are unchanged.

### Interaction and responsive evidence

- The focused source test passed and preserves the full-row `openIssue(issue)` button.
- Chrome opened `OL-30A2EE` from the development recent list and rendered its issue detail without any PM data mutation.
- At 1286 × 900 CSS pixels, the document had no horizontal overflow and all three development keys remained one line.
- Production was reloaded after deployment and the original five rows remained readable, aligned, and one line.
- The final production page reported no browser console errors or warnings.

## CT-144 continuous issue identifiers — 2026-08-31

- Previous behavior: issue keys were presentation-only UUID suffixes such as `OL-6D82C5`; the same random internal identifier leaked into every list, breadcrumb, issue detail, sub-issue, and project issue surface.
- Final behavior: the trusted collaboration record carries an immutable positive workspace issue number and every visible key renders only `OL-${issue.number}`. Opaque `issue_<uuid>` values remain internal route/storage references.
- Compatibility: a workspace without a sequence record projects all historical issues deterministically by canonical creation time and opaque-ID tie-break. A read stays read-only. The first later issue mutation persists the complete numbered projection and a derived next-number record in one transaction; a new issue atomically receives that number. Existing numbered workspaces reject gaps, duplicates, mixed legacy/current state, chronology failure, and a divergent counter.
- Local positive evidence: the focused collaboration/project-export/observation/HTTP/REST/browser suite passed 8 files and 37 tests. The service regression explicitly projected two legacy records as 1/2 without a write, created 3, persisted the legacy backfill, and advanced the next number to 4; retry replay remained number 1. All 11 workspace typechecks and the full local/hosted production build passed.
- Development deployment: Cloud Run `openlinear-hosted-api-dev-00008-k49` and Vercel `dpl_HVhzd3UxJRxo8JTBtSb9oNsXNK1o` are READY. The Product home showed historical `OL-1`, `OL-2`, `OL-3`; Engineering showed `OL-4`. A development-only real-data create produced durable issue `issue_72dcb390b2884e35b050f72d9a01126d` as `OL-5`, and a full browser reload preserved the same number and description.
- Production deployment: Cloud Run `openlinear-hosted-api-00008-q6r` and Vercel `dpl_CKAjoq8oK8ThU58CYQkPUG6EENCL` are READY. Signed-in Chrome showed the complete unchanged production records as the continuous set `OL-1` through `OL-5`; the former hash-labelled CT-143 parent now appears as `OL-4` and its child as `OL-5`. No production PM record was created or changed for this verification.
- Visual evidence: `/private/tmp/openlinear-ct144-sequential-dev.png`, `/private/tmp/openlinear-ct144-sequential-dev-created.png`, and `/private/tmp/openlinear-ct144-sequential-production.png`.
- Boundary: positive nonsecurity tests only. No payment, provider-subscription, security/adversarial, or independent-acceptance claim.

## CT-144 workspace typography alignment — 2026-08-31

- Source visual truth: fresh authenticated Linear issue-detail and Team Home captures at `/private/tmp/openlinear-ct144-typography-linear-before.png` and `/private/tmp/openlinear-ct144-typography-linear-home-before.png`.
- Final implementation: development issue, Team Home, Settings, and create-issue modal captures at `/private/tmp/openlinear-ct144-typography-development-issue-final.png`, `/private/tmp/openlinear-ct144-typography-development-home-final.png`, `/private/tmp/openlinear-ct144-typography-development-settings-final.png`, and `/private/tmp/openlinear-ct144-typography-development-modal-final.png`; production issue and Team Home captures at `/private/tmp/openlinear-ct144-typography-production-final.png` and `/private/tmp/openlinear-ct144-typography-production-home-final.png`.
- Viewport normalization: reference and candidate desktop captures are 2403 × 1312 CSS pixels at device pixel ratio 2 from the same Chrome capture path. No scaling or density normalization was applied before comparison.
- Combined comparison evidence: full issue-detail comparison `/private/tmp/openlinear-ct144-typography-issue-comparison-pass1.png`, focused issue comparison `/private/tmp/openlinear-ct144-typography-issue-focused-pass1.png`, and final Team Home comparison `/private/tmp/openlinear-ct144-typography-home-comparison-final.png`.

### Comparison history

1. The first audit found one P2 system-wide hierarchy mismatch: OpenLinear used the browser/system fallback at mostly 13px/400, while authenticated Linear used Inter Variable with 15px/450 body copy, 15px/600 section headings, 13px/500 navigation, 12px/450 metadata, and more precise title tracking.
2. The first correction self-hosted Inter Variable and mapped every workspace surface to measured display, section, body, UI, and metadata roles. Development issue-detail measurements then matched Linear at 24/32/600/−0.16px title, 15/24/450/−0.1px description, 15/23/600 section, 13/20/500 navigation, and 12/16.8/450 metadata.
3. The second comparison found one residual P2: Team Home tabs were 12px/450 instead of Linear's 12px/500. The shared tab role was corrected and recaptured at 12px/500.
4. Final development and production Chrome passes found no actionable P0/P1/P2 typography difference. Both deployed environments loaded the self-hosted family without console warnings or external font requests.

### Required fidelity surfaces

- Fonts and typography: both local and hosted entries import the pinned self-hosted `@fontsource-variable/inter` weight bundle. The workspace uses Linear's measured `Inter Variable` stack and explicit role tokens rather than relying on machine-dependent browser defaults.
- Spacing and layout rhythm: measured line heights preserve Linear's dense 32px display, 24px reading, 23px section, 20px UI, and 16.8px metadata rhythm without changing the already accepted shell geometry.
- Colors and visual tokens: colors, contrast, borders, radii, hover, focus, and selection states are unchanged by this typography-only pass.
- Image quality and assets: the font files are emitted as versioned production assets; existing Lucide icons, avatars, marks, and workflow glyphs are unchanged.
- Copy and content: authoritative workspace, issue, project, member, comment, and activity content is unchanged.

### Interaction and deployment evidence

- Chrome navigation passed issue detail, Team Home, Settings General/Teams, and create-issue modal open/close without data mutation. Title, description, section, sidebar, property, row, key, tab, and timestamp roles were measured from computed production styles.
- Focused tests passed 6 files/19 tests; all 11 declared workspace typechecks passed; the isolated hosted build emitted 1,822 modules plus self-hosted Inter font assets.
- Development deployment `dpl_FmBbQLPk96QH2LHqZBfzCT1mKxS7` and production deployment `dpl_9VK7NtaqjGxWV5LJCjSNX17DcZEZ` are READY at their existing aliases. Production verification was read-only.
- Boundary: positive nonsecurity checks only. No full-suite, payment/provider, security/adversarial, or independent-acceptance claim.

final result: passed

---

## Public homepage — 2026-09-15

### Visual target and evidence

- Source visual truth: https://linear.app/; captured and opened in the in-app browser in this task.
- Implementation: http://127.0.0.1:4178/hosted.html (production build).
- Source and implementation desktop viewport: 1280 × 720 CSS pixels; 1265px content area after scrollbar. Browser viewport captures were emitted together in a single comparison input, at the same viewport with both pages at the top. No image stretching or synthetic source reconstruction was used.
- Mobile implementation viewport: 390 × 844 CSS pixels, 375px content area. Header/hero, product preview, menu, and setup were inspected in viewport screenshots.
- Screenshot paths: captures are retained inline in this task; no standalone screenshot files were exported. A full-page capture exhibited stitching duplication, so it was excluded from fidelity evidence in favor of viewport captures and rendered DOM verification.
- State: public homepage, default list preview; additional board, filtered/empty search, open FAQ, mobile navigation, and unavailable hosted entry states were exercised.

### Fidelity surfaces

- Typography: local Inter Variable, restrained medium weights, large tightly spaced left-aligned headline, muted second line, and consistent body/label hierarchy. Original OpenLinear copy intentionally changes headline wrapping from Linear. Mobile headline wraps without clipping.
- Layout: thin sticky navigation border, generous hero whitespace, prominent wide product preview, aligned section rules, two-column section headings, three-column features/workflow, and stacked mobile sections. This is an adaptation for OpenLinear, not a pixel-identical reproduction of Linear's longer marketing page.
- Color: near-black canvas, subtly elevated panels, muted gray secondary copy, off-white CTAs, and restrained violet/gold status accents. Main canvas and scrollbar now share the dark color scheme.
- Assets: existing OpenLinear favicon and installed Lucide line icons. The central preview is semantic, interactive sample issue UI, clearly labeled as a preview; no Linear brand or customer assets are reused.
- Content: independent open-source positioning, explicit non-affiliation, local and hosted data boundaries, documented local setup, and license. No invented customer counts, repository stars, or availability claims.

### Comparison history and fixes

1. Initial desktop review: the shared body left a light scrollbar beside the dark page. Added homepage-scoped root/body dark color scheme. Preview group headings inherited the general h3 style; strengthened their scoped selector. Mobile preview controls needed more space; increased layout toggle height and issue title size.
2. Rechecked the revised desktop build against the source with paired viewport captures. Inspected product and setup sections separately. Rechecked mobile hero, product preview, and setup; no clipping or horizontal overflow remained.
3. Verified production app entry with missing hosted configuration returns a readable recovery page. Clean production preview has no console warnings/errors. Development HMR createRoot warnings from editing the entry module were not reproduced in the production build.

### Findings and limitations

No actionable P0/P1/P2 visual or interaction findings remain in the implemented homepage. The public GitHub URL is still pending user input; the current license link and explicit availability note are intentional. Live hosted sign-in was not tested without deployment configuration. Original signed-in flows were retained and relevant regression suites passed.

### Implementation checklist

- [x] Public homepage and private entry routing
- [x] Responsive visual review and paired desktop source comparison
- [x] Search, board/list, copy, FAQs, and mobile navigation checks
- [x] Production build and 20 focused regression tests
- [x] Clean production console and resolved in-page anchors
- [ ] Configure public repository URL when supplied

final result: passed

## 2026-09-18 — Dedicated Image2 login

Reference: `docs/design/login-image2-reference.png`. Implementation: `apps/web/src/hosted-login.tsx` and `.css`.

- Desktop 1440×1024: matches split composition, chrome artwork, centered authentication hierarchy, rounded Google action and understated trust guidance.
- Mobile 390×844 and 320×700: decorative panel hidden; readable wrapping and 52px action; no horizontal DOM overflow at 320px.
- Keyboard focus styles and reduced-motion preference supported. Busy action disabled; error announced with retry enabled.
- Fixed initial light loading flash and made homepage links work on the local hosted.html path.
- Builds/typecheck pass; all 32 targeted tests pass.
- Google pending/error behavior browser-verified; successful provider sign-in was not completed locally. Public homepage round trip verified. Remote deployment not performed in this change.

## 2026-09-18 — Browser comment 1: trust section refinement

Image2 reference: `docs/design/login-trust-image2-reference.png`. Replaced the single lock row with a two-row trust card: clear Google authentication and local-data messages. Normalized reference width to the existing 414px form: 16px corner radius, 1px border, 54px icon containers, 16px icon/text gap, 14px text, 27px vertical padding and 28px row gap. Standard Lucide shield/laptop icons match the reference line style. Compact breakpoints reduce icon and padding dimensions to preserve readable text.

Verification: local and hosted builds/typecheck passed; 15 targeted login, foundation and homepage-session tests passed. Authentication code remains unchanged. Desktop comparison confirms hierarchy, alignment and artwork preservation. Mobile wrapping checked separately. Final result: passed.

## 2026-09-18 — Shared brand mark and release

All app logo placements consume the same `BrandMark` component and canonical favicon asset. The login's generated outline mark was replaced with the existing two-bar OpenLinear identity. Browser checked both login placements loading the correct asset locally and on development/production. Both live homepage navigation checks passed. Local/hosted builds and 32 targeted tests passed. Both deployments READY. Final result: passed.
