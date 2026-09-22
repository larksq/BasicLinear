# License Comparison

This is an engineering decision aid, not legal advice. The exact license text controls, and a qualified reviewer owns the release decision.

## Decision Criteria

The maintainer requires a free open-source project that can be self-hosted by anyone. The differentiating license question is whether downstream hosted modifications must be offered back as source, whether copyleft is limited to particular files, or whether proprietary forks are allowed.

| Criterion | AGPL-3.0-only | MPL-2.0 | Apache-2.0 |
|---|---|---|---|
| OSI-approved open-source license | Yes | Yes | Yes |
| Copyleft model | Strong copyleft with a network-interaction condition for modified versions | File-level copyleft on covered files when distributed | Permissive |
| Hosted modified service | Section 13 requires an offer of Corresponding Source to remote users | Server functionality alone is not distribution under Mozilla's FAQ | No source-sharing condition from hosting alone |
| Proprietary larger work | Generally inconsistent with the intended strong-copyleft boundary without a separate permission or license analysis | Allowed for files that are not MPL-covered modifications | Allowed subject to license conditions |
| Patent terms | GPLv3-family patent provisions | Contributor patent grant | Express contributor patent grant and patent-litigation termination |
| Notices | License and source-access obligations; appropriate legal notices where applicable | Preserve notices and make covered source available when required | Provide license, mark changed files, retain notices, and reproduce qualifying NOTICE content |
| Trademark permission | No general brand grant should be assumed | No general brand grant should be assumed | Explicitly excludes trademark permission except customary origin description and NOTICE reproduction |
| Fit to stated reciprocity goal | Strongest | Partial | Weakest |

## Maintainer Selection

The maintainer selected `AGPL-3.0-only` on 2026-08-21 rather than `AGPL-3.0-or-later`, so a future license version cannot silently change the accepted release terms. The canonical license text and all package manifests now apply the selection. A future network-accessible deployment must add a persistent in-product **Source** link and make the corresponding release source available without charge. The supported v0.1 runtime remains loopback-only.

AGPL was recommended because network reciprocity is a stated product value, not because the other licenses are less open source. MPL and Apache are both OSI-approved. Qualified compatibility, copyright ownership, notice, source-offer, and contribution review remains required before public release.

## Current Dependency Surface

The current lockfile metadata screen found 252 third-party package records: 205 MIT, 23 Apache-2.0, 12 MPL-2.0, 6 ISC, 5 BSD-3-Clause, and 1 Unlicense. The 12 MPL records are Lightning CSS and its platform packages. No third-party record lacks a license metadata value, and no third-party record declares GPL or AGPL.

That screen does not prove compatibility or notice completeness. It does not inspect every package's license text, bundled assets, generated output, source-offer obligations, or NOTICE file. CT-13 must generate and review the release-candidate attribution manifest and inspect the actual artifacts shipped in the web, API, and operator distributions.

## Implementation After Acceptance

1. Completed: add the canonical unmodified license text at repository root.
2. Completed: add the accepted SPDX identifier to the root and all nine workspace `package.json` files.
3. Pending qualified guidance: add copyright and source-access notices.
4. Pending CT-13: finish `THIRD_PARTY_NOTICES` against the locked local release graph.
5. Deferred until any network-accessible topology is accepted: add the network-visible source link.
6. Pending CT-3/CT-13: finish trademark, contribution, security, and public-brand policies.
7. Required continuously: re-run the release audit after every dependency or asset change.

## Primary Sources

- [GNU Affero General Public License v3](https://www.gnu.org/licenses/agpl-3.0.en.html)
- [GNU guidance for applying its licenses](https://www.gnu.org/licenses/gpl-howto.en.html)
- [Mozilla Public License 2.0 text](https://www.mozilla.org/en-US/MPL/2.0/)
- [Mozilla MPL 2.0 FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [OSI approved licenses](https://opensource.org/licenses)
