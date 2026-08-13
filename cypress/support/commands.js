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

// Creates a real order via the UI (product + variant + delivery fee +
// customer info) and lands back on the Orders "All" tab with the new order
// as the first row - useful as a fixture for testing per-order actions
// (status/courier/agent/view/edit/etc.) without depending on seed data.
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
  cy.contains(text, { timeout: 4000 }).should('be.visible')
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
      cy.wait(600)
      ensureOpen(retriesLeft - 1)
    })
  }
  ensureOpen(retries)
})

Cypress.Commands.add('selectDateRange', (rangeLabel) => {
  cy.ensureDateDropdownOpen()
  cy.contains(rangeLabel).click({ force: true })
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
