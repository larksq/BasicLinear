# CT-94 Issue-Detail Draft Evidence

## Verdict

`IMPLEMENTATION_COMPLETE_BROWSER_ACCEPTANCE_PENDING`. BasicLinear now retains dirty issue content and new-comment drafts by issue identity while the Issues view remains mounted, restores the matching draft after navigation or responsive remount, and prevents draft or transient detail state from crossing issue or workspace identity.

## Behavior

| Contract | Implemented behavior |
| --- | --- |
| Content draft | Title, description, and resources share one controlled per-issue draft with the originating expected revision. |
| Comment draft | New-comment content is read from and submitted for only the selected issue; empty documents are pruned and cannot submit. |
| Navigation | Close/reopen, relation navigation, browser Back, and panel/route remount restore the matching issue draft. |
| Workspace boundary | The in-memory registry carries its workspace identity and exposes no prior-workspace record during a workspace change. |
| Local-service interruption | The registry remains above the detail surface and survives the cached-workspace interruption behavior implemented by CT-93. |
| Cleanup | Content save, comment save, purge, explicit content discard, and explicit comment discard clear only their matching scope. |
| Conflict | Confirmed server values remain locked during conflict; Reapply advances the expected revision while retaining the draft. |
| Resources | Cancel restores server resources without discarding unrelated title or description work. |
| Feedback | One named retained-draft status exposes explicit content and comment discard commands with bounded desktop/mobile geometry. |
| Storage | No browser storage, database, API, schema, Docker, remote service, or external request was added. |

## Verification

| Check | Result |
| --- | --- |
| Focused tests | 1 file / 6 tests passed |
| Related focused regression | 4 files / 33 tests passed |
| Complete regression | 61 files / 416 tests passed |
| Typecheck | 8 / 8 workspaces passed |
| Production build | 1,948 modules / 105 files / 1,860,412 bytes; no warning |
| Release-audit regression | 6 / 6 passed |
| Loopback readiness | `ready` on port 4275 |
| Served candidate | `index-BpZUTt6k.js` and `index-Bg1fPRCx.css` returned |
| Rendered Chrome evidence | 0 captures; blocked before page open |

## Source Bindings

| Path | SHA-256 |
| --- | --- |
| `apps/web/src/issue-detail-drafts.ts` | `3709b4a84a3706c14383f4d5597f1f1fd9511b8dc14b90324ccff8c062512789` |
| `apps/web/src/issues.tsx` | `1ecbe8c382c2b85e06fb0e231d41baa026aab0bfd9361b45b5461aa0d36e6bdb` |
| `apps/web/src/styles.css` | `c1e168945e7bcfa6b0ccca06f830268800ddd4eacfc456c9edadab462e914040` |
| `apps/web/tests/issue-detail-drafts.test.ts` | `96316f8e8c73e6a65a7cc3eb8429d81db7f809ff1bf6cc14df47825859b252b1` |
| `apps/web/tests/layout-contract.test.ts` | `e693152b588f5613174d5b22bd3a5c6711c6ff07df07ec6f636df7143ef12e4e` |
| `apps/web/tests/workspace-capabilities.test.ts` | `81a72ca3cc75b7b89323d9a42314d7bbd8e77bd9e1f2db82d6cfdd720b3f9e41` |

## Protected Gates

No rendered acceptance is inferred from source inspection, tests, typechecks, build output, loopback health, or served HTML. CT-12 must verify issue A versus issue B isolation, close/reopen, related-issue navigation, browser Back, responsive remount, service interruption, save/discard focus, conflict reapply, long labels, desktop/tablet/mobile geometry, and pinned Light/Dark contrast in Chrome. CT-82, CT-3, source-revision, provenance, and accountable-review gates remain open.
