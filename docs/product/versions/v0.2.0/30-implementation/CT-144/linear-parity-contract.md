# CT-144 Linear parity contract

## Authority and boundary

- Authority: project-local Control Tower v0.8 issue CT-144 on the existing `S3 — Implementation` milestone.
- Reference: authenticated Linear workspace observed read-only in the user's selected Chrome session on 2026-08-27, plus the user-provided side-by-side issue-detail screenshot.
- Candidate: deployed OpenLinear production at `https://openlinear-gray.vercel.app/`.
- Product boundary: project management only. No AI agents, code review, repository or pull-request management, synchronization, payment execution, or security/adversarial testing.
- Historical boundary: CT-143 remains accepted historical deployment/UAT evidence and is not rewritten by this slice.

## Audited journey and required closure

| Journey | Linear reference behavior | Observed OpenLinear gap | CT-144 acceptance |
| --- | --- | --- | --- |
| Workspace entry and switching | A signed-in user can reach every workspace they own or have joined and switch without signing out | A newly invited user bootstrapped into a separate empty owner workspace, with no route back to the joined workspace | The hosted entry lists every active owned/member workspace from the authoritative membership ledger, preserves the invitation workspace as the preferred destination, and exposes a working role-labelled workspace switcher |
| Workspace/team navigation | Multiple collapsible teams; team switcher; team-scoped Home, Issues, Cycles, Projects, Views; create/join-team affordance | One hard-coded Product team | Owners can create durable teams, switch teams, and see team-scoped data after reload; navigation rows and arrows work with pointer and keyboard |
| Team Home | Overview/Documents/Members tabs with team description, resources, members, useful destinations, and dense single-line recent issue rows with stable sequential identifiers | Metric dashboard and recent records; recent issue identifiers wrapped after the prefix and were derived from random UUID fragments such as `OL-6D82C5` | Team overview uses Linear's information architecture, exposes working Overview, Projects, Views, Members destinations, and keeps status, stable workspace-scoped `OL-1`, `OL-2`, … identifier, title, time, and chevron aligned on one row |
| Team Issues | Active, Backlog, and All issues tabs; dense grouped rows; working display/filter controls | Single generic Issues page and fixed saved-view selection | Active, Backlog, and All issues are first-class working views scoped to the selected team; groups and controls remain functional |
| Workflow statuses | Team-scoped status administration grouped by Backlog, Unstarted, Started, Completed, Canceled; create/edit/reorder workflow states | Fixed `todo / in_progress / done`; no settings UI | Owner can create and edit durable team-scoped statuses with a category and color; issue status menus use the selected team's statuses; reload preserves state |
| Priorities | Distinct semantics and glyphs for No priority, Urgent, High, Medium, Low | Same signal glyph appears for every priority | Every list row and menu uses a distinct accessible priority glyph: empty/minus, urgent alert, and 3/2/1 bars for high/medium/low |
| Issue detail | Dense centered document; rich description; reactions/attachments; compact resources; full activity; top tools; comprehensive value-first property rail | Stretched layout, visible title-save control, always-open resource form, sparse toolbar/properties, heavy comment card, and a compressed label/value property table pinned to the viewport edge | Match the reference hierarchy and density; title saves without a permanent button; resources add from a compact affordance; detail, comments, sub-issues, activity, and properties remain durable and usable; at the audited desktop width the issue title and 400px property rail use the measured Linear x-position, row pitch, typography, grouping, and hover/focus treatment |
| Invite people | Multi-email invite with optional team selection | All invitations are generic workspace membership | Owner can select one or more teams when inviting; selected teams are preserved and applied on acceptance without changing billing semantics |
| People identity and assignment | Member pickers, issue activity, comments, and assignee properties use recognizable profile names | Non-owner collaborators appeared as opaque `Team member …` labels | Active member records resolve through the hosted user directory and show the Google display name consistently, while still failing closed to an opaque fallback when profile data is unavailable |
| Issue observation and Inbox | Issue subscribers can subscribe/unsubscribe; assignments, comments, and changes surface as unread Inbox activity and clear when opened | No issue subscription model; Inbox was only a recent-issues list | Creator, assignee, and commenter observation is durable; explicit Subscribe/Unsubscribe works; subscriber initials appear in Activity; bounded per-user issue events drive unread Inbox state and are marked read when the issue opens |
| Cycles | Cycle records with current/upcoming/completed state, dates, scope and progress | Milestones relabeled as cycles | Durable team-scoped cycles render current/upcoming/completed state, scope and progress; milestones remain project milestones |
| Projects | Dense list/table with filters, display options, status, priority, lead, target, issue count and progress | Simplified cards | Team project list exposes working list controls and the key Linear properties; create and detail flows remain durable |
| Views | Durable custom issue/project views with filters and create-view flow | Fixed preset cards | Owners/members can create and reopen durable team-scoped views; issue and project view types are explicit |
| Settings | Dedicated administration hierarchy including Workspace, Teams, Members and per-team Workflow settings | Four sparse tabs | Workspace settings expose Teams and Workflow states as working administration surfaces while preserving People, Billing and API/MCP boundaries |
| Global typography | Inter Variable with a compact, consistent display/body/UI/metadata hierarchy across issue detail, navigation, lists, settings, and dialogs | Machine-dependent system fallback; body, section, navigation, tab, and timestamp roles were too small or light | Both application entries self-host one pinned Inter Variable family and every workspace surface uses the measured Linear role scale: 24/32 display, 15/24 body, 15/23 section, 13/20 UI, and 12/16.8 metadata with matched weights and title/body/key tracking |

## Interaction contract

1. Every visible navigation row, chevron, dropdown trigger, option, primary action, and close action in the audited journey must respond to pointer and keyboard activation.
2. Menus expose correct `aria-expanded`, listbox/menu roles, selected state, Escape dismissal, outside-click dismissal, and ArrowDown/Enter entry behavior.
3. Mutations use exact expected revisions and bounded idempotency keys; conflicts refresh authoritative state without fabricating success.
4. Team, status, cycle, and saved-view records are workspace-scoped, use exact schemas, canonical timestamps, and fail closed when inconsistent.
5. Existing production issue/project/milestone/comment data remains readable and is assigned to a deterministic default Product team during compatibility projection.
6. The property rail exposes supported values first, preserves a screen-reader name for every property, groups project/milestone and team/cycle values under named sections, and keeps every dropdown option, Escape dismissal, and trigger-focus restoration path functional.
7. The opaque `issue_<uuid>` remains an internal storage/route identity only. Every issue receives one immutable positive workspace sequence number; existing records are projected chronologically by canonical `createdAt` plus opaque-ID tie-break, and the first successful later mutation persists the complete projection and atomic next-number counter. Idempotent replays do not consume a number, and sequence gaps/duplicates fail closed.
8. Typography is role-based rather than page-local: issue titles, reading copy, section headings, navigation/list rows, tabs, properties, forms, settings, dialogs, activity, keys, and timestamps resolve through the same measured font family, size, line-height, weight, and tracking contract.

## Verification contract

- Focused positive nonsecurity service, HTTP, repository, and web tests.
- All declared workspace typechecks.
- Isolated hosted production build and environment validator.
- Development and production deployment readback with separated Firebase projects/databases and Checkout disabled.
- A real two-Google-account invitation, team acceptance, recognizable-member assignment, member comment, explicit observation toggle, unread Inbox event, mark-read, workspace switch, and reload journey in Chrome. Production writes are limited to the sponsor-authorized PM UAT records; no Checkout/payment/security action.
- Same viewport and same state reference/candidate Chrome captures, combined for visual judgment on each core journey.
- A development-only real-data issue creation and full reload proving that the deployed service reserves the next number after the historical sequence; production verification remains read-only for this numbering slice.
- Iterative fix-and-recapture loop until no clear structural mismatch remains.
- Computed-style readback in both deployed environments for display, body, section, navigation, property, row, tab, key, and timestamp roles, plus browser-console verification that the self-hosted font assets load without warnings.
- Independent review is a separate gate and is not self-certified by the implementation session.
