// List endpoint is GET /api/v1/admin/webhooks?page=&per_page= - confirmed by
// intercepting real network calls. Table columns: Name, URL, Active, Action
// (Edit/Delete only - no View action and no bulk-select checkboxes here,
// unlike Banners). New Webhook requires Name, Secret, and Webhook URL - all
// three correctly carry the red required `*` in the UI here (unlike
// Banners' Banner URL, which is required but unmarked).
//
// The backend also runs a server-side reachability check on Webhook URL: it
// must respond with 200 OK or creation is rejected with a 422 ("...must
// return 200 OK to proceed."). Confirmed via a captured 422 response after
// two third-party test URLs failed for unrelated reasons (httpstat.us timed
// out from the backend's own network; postman-echo.com/get 404'd, likely
// because the check isn't a plain GET) - https://httpbin.org/anything
// accepts any HTTP method and reliably returns 200, so it's used as the
// webhook URL throughout this file.
//
// CONFIRMED APP BUG: toggling Active/Inactive on a webhook with an empty
// Headers list fails with a 422 ("The headers field must have at least 1
// items.") even though creating/editing that same webhook with zero headers
// succeeds - confirmed via a captured PUT request/response pair. The
// "toggles a webhook" test below therefore creates its QA webhook with one
// custom header so it's exercising the actual toggle mechanism; a separate
// test documents the bug directly against a headerless webhook so a real
// fix doesn't go unnoticed.
//
// There is exactly one real, pre-existing production webhook on this
// account (CASHKEEPER WEBHOOK, wired to a live cashkeeper.app endpoint) -
// no test here ever reads, toggles, edits, or deletes it; every mutating
// test creates and cleans up its own throwaway QA webhook instead.
describe('Webhook Integration page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.intercept('GET', '**/api/v1/admin/webhooks**').as('webhookList')
    cy.visit('/admin/settings/webhook-integration')
    cy.contains('h1, h2', /webhook integration/i).should('be.visible')
    cy.wait('@webhookList', { timeout: 15000 })
    cy.get('tbody tr', { timeout: 10000 }).should('have.length.greaterThan', 0)
  })

  const makeWebhook = (name, { headers = [] } = {}) => {
    cy.contains('button', /new webhook/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Main Store"]', name)
    cy.get('input[type="password"]').type('qa-secret-12345', { delay: 40 })
    cy.get('input[type="url"]').type('https://httpbin.org/anything', { delay: 40 })
    headers.forEach(({ key, value }) => {
      cy.contains('button', /add header/i).click({ force: true })
      cy.get('input[placeholder*="Key"]').last().type(key, { delay: 30 })
      cy.get('input[placeholder*="Value"]').last().type(value, { delay: 30 })
    })
    cy.intercept('POST', '**/api/v1/admin/webhooks').as('createWebhook')
    cy.contains('button', /create webhook/i).should('not.be.disabled').click({ force: true })
    cy.wait('@createWebhook', { timeout: 20000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains(name, { timeout: 10000 }).should('be.visible')
  }

  const deleteWebhook = (name) => {
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/webhooks/**').as('deleteWebhook')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteWebhook', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.contains(name).should('not.exist')
  }

  // The table sits in an overflow-x-auto wrapper - at the default viewport,
  // the Action column is clipped until scrolled horizontally, so it checks
  // DOM presence rather than viewport visibility (same class of issue as
  // Payments page's clipped columns, confirmed via the actual "clipped by
  // overflow" assertion error, not assumed).
  it('loads the page with New webhook, search, and the table', () => {
    cy.contains('button', /new webhook/i).should('be.visible')
    cy.get('input[placeholder*="Search by name or URL"]').should('be.visible')
    cy.contains('th', /^name/i).should('be.visible')
    cy.contains('th', /^url$/i).should('be.visible')
    cy.contains('th', /active/i).should('be.visible')
    cy.contains('th', /action/i).should('exist')
    cy.contains(/\d+ records? found/i).should('be.visible')
  })

  it('navigates to the New Webhook form', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new webhook/i), '/webhook-integration/create')
    cy.contains('h1, h2', /new webhook/i).should('be.visible')
    // The Name label nests a `*` span with leading whitespace before the
    // text ("<label> Name <span>*</span></label>"), which cy.contains's
    // anchored regex can never match - same family of issue as Banners'
    // getFieldByLabelStart (see banners.cy.js). Filtering by trimmed
    // textContent directly sidesteps it.
    cy.get('label').filter((i, el) => el.textContent.trim().toLowerCase().startsWith('name')).should('be.visible')
    cy.contains('label', /secret/i).should('be.visible')
    cy.contains('label', /webhook url/i).should('be.visible')
    cy.contains(/active/i).should('be.visible')
    cy.contains('button', /add header/i).should('be.visible')
    cy.contains('button', /cancel/i).should('be.visible')
    cy.contains('button', /create webhook/i).should('be.visible')
  })

  it('blocks creating a webhook with no fields filled in', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new webhook/i), '/webhook-integration/create')
    cy.contains('button', /create webhook/i).click({ force: true })
    cy.wait(1000)
    cy.url().should('include', '/webhook-integration/create')
  })

  it('cancels out of the New Webhook form back to the list', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new webhook/i), '/webhook-integration/create')
    cy.contains('button', /cancel/i).click({ force: true })
    cy.url().should('include', '/admin/settings/webhook-integration')
    cy.url().should('not.include', '/create')
  })

  it('creates a webhook with a name, secret, and URL, and it appears in the list', () => {
    const name = `QA Webhook ${Date.now()}`
    makeWebhook(name)
    cy.contains('table tbody tr', name).find('td').eq(1).invoke('text').should('include', 'httpbin.org')
    deleteWebhook(name)
  })

  it('edits a webhook via the Edit action and the updated name appears in the list', () => {
    const originalName = `QA Edit ${Date.now()}`
    const updatedName = `${originalName} Updated`
    makeWebhook(originalName)

    cy.contains('table tbody tr', originalName).within(() => {
      cy.get('button[title="Edit"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('include', '/webhook-integration/create?mode=edit')
    cy.contains('h1, h2', /edit webhook/i).should('be.visible')
    cy.get('input[placeholder*="Main Store"]').should('have.value', originalName).clear().type(updatedName, { delay: 40 })

    cy.intercept('PUT', '**/api/v1/admin/webhooks/**').as('updateWebhook')
    cy.contains('button', /save changes/i).click({ force: true })
    cy.wait('@updateWebhook', { timeout: 15000 }).its('response.statusCode').should('eq', 200)
    cy.url({ timeout: 10000 }).should('include', '/admin/settings/webhook-integration')
    cy.contains(updatedName, { timeout: 10000 }).should('be.visible')

    deleteWebhook(updatedName)
  })

  it('deletes a webhook after confirming, and it disappears from the list', () => {
    const name = `QA DeleteMe ${Date.now()}`
    makeWebhook(name)
    deleteWebhook(name)
  })

  it('filters the list when searching by name', () => {
    const name = `QA Search ${Date.now()}`
    makeWebhook(name)
    cy.intercept('GET', '**/api/v1/admin/webhooks**').as('webhookSearch')
    cy.get('input[placeholder*="Search by name or URL"]').type(name)
    cy.wait('@webhookSearch', { timeout: 10000 })
    cy.contains('td', name).should('be.visible')
    cy.get('tbody tr').should('have.length', 1)
    cy.get('input[placeholder*="Search by name or URL"]').clear()
    deleteWebhook(name)
  })

  // Toggling with one custom header present so the toggle mechanism itself
  // (not the headers-validation bug below) is what's being exercised. See
  // top-of-file note.
  it('toggles a webhook Active/Inactive and switches it back', () => {
    const name = `QA Toggle ${Date.now()}`
    makeWebhook(name, { headers: [{ key: 'X-QA-Test', value: '1' }] })

    cy.contains('table tbody tr', name).find('button[title="Disable"], button[title="Enable"]').as('toggle')
    cy.get('@toggle').invoke('attr', 'title').then((beforeTitle) => {
      cy.intercept('PUT', '**/api/v1/admin/webhooks/**').as('toggleWebhook')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleWebhook', { timeout: 10000 }).its('response.statusCode').should('eq', 200)
      cy.get('@toggle').invoke('attr', 'title').should('not.eq', beforeTitle)

      cy.intercept('PUT', '**/api/v1/admin/webhooks/**').as('toggleWebhookBack')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleWebhookBack', { timeout: 10000 }).its('response.statusCode').should('eq', 200)
      cy.get('@toggle').invoke('attr', 'title').should('eq', beforeTitle)
    })

    deleteWebhook(name)
  })

  // CONFIRMED APP BUG (not a test bug): toggling a webhook with zero custom
  // headers fails with a 422 "headers field must have at least 1 items"
  // error, even though creating/editing that same webhook with an empty
  // headers list succeeds fine. This test documents the current (broken)
  // behavior so a real fix shows up as a failing assertion here instead of
  // going unnoticed.
  it('BUG: fails to toggle a headerless webhook (422 on PUT)', () => {
    const name = `QA BugToggle ${Date.now()}`
    makeWebhook(name)

    cy.intercept('PUT', '**/api/v1/admin/webhooks/**').as('toggleWebhook')
    cy.contains('table tbody tr', name).find('button[title="Disable"], button[title="Enable"]').click({ force: true })
    cy.wait('@toggleWebhook', { timeout: 10000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(422)
      expect(interception.response.body.errors[0]).to.have.property('headers')
    })

    deleteWebhook(name)
  })
})
