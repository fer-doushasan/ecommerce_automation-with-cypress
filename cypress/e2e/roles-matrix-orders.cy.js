// Role-permission ENFORCEMENT matrix - Orders section (33 permissions).
//
// Section gate: `view order` unlocks /admin/orders (denied -> /no-access?area=Orders).
// Sub-groups: Orders(7), Order View by Status(11), Order Status Changes(11),
// Cancel Reason(4 - lives at /admin/settings/cancel-reason).
//
// after() restores "Role Test" to baseline.

const ORDERS = '/admin/orders'
const CANCEL_REASON = '/admin/settings/cancel-reason'
const diag = []

const STATUS_VIEWS = [
  'view pending order', 'view confirmed order', 'view followup order',
  'view ready to ship order', 'view shipped order', 'view hold by courier order',
  'view delivered order', 'view payment received order', 'view returned order',
  'view canceled order', 'view unresolved order',
]
const STATUS_CHANGES = [
  'change status to pending', 'change status to confirmed', 'change status to followup',
  'change status to ready to ship', 'change status to shipped', 'change status to hold by courier',
  'change status to delivered', 'change status to payment received', 'change status to returned',
  'change status to canceled', 'change status to unresolved',
]

describe('Role matrix - Orders', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-orders.json', diag))
  })

  it('baseline only -> orders denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(ORDERS)
  })

  it('view order -> orders page loads', () => {
    cy.grantRoleTest(['view order'])
    cy.assertAreaGranted(ORDERS)
    cy.dumpPage(diag, 'view order', ORDERS)
    cy.contains('button, a', /new order/i).should('not.exist')
  })

  it('view + create order -> "New Order" button', () => {
    cy.grantRoleTest(['view order', 'create order'])
    cy.assertAreaGranted(ORDERS)
    cy.contains('button, a', /new order/i).should('be.visible')
  })

  it('view + update order -> orders page loads (row edit)', () => {
    cy.grantRoleTest(['view order', 'update order'])
    cy.assertAreaGranted(ORDERS)
    cy.dumpPage(diag, 'view+update order', ORDERS)
  })

  it('view + delete order -> orders page loads (row delete)', () => {
    cy.grantRoleTest(['view order', 'delete order'])
    cy.assertAreaGranted(ORDERS)
  })

  it('view + order export -> export control present', () => {
    cy.grantRoleTest(['view order', 'order export'])
    cy.assertAreaGranted(ORDERS)
    cy.contains('button, a', /export/i).should('exist')
  })

  it('view + view all order -> orders page loads', () => {
    cy.grantRoleTest(['view order', 'view all order'])
    cy.assertAreaGranted(ORDERS)
  })

  it('view + view order activity log -> orders page loads', () => {
    cy.grantRoleTest(['view order', 'view order activity log'])
    cy.assertAreaGranted(ORDERS)
  })

  STATUS_VIEWS.forEach((perm) => {
    it(`view order + ${perm} -> orders page loads`, () => {
      cy.grantRoleTest(['view order', perm])
      cy.assertAreaGranted(ORDERS)
    })
  })

  STATUS_CHANGES.forEach((perm) => {
    it(`view + update order + ${perm} -> orders page loads`, () => {
      cy.grantRoleTest(['view order', 'update order', perm])
      cy.assertAreaGranted(ORDERS)
    })
  })

  // --- Cancel Reason sub-group (/admin/settings/cancel-reason) ---
  it('baseline only -> cancel reason denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(CANCEL_REASON)
  })

  it('view cancel reason -> cancel reason page loads', () => {
    cy.grantRoleTest(['view cancel reason'])
    cy.assertAreaGranted(CANCEL_REASON)
    cy.dumpPage(diag, 'view cancel reason', CANCEL_REASON)
  })

  ;['create cancel reason', 'update cancel reason', 'delete cancel reason'].forEach((perm) => {
    it(`view cancel reason + ${perm} -> page loads`, () => {
      cy.grantRoleTest(['view cancel reason', perm])
      cy.assertAreaGranted(CANCEL_REASON)
    })
  })
})
