// List endpoint is GET /api/v1/admin/ecommerce-banners (not "/banners" -
// confirmed by intercepting real network calls). No search box exists on
// this list (only Coupons/Payments have one - confirmed by scanning the
// dumped markup for any input[type="search"], found none). Table columns:
// checkbox, Image, Name, URL, Active, Action (View/Edit/Delete icon
// buttons). New Banner requires Name and Banner Image (URL is optional) -
// confirmed by dumping /admin/ecommerce/banners/create before writing this.
// The "Name"/"Banner Image" labels carry a nested `*` span for required
// fields. cy.contains('label', /regex/) - anchored or not - could never
// locate them (confirmed by two separate failed attempts, not assumed);
// getFieldByLabelStart below sidesteps whatever's going on with cy.contains
// and nested elements here (same family of issue as the Payments page's
// Previous/Next button lookup earlier in this project) by filtering
// label elements directly via their real textContent.
function getFieldByLabelStart(startText) {
  return cy.get('label').filter((i, el) => el.textContent.trim().toLowerCase().startsWith(startText.toLowerCase())).parent()
}

describe('Banners page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.intercept('GET', '**/api/v1/admin/ecommerce-banners**').as('bannersList')
    cy.visit('/admin/ecommerce/banners')
    cy.contains('h1, h2', /^banners$/i).should('be.visible')
    cy.wait('@bannersList', { timeout: 15000 })
    cy.wait(500)
  })

  it('loads the banners page with New Banner and the table', () => {
    cy.contains('button', /new banner/i).should('be.visible')
    cy.contains('th', /image/i).should('be.visible')
    cy.contains('th', /^name/i).should('be.visible')
    cy.contains('th', /^url$/i).should('be.visible')
    cy.contains('th', /active/i).should('be.visible')
    cy.contains('th', /action/i).should('be.visible')
    cy.contains(/\d+ records? found/i).should('be.visible')
  })

  it('navigates to the New Banner form', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')
    cy.contains('h1, h2', /new banner/i).should('be.visible')
    getFieldByLabelStart('name').should('be.visible')
    cy.contains('label', /banner url/i).should('be.visible')
    getFieldByLabelStart('banner image').should('be.visible')
    cy.contains(/active/i).should('be.visible')
    cy.getButtonContaining('cancel').should('be.visible')
    cy.contains('button', /create banner/i).should('be.visible')
  })

  it('blocks creating a banner with no name or image filled in', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')
    cy.contains('button', /create banner/i).click({ force: true })
    cy.wait(1000)
    cy.url().should('include', '/banners/create')
  })

  it('cancels out of the New Banner form back to the list', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')
    cy.getButtonContaining('cancel').click({ force: true })
    cy.url().should('include', '/admin/ecommerce/banners')
    cy.url().should('not.include', '/create')
  })

  it('creates a banner with a name, URL, and image, and it appears in the list', () => {
    const name = `QA Banner ${Date.now()}`
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')

    cy.typeReliably('input[placeholder*="Summer Sale"]', name)
    cy.contains('label', /banner url/i).parent().find('input[type="url"]').type('https://example.com/qa-banner', { delay: 40 })
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait(1000)

    cy.intercept('POST', '**/api/v1/admin/ecommerce-banners**').as('createBanner')
    cy.contains('button', /create banner/i).click({ force: true })
    cy.wait('@createBanner', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/banners')
    cy.url().should('not.include', '/create')

    cy.contains(name, { timeout: 10000 }).should('be.visible')
  })

  // Toggling straight back before ever navigating away leaves the account's
  // real banner state unchanged even though this hits the live toggle
  // endpoint each time - same restraint as the Ecommerce Settings toggle
  // test.
  it('toggles a banner Active/Inactive and switches it back', () => {
    cy.get('tbody tr').first().find('button[title="Deactivate"], button[title="Activate"]').as('toggle')
    cy.get('@toggle').invoke('attr', 'title').then((beforeTitle) => {
      cy.intercept('PUT', '**/api/v1/admin/ecommerce-banners/**').as('toggleBanner')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleBanner', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('not.eq', beforeTitle)

      cy.intercept('PUT', '**/api/v1/admin/ecommerce-banners/**').as('toggleBannerBack')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleBannerBack', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('eq', beforeTitle)
    })
  })

  it('deletes a banner after confirming, and it disappears from the list', () => {
    const name = `QA DeleteMe ${Date.now()}`
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')
    cy.typeReliably('input[placeholder*="Summer Sale"]', name)
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    // The Create Banner button is disabled until required fields (Name +
    // Image) are recognized as filled - a disabled button's click handler
    // never fires even with { force: true } (that only bypasses Cypress's
    // own actionability checks, not the browser's native disabled
    // handling), so this waits for the real enabled state instead of a
    // fixed sleep. Confirmed as the actual cause via a failing run where
    // this same click, using a fixed 1000ms wait, silently no-op'd.
    cy.contains('button', /create banner/i).should('not.be.disabled')
    cy.intercept('POST', '**/api/v1/admin/ecommerce-banners**').as('createBanner')
    cy.contains('button', /create banner/i).click({ force: true })
    cy.wait('@createBanner', { timeout: 15000 })
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/banners')
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/ecommerce-banners/**').as('deleteBanner')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBanner', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.wait(1000)

    cy.contains(name).should('not.exist')
  })
})
