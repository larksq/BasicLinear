# User research synthesis

## Evidence posture

No interviews, production cohorts, or payment behavior exist for the hosted product. Discovery therefore separates sponsor-confirmed requirements from user-demand hypotheses. Existing v0.1 evidence supports the project/issue/milestone workflow, not the new hosted conversion or collaboration claims.

## Strongest pain segment

The strongest hypothesized segment is a two-to-ten-person product team led by a technically capable owner who values a dense issue workflow but does not want to operate the local server for every collaborator. The likely first adopter is an existing local user who already trusts the core workflow and now needs asynchronous sharing.

Invited members are a distinct usability segment. Their path should begin with one invite link and Google sign-in, not workspace setup. Their primary jobs are seeing assigned work, updating task state, and commenting. Billing, token creation, and membership administration should remain owner-only.

## Non-driving segments

Large enterprises, regulated organizations, client-service portfolios, open communities, and engineering organizations requiring source-control review are non-driving. Their needs would force custom roles, SSO/SCIM, audit export, guest policies, data residency choices, or code-host integrations beyond the requested basic release.

## Testable hypotheses

- H-201: a new owner understands the 30-day no-card trial and creates a first project and task within ten minutes.
- H-202: an invited member can accept, find assigned work, and comment without owner assistance.
- H-203: workspace owners understand that accepted active members are billed seats while pending invitations are not.
- H-204: users accept a one-user Free fallback after trial because data stays readable and exportable.
- H-205: external AI users prefer a constrained PM tool set and explicit workspace scope over a broad agent feature set.

## Planned evidence

T-VALIDATE-PRICING owns five moderated comprehension sessions using the pricing, invite, and downgrade flows. The baseline tasks own event definitions and cohort reports. UAT must include at least one owner, one invited member, and one external API/MCP client. These tasks may refine copy and defaults; a change to prices, trial length, workspace count, or role model requires re-planning.
