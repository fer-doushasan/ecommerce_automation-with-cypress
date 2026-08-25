// Payments page is a transactions table (Transaction ID, Purpose, Total,
// Coupon, Coupon Discount, Status, Time) backed by GET
// /api/v1/admin/payments?page=&per_page=&sort=&order=&search= - endpoint
// and query params confirmed by intercepting real network calls (not
// guessed) before writing the sort/search assertions below.
describe('Payments page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    // Waiting on the actual list request rather than a fixed sleep - a
    // fixed cy.wait() here occasionally raced the payments fetch (confirmed
    // while diagnosing an unrelated pagination-button lookup issue below).
    cy.intercept('GET', '**/api/v1/admin/payments**').as('paymentsList')
    cy.visit('/admin/subscription-info/payments')
    cy.contains('h1, h2', /^payments$/i).should('be.visible')
    cy.wait('@paymentsList', { timeout: 15000 })
    cy.wait(500)
  })

  // The table sits in an overflow-x-auto wrapper (min-width:700px) - at the
  // default viewport, columns past Total (Coupon, Coupon Discount, Status,
  // Time) are clipped until scrolled horizontally, so those check DOM
  // presence rather than viewport visibility (confirmed via the actual
  // "clipped by overflow" assertion error, not assumed).
  it('loads the payments page with Tutorial, search, and the transactions table', () => {
    cy.contains('button', /tutorial/i).should('be.visible')
    cy.get('input[placeholder*="Search by transaction ID"]').should('be.visible')
    cy.contains(/\d+ records found/i).should('be.visible')
    cy.contains('th', /transaction id/i).should('be.visible')
    cy.contains('th', /purpose/i).should('be.visible')
    cy.contains('th', /total/i).should('be.visible')
    cy.contains('th', /^coupon$/i).should('exist')
    cy.contains('th', /coupon discount/i).should('exist')
    cy.contains('th', /status/i).should('exist')
    cy.contains('th', /time/i).should('exist')
  })

  it('re-fetches sorted by total when the Total column header is clicked', () => {
    cy.intercept('GET', '**/api/v1/admin/payments**').as('paymentsList')
    cy.contains('th', /total/i).find('button').click({ force: true })
    cy.wait('@paymentsList', { timeout: 10000 }).its('request.url').should('include', 'sort=total')
  })

  it('filters the list when searching by transaction ID', () => {
    cy.intercept('GET', '**/api/v1/admin/payments**search=**').as('paymentsSearch')
    cy.get('input[placeholder*="Search by transaction ID"]').type('AU12ACRAYDLW')
    cy.wait('@paymentsSearch', { timeout: 10000 })
    cy.contains('td', /AU12ACRAYDLW/i).should('be.visible')
    cy.get('tbody tr').should('have.length', 1)
  })

  // Regression test for bug-reports/payments-coupon-search-not-working.md:
  // the search input's placeholder advertises "transaction ID, coupon or
  // status", but searching by a coupon code (e.g. "TEST", used repeatedly by
  // subscription.cy.js's extend-subscription tests) previously returned zero
  // results - GET .../payments?search=TEST came back with data.total: 0 even
  // though a completed TEST-coupon transaction existed, confirming it was a
  // backend query bug rather than a frontend rendering issue. Developer
  // reports this is now fixed - this asserts both the raw API response and
  // the rendered row.
  it('filters the list when searching by coupon code (regression: coupon search)', () => {
    cy.intercept('GET', '**/api/v1/admin/payments**search=TEST**').as('couponSearch')
    cy.get('input[placeholder*="Search by transaction ID"]').type('TEST')
    cy.wait('@couponSearch', { timeout: 10000 }).its('response.body.data.total').should('be.greaterThan', 0)
    cy.get('tbody tr').should('have.length.greaterThan', 0)
    cy.contains('td', /test/i).should('be.visible')
  })

  it('changes the page size via Rows per page', () => {
    cy.intercept('GET', '**/api/v1/admin/payments**per_page=25**').as('per25')
    cy.get('select').select('25')
    cy.wait('@per25', { timeout: 10000 })
    cy.contains(/showing 1–25 of \d+ results/i).should('be.visible')
  })

  // Previous/Next use getButtonContaining (substring match via a plain
  // cy.get('button') + jQuery filter) rather than cy.contains('button', ...)
  // - the latter consistently failed to locate this specific button even
  // though a raw button-text dump confirmed it exists with exactly the text
  // "Next" (not disabled, visible). Root cause unclear (many icon-only
  // empty-text buttons precede it in the DOM - 10 per-row copy buttons plus
  // the sidebar togglers), but getButtonContaining is the codebase's
  // existing, proven-reliable pattern for this class of lookup.
  it('navigates to the next page of results', () => {
    cy.getButtonContaining('previous').should('be.disabled')
    cy.intercept('GET', '**/api/v1/admin/payments**page=2**').as('page2')
    cy.getButtonContaining('next').click({ force: true })
    cy.wait('@page2', { timeout: 10000 })
    cy.contains(/showing 11–20 of \d+ results/i).should('be.visible')
    cy.getButtonContaining('previous').should('not.be.disabled')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  // Confirmed by searching the live list before writing this: "completed"
  // is the default status on every payment made through the tests in this
  // repo; "pending" already has ~10 real records (unrelated to anything
  // this suite created). "cancelled"/"failed"/"canceled" all returned "No
  // payments found" at the time of writing - see subscription.cy.js's
  // failed-payment test for how a real "failed" record gets created and
  // checked, since none pre-existed to search for here.
  it('shows completed and pending status badges for existing payments', () => {
    cy.contains('td', /completed/i).should('exist')

    cy.intercept('GET', '**/api/v1/admin/payments**search=pending**').as('pendingSearch')
    cy.get('input[placeholder*="Search by transaction ID"]').type('pending')
    cy.wait('@pendingSearch', { timeout: 10000 })
    cy.get('tbody tr').should('have.length.greaterThan', 0)
    cy.contains('td', /pending/i).should('exist')
  })
})
