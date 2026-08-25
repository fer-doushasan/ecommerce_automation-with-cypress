// Modeled directly on categories.cy.js per instruction - Brands has the same
// CRUD/toggle/search/bulk-delete feature set as Categories, just a different
// entity. UNLIKE every other spec in this repo, the selectors/endpoints
// below were NOT confirmed via a live DOM dump or network capture - they're
// carried over from Categories' confirmed values (/admin/ecommerce/brands,
// /api/v1/admin/brands, same button/label text) on the assumption the two
// pages share the same underlying list/form component. If a run fails on a
// 404 page-load, a wrong `th`/label match, or a `cy.wait('@alias')` timeout,
// that's this file's unconfirmed guess being wrong, not a real app bug -
// paste the failure back so the actual value can be swapped in.
//
// The Name field is looked up via its label (not a hardcoded placeholder
// guess like categories.cy.js's `input[placeholder*="Smart Home"]`) since
// Brand's placeholder copy (e.g. "e.g. Nike") wasn't confirmed.
function getFieldByLabelStart(startText) {
  return cy.get('label').filter((i, el) => el.textContent.trim().toLowerCase().startsWith(startText.toLowerCase())).parent()
}

function nameInput() {
  return getFieldByLabelStart('name').find('input')
}

describe('Brands page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.intercept('GET', '**/api/v1/admin/brands**').as('brandsList')
    cy.visit('/admin/ecommerce/brands')
    cy.contains('h1, h2', /^brands$/i).should('be.visible')
    cy.wait('@brandsList', { timeout: 15000 })
    cy.wait(500)
  })

  it('loads the brands page with New Brand, search, and the table', () => {
    cy.contains('button', /new brand/i).should('be.visible')
    cy.get('input[placeholder*="Search by name"]').should('be.visible')
    cy.contains(/\d+ records? found/i).should('be.visible')
    cy.contains('th', /image/i).should('be.visible')
    cy.contains('th', /^name/i).should('be.visible')
    cy.contains('th', /active/i).should('be.visible')
    cy.contains('th', /action/i).should('be.visible')
  })

  it('navigates to the New Brand form', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new brand/i), '/brands/create')
    cy.contains('h1, h2', /new brand/i).should('be.visible')
    getFieldByLabelStart('name').should('be.visible')
    cy.contains(/active/i).should('be.visible')
    cy.contains('label', /description/i).should('be.visible')
    cy.contains('label', /^image$/i).should('be.visible')
    cy.getButtonContaining('cancel').should('be.visible')
    cy.contains('button', /create brand/i).should('be.visible')
  })

  it('blocks creating a brand with no name filled in', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new brand/i), '/brands/create')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait(1000)
    cy.url().should('include', '/brands/create')
  })

  it('cancels out of the New Brand form back to the list', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new brand/i), '/brands/create')
    cy.getButtonContaining('cancel').click({ force: true })
    cy.url().should('include', '/admin/ecommerce/brands')
    cy.url().should('not.include', '/create')
  })

  it('creates a brand with a name, description, and image, and it appears in the list', () => {
    const name = `QA Brand ${Date.now()}`
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new brand/i), '/brands/create')

    nameInput().type(name, { delay: 40 })
    cy.contains('label', /description/i).parent().find('textarea').type('QA automated brand', { delay: 40 })
    cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait('@uploadImage', { timeout: 15000 })

    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/brands')
    cy.url().should('not.include', '/create')

    cy.contains(name, { timeout: 10000 }).should('be.visible')

    // Cleanup - delete the QA brand this test created.
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
  })

  it('filters the list when searching by name', () => {
    const name = `QA Search ${Date.now()}`
    cy.contains('button', /new brand/i).click({ force: true })
    cy.wait(500)
    nameInput().type(name, { delay: 40 })
    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.intercept('GET', '**/api/v1/admin/brands**search=**').as('brandSearch')
    cy.get('input[placeholder*="Search by name"]').type(name)
    cy.wait('@brandSearch', { timeout: 10000 })
    cy.contains('td', name).should('be.visible')
    cy.get('tbody tr').should('have.length', 1)

    // Cleanup.
    cy.get('input[placeholder*="Search by name"]').clear()
    cy.wait(1000)
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 })
  })

  // Uses a QA-created brand (not an existing real one) for the toggle
  // target, and always targets it by name via cy.contains(...).within(...) -
  // never "first row in the table" - after Categories' exploration showed
  // that pattern can grab the wrong row mid-async-filter and flip a real
  // record's Active state by mistake.
  it('toggles a brand Active/Inactive and switches it back', () => {
    const name = `QA Toggle ${Date.now()}`
    cy.contains('button', /new brand/i).click({ force: true })
    cy.wait(500)
    nameInput().type(name, { delay: 40 })
    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).find('button[title="Deactivate"], button[title="Activate"]').as('toggle')
    cy.get('@toggle').invoke('attr', 'title').then((beforeTitle) => {
      cy.intercept('PUT', '**/api/v1/admin/brands/**/active').as('toggleBrand')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleBrand', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('not.eq', beforeTitle)

      cy.intercept('PUT', '**/api/v1/admin/brands/**/active').as('toggleBrandBack')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleBrandBack', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('eq', beforeTitle)
    })

    // Cleanup.
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 })
  })

  it('deletes a brand after confirming, and it disappears from the list', () => {
    const name = `QA DeleteMe ${Date.now()}`
    cy.contains('button', /new brand/i).click({ force: true })
    cy.wait(500)
    nameInput().type(name, { delay: 40 })
    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.wait(1000)

    cy.contains(name).should('not.exist')
  })

  it('opens the View page for a brand and shows its details read-only', () => {
    const name = `QA View ${Date.now()}`
    cy.contains('button', /new brand/i).click({ force: true })
    cy.wait(500)
    nameInput().type(name, { delay: 40 })
    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="View"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('match', /\/admin\/ecommerce\/brands\/\d+$/)
    cy.contains('h1', name).should('be.visible')
    cy.contains('button', /edit brand/i).should('be.visible')

    // Cleanup.
    cy.go('back')
    cy.wait(1000)
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 })
  })

  it('edits a brand via the Edit action and the updated name appears in the list', () => {
    const originalName = `QA Edit ${Date.now()}`
    const updatedName = `${originalName} Updated`

    cy.contains('button', /new brand/i).click({ force: true })
    cy.wait(500)
    nameInput().type(originalName, { delay: 40 })
    cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
    cy.contains('button', /create brand/i).click({ force: true })
    cy.wait('@createBrand', { timeout: 15000 })
    cy.contains(originalName, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', originalName).within(() => {
      cy.get('button[title="Edit"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('include', '/brands/create?mode=edit')
    cy.contains('h1, h2', /edit brand/i).should('be.visible')
    nameInput().should('have.value', originalName).clear().type(updatedName, { delay: 40 })

    cy.intercept(/\/api\/v1\/admin\/brands\/\d+$/).as('updateBrand')
    cy.contains('button', /save changes/i).click({ force: true })
    cy.wait('@updateBrand', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/brands')
    cy.url().should('not.include', '/create')
    cy.contains(updatedName, { timeout: 10000 }).should('be.visible')

    // Cleanup - delete the QA brand this test created.
    cy.contains('table tbody tr', updatedName).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/brands/**').as('deleteBrand')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteBrand', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.contains(updatedName).should('not.exist')
  })

  it('bulk-deletes multiple selected brands via the header Delete (N) button', () => {
    const makeBrand = (name) => {
      cy.contains('button', /new brand/i).click({ force: true })
      cy.wait(500)
      nameInput().type(name, { delay: 40 })
      cy.intercept('POST', '**/api/v1/admin/brands').as('createBrand')
      cy.contains('button', /create brand/i).click({ force: true })
      cy.wait('@createBrand', { timeout: 15000 })
      cy.contains(name, { timeout: 10000 }).should('be.visible')
    }

    const name1 = `QA Bulk1 ${Date.now()}`
    const name2 = `QA Bulk2 ${Date.now()}`
    makeBrand(name1)
    makeBrand(name2)

    cy.contains('table tbody tr', name1).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('table tbody tr', name2).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('button', /delete \(2\)/i).should('be.visible')

    cy.contains('button', /delete \(2\)/i).click({ force: true })
    cy.contains(/are you sure you want to delete/i).should('be.visible')

    cy.intercept('POST', '**/api/v1/admin/brands/bulk-delete').as('bulkDelete')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@bulkDelete', { timeout: 10000 }).then((interception) => {
      expect(interception.request.body.ids).to.have.length(2)
      expect(interception.response.statusCode).to.eq(200)
    })

    cy.contains(name1).should('not.exist')
    cy.contains(name2).should('not.exist')
  })
})
