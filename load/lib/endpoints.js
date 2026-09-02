// Read-only GET endpoints, taken from the paths the Cypress specs intercept.
// Kept read-only on purpose: a stress test should not create/delete rows in the
// staging DB. Weights are rough "how often is this hit in real admin use".
export const READ_ENDPOINTS = [
  { name: 'GET /admin/products', path: '/api/v1/admin/products?page=1', weight: 5 },
  { name: 'GET /admin/orders', path: '/api/v1/admin/orders?page=1', weight: 5 },
  { name: 'GET /admin/product-categories', path: '/api/v1/admin/product-categories?page=1', weight: 2 },
  { name: 'GET /admin/brands', path: '/api/v1/admin/brands?page=1', weight: 2 },
  { name: 'GET /admin/coupons', path: '/api/v1/admin/coupons?page=1', weight: 2 },
  { name: 'GET /admin/sites', path: '/api/v1/admin/sites?page=1', weight: 1 },
  { name: 'GET /admin/webhooks', path: '/api/v1/admin/webhooks?page=1', weight: 1 },
  { name: 'GET /admin/payments', path: '/api/v1/admin/payments?page=1', weight: 1 },
  { name: 'GET /admin/ecommerce-settings', path: '/api/v1/admin/ecommerce-settings', weight: 1 },
];

const EXPANDED = READ_ENDPOINTS.flatMap((e) => Array(e.weight).fill(e));

export function pickEndpoint() {
  return EXPANDED[Math.floor(Math.random() * EXPANDED.length)];
}
