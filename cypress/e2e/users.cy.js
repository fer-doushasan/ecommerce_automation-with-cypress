// Structure (heading, search placeholder, table columns) confirmed by
// dumping the live page before writing this. There's no "Add User" button
// on this page - users are added only via an accepted invitation (see
// invitations.cy.js), so this file covers browsing/searching only.
describe('Users page', () => {
  beforeEach(() => {
    // Same background 403 (service-prices?...type=user_limit) as the
    // Invitations page - see invitations.cy.js for details.
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/user-and-roles/users')
    cy.contains('h1, h2', /users/i).should('be.visible')
    // Real rows take longer than the standard 1s to replace the skeleton
    // placeholders here - confirmed by dumping the page (6 skeleton rows
    // were still showing at 2s).
    cy.wait(5000)
  })

  it('loads the users page with search and table', () => {
    cy.get('input[placeholder*="Search by name or email"]').should('be.visible')
    // Unscoped cy.contains(/roles/i) matches the sidebar's "Roles" nav link
    // (Users and Roles > Roles) before it ever reaches the table - scoping
    // to a <th> avoids that collision.
    cy.contains('th', /roles/i).should('be.visible')
  })

  it('shows an empty state or zero results for a nonsense search', () => {
    cy.get('input[placeholder*="Search by name or email"]').type('zzznotfound99', { delay: 60 })
    cy.wait(1500)
    cy.contains(/no users found|0 results/i).should('be.visible')
  })

  // The account's own Super Admin (admin@bdfunnelbuilder.com) is a stable
  // fixture - unlike other rows, it can't be deleted from this page, so
  // it's always guaranteed to be there to search for.
  it('shows a matching result when searching for a known user', () => {
    cy.get('input[placeholder*="Search by name or email"]').type('admin@bdfunnelbuilder.com', { delay: 60 })
    cy.wait(1500)
    cy.contains('admin@bdfunnelbuilder.com').should('be.visible')
  })

  it('shows Active Users, Pending Users, and Users Limit counts', () => {
    cy.contains(/active users/i).should('be.visible')
    cy.contains(/pending users/i).should('be.visible')
    cy.contains(/users limit/i).should('be.visible')
  })

  // Same shared Increase Limit / SSLCommerz sandbox flow as the Invitations
  // page (confirmed identical: same banner text, same modal, same Pay Now
  // button) - see invitations.cy.js for how each selector here was
  // confirmed (the OTP page's Success is an <input value="Success">, not a
  // <button>; the session doesn't survive the cross-origin round-trip so
  // it's re-established with loginViaSession() before the final visit).
  it('increases the user limit via the Increase Limit modal, SSLCommerz sandbox, and Pay Now', () => {
    cy.contains(/users limit/i).parent().invoke('text').then((beforeText) => {
      const before = parseInt(beforeText.replace(/\D/g, ''), 10)

      cy.contains('button', /increase limit/i).click({ force: true })
      cy.contains('Increase User Limit').should('be.visible')
      cy.contains(/total payable/i).should('be.visible')

      cy.contains('button', /pay now/i).click({ force: true })

      cy.origin('https://sandbox.sslcommerz.com', () => {
        cy.on('uncaught:exception', () => false)

        cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
        cy.wait(1000)
        cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
        cy.wait(2000)
        cy.get('input[value="Success"]', { timeout: 10000 }).should('be.visible').click()
      })

      cy.on('uncaught:exception', () => false)
      cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')
      cy.wait(2000)

      cy.loginViaSession()
      cy.visit('/admin/user-and-roles/users')
      cy.contains('h1, h2', /users/i, { timeout: 20000 }).should('be.visible')
      cy.wait(1500)

      cy.contains(/users limit/i).parent().invoke('text').should(($text) => {
        const after = parseInt($text.replace(/\D/g, ''), 10)
        expect(after).to.eq(before + 1)
      })
    })
  })

  // Confirmation-only - never actually confirms the delete. The deletable
  // rows here (role "Order Manager") are real-looking accounts, not
  // disposable test fixtures the way "ZZZ Test Product" is for products -
  // there's no way to create a throwaway User this way, since a row only
  // appears here once an invitation is actually *accepted* (a real signup,
  // which Cypress can't drive). Super Admin rows have no delete action at
  // all (button[aria-label="Delete user"] doesn't exist on them), so this
  // targets the first row that has one.
  it('opens a delete confirmation dialog and cancels without deleting', () => {
    cy.get('button[aria-label="Delete user"]').first().click({ force: true })
    cy.wait(500)
    cy.contains(/are you sure|delete user/i).should('be.visible')
    cy.contains('button', /cancel/i).click({ force: true })
    cy.wait(500)
    cy.contains(/are you sure/i).should('not.exist')
  })
})

describe('Users page access control', () => {
  it('redirects to /login when visiting users while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/user-and-roles/users')

    cy.url().should('include', '/login')
  })
})
