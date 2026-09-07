// Sustained load test against the v2 frontend (Nuxt on Vercel, staging/preview
// per project owner). Ramps to a target number of concurrent virtual users,
// holds there, then ramps down. Unlike stress-breakpoint.js this does NOT
// abort on SLO breach -- it answers "can this handle expected traffic", not
// "where does it break".
//
//   FRONTEND_BASE   default https://v2.bdfunnelbuilder.com
//   VUS             default 50     target concurrent virtual users
//   RAMP_UP         default 30s    time to climb to VUS
//   HOLD            default 5m     time to hold at VUS
//   RAMP_DOWN       default 30s    time to ramp back down to 0
//   MAX_P95_MS      default 1500   p95 latency (ms) considered a pass
//   MAX_ERROR_RATE  default 0.01   failed-request rate considered a pass
//
// Dry run first with a small VUS/HOLD before the real thing, e.g.:
//   k6 run -e VUS=5 -e HOLD=30s load/frontend-load.js
//
// Full run:
//   k6 run -e VUS=100 -e HOLD=10m load/frontend-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { pickPage } from './lib/pages.js';

const FRONTEND_BASE = (__ENV.FRONTEND_BASE || 'https://v2.bdfunnelbuilder.com').replace(/\/$/, '');
const VUS = Number(__ENV.VUS || 50);
const RAMP_UP = __ENV.RAMP_UP || '30s';
const HOLD = __ENV.HOLD || '5m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '30s';
const MAX_P95_MS = Number(__ENV.MAX_P95_MS || 1500);
const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);

export const options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { target: VUS, duration: RAMP_UP },
        { target: VUS, duration: HOLD },
        { target: 0, duration: RAMP_DOWN },
      ],
    },
  },
  thresholds: {
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    http_req_duration: [`p(95)<${MAX_P95_MS}`],
  },
};

export default function () {
  const page = pickPage();
  const res = http.get(`${FRONTEND_BASE}${page.path}`, {
    headers: { Accept: 'text/html' },
    tags: { name: page.name },
  });

  check(res, {
    [`${page.name} -> 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });

  sleep(Math.random() * 2 + 1); // 1-3s think time between page views
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'] : undefined;
  const failRate = data.metrics.http_req_failed ? data.metrics.http_req_failed.values.rate : undefined;
  const reqRate = data.metrics.http_reqs ? data.metrics.http_reqs.values.rate : undefined;
  const line =
    `\nLoad run vs ${FRONTEND_BASE} — ${VUS} VUs sustained for ${HOLD}, ` +
    `~${(reqRate || 0).toFixed(1)} req/s, p95 ${p95 ? p95.toFixed(0) : '?'}ms, ` +
    `error rate ${(failRate != null ? failRate * 100 : 0).toFixed(2)}%\n`;
  return {
    stdout: line,
    'load/results/frontend-summary.json': JSON.stringify(data, null, 2),
  };
}
