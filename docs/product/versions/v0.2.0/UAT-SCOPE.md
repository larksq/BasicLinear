# v0.2.0 UAT scope clarification

Status: accepted product scope as of 1 September 2026.

Deployment status: the corrected scope is live in both hosted environments;
see [UAT deployment — 1 September 2026](./UAT-DEPLOYMENT-2026-09-01.md).

This clarification supersedes earlier implementation notes where they describe
the current hosted workspace surface differently. Historical review artifacts
and screenshots remain evidence of the build that was reviewed at the time;
they are not a promise that every pictured surface remains in v0.2.0.

## Included in the current version

- Every active organization member can discover and open every team.
- A member can join or leave any team independently and can belong to several
  teams at once. Team membership does not create or remove an organization
  seat.
- The organization owner can remove a member from the organization. Removal
  ends workspace access while preserving workspace records and reconciling the
  active-seat count.
- The five system workflow statuses keep fixed names, categories, colors, and
  ordering and cannot be deleted. Their icons remain configurable. Custom
  statuses retain their supported editable fields.
- The Workspace navigation is expanded by default. `Show less` reduces it to
  Projects and Views; `Show more` restores all components available to the
  signed-in role.
- Tasks can have an exact due timestamp. A subscribed, assigned, or creating
  user receives an in-app reminder when that timestamp is reached. Completed
  tasks do not produce a due reminder.

## Explicitly excluded from v0.2.0

Cycles, sprints, and other time-boxed planning panels are not part of this
version. The hosted browser UI and supported browser API expose no cycle
panel, cycle navigation, cycle creation, or cycle assignment.

Legacy cycle records and issue fields may remain readable internally so an
older UAT dataset is not destroyed. That compatibility is an implementation
safeguard, not supported v0.2.0 product scope. A future version must make a
new, explicit product and migration decision before cycles can return.
