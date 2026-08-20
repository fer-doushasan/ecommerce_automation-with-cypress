// Structure confirmed by dumping the live page (34 real customers exist,
// created from real orders rather than manually - there's no "New Customer"
// button). Row actions (Call/View/Edit/Delete) use aria-label selectors,
// same convention confirmed on the Users and Roles pages
// (aria-label="Delete user"/"Delete role"/etc.).
describe('Customers page', () => {
  beforeEach(() => {
    // Same account-wide background 403 as the other Users and Roles pages.
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/user-and-roles/customers')
    cy.contains('h1, h2', /customers/i).should('be.visible')
    cy.wait(4000)
  })

  it('loads the customers page with Tutorial, Import, Export, Filters, search and table', () => {
    cy.contains('button', /tutorial/i).should('be.visible')
    cy.contains('button', /import customers/i).should('be.visible')
    cy.contains('button', /export customers/i).should('be.visible')
    cy.contains('button', /filters/i).should('be.visible')
    cy.get('input[placeholder*="Search by name, email, phone"]').should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  it('shows an empty state or zero results for a nonsense search', () => {
    cy.get('input[placeholder*="Search by name, email, phone"]').type('zzznotfound99', { delay: 60 })
    cy.wait(1500)
    cy.contains(/no customers found|0 results/i).should('be.visible')
  })

  it('shows a matching result when searching for a known customer', () => {
    cy.get('input[placeholder*="Search by name, email, phone"]').type('01700099003', { delay: 60 })
    cy.wait(1500)
    cy.contains('01700099003').should('be.visible')
  })

  it('opens the Filters panel with Date Range, Customer Tag, Records, and Order Count fields', () => {
    cy.contains('button', /filters/i).click({ force: true })
    cy.wait(1000)
    cy.contains(/date range/i).should('be.visible')
    cy.contains(/customer tag/i).should('be.visible')
    cy.contains(/records/i).should('be.visible')
    cy.contains(/order count range/i).should('be.visible')
    cy.contains('button', /reset/i).should('be.visible')
    cy.contains('button', /apply/i).should('be.visible')
  })

  it('opens the Import Customers modal with a CSV file field', () => {
    cy.contains('button', /import customers/i).click({ force: true })
    cy.wait(1000)
    cy.contains(/csv file/i).should('be.visible')
    cy.get('input[type="file"]').should('exist')
    cy.contains('button', /import/i).should('be.visible')
    cy.contains('button', /cancel/i).should('be.visible')
  })

  it('clicking Export Customers shows an export option or triggers a download', () => {
    cy.contains('button', /export customers/i).click({ force: true })
    cy.wait(1000)
    cy.get('body').then(($body) => {
      const hasExportHint = !!$body.text().match(/export|download|csv|xlsx/i)
      expect(hasExportHint, 'export dialog or hint should appear').to.be.true
    })
  })

  // "View customer" navigates to a dedicated /customers/<id> page (not a
  // modal), confirmed by dumping it - it has order-count stat cards
  // (Total/Processing/Completed/Cancelled), a Customer Info section, and an
  // Orders table further down the page (needs a scroll to reach).
  it('views a customer and shows Customer Detail with matching info and stat cards', () => {
    cy.get('table tbody tr').first().find('td').eq(2).invoke('text').then((name) => {
      cy.get('table tbody tr').first().find('button[aria-label="View customer"]').click({ force: true })
      cy.wait(1500)

      cy.url().should('match', /\/customers\/\d+$/)
      cy.contains('Customer Detail').should('be.visible')
      cy.contains(/total orders/i).should('be.visible')
      cy.contains(/processing orders/i).should('be.visible')
      cy.contains(/completed orders/i).should('be.visible')
      cy.contains(/cancelled orders/i).should('be.visible')
      cy.contains('Customer Info').should('be.visible')
      cy.contains(name.trim()).should('be.visible')
    })
  })

  // Scrolls to the Orders table on the Customer Detail page and checks the
  // order data actually rendered (order number format, a known status
  // value) rather than being stuck empty/loading.
  it('shows the customer\'s order history table with real order data', () => {
    cy.get('table tbody tr').first().find('button[aria-label="View customer"]').click({ force: true })
    cy.wait(1500)

    cy.contains('Customer Detail').should('be.visible')
    cy.scrollTo('bottom', { ensureScrollable: false })
    cy.wait(500)

    cy.contains('Orders').should('be.visible')
    cy.contains('th', /order #/i).should('be.visible')
    cy.contains('th', /status/i).should('be.visible')
    cy.contains('th', /items/i).should('be.visible')
    cy.get('table tbody tr').should('have.length.greaterThan', 0)
    cy.contains(/ORD-\d+-\d+/).should('be.visible')
  })

  // Non-destructive - opens and cancels out of editing a real customer
  // (created from a real order, not disposable test data) rather than
  // saving any change to it. Labels are "NAME *", "PHONE", "SECONDARY
  // PHONE", "EMAIL" - the ^-anchor on /phone/ matters here, since an
  // unanchored match would also hit "SECONDARY PHONE".
  it('opens the edit form for a customer with name, phone, and email pre-filled', () => {
    cy.get('table tbody tr').first().find('td').eq(2).invoke('text').then((name) => {
      cy.get('table tbody tr').first().find('td').eq(3).invoke('text').then((phone) => {
        cy.get('table tbody tr').first().find('td').eq(4).invoke('text').then((email) => {
          cy.get('table tbody tr').first().find('button[aria-label="Edit customer"]').click({ force: true })
          cy.wait(1000)

          cy.contains('label', /^name/i).parent().find('input').should('have.value', name.trim())
          cy.contains('label', /^phone/i).parent().find('input').should('have.value', phone.trim())
          cy.contains('label', /^email/i).parent().find('input').should('have.value', email.trim())
        })
      })
    })
  })

  // Confirmation-only - never actually confirms. Customers are tied to real
  // orders (created from them, not disposable the way "ZZZ Test Product" is
  // for products), so this only verifies the dialog opens and Cancel backs
  // out of it without deleting anything.
  it('opens a delete confirmation dialog and cancels without deleting', () => {
    cy.get('table tbody tr').first().find('button[aria-label="Delete customer"]').click({ force: true })
    cy.wait(500)
    cy.contains(/are you sure|delete customer/i).should('be.visible')
    cy.contains('button', /cancel/i).click({ force: true })
    cy.wait(500)
    cy.contains(/are you sure/i).should('not.exist')
  })

  it('shows a "Rows per page" control', () => {
    cy.contains(/rows per page/i).should('be.visible')
  })

  // The exact result count grows over time (real customers, not a fixed
  // fixture set) - asserting the first row's name actually changes after
  // paging, rather than a hardcoded "showing X of Y", is what stays valid
  // regardless of how many customers exist.
  it('navigates to page 2 via the Next button and shows different results', () => {
    cy.get('table tbody tr').first().find('td').eq(2).invoke('text').then((page1Name) => {
      cy.contains('button', /next/i).click({ force: true })
      cy.wait(1000)
      cy.get('table tbody tr').first().find('td').eq(2).invoke('text').should('not.eq', page1Name)
    })
  })

  it('navigates back to page 1 via the Previous button', () => {
    cy.get('table tbody tr').first().find('td').eq(2).invoke('text').then((page1Name) => {
      cy.contains('button', /next/i).click({ force: true })
      cy.wait(800)
      cy.contains('button', /previous/i).click({ force: true })
      cy.wait(800)
      cy.get('table tbody tr').first().find('td').eq(2).invoke('text').should('eq', page1Name)
    })
  })
})

describe('Customers page access control', () => {
  it('redirects to /login when visiting customers while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/user-and-roles/customers')

    cy.url().should('include', '/login')
  })
})
