# DEC-003: License, Public Identity, and Clean-Room Boundary

Status: `maintainer_decision_recorded_review_required`

Date: 2026-08-21

Engineering review refreshed: 2026-09-21

Decision class: legal / brand / release

Owners: maintainer as product owner; qualified legal or brand reviewer for clearance

Affected requirements: R-015, R-108, R-109

Affected outcome: O-005

## Question

Which license and distinct public identity should govern the project, and what reference-use boundary must apply before any public repository, package, image, demo, or comparative claim is released?

## Recorded Maintainer Decision and Assessment

1. The maintainer selected `AGPL-3.0-only`. The canonical GNU license text and package metadata now apply that exact SPDX choice. Qualified compatibility, notice, source-offer, and contribution review remains pending.
2. The maintainer selected **BasicLinear** as the project identity and requested **BasicLinear** as the main and final product brand. The maintainer reconfirmed the requested final brand on 2026-09-21. This two-name model is recorded exactly; it is not treated as clearance.
3. The 2026-09-21 name recheck contradicts closing the brand gate. An active project-management product already uses BasicLinear, including `basiclinear.tech` and a public GitHub repository with 700 commits, and Linear's official brand guidance identifies Linear as its company and application brand. BasicLinear still has no obvious indexed exact-string collision, but that remains only a preliminary screen.
4. Keep [clean-room-policy.md](./clean-room-policy.md) as the restrictive engineering rule. It pauses further authenticated Linear observation and quarantines existing authenticated-reference measurements from publication until qualified review.
5. Publish only synthetic product data and independently created product screenshots. Never publish Linear screenshots, workspace data, logos, icons, fonts, copy, or other vendor assets.
6. Require a generated third-party attribution manifest, license texts, asset provenance, and an approved public identity before release. The current dependency metadata screen is recorded in [dependency-license-inventory.json](./dependency-license-inventory.json); it is not the final distribution audit.

## Decision State

| Protected choice | Recommendation | Maintainer | Qualified reviewer | Current effect |
|---|---|---|---|---|
| Repository license | `AGPL-3.0-only` | Accepted 2026-08-21 | Pending | Applied to `LICENSE` and all package manifests; release review remains open |
| Project and product identity | BasicLinear project identity; BasicLinear final product brand | Accepted 2026-08-21; final-brand request reconfirmed 2026-09-21 | Pending clearance | Public release blocked by an exact BasicLinear market collision and unresolved Linear-name risk |
| Clean-room release boundary | Accept the restrictive policy in this packet | Pending for release | Pending | Restrictive engineering hold is active |
| Existing authenticated-reference aggregates | Internal quarantine; do not publish or market | Pending disposition | Pending | Retained locally for review only |
| Public comparative claims | No claims until evidence and terms review | Pending | Pending | Blocked |

The maintainer instruction is acceptance of the recorded license and two-name choice. The 2026-09-21 confirmation retains BasicLinear as the requested final public product brand. Neither is a qualified license, trademark, trade-dress, asset, notice, or clean-room opinion. The 2026-09-21 engineering recheck confirms that BasicLinear does not cure the exact BasicLinear product-name collision. Account access, automated research capability, or continued implementation does not satisfy the qualified-review column.

## Evidence

- The GNU AGPL is designed for network server software, and section 13 requires a modified network-interactive version to offer its Corresponding Source to remote users: [GNU AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html).
- Mozilla describes MPL 2.0 as file-level copyleft and states that server-side web code is not distributed merely by making functionality available over the web, while code sent to the client is distributed: [MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).
- Apache 2.0 grants copyright and patent permissions, imposes redistribution and notice conditions, and does not grant trademark permission: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- Linear's Terms of Service effective 2026-06-09 include restrictions on copying, reverse engineering, non-public APIs, and using or accessing the service to build or support a competitive product: [Linear Terms of Service](https://linear.app/terms).
- Linear's official brand guidance states that Linear is the name of both its company and application: [Linear Brand Guidelines](https://linear.app/brand).
- The external references below identify an unrelated product under its actual
  OpenLinear name: [OpenLinear repository](https://github.com/kaizen403/openlinear)
  and [OpenLinear website](https://openlinear.tech/). They are retained as
  historical source evidence and do not establish a BasicLinear name collision.
- The preliminary dependency and naming screens are in this packet. Neither is legal clearance.

## Alternatives

### MPL-2.0

MPL would preserve changes to covered files when distributed and allow a larger work under other terms. It is a credible compromise if contributor and enterprise adoption outweighs the goal of reciprocal hosted modifications. It does not provide the same network-use source obligation as AGPL, so it is not the current recommendation.

### Apache-2.0

Apache would maximize permissive reuse and includes an express patent grant. It permits proprietary hosted forks and therefore fits the stated reciprocity goal less well. It remains an acceptable option only if the maintainer intentionally prioritizes permissive adoption.

### Keep BasicLinear as the public product brand

Maintainer-selected on 2026-08-21, but not cleared. The name incorporates the incumbent's complete brand name and now collides with an active project-management product using the exact BasicLinear name. BasicLinear as a separate project identity does not remove that product-level collision. Public use remains blocked pending a qualified override or a distinct final product name.

### Continue authenticated reference research

Rejected as the default. Current terms create a material contractual question that an engineering process cannot resolve. Public documentation, standards, user research, synthetic fixtures, and independent product testing provide a reversible path while qualified review is pending.

## Risk Impact

The recommendation lowers trademark, trade-dress, private-data, and contract risk by narrowing reference inputs and forcing a distinct identity. It increases the chance that exact competitor-relative visual claims cannot be made. That tradeoff is deliberate: release readiness must be defensible, not merely visually close.

Residual risks remain. A preliminary exact-name search is not trademark clearance; license metadata is not a complete legal compatibility review; and even independently implemented interfaces may create trade-dress questions. Qualified review reduces but does not eliminate those risks.

## Effective Point and Reversal

The restrictive clean-room hold is effective for engineering work immediately because it prevents new external exposure and does not make a public commitment. The AGPL maintainer choice is effective in repository source and package metadata. Public distribution, contribution intake, comparative claims, and the product-name choice become effective only after the required qualified review is recorded.

The maintainer may select MPL-2.0 or Apache-2.0, or reject BasicLinear, without losing implementation work. Reversal requires updating this record, package metadata, release documents, attribution artifacts, public UI identity, and the CT-13 release audit before publication.

## Required Acceptance

CT-3 can move to Done only when:

- the maintainer records one exact SPDX license choice and an unambiguous project/product identity choice;
- a qualified reviewer follows [qualified-review-guide.md](./qualified-review-guide.md) and records license, name, trade-dress, screenshot, reference-measurement, asset, contribution, and notice disposition against the exact generated request hash;
- any required remediation is assigned in local Control Tower;
- the final record identifies the reviewer, review date, scope, and evidence without disclosing privileged advice.

`scripts/prepare-qualified-identity-review.mjs` may generate only `qualified-review-request.json`; it cannot create acceptance. `scripts/audit-public-release.mjs` requires a complete evidence set, the exact maintainer tuple, real reviewer metadata, review timestamp, jurisdictions, the exact request hash, and every required disposition. A valid remediation record fails the gate, while a valid acceptance remains blocked until this result is separately reconciled.

The first item is now satisfied and the deterministic review contract is implemented. No qualified acceptance exists. The remaining items are not satisfied, so CT-3 must remain `In Progress`.

## Current Maintainer and Evidence Refresh: 2026-09-21

The maintainer reconfirmed BasicLinear as the requested final public product brand. The public source recheck still finds an exact active project-management use of that name and Linear's published brand restriction. This keeps the qualified identity, trademark, trade-dress, clean-room, contribution, and notice review open. A regenerated request must bind the exact release candidate and evidence set; `qualified-review-acceptance.json` remains absent. CT-3 therefore remains an in-progress qualified-review gate. AGPL-3.0-only and BasicLinear remain the accepted maintainer inputs; BasicLinear remains uncleared for public release.
