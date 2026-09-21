# CT-143 development and production environment separation

Status: **In Progress**. The development and production hosted stacks are deployed and their nonsecurity functional paths were verified with separate Firebase data. CT-143 remains open for an independently authorized review and for any later decision to connect Stripe; the sponsor-directed security-test skip remains in force.

## Environment map

| Boundary | Development | Production |
| --- | --- | --- |
| Deployment identity | `development` | `production` |
| Hosted control mode | `uat` | `production` |
| Firebase project | `openlinear-dev-larksq` | `openlinear-prod-larksq` |
| Firebase Web App | `1:957696487111:web:81032180603537bf7598e2` | `1:1073376700903:web:ef4a5cd62c3cbabee2f542` |
| Firestore database | `(default)`, isolated development data | `(default)`, isolated production data |
| Firestore delete protection | disabled | enabled |
| Google sign-in | enabled | enabled |
| Payment boundary | verification mode over the test-mode contract | verification mode over the live-mode contract |
| Stripe/provider calls in this verification | none | none |
| Cloud Run service | `openlinear-hosted-api-dev` | `openlinear-hosted-api` |
| Cloud Run revision | `openlinear-hosted-api-dev-00003-r6z` | `openlinear-hosted-api-00005-s2j` |
| Backend URL | <https://openlinear-hosted-api-dev-957696487111.us-central1.run.app> | <https://openlinear-hosted-api-1073376700903.us-central1.run.app> |
| Vercel project | `openlinear-development` | `openlinear-online` |
| Public workspace site | <https://openlinear-development.vercel.app> | <https://openlinear-gray.vercel.app> |
| Final deployment | `dpl_65aGDM7x2rMaqUksCysoY5mV2QCe` | `dpl_DLgNcNg2o2RvABkHj24dSQtd3RvU` |

The production project's `openlinear-online.vercel.app` alias is Vercel-account protected; the verified public production entry is `openlinear-gray.vercel.app`. Each frontend rewrites API, OAuth, discovery, and MCP paths only to its matching Cloud Run service. Each service is bound to its matching Firebase project, Google Cloud project, Firestore database, hosted-control mode, and Stripe test/live mode. The environment validator rejects cross-environment or shared Firebase identities.

## Google login defect and remediation

The original development failure had two layers. First, the prebuilt Vercel environment snapshot did not contain the complete public Firebase Web configuration. Second, after configuration was corrected, Firebase's desktop popup resolver was initialized lazily, so the first click could be consumed while the hidden resolver iframe started and only the retry opened Google.

The final client now initializes Firebase persistence and the popup resolver before rendering the hosted application. The login button is not enabled until that preparation finishes; therefore its first enabled click opens the Google account chooser immediately. `apps/web/tests/hosted-auth.test.ts` verifies initialization order and ready-auth reuse.

After the final deployments, the first enabled `Continue with Google` click opened the account chooser on both public sites. Chrome selected the sponsor-authorized `larksq@gmail.com` account and both sites restored their existing workspace without creating a second trial.

## Operating-workspace remediation

The temporary hosted console is no longer the authenticated product surface. After the September UAT scope correction, a restored Google session opens directly into an operating workspace whose Workspace section shows all available components by default and can collapse to Projects and Views. Team navigation contains Home, Issues, Projects, and Views. The workspace includes issue lists, rich issue detail, descriptions, sub-issues, resources, durable activity, comments, due-time reminders, a properties rail, projects, milestones, search, account controls, and secondary settings for teams, workflow, people, billing, REST, MCP, and skills. Cycles are intentionally absent from the current-version UI and supported browser API; legacy records remain only for nondestructive compatibility.

The browser API now uses the shared `ProjectManagementService` for project and milestone list/create/update plus issue placement. It retains the same Google identity, workspace authorization, revision, idempotency, mutation-audit, entitlement, and Firebase repository boundaries as the existing issue/comment routes. Issue links use a reloadable `#issue=<stable-id>` fragment.

The supplied Linear reference and the deployed development workspace were compared side by side at equal image height. The retained Chrome captures, including the former Cycles page, document the pre-UAT build and must be read as historical evidence. The earlier responsive pass remains recorded at 390 × 844. Final evidence is under `CT-143/audit-final/`; `design-qa.md` records that earlier comparison. Current product scope is governed by `docs/product/versions/v0.2.0/UAT-SCOPE.md`.

## Real-data Chrome verification

The two observations used distinct Firebase users and records even though the same Google email was selected:

| Observation | Development | Production |
| --- | --- | --- |
| Account | `larksq@gmail.com` | `larksq@gmail.com` |
| Firebase UID | `cPnkknUPgrYHI9himMZ2E5YV9MH3` | `792wzlzTocYlwhAcFsF1useq4QJ2` |
| Trial | 27 Aug 2026 through 26 Sep 2026 | 27 Aug 2026 through 26 Sep 2026 |
| Verification access | Pro, 1 seat, ends `9999-12-31T23:59:59.999Z` | Pro, 1 seat, ends `9999-12-31T23:59:59.999Z` |
| Task | `Development verification project task — 2026-08-27` | `Production verification project task — 2026-08-27` |
| Task state | assigned to owner, In progress, High, revision 3 | assigned to owner, In progress, High, revision 3 |
| Comment | development real-data isolation / no Stripe receipt | production real-data isolation / no Stripe receipt |
| Project | `OpenLinear launch readiness`, In progress | `OpenLinear production launch`, In progress |
| Milestone | `Launch verification`, target 30 Sep 2026 | `Launch verification`, target 30 Sep 2026 |
| Placed issue | `Verify Linear-style workspace launch`, project + milestone, rich content | `Verify production workspace launch`, project + milestone |
| Placed issue state | To do, unassigned, revision 3; description, resource, sub-issue, comment, and durable activity persisted | In progress, High, assigned to owner, revision 4 |
| Stable issue link | persisted across Chrome reload | persisted across Chrome reload |
| Reload/re-auth | workspace, task, and comment persisted | workspace, task, and comment persisted |

Both billing panels visibly showed `Verification Pro`, `Does not expire`, and the 31 Dec 9999 server-record end. Checkout was disabled and the UI stated that provider subscription creation is disabled for the allowlisted account. No card, Checkout session, Stripe subscription, or charge was created. The ordinary trial record remains exactly 30 consecutive days; the no-charge verification grant is a separate server-side entitlement.

The deployed browser now exposes the working project-management surface itself, not a temporary evidence dashboard. Distinct project, milestone, and placed-issue records were created through the normal Google-authenticated browser API in each environment and then read back after reload. Development additionally persisted a rich description, one resource, one sub-issue, and one comment; the activity feed showed four visible records without double-counting the comment audit. The multi-email invitation UI was inspected without creating an invitation. No personal access token was created.

## Verification and claim boundary

Nonsecurity verification includes focused hosted-auth/owner/environment/project tests, web/hosted/hosted-service typechecks, the full production build, the hosted environment validator, Vercel production builds, live deployed-page inspection, persisted Google authentication, workspace bootstrap/readback, project and milestone creation, issue placement, task assignment/update, existing comment persistence, stable issue-link reload, desktop/mobile visual inspection, and settings/billing/API/MCP inspection in Chrome. Security/adversarial tests were skipped by sponsor direction.

This evidence proves deployed environment separation and the bounded real-data project-management paths above. It does not prove a Stripe test or live payment, invitation acceptance, token creation, public release acceptance, outcomes, or legal/privacy/security approval. Production Stripe configuration remains intentionally disconnected during no-charge verification. A separately authorized independent CT-143 review is still required before Done.
