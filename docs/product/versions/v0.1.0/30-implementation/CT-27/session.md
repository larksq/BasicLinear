# CT-27 Implementation Session

- Issue: `CT-27`, stable ID `ca48a764-bafd-4140-868e-4abccd142f59`, implementation revision `2`.
- Implementation session: `codex-release-hygiene` / `CT27-IMPL-20260820T023955Z`.
- Scope: exclude generated browser-control output from source digests, container contexts, and release scans, then add a deterministic regression fixture for the exclusion.
- Boundary: release policy, ignore contracts, and release-audit tests only; no browser automation, authenticated data, product runtime, API, schema, license, identity, or provider mutation.
- Review session: `codex-release-hygiene-reviewer` / `CT27-REVIEW-20260820T024109Z`.
- Review result: the complete 50-file `.playwright-mcp` root is ignored; the source walk falls from 402 to 352 files before this evidence bundle is attached; the release fixture containing a synthesized secret-shaped value remains READY only because the generated root is outside the candidate; the gated project preflight retains its expected result.
- Outcome boundary: implementation output only. CT-13 remains Todo behind CT-3 and CT-12, and O-005 remains pending.
