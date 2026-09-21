# Hosted Firestore backup and isolated-restore runbook

## Boundary

The candidate uses a whole-database Firestore managed export or PITR export at a whole-minute timestamp within the supported seven-day window. A live export is not an exact snapshot and filtered collection-group exports do not automatically include nested subcollections. For that reason, this runbook requires the entire database, an explicit collection inventory, and an isolated destination project. It never authorizes an in-place production import.

Local CT-141 tests use `synthetic_fixture` evidence only. A production operations record must use `provider_drill` evidence generated from an actual provider export/import. Until that occurs, no live restore or release-readiness claim is allowed.

## Export

1. Confirm Blaze billing, the source project, a deployment-owned backup bucket, the service account permissions, PITR availability, and the budget alert. Never place a service-account key in the repository.
2. Select a whole-minute `snapshot-time` no later than export request time and no more than seven days earlier. Record the source project through its HMAC digest.
3. Export the entire database. Do not pass a collection filter. Record operation ID, request/completion timestamps, document count, manifest SHA-256, bucket retention, and application policy digest.
4. Acknowledge that export and import operations incur document reads/writes and that usage alerts can arrive only after completion.

## Isolated restore drill

1. Create or select a disposable destination whose canonical ID starts with `restore-drill-`; it must not equal the source project. Apply the candidate Firestore rules before application smoke testing.
2. Import the export into that isolated project. Record start/completion timestamps, restored document count, and restored canonical manifest digest.
3. Compare the exact required collection-group inventory in the application policy. Counts and canonical manifest digests must match. Run the hosted application smoke check and browser-rules isolation suite against the destination.
4. Schedule destination deletion after verification and within seven days. Record the schedule in signed evidence; deletion itself remains a separately authorized provider action.
5. If chronology, count, digest, collection inventory, smoke, or rules isolation differs, mark the drill failed. Do not import into production and do not sign evidence by hand.

## Recovery decision

An accountable incident owner chooses a recovery point after assessing data loss, security isolation, billing, and customer communication. Restore first to a new isolated project, validate, then use a separately approved migration/cutover plan. This runbook provides evidence, not automatic disaster recovery.

## Sources

- [Firestore managed export and import](https://firebase.google.com/docs/firestore/manage-data/export-import)
