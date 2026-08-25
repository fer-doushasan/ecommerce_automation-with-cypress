// List/create/update/delete all hit /api/v1/admin/product-categories (NOT
// "ecommerce-categories" - confirmed by intercepting real network calls, not
// guessed off the Banners/Coupons naming pattern). Toggling Active is a
// separate PUT to /product-categories/{id}/active with an empty body.
// Table columns: checkbox, Image, Name, Slug, Active, Action - same shape as
// Banners but with Slug in place of URL. Unlike Banners, this list DOES have
// a search box (placeholder "Search by name…", confirmed via
// GET ...&search=<term>).
//
// Unlike Banners (where Banner URL is silently required despite no visible
// asterisk), Category's Image is genuinely optional - confirmed by creating
// a category with no file selected and getting a real "Category created"
// success toast with `image: ""` in the POST body, not a validation error.
// Only Name carries the required `*`.
//
// cy.contains('label', /regex/) can't reliably locate labels with a nested
// `*` span here either (same family of issue documented in banners.cy.js) -
// reusing that file's getFieldByLabelStart workaround.
function getFieldByLabelStart(startText) {
  return cy.get('label').filter((i, el) => el.textContent.trim().toLowerCase().startsWith(startText.toLowerCase())).parent()
}

describe('Categories page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.intercept('GET', '**/api/v1/admin/product-categories**').as('categoriesList')
    cy.visit('/admin/ecommerce/categories')
    cy.contains('h1, h2', /^categories$/i).should('be.visible')
    cy.wait('@categoriesList', { timeout: 15000 })
    cy.wait(500)
  })

  it('loads the categories page with New Category, search, and the table', () => {
    cy.contains('button', /new category/i).should('be.visible')
    cy.get('input[placeholder*="Search by name"]').should('be.visible')
    cy.contains(/\d+ records? found/i).should('be.visible')
    cy.contains('th', /image/i).should('be.visible')
    cy.contains('th', /^name/i).should('be.visible')
    cy.contains('th', /^slug$/i).should('be.visible')
    cy.contains('th', /active/i).should('be.visible')
    cy.contains('th', /action/i).should('be.visible')
  })

  it('navigates to the New Category form', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new category/i), '/categories/create')
    cy.contains('h1, h2', /new category/i).should('be.visible')
    getFieldByLabelStart('name').should('be.visible')
    cy.contains(/active/i).should('be.visible')
    cy.contains('label', /description/i).should('be.visible')
    cy.contains('label', /^image$/i).should('be.visible')
    cy.getButtonContaining('cancel').should('be.visible')
    cy.contains('button', /create category/i).should('be.visible')
  })

  it('blocks creating a category with no name filled in', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new category/i), '/categories/create')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait(1000)
    cy.url().should('include', '/categories/create')
  })

  it('cancels out of the New Category form back to the list', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new category/i), '/categories/create')
    cy.getButtonContaining('cancel').click({ force: true })
    cy.url().should('include', '/admin/ecommerce/categories')
    cy.url().should('not.include', '/create')
  })

  // Image upload kicks off an async POST /api/v1/upload the same way Banners
  // does - the create POST's `image` field only carries a real URL once that
  // resolves (confirmed via a captured network log), so this waits on the
  // real upload response rather than a fixed sleep.
  it('creates a category with a name, description, and image, and it appears in the list', () => {
    const name = `QA Category ${Date.now()}`
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new category/i), '/categories/create')

    cy.typeReliably('input[placeholder*="Smart Home"]', name)
    cy.contains('label', /description/i).parent().find('textarea').type('QA automated category', { delay: 40 })
    cy.intercept('POST', '**/api/v1/upload**').as('uploadImage')
    cy.get('input[type="file"]').selectFile('cypress/fixtures/test-image.png', { force: true })
    cy.wait('@uploadImage', { timeout: 15000 })

    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/categories')
    cy.url().should('not.include', '/create')

    cy.contains(name, { timeout: 10000 }).should('be.visible')

    // Cleanup - delete the QA category this test created.
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
  })

  // Regression coverage for the Banners-vs-Categories delta: Categories has
  // a real search box (Banners has none at all) - confirmed working via
  // GET .../product-categories?...&search=<term> returning the matching row.
  it('filters the list when searching by name', () => {
    const name = `QA Search ${Date.now()}`
    cy.contains('button', /new category/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Smart Home"]', name)
    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.intercept('GET', '**/api/v1/admin/product-categories**search=**').as('categorySearch')
    cy.get('input[placeholder*="Search by name"]').type(name)
    cy.wait('@categorySearch', { timeout: 10000 })
    cy.contains('td', name).should('be.visible')
    cy.get('tbody tr').should('have.length', 1)

    // Cleanup.
    cy.get('input[placeholder*="Search by name"]').clear()
    cy.wait(1000)
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 })
  })

  // Toggle is a dedicated PUT .../product-categories/{id}/active endpoint
  // (not a generic resource PUT like Banners uses) - confirmed via a
  // captured network log. Uses a QA-created category (not an existing real
  // one) so this can't flip a real category's visibility - see the bug-report
  // note below for why that distinction matters here specifically.
  //
  // BUG-REPORT LESSON: while exploring this page, a synchronous DOM check
  // right after typing into the search box (no retry/wait on the debounced
  // response) grabbed whatever row was first in a still-updating list and
  // toggled the wrong category's Active state. Always assert on a uniquely
  // named row via cy.contains(...).within(...) for the toggle target, never
  // "first row in the table", when a search or other async filter is in play.
  it('toggles a category Active/Inactive and switches it back', () => {
    const name = `QA Toggle ${Date.now()}`
    cy.contains('button', /new category/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Smart Home"]', name)
    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).find('button[title="Deactivate"], button[title="Activate"]').as('toggle')
    cy.get('@toggle').invoke('attr', 'title').then((beforeTitle) => {
      cy.intercept('PUT', '**/api/v1/admin/product-categories/**/active').as('toggleCategory')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleCategory', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('not.eq', beforeTitle)

      cy.intercept('PUT', '**/api/v1/admin/product-categories/**/active').as('toggleCategoryBack')
      cy.get('@toggle').click({ force: true })
      cy.wait('@toggleCategoryBack', { timeout: 10000 })
      cy.get('@toggle').invoke('attr', 'title').should('eq', beforeTitle)
    })

    // Cleanup.
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 })
  })

  it('deletes a category after confirming, and it disappears from the list', () => {
    const name = `QA DeleteMe ${Date.now()}`
    cy.contains('button', /new category/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Smart Home"]', name)
    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.wait(1000)

    cy.contains(name).should('not.exist')
  })

  // View is a dedicated read-only page (/admin/ecommerce/categories/{id}),
  // not a modal - confirmed by dumping the DOM after clicking it.
  it('opens the View page for a category and shows its details read-only', () => {
    const name = `QA View ${Date.now()}`
    cy.contains('button', /new category/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Smart Home"]', name)
    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 })
    cy.contains(name, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="View"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('match', /\/admin\/ecommerce\/categories\/\d+$/)
    cy.contains('h1', name).should('be.visible')
    cy.contains('button', /edit category/i).should('be.visible')

    // Cleanup.
    cy.go('back')
    cy.wait(1000)
    cy.contains('table tbody tr', name).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 })
  })

  // Edit reuses the create form at /categories/create?mode=edit&id={id} -
  // confirmed by dumping the DOM after clicking it. Its submit button reads
  // "Save Changes", not "Update" (also confirmed, not assumed).
  it('edits a category via the Edit action and the updated name appears in the list', () => {
    const originalName = `QA Edit ${Date.now()}`
    const updatedName = `${originalName} Updated`

    cy.contains('button', /new category/i).click({ force: true })
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Smart Home"]', originalName)
    cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
    cy.contains('button', /create category/i).click({ force: true })
    cy.wait('@createCategory', { timeout: 15000 })
    cy.contains(originalName, { timeout: 10000 }).should('be.visible')

    cy.contains('table tbody tr', originalName).within(() => {
      cy.get('button[title="Edit"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('include', '/categories/create?mode=edit')
    cy.contains('h1, h2', /edit category/i).should('be.visible')
    cy.get('input[placeholder*="Smart Home"]').should('have.value', originalName).clear().type(updatedName, { delay: 40 })

    cy.intercept(/\/api\/v1\/admin\/product-categories\/\d+$/).as('updateCategory')
    cy.contains('button', /save changes/i).click({ force: true })
    cy.wait('@updateCategory', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('include', '/admin/ecommerce/categories')
    cy.url().should('not.include', '/create')
    cy.contains(updatedName, { timeout: 10000 }).should('be.visible')

    // Cleanup - delete the QA category this test created.
    cy.contains('table tbody tr', updatedName).within(() => {
      cy.get('button[title="Delete"]').click({ force: true })
    })
    cy.contains(/are you sure/i).should('be.visible')
    cy.intercept('DELETE', '**/api/v1/admin/product-categories/**').as('deleteCategory')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteCategory', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 204])
    cy.contains(updatedName).should('not.exist')
  })

  // Same header "Delete (N)" toolbar pattern as Banners, posting one
  // POST /api/v1/admin/product-categories/bulk-delete with { ids: [...] } -
  // confirmed via a captured network log, not guessed.
  it('bulk-deletes multiple selected categories via the header Delete (N) button', () => {
    const makeCategory = (name) => {
      cy.contains('button', /new category/i).click({ force: true })
      cy.wait(500)
      cy.typeReliably('input[placeholder*="Smart Home"]', name)
      cy.intercept('POST', '**/api/v1/admin/product-categories').as('createCategory')
      cy.contains('button', /create category/i).click({ force: true })
      cy.wait('@createCategory', { timeout: 15000 })
      cy.contains(name, { timeout: 10000 }).should('be.visible')
    }

    const name1 = `QA Bulk1 ${Date.now()}`
    const name2 = `QA Bulk2 ${Date.now()}`
    makeCategory(name1)
    makeCategory(name2)

    cy.contains('table tbody tr', name1).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('table tbody tr', name2).find('input[type="checkbox"]').check({ force: true }).should('be.checked')
    cy.contains('button', /delete \(2\)/i).should('be.visible')

    cy.contains('button', /delete \(2\)/i).click({ force: true })
    cy.contains(/are you sure you want to delete/i).should('be.visible')

    cy.intercept('POST', '**/api/v1/admin/product-categories/bulk-delete').as('bulkDelete')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@bulkDelete', { timeout: 10000 }).then((interception) => {
      expect(interception.request.body.ids).to.have.length(2)
      expect(interception.response.statusCode).to.eq(200)
    })

    cy.contains(name1).should('not.exist')
    cy.contains(name2).should('not.exist')
  })
})
