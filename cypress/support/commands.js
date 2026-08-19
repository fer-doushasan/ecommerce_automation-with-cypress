// This app occasionally drops the first keystroke right after page load
// (the input isn't fully hydrated yet), which silently turns a correct
// value into a wrong one. Typing then re-checking the field's actual value
// (and retrying if it doesn't match) avoids false failures caused by that.
Cypress.Commands.add('typeReliably', (selector, text) => {
  const attempt = (retriesLeft) => {
    cy.get(selector).clear().type(text, { delay: 100 })
    cy.get(selector).invoke('val').then((actual) => {
      if (actual !== text && retriesLeft > 0) {
        attempt(retriesLeft - 1)
      } else {
        expect(actual, `${selector} value`).to.eq(text)
      }
    })
  }
  attempt(3)
})

// Same hydration-timing issue as typing: a click can land before the
// framework has attached its handler, so nothing happens. Re-clicking
// until the expected URL shows up works around that.
Cypress.Commands.add('clickUntilUrlIncludes', (getElement, urlSubstring, retries = 4) => {
  const attempt = (retriesLeft) => {
    getElement().click()
    cy.wait(800)
    cy.url().then((url) => {
      if (!url.includes(urlSubstring) && retriesLeft > 0) {
        attempt(retriesLeft - 1)
      } else {
        expect(url, 'url').to.include(urlSubstring)
      }
    })
  }
  attempt(retries)
})

// cy.contains() picks the "best" DOM match, which is unreliable when several
// elements share overlapping text (e.g. a hidden duplicate, or "Create Order"
// containing "order" like "New order"). Filtering visible clickable elements
// (buttons AND links - this app uses <a> for some "buttons" like Cancel) by
// their own trimmed text is more precise.
Cypress.Commands.add('getButtonContaining', (text) => {
  return cy.get('button:visible, a:visible').then(($els) => {
    return $els.filter((i, el) => el.innerText.trim().toLowerCase().includes(text.toLowerCase()))
  })
})

// The Create Order page lazy-mounts its lower sections (Logistics & Finance,
// Customer Information, etc.) only once they're scrolled into view. A plain
// wait doesn't trigger that; scrolling the page down does.
Cypress.Commands.add('goToCreateOrderPage', () => {
  cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')
  cy.contains('Order Items').should('be.visible')
  cy.scrollTo('bottom')
  cy.wait(1000)
  cy.scrollTo('bottom')
  cy.getButtonContaining('create order').should('be.visible')
})

// A curated subset of the catalogue known to behave well as test fixtures
// (in stock, priced, and either has variants or doesn't in a way the form
// handles cleanly) - the full catalogue includes junk-looking entries (e.g.
// "Test", "2") that aren't reliable to build orders against.
const DUMMY_ORDER_PRODUCTS = ['Macbook M4', 'IMac', 'Mac MINI', 'Pro Book']

// Creates a real order via the UI (product + variant + delivery fee +
// customer info) and lands back on the Orders "All" tab with the new order
// as the first row - useful as a fixture for testing per-order actions
// (status/courier/agent/view/edit/etc.) without depending on seed data.
// The product is picked at random from DUMMY_ORDER_PRODUCTS each call (not
// always the same one) and exposed via the 'lastDummyOrderProduct' alias so
// callers that need to assert on it don't have to hardcode a product name.
Cypress.Commands.add('createDummyOrder', (phone, customerName = 'Action Test Customer') => {
  cy.visit('/admin/orders')
  cy.contains('Orders').should('be.visible')
  cy.wait(1000)
  cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')
  cy.contains('Order Items').should('be.visible')

  // The product <select> starts with only the placeholder option; wait for
  // the real product list to actually populate it instead of guessing a
  // fixed delay (the products API can be slow under load).
  cy.get('select').first().find('option', { timeout: 15000 }).should('have.length.greaterThan', 1)
  const product = DUMMY_ORDER_PRODUCTS[Math.floor(Math.random() * DUMMY_ORDER_PRODUCTS.length)]
  cy.wrap(product).as('lastDummyOrderProduct')
  cy.get('select').first().select(product)
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

  cy.contains('label', /delivery fee/i).parent().find('input').type('50', { delay: 100 })
  cy.typeReliably('input[placeholder="01700000000"]', phone)
  cy.typeReliably('input[placeholder="Customer name"]', customerName)
  cy.get('textarea[placeholder*="delivery address"]').clear().type('Action Test Address', { delay: 50 })

  cy.intercept('POST', '**/api/v1/admin/orders').as('createOrder')
  cy.getButtonContaining('create order').click()
  cy.wait('@createOrder', { timeout: 15000 })
  cy.wait(2000)

  cy.contains('button', /^all$/i).click()
  cy.wait(1500)
  cy.get('table').parent().scrollTo('right')
  cy.wait(500)
})

// The orders list seems to issue a background/repeat fetch independent of
// user actions, so cy.wait('@alias') can pick up that unrelated request
// instead of the one caused by our click, even when the click landed fine.
// Polling all accumulated calls on the alias sidesteps that ordering race.
// `retryClick`, if given, is invoked once partway through if no matching
// request has shown up yet - covers the case where the triggering click
// itself never registered (hydration race), not just network lag.
Cypress.Commands.add('waitForRequestUrlIncluding', (alias, substring, options = {}) => {
  const { retries = 6, retryClick } = options
  const attempt = (retriesLeft) => {
    cy.wait(700)
    cy.get(`@${alias}.all`).then((calls) => {
      const matched = calls.some((c) => c.request.url.includes(substring))
      if (!matched && retriesLeft > 0) {
        if (retryClick && retriesLeft === Math.ceil(retries / 2)) retryClick()
        attempt(retriesLeft - 1)
      } else {
        expect(matched, `a request to @${alias} including "${substring}"`).to.be.true
      }
    })
  }
  attempt(retries)
})

// Generic version of the same pattern: click a toggle, but only re-click if
// the expected text is confirmed still absent - never blindly re-click on a
// timeout, since that can close a dropdown a slower-arriving first click did
// actually manage to open.
Cypress.Commands.add('clickUntilTextVisible', (clickFn, text, retries = 4) => {
  const ensureOpen = (retriesLeft) => {
    cy.get('body').then(($body) => {
      if ($body.text().includes(text)) return
      if (retriesLeft <= 0) return

      clickFn()
      cy.wait(1200)
      ensureOpen(retriesLeft - 1)
    })
  }
  ensureOpen(retries)
  // 'exist' rather than 'be.visible' - a `position: fixed` panel can trip
  // Cypress's visibility heuristic (it thinks an ancestor "overflows" it)
  // even though it's genuinely rendered and usable on screen.
  cy.contains(text, { timeout: 8000 }).should('exist')
})

// Opens the date-range dropdown (button currently showing e.g. "Today").
// The trigger can suffer the same click-before-hydration issue as other
// buttons, so verify it actually opened (via a range only present in the
// open list, e.g. "Last Year") before proceeding. Checks state before each
// click rather than blindly re-clicking on every retry - since the trigger
// is a toggle, an unconditional click on a failed attempt can close what a
// previous attempt had opened.
Cypress.Commands.add('ensureDateDropdownOpen', (retries = 4) => {
  const ensureOpen = (retriesLeft) => {
    cy.get('body').then(($body) => {
      if ($body.text().includes('Last Year')) return
      if (retriesLeft <= 0) return

      cy.contains('button', /today|yesterday|this month|this year|last year/i).click()
      cy.wait(1200)
      ensureOpen(retriesLeft - 1)
    })
  }
  ensureOpen(retries)
})

Cypress.Commands.add('selectDateRange', (rangeLabel) => {
  cy.ensureDateDropdownOpen()
  cy.contains(rangeLabel).click({ force: true })
})

// A `fixed inset-0` backdrop can linger after a dropdown selection and block
// clicks/typing on anything underneath. Clicking the backdrop itself (a
// "click outside" gesture) reliably dismisses it.
Cypress.Commands.add('dismissBackdrop', () => {
  cy.get('body').then(($body) => {
    const $backdrop = $body.find('div.fixed.inset-0')
    if ($backdrop.length > 0) {
      cy.wrap($backdrop.first()).click({ force: true })
      cy.wait(300)
    }
  })
})

// Row-level dropdowns (Courier/Status/Agent) are teleported panels whose
// options are real <button> elements in a `div.fixed.z-50` sibling of the
// backdrop. Clicking via cy.contains(optionText) is unreliable - it can
// land on a text node that doesn't carry the button's click handler.
// Targeting the actual button in the open panel is what works consistently.
Cypress.Commands.add('selectFromRowDropdown', (triggerClickFn, panelHeaderText, optionText) => {
  triggerClickFn()
  cy.contains(panelHeaderText, { timeout: 8000 }).should('exist')
  cy.wait(300)
  cy.get('div.fixed.z-50').contains('button', optionText).click({ force: true })
})

// Creates a minimal dummy product via the New Product form (name, price,
// required stock fields, and the required default Delivery Option row) and
// exposes its name via the 'lastDummyProductName' alias. Used as a throwaway
// fixture for list/view/delete tests so they never touch real catalogue rows
// - the name is timestamped so it's always unique and easy to spot/clean up
// manually.
Cypress.Commands.add('createDummyProduct', ({ name, price = '999', type = 'physical' } = {}) => {
  const productName = name || `ZZZ Test Product ${Date.now()}`

  cy.visit('/admin/catalogue/products')
  cy.contains('h1, h2', /products/i).should('be.visible')
  cy.wait(1000)
  // '/create', not '/admin/catalogue/products' - that substring also matches
  // the list page itself, so a missed click would false-positive as success.
  cy.clickUntilUrlIncludes(() => cy.contains('button', /new product/i), '/create')
  cy.wait(1500)

  if (type === 'digital') {
    cy.contains('button', /digital product/i).click({ force: true })
    cy.wait(500)
  }

  // Digital products label this field "Name" instead of "Product Name".
  cy.contains('label', /^(product )?name/i).parent().find('input, textarea').first().type(productName, { delay: 60 })
  cy.contains('label', /^\s*price/i).parent().find('input').first().type(String(price), { delay: 60 })

  if (type === 'digital') {
    // Digital-only required field - a link to the deliverable.
    cy.contains('label', /product link/i).parent().find('input').first().type('https://example.com/dummy-file', { delay: 60 })
  }

  // Initial Stock / Low Stock Limit / Delivery Options are physical-only -
  // only fill them if this form actually has them.
  cy.get('body').then(($body) => {
    if (/initial stock/i.test($body.text())) {
      cy.contains('label', /initial stock/i).parent().find('input').first().type('10', { delay: 60 })
    }
    if (/low stock limit/i.test($body.text())) {
      cy.contains('label', /low stock limit/i).parent().find('input').first().type('5', { delay: 60 })
    }
    if ($body.find('input[placeholder*="Option name"]').length) {
      // Delivery Options ships with one empty row by default (Option name +
      // price) - it's a required section, not a labeled field, so target
      // the row's inputs directly by placeholder rather than via a <label>.
      cy.get('input[placeholder*="Option name"]').first().type('Inside Dhaka', { delay: 60 })
      cy.get('input[placeholder*="Option name"]').first().closest('div.flex.items-stretch')
        .find('input[type="number"]').first().type('50', { delay: 60 })
    }
  })
  cy.wait(300)

  cy.intercept('POST', '**/api/v1/admin/products').as('createProduct')
  // Non-anchored - the button's text has a leading space from an icon span
  // before it ("<icon/> Create Product"), which breaks a ^-anchored match
  // (same pitfall documented in coupons.cy.js for its labels).
  cy.contains('button', /create product/i).click({ force: true })
  cy.wrap(productName).as('lastDummyProductName')
  return cy.wait('@createProduct', { timeout: 15000 })
})

// Finds a product row by exact name in the (already-loaded) products list -
// searches for it first since a freshly created product isn't guaranteed to
// land on page 1, matching the same search-before-act pattern used for
// coupons.
Cypress.Commands.add('findProductRowByName', (name) => {
  cy.visit('/admin/catalogue/products')
  cy.contains('h1, h2', /products/i).should('be.visible')
  cy.wait(1000)
  cy.get('input[placeholder*="Search products"]').type(name, { delay: 60 })
  cy.wait(1500)
  return cy.contains('tbody tr', name)
})

Cypress.Commands.add('loginViaSession', () => {
  cy.session('validAdminSession', () => {
    cy.visit('/login')
    cy.typeReliably('input[placeholder="email@example.com"]', Cypress.env('loginEmail'))
    cy.typeReliably('input[placeholder="Enter password"]', Cypress.env('loginPassword'))
    cy.contains('button', /log in/i).click()
    cy.url({ timeout: 10000 }).should('not.include', '/login')
  })
})
