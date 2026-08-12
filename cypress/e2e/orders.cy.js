describe('Orders page', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/orders')
    cy.contains('Orders').should('be.visible')
    cy.wait(1000)
  })

  it('loads the orders page', () => {
    cy.contains('h1, h2', /orders/i).should('be.visible')
    cy.contains('Orders').should('be.visible')
  })

  it('shows all order status tabs', () => {
    const tabs = [
      'Pending', 'Followup', 'Confirmed', 'Canceled', 'Ready To Ship',
      'Shipped', 'Hold-by-courier', 'Delivered', 'Payment-received',
      'Returned', 'Unresolved', 'All',
    ]

    tabs.forEach((tab) => {
      cy.contains(tab).should('be.visible')
    })
  })

  // The dummy-order-creation test below adds real orders over time, so this
  // can't assume the shop is empty - it just checks the tab switch works and
  // the results list/empty-state renders without erroring either way.
  it('switches to the All tab and shows results or the empty state', () => {
    cy.contains('button', /^all$/i).click()

    cy.contains(/no orders found|showing \d+.*of \d+ results/i).should('be.visible')
  })

  it('lets the user type in the search box', () => {
    cy.typeReliably('input[placeholder*="Search by order"]', 'ORD-12345')
  })

  it('navigates to the Create Order page', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')

    cy.contains('Create Order').should('be.visible')
  })

  it('shows required fields on the Create Order page', () => {
    cy.goToCreateOrderPage()

    cy.contains('Order Items').should('be.visible')
    cy.contains('Logistics & Finance').should('be.visible')
    cy.contains('Customer Information').should('be.visible')
    cy.get('input[placeholder="01700000000"]').should('be.visible')
    cy.get('input[placeholder="Customer name"]').should('be.visible')
    cy.getButtonContaining('cancel').should('be.visible')
    cy.getButtonContaining('create order').should('be.visible')
  })

  it('blocks creating an order with no items or customer info filled in', () => {
    cy.goToCreateOrderPage()

    cy.getButtonContaining('create order').click()

    cy.url().should('include', '/admin/orders/create')
  })

  it('cancels out of the Create Order page back to the orders list', () => {
    cy.goToCreateOrderPage()

    cy.getButtonContaining('cancel').click()

    cy.url().should('include', '/admin/orders')
    cy.url().should('not.include', '/create')
  })

  // This creates a real order in the shop (status Pending, Cash On Delivery)
  // rather than mocking the API, so it's a true end-to-end check of the
  // create-order flow. The dummy phone/name make it easy to spot and clean
  // up manually from the Orders list afterward.
  it('creates an order with dummy product and customer data', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')
    cy.contains('Order Items').should('be.visible')

    cy.get('select').first().find('option', { timeout: 15000 }).should('have.length.greaterThan', 1)
    cy.get('select').first().select('Macbook M4')
    cy.wait(1500)

    // Some products have a required Variant dropdown that only appears
    // after a product is picked; select the first real option if present.
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
    cy.typeReliably('input[placeholder="01700000000"]', '01711111111')
    cy.typeReliably('input[placeholder="Customer name"]', 'Test Customer')
    cy.get('textarea[placeholder*="delivery address"]').type('123 Test Street, Dhaka', { delay: 50 })

    cy.intercept('POST', '**/api/v1/admin/orders').as('createOrder')
    cy.getButtonContaining('create order').click()

    cy.wait('@createOrder', { timeout: 15000 }).then((interception) => {
      expect(interception.response.statusCode).to.eq(201)
      expect(interception.response.body.success).to.eq(true)
    })

    cy.contains(/order created successfully/i).should('be.visible')
    cy.url().should('include', '/admin/orders')
    cy.url().should('not.include', '/create')
  })
})

describe('Order row actions (on one existing order)', () => {
  // All of these actions run against a single order, one after another,
  // instead of creating a fresh order per action - closer to how a real
  // admin uses the page, and far fewer requests than spinning up 7 orders.
  // Plain JS variable, not a Cypress alias - Cypress resets aliases between
  // tests, but this describe-scoped closure survives across all the `it`s.
  let orderNumber

  before(() => {
    cy.loginViaSession()
    cy.createDummyOrder('01744400001', 'Action Test Customer')

    cy.get('table tbody tr').first().invoke('text').then((text) => {
      orderNumber = text.match(/ORD-\d+-\d+/)[0]
    })
  })

  beforeEach(() => {
    cy.loginViaSession()
  })

  // Re-locates the row by its stable order number rather than "first row",
  // since every action below changes updated_at and re-sorts the list.
  // The search itself is scoped by the active status tab, and changing an
  // order's status silently resets the active tab back to "Pending" - so
  // re-select "All" every time too, or a status change makes the order
  // (now e.g. "Confirmed") invisible under the stale "Pending" filter.
  function getRow() {
    cy.contains('button', /^all$/i).click()
    cy.wait(500)
    cy.typeReliably('input[placeholder*="Search by order"]', orderNumber)
    cy.wait(1000)
    return cy.contains(orderNumber).parents('tr')
  }

  function goToOrdersAllTab() {
    cy.visit('/admin/orders')
    cy.contains('Orders').should('be.visible')
    cy.contains('button', /^all$/i).click()
    cy.wait(1000)
    cy.get('table').parent().scrollTo('right')
    cy.wait(500)
  }

  it('changes the status of the order', () => {
    goToOrdersAllTab()

    getRow().within(() => {
      cy.contains('button', /pending/i).click()
    })
    cy.wait(500)
    cy.contains('Confirmed').click({ force: true })

    cy.contains(/status updated to "confirmed"/i).should('be.visible')
    getRow().within(() => {
      cy.contains('button', /confirmed/i).should('be.visible')
    })
  })

  it('assigns a courier, then reassigns it to a different courier', () => {
    goToOrdersAllTab()

    getRow().within(() => {
      cy.contains('button', /add_courier/i).click()
    })
    cy.wait(500)
    cy.contains('Steadfast').click({ force: true })
    cy.contains(/courier updated to "steadfast"/i).should('be.visible')
    getRow().within(() => {
      cy.contains('button', /steadfast/i).should('be.visible')
    })

    // Reassign to a different courier - the "pick another one" path swaps
    // the dropdown's value straight over, no separate deselect step needed.
    getRow().within(() => {
      cy.contains('button', /steadfast/i).click()
    })
    cy.wait(500)
    cy.contains('Redx').click({ force: true })
    cy.contains(/courier updated to "redx"/i).should('be.visible')
    getRow().within(() => {
      cy.contains('button', /redx/i).should('be.visible')
    })
  })

  it('assigns an agent to the order', () => {
    goToOrdersAllTab()

    getRow().within(() => {
      cy.contains('button', /add_agent/i).click()
    })
    cy.wait(500)
    cy.contains('ferdous').click({ force: true })

    cy.contains(/agent updated to "ferdous"|agent assigned/i).should('be.visible')
    getRow().within(() => {
      cy.contains('button', /ferdous/i).should('be.visible')
    })
  })

  it('opens the order detail page via the View action', () => {
    goToOrdersAllTab()

    getRow().find('button[title="View"]').click({ force: true })

    cy.url().should('match', /\/admin\/orders\/\d+$/)
    cy.contains('Order Details').should('be.visible')
    cy.contains('Action Test Customer').should('be.visible')
  })

  it('opens the edit form via the Edit action', () => {
    goToOrdersAllTab()

    getRow().find('button[title="Edit"]').click({ force: true })

    cy.url().should('include', '/admin/orders/create?mode=edit')
  })

  it('opens the Paid Amount dialog via the Payment Received action', () => {
    goToOrdersAllTab()

    getRow().find('button[title="Payment Received"]').click({ force: true })

    cy.contains('Paid Amount').should('be.visible')
    cy.contains('label, span', /paid amount/i).should('be.visible')

    // getButtonContaining does a substring match, which also catches the
    // "Canceled" status tab in the background - an exact match avoids that.
    cy.get('button:visible, a:visible').then(($els) => {
      const cancelButton = $els.filter((i, el) => el.innerText.trim().toLowerCase() === 'cancel')
      cy.wrap(cancelButton).click()
    })
  })

  // window.print()/browser print dialogs can't be fully verified headlessly;
  // this just confirms the button doesn't throw or navigate away.
  it('clicking Print does not error or navigate away', () => {
    goToOrdersAllTab()

    getRow().find('button[title="Print"]').click({ force: true })
    cy.wait(1000)

    cy.url().should('include', '/admin/orders')
    cy.contains('Orders').should('be.visible')
  })
})

describe('Orders page access control', () => {
  it('redirects to /login when visiting orders while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/orders')

    cy.url().should('include', '/login')
  })
})
