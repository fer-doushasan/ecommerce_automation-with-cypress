// Role-permission ENFORCEMENT matrix - Addons section (16 perms).
//   SMS(9), Fake Order(3), Call(2), WooCommerce(2)

const SMS = '/admin/addons/sms'
const FAKE_ORDER = '/admin/addons/fake-order'
const CALL_AUTOMATION = '/admin/addons/call-automation'
const CALL_CENTER = '/admin/addons/call-center'
const WOOCOMMERCE = '/admin/addons/woocommerce'
const diag = []

describe('Role matrix - Addons', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-addons.json', diag))
  })

  // --- SMS (gate: view sms) ---
  it('baseline -> sms denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(SMS)
  })
  it('view sms -> sms page loads', () => {
    cy.grantRoleTest(['view sms'])
    cy.assertAreaGranted(SMS)
    cy.dumpPage(diag, 'view sms', SMS)
  })
  ;[
    'create sms', 'view sms balance', 'update sms configuration', 'view sms configuration',
    'update sms setting', 'view sms setting', 'update custom sms text', 'view custom sms text',
  ].forEach((perm) => {
    it(`view sms + ${perm} -> sms page loads`, () => {
      cy.grantRoleTest(['view sms', perm])
      cy.assertAreaGranted(SMS)
    })
  })

  // --- Fake Order (gate: view fake order setting) ---
  it('baseline -> fake order denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(FAKE_ORDER)
  })
  it('view fake order setting -> page loads', () => {
    cy.grantRoleTest(['view fake order setting'])
    cy.assertAreaGranted(FAKE_ORDER)
    cy.dumpPage(diag, 'view fake order setting', FAKE_ORDER)
  })
  ;['create fake order setting', 'update fake order setting'].forEach((perm) => {
    it(`view fake order setting + ${perm} -> page loads`, () => {
      cy.grantRoleTest(['view fake order setting', perm])
      cy.assertAreaGranted(FAKE_ORDER)
    })
  })

  // --- Call (labels are Title Case: "Call Automation", "Call Center") ---
  it('baseline -> call automation denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(CALL_AUTOMATION)
  })
  it('Call Automation -> call automation page loads', () => {
    cy.grantRoleTest(['Call Automation'])
    cy.assertAreaGranted(CALL_AUTOMATION)
    cy.dumpPage(diag, 'Call Automation', CALL_AUTOMATION)
  })
  it('baseline -> call center denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(CALL_CENTER)
  })
  it('Call Center -> call center page loads', () => {
    cy.grantRoleTest(['Call Center'])
    cy.assertAreaGranted(CALL_CENTER)
    cy.dumpPage(diag, 'Call Center', CALL_CENTER)
  })

  // --- WooCommerce (gate: view woocommerce setting) ---
  it('baseline -> woocommerce denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(WOOCOMMERCE)
  })
  it('view woocommerce setting -> page loads', () => {
    cy.grantRoleTest(['view woocommerce setting'])
    cy.assertAreaGranted(WOOCOMMERCE)
    cy.dumpPage(diag, 'view woocommerce setting', WOOCOMMERCE)
  })
  it('view + update woocommerce setting -> page loads', () => {
    cy.grantRoleTest(['view woocommerce setting', 'update woocommerce setting'])
    cy.assertAreaGranted(WOOCOMMERCE)
  })
})
