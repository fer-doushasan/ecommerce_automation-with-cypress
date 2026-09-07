// Public, unauthenticated page routes for the v2 (Nuxt) frontend on Vercel.
// Every hit is a full SSR render (or edge function invocation), which is what
// generates real serverless load/cost -- unlike the backend API endpoints in
// endpoints.js, which sit behind login.
export const PAGES = [
  { name: 'GET /', path: '/', weight: 5 },
  { name: 'GET /login', path: '/login', weight: 2 },
  { name: 'GET /register', path: '/register', weight: 2 },
  { name: 'GET /terms', path: '/terms', weight: 1 },
  { name: 'GET /privacy', path: '/privacy', weight: 1 },
];

const EXPANDED = PAGES.flatMap((p) => Array(p.weight).fill(p));

export function pickPage() {
  return EXPANDED[Math.floor(Math.random() * EXPANDED.length)];
}
