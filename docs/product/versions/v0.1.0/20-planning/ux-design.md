# UX Design

## Experience principle

The product should feel immediate, quiet, dense, and predictable under repeated work. The reference is used to understand workflow hierarchy, information density, focus behavior, and interaction cost. Branding, tokens, icons, copy, illustrations, and fixtures are independently created. Fidelity is measured on approved clean-room structural regions and cannot override accessibility or data safety.

## Information architecture

The desktop shell has one persistent product rail, a compact view header, and one primary content region. Primary destinations are My work, Projects, Issues, Views, Workflow, and owner settings. There is no workspace picker, team switcher/list, Members destination, sharing surface, or role badge. Search and create are global actions. Project and issue details preserve the originating list context.

Project pages use tabs for Overview, Issues, and Activity. Overview is an unframed document-like surface containing summary, properties, resources, rich overview, milestone list, progress, and updates. Issue details use a wide content column and a restrained property column; contextual opening uses a right panel, while direct navigation uses the full detail route.

## Spatial system

- Desktop product rail: `232px`, collapsible to a `48px` icon rail.
- Top view header: `44px`; dense toolbars: `36px` minimum stable height.
- Issue/project list row: `36px` default, with `32px` compact and `44px` comfortable options.
- Context detail panel: clamp between `480px` and `640px`, default `560px`, user-resizable without changing list column contracts.
- Content maximum for document-like overview: `920px`; tables and work views remain fluid.
- Card radius: at most `6px`; cards are reserved for repeated records and framed tools, never nested page sections.
- Spacing scale: `4, 8, 12, 16, 24, 32`; letter spacing is `0`.
- Typography: system UI stack with `13px` dense body, `14px` normal body, `20px` page title, and restrained `24px` project title.

Columns use stable CSS grid tracks and explicit min/max bounds so icons, labels, dates, and hover controls do not shift rows. Text truncates only where the complete value is available through detail, tooltip, or accessible name. Fixed controls never resize on hover or loading.

## Visual identity

Use a neutral graphite and paper palette with distinct green for success, cyan for selection/focus, amber for warning, red for destructive state, and violet only as a limited label color. Avoid a blue/slate monoculture, decorative gradients, blurred backgrounds, or ornamental blobs. Light and dark themes use the same semantic token names and meet contrast requirements.

Icons come from Lucide at consistent `14px`, `16px`, or `18px` sizes. Familiar icon-only controls use tooltips and accessible names. Text buttons are reserved for clear commands. Binary settings are switches or checkboxes, view modes are segmented controls, option sets are menus, and numeric density/width controls use appropriate steppers or sliders.

## Projects

The projects view supports a dense list with icon, name/summary, status, lead, dates, progress, and an overflow menu. The header contains view switcher, filter, grouping/order, property menu, and create. Keyboard navigation moves row focus without entering every inline control; Enter opens, Space selects, and a context shortcut opens the action menu.

Project creation starts as a focused dialog with name. The implicit team is never presented as a choice. Additional properties are progressive and keyboard reachable. Save retains user context and opens the project overview. Archive is recoverable and visually separated from destructive purge.

The overview presents the project name as the first viewport signal, then inline property rows, resources, overview content, milestones, and activity. Milestones use ordered unframed rows with status/progress, target date, issue count, and disclosure. Adding a milestone uses an inline editor; drag reorder has keyboard alternatives and announces position changes.

## Issues

The default issue view is a compact grouped list. Each row reserves tracks for selection, status, identifier, title, priority, project/milestone, labels, due date, and hover actions according to property configuration. Owner context may be shown as fixed identity metadata where useful, but is never an editable assignee property. Group headers remain sticky within the work region and show count and collapse state. Board uses the same filter and property model.

Issue creation opens from the command palette, the global create key, or contextual project/milestone controls. The title field receives focus; Enter submits under the current defaults, while expanded creation exposes rich description and properties. No shortcut submits destructive or ambiguous work without visible state.

Opening a row preserves scroll, selected rows, group collapse, filter, order, and focused trigger. The context panel updates the URL. Escape closes the deepest transient layer first and returns focus to the trigger. Direct links use the full detail route but share the same detail component and mutation semantics.

Issue detail prioritizes title and description, followed by sub-issues, relations, resources, comments, and activity. Properties remain scan-friendly in the side column. Inline changes show pending state without shifting layout, confirm by revision, and restore the server value with an explicit conflict notice when rejected.

## Views, filters, and search

Filter menus use a query builder with property, operator, and value, backed by a visible summary. Multi-filter state is serializable into a versioned AST. Saved views prompt for a name and are personal to the configured owner; no sharing scope appears. Applying one restores layout, grouping, order, properties, and query. A migrated or invalid filter displays the broken clause and never silently broadens results.

Global search opens as a command dialog with recent items, exact identifier results, projects, issues, and command actions. Results are confined to the implicit workspace and keyboard navigable. Search highlights matched terms without changing row height.

## Keyboard contract

| Action | Default | Recovery/constraint |
|---|---|---|
| Command/search | `Cmd/Ctrl+K` | Repeated key does not stack dialogs |
| Create issue | `C` outside text input | Shows current project/milestone defaults; owner/team are implicit |
| Navigate rows | `J` / `K` or arrows | Does not steal keys from editable fields |
| Open detail | `Enter` | URL updates and trigger is retained |
| Toggle selection | `Space` | Bulk toolbar has stable height |
| Close layer | `Escape` | Closes deepest layer and restores focus |
| Edit property | Contextual menu/shortcut | Announces property and selected value |
| Save view | Command palette/menu | Confirms the personal view name |

Planning fixes action semantics, while `CT-2` may refine shortcuts after benchmark evidence. Browser and assistive-technology reserved keys take precedence.

## Responsive behavior

Desktop at `>=1200px` shows expanded rail and contextual detail. At `768–1199px`, the rail defaults collapsed and detail becomes a near-full overlay while retaining background state. Below `768px`, navigation uses an off-canvas sheet, work tables prioritize identifier/title/status, property controls move into an explicit inspector, and detail is a full route. No core property becomes inaccessible; dense desktop remains the primary optimization.

Screens use stable container constraints at `1440x900`, `1024x768`, and `390x844` baseline viewports, plus wider regression checks. Text wrapping and dynamic sizing prevent overlap. Horizontal scrolling is allowed only inside explicitly announced data regions when a reduced property set cannot preserve meaning.

## States and feedback

Every surface defines loading skeletons with final geometry, empty state with one relevant action, recoverable error, offline/reconnect state, forbidden/not-found ambiguity, optimistic pending, revision conflict, archive, and restored state. Toasts supplement visible state and never carry the only error or success information. Destructive confirmation names the object and consequence.

## Accessibility

Use semantic landmarks, headings, lists/tables, dialogs, menus, and forms. Roving focus applies only to composite widgets. Focus is never hidden behind sticky regions. Status, priority, progress, and relation types have text equivalents. Drag operations have keyboard alternatives. Rich text supports standard editing semantics, and activity entries have readable chronology. Reduced motion disables nonessential transitions.

## Visual acceptance

Synthetic supported-UX fixtures exercise longest labels, many labels, overdue dates, nested relations, empty milestones, complete milestones, loading, conflict, and error states. Internal migration fixtures may still contain unassigned or foreign-member records but must not reveal administration controls. Screenshot baselines pin the rendering environment. Masks cover only documented clocks/cursors and distinct brand regions; they cannot hide layout or content regressions. Per-screen thresholds are accepted after `CT-4`, while O-003 retains its canonical worst-fixture target.
