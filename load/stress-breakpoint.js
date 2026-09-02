// Breakpoint / stress test — ramps request rate up until the API breaks its
// SLOs, then k6 aborts. The arrival rate at the moment of abort is your
// approximate breaking point.
//
// SLOs that define "broken" (override with env vars):
//   MAX_ERROR_RATE   default 0.01   (1% failed requests)
//   MAX_P95_MS       default 1000   (p95 latency, ms)
//
// Ramp shape (override with env vars):
//   START_RPS   default 10     requests/sec at the start
//   MAX_RPS     default 1500   requests/sec target at the end of the ramp
//   RAMP        default 30m    time to climb from START_RPS to MAX_RPS
//                              (k6 aborts earlier when an SLO breaks)
//   MAX_VUS     default 800    upper bound on concurrent virtual users
//
//   k6 run \
//     -e API_BASE=https://staging-api.example.com \
//     -e LOGIN_EMAIL=... -e LOGIN_PASSWORD=... \
//     -e MAX_RPS=2000 -e RAMP=20m \
//     load/stress-breakpoint.js
//
// Tip: add `--out json=load/results/run.json` (or Grafana Cloud) to keep the
// full time series for the write-up.
import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { API_BASE, login } from './lib/session.js';
import { pickEndpoint } from './lib/endpoints.js';

const START_RPS = Number(__ENV.START_RPS || 10);
const MAX_RPS = Number(__ENV.MAX_RPS || 1500);
const RAMP = __ENV.RAMP || '30m';
const MAX_VUS = Number(__ENV.MAX_VUS || 800);
const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || 1000);

const bizErrors = new Rate('business_errors');

export const options = {
  discardResponseBodies: true,
  scenarios: {
    breakpoint: {
      executor: 'ramping-arrival-rate',
      startRate: START_RPS,
      timeUnit: '1s',
      preAllocatedVUs: Math.min(50, MAX_VUS),
      maxVUs: MAX_VUS,
      stages: [{ target: MAX_RPS, duration: RAMP }],
    },
  },
  thresholds: {
    // abortOnFail => k6 stops the whole test the moment the SLO is breached.
    http_req_failed: [{ threshold: `rate<${MAX_ERROR_RATE}`, abortOnFail: true }],
    http_req_duration: [{ threshold: `p(95)<${MAX_P95_MS}`, abortOnFail: true, delayAbortEval: '30s' }],
    business_errors: [{ threshold: `rate<${MAX_ERROR_RATE}`, abortOnFail: true, delayAbortEval: '30s' }],
  },
};

export function setup() {
  return { authHeaders: login() };
}

export default function (data) {
  const ep = pickEndpoint();
  const res = http.get(`${API_BASE}${ep.path}`, {
    headers: data.authHeaders,
    tags: { name: ep.name },
  });

  const good = check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  });
  // Count 5xx / timeouts / 401s separately from k6's transport-level failures.
  bizErrors.add(!good);
}

export function handleSummary(data) {
  const iter = data.metrics.iterations ? data.metrics.iterations.values : {};
  const p95 = data.metrics.http_req_duration
    ? data.metrics.http_req_duration.values['p(95)']
    : undefined;
  const failRate = data.metrics.http_req_failed
    ? data.metrics.http_req_failed.values.rate
    : undefined;
  const line =
    `\nBreakpoint run — sustained ~${(iter.rate || 0).toFixed(1)} req/s before abort/finish, ` +
    `p95 ${p95 ? p95.toFixed(0) : '?'}ms, error rate ${(failRate != null ? failRate * 100 : 0).toFixed(2)}%\n`;
  return {
    stdout: line,
    'load/results/summary.json': JSON.stringify(data, null, 2),
  };
}
