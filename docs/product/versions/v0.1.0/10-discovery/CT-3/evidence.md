# CT-3 Evidence

## Result

The engineering and research portion of CT-3 is complete. The sponsor decision is partially applied; qualified review and the public-name gate are not complete.

- The sponsor selected `AGPL-3.0-only` on 2026-08-21. The canonical license text and all package declarations now use that exact SPDX identifier.
- The repository dependency metadata screen found 252 third-party package records and no missing third-party license metadata.
- The sponsor selected Scopefold as the project identity and reconfirmed OpenLinear as the requested final product brand on 2026-09-21.
- The public-name screen was refreshed on 2026-09-21. Scopefold still has no obvious indexed exact-string collision, but OpenLinear directly collides with an active project-management product: `openlinear.tech` markets project-management software under that exact name and its public repository reports 700 commits. OpenLinear also includes Linear's company/application brand. The requested product name therefore does not pass the engineering screen and has not received trademark clearance.
- Current Linear terms create a material contractual question for continued authenticated competitive-product research.
- A restrictive clean-room policy now pauses new authenticated observation and quarantines existing aggregates from publication.
- The deterministic [qualified review guide](./qualified-review-guide.md), request generator, and release-audit contract now fail closed on missing evidence, sponsor-choice drift, malformed or stale acceptance, and remediation-required decisions. The generator never creates acceptance.
- Public release, product-name use, contribution intake, and comparative claims remain blocked pending qualified review and CT-13. License metadata is no longer a blocker.

## Verification

The primary source register is [source-register.json](./source-register.json). Dependency counts are reproducible from the lockfile SHA-256 recorded in [dependency-license-inventory.json](./dependency-license-inventory.json). The decision and its unresolved human authority are in [decision-record.md](./decision-record.md).

On 2026-09-21, the release-audit regression passed 10/10 tests. The current release audit remains `NOT_READY` at 8 PASS / 0 FAIL / 6 BLOCKED. The qualified request is regenerated from the exact current evidence set and qualified acceptance remains absent. These checks confirm product and audit health; they do not clear a name or legal boundary.

This evidence makes no legal conclusion. It establishes an engineering control, records the sponsor's exact instruction, identifies the current OpenLinear collision, and preserves the qualified-review work needed to finish CT-3. AGPL-3.0-only and Scopefold solve the bounded license-metadata and project-identity choices. They do not solve the final-product-name or qualified-review criteria. Request generation is restricted to a clean source revision, and qualified human acceptance remains absent, so CT-3 cannot be closed from the sponsor instruction alone.

## Current Evidence Refresh: 2026-09-21

The current qualified-review request is regenerated after this evidence refresh, binding the source revision and evidence-set hash. No qualified acceptance file exists.

The current P-T22 release audit is `NOT_READY` at 8 PASS / 0 FAIL / 6 BLOCKED: identity, working-name, notices, asset provenance, copy provenance, and accountable release approval remain protected gates.

AGPL-3.0-only and Scopefold therefore solve the requested repository-license and project-identity inputs, but they do not solve qualified clearance for OpenLinear or permit CT-3 to close. This refresh makes no legal, brand, release, publication, or outcome claim.
