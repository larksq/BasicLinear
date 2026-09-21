# CT-26 Direct Issue Route Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. A fresh issue URL now renders the full detail route at every width; contextual desktop and tablet navigation retain the panel/overlay; contextual navigation below 768px becomes the full route without losing its history origin.

## Correction

The previous client inferred only whether an issue ID existed. Its URL synchronization rewrote every direct load as `openlinearIssue: true`, so a fresh link at 1440x900 retained two list rows, a 549px list region, a 560px sticky `aside`, and a 12px separator. The correction:

- models `direct` and `contextual` intent independently from presentation;
- derives fresh `?issue=` navigation as direct unless its history entry explicitly records contextual origin;
- presents direct intent as a route at every width, contextual intent as a panel from 768px, and contextual intent as a route below 768px;
- keeps a single `IssueDetail` component and preserves intent when another issue opens from detail;
- retains unrelated history state and writes contextual intent only for contextual entries;
- makes direct Back/Escape replace the issue URL with the retained list instead of leaving the app;
- makes contextual Back/Escape consume the pushed entry and restore the exact issue-row trigger; and
- supplies a route-only screen-reader H1 while contextual detail inherits the list H1.

## Verification

| Check | Result |
|---|---|
| Focused route and source contract | 2 files, 8 tests passed |
| Complete unit | 11 files, 49 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite passed; 1,916 modules transformed; issue chunk 490,224 bytes |
| Fresh direct desktop | `route`; contextual history false; 0 rows; no list, panel, or separator; one H1; 45 visible controls, 0 unnamed, 0 outside, 0 duplicate IDs, 0px overflow |
| Contextual desktop | `panel`; contextual history true; 2 rows; 549px list, 560px panel, 12px separator; one list H1; 0px overflow |
| Contextual 767px | `route`; contextual history retained; no list, panel, or separator; one detail H1; 0px overflow |
| Contextual 768px | `panel`; list and overlay restored; hidden separator remains `display: none`; one list H1; 0px overflow |
| Fresh direct mobile | `route`; contextual history false; 0 rows; no list, panel, or separator; one H1; 35 visible controls, 0 unnamed, 0 outside, 0 duplicate IDs, 0px overflow |
| Direct Escape | Issue parameter removed and two fixture rows returned without navigating away |
| Contextual Escape/Back | Issue parameter removed and focus restored to issue `70000000-0000-4000-8000-000000000023` |
| Browser diagnostics | 0 warning and 0 error console records after each final-bundle navigation |

## Screenshots

- `evidence/ct26-direct-desktop-1440x900.png`, SHA-256 `d3a84004a29ce3894457c7ac0fb7bc960488b3d58862e756c4743fc3ce6cd517`.
- `evidence/ct26-contextual-desktop-1440x900.png`, SHA-256 `3977a8874cd0fd04a9cb3fddc1cd53605c294a4bb7572cf3fc86916b07292c38`.
- `evidence/ct26-direct-mobile-390x844.png`, SHA-256 `cc16690e257e8d35f022b5e1c71da23cea12c3031262c33ec81cbb44d86adcfd`.

All images use deterministic synthetic fixture records. Visual inspection found no overlap, clipped command, inaccessible property, or unintended nested surface. The direct desktop state uses the accepted wide content/property layout; mobile stacks properties below content.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-005 | Direct and contextual modes share the same editable detail component and mutation semantics. |
| R-010 | Back and Escape are named, visible, and recoverable; contextual focus returns to the exact trigger. |
| R-011 | Contextual entries retain list state and focus, while direct entries return to the retained list without inventing a prior entry. |
| R-104 | Each presentation has one level-one heading, all visible controls are named, and duplicate IDs are absent. |
| R-110 | Exact 767px/768px switching and desktop/mobile geometry have zero overflow or outside controls. |

## Browser Boundary

The rebuilt production bundle was reviewed through the local Playwright browser because the connected Chrome tab referenced stale pre-build assets and the locked Mac prevented OS-level navigation. This evidence does not claim a new Chrome run. CT-24 retains the latest explicit Chrome boundary matrix, and the authenticated product at `http://127.0.0.1:4175` was not changed.

## Privacy And Authority

The fixture is read-only and synthetic. No authenticated Linear workspace, Google account, credential, private reference artifact, API result, or MCP result enters this evidence. Control Tower project-local v0.8 remains the only issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence closes CT-26 implementation output and adds focused R-005/R-010/R-011/R-104/R-110 coverage to CT-12. It makes no O-001 through O-005 claim and does not resolve CT-21's clean-host environment gate.
