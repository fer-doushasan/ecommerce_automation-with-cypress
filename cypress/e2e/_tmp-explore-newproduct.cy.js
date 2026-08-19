// Exploration only - full-page view of the New Product form + label dump.
describe('explore new product form - full page', () => {
  it('captures the whole form and every label', () => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
    cy.clickUntilUrlIncludes(
      () => cy.contains('button', /new product/i),
      '/admin/catalogue/products'
    )
    cy.wait(1500)

    cy.screenshot('newproduct-fullpage', { capture: 'fullPage' })

    cy.get('label').then(($labels) => {
      const labels = $labels.toArray().map((el) => el.innerText.trim()).filter(Boolean)
      cy.writeFile('cypress/screenshots/_tmp-explore-newproduct.cy.js/labels.json', labels)
    })

    cy.get('button:visible').then(($btns) => {
      const texts = $btns.toArray().map((el) => el.innerText.trim() || el.getAttribute('aria-label') || '').filter(Boolean)
      cy.writeFile('cypress/screenshots/_tmp-explore-newproduct.cy.js/buttons.json', texts)
    })

    cy.get('form, main').first().then(($form) => {
      cy.writeFile('cypress/screenshots/_tmp-explore-newproduct.cy.js/form-html.txt', $form.prop('outerHTML'))
    })
  })
})
