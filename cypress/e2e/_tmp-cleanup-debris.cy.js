// One-off cleanup - removes leftover "ZZZ Test Product ..." rows created
// during test debugging (their delete step failed before the underlying
// bugs were fixed, so they were never cleaned up). Safe to delete: the
// "ZZZ Test Product" prefix only ever comes from cy.createDummyProduct().
// Run this once, then delete this file.
describe('cleanup test debris', () => {
  it('bulk-deletes every ZZZ Test Product row, repeating until none remain', () => {
    cy.loginViaSession()

    function cleanupPage(round) {
      if (round > 20) return // safety cap
      cy.visit('/admin/catalogue/products')
      cy.contains('h1, h2', /products/i).should('be.visible')
      cy.wait(1000)
      cy.get('input[placeholder*="Search products"]').clear().type('ZZZ Test Product', { delay: 60 })
      cy.wait(2500)

      cy.get('body').then(($body) => {
        const hasNone = /no products found|0 results/i.test($body.text())
        if (hasNone) return

        const rows = $body.find('tbody tr').length
        if (rows === 0) return

        cy.log(`Round ${round}: deleting ${rows} rows`)
        cy.get('thead input[type="checkbox"]').first().check({ force: true })
        cy.wait(300)
        cy.contains('button', /delete/i).click({ force: true })
        cy.wait(500)
        cy.contains('button', /^delete$/i).click({ force: true })
        cy.wait(2500)

        cleanupPage(round + 1)
      })
    }

    cleanupPage(1)
  })
})
