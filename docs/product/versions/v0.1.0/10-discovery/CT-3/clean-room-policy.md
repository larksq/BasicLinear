# Clean-Room Reference and Release Policy

Status: restrictive working control; AGPL maintainer choice applied; identity and qualified release acceptance pending

Effective: 2026-08-20

## Purpose

This policy permits independent implementation of a high-quality project-management product while preventing vendor code, assets, brand, private data, or restricted research methods from entering the distributable work. It governs research, implementation, testing, evidence, marketing, and release.

## Immediate Hold

Do not use an authenticated Linear account, workspace, desktop app, browser session, API, MCP connector, non-public endpoint, source map, bundle inspection, or automated UI observation for this project until a qualified reviewer explicitly permits a bounded method. Existing Chrome or Google sessions provide capability, not authorization.

The hold follows review of Linear's Terms of Service effective 2026-06-09. The terms present a material contractual question for a product intended to compete with the service. This policy makes no legal conclusion about enforceability or permitted law; it selects the safer reversible engineering path while review is pending.

## Permitted Inputs

- Public official product documentation that describes user-visible concepts and workflows.
- Public standards, accessibility criteria, browser documentation, and open technical specifications.
- Public open-source projects used only under their licenses and with recorded provenance.
- Interviews and usability tests with participants who consent to the study and use synthetic or participant-owned data.
- Independently written requirements, code, copy, icons, fixtures, styles, tests, and screenshots.
- Generic functional facts such as projects containing milestones and issues, keyboard navigation, filtering, grouping, search, and progress computation.

## Prohibited Inputs and Actions

- Copying or adapting vendor source code, object code, non-public APIs, source maps, algorithms discovered through reverse engineering, or private documentation.
- Copying vendor logos, marks, icons, fonts, illustrations, screenshots, microcopy, motion assets, or distinctive visual compositions.
- Recording private workspace names, issue content, user identities, URLs, identifiers, tokens, cookies, local storage, or credentials in tracked files or public artifacts.
- Publishing competitor screenshots or using them as public visual baselines.
- Marketing the product as official, affiliated, endorsed, identical, or a pixel-perfect clone.
- Using Linear for project issue, milestone, or status tracking. The project-local Control Tower v0.8 store is the sole task authority.

## Existing Reference Evidence

Existing authenticated-reference screenshots under `.control-tower/evidence/` remain private, ignored, and local. Do not add new reference screenshots. Do not copy them into tracked documentation, test fixtures, design files, issues, or release artifacts.

CT-2 retains only aggregate task timings and interaction counts in tracked Discovery evidence. Those aggregates are quarantined from public release and comparative marketing until a qualified reviewer decides whether they may be retained, must be removed, or require a different methodology. They remain an internal engineering diagnostic and do not validate O-002.

## Visual and Interaction Quality

The product may pursue equivalent task coverage, dense information architecture, responsive behavior, accessibility, keyboard efficiency, and high visual quality. Acceptance must use independently created product baselines with synthetic data. Direct pixel comparison to authenticated vendor screens is paused.

Public quality claims must describe measured behavior or eligible-user outcomes, not proprietary visual equivalence. The maintainer-requested BasicLinear product brand is not cleared and has a current exact-name collision; BasicLinear remains the distinct project-identity candidate. The public product must use a name, logo, color system, typography, icon treatment, copy, and overall visual expression accepted by the qualified reviewer.

## Asset Provenance

Every distributable non-code asset needs an entry identifying creator or upstream project, source, creation date, license, modifications, and approval state. Generated assets must record the generator and prompt provenance without embedding private reference material. Unexplained binaries, fonts, screenshots, and copied text block release.

Third-party code and icons require a locked inventory and applicable license or notice text. Dependency metadata is only a first-pass signal; the actual shipped artifacts control the release audit.

## Screenshot Handling

- Public screenshots may contain only synthetic accounts, workspaces, projects, issues, milestones, comments, dates, and attachments.
- Browser chrome, notifications, unrelated tabs, account avatars, and environment secrets must be excluded.
- Reference-product images remain under the ignored private-evidence path and are never attached to Control Tower issues intended for export.
- Image hashes and capture environment may be published for the independent product's own evidence.

## Measurement Boundary

Allowed now: BasicLinear-only performance tests, synthetic workflow completion, accessibility checks, responsive checks, public-document requirements traceability, and eligible-user studies that do not require authenticated competitor access.

Held for review: authenticated competitor task timings, screenshots, dimensions, DOM-derived measurements, automated navigation, and any comparative advertising based on those observations.

## Release Gate

Public release is blocked until all of the following are recorded:

- qualified acceptance of the maintainer-selected `AGPL-3.0-only` license and BasicLinear/BasicLinear identity model;
- qualified disposition of existing authenticated-reference evidence and measurements;
- distinct identity and trade-dress review;
- complete source, asset, font, icon, and copy provenance;
- release-candidate third-party license and NOTICE audit;
- private-data and credential scan;
- network-denied runtime and reproducible build evidence;
- CT-13 completion in local Control Tower.

Any uncertainty narrows or blocks the affected public artifact. It does not require stopping synthetic implementation, local testing, public-document research, or user research that complies with this policy.
