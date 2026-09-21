# T-VALIDATE-PRICING — pricing and unit-economics checkpoint

Status: partial on 2026-08-25. The deterministic cost model is complete; five target-owner comprehension sessions and production usage evidence remain pending. This memo does not change the sponsor-confirmed 30-day trial, USD $2 monthly price, or USD $12 annual price.

## Recommendation

Keep the requested prices for implementation and test-mode billing. Do not activate public billing until:

1. five target owners can correctly explain the trial end, active-seat definition, monthly versus annual totals, no-card behavior, and Free fallback;
2. the selected Firebase region and expected read/write/query workload are entered into a dated cost model;
3. Stripe test-mode invoices, proration, cancellation, refunds, taxes, and failed-payment behavior pass CT-138/CT-142; and
4. G-203 shows total variable hosted and payment cost at or below 50% of recognized subscription revenue.

## Current official cost facts

- Firebase Hosting bills stored static assets and CDN data transfer after its quota, while the trusted Cloud Run/Functions service is pay-per-use with region-dependent compute/request/network charges and a free tier. The selected hosted architecture therefore needs both Hosting and Cloud Run budget evidence. [Firebase Hosting usage and pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing), [Cloud Run pricing](https://cloud.google.com/run/pricing)
- Firestore bills document reads, writes, deletes, index-entry reads, storage, and bandwidth. Its published no-cost quota includes one GiB stored, 50,000 document reads/day, 20,000 writes/day, 20,000 deletes/day, and 10 GiB outbound/month for one database; backups, restores, PITR, cloning, and TTL deletes are separately billed. [Firestore billing](https://firebase.google.com/docs/firestore/pricing)
- Stripe’s current US standard card price is 2.9% plus USD $0.30 per successful domestic-card transaction. Stripe Billing pay-as-you-go adds 0.7% of Billing volume. International cards, currency conversion, tax products, disputes, and other optional products can add cost. [Stripe pricing](https://stripe.com/pricing), [Stripe Billing pricing](https://stripe.com/billing/pricing)

These facts are time- and market-sensitive. CT-141 must capture dated provider readback rather than treating this memo as a permanent price table.

## Payment-cost model

Assumptions: one Stripe card charge per workspace billing period, US domestic card, Stripe standard Payments plus Billing pay-as-you-go, no tax/refund/dispute/currency-conversion cost, and no Firebase cost. Therefore:

```text
Stripe variable rate = 2.9% + 0.7% = 3.6%
monthly workspace revenue = $2 × active seats
annual workspace revenue  = $12 × active seats
estimated Stripe fee      = $0.30 + 3.6% × workspace revenue
```

| Active seats | Monthly revenue | Estimated monthly Stripe fee | Fee / revenue | Annual revenue | Estimated annual Stripe fee | Fee / revenue |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | $2.00 | $0.372 | 18.60% | $12.00 | $0.732 | 6.10% |
| 2 | $4.00 | $0.444 | 11.10% | $24.00 | $1.164 | 4.85% |
| 5 | $10.00 | $0.660 | 6.60% | $60.00 | $2.460 | 4.10% |
| 10 | $20.00 | $1.020 | 5.10% | $120.00 | $4.620 | 3.85% |

At one active seat, the G-203 50% ceiling leaves at most approximately $0.628 per monthly period or $5.268 per annual period for Firebase and every other variable cost after these modeled Stripe fees. That is a guardrail budget, not a forecast or margin claim. The $0.30 fixed card fee makes the $2 one-seat monthly plan the most fragile case.

## Interpretation risks to test with five owners

Each participant must see the same copy and answer without prompting:

1. Is a card required to start the trial?
2. What exact date does Pro end in the shown example?
3. Which people count as active paid seats? Do pending invitations count?
4. What is the total today for one, two, and five seats on monthly and annual billing?
5. Does “$12 per user per year” mean $12/year or $12/month billed annually?
6. What happens to data and collaborators when an unpaid trial expires?
7. Can the product charge automatically before the owner completes checkout?
8. What would make the offer feel unexpectedly expensive or unsafe?

Pass requires all five participants to understand no-card trial start, active-seat billing, the 50% annual discount, and preserved-data/one-writer Free fallback. Any systematic misunderstanding produces a copy or packaging change proposal; it cannot silently change price or trial length.

## Decision boundary

The implementation decision is `keep_for_test`: preserve $2/month, $12/year, and 30 days in schemas, UI copy, and Stripe test-mode fixtures. The public-billing decision remains `pending`. No demand, conversion, or unit-economics outcome is validated by this model.
