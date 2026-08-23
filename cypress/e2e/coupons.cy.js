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

  it('shows the total results count next to the search box', () => {
    cy.contains(/^\d+ results?$/i).should('be.visible')
  })

  // Confirmed on the live list (not guessed) that expired coupons render
  // their Valid Till in text-red-500/dark:text-red-400 - two real coupons
  // already had this ("WOW50" expired 20 Aug 2026, "oig7867" expired
  // 07 Aug 2026), while unexpired ones use the plain zinc color. This test
  // creates its own past- and future-dated coupons instead of depending on
  // those two, since they're real shop data that could be edited/deleted
  // later. Column index for Valid Till is looked up by header text rather
  // than hardcoded, since the table has 12 columns and reordering would
  // silently break a fixed index.
  it('shows Valid Till in red for an expired coupon, and in the default color for a valid one', () => {
    const expiredCode = `EXPIRED${Date.now()}`.slice(0, 15)
    goToNewCouponForm()
    cy.get('input[placeholder*="SAVE20"]').type(expiredCode, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Flat')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('10', { delay: 60 })
    cy.contains('label', /valid till/i).parent().find('input').type('2026-01-01T00:00', { delay: 30 })
    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon', { timeout: 15000 }).its('response.statusCode').should('eq', 200)
    cy.wait(1500)

    const validCode = `VALID${Date.now()}`.slice(0, 15)
    goToNewCouponForm()
    cy.get('input[placeholder*="SAVE20"]').type(validCode, { delay: 60 })
    cy.contains('label', /discount type/i).parent().find('select').select('Flat')
    cy.wait(300)
    getFieldByExactLabel('Discount *').find('input[type="number"]').first().type('10', { delay: 60 })
    cy.contains('label', /valid till/i).parent().find('input').type('2026-12-31T23:59', { delay: 30 })
    cy.intercept('POST', '**/api/v1/admin/coupons').as('createCoupon2')
    cy.contains('button', /create coupon/i).click({ force: true })
    cy.wait('@createCoupon2', { timeout: 15000 }).its('response.statusCode').should('eq', 200)
    cy.wait(1500)

    cy.contains('th', /valid till/i).invoke('index').then((colIndex) => {
      cy.get('input[placeholder*="Search by coupon"]').type(expiredCode, { delay: 100 })
      cy.wait(2500)
      cy.get('table').parent().scrollTo('right')
      cy.wait(500)
      cy.contains('table tbody tr', expiredCode).find('td').eq(colIndex)
        .find('span').should('have.class', 'text-red-500')

      cy.get('input[placeholder*="Search by coupon"]').clear().type(validCode, { delay: 100 })
      cy.wait(2500)
      cy.get('table').parent().scrollTo('right')
      cy.wait(500)
      cy.contains('table tbody tr', validCode).find('td').eq(colIndex)
        .find('span').should('not.have.class', 'text-red-500')
    })
  })

  // Checked thoroughly (column headers, a dedicated sort control, and a full
  // scan of every "Sort"-like element across all pages of the live list) -
  // there is currently no sorting feature anywhere on this page: no
  // clickable/sortable column headers and no sort dropdown, unlike the
  // Payments page's Total column. Nothing to test until that's built.

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

    // There's no manual sort control on this page (confirmed - see the
    // sorting note further down), but searching rather than assuming page-1
    // placement keeps this test independent of the default ordering.
    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.contains(code).should('be.visible')
  })

  // The default order (no manual sort control exists) is newest-created
  // first - confirmed by dumping 50 rows and seeing this repo's own
  // Date.now()-suffixed test coupon codes in strictly descending order top
  // to bottom. This creates a coupon and checks page 1's first row directly
  // (no search) as direct proof, rather than relying on that earlier dump.
  it('shows a newly created coupon as the first row on page 1', () => {
    const code = `ORDER${Date.now()}`.slice(0, 15)
    fillAndSubmitCoupon({ code, discountType: 'Flat', discount: 5 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })
    cy.contains(/coupon created/i).should('be.visible')
    cy.wait(1500)

    cy.get('table tbody tr').first().should('contain.text', code)
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

  // Applied Count only moves when the coupon is actually used on a real
  // order - Create Order has its own "Coupon Code" text input plus a
  // readonly, auto-calculated "Coupon Discount" field (no separate Apply
  // button - confirmed by dumping that page before writing this). This
  // creates a fresh Global Flat coupon (Applied Count starts at 0), uses it
  // on a real order, and confirms Applied Count becomes 1. Column index for
  // Applied Count is looked up by header text, same reasoning as the
  // Valid-Till-color test above (12 columns, position could shift).
  it('increments Applied Count when a coupon is used on a real order', () => {
    const code = `APPLY${Date.now()}`.slice(0, 15)
    fillAndSubmitCoupon({ code, discountType: 'Flat', discount: 50 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })
    cy.contains(/coupon created/i).should('be.visible')
    cy.wait(1500)

    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
    cy.contains('th', /applied count/i).invoke('index').then((colIndex) => {
      cy.contains('table tbody tr', code).find('td').eq(colIndex).should('have.text', '0')
    })

    cy.visit('/admin/orders')
    cy.wait(1500)
    cy.goToCreateOrderPage()

    // Picking the first raw <option> by value (rather than a known-good
    // product name) landed on one of the many leftover test-fixture
    // products with no price configured - Subtotal stayed ৳0 and the
    // coupon discount had nothing to discount. orders.cy.js already solved
    // this with a curated list of products confirmed to have real
    // price/stock; reusing that same fix here (confirmed via a throwaway
    // diagnostic before writing this - Subtotal ৳40, Coupon Discount ৳40).
    cy.get('select').first().find('option', { timeout: 15000 }).should('have.length.greaterThan', 1)
    cy.get('select').first().select('Macbook M4')
    cy.wait(1500)

    cy.get('select').eq(1).then(($variantSelect) => {
      const options = $variantSelect.find('option').toArray().map((o) => o.textContent.trim())
      if (options.length > 1) {
        cy.wrap($variantSelect).select(options[1])
      }
    })
    cy.wait(500)

    cy.scrollTo('bottom')
    cy.wait(1000)
    cy.scrollTo('bottom')

    cy.contains('label', /^coupon code$/i).parent().find('input').type(code, { delay: 60 }).blur()
    cy.wait(1500)
    cy.contains('label', /^coupon discount$/i).parent().find('input').invoke('val').should((val) => {
      expect(val, 'auto-calculated coupon discount').to.not.be.oneOf(['', '0'])
    })

    cy.contains('label', /delivery fee/i).parent().find('input').type('50', { delay: 100 })
    cy.typeReliably('input[placeholder="01700000000"]', '01722222222')
    cy.typeReliably('input[placeholder="Customer name"]', 'Coupon Test Customer')
    cy.get('textarea[placeholder*="delivery address"]').type('123 Coupon Street, Dhaka', { delay: 50 })

    cy.intercept('POST', '**/api/v1/admin/orders').as('createOrder')
    cy.getButtonContaining('create order').click()
    cy.wait('@createOrder', { timeout: 15000 }).its('response.statusCode').should('eq', 201)
    cy.contains(/order created successfully/i).should('be.visible')

    cy.visit('/admin/catalogue/coupons')
    cy.wait(1500)
    cy.get('input[placeholder*="Search by coupon"]').type(code, { delay: 100 })
    cy.wait(2500)
    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
    cy.contains('th', /applied count/i).invoke('index').then((colIndex) => {
      cy.contains('table tbody tr', code).find('td').eq(colIndex).should('have.text', '1')
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
