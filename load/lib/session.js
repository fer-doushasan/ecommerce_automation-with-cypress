import http from 'k6/http';
import { check, fail } from 'k6';

// --- Configuration -----------------------------------------------------------
// Required at runtime:
//   LOGIN_EMAIL / LOGIN_PASSWORD  admin credentials
// Optional overrides:
//   API_BASE          default https://backend.bdfunnelbuilder.com
//   LOGIN_PATH        default /api/login
//   TOKEN_JSON_PATH   default data.access_token  (login returns
//                     { success, data: { access_token, token_type: "bearer" } })
//
// NOTE: backend.bdfunnelbuilder.com is the staging / QA backend (confirmed by
// the project owner). Still give whoever runs staging a heads-up before a
// breakpoint run, and prefer an off-peak window.
export const API_BASE = (__ENV.API_BASE || 'https://backend.bdfunnelbuilder.com').replace(/\/$/, '');
const LOGIN_PATH = __ENV.LOGIN_PATH || '/api/login';
const TOKEN_JSON_PATH = __ENV.TOKEN_JSON_PATH || 'data.access_token';

if (!__ENV.LOGIN_EMAIL || !__ENV.LOGIN_PASSWORD) {
  fail('LOGIN_EMAIL and LOGIN_PASSWORD env vars are required');
}

function dig(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function extractToken(body) {
  if (TOKEN_JSON_PATH) return dig(body, TOKEN_JSON_PATH);
  return (
    body &&
    (body.token ||
      body.access_token ||
      (body.data && (body.data.token || body.data.access_token)) ||
      (body.meta && body.meta.token))
  );
}

// Logs in once and returns headers to reuse for the rest of the iteration/VU.
// Cookies set by the login response are kept automatically by k6's per-VU jar,
// so cookie-auth backends work with no token at all.
export function login() {
  const res = http.post(
    `${API_BASE}${LOGIN_PATH}`,
    JSON.stringify({
      email: __ENV.LOGIN_EMAIL,
      password: __ENV.LOGIN_PASSWORD,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /api/login' } },
  );

  const ok = check(res, { 'login 200': (r) => r.status === 200 });
  if (!ok) fail(`login failed: ${res.status} ${String(res.body).slice(0, 200)}`);

  let token;
  try {
    token = extractToken(res.json());
  } catch (_) {
    token = undefined;
  }

  return token ? { Authorization: `Bearer ${token}` } : {};
}
