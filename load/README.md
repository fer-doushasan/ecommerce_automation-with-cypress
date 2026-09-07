# Load testing (k6)

Separate from the Cypress E2E suite. Cypress drives one browser and is not a
load tool; these scripts use [k6](https://k6.io) to generate real concurrent
traffic against the **backend API**.

## Rules of engagement

- **Staging / QA only.** Never point these at production or at infra you don't own.
- Get sign-off from whoever owns the staging environment before a stress run —
  a breakpoint test is designed to push the API until it falls over.
- Scripts are **read-only** (GET endpoints only) so they don't mutate the
  staging database. Keep it that way unless you add explicit cleanup.

## Setup

```sh
brew install k6      # one-time
```

## Environment variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `LOGIN_EMAIL` / `LOGIN_PASSWORD` | yes | – | Admin creds |
| `API_BASE` | no | `https://backend.bdfunnelbuilder.com` | Staging / QA backend. No trailing slash. |
| `LOGIN_PATH` | no | `/api/login` | |
| `TOKEN_JSON_PATH` | no | `data.access_token` | Login returns `{ success, data: { access_token, token_type: "bearer" } }` |
| `MAX_RPS` | no | `1500` | Top of the ramp (requests/sec) |
| `RAMP` | no | `30m` | Time to climb to `MAX_RPS` (aborts earlier on SLO breach) |
| `MAX_VUS` | no | `800` | Cap on concurrent virtual users |
| `MAX_ERROR_RATE` | no | `0.01` | Failed-request rate that counts as "broken" |
| `MAX_P95_MS` | no | `1000` | p95 latency (ms) that counts as "broken" |

## Run

1. **Smoke first** — proves connectivity, auth, and endpoint shapes:

   ```sh
   k6 run \
     -e API_BASE=https://staging-api.example.com \
     -e LOGIN_EMAIL=you@example.com -e LOGIN_PASSWORD=secret \
     load/smoke.js
   ```

2. **Breakpoint / stress** — ramps until an SLO breaks, then aborts:

   ```sh
   k6 run \
     -e API_BASE=https://staging-api.example.com \
     -e LOGIN_EMAIL=you@example.com -e LOGIN_PASSWORD=secret \
     --out json=load/results/run.json \
     load/stress-breakpoint.js
   ```

The console summary prints the sustained req/s, p95, and error rate at the point
of abort. `load/results/summary.json` has the full metrics dump;
`load/results/run.json` has the raw time series for charts.

## Reading the result

- The **arrival rate at abort** ≈ the breaking point for this endpoint mix.
- Check *which* threshold tripped: latency (`http_req_duration`) vs errors
  (`http_req_failed` / `business_errors`). Latency-first usually means CPU / DB
  contention; errors-first often means a pool or connection limit.
- Re-run 2–3 times; breaking points vary ±10–20% run to run.

## Frontend (v2.bdfunnelbuilder.com)

`frontend-load.js` is a separate target from the backend API above: it drives
the **v2 Nuxt frontend on Vercel** (staging/preview environment, confirmed by
project owner), not `backend.bdfunnelbuilder.com`. Every request is a real
SSR page render / serverless invocation, so this is a *sustained load* test
(does it hold up at an expected traffic level), not a breakpoint test — it
does not abort on SLO breach, it just reports pass/fail at the end.

Public, unauthenticated routes only (`/`, `/login`, `/register`, `/terms`,
`/privacy` — see `lib/pages.js`); `/pricing`, `/about`, `/contact`,
`/dashboard` don't exist on this host (404) as of the last check.

```sh
# Dry run first — small VUs/HOLD to confirm the target and script work
k6 run -e VUS=5 -e HOLD=30s load/frontend-load.js

# Real run — 100 concurrent users held for 10 minutes
npm run load:frontend -- -e VUS=100 -e HOLD=10m
```

| Var | Default | Notes |
|-----|---------|-------|
| `FRONTEND_BASE` | `https://v2.bdfunnelbuilder.com` | No trailing slash |
| `VUS` | `50` | Target concurrent virtual users |
| `RAMP_UP` | `30s` | Time to climb to `VUS` |
| `HOLD` | `5m` | Time held at `VUS` |
| `RAMP_DOWN` | `30s` | Time to ramp back to 0 |
| `MAX_P95_MS` | `1500` | p95 latency considered a pass |
| `MAX_ERROR_RATE` | `0.01` | Failed-request rate considered a pass |

Even on staging/preview, Vercel bills per invocation and may throttle
suspicious traffic spikes — start with the dry run, and step `VUS` up
gradually rather than jumping straight to a large number.
