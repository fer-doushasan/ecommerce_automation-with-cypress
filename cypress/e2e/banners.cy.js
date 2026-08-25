// List endpoint is GET /api/v1/admin/ecommerce-banners (not "/banners" -
// confirmed by intercepting real network calls). No search box exists on
// this list (only Coupons/Payments have one - confirmed by scanning the
// dumped markup for any input[type="search"], found none). Table columns:
// checkbox, Image, Name, URL, Active, Action (View/Edit/Delete icon
// buttons).
//
// New Banner actually requires Name, Banner URL, AND Banner Image - even
// though only the "Name"/"Banner Image" labels carry the red required `*`
// span (Banner URL's label has none). Confirmed via a captured DOM diff of
// the create form right before/after clicking Create Banner with no URL
// filled in: a "Banner URL is required." error banner appeared with zero
// accompanying network activity, which is what was producing a confusing
// `cy.wait('@createBanner')` "No request ever occurred" timeout in tests
// that only filled Name + Image. This is a real gap in the app's own
// required-field UI, not a test bug - every create flow below fills Banner
// URL regardless of what the asterisks imply.
//
// cy.contains('label', /regex/) - anchored or not - could never locate the
// Name/Banner Image labels (confirmed by two separate failed attempts, not
// assumed); getFieldByLabelStart below sidesteps whatever's going on with
// cy.contains and nested elements here (same family of issue as the
// Payments page's Previous/Next button lookup earlier in this project) by
// filtering label elements directly via their real textContent.
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
    // Selecting the file kicks off an async upload (POST /api/v1/upload) that
    // must resolve before Create Banner will actually submit - confirmed via
    // a captured network log where the click fired a client-side validation
    // icon instead of the create request when this wasn't waited on. Waiting
    // on the real upload response instead of a fixed sleep removes that race.
    cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait('@uploadImage', { timeout: 15000 })
    cy.contains('button', /create banner/i).should('not.be.disabled')

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
  //
  // The beforeEach's fixed cy.wait(500) after @bannersList occasionally
  // raced the table's actual re-render (the XHR can resolve before Vue
  // commits the rows), which showed up as a real "No banners found" state
  // when this test grabbed tbody tr .first() - confirmed via a captured
  // screenshot, not assumed. Asserting on the rows themselves (retry-able)
  // instead of trusting the fixed sleep removes that race.
  it('toggles a banner Active/Inactive and switches it back', () => {
    cy.get('tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0)
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
    // Banner URL is required despite carrying no `*` in the UI - see the
    // top-of-file note.
    cy.contains('label', /banner url/i).parent().find('input[type="url"]').type('https://example.com/qa-deleteme', { delay: 40 })
    // Selecting the file kicks off an async upload (POST /api/v1/upload) that
    // must resolve before Create Banner will actually submit - see the
    // "creates a banner" test above for how this was confirmed.
    cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait('@uploadImage', { timeout: 15000 })
    // The Create Banner button is also disabled until required fields (Name +
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

  // View is a dedicated read-only page (/admin/ecommerce/banners/{id}), not
  // a modal - confirmed by dumping the DOM after clicking it before writing
  // this. Its disabled inputs, Status card, and "Edit Banner" button are all
  // real, not guessed.
  it('opens the View page for a banner and shows its details read-only', () => {
    cy.get('tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0)
    cy.get('tbody tr').first().find('td').eq(2).invoke('text').then((name) => {
      cy.get('tbody tr').first().find('button[title="View"]').click({ force: true })
      cy.url({ timeout: 10000 }).should('match', /\/admin\/ecommerce\/banners\/\d+$/)
      cy.contains('h1', name).should('be.visible')
      cy.get('input[disabled]').should('have.length.greaterThan', 0)
      cy.contains('button', /edit banner/i).should('be.visible')
    })
  })

  // Edit reuses the create form at /banners/create?mode=edit&id={id} -
  // confirmed by dumping the DOM after clicking it. Uses a QA-created banner
  // (not an existing real one) so the rename + cleanup here can't touch
  // production banner data. The update network call's exact HTTP method
  // wasn't confirmed ahead of time, so this intercepts the URL pattern
  // without pinning a method rather than guessing PUT/PATCH/POST.
  it('edits a banner via the Edit action and the updated name appears in the list', () => {
    const originalName = `QA Edit ${Date.now()}`
    const updatedName = `${originalName} Updated`

    cy.clickUntilUrlIncludes(() => cy.contains('button', /new banner/i), '/banners/create')
    cy.typeReliably('input[placeholder*="Summer Sale"]', originalName)
    // Banner URL is required despite carrying no `*` in the UI - see the
    // top-of-file note.
    cy.contains('label', /banner url/i).parent().find('input[type="url"]').type('https://example.com/qa-edit', { delay: 40 })
    // See the "creates a banner" test for why the upload response is waited
    // on explicitly instead of a fixed sleep.
    cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait('@uploadImage', { timeout: 15000 })
    cy.contains('button', /create banner/i).should('not.be.disabled')
    cy.intercept('POST', '**/api/v1/admin/ecommerce-banners**').as('createBanner')
    cy.contains('button', /create banner/i).click({ force: true })
    cy.wait('@createBanner', { timeout: 15000 })
    cy.contains(originalName, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', originalName).within(() => {
      cy.get('button[title="Edit"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('include', '/banners/create?mode=edit')
    cy.contains('h1, h2', /edit banner/i).should('be.visible')
    cy.get('input[placeholder="e.g. Summer Sale Banner"]').should('have.value', originalName).clear().type(updatedName, { delay: 40 })

    cy.intercept(/\/api\/v1\/admin\/ecommerce-banners\/\d+/).as('updateBanner')
    cy.contains('button', /save changes/i).click({ force: true })
    cy.wait('@updateBanner', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/banners')
    cy.url().should('not.include', '/create')
    cy.contains(updatedName, { timeout: 10000 }).should('be.visible')

    // Cleanup - delete the QA banner this test created.
    cy.contains('table tbody tr', updatedName).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/ecommerce-banners/**').as('deleteBanner')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBanner', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.contains(updatedName).should('not.exist')
  })

  // The toolbar row (the same one showing "N records found") swaps in a
  // "Delete (N)" button once any row checkbox is checked - confirmed by
  // actually checking a throwaway banner's checkbox and capturing the DOM
  // before writing this. A first attempt used click({force:true}) on the
  // checkbox and found no bulk UI at all; every checkbox in that capture had
  // silently failed to register as checked, which looked identical to "no
  // bulk feature exists" until cy.check() + a "be.checked" assertion proved
  // otherwise. Confirming it opens the same confirm-dialog pattern as single
  // delete, then posts one POST /api/v1/admin/ecommerce-banners/bulk-delete
  // with { ids: [...] } - confirmed via a captured network log, not guessed.
  it('bulk-deletes multiple selected banners via the header Delete (N) button', () => {
    const makeBanner = (name) => {
      cy.contains('button', /new banner/i).click({ force: true })
      cy.wait(500)
      cy.typeReliably('input[placeholder*="Summer Sale"]', name)
      cy.contains('label', /banner url/i).parent().find('input[type="url"]').type('https://example.com/qa-bulk', { delay: 40 })
      cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
      cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
      cy.wait('@uploadImage', { timeout: 15000 })
      cy.contains('button', /create banner/i).should('not.be.disabled')
      cy.intercept('POST', '**/api/v1/admin/ecommerce-banners**').as('createBanner')
      cy.contains('button', /create banner/i).click({ force: true })
      cy.wait('@createBanner', { timeout: 15000 })
      cy.contains(name, { timeout: 10000 }).should('be.visible')
    }

    const name1 = `QA Bulk1 ${Date.now()}`
    const name2 = `QA Bulk2 ${Date.now()}`
    makeBanner(name1)
    makeBanner(name2)

    cy.contains('table tbody tr', name1).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('table tbody tr', name2).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('button', /delete \(2\)/i).should('be.visible')

    cy.contains('button', /delete \(2\)/i).click({ force: true })
    cy.contains(/are you sure you want to delete/i).should('be.visible')
    cy.contains(/2 banners/i).should('be.visible')

    cy.intercept('POST', '**/api/v1/admin/ecommerce-banners/bulk-delete').as('bulkDelete')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@bulkDelete', { timeout: 10000 }).then((interception) => {
      expect(interception.request.body.ids).to.have.length(2)
      expect(interception.response.statusCode).to.eq(200)
    })

    cy.contains(name1).should('not.exist')
    cy.contains(name2).should('not.exist')
  })
})
