# Market and competitor research

## Current alternatives

Linear is the direct hosted experience substitute. Its official pricing page showed Free, Basic at $10 per user/month, and Business at $16 per user/month when observed. Plane is the strongest open-source/cloud substitute and markets per-seat plans starting above the maintainer's monthly price. Self-hosting BasicLinear remains the zero-subscription alternative for users willing to operate it.

The evidence does not establish that price alone will cause switching. Hosted incumbents offer broader integrations, administration, and mature collaboration. BasicLinear should compete on a compact combination: product-management focus, source availability, continuity with the local product, low price, and a narrow automation contract.

## Testable differentiation

| Dimension | v0.2.0 hypothesis | Proof |
|---|---|---|
| Price | $2/active seat/month or $12/active seat/year is easy to understand | Pricing comprehension and conversion cohorts |
| Time to collaboration | Google sign-in plus one invite reaches shared work quickly | O-201 and O-202 |
| Ownership | Hosted data remains exportable and local BasicLinear remains an alternative | Export acceptance and documented migration boundary |
| Automation | REST, MCP, and skill surfaces expose the same PM semantics | O-204 canonical task suite |
| Focus | No AI agents or code review dilute the PM workflow | Scope audit and absent tool/route checks |

## Switching costs

Migration is not included in this version. Users must create or import data through existing supported paths before hosted cutover; a full Linear/Plane importer would materially expand data mapping and authorization scope. The release should document this limitation rather than imply seamless switching.

## Economic risk

The annual price equals six months of the monthly plan. That discount is maintainer-confirmed and unusually aggressive. Firebase App Hosting requires Blaze, Firestore charges by operations and storage, and payment processing adds variable cost. R-217 therefore makes cost-per-paid-seat and abuse controls release requirements. T-VALIDATE-PRICING must recommend keep/change/stop before public billing activation; it may not silently change maintainer-confirmed prices.
