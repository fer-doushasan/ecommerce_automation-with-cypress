// Role-permission ENFORCEMENT matrix - Site Builder section (20 perms).
//   Domains(4), Sites(4), Pages(4), Shop(3), Site Settings(5)
// Route guesses from the admin nav; a wrong guess shows up as a failed
// assertAreaGranted/Denied + the diag dump.

const DOMAINS = '/admin/site-builder/domains'
const SITES = '/admin/site-builder/sites'
const PAGES = '/admin/ecommerce/pages'
const SITE_SETTINGS = '/admin/settings/site-settings'
const diag = []

describe('Role matrix - Site Builder', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-site-builder.json', diag))
  })

  const crud = (label, route, viewPerm, otherPerms) => {
    it(`baseline -> ${label} denied`, () => {
      cy.grantRoleTest([])
      cy.assertAreaDenied(route)
    })
    it(`${viewPerm} -> ${label} page loads`, () => {
      cy.grantRoleTest([viewPerm])
      cy.assertAreaGranted(route)
      cy.dumpPage(diag, viewPerm, route)
    })
    otherPerms.forEach((perm) => {
      it(`${viewPerm} + ${perm} -> ${label} page loads`, () => {
        cy.grantRoleTest([viewPerm, perm])
        cy.assertAreaGranted(route)
      })
    })
  }

  crud('domains', DOMAINS, 'view domain', ['create domain', 'update domain', 'delete domain'])
  crud('sites', SITES, 'view site', ['create site', 'update site', 'delete site'])

  // /admin/ecommerce/pages is gated by the Ecommerce area perm, not `view
  // page` (confirmed: `view page` alone -> /no-access?area=Ecommerce).
  it('baseline -> pages denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(PAGES)
  })
  it('manage ecommerce -> pages page loads', () => {
    cy.grantRoleTest(['manage ecommerce'])
    cy.assertAreaGranted(PAGES)
  })
  ;['view page', 'create page', 'update page', 'delete page'].forEach((perm) => {
    it(`manage ecommerce + ${perm} -> pages page loads`, () => {
      cy.grantRoleTest(['manage ecommerce', perm])
      cy.assertAreaGranted(PAGES)
    })
  })

  crud('site settings', SITE_SETTINGS, 'view site setting', [
    'create site setting', 'update site setting', 'delete site setting', 'manage site setting',
  ])

  // Shop (3) - no obvious standalone route; verify the perm is accepted and
  // the sites page still loads. Refine after the diag dump.
  ;['create shop', 'update shop', 'view shop'].forEach((perm) => {
    it(`${perm} + view site -> sites page loads`, () => {
      cy.grantRoleTest(['view site', perm])
      cy.assertAreaGranted(SITES)
    })
  })
})
