// Role-permission ENFORCEMENT matrix - Settings section (35 perms).
//   Pixel(4), Google(4), TikTok(4), Invoice(5), Microsoft(4),
//   Courier(4), Payment(4), Blocked IP(3), Blocked Number(3)

const R = {
  pixel: '/admin/settings/pixel-settings',
  google: '/admin/settings/google-settings',
  tiktok: '/admin/settings/tiktok-settings',
  invoice: '/admin/settings/invoice-settings',
  microsoft: '/admin/settings/microsoft-settings',
  courier: '/admin/settings/courier-integration',
  payment: '/admin/settings/payment-settings',
}
const diag = []

describe('Role matrix - Settings', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-settings.json', diag))
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

  crud('pixel settings', R.pixel, 'view facebook setting', [
    'create facebook setting', 'update facebook setting', 'delete facebook setting',
  ])
  crud('google settings', R.google, 'view google setting', [
    'create google setting', 'update google setting', 'delete google setting', 'manage google settings',
  ])
  crud('tiktok settings', R.tiktok, 'view tiktok setting', [
    'create tiktok setting', 'update tiktok setting', 'delete tiktok setting',
  ])
  crud('invoice settings', R.invoice, 'view invoice setting', [
    'create invoice setting', 'update invoice setting', 'delete invoice setting', 'manage invoice settings',
  ])
  crud('microsoft settings', R.microsoft, 'view microsoft setting', [
    'create microsoft setting', 'update microsoft setting', 'delete microsoft setting', 'manage microsoft settings',
  ])
  crud('courier integration', R.courier, 'view courier', ['create courier', 'update courier', 'delete courier'])
  crud('payment settings', R.payment, 'view payment setting', [
    'create payment setting', 'update payment setting', 'delete payment setting',
  ])

  // Blocked IP / Blocked Number (6) - route unknown; probe against payment
  // settings page load + record. Refine after diag.
  ;['view blocked ip', 'update blocked ip', 'block/unblock ip'].forEach((perm) => {
    it(`${perm} -> perm accepted (probe /admin/settings)`, () => {
      cy.grantRoleTest([perm])
      cy.dumpPage(diag, perm, '/admin/settings/payment-settings')
    })
  })
  ;['view blocked number', 'update blocked number', 'block/unblock number'].forEach((perm) => {
    it(`${perm} -> perm accepted (probe)`, () => {
      cy.grantRoleTest([perm])
      cy.dumpPage(diag, perm, '/admin/settings/payment-settings')
    })
  })
})
