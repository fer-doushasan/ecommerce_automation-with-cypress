# Bug: Payments search does not match on Coupon code

## Status: Fixed — verified 2026-08-25
Re-tested after the developer's fix via a new regression test
(`cypress/e2e/payments.cy.js` — "filters the list when searching by coupon
code (regression: coupon search)"). Searching `TEST` now returns the
matching transaction(s) with `data.total > 0` (was `0` in the original
report) and the row renders correctly. No unrelated regressions from this
fix — a separate pre-existing flake in the same file (initial-load skeleton
briefly lacking the Coupon `th`) surfaced during testing but is unrelated to
this bug/fix.

## Summary
The Payments page search box (Admin → Subscription Info → Payments) advertises itself as searching by "transaction ID, coupon or status" (see input placeholder), but searching by a coupon code returns zero results even when a completed transaction used that exact coupon.

## Environment
- App: `https://frontend-bdfunnelbuilder.vercel.app/admin/subscription-info/payments`
- API: `https://backend.bdfunnelbuilder.com/api/v1/admin/payments`
- Shop: MacBook Shop (macbook-shop)
- Observed: 2026-08-23

## Steps to Reproduce
1. Go to **Admin → Subscription Info → Payments**.
2. Confirm a completed transaction exists that used a coupon. Example on record:

   | Transaction ID | Purpose | Total | Coupon | Coupon Discount | Status | Time |
   |---|---|---|---|---|---|---|
   | SP-VZTSKPJCWLR2 | Subscription | ৳6,000 | TEST | −৳4,000 | Completed | 23 Aug 2026 03:03 PM |

3. In the search box (placeholder: "Search by transaction ID, coupon or status..."), type the coupon code `TEST`.

## Expected Result
The search should return at least `SP-VZTSKPJCWLR2` (and any other transaction that used the `TEST` coupon), since the coupon field is explicitly listed as searchable.

## Actual Result
Zero results. UI shows "No payments found."

Raw API response for `GET /api/v1/admin/payments?page=1&per_page=10&search=TEST`:

```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [],
    "first_page_url": "https://backend.bdfunnelbuilder.com/api/v1/admin/payments?page=1",
    "from": null,
    "last_page": 1,
    "last_page_url": "https://backend.bdfunnelbuilder.com/api/v1/admin/payments?page=1",
    "next_page_url": null,
    "path": "https://backend.bdfunnelbuilder.com/api/v1/admin/payments",
    "per_page": 10,
    "prev_page_url": null,
    "to": null,
    "total": 0
  },
  "message": "Payment history retrieved"
}
```

`total: 0` and `data: []` confirm this is a backend query issue, not a frontend rendering bug.

## What does work
- Searching by transaction ID substring works correctly (e.g. a 12-character transaction ID fragment correctly narrows the list to the single matching row).

## Likely Cause
The `search` parameter's WHERE/LIKE clause on `GET /api/v1/admin/payments` most likely only matches against the transaction ID (and possibly status) columns, and omits the coupon code/relation, despite the frontend's placeholder text advertising coupon search.

## Impact
Low-to-medium. The feature is explicitly advertised in the UI but non-functional, which would mislead an admin trying to locate coupon-based transactions (e.g. for reconciliation or support lookups).

## Suggested Fix
Update the backend search query for `GET /api/v1/admin/payments` to also match the `search` term against the coupon code column/relation.
