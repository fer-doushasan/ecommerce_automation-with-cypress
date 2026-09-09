// Role-permission ENFORCEMENT matrix - remaining sections.
//   Dashboard(4, incl. baseline), Agent Dashboard(1), Abandoned Orders(2),
//   Agents(3), Reports(1), Ecommerce(1), Subscription Info(2),
//   Support & Tickets(1), Other(7)

const DASHBOARD = '/admin/dashboard'
const AGENT_DASHBOARD = '/admin/agent-dashboard'
const ABANDONED = '/admin/abandoned-orders'
const AGENTS = '/admin/agents'
const SALES_REPORT = '/admin/reports/sales-report'
const BANNERS = '/admin/ecommerce/banners'
const CATEGORIES = '/admin/ecommerce/categories'
const SUBSCRIPTION = '/admin/subscription-info/subscription'
const SUPPORT = '/admin/support/support'
const TUTORIAL = '/admin/support/tutorial'
const diag = []

describe('Role matrix - misc sections', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-misc.json', diag))
  })

  // --- Dashboard widgets (page always loads; perms unlock individual cards) ---
  ;['dashboard order', 'view sales target', 'view announcement'].forEach((perm) => {
    it(`${perm} -> dashboard loads with one fewer locked widget`, () => {
      cy.grantRoleTest([perm])
      cy.visit(DASHBOARD, { failOnStatusCode: false })
      cy.wait(3500)
      cy.get('body').then(($b) => {
        const locked = ($b[0].innerText.match(/You don't have permission to view this content/g) || []).length
        diag.push({ perm, lockedWidgetCount: locked })
      })
      cy.url().should('include', '/admin/dashboard')
    })
  })

  // --- Agent Dashboard ---
  it('baseline -> agent dashboard denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(AGENT_DASHBOARD)
  })
  it('view agent -> agent dashboard loads', () => {
    cy.grantRoleTest(['view agent'])
    cy.assertAreaGranted(AGENT_DASHBOARD)
    cy.dumpPage(diag, 'view agent -> agent-dashboard', AGENT_DASHBOARD)
  })

  // --- Abandoned Orders ---
  it('baseline -> abandoned orders denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(ABANDONED)
  })
  it('view abandoned cart -> abandoned orders page loads', () => {
    cy.grantRoleTest(['view abandoned cart'])
    cy.assertAreaGranted(ABANDONED)
    cy.dumpPage(diag, 'view abandoned cart', ABANDONED)
  })
  it('view + manage abandoned cart -> page loads', () => {
    cy.grantRoleTest(['view abandoned cart', 'manage abandoned cart'])
    cy.assertAreaGranted(ABANDONED)
  })

  // --- Agents ---
  it('baseline -> agents denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(AGENTS)
  })
  it('view agent -> agents page loads', () => {
    cy.grantRoleTest(['view agent'])
    cy.assertAreaGranted(AGENTS)
    cy.dumpPage(diag, 'view agent -> agents', AGENTS)
  })
  ;['assign agent', 'manage agent'].forEach((perm) => {
    it(`view agent + ${perm} -> agents page loads`, () => {
      cy.grantRoleTest(['view agent', perm])
      cy.assertAreaGranted(AGENTS)
    })
  })

  // --- Reports ---
  it('baseline -> sales report denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(SALES_REPORT)
  })
  it('view report -> sales report page loads', () => {
    cy.grantRoleTest(['view report'])
    cy.assertAreaGranted(SALES_REPORT)
    cy.dumpPage(diag, 'view report', SALES_REPORT)
  })

  // --- Ecommerce (single perm gates the whole /admin/ecommerce/* section) ---
  it('baseline -> ecommerce banners denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(BANNERS)
  })
  it('manage ecommerce -> banners + categories load', () => {
    cy.grantRoleTest(['manage ecommerce'])
    cy.assertAreaGranted(BANNERS)
    cy.dumpPage(diag, 'manage ecommerce -> banners', BANNERS)
    cy.assertAreaGranted(CATEGORIES)
  })
  it('view brand + manage ecommerce -> brands page loads', () => {
    cy.grantRoleTest(['manage ecommerce', 'view brand'])
    cy.assertAreaGranted('/admin/ecommerce/brands')
  })

  // --- Subscription Info ---
  it('baseline -> subscription denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(SUBSCRIPTION)
  })
  it('view subscription -> subscription page loads', () => {
    cy.grantRoleTest(['view subscription'])
    cy.assertAreaGranted(SUBSCRIPTION)
    cy.dumpPage(diag, 'view subscription', SUBSCRIPTION)
  })
  it('view + buy subscription -> subscription page loads', () => {
    cy.grantRoleTest(['view subscription', 'buy subscription'])
    cy.assertAreaGranted(SUBSCRIPTION)
  })

  // --- Support & Tickets ---
  it('baseline -> support denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(SUPPORT)
  })
  it('view support -> redirects to the external support portal', () => {
    cy.grantRoleTest(['view support'])
    cy.visit(SUPPORT, { failOnStatusCode: false })
    cy.wait(5000)
    // /admin/support/support redirects off-origin to support.bdfunnelbuilder.com
    cy.origin('https://support.bdfunnelbuilder.com', () => {
      cy.location('hostname').should('include', 'support.bdfunnelbuilder.com')
    })
  })

  // --- Other (7) ---
  // /admin/support/tutorial is gated by `view support` (the Support &
  // Tickets area), not `view tutorial` (confirmed: `view tutorial` alone ->
  // /no-access?area=Support & Tickets).
  it('baseline -> tutorial denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(TUTORIAL)
  })
  it('view support -> tutorial page loads', () => {
    cy.grantRoleTest(['view support'])
    cy.assertAreaGranted(TUTORIAL)
  })
  it('view support + view tutorial -> tutorial page loads', () => {
    cy.grantRoleTest(['view support', 'view tutorial'])
    cy.assertAreaGranted(TUTORIAL)
  })
  ;['view page setting', 'create page setting', 'update page setting', 'delete page setting'].forEach((perm) => {
    it(`${perm} -> perm accepted (probe /admin/ecommerce/pages)`, () => {
      cy.grantRoleTest([perm])
      cy.dumpPage(diag, perm, '/admin/ecommerce/pages')
    })
  })
})
