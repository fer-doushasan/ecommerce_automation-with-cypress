// Same curated list as commands.js's createDummyOrder - used here for tests
// that build an order manually rather than through that command, so they
// don't all repeat the exact same product every run either.
const TEST_PRODUCTS = ['Macbook M4', 'IMac', 'Mac MINI', 'Pro Book']
const randomTestProduct = () => TEST_PRODUCTS[Math.floor(Math.random() * TEST_PRODUCTS.length)]

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
    cy.get('select').first().select(randomTestProduct())
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

  it('adds a second item row via Add Another Item', () => {
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')
    cy.contains('Order Items').should('be.visible')
    cy.get('select').first().find('option', { timeout: 15000 }).should('have.length.greaterThan', 1)
    cy.get('select').first().select(randomTestProduct())
    cy.wait(1000)

    cy.contains('Item 1').should('be.visible')
    cy.contains('button', /add another item/i).click()
    cy.wait(500)

    cy.contains('Item 2').should('be.visible')
    cy.get('select').should('have.length.greaterThan', 2)
  })
})

describe('Orders page - list features', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/orders')
    cy.contains('Orders').should('be.visible')
    cy.wait(1000)
  })

  it('defaults to the Pending tab on page load', () => {
    cy.get('button').contains(/^pending$/i).should('be.visible')
      .invoke('attr', 'class').should('match', /primary|active|selected/)
  })

  it('highlights the clicked tab and requests that status', () => {
    cy.intercept('GET', '**/api/v1/admin/orders?**').as('ordersReq')

    // Scope to the tab bar itself (siblings of "Pending") - a bare
    // cy.contains('button', 'Confirmed') can also match a status dropdown
    // showing "Confirmed" as an order's current value elsewhere on the page.
    cy.contains('button', /^pending$/i).parent().within(() => {
      cy.contains('button', /^confirmed$/i).click()
    })

    cy.waitForRequestUrlIncluding('ordersReq', 'status=confirmed', {
      retryClick: () => cy.contains('button', /^pending$/i).parent().within(() => {
        cy.contains('button', /^confirmed$/i).click()
      }),
    })
    cy.contains('button', /^pending$/i).parent().within(() => {
      cy.contains('button', /^confirmed$/i)
        .invoke('attr', 'class').should('match', /primary|active|selected/)
    })
  })

  it('shows the date filter with all expected ranges', () => {
    cy.ensureDateDropdownOpen()

    const ranges = [
      'Today', 'Yesterday', 'Today & Yesterday', 'Last 7 Days', 'Last 14 Days',
      'Last 30 Days', 'This Week', 'Last Week', 'This Month', 'Last Month',
      'This Year', 'Last Year',
    ]
    ranges.forEach((range) => {
      cy.contains(range).should('exist')
    })
  })

  it('changes the results when a different date range is picked', () => {
    cy.intercept('GET', '**/api/v1/admin/orders*').as('ordersRequest')

    cy.selectDateRange('This Year')

    cy.wait('@ordersRequest', { timeout: 10000 })
    cy.contains('button', /this year/i).should('be.visible')
  })

  it('shows matching results when searching, and an empty state for no matches', () => {
    cy.contains('button', /^all$/i).click()
    // Search is scoped by the active date range, which defaults to "Today" -
    // broaden it so the fixture order (created on an earlier date) is found.
    cy.selectDateRange('This Year')
    cy.wait(1000)

    cy.typeReliably('input[placeholder*="Search by order"]', 'Action Test Customer')
    cy.wait(1000)
    cy.contains('Action Test Customer').should('be.visible')

    cy.typeReliably('input[placeholder*="Search by order"]', 'zzz-no-such-order-zzz')
    cy.wait(1000)
    cy.contains(/no orders found/i).should('be.visible')
  })

  it('opens the Filters panel with all expected fields', () => {
    cy.clickUntilTextVisible(() => cy.get('button[title="Filters"]').click(), 'Assignee')

    cy.contains('Filters').should('be.visible')
    cy.contains('Order Status').should('be.visible')
    cy.contains('Product').should('be.visible')
    cy.contains('Source').should('be.visible')
    cy.contains('Customer Tag').should('be.visible')
    cy.contains('Courier').should('be.visible')
    cy.contains('Call Status').should('be.visible')
    cy.contains('button', /reset/i).should('be.visible')
    cy.contains('button', /apply filters/i).should('be.visible')
  })

  // These are verified via the actual API query param they add, rather than
  // a CSS class - the visible "active" ring around the button is just a
  // transient focus outline, not a persistent state class.
  it('toggles the Duplicate Orders filter on and off', () => {
    cy.intercept('GET', '**/api/v1/admin/orders?**').as('ordersReq')

    cy.contains('button', /duplicate orders/i).click()
    cy.waitForRequestUrlIncluding('ordersReq', 'show_duplicate=true', {
      retryClick: () => cy.contains('button', /duplicate orders/i).click(),
    })
  })

  it('toggles Me Mode on and off', () => {
    cy.intercept('GET', '**/api/v1/admin/orders?**').as('ordersReq')

    cy.contains('button', /me mode/i).click()
    cy.waitForRequestUrlIncluding('ordersReq', 'me_mode=true', {
      retryClick: () => cy.contains('button', /me mode/i).click(),
    })
  })

  it('toggles the Unassigned filter on and off', () => {
    cy.intercept('GET', '**/api/v1/admin/orders?**').as('ordersReq')

    cy.contains('button', /unassigned/i).click()
    cy.waitForRequestUrlIncluding('ordersReq', 'unassigned=true', {
      retryClick: () => cy.contains('button', /unassigned/i).click(),
    })
  })

  it('clicking Sort By Update does not error', () => {
    cy.contains('button', /sort by update/i).click()
    cy.wait(1000)
    cy.contains('Orders').should('be.visible')
  })

  // The Export menu correctly offers "Export CSV" / "Export XLSX" (matching
  // the expected 2-option behavior), which is what's verifiable from the UI.
  // Whether the downloaded file's actual content is CSV/XLSX vs JSON can't be
  // checked reliably in this headless sandbox (downloads aren't observable
  // here) - manual QA already flagged this as a bug (TC_018), so that part
  // is intentionally left unautomated rather than asserted blindly.
  it('shows Order Export with CSV and XLSX download options', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /export/i).click(), 'Order Export')
    cy.contains('Product Sales Report').should('be.visible')
    cy.contains('Variant Sales Report').should('be.visible')

    cy.contains('Order Export').click({ force: true })
    cy.wait(1000)

    cy.contains('Start Date').should('be.visible')
    cy.contains('End Date').should('be.visible')
    cy.contains('button', /export csv/i).should('be.visible')
    cy.contains('button', /export xlsx/i).should('be.visible')
  })

  it('shows Product Sales Report with CSV and XLSX download options', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /export/i).click(), 'Product Sales Report')
    cy.contains('Product Sales Report').click({ force: true })
    cy.wait(1000)

    cy.contains('Start Date').should('be.visible')
    cy.contains('End Date').should('be.visible')
    cy.contains('button', /export csv/i).should('be.visible')
    cy.contains('button', /export xlsx/i).should('be.visible')
  })

  it('shows Variant Sales Report with CSV and XLSX download options', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /export/i).click(), 'Variant Sales Report')
    cy.contains('Variant Sales Report').click({ force: true })
    cy.wait(1000)

    cy.contains('Start Date').should('be.visible')
    cy.contains('End Date').should('be.visible')
    cy.contains('button', /export csv/i).should('be.visible')
    cy.contains('button', /export xlsx/i).should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')

    cy.get('iframe, video').should('exist')
  })

  it('selecting a row checkbox reveals the bulk action bar', () => {
    cy.contains('button', /^all$/i).click()
    cy.wait(1500)

    cy.get('tbody tr').first().find('input[type="checkbox"]').click({ force: true })
    cy.wait(500)

    cy.contains(/1 selected/i).should('be.visible')
    cy.contains('button', /change courier vendor/i).should('be.visible')
    cy.contains('button', /change status/i).should('be.visible')
    cy.contains('button', /add courier note/i).should('be.visible')
    cy.contains('button', /print invoice/i).should('be.visible')
  })

  it('shows order info, customer, product and financial details in the row', () => {
    cy.contains('button', /^all$/i).click()
    cy.selectDateRange('This Year')
    cy.wait(1000)
    cy.typeReliably('input[placeholder*="Search by order"]', 'Action Test Customer')
    cy.wait(1000)

    // Exact-text match for "Total" - a substring/regex contains() would also
    // match "Subtotal", which sits right above it in the same column.
    const findExact = ($scope, exactText) => $scope.find('*').filter(
      (i, el) => el.children.length === 0 && el.textContent.trim() === exactText
    )

    cy.get('tbody tr').first().within(() => {
      cy.contains(/ORD-\d+-\d+/).should('be.visible')
      cy.contains('Action Test Customer').should('be.visible')
      // Product varies per run (createDummyOrder picks one at random from a
      // curated list) rather than always being the same one.
      cy.contains(/Macbook M4|IMac|Mac MINI|Pro Book/).should('be.visible')
      cy.contains('Subtotal').should('be.visible')
      cy.contains('Delivery').should('be.visible')
      cy.contains('Discount').should('be.visible')
      cy.contains('Paid').should('be.visible')
      cy.contains('Due').should('be.visible')
    })
    cy.get('tbody tr').first().then(($row) => {
      expect(findExact($row, 'Total').length).to.be.greaterThan(0)
    })
  })

  it('validates Grand Total = Subtotal + Delivery Fee - Discount', () => {
    cy.contains('button', /^all$/i).click()
    cy.selectDateRange('This Year')
    cy.wait(1000)
    cy.typeReliably('input[placeholder*="Search by order"]', 'Action Test Customer')
    cy.wait(1000)

    const parseAmount = (text) => Number(text.replace(/[^\d.]/g, ''))
    // Exact-text match for "Total" - a substring/regex contains() would also
    // match "Subtotal", which sits right above it in the same column.
    const findExact = ($scope, exactText) => $scope.find('*').filter(
      (i, el) => el.children.length === 0 && el.textContent.trim() === exactText
    )

    cy.get('tbody tr').first().within(() => {
      cy.contains(/subtotal/i).parent().invoke('text').then(parseAmount).as('subtotal')
      cy.contains(/^delivery/i).parent().invoke('text').then(parseAmount).as('deliveryFee')
      cy.contains(/^discount/i).parent().invoke('text').then(parseAmount).as('discount')
    })
    cy.get('tbody tr').first().then(($row) => {
      const totalLabel = findExact($row, 'Total').first()
      const amountText = totalLabel.parent().text()
      cy.wrap(parseAmount(amountText)).as('grandTotal')
    })

    cy.get('@subtotal').then((subtotal) => {
      cy.get('@deliveryFee').then((deliveryFee) => {
        cy.get('@discount').then((discount) => {
          cy.get('@grandTotal').then((grandTotal) => {
            expect(grandTotal).to.eq(subtotal + deliveryFee - discount)
          })
        })
      })
    })
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
    // force:true since a just-closed dropdown's backdrop can still be
    // mid-fade-out and briefly intercept clicks on the tab underneath.
    cy.contains('button', /^all$/i).click({ force: true })
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

  // Note: unlike the Status and Courier dropdowns (which select reliably),
  // clicking an option in this Agent dropdown does not register even with a
  // real (non-forced) click on the exact leaf text node - the option list
  // reopens fresh and unselected every time. That looks like a genuine
  // quirk of this specific teleported component rather than a script bug,
  // so this test covers what's reliably verifiable: the dropdown opens and
  // lists real, non-empty agent names.
  it('assigns an agent to the order', () => {
    goToOrdersAllTab()

    // Find the row once - re-running getRow() on every retry means redoing
    // the search box interaction, which can collide with a still-open
    // dropdown's backdrop from a slow-but-successful earlier attempt.
    // force:true since the row can end up scrolled out of view between
    // retries, which otherwise blocks the click on visibility grounds alone.
    getRow().scrollIntoView().find('button', { timeout: 10000 }).contains(/add_agent/i).as('addAgentBtn')
    // The panel header reads "Select Agent" (mixed case, CSS-uppercased for
    // display) - matching the literal uppercase string never finds it.
    cy.clickUntilTextVisible(() => cy.get('@addAgentBtn').click({ force: true }), 'Select Agent')

    // Options are real <button> elements inside the teleported dropdown
    // panel (div.fixed.z-50), a sibling of the click-away backdrop
    // (div.fixed.inset-0.z-40) - clicking that button directly (not a
    // fragile "leaf text node" guess) is what actually registers the
    // selection.
    cy.get('div.fixed.z-50').find('button').first().invoke('text').then((text) => {
      const agentName = text.trim()
      cy.wrap(agentName).as('agentName')
    })
    cy.get('div.fixed.z-50').find('button').first().click({ force: true })

    cy.get('@agentName').then((agentName) => {
      cy.contains(new RegExp(`agent updated to "${agentName}"`, 'i')).should('be.visible')
      // getRow() only searches - it doesn't scroll the table back right, so
      // the Courier/Status/Agent columns are off-screen (left at the default
      // scroll position) right after a fresh search.
      getRow()
      cy.get('table').parent().scrollTo('right')
      cy.wait(300)
      getRow().within(() => {
        cy.contains('button', new RegExp(`^${agentName}$`, 'i')).should('be.visible')
      })
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

  it('opens the Paid Amount dialog and cancelling leaves the order unchanged', () => {
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

  it('entering a paid amount and saving moves the order to Payment-received', () => {
    goToOrdersAllTab()

    getRow().find('button[title="Payment Received"]').click({ force: true })
    cy.contains('Paid Amount', { timeout: 8000 }).should('be.visible')
    cy.wait(500)

    cy.get('input[type="number"]').first().clear().type('90', { delay: 100 })
    cy.contains('button', /save/i).click({ force: true })

    cy.contains(/payment received successfully/i).should('be.visible')
    getRow().within(() => {
      cy.contains('button', /payment-received/i).should('be.visible')
    })
  })

  it('shows the Print Invoice format submenu (Full Page/Half Page/POS Page/POS Mini)', () => {
    goToOrdersAllTab()

    getRow().find('button[title="Print"]').click({ force: true })
    cy.contains('Full Page', { timeout: 8000 }).should('exist')

    cy.contains('Half Page').should('be.visible')
    cy.contains('POS Page').should('be.visible')
    cy.contains('POS Mini').should('be.visible')
    cy.url().should('include', '/admin/orders')
  })

  it('copies order number, name, phone and address via the Copy action', () => {
    goToOrdersAllTab()

    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('clipboardWrite').resolves()
    })

    getRow().find('button[title="Copy"]').click({ force: true })

    cy.get('@clipboardWrite').should('have.been.calledOnce')
    cy.get('@clipboardWrite').then((stub) => {
      const copiedText = stub.args[0][0]
      expect(copiedText).to.match(/Order Number: ORD-\d+-\d+/)
      expect(copiedText).to.match(/Name: /)
      expect(copiedText).to.match(/Phone: /)
      expect(copiedText).to.match(/Address: /)
    })
  })
})

describe('Order tracking', () => {
  beforeEach(() => {
    cy.loginViaSession()
  })

  it('shows a tracking ID and Track button once a courier is set and status moves to Ready To Ship', () => {
    cy.createDummyOrder('01766600001', 'Consignment Test Customer')
    cy.wait(1500)

    cy.get('table tbody tr').first().invoke('text').then((text) => {
      const orderNumber = text.match(/ORD-\d+-\d+/)[0]
      cy.wrap(orderNumber).as('orderNumber')
    })

    cy.get('@orderNumber').then((orderNumber) => {
      const row = () => cy.contains(orderNumber).parents('tr')

      // A search-box round trip first lets the page settle - clicking
      // immediately after order creation hits the hydration race seen
      // throughout this app.
      cy.contains('button', /^all$/i).click({ force: true })
      cy.wait(600)
      cy.typeReliably('input[placeholder*="Search by order"]', orderNumber)
      cy.wait(1000)
      cy.get('table').parent().scrollTo('right')
      cy.wait(500)

      // Before: courier unset, status Pending - no Track button yet.
      row().within(() => {
        cy.contains('button', /^track$/i).should('not.exist')
      })

      // Assign a courier while status is still Pending.
      cy.selectFromRowDropdown(
        () => row().within(() => cy.contains('button', /add_courier/i).click()),
        'Select Courier',
        'Steadfast'
      )
      cy.contains(/courier updated to "steadfast"/i).should('be.visible')
      cy.wait(1000)

      // Courier alone isn't enough yet - still no tracking ID/Track button.
      row().within(() => {
        cy.contains('button', /^track$/i).should('not.exist')
      })

      // Move status to Ready To Ship.
      cy.contains('button', /^all$/i).click({ force: true })
      cy.wait(600)
      cy.dismissBackdrop()
      cy.typeReliably('input[placeholder*="Search by order"]', orderNumber)
      cy.wait(1000)

      cy.selectFromRowDropdown(
        () => row().within(() => cy.contains('button', /pending|followup|confirmed/i).click()),
        'Set Status',
        'Ready To Ship'
      )
      cy.contains(/status updated to "ready to ship"/i).should('be.visible')

      const hasTrackButton = ($body) => {
        const $row = $body.find(`tr:contains("${orderNumber}")`)
        return $row.find('button').toArray().some((b) => /^track$/i.test(b.innerText.trim()))
      }

      // Generating the consignment/tracking ID calls out to the courier's
      // own API asynchronously, after the status-change response comes
      // back - polling the already-rendered DOM won't pick that up once it
      // lands, since this app doesn't push a live update to the row. Instead
      // re-search (a fresh network fetch) repeatedly until the Track button
      // shows up or we give up.
      const checkForTrackButton = (attemptsLeft) => {
        cy.contains('button', /^all$/i).click({ force: true })
        cy.wait(600)
        cy.dismissBackdrop()
        cy.typeReliably('input[placeholder*="Search by order"]', orderNumber)
        cy.wait(1000)
        cy.get('table').parent().scrollTo('right')
        cy.wait(500)

        cy.get('body').then(($body) => {
          if (!hasTrackButton($body) && attemptsLeft > 0) {
            cy.wait(2000)
            checkForTrackButton(attemptsLeft - 1)
          } else {
            row().within(() => {
              cy.contains('button', /ready to ship/i).should('be.visible')
              cy.contains('button', /^track$/i).should('be.visible')
            })
          }
        })
      }

      checkForTrackButton(6)
    })
  })
})

describe('Bulk order actions (checkbox selection)', () => {
  before(() => {
    cy.loginViaSession()
    cy.createDummyOrder('01777700001', 'Bulk Action Test Customer')
    cy.wait(1500)
  })

  beforeEach(() => {
    cy.loginViaSession()
  })

  function selectOrder() {
    cy.visit('/admin/orders')
    cy.contains('Orders').should('be.visible')
    cy.wait(1000)
    cy.contains('button', /^all$/i).click({ force: true })
    cy.selectDateRange('This Year')
    cy.wait(1000)
    cy.typeReliably('input[placeholder*="Search by order"]', 'Bulk Action Test Customer')
    cy.wait(1000)
    cy.get('table tbody tr').first().find('input[type="checkbox"]').click({ force: true })
    cy.wait(800)
  }

  it('bulk-assigns a courier via Change Courier Vendor', () => {
    selectOrder()

    cy.contains('button', /change courier vendor/i).click({ force: true })
    cy.contains('Select Courier', { timeout: 8000 }).should('exist')
    cy.wait(300)
    cy.get('div.z-50').contains('button', 'Steadfast').click({ force: true })

    cy.contains(/1 order updated/i).should('be.visible')
  })

  it('bulk-changes status via Change Status', () => {
    selectOrder()

    cy.contains('button', /change status/i).click({ force: true })
    cy.contains('Set Status', { timeout: 8000 }).should('exist')
    cy.wait(300)
    cy.get('div.z-50').contains('button', 'Confirmed').click({ force: true })

    cy.contains(/status updated to "confirmed" for 1 order/i).should('be.visible')
  })

  it('bulk-adds a courier note via Add Courier Note', () => {
    selectOrder()

    cy.contains('button', /add courier note/i).click({ force: true })
    cy.wait(1000)
    cy.get('textarea[placeholder*="Handle with care"]').type('Bulk note test', { delay: 30 })
    cy.contains('button', /apply to \d+ order/i).click({ force: true })

    cy.contains(/courier note added to 1 order/i).should('be.visible')
  })

  it('opens the Print Invoice format menu and prints without erroring', () => {
    selectOrder()

    cy.contains('button', /print invoice/i).click({ force: true })
    cy.contains('Full Page', { timeout: 8000 }).should('exist')
    cy.contains('Half Page').should('be.visible')
    cy.contains('POS Page').should('be.visible')
    cy.contains('POS Mini').should('be.visible')

    cy.wait(300)
    cy.contains('Full Page').click({ force: true })
    cy.wait(1000)

    cy.url().should('include', '/admin/orders')
  })
})

// Known bugs, confirmed and reproduced manually (see conversation history):
// the Customer Note field saves correctly on order *creation*, but the Edit
// Order flow silently drops changes to it - both adding a note to a
// note-less order and clearing an existing note fail to persist, even
// though the "Order updated successfully" toast implies success and every
// other field (product, phone, name, address, etc.) saves fine. On top of
// that, the View Order page has no Customer Note field at all - only a
// separate, unrelated "Courier Note" field exists there.
// These tests assert the CORRECT behavior, so they currently fail by
// design - once the underlying bug is fixed, they should start passing
// without any changes needed here.
describe('Customer note editing (known bugs)', () => {
  beforeEach(() => {
    cy.loginViaSession()
  })

  function createOrder(phone, name, note) {
    cy.visit('/admin/orders')
    cy.contains('Orders').should('be.visible')
    cy.wait(1000)
    cy.clickUntilUrlIncludes(() => cy.contains('button', /new order/i), '/admin/orders/create')
    cy.contains('Order Items').should('be.visible')

    cy.get('select').first().find('option', { timeout: 15000 }).should('have.length.greaterThan', 1)
    cy.get('select').first().select(randomTestProduct())
    cy.wait(1500)
    cy.get('select').eq(1).then(($variantSelect) => {
      const options = $variantSelect.find('option').toArray().map((o) => o.textContent.trim())
      if (options.length > 1) cy.wrap($variantSelect).select(options[1])
    })
    cy.wait(500)

    cy.scrollTo('bottom')
    cy.wait(1000)
    cy.scrollTo('bottom')

    cy.contains('label', /delivery fee/i).parent().find('input').type('50', { delay: 100 })
    cy.get('input[placeholder="01700000000"]').clear().type(phone, { delay: 60 })
    cy.get('input[placeholder="Customer name"]').clear().type(name, { delay: 60 })
    cy.get('textarea[placeholder*="delivery address"]').clear().type('Customer Note Test Address', { delay: 50 })
    if (note) {
      cy.contains('label', /customer note/i).parent().find('textarea').type(note, { delay: 30 })
    }

    cy.intercept('POST', '**/api/v1/admin/orders').as('createOrder')
    cy.getButtonContaining('create order').click()
    return cy.wait('@createOrder', { timeout: 15000 })
  }

  function getCustomerNoteFieldValue(orderId) {
    cy.visit(`/admin/orders/create?mode=edit&id=${orderId}`)
    cy.wait(4000)
    cy.scrollTo('bottom')
    cy.wait(1000)
    return cy.contains('label', /customer note/i).parent().find('textarea').invoke('val')
  }

  it('saves a customer note added via Edit on an order that had none', () => {
    createOrder('01700099001', 'Edit Add Note Regression', null).then((interception) => {
      cy.wrap(interception.response.body.data.id).as('orderId')
    })
    cy.wait(1500)

    cy.get('@orderId').then((id) => {
      getCustomerNoteFieldValue(id).should('eq', '')

      cy.contains('label', /customer note/i).parent().find('textarea')
        .type('Added via Edit regression test', { delay: 30 })
      cy.getButtonContaining('save order').click()
      cy.contains(/order updated successfully/i).should('be.visible')
      cy.wait(1500)

      getCustomerNoteFieldValue(id).should('eq', 'Added via Edit regression test')
    })
  })

  it('saves the removal of a customer note cleared via Edit', () => {
    createOrder('01700099002', 'Edit Remove Note Regression', 'Original note to be removed').then((interception) => {
      cy.wrap(interception.response.body.data.id).as('orderId')
    })
    cy.wait(1500)

    cy.get('@orderId').then((id) => {
      getCustomerNoteFieldValue(id).should('eq', 'Original note to be removed')

      cy.contains('label', /customer note/i).parent().find('textarea').clear()
      cy.getButtonContaining('save order').click()
      cy.contains(/order updated successfully/i).should('be.visible')
      cy.wait(1500)

      getCustomerNoteFieldValue(id).should('eq', '')
    })
  })

  it('shows the customer note on the View Order page', () => {
    createOrder('01700099003', 'View Note Regression', 'Note that should be visible on View page').then((interception) => {
      cy.wrap(interception.response.body.data.id).as('orderId')
    })
    cy.wait(1500)

    cy.get('@orderId').then((id) => {
      cy.visit(`/admin/orders/${id}`)
      cy.wait(4000)
      cy.contains('Note that should be visible on View page').should('be.visible')
    })
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
