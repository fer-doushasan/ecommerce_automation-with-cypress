describe('explore products page', () => {
  it('loads the products page and screenshots it', () => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.wait(2000)
    cy.screenshot('products-page-initial', { capture: 'fullPage' })

    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
    cy.screenshot('products-actions-column', { capture: 'viewport' })

    cy.contains('button', /filters/i).click({ force: true })
    cy.wait(1000)
    cy.screenshot('products-filters-panel', { capture: 'fullPage' })
  })
})
