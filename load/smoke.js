// Sanity check — run this FIRST, before any real load.
// Confirms API_BASE is reachable, credentials work, and the read endpoints
// return 2xx with an authenticated request. 1 VU, a handful of iterations.
//
//   k6 run -e LOGIN_EMAIL=... -e LOGIN_PASSWORD=... load/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API_BASE, login } from './lib/session.js';
import { READ_ENDPOINTS } from './lib/endpoints.js';

export const options = {
  vus: 1,
  iterations: READ_ENDPOINTS.length,
  thresholds: {
    checks: ['rate==1.0'],
    http_req_failed: ['rate==0.0'],
  },
};

export function setup() {
  const authHeaders = login();
  const tok = authHeaders.Authorization || '(none - relying on cookie jar)';
  console.log(`auth header: ${tok.slice(0, 24)}... (len ${tok.length})`);
  return { authHeaders };
}

export default function (data) {
  const ep = READ_ENDPOINTS[__ITER % READ_ENDPOINTS.length];
  const res = http.get(`${API_BASE}${ep.path}`, {
    headers: { Accept: 'application/json', ...data.authHeaders },
    tags: { name: ep.name },
  });

  const ok = check(res, {
    [`${ep.name} -> 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });

  if (!ok) {
    console.error(
      `${ep.name}  status=${res.status}  url=${res.url}\n` +
        `  body: ${String(res.body).slice(0, 300).replace(/\s+/g, ' ')}`,
    );
  }

  sleep(0.5);
}
