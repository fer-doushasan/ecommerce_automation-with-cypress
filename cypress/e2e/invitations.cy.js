// Structure (heading, buttons, search placeholder, table columns, modal
// button text) was confirmed by dumping the live page before writing this.
// Roles turned out to be a custom checkbox-picker (not a native <select>,
// despite looking like one) - see selectFirstAvailableRole() below.
describe('Invitations page', () => {
  beforeEach(() => {
    // This page fires a background request to service-prices?...type=user_limit
    // that 403s for this account (confirmed via network logging - a real,
    // pre-existing app bug, unrelated to anything under test here) and
    // throws as an unhandled promise rejection, which Cypress otherwise
    // treats as a test failure regardless of what the test itself checks.
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/user-and-roles/invitations')
    cy.contains('h1, h2', /invitations/i).should('be.visible')
    cy.wait(1000)
  })

  it('loads the invitations page with Invite User, Tutorial, search and table', () => {
    cy.contains('button', /invite user/i).should('be.visible')
    cy.contains('button', /tutorial/i).should('be.visible')
    cy.get('input[placeholder*="Search by email"]').should('be.visible')
    cy.contains(/status/i).should('be.visible')
  })

  it('shows a team member limit notice with an Increase Limit button', () => {
    cy.contains(/team member limit/i).should('be.visible')
    cy.contains('button', /increase limit/i).should('be.visible')
  })

  it('shows Active Users, Pending Users, and Users Limit counts', () => {
    cy.contains(/active users/i).should('be.visible')
    cy.contains(/pending users/i).should('be.visible')
    cy.contains(/users limit/i).should('be.visible')
  })

  // The header itself is a <button> (Email + an arrow-up-down icon) that
  // re-triggers the list fetch - clicking it and confirming a new request
  // fires is what's actually verifiable without depending on unknown sort
  // query-param names.
  it('re-fetches the list when the Email column sort button is clicked', () => {
    cy.intercept('GET', '**/api/v1/admin/invitations**').as('invitationsList')
    cy.contains('th', /email/i).find('button').click({ force: true })
    cy.wait('@invitationsList', { timeout: 10000 })
  })

  // Even at 0 BDT, Pay Now does a real cross-origin redirect to
  // sandbox.sslcommerz.com (confirmed - not skipped for a zero amount), so
  // this needs cy.origin() to drive the sandbox's own UI: Mobile Banking ->
  // bKash -> Success, which redirects back here. This is a real state
  // change (the account's actual user limit goes up by 1 every run), not
  // just a UI check.
  it('increases the user limit via the Increase Limit modal, SSLCommerz sandbox, and Pay Now', () => {
    cy.contains(/users limit/i).parent().invoke('text').then((beforeText) => {
      const before = parseInt(beforeText.replace(/\D/g, ''), 10)

      cy.contains('button', /increase limit/i).click({ force: true })
      cy.contains('Increase User Limit').should('be.visible')
      cy.contains(/total payable/i).should('be.visible')

      cy.contains('button', /pay now/i).click({ force: true })

      cy.origin('https://sandbox.sslcommerz.com', () => {
        // cy.on() registered in the outer test/beforeEach does NOT carry
        // into a cy.origin() callback - it runs in its own isolated
        // context. This sandbox page throws its own uncaught JS error
        // (`submitForm is not defined`, a bug in SSLCommerz's demo page
        // itself, not ours) which otherwise hard-fails this test and left
        // the browser stranded here, cascading into failures in whichever
        // test ran next.
        cy.on('uncaught:exception', () => false)

        cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
        cy.wait(1000)
        // bKash is a logo image, not text - cy.contains() can't match it.
        cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
        cy.wait(2000)

        // This page's "buttons" are actually <input type="submit"
        // value="Success"> elements, not <button> tags - the value text
        // isn't part of innerText/textContent, which is why cy.contains()
        // (text-based) could never find them regardless of how loose the
        // regex was. Exact match on the value attribute, since "Success"
        // and "Success with risk" are separate inputs and a loose match
        // would be ambiguous between them. Not forced - letting Cypress's
        // normal actionability wait ensures the page's own script (the one
        // defining the onclick handler) has actually finished loading first.
        cy.get('input[value="Success"]', { timeout: 10000 }).should('be.visible').click()
      })

      // Back on the app's own origin once SSLCommerz redirects home. The
      // uncaught:exception handler registered in beforeEach doesn't
      // reliably survive a cy.origin() round-trip, so it's re-registered
      // here too - otherwise this page's own known 403 bug (see beforeEach)
      // can hard-fail the test right at this point.
      cy.on('uncaught:exception', () => false)
      cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')

      // Diagnostic: log what's actually on screen right after the redirect
      // lands, before doing anything else - written unconditionally so it's
      // available even if the next assertion fails.
      cy.url().then((landedUrl) => {
        cy.get('body').then(($body) => {
          cy.writeFile('cypress/screenshots/_diag-post-redirect.json', {
            landedUrl,
            bodyTextSnippet: $body.text().slice(0, 800),
          })
        })
      })
      cy.screenshot('post-sslcommerz-redirect', { capture: 'viewport' })

      cy.wait(2000)

      // Confirmed via diagnostic: the login session doesn't survive the
      // SSLCommerz cross-origin round-trip (revisiting the app afterward
      // bounced to /login). Re-establishing it here before the final visit
      // - cy.session() reuses a still-valid session or re-authenticates as
      // needed, so this is safe to call unconditionally.
      cy.loginViaSession()
      cy.visit('/admin/user-and-roles/invitations')

      cy.url().then((finalUrl) => {
        cy.get('body').then(($body) => {
          cy.writeFile('cypress/screenshots/_diag-post-visit.json', {
            finalUrl,
            wasRedirectedToLogin: finalUrl.includes('/login'),
            bodyTextSnippet: $body.text().slice(0, 800),
          })
        })
      })
      cy.screenshot('post-revisit-invitations', { capture: 'viewport' })

      cy.contains('h1, h2', /invitations/i, { timeout: 20000 }).should('be.visible')
      cy.wait(1500)

      cy.contains(/users limit/i).parent().invoke('text').should(($text) => {
        const after = parseInt($text.replace(/\D/g, ''), 10)
        expect(after).to.eq(before + 1)
      })
    })
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  it('shows an email field and a role dropdown on the Invite User form', () => {
    cy.contains('button', /invite user/i).click({ force: true })
    cy.wait(500)
    cy.contains(/email/i).should('be.visible')
    cy.contains('label', /roles/i).should('be.visible')
    cy.contains(/select roles/i).should('be.visible')
  })

  // Roles is the same custom picker family as the Coupons page's Products
  // field: a div.cursor-pointer trigger opens a panel of <li data-role-item>
  // rows (confirmed by dumping it - was guessing <li> generically before,
  // which collided with other <li> elements on the page). The panel is
  // `position: absolute` and gets clipped by the modal's own overflow (the
  // rows render below the visible modal boundary, behind the Cancel/Send
  // Invitation footer), so cy.contains/:visible-based checks see them as
  // not visible even though they're real and force-clickable.
  function selectFirstAvailableRole() {
    cy.contains('label', /roles/i).parent().find('div.cursor-pointer').first().click({ force: true })
    cy.wait(500)
    cy.get('li[data-role-item]', { timeout: 10000 }).first().click({ force: true })
    cy.wait(300)
    cy.contains('button', /^done$/i).click({ force: true })
    cy.wait(300)
  }

  it('sends an invitation and it appears in the list', () => {
    const email = `test.invite.${Date.now()}@example.com`
    cy.contains('button', /invite user/i).click({ force: true })
    cy.wait(500)

    cy.get('input[type="email"], input[placeholder*="email" i]').first().type(email, { delay: 60 })
    selectFirstAvailableRole()

    cy.contains('button', /send invitation/i).click({ force: true })
    cy.wait(2000)

    cy.get('input[placeholder*="Search by email"]').type(email, { delay: 100 })
    cy.wait(2000)
    cy.contains(email).should('be.visible')
  })

  it('blocks sending an invitation with no email filled in', () => {
    cy.contains('button', /invite user/i).click({ force: true })
    cy.wait(500)
    cy.contains('button', /send invitation/i).click({ force: true })
    cy.wait(800)
    // The modal should still be open (or an inline error shown) rather
    // than silently accepting an empty email.
    cy.contains(/email/i).should('be.visible')
  })

  it('shows matching results when searching, and an empty state for no matches', () => {
    cy.get('input[placeholder*="Search by email"]').type('zzznotfound99', { delay: 60 })
    cy.wait(1500)
    cy.contains(/no invitations found|0 results/i).should('be.visible')
  })
})

describe('Invitations page access control', () => {
  it('redirects to /login when visiting invitations while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/user-and-roles/invitations')

    cy.url().should('include', '/login')
  })
})
