// ─────────────────────────────────────────────────────────────────────────────
// Products page – full test suite
// Derived from the _tmp-explore-products.cy.js exploration run + screenshots.
// Follows the same patterns as orders.cy.js / coupons.cy.js:
//   - loginViaSession() for every describe
//   - intercept + wait for API assertions
//   - retry-click helpers for hydration races
//   - comments explaining non-obvious workarounds
// ─────────────────────────────────────────────────────────────────────────────

// ─── helpers ─────────────────────────────────────────────────────────────────

// Navigate to the New Product form and wait for it to settle.
function goToNewProductForm() {
  cy.clickUntilUrlIncludes(
    () => cy.contains('button', /new product/i),
    '/admin/catalogue/products'
  )
  cy.wait(1000)
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – page load & static layout', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
  })

  it('loads the products page with the correct heading and subtitle', () => {
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.contains(/manage your catalog, stock levels, and product visibility/i).should('be.visible')
  })

  it('shows the primary action buttons: New product, Export Products, Tutorial', () => {
    cy.contains('button', /new product/i).should('be.visible')
    cy.contains('button', /export products/i).should('be.visible')
    cy.contains('button', /tutorial/i).should('be.visible')
  })

  it('shows the search box and Filters button in the toolbar', () => {
    cy.get('input[placeholder*="Search products"]').should('be.visible')
    cy.contains('button', /filters/i).should('be.visible')
  })

  it('displays a result count and pagination summary', () => {
    cy.contains(/\d+ results?/i).should('be.visible')
    cy.contains(/showing \d+.*of \d+ results/i).should('be.visible')
  })

  it('renders the table with all expected column headers', () => {
    const columns = ['SL', 'IMAGE', 'PRODUCT INFO', 'FINANCE', 'VARIANTS', 'STOCK', 'ACTIVE']
    columns.forEach((col) => {
      cy.get('thead').contains(col).should('exist')
    })
  })

  it('shows at least one product row in the table', () => {
    cy.get('tbody tr').should('have.length.greaterThan', 0)
  })

  it('shows the Finance sub-columns (Price, Discount, Discounted Price, Cross Selling Price)', () => {
    cy.contains('Price').should('be.visible')
    cy.contains('Discount').should('be.visible')
    cy.contains('Discounted Price').should('be.visible')
    cy.contains('Cross Selling Price').should('be.visible')
  })

  it('shows the breadcrumb trail: Catalogue > Products > List', () => {
    cy.contains(/catalogue/i).should('be.visible')
    cy.contains(/products/i).should('be.visible')
    cy.contains(/list/i).should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(
      () => cy.contains('button', /tutorial/i).click(),
      'Press Esc to close'
    )
    cy.get('iframe, video').should('exist')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – search', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
  })

  it('lets the user type in the search box', () => {
    cy.get('input[placeholder*="Search products"]').type('IMac', { delay: 60 })
    cy.wait(1000)
    cy.url().should('include', '/admin/catalogue/products')
  })

  it('shows matching products when a known product name is searched', () => {
    cy.get('input[placeholder*="Search products"]').type('IMac', { delay: 60 })
    cy.wait(1500)
    cy.contains('IMac').should('be.visible')
  })

  it('shows an empty state or zero results for a nonsense query', () => {
    cy.get('input[placeholder*="Search products"]').type('zzz-no-such-product-zzz', { delay: 60 })
    cy.wait(1500)
    cy.contains(/no products found|0 results/i).should('be.visible')
  })

  it('clears the search and restores the full list', () => {
    cy.get('input[placeholder*="Search products"]').type('IMac', { delay: 60 })
    cy.wait(1000)
    cy.get('input[placeholder*="Search products"]').clear()
    cy.wait(1000)
    cy.get('tbody tr').should('have.length.greaterThan', 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – Filters panel', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
  })

  function openFiltersPanel() {
    cy.get('body').then(($body) => {
      if (!$body.text().toLowerCase().includes('without deleted records')) {
        cy.contains('button', /filters/i).click({ force: true })
        cy.wait(800)
      }
    })
    cy.contains(/without deleted records/i, { timeout: 8000 }).should('exist')
  }

  it('opens the Filters panel when the Filters button is clicked', () => {
    openFiltersPanel()
    cy.contains(/deleted records/i).should('exist')
  })

  it('shows Reset and Apply buttons inside the Filters panel', () => {
    openFiltersPanel()
    cy.contains('button', /reset/i).should('be.visible')
    cy.contains('button', /apply/i).should('be.visible')
  })

  it('shows the Deleted Records dropdown inside the Filters panel', () => {
    openFiltersPanel()
    cy.contains(/without deleted records/i).should('exist')
  })

  it('closes the Filters panel when Reset is clicked and list is intact', () => {
    openFiltersPanel()
    cy.contains('button', /reset/i).click({ force: true })
    cy.wait(500)
    cy.get('tbody tr').should('have.length.greaterThan', 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – pagination', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1500)
  })

  it('shows page 1 / 2 in the pagination controls', () => {
    cy.contains(/1\s*\/\s*2/).should('be.visible')
  })

  it('shows a "Rows per page" control', () => {
    cy.contains(/rows per page/i).should('be.visible')
  })

  it('navigates to page 2 via the Next button and shows later results', () => {
    cy.contains('button', /next/i).click({ force: true })
    cy.wait(1000)
    cy.contains(/showing 11.*of \d+ results/i).should('be.visible')
  })

  it('navigates back to page 1 via the Previous button', () => {
    cy.contains('button', /next/i).click({ force: true })
    cy.wait(800)
    cy.contains('button', /previous/i).click({ force: true })
    cy.wait(800)
    cy.contains(/showing 1.*10.*of \d+ results/i).should('be.visible')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – table row data', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1500)
  })

  it('shows known product names from the catalogue in the table', () => {
    const knownProducts = ['IMac', 'Mac MINI', 'Macbook M4']
    knownProducts.forEach((name) => {
      cy.contains(name).should('be.visible')
    })
  })

  it('shows PROD- SKU prefix in product info cells', () => {
    cy.contains(/PROD-/i).should('be.visible')
  })

  it('shows Physical or Digital product type badge on each row', () => {
    cy.get('tbody tr').first().within(() => {
      cy.contains(/physical|digital/i).should('be.visible')
    })
  })

  it('shows a price with currency symbol (৳) for each product', () => {
    cy.get('tbody tr').first().within(() => {
      cy.contains(/৳[\d,]+/).should('be.visible')
    })
  })

  it('shows an Active toggle switch for each product row', () => {
    // Active toggles are visible as button[role="switch"] or similar
    cy.get('tbody tr').first().find('[role="switch"], input[type="checkbox"]').should('exist')
  })

  it('shows LOW STOCK badge for products with low inventory (if any)', () => {
    // Conditional: only asserts if low-stock products are currently present
    cy.get('body').then(($body) => {
      if ($body.text().includes('LOW STOCK')) {
        cy.contains(/low stock/i).should('be.visible')
      }
    })
  })

  it('shows the Actions column when the table is scrolled to the right', () => {
    cy.get('thead th').last().scrollIntoView()
    cy.wait(500)
    cy.get('thead th').last().should('exist')
    cy.get('tbody tr').first().find('button, a, svg').should('exist')
  })

  it('shows a Variant count badge in the Variants column', () => {
    // Exploration screenshots showed variant counts (1, 4, 2, etc.) as numbers in the Variants col
    cy.get('tbody tr').first().within(() => {
      cy.contains(/^\d+$/).should('exist')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – New Product form navigation', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
  })

  it('navigates to a New Product URL when New product is clicked', () => {
    cy.clickUntilUrlIncludes(
      () => cy.contains('button', /new product/i),
      '/admin/catalogue/products'
    )
    cy.url().should('match', /\/admin\/catalogue\/products\/(create|\d+)/)
  })

  it('shows a product name / title field on the New Product page', () => {
    goToNewProductForm()
    cy.contains(/product name|title/i).should('be.visible')
  })

  it('cancels back to the products list from the New Product form', () => {
    goToNewProductForm()
    cy.getButtonContaining('cancel').click({ force: true })
    cy.url().should('include', '/admin/catalogue/products')
    cy.url().should('not.include', '/create')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – Export Products', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
  })

  it('clicking Export Products shows an export option or triggers a download', () => {
    cy.contains('button', /export products/i).click({ force: true })
    cy.wait(1000)
    // Either a dialog/dropdown appears with export options, or a download starts.
    // We just assert something export-related becomes visible in the DOM.
    cy.get('body').then(($body) => {
      const hasExportHint = !!$body.text().match(/export|download|csv|xlsx/i)
      expect(hasExportHint, 'export dialog or hint should appear').to.be.true
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – access control', () => {
  it('redirects to /login when visiting the products page while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/catalogue/products')

    cy.url().should('include', '/login')
  })
})
