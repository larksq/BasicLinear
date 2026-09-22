# Evidence and claim index

| Claim | Label | Resolving evidence | Resolution or consequence |
|---|---|---|---|
| C-201: v0.2.0 must add a hosted product with the stated trial, prices, collaboration, API, MCP, and skills, while excluding agents and code review. | Fact (maintainer-confirmed) | E-201 | Scope authority |
| C-202: v0.1.0 deliberately supports one local owner, loopback, SQLite, and no login or collaboration. | Fact | E-202, E-203, E-216 | v0.2.0 is a new security/concurrency boundary, not a small toggle |
| C-203: Firebase Authentication supports Google account sign-in for web clients. | Fact | E-204 | Use Firebase Auth Google provider |
| C-204: Firestore rules can enforce document access from authenticated user IDs and stored roles. | Fact | E-205 | Deny-by-default workspace membership rules remain mandatory |
| C-205: Firestore transactions can atomically update multiple records. | Fact | E-206 | Use trusted transactions for invitations, seats, assignments, and entitlements |
| C-206: App Hosting requires Blaze and costs vary with bandwidth, compute, builds, logging, and storage. | Fact | E-207, E-208 | Cost budgets and alerts are release requirements |
| C-207: A maintained Firebase/Stripe extension can support subscription checkout and synchronize billing state. | Fact | E-209 | Stripe is the planning recommendation; production configuration is not yet authorized or performed |
| C-208: Current hosted alternatives charge materially more than the maintainer's $2/$12 offer. | Inference | E-214, E-215 | Low price is differentiating but increases unit-economics risk |
| C-209: Current MCP supports Streamable HTTP, schema-described tools, and explicit security obligations. | Fact | E-210, E-211, E-212 | Expose a narrow PM tool surface over the same authorization domain as the API |
| C-210: One hosted workspace per owner account and two roles are enough for the requested basic collaboration slice. | Assumption | E-201 | Non-blocking scope-reduction assumption; validate in UAT and defer advanced tenancy |
| C-211: “One month free Pro access” means a one-time 30-day, no-card trial for a newly created owner account. | Assumption | E-201 | Non-blocking explicit interpretation; show exact dates before signup completion |
| C-212: After trial expiry, an unsubscribed workspace can safely fall back to a one-active-user Free mode without deleting data. | Assumption | E-201 | T-VALIDATE-PRICING must test comprehension and unit economics before launch |
| C-213: Scoped personal access tokens are an acceptable v0.2.0 bridge for REST and MCP clients. | Assumption | E-210, E-211, E-212 | T-SECURITY-MCP must validate token lifecycle and client compatibility; OAuth 2.1 delegation remains later scope |
| C-214: Hosted activation, collaboration, conversion, and automation baselines are presently unknown. | Unknown | E-201, E-216 | T-BASELINE-201 through T-BASELINE-204 remain required and non-blocking only for implementation |

No contradiction blocks Planning. The tension between a very low subscription price and variable hosted costs is carried as a measurable risk rather than resolved by invented economics.
