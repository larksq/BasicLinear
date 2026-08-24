# CT-52 Command-Palette Search Evidence

## Verdict

`IMPLEMENTED_AWAITING_BROWSER_VERIFICATION`. Workspace search results now emphasize every literal query term across identifiers, titles, and subtitles, expose stable recent/search result status, and support bounded Arrow/Home/End listbox navigation that skips disabled commands. Focused contracts, complete regression, typecheck, production build, and deterministic owner/guest fixture responses pass. Rendered desktop, tablet, and mobile interaction verification remains open.

## Implemented Contract

- Search emphasis is a pure text transformation. Whitespace-delimited query terms are normalized and deduplicated, but punctuation, markup-like input, and regular-expression metacharacters remain literal.
- The segmenter selects the earliest next match and the longest term for a same-position tie, then preserves every unmatched character in order.
- React renders matched segments with semantic `mark` elements and renders unmatched segments as ordinary text. There is no raw HTML path.
- Issue and project identifiers, titles, and subtitles use the same emphasis component. An empty recent-search query preserves the original unmarked strings.
- ArrowUp, ArrowDown, Home, and End share one disabled-option-aware resolver. Navigation is bounded, does not wrap, and never returns the read-only guest to disabled New issue.
- A stable metadata row labels Recent or Results and visibly announces recent counts, searching, search failure, zero matches, or result counts without entering the listbox option set.
- Loading skeletons and errors remain visible but non-selectable. Existing server ranking, workspace predicates, recent-result storage, open behavior, active-descendant semantics, and capability gates remain authoritative.
- Existing command rows keep their 44-pixel minimum height. Result text and marks remain inside the single-line overflow contract, and the result metadata row keeps a 24-pixel minimum height across states.

## Automated Verification

| Check | Result |
|---|---|
| Focused literal-emphasis, navigation, state, source, and geometry tests | 1 file, 8 tests passed |
| Complete unit regression | 33 files, 207 tests passed |
| Workspace typecheck | 8 of 8 passed |
| Production build | 1,929 modules; CSS 79,167 bytes; saved views 9,955 bytes; projects 37,258 bytes; issues 117,525 bytes; index 278,893 bytes; editor 402,713 bytes; runtime 589 bytes; HTML 663 bytes; no chunk warning |
| PostgreSQL integration runner | 7 files and 17 tests skipped because `TEST_MIGRATION_DATABASE_URL` and `TEST_APP_PASSWORD` are absent |
| Deterministic fixture host checks | Owner shell/session and guest session/membership returned HTTP 200 at port 4181 |
| Rendered browser captures | 0; deferred after the existing browser-policy denial |

The skipped integration result is not a pass. CT-52 changes no schema, database query, service route, search ranking, authorization contract, or RLS policy, but the full database-backed regression remains part of the pending canonical test matrix.

## Requirement Trace

| Contract | Evidence |
|---|---|
| R-009 | Existing workspace-scoped server search and ranking remain unchanged; returned identifier, title, and subtitle text now exposes literal matched-term emphasis. |
| R-010 | Arrow, Home, and End navigation share one bounded disabled-option-aware resolver while Enter selection and command behavior remain unchanged. |
| R-104 | The combobox/listbox active descendant is retained, full strings remain readable, dynamic result state is announced, and loading/error feedback is not selectable. |
| R-110 | Stable metadata and command-row geometry are source-tested; rendered breakpoint and zoom verification remains pending. |

## Review Corrections

1. The previous guest ArrowUp path could clamp onto disabled New issue. The shared resolver now skips disabled options in both directions and for Home/End.
2. Query punctuation and markup-like strings are matched through literal `indexOf` operations; user input never becomes a pattern or raw HTML.
3. Dynamic result feedback is outside the listbox, so an empty, loading, or failed search never creates a fake selectable option.
4. Search emphasis uses ordinary text and semantic marks inside the existing ellipsis tracks, retaining the complete accessible string and stable row geometry.

## Pending Browser Matrix

At `1440x900`, `1024x768`, and `390x844`, compare owner and guest fixtures. Exercise empty recent state, populated recents, literal punctuation and markup-like queries, exact identifiers, title/description/label matches, loading, no results, failure and retry, ArrowUp/ArrowDown/Home/End/Enter, pointer hover, result opening, workspace changes, and role changes. Prove server order is unchanged, all matched visible terms are emphasized, guest navigation never selects New issue, the live result state is announced without stealing focus, and the dialog has zero overlap, clipped focus, unintended wrapping, duplicate IDs, console warnings, or console errors.

## Privacy And Authority

All checks use repository source and deterministic synthetic fixture data. No authenticated Linear observation, Google account, provider credential, private workspace data, or external identity was required. Project-local Control Tower v0.8 is the sole issue and milestone authority; provider projection remains disabled and `not_synced`.

## Verification Boundary

This evidence does not close CT-52, complete CT-12, approve CT-13, pass rendered P-T10/P-T11/P-T13/P-T18/P-T19, select a license or public identity, authorize release, or validate O-001 through O-005.
