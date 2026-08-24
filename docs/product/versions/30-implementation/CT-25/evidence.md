# CT-25 Invalid Filter Restoration Evidence

## Verdict

`OUTPUT_DONE_FOR_CT12`. A malformed, migrated, or unsupported URL filter now retains a bounded visible broken clause, issues no issue-list query, renders no cached issue rows, and remains in the URL until the user explicitly replaces or clears it.

## Correction

The previous URL parser caught malformed JSON, retained the empty default filter, and immediately rewrote the URL. Its shallow `version` and root-type check also accepted structurally invalid clauses until the service rejected them. The result silently broadened the visible issue set. The correction:

- parses and canonicalizes serialized filters with the shared domain normalizer used by the service boundary;
- distinguishes an absent filter from an invalid empty, malformed, unsupported-version, invalid-operator, invalid-date, or invalid-record clause;
- retains at most 240 visible characters of the broken clause;
- disables the issue query and suppresses cached rows while the clause is invalid;
- prevents view effects and issue opens from rewriting the invalid URL;
- disables saving the broadened default as a view; and
- provides named `Replace filter` and `Clear filter` recovery paths, including browser-history restoration.

## Verification

| Check | Result |
|---|---|
| Focused unit and source contract | 2 files, 10 tests passed |
| Complete unit | 10 files, 44 tests passed |
| Type check | All 8 workspaces passed |
| Production build | All packages and Vite passed; 1,915 modules transformed; issue chunk 488.99 kB |
| Invalid direct load | Visible broken clause `{"version":1`; 0 issue rows; `Save new view` disabled; 0 issue-query requests |
| Explicit clear | Invalid state and query parameter removed; 2 fixture rows returned; exactly 1 issue-query request |
| Explicit replace | Empty valid filter applied through the filter dialog; invalid state removed; 2 fixture rows returned |
| Browser history | Valid navigation followed by Back restored the invalid URL, banner, blocked state, and 0 rows without an additional issue query |
| Desktop 1440x900 | 1,136px banner and blocked region, 0 document overflow |
| Mobile 390x844 | 366px two-row banner, wrapped action controls, 0 outside controls, 0 document overflow |
| Browser diagnostics | 0 warning and 0 error console records |

## Screenshots

- `evidence/invalid-filter-desktop-1440x900.png`, SHA-256 `37630c578b5bf472402adea51f772931f01409b4afedd2c02af19c9403a0958b`.
- `evidence/invalid-filter-mobile-390x844.png`, SHA-256 `4e44d92d48d9b9970f5e93922a3e275d695a40fbd2975bf4feceb45bfec8f565`.

Both images use deterministic synthetic fixture records. Visual inspection found no overlap, clipped command, or inaccessible recovery control.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-008 | Invalid serialized view state cannot restore as an unfiltered saved state or be saved as a broadened view. |
| R-009 | The invalid client clause produces no issue query, count, highlight, or cached issue record. Workspace authorization remains unchanged. |
| R-011 | Browser Back re-runs the same parser and restores the blocked clause without discarding or rewriting it. |
| R-110 | Desktop and mobile geometry retain the clause and both recovery commands with zero overflow or outside controls. |

## Browser Boundary

The rebuilt production bundle was reviewed through the local Playwright browser because the connected Chrome tab still referenced deleted pre-build asset names and the locked Mac prevented OS-level address-bar navigation. This evidence does not claim a new Chrome run. CT-24 retains the latest explicit Chrome geometry matrix, and the authenticated product at `http://127.0.0.1:4175` was not changed.

## Privacy And Authority

The fixture is read-only and synthetic. No authenticated Linear workspace, Google account, credential, private reference artifact, API result, or MCP result enters this evidence. Control Tower project-local v0.8 remains the only issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence closes CT-25 implementation output and adds focused R-008/R-009/R-011/R-110 coverage to CT-12. It makes no O-001 through O-005 claim and does not resolve CT-21's clean-host environment gate.
