// Labels on this page have a leading space (e.g. " Discount Type *"), which
// breaks ^-anchored regex matches - always use a non-anchored match, and an
// exact-trim match where two labels overlap (e.g. "Discount *" vs
// "Discount Type *").
function getFieldByExactLabel(exactText) {
  return cy.get('label').filter((i, el) => el.textContent.trim() === exactText).parent()
}

function goToNewCouponForm() {
  cy.clickUntilUrlIncludes(() => cy.contains('button', /new coupon/i), '/coupons/create')
  cy.wait(1000)
}

function fillAndSubmitCoupon({ code, discountType, discount }) {
  goToNewCouponForm()

  cy.get('input[placeholder*="SAVE20"]').type(code, { delay: 60 })
  cy.contains('label', /discount type/i).parent().find('select').select(discountType)
  cy.wait(300)
  getFieldByExactLabel('Discount *').find('input[type="number"]').first().type(String(discount), { delay: 60 })
  cy.wait(500)

  cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
  cy.contains('button', /create coupon/i).click({ force: true })
  return cy.wait('@createCoupon', { timeout: 15000 })
}

describe('Coupons page', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/coupons')
    cy.contains('h1, h2', /coupons/i).should('be.visible')
    cy.wait(1000)
  })

  it('loads the coupons page with New Coupon, Tutorial, search and table', () => {
    cy.contains('button', /new coupon/i).should('be.visible')
    cy.contains('button', /tutorial/i).should('be.visible')
    cy.get('input[placeholder*="Search by coupon"]').should('be.visible')
    cy.contains(/coupon code/i).should('be.visible')
    cy.contains(/discount type/i).should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  it('shows required fields on the Create Coupon form', () => {
    goToNewCouponForm()

    cy.contains('Create Coupon').should('be.visible')
    cy.contains('label', /products/i).should('be.visible')
    cy.get('input[placeholder*="SAVE20"]').should('be.visible')
    cy.contains('label', /discount type/i).should('be.visible')
    getFieldByExactLabel('Discount *').should('be.visible')
    cy.contains('label', /min order amount/i).should('be.visible')
    cy.contains('label', /max discount amount/i).should('be.visible')
    cy.contains('label', /max usage/i).should('be.visible')
    cy.contains('label', /valid from/i).should('be.visible')
    cy.contains('label', /valid till/i).should('be.visible')
    cy.getButtonContaining('cancel').should('be.visible')
    cy.contains('button', /create coupon/i).should('be.visible')
  })

  it('creates a Flat discount coupon', () => {
    const code = `FLAT${Date.now()}`.slice(0, 15)
    fillAndSubmitCoupon({ code, discountType: 'Flat', discount: 25 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
      expect(interception.response.body.success).to.eq(true)
      expect(interception.response.body.data.discount_type).to.eq('flat')
      expect(interception.response.body.data.discount).to.eq(25)
    })
    cy.contains(/coupon created/i).should('be.visible')

    // The list has no default sort (unlike Orders' "Sort By Update"), so a
    // freshly created coupon isn't guaranteed to be on page 1 once there
    // are more than 10 coupons - search for it instead of assuming.
    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.contains(code).should('be.visible')
  })

  it('creates a Percentage discount coupon', () => {
    const code = `PCT${Date.now()}`.slice(0, 15)
    fillAndSubmitCoupon({ code, discountType: 'Percentage', discount: 10 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
      expect(interception.response.body.data.discount_type).to.eq('percent')
      expect(interception.response.body.data.discount).to.eq(10)
    })
    cy.contains(/coupon created/i).should('be.visible')

    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.contains(code).should('be.visible')
  })

  // The Products field is a checkbox-*looking* multi-select, but each row's
  // "checkbox" is actually a plain <span> (w-4 h-4 rounded border-2) with no
  // real <input> - there is no native checkbox anywhere in this picker.
  // The whole row is the clickable unit: <li data-product-item="" ...>.
  // The panel itself renders via an inline `position: fixed` style (not the
  // Tailwind `fixed`/`z-50` classes other pickers in this app use), which is
  // why a class-based portal selector doesn't find it either - targeting
  // the row by its data-product-item attribute sidesteps all of that.
  // No search term is typed - the panel already lists products by default,
  // and searching for a specific name (e.g. "Macbook") isn't reliable since
  // the live catalogue doesn't consistently contain any given fixture name.
  function selectFirstAvailableProduct() {
    cy.contains('label', /products/i).parent().find('div.cursor-pointer').first().click({ force: true })
    cy.get('input[placeholder*="Search products"]').should('be.visible')
    cy.get('li[data-product-item]', { timeout: 10000 }).first().click({ force: true })
    cy.wait(300)
    cy.contains('button', /^done$/i).click({ force: true })
    cy.wait(500)
  }

  // The list's Type column is the actual user-facing signal for this (the
  // API response has no explicit type field, just a products array) - so
  // that's what these assert against, rather than the response body.
  it('scopes a coupon to a single product when one is selected via the Products picker, and the list shows it as Product', () => {
    goToNewCouponForm()
    const code = `SCOPED${Date.now()}`.slice(0, 15)
    cy.get('input[placeholder*="SAVE20"]').type(code, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Flat')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('15', { delay: 60 })

    selectFirstAvailableProduct()

    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon', { timeout: 15000 }).its('response.statusCode').should('eq', 200)
    cy.wait(1500)

    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
    cy.contains('table tbody tr', code).invoke('text').should('match', /product/i)
  })

  it('creates a global coupon when no product is selected, and the list shows it as Global', () => {
    const code = `GLOBAL${Date.now()}`.slice(0, 15)
    fillAndSubmitCoupon({ code, discountType: 'Flat', discount: 20 })
    cy.wait(1500)

    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
    cy.contains('table tbody tr', code).invoke('text').should('match', /global/i)
  })

  it('applies min order amount and max usage to a coupon', () => {
    goToNewCouponForm()
    const code = `LIMITS${Date.now()}`.slice(0, 15)
    cy.get('input[placeholder*="SAVE20"]').type(code, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Flat')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('15', { delay: 60 })
    cy.contains('label', /min order amount/i).parent().find('input[type="number"]').type('500', { delay: 60 })
    cy.contains('label', /max usage/i).parent().find('input').type('50', { delay: 60 })

    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon', { timeout: 15000 }).then((interception) => {
      expect(interception.response.body.data.min_order_amount).to.eq(500)
      expect(interception.response.body.data.max_usage).to.eq(50)
    })
  })

  // Max Discount Amount only makes sense for a percentage-off coupon (a flat
  // discount has no "amount" to cap) - the form disables it until
  // Percentage is chosen, labelled "(only for percentage)".
  it('disables Max Discount Amount for Flat and enables it once Percentage is chosen', () => {
    goToNewCouponForm()
    cy.contains('label', /max discount amount/i).parent().find('input').should('be.disabled')

    cy.contains('label', /discount type/i).parent().find('select').select('Percentage')
    cy.wait(300)
    cy.contains('label', /max discount amount/i).parent().find('input').should('be.enabled')
  })

  it('applies max discount amount to a Percentage coupon', () => {
    goToNewCouponForm()
    const code = `MAXDISC${Date.now()}`.slice(0, 15)
    cy.get('input[placeholder*="SAVE20"]').type(code, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Percentage')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('10', { delay: 60 })
    cy.contains('label', /max discount amount/i).parent().find('input[type="number"]').type('200', { delay: 60 })

    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon', { timeout: 15000 }).then((interception) => {
      expect(interception.response.body.data.max_discount_amount).to.eq(200)
    })
  })

  // Valid From/Valid Till are native datetime-local inputs (not a custom
  // calendar widget), so a plain .type() with the "YYYY-MM-DDTHH:mm" format
  // works.
  it('applies valid from and valid till dates to a coupon', () => {
    goToNewCouponForm()
    const code = `DATES${Date.now()}`.slice(0, 15)
    cy.get('input[placeholder*="SAVE20"]').type(code, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Flat')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('15', { delay: 60 })

    cy.contains('label', /valid from/i).parent().find('input').type('2026-08-20T00:00', { delay: 30 })
    cy.contains('label', /valid till/i).parent().find('input').type('2026-12-31T23:59', { delay: 30 })

    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon', { timeout: 15000 }).then((interception) => {
      expect(interception.response.body.data.valid_from).to.not.be.null
      expect(interception.response.body.data.valid_till).to.not.be.null
    })
  })

  it('blocks creating a coupon with no code or discount type filled in', () => {
    goToNewCouponForm()

    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait(1000)

    cy.url().should('include', '/coupons/create')
  })

  it('cancels out of the Create Coupon page back to the list', () => {
    goToNewCouponForm()

    cy.getButtonContaining('cancel').click({ force: true })

    cy.url().should('include', '/admin/catalogue/coupons')
    cy.url().should('not.include', '/create')
  })

  // Plain .type() rather than typeReliably - this search fires a fresh API
  // request on every keystroke with no debounce, and typeReliably's
  // clear-then-retry pattern can interact badly with that (appearing to get
  // "stuck" showing a stale/empty result), even though the underlying
  // search API itself responds correctly to the final query.
  it('shows matching results when searching, and an empty state for no matches', () => {
    fillAndSubmitCoupon({ code: `SEARCH${Date.now()}`.slice(0, 15), discountType: 'Flat', discount: 5 }).then((interception) => {
      cy.wrap(interception.response.body.data.code).as('code')
    })
    cy.wait(1500)

    cy.get('@code').then((code) => {
      cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
      cy.wait(2500)
      cy.contains(code).should('be.visible')

      cy.get('input[placeholder*="Search by coupon"]').clear().type('zzznotfound99', { delay: 100 })
      cy.wait(2500)
      cy.contains(/no coupons found|0 results/i).should('be.visible')
    })
  })

  it('opens the Edit Coupon page with the coupon pre-filled', () => {
    fillAndSubmitCoupon({ code: `EDIT${Date.now()}`.slice(0, 15), discountType: 'Percentage', discount: 12 }).then((interception) => {
      cy.wrap(interception.response.body.data.code).as('code')
    })
    cy.wait(1500)

    cy.get('@code').then((code) => {
      cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
      cy.wait(2500)
      cy.contains('1 result').should('be.visible')

      cy.get('table').parent().scrollTo('right')
      cy.wait(500)
      cy.get('table tbody tr').should('have.length', 1)
      cy.get('table tbody tr').first().find('button').first().click({ force: true })

      // The edit form's pre-fill fetch can be slower than a typical page
      // transition - give it real room rather than a short fixed wait.
      cy.contains('Edit Coupon', { timeout: 10000 }).should('be.visible')
      cy.get('input[placeholder*="SAVE20"]', { timeout: 10000 }).should('have.value', code)
    })
  })

  it('deletes a coupon after confirming, and it disappears from the list', () => {
    fillAndSubmitCoupon({ code: `DEL${Date.now()}`.slice(0, 15), discountType: 'Flat', discount: 8 }).then((interception) => {
      cy.wrap(interception.response.body.data.code).as('code')
    })
    cy.wait(1500)

    cy.get('@code').then((code) => {
      cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
      cy.wait(2500)
      cy.contains('1 result').should('be.visible')

      cy.get('table').parent().scrollTo('right')
      cy.wait(500)
      cy.get('table tbody tr').should('have.length', 1)
      cy.get('table tbody tr').first().within(() => {
        cy.contains(code).should('exist')
        cy.get('button').eq(1).click({ force: true })
      })

      cy.contains(`Are you sure you want to delete "${code}"`).should('be.visible')
      cy.intercept('DELETE', '**/api/v1/admin/coupons/*').as('deleteCoupon')
      cy.contains('button', /^delete$/i).click({ force: true })
      cy.wait('@deleteCoupon', { timeout: 10000 }).then((interception) => {
        expect(interception.response.statusCode).to.eq(200)
      })

      cy.wait(1500)
      cy.contains(/0 results|no coupons found/i).should('be.visible')
    })
  })
})

describe('Coupons page access control', () => {
  it('redirects to /login when visiting coupons while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/catalogue/coupons')

    cy.url().should('include', '/login')
  })
})
