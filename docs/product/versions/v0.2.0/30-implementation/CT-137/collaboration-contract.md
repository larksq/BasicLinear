# CT-137 single-assignee task and durable-comment contract

## Accepted boundary

CT-137 implements I-205 only. A hosted issue has zero or one assignee, and a non-null assignee must be an active member of the same Firebase-hosted workspace. Active owners and members can create and list basic tasks. Owners can assign or unassign any task; members can change title, status, or priority only on work currently assigned to them. Every update uses an expected positive revision and rejects stale or no-op writes.

Comments are plain text only. Active workspace members can create and list them. The author can edit or soft-delete their comment, and an owner can moderate it. Author and `createdAt` never change. Soft deletion removes the body while retaining an ordered tombstone, revision, author, and timestamps. This slice intentionally excludes mentions, reactions, attachments, notifications, presence, custom roles, SSO, SCIM, billing, REST tokens, export, MCP, AI agents, code review, repositories, and pull requests.

## Trusted mutation boundary

The shared CT-135 authorization service runs before every operation. Each mutation then re-reads the exact active actor membership inside the same repository transaction. Assignment also reads the selected membership inside that transaction and rejects missing, removed, malformed, or foreign users before any write. All reads precede all writes. The Firestore adapter preserves that ordering.

Mutation requests require bounded idempotency keys. A server-only collaboration secret authenticates every retry-record field with HMAC-SHA-256. Replays require the same authenticated user, workspace, operation, request digest, entity, revision, lifecycle timestamp, and create author where applicable. Key reuse with different input conflicts; field, binding, lifecycle, or clock tampering fails closed. Concurrent expected-revision writes serialize to one success and one conflict.

The hosted HTTP service accepts verified, revocation-checked Google identity through same-origin routes. Request shapes and sizes are bounded, errors are redacted and non-cacheable, and the browser never calls Firestore for collaboration records. Firestore rules deny all direct reads and writes for issues, nested comments/activity, collaboration idempotency, product events, and mutation audits.

## Evidence and privacy

Task creation, active-member assignment, assigned-member title/status/priority changes, and comment creation emit the existing CT-133 measurement events. User references use the canonical `user:${uid}` form, and assignment/action/comment records share the exact issue ID required by O-202. Every mutation creates a privacy-safe audit and content-free activity record in the same transaction.

Comment bodies never enter product events, activity records, error envelopes, or audit changes. Audits contain only one-way SHA-256 before/after digests for content. Idempotency stores only an HMAC request digest, never the raw retry key or comment body. O-202 and O-204 remain `baseline_needed`; this implementation does not claim P-T205 qualification, deployment, release approval, or legal/privacy/security approval.

## User experience

The owner workspace includes a responsive task board, active-member assignee selector, optimistic-revision task editor, and comments. An accepted member invitation opens the same board as “My Work and workspace tasks”; only assigned work is editable by the member. If a stored assignee has since been removed, the owner selector retains a disabled “Removed member” option until the owner explicitly reassigns or unassigns the task. An unchanged task save is reported as unchanged without issuing a mutation; genuine revision conflicts retain the refresh-and-retry message. Comment editing inserts a programmatically focused, visibly labeled textarea and returns focus to the initiating Edit button after Save or Cancel. Save restoration deliberately waits until the pending mutation completes and the remounted Edit button is enabled; the restoration reference is retained while the button is disabled or not yet mounted. Native buttons, inputs, selects, textareas, labels, status regions, `aria-current`, visible focus, and the existing mobile breakpoint provide the keyboard/mobile acceptance surface.

## Build provenance boundary

Production local and hosted web entries are compiled in separate Vite input graphs. The local pass clears `apps/web/dist`; the hosted pass writes its independently derived HTML, JavaScript, and CSS into the same output directory without deleting the already-built local artifacts. Firebase Hosting still ignores the local `index.html` and serves `hosted.html`. The hosted graph has only `hosted.html` as input and cannot load the local `index.html` or `src/main.tsx`.

The boundary test performs two no-write hosted builds. The second injects an in-memory transform that would change the local HTML entry if Vite loaded it; the transform is never invoked, and every emitted hosted filename and byte remains identical. The generated hosted HTML resolves only its favicon, hosted JavaScript, and hosted stylesheet, with no local or editor preload. This makes local-entry inputs intentionally outside the hosted review seal while preserving the combined local/hosted build output.

Local OpenLinear data remains a separate SQLite authority. No local upload, synchronization, or authority conversion is introduced.
