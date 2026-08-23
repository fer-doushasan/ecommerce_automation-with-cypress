// Subscription page is a mostly read-only status view (no native form
// controls) - an Active badge, three date/day stat tiles, an "Extend
// Subscription" link, and a static grid of plan features. Confirmed by
// dumping the live page before writing this.
describe('Subscription page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/subscription-info/subscription')
    cy.contains('h1, h2', /^subscription$/i).should('be.visible')
    cy.wait(2000)
  })

  it('loads the subscription page with the active status card', () => {
    cy.contains(/active/i).should('be.visible')
    cy.contains(/your subscription is active/i).should('be.visible')
    cy.contains(/days remaining/i).should('be.visible')
    cy.contains(/started/i).should('be.visible')
    cy.contains(/expires/i).should('be.visible')
  })

  it('shows the Extend Subscription and Tutorial actions', () => {
    cy.contains('a', /extend subscription/i).should('be.visible').and('have.attr', 'href').and('include', '/subscription-info/subscription/payment')
    cy.contains('button', /tutorial/i).should('be.visible')
  })

  it('lists the plan feature access grid', () => {
    cy.contains(/what you have access to/i).should('be.visible')
    cy.contains(/unlimited free page view/i).should('be.visible')
    cy.contains(/unlimited order/i).should('be.visible')
    cy.contains(/drag & drop site builder/i).should('be.visible')
    cy.contains(/custom domain/i).should('be.visible')
    cy.contains(/facebook pixel & conversion api/i).should('be.visible')
    cy.contains(/google tag manager and analytics/i).should('be.visible')
    cy.contains(/microsoft clarity/i).should('be.visible')
    cy.contains(/courier automation/i).should('be.visible')
  })

  it('navigates to the payment page when Extend Subscription is clicked', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('a', /extend subscription/i), '/subscription-info/subscription/payment')
  })

  // TEST is a live ৳4,000-off coupon on this account. Applying it swaps the
  // input+Apply button for a green "applied" chip with a Remove button, adds
  // a Discount line to the order summary, and relabels Total as "Amount
  // Payable" - confirmed by dumping the checkout page after applying it,
  // rather than guessing the resulting markup/copy.
  it('applies the TEST coupon and updates the order summary discount', () => {
    cy.contains('a', /extend subscription/i).click({ force: true })
    cy.url({ timeout: 10000 }).should('include', '/subscription-info/subscription/payment')

    cy.get('input[placeholder="Enter coupon code"]').type('TEST')
    cy.contains('button', /apply/i).click({ force: true })

    cy.contains(/test applied/i, { timeout: 10000 }).should('be.visible')
    cy.contains(/4,000 off/i).should('be.visible')
    cy.contains('button', /remove/i).should('be.visible')
    cy.contains(/discount \(test\)/i).should('be.visible')
    cy.contains(/-৳4,000/).should('be.visible')
    cy.contains(/amount payable/i).should('be.visible')
    cy.contains('button', /pay now.*6,000/i).should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  it('navigates to the Payments tab from the sidebar', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('a', /^payments$/i), '/subscription-info/payments')
  })

  // Extend Subscription leads to a real checkout (৳10,000 / 3 months, or
  // ৳6,000 with TEST applied) with a live Pay Now redirect to
  // sandbox.sslcommerz.com - same cross-origin sandbox flow as the Increase
  // Limit test in invitations.cy.js/users.cy.js (Mobile Banking -> bKash ->
  // Success). This is a genuine account state change (Expires pushed out
  // ~3 months, plus a real completed transaction record), not just a UI
  // check. Duration is "3 months" rather than a fixed 90, so the day-diff
  // assertion below uses a tolerance window instead of an exact +90.
  //
  // The coupon is applied here (rather than in a separate run) so this one
  // transaction proves both things at once: the extension itself, and that
  // the TEST coupon actually carries through to the completed payment
  // record on the Payments page - not just the checkout preview (see the
  // separate 'applies the TEST coupon' test above, which only verifies the
  // live preview and never submits payment).
  it('extends the subscription with the TEST coupon via SSLCommerz sandbox and records the discount', () => {
    cy.contains('p', /^expires$/i).prev().invoke('text').then((beforeExpiresText) => {
      const beforeExpires = new Date(beforeExpiresText.trim())

      cy.contains('a', /extend subscription/i).click({ force: true })
      cy.url({ timeout: 10000 }).should('include', '/subscription-info/subscription/payment')
      cy.contains(/complete your subscription/i).should('be.visible')
      cy.contains(/3 months/i).should('be.visible')

      cy.get('input[placeholder="Enter coupon code"]').type('TEST')
      cy.contains('button', /apply/i).click({ force: true })
      cy.contains(/test applied/i, { timeout: 10000 }).should('be.visible')
      cy.contains('button', /pay now.*6,000/i).should('be.visible')

      cy.contains('button', /pay now/i).click({ force: true })

      cy.origin('https://sandbox.sslcommerz.com', () => {
        // cy.on() from the outer test doesn't carry into cy.origin() - see
        // invitations.cy.js for why this sandbox page needs its own handler.
        cy.on('uncaught:exception', () => false)

        cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
        cy.wait(1000)
        cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
        cy.wait(2000)
        cy.get('input[value="Success"]', { timeout: 10000 }).should('be.visible').click()
      })

      // Back on the app's own origin - re-register the exception handler
      // and re-establish the session, same as the Invitations flow (the
      // login session doesn't survive the SSLCommerz cross-origin round-trip).
      cy.on('uncaught:exception', () => false)
      cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')
      cy.wait(2000)

      cy.loginViaSession()
      cy.visit('/admin/subscription-info/subscription')
      cy.contains('h1, h2', /^subscription$/i, { timeout: 20000 }).should('be.visible')
      cy.wait(1500)

      cy.contains('p', /^expires$/i).prev().invoke('text').should((afterExpiresText) => {
        const afterExpires = new Date(afterExpiresText.trim())
        const daysDiff = Math.round((afterExpires - beforeExpires) / (1000 * 60 * 60 * 24))
        expect(daysDiff, 'days added to expiry').to.be.within(85, 95)
      })

      // Confirm the coupon actually landed on the completed transaction
      // record, not just the checkout preview. Searching for "TEST" timed
      // out with no request ever firing (likely a minimum query-length
      // before the app hits the search API - the payments.cy.js search test
      // that works uses a 12-character transaction ID, not a 4-character
      // string), so this checks the newest row directly instead: both DOM
      // dumps taken earlier showed the default (unsorted) list ordered
      // newest-first with no sort param, so the just-completed transaction
      // should be first.
      cy.intercept('GET', '**/api/v1/admin/payments**').as('paymentsList')
      cy.visit('/admin/subscription-info/payments')
      cy.contains('h1, h2', /^payments$/i, { timeout: 20000 }).should('be.visible')
      cy.wait('@paymentsList', { timeout: 15000 })

      cy.get('tbody tr').first().within(() => {
        // Total is within the default viewport; Status sits past the
        // overflow-x-auto table's visible width without scrolling (same
        // clipping confirmed while writing payments.cy.js), so this checks
        // DOM presence there rather than viewport visibility.
        cy.contains('৳6,000').should('be.visible')
        cy.contains(/completed/i).should('exist')
      })
    })
  })

  // The SSLCommerz sandbox OTP page offers three real outcomes - Success,
  // Success with risk, and Failed (all <input type="submit"> elements, same
  // as the Success button documented in invitations.cy.js) - no separate
  // "Cancel" exists. Confirmed via a screenshot of the live OTP page before
  // writing this (cy.writeFile doesn't reliably work from inside a
  // cy.origin() callback - it silently produced no file - so a screenshot
  // was used to verify instead). A failed payment should grant nothing.
  it('records a failed status and leaves the subscription unchanged when SSLCommerz payment fails', () => {
    cy.contains('p', /^expires$/i).prev().invoke('text').then((beforeExpiresText) => {
      const beforeExpires = beforeExpiresText.trim()

      cy.contains('a', /extend subscription/i).click({ force: true })
      cy.url({ timeout: 10000 }).should('include', '/subscription-info/subscription/payment')
      cy.contains('button', /pay now/i).click({ force: true })

      cy.origin('https://sandbox.sslcommerz.com', () => {
        cy.on('uncaught:exception', () => false)
        cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
        cy.wait(1000)
        cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
        cy.wait(2000)
        cy.get('input[value="Failed"]:visible', { timeout: 10000 }).first().click({ force: true })
      })

      cy.on('uncaught:exception', () => false)
      cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')
      cy.wait(2000)

      cy.loginViaSession()
      cy.visit('/admin/subscription-info/subscription')
      cy.contains('h1, h2', /^subscription$/i, { timeout: 20000 }).should('be.visible')
      cy.wait(1500)

      cy.contains('p', /^expires$/i).prev().invoke('text').should((afterExpiresText) => {
        expect(afterExpiresText.trim(), 'expires date should be unchanged after a failed payment').to.eq(beforeExpires)
      })

      cy.intercept('GET', '**/api/v1/admin/payments**').as('paymentsList')
      cy.visit('/admin/subscription-info/payments')
      cy.contains('h1, h2', /^payments$/i, { timeout: 20000 }).should('be.visible')
      cy.wait('@paymentsList', { timeout: 15000 })

      // Status is past the overflow-x-auto table's visible width without
      // scrolling (same clipping confirmed in payments.cy.js), so this
      // checks DOM presence rather than viewport visibility.
      cy.get('tbody tr').first().within(() => {
        cy.contains(/failed|cancelled|canceled/i).should('exist')
      })
    })
  })
})
