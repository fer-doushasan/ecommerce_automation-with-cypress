// Role-permission ENFORCEMENT matrix - Catalogue: remaining sub-groups.
//   Stock(6), Coupons(4), Sales Target(3)
// (Products(5) is in roles-matrix-products.cy.js)

const PRODUCTS = '/admin/catalogue/products'
const COUPONS = '/admin/catalogue/coupons'
const SALES_TARGET = '/admin/reports/sales-target-histories'
const diag = []

describe('Role matrix - Catalogue extras', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-catalogue-extra.json', diag))
  })

  // --- Stock (Products sub-group; likely gates stock UI within products) ---
  it('view product + view stock -> products page loads', () => {
    cy.grantRoleTest(['view product', 'view stock'])
    cy.assertAreaGranted(PRODUCTS)
    cy.dumpPage(diag, 'view product + view stock', PRODUCTS)
  })
  ;['create stock', 'update stock', 'manage stock', 'create stock history', 'view stock history'].forEach((perm) => {
    it(`view product + view stock + ${perm} -> products page loads`, () => {
      cy.grantRoleTest(['view product', 'view stock', perm])
      cy.assertAreaGranted(PRODUCTS)
    })
  })

  // --- Coupons (gate: view customer coupon) ---
  it('baseline -> coupons denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(COUPONS)
  })
  it('view customer coupon -> coupons page loads', () => {
    cy.grantRoleTest(['view customer coupon'])
    cy.assertAreaGranted(COUPONS)
    cy.dumpPage(diag, 'view customer coupon', COUPONS)
    cy.contains('button, a', /new coupon|create coupon|add coupon/i).should('not.exist')
  })
  it('view + create customer coupon -> create button appears', () => {
    cy.grantRoleTest(['view customer coupon', 'create customer coupon'])
    cy.assertAreaGranted(COUPONS)
    cy.contains('button, a', /new coupon|create coupon|add coupon/i).should('be.visible')
  })
  ;['update customer coupon', 'delete customer coupon'].forEach((perm) => {
    it(`view customer coupon + ${perm} -> coupons page loads`, () => {
      cy.grantRoleTest(['view customer coupon', perm])
      cy.assertAreaGranted(COUPONS)
    })
  })

  // --- Sales Target ---
  // /admin/reports/sales-target-histories is gated by `manage sales target
  // history` (confirmed: `view sales target` alone -> /no-access?area=Sales
  // Target Histories). `view sales target` / `update sales target` are
  // widget-level perms tested on top of the page gate.
  it('baseline -> sales target histories denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(SALES_TARGET)
  })
  it('manage sales target history -> sales target histories page loads', () => {
    cy.grantRoleTest(['manage sales target history'])
    cy.assertAreaGranted(SALES_TARGET)
  })
  ;['view sales target', 'update sales target'].forEach((perm) => {
    it(`manage sales target history + ${perm} -> page loads`, () => {
      cy.grantRoleTest(['manage sales target history', perm])
      cy.assertAreaGranted(SALES_TARGET)
    })
  })
})
