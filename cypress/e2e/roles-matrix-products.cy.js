// Role-permission ENFORCEMENT matrix - Catalogue / Products.
//
// Section gate: `view product` unlocks /admin/catalogue/products
//   (denied -> /no-access?area=Products).
// Row actions (confirmed selectors on v2):
//   update product -> button[aria-label="Edit product"]  on each row
//   delete product -> button[aria-label="Delete product"] on each row
//   create product -> a "New Product" button in the page header
// `view brand` is a widget-level perm inside the Products group - it does
//   NOT unlock the standalone /admin/ecommerce/brands page (that needs the
//   Ecommerce area perm), so it's covered in roles-matrix-ecommerce.
//
// Each test: as admin set "Role Test" = baseline + listed perms; as
// role@gmail.com assert. after() restores baseline.

const PRODUCTS = '/admin/catalogue/products'

describe('Role matrix - Catalogue / Products', () => {
  before(() => {
    cy.on('uncaught:exception', () => false)
  })

  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
  })

  it('baseline only -> products page denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(PRODUCTS)
  })

  it('view product -> page loads, no create/edit/delete actions', () => {
    cy.grantRoleTest(['view product'])
    cy.assertAreaGranted(PRODUCTS, /products/i)
    cy.contains('button, a', /new product/i).should('not.exist')
    cy.get('button[aria-label="Edit product"]').should('not.exist')
    cy.get('button[aria-label="Delete product"]').should('not.exist')
  })

  it('view + create product -> "New Product" button appears', () => {
    cy.grantRoleTest(['view product', 'create product'])
    cy.assertAreaGranted(PRODUCTS, /products/i)
    cy.contains('button, a', /new product/i).should('be.visible')
  })

  it('view + update product -> row "Edit product" action appears', () => {
    cy.grantRoleTest(['view product', 'update product'])
    cy.assertAreaGranted(PRODUCTS, /products/i)
    cy.get('button[aria-label="Edit product"]').should('exist')
    cy.contains('button, a', /new product/i).should('not.exist')
  })

  it('view + delete product -> row "Delete product" action appears', () => {
    cy.grantRoleTest(['view product', 'delete product'])
    cy.assertAreaGranted(PRODUCTS, /products/i)
    cy.get('button[aria-label="Delete product"]').should('exist')
  })

  it('view + manage stock -> page loads (stock is a Products sub-group)', () => {
    cy.grantRoleTest(['view product', 'view stock'])
    cy.assertAreaGranted(PRODUCTS, /products/i)
  })
})
