// Three tabs (General / Brand & Contact / Social Media). Saving POSTs to
// /api/v1/admin/ecommerce-settings and shows a "Saved successfully" toast -
// confirmed by intercepting the real network call rather than guessing the
// endpoint or toast copy. The save button reads "Save Settings" on the
// General tab but "Save Changes" on the other two.
//
// The General tab was redesigned since first written (re-confirmed via a
// live DOM dump): Theme is now three selectable preview cards, not a
// <select>; there's no separate "Theme Preview" panel; and Logo / Favicon /
// Footer are inline image widgets (preview <img> + Change/Remove overlay
// buttons + a hidden <input type="file">), labelled just "Logo" / "Favicon"
// / "Footer".
describe('Ecommerce Settings page', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/ecommerce/settings')
    cy.contains('h1, h2', /ecommerce settings/i).should('be.visible')
    cy.wait(2000)
  })

  it('loads with the General tab active by default', () => {
    cy.contains(/configure your store's general, brand, and social settings/i).should('be.visible')
    cy.contains('button', /^general$/i).should('be.visible')
    cy.contains('button', /brand & contact/i).should('be.visible')
    cy.contains('button', /social media/i).should('be.visible')
    cy.contains(/enable e-commerce/i).should('be.visible')
    cy.contains('button', /save settings/i).should('be.visible')
  })

  it('shows the General tab fields: toggles, theme, and image uploads', () => {
    cy.contains(/enable e-commerce/i).should('be.visible')
    cy.contains(/out of stock/i).should('be.visible')
    // Labels are single words ("Theme" / "Logo" / "Favicon" / "Footer"),
    // CSS-uppercased and padded by this app's text nodes - hence the loose
    // \s* anchoring rather than /^theme$/i.
    cy.contains('label', /^\s*theme\s*$/i).should('be.visible')
    cy.get('img[alt*="theme preview"]').should('have.length', 3)
    cy.contains('label', /^\s*logo\s*$/i).should('be.visible')
    cy.contains('label', /^\s*favicon\s*$/i).should('be.visible')
    cy.contains('label', /^\s*footer\s*$/i).should('be.visible')
    cy.get('input[type="file"]').should('have.length', 3)
  })

  // The old "Theme Preview" side panel is gone; Theme is now three
  // selectable cards, each a role="button" with the theme name, a preview
  // <img>, and its own "Preview" button. The active card shows a "Selected"
  // badge and aria-pressed="true".
  it('shows the three theme option cards', () => {
    cy.contains('label', /^\s*theme\s*$/i).should('be.visible')
    cy.contains('Default').should('be.visible')
    cy.contains('Aura').should('be.visible')
    cy.contains('Herbora').should('be.visible')
    cy.get('img[alt*="theme preview"]').should('have.length', 3)
    cy.get('[role="button"][aria-pressed="true"]').should('exist')
    cy.contains(/selected/i).should('be.visible')
  })

  // Toggling flips the visual state, then is switched straight back before
  // ever clicking Save - Enable E-commerce controls whether the live
  // storefront is on at all, so this deliberately never saves it in a
  // toggled-off state.
  it('flips the Out of Stock toggle and switches it back', () => {
    cy.contains(/out of stock/i).parent().parent().find('button').as('toggle')
    cy.get('@toggle').invoke('attr', 'class').then((beforeClass) => {
      cy.get('@toggle').click({ force: true })
      cy.get('@toggle').invoke('attr', 'class').should('not.eq', beforeClass)
      cy.get('@toggle').click({ force: true })
      cy.get('@toggle').invoke('attr', 'class').should('eq', beforeClass)
    })
  })

  it('saves settings and shows a success toast', () => {
    cy.intercept('POST', '**/api/v1/admin/ecommerce-settings').as('saveSettings')
    cy.contains('button', /save settings/i).click({ force: true })
    cy.wait('@saveSettings', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.contains(/saved successfully/i).should('be.visible')
  })

  // The Footer Banner is a real, storefront-facing image that already has a
  // value, so this grabs the current file's bytes up front and re-uploads
  // them in an unconditional after() hook - a failure mid-test can't leave
  // the store's footer swapped out for the QA test image.
  describe('Footer Banner image', () => {
    // General-tab image widgets are Logo / Favicon / Footer in DOM order,
    // each with a hidden <input type="file"> - index 2 is the Footer.
    const footerFileInput = () => cy.get('input[type="file"]').eq(2)
    const footerImg = () => cy.get('img[alt="Footer banner"]')

    let originalSrc = null
    let originalBytes = null

    before(() => {
      cy.loginViaSession()
      cy.visit('/admin/ecommerce/settings')
      cy.contains('h1, h2', /ecommerce settings/i).should('be.visible')
      cy.wait(2000)
      footerImg()
        .should('have.attr', 'src')
        .then((src) => {
          originalSrc = src
          return cy.request({ url: src, encoding: 'binary', failOnStatusCode: false })
        })
        .then((res) => {
          if (res && res.status === 200) originalBytes = res.body
        })
    })

    it('uploads a Footer Banner image, saves, and it persists', () => {
      cy.get('input[type="file"]').should('have.length', 3)

      // Same async POST /api/v1/upload the Banners/Brands/Categories image
      // fields use - wait on the real upload response, not a fixed sleep, so
      // Save can't fire before the new image URL is attached to the form.
      cy.intercept('POST', '**/api/v1/upload**').as('uploadFooter')
      footerFileInput().selectFile('cypress/fixtures/test-image.png', { force: true })
      cy.wait('@uploadFooter', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])

      cy.intercept('POST', '**/api/v1/admin/ecommerce-settings**').as('saveSettings')
      cy.contains('button', /save settings/i).click({ force: true })
      cy.wait('@saveSettings', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])
      cy.contains(/saved successfully/i).should('be.visible')

      // Persisted, not just toasted: reload and confirm the Footer preview
      // now points at a freshly uploaded file, not the original.
      cy.reload()
      cy.wait(2000)
      footerImg().should('have.attr', 'src').and('not.eq', originalSrc)
      footerImg().should('have.attr', 'src').and('match', /\/uploads?\//i)
      // The after() hook below then restores the original image, so the
      // storefront footer looks unchanged once this spec finishes - that is
      // expected, not a failed upload.
      cy.log('Footer banner upload verified; original will be restored in after()')
    })

    after(() => {
      if (!originalBytes) return
      cy.log('Restoring the original Footer banner image')
      cy.loginViaSession()
      cy.visit('/admin/ecommerce/settings')
      cy.contains('h1, h2', /ecommerce settings/i).should('be.visible')
      cy.wait(2000)
      cy.intercept('POST', '**/api/v1/upload**').as('restoreUpload')
      footerFileInput().selectFile(
        {
          contents: Cypress.Buffer.from(originalBytes, 'binary'),
          fileName: originalSrc.split('/').pop() || 'footer-original.png',
          mimeType: 'image/png',
        },
        { force: true },
      )
      cy.wait('@restoreUpload', { timeout: 15000 })
      cy.intercept('POST', '**/api/v1/admin/ecommerce-settings**').as('restoreSave')
      cy.contains('button', /save settings/i).click({ force: true })
      cy.wait('@restoreSave', { timeout: 10000 })
    })
  })

  it('shows the Brand & Contact tab fields when selected', () => {
    cy.contains('button', /brand & contact/i).click({ force: true })
    cy.wait(500)
    cy.contains(/brand identity/i).should('be.visible')
    cy.contains('label', /primary color/i).should('be.visible')
    cy.contains('label', /secondary color/i).should('be.visible')
    cy.contains('label', /font family/i).should('be.visible')
    cy.contains(/contact information/i).should('be.visible')
    cy.get('input[type="tel"][placeholder*="01700000000"]').should('be.visible')
    cy.get('input[type="email"][placeholder*="myshop.com"]').should('be.visible')
    cy.contains('label', /business address/i).should('be.visible')
    cy.contains(/store content/i).should('be.visible')
    cy.contains('label', /google maps embed/i).should('be.visible')
    cy.contains('label', /about us/i).should('be.visible')
    cy.contains('label', /footer description/i).should('be.visible')
  })

  // These fields are real, potentially public-facing store settings
  // (contact info, brand colors, footer copy) - not throwaway test data
  // like coupons/orders elsewhere in this suite. Capturing the original
  // values, saving new ones, confirming they actually persisted (reload,
  // not just a success toast), then restoring the originals and saving
  // again, so this shop's real branding isn't left altered.
  it('fills, saves, and restores the Brand & Contact fields', () => {
    cy.contains('button', /brand & contact/i).click({ force: true })
    cy.wait(500)

    const fields = {
      primaryColor: () => cy.contains('label', /primary color/i).parent().find('input[type="text"]'),
      secondaryColor: () => cy.contains('label', /secondary color/i).parent().find('input[type="text"]'),
      fontFamily: () => cy.contains('label', /font family/i).parent().find('select'),
      phone: () => cy.get('input[type="tel"][placeholder*="01700000000"]'),
      email: () => cy.get('input[type="email"][placeholder*="myshop.com"]'),
      address: () => cy.contains('label', /business address/i).parent().find('textarea'),
      mapsEmbed: () => cy.contains('label', /google maps embed/i).parent().find('textarea'),
      aboutUs: () => cy.contains('label', /about us/i).parent().find('textarea'),
      footerDescription: () => cy.contains('label', /footer description/i).parent().find('textarea'),
    }

    const testValues = {
      primaryColor: '#3366FF',
      secondaryColor: '#112233',
      fontFamily: 'Poppins',
      phone: '01799998888',
      email: 'qa-test@example.com',
      address: 'QA Test Address, Dhaka, Bangladesh',
      mapsEmbed: '<iframe src="https://maps.google.com/qa-test"></iframe>',
      aboutUs: 'QA automated test About Us content.',
      footerDescription: 'QA automated test footer description.',
    }

    const original = {}
    Object.keys(fields).forEach((key) => {
      fields[key]().invoke('val').then((val) => { original[key] = val })
    })

    cy.then(() => {
      Object.keys(fields).forEach((key) => {
        if (key === 'fontFamily') {
          fields[key]().select(testValues[key])
        } else {
          fields[key]().clear().type(testValues[key], { delay: 20 }).should('have.value', testValues[key])
        }
      })

      // The Brand & Contact / Social Media tabs label their save button
      // "Save Changes" (only the General tab says "Save Settings").
      cy.intercept('POST', '**/api/v1/admin/ecommerce-settings**').as('saveSettings')
      cy.getButtonContaining('save changes').click({ force: true })
      cy.wait('@saveSettings', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])
      cy.contains(/saved successfully/i).should('be.visible')

      cy.reload()
      cy.wait(2000)
      cy.contains('button', /brand & contact/i).click({ force: true })
      cy.wait(500)
      Object.keys(fields).forEach((key) => {
        fields[key]().invoke('val').should('eq', testValues[key])
      })

      Object.keys(fields).forEach((key) => {
        if (key === 'fontFamily') {
          fields[key]().select(original[key])
        } else {
          fields[key]().clear()
          if (original[key]) {
            fields[key]().type(original[key], { delay: 20 })
          }
        }
      })

      cy.intercept('POST', '**/api/v1/admin/ecommerce-settings**').as('restoreSettings')
      cy.getButtonContaining('save changes').click({ force: true })
      cy.wait('@restoreSettings', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])
      cy.contains(/saved successfully/i).should('be.visible')
    })
  })

  it('shows the Social Media tab fields when selected', () => {
    cy.contains('button', /social media/i).click({ force: true })
    cy.wait(500)
    cy.contains(/seo & metadata/i).should('be.visible')
    cy.contains('label', /meta title/i).should('be.visible')
    cy.contains('label', /meta description/i).should('be.visible')
    cy.contains(/messaging services/i).should('be.visible')
    cy.contains('label', /whatsapp url/i).should('be.visible')
    cy.contains('label', /telegram url/i).should('be.visible')
    cy.contains('label', /facebook url/i).should('be.visible')
    cy.contains('label', /instagram url/i).should('be.visible')
    cy.contains('label', /tiktok url/i).should('be.visible')
    cy.contains('label', /youtube url/i).should('be.visible')
    cy.contains('label', /twitter url/i).should('be.visible')
    cy.contains('label', /linkedin url/i).should('be.visible')
  })
})
