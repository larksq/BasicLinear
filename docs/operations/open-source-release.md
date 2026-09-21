# Open-source release preparation

This guide prepares a reviewable source candidate. Publication and production
readiness require the separate qualified identity, provenance, and accountable
release decisions already represented in `ops/release/`.

## Secret scan

Install the [Gitleaks 8.30.1 CLI](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
for your platform and verify the release archive against its published checksum.
Place `gitleaks` on PATH or set `GITLEAKS_BIN` to the executable's absolute path.
CI pins the Linux archive's SHA-256 directly in its workflow.

```sh
npm run test:secret-audit
npm run audit:secrets
# Optional local, redacted evidence; this directory is excluded from publication.
npm run audit:secrets -- --report .local-data/release/secret-scan.json
```

The audit checks every reachable commit, including merge diffs
(`--all --full-history -m`), staged content
when present, and all tracked/non-ignored working files. It rejects shallow
history, unresolved index entries, symlinks, submodules, and private publication
paths. Tracked files remain in scope even when they match `.gitignore`.
Uncommitted and untracked source is included so preparation cannot accidentally
check only HEAD. Temporary copies and raw redacted scanner reports are removed
after each run. The output includes the base revision and working-file digest.

`.gitleaks.toml` extends the default detector with OpenLinear personal and MCP
token formats. Its narrow exceptions cover source-file SHA-256 evidence,
one published image tag, and reviewed synthetic fixtures. Tests and documentation
are scanned. New credentials in those files still fail, and inline
`gitleaks:allow` comments do not suppress the check.

This checks text, decodable values, and archives. Review image contents and
publication rights separately. Ignored local caches, real databases, and private
review exports are not release inputs. Do not publish a ZIP of the working
directory or force-add `.env`, `.vercel`, `.control-tower`, `.playwright-mcp`,
`.local-data`, backups, or `outputs`.

## Verify the candidate

Use the Node and npm versions declared in `.nvmrc` and `package.json`:

```sh
npm ci
npm run typecheck
npm test
npm run test:release-audit
npm run test:secret-audit
node --test scripts/tests/public-search.test.mjs scripts/tests/analytics-privacy.test.mjs
npm run build
npm audit
npm run audit:secrets
git diff --check
```

Keep local and hosted validation claims separate. The default tests exclude the
Firestore emulator suite; hosted release qualification must also exercise that
suite and the provider checks documented in the hosted runbooks. A local build
does not certify production credentials, payment setup, or cloud permissions.

The lockfile updates Tiptap to 3.31.3 and Firebase Admin to 14.4.0. The optional
Google Storage dependency still uses Gaxios 6.7.1, which requests a vulnerable
UUID release. A narrowly scoped override selects UUID 11.1.1; Gaxios uses its
compatible CommonJS `v4()` API for multipart boundaries. The dependency
compatibility test exercises that exact request path without network access.
Remove the override when upstream no longer requires the affected UUID range.

## Refresh the review package

```sh
node scripts/prepare-release-metadata.mjs
npm run prepare:third-party-notices
npm run prepare:release-provenance
```

Inspect the generated notices and provenance. These commands refresh metadata;
they leave reviewer acceptance pending. Review only the intended changed files
before staging. Run the secret scan again after staging so the exact index is
checked, then commit the candidate.

From a clean candidate checkout, prepare the qualified request first, followed
by the accountable request. Commit each generated request before the next step,
so the default preparation commands can enforce their clean-worktree check:

```sh
node scripts/prepare-qualified-identity-review.mjs
# Review and commit the qualified request before continuing.
node scripts/prepare-release-review.mjs
# Review and commit the release request before continuing.
npm run audit:release
```

Worktree preparation during the September 2026 audit used the exported
`requireClean: false` option to refresh draft requests. These drafts identify the
base commit plus a content digest; regenerate them after freezing the final
candidate. Never treat a draft or historical clean-host result as a new
independent acceptance.

## Publication checklist

- Resolve the identity, assets/copy, notice, and release acceptances reported by
  `npm run audit:release`; never replace missing review with generated approval.
- Confirm a current independent clean-host/runtime result for the frozen release.
- Choose and configure the public repository destination. Enable and test its
  private vulnerability reporting route, then update `SECURITY.md` with that route.
- Inspect the complete staged diff and rerun the full-history secret scan.
- Publish only the reviewed commits and tags. Run CI on that exact revision
  before creating the release and attaching any separately reviewed artifacts.

The September 2026 preparation does not create a remote, push commits, rewrite
history, tag a release, or enable public contribution intake.
