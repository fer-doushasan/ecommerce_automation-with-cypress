// Pages is a fixed set of 3 system pages (Terms and Conditions, Refund
// Policy, Privacy Policy) - no New/Delete/search/bulk-select exist (no New
// button was found anywhere in the DOM, confirmed by scanning it, and the
// list has no checkbox column or search input). Table is just
// Title/Status/Action with View/Edit as <a> links (not <button>s, unlike
// every other list in this repo - confirmed the hard way after
// button[title="View"] silently timed out).
//
// Edit locks Title and Slug (rendered as plain, cursor-not-allowed spans,
// not inputs) - only Description is editable, via a Quill rich-text editor
// (`.ql-editor[contenteditable]`). Save hits
// PUT /api/v1/admin/ecommerce-pages/slug/{slug} with
// { description: "<html>", is_published }.
//
// SAFETY: this test appends a small marker to Terms and Conditions' real
// live Description, saves, then removes it and saves again - confirmed via
// a manual dry run to round-trip byte-identical when done through
// {selectall}{rightarrow} (collapse cursor to true end) then typing/
// backspacing the exact same character count. That dry run's own
// verification step (checking the marker appeared on the View page) was
// unreliable/flaky and caused a run to stop BETWEEN the save and the
// revert, leaving the marker live on the real page for a period - a real
// incident, not a hypothetical. Two changes were made in response:
//   1) The revert lives in an `after()` hook so it always runs, independent
//      of whether the `it()` body's own assertions pass or fail.
//   2) Persistence is verified by re-fetching the same Edit page (which
//      round-tripped reliably in the incident's own fix) rather than the
//      View page (which didn't reflect the save within a normal wait -
//      cause unconfirmed, possibly client-side caching).
describe('Pages feature', () => {
  const slug = 'terms-and-conditions'
  const editUrl = `/admin/ecommerce/pages/edit?slug=${slug}`
  const marker = ' [[QA-EDIT-TEST-MARKER]]'

  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
  })

  it('loads the pages list with Title, Status, and Action for the fixed system pages', () => {
    cy.visit('/admin/ecommerce/pages')
    cy.contains('h1, h2', /^pages$/i).should('be.visible')
    cy.wait(2000)
    cy.contains(/loading/i).should('not.exist')

    cy.contains('th', /^title/i).should('be.visible')
    cy.contains('th', /status/i).should('be.visible')
    cy.contains('th', /action/i).should('be.visible')
    cy.contains('table tbody tr', 'Terms and Conditions').should('be.visible')
    cy.contains('table tbody tr', 'Refund Policy').should('be.visible')
    cy.contains('table tbody tr', 'Privacy Policy').should('be.visible')
    cy.get('input[type="checkbox"]').should('not.exist')
    cy.contains('button', /^new /i).should('not.exist')
  })

  it('opens the View page for a page and shows Title, Slug, Status, and Description read-only', () => {
    cy.visit('/admin/ecommerce/pages')
    cy.contains('h1, h2', /^pages$/i).should('be.visible')
    cy.wait(1000)

    cy.contains('table tbody tr', 'Terms and Conditions').within(() => {
      cy.get('a[title="View"]').click({ force: true })
    })
    cy.url({ timeout: 10000 }).should('include', '/pages/view?slug=terms-and-conditions')
    cy.contains('Terms and Conditions').should('be.visible')
    cy.contains(/^slug$/i).should('be.visible')
    cy.contains('terms-and-conditions').should('be.visible')
    cy.contains(/^status$/i).should('be.visible')
    cy.contains(/published/i).should('be.visible')
    cy.contains(/^description$/i).should('be.visible')
    cy.contains('button, a', /edit/i).should('be.visible')
  })

  it('opens the Edit page with Title/Slug locked and Description editable', () => {
    cy.visit(editUrl)
    cy.contains('h2', /edit/i).should('be.visible')
    cy.wait(1000)

    cy.contains('label', /^title$/i).next().should('have.class', 'cursor-not-allowed')
    cy.contains('label', /^slug$/i).next().should('have.class', 'cursor-not-allowed')
    cy.get('.ql-editor[contenteditable="true"]').should('be.visible').and('not.be.empty')
    cy.contains('a', /^cancel$/i).should('have.attr', 'href').and('include', '/pages/view?slug=terms-and-conditions')
    cy.contains('button', /save changes/i).should('be.visible')
  })

  // See the file-level SAFETY comment - the after() hook below is the real
  // guarantee here, not this test's own assertions.
  it('edits the Description via the rich-text editor and the change is saved', () => {
    cy.visit(editUrl)
    cy.contains('h2', /edit/i).should('be.visible')
    cy.wait(1000)

    cy.get('.ql-editor').click()
    cy.get('.ql-editor').type('{selectall}{rightarrow}')
    cy.get('.ql-editor').type(marker)
    cy.get('.ql-editor').invoke('text').should('include', 'QA-EDIT-TEST-MARKER')

    cy.intercept('PUT', '**/api/v1/admin/ecommerce-pages/**').as('savePage')
    cy.contains('button', /save changes/i).click({ force: true })
    cy.wait('@savePage', { timeout: 15000 }).its('response.statusCode').should('eq', 200)

    // Verify persistence via the Edit page itself (see file-level comment
    // for why View isn't used here).
    cy.visit(editUrl)
    cy.wait(1500)
    cy.get('.ql-editor').invoke('text').should('include', 'QA-EDIT-TEST-MARKER')
  })

  // Runs unconditionally after every test in this file, whether they passed
  // or failed, and is idempotent (a no-op if no marker is present) - this is
  // the actual safety net for real Terms and Conditions content, not the
  // edit test's own assertions.
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit(editUrl)
    cy.contains('h2', /edit/i).should('be.visible')
    cy.wait(1000)

    cy.get('.ql-editor').invoke('text').then((text) => {
      if (!text.includes('QA-EDIT-TEST-MARKER')) return

      cy.get('.ql-editor').click()
      cy.get('.ql-editor').type('{selectall}{rightarrow}')
      cy.get('.ql-editor').type('{backspace}'.repeat(marker.length))
      cy.get('.ql-editor').invoke('text').should('not.include', 'QA-EDIT-TEST-MARKER')

      cy.intercept('PUT', '**/api/v1/admin/ecommerce-pages/**').as('revertPage')
      cy.contains('button', /save changes/i).click({ force: true })
      cy.wait('@revertPage', { timeout: 15000 }).its('response.statusCode').should('eq', 200)
    })
  })
})
