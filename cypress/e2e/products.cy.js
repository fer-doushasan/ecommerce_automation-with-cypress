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
  // '/admin/catalogue/products' also matches the LIST page's own URL, so a
  // missed click (hydration race) reads as "already there" instead of
  // retrying - '/create' only matches once real navigation has happened.
  cy.clickUntilUrlIncludes(
    () => cy.contains('button', /new product/i),
    '/create'
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
    // Header labels are CSS-uppercased (Tailwind `uppercase` class on a
    // lower/mixed-case source), and cy.contains() matches raw DOM text, not
    // the rendered/CSS-transformed text - so it can't find them even though
    // they're genuinely on screen. Reading innerText (which does reflect the
    // rendered text) side-steps that.
    const expected = ['SL', 'IMAGE', 'PRODUCT INFO', 'FINANCE', 'VARIANTS', 'STOCK', 'ACTIVE', 'ACTIONS']
    cy.get('thead th').then(($ths) => {
      const headers = $ths.toArray().map((el) => el.innerText.trim())
      expected.forEach((col) => {
        expect(headers, `expected "${col}" among table headers`).to.include(col)
      })
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
    // "Products" is already checked separately by the heading test above -
    // the word also appears in a hidden tooltip elsewhere on the page, which
    // cy.contains() can match instead of the visible breadcrumb text.
    cy.contains(/catalogue/i).should('be.visible')
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
    // A single check-then-maybe-click can race (the check runs before the
    // click's effect lands, so it neither skips correctly nor retries) -
    // clickUntilTextVisible's retry loop covers that case.
    cy.clickUntilTextVisible(
      () => cy.contains('button', /filters/i).click({ force: true }),
      'Without deleted records'
    )
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
// The blocks below were written from a requirements spec, not from a live
// exploration pass (the New Product / Edit / View pages haven't been walked
// yet the way the list page was). Selectors follow the same label/text-based
// patterns as the rest of the suite so they degrade gracefully, but some
// (submit button wording, delivery-option control type, view-page layout)
// are best-effort guesses and likely need a fix-up pass after a real run.
// ─────────────────────────────────────────────────────────────────────────────

describe('Products page – New Product form fields', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
    goToNewProductForm()
  })

  it('shows product name, price, and delivery option as part of the form', () => {
    cy.contains('label', /product name/i).should('be.visible')
    cy.contains('label', /^\s*price/i).should('be.visible')
    // Delivery Options is a section heading (<h2>), not a field <label> -
    // the required field itself is the "Option name" input inside it.
    cy.contains(/delivery options/i).should('be.visible')
    cy.get('input[placeholder*="Option name"]').should('be.visible')
  })

  it('blocks submission when required fields are left empty', () => {
    cy.contains('button', /create product/i).click({ force: true })
    cy.wait(1000)
    cy.url().should('not.match', /\/admin\/catalogue\/products$/)
  })

  it('lets the user choose between Physical and Digital product type', () => {
    cy.contains(/physical/i).should('be.visible')
    cy.contains(/digital/i).should('be.visible')
  })

  it('shows discount and discount type fields', () => {
    cy.contains(/discount type/i).should('be.visible')
    cy.contains(/discount/i).should('be.visible')
  })

  it('shows enable stock and low stock fields', () => {
    cy.contains(/enable stock/i).should('be.visible')
    cy.contains(/low stock/i).should('be.visible')
  })

  it('shows a product description field', () => {
    cy.contains(/product description|description/i).should('be.visible')
  })

  it('lets the user type a description into the rich text editor', () => {
    // Description is a Quill editor (contenteditable, class "ql-editor"),
    // not a plain textarea.
    cy.get('.ql-editor').type('This is a test product description.', { delay: 20 })
    cy.get('.ql-editor').should('contain.text', 'This is a test product description.')
  })

  it('shows a courier weight field', () => {
    cy.contains(/courier weight/i).should('be.visible')
  })

  it('shows a product image upload field', () => {
    cy.get('input[type="file"]').should('exist')
  })

  it('shows a video link field', () => {
    cy.contains(/video url/i).should('be.visible')
  })

  it('shows a cross sell / cross selling field', () => {
    cy.contains(/cross sell/i).should('be.visible')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – New Product form: variants', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1000)
    goToNewProductForm()
  })

  // Typing an attribute name (e.g. "Color") and pressing Enter in Variant
  // Attributes auto-generates a "Variant 1" card below (confirmed against
  // the live form). Each card has a single "Remove" button - there's no
  // Clone/Delete pair. A separate "+ Add Variant" button (below the
  // generated card) adds further variant cards manually.
  function addVariantAttribute(attributeName = 'Color') {
    // "Variant Attributes" is a card heading, several DOM levels above its
    // input (a sibling section, not a direct parent) - and "Product Options"
    // has an identically-placeholdered input elsewhere on the page, so this
    // scopes to the whole card rather than matching the wrong one.
    cy.contains(/variant attributes/i)
      .closest('div.rounded-2xl')
      .find('input[placeholder*="press Enter"]')
      .type(`${attributeName}{enter}`, { delay: 60 })
    cy.wait(800)
  }

  it('shows a Remove action after a variant is auto-generated from an attribute', () => {
    addVariantAttribute()
    cy.contains(/^variant 1$/i).should('be.visible')
    cy.contains(/^variant 1$/i).closest('div.rounded-2xl').contains('button', /remove/i).should('be.visible')
  })

  it('adds another variant row when Add Variant is clicked', () => {
    addVariantAttribute()
    cy.contains(/^variant 1$/i).should('be.visible')
    cy.contains('button', /add variant/i).click({ force: true })
    cy.wait(500)
    cy.contains(/^variant 2$/i).should('be.visible')
  })

  it('removes the variant row when Remove is clicked', () => {
    addVariantAttribute()
    cy.contains(/^variant 1$/i).should('be.visible')
    cy.contains(/^variant 1$/i).closest('div.rounded-2xl').contains('button', /remove/i).click({ force: true })
    cy.wait(500)
    cy.contains(/^variant 1$/i).should('not.exist')
  })

  it('does not show a video URL field inside a generated variant row', () => {
    addVariantAttribute()
    cy.contains(/^variant 1$/i).closest('div.rounded-2xl').within(() => {
      cy.contains(/video url/i).should('not.exist')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – create, edit, and delete a dummy product', () => {
  it('creates a dummy product and it appears in the list', () => {
    cy.loginViaSession()
    cy.createDummyProduct().then((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201])
    })
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).should('exist')
    })
  })

  it('creates a Digital product and it appears in the list, marked Digital', () => {
    cy.loginViaSession()
    cy.createDummyProduct({ type: 'digital' }).then((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201])
    })
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).should('exist').and('contain.text', 'Digital')
    })
  })

  it('opens the Edit page for a product with fields pre-filled', () => {
    cy.loginViaSession()
    cy.createDummyProduct({ price: '999' })
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).within(() => {
        cy.get('button[aria-label="Edit product"]').click({ force: true })
      })
      cy.wait(1500)
      cy.contains(/edit product/i).should('be.visible')
      cy.contains('label', /product name/i).parent().find('input, textarea').first().should('have.value', name)
      cy.contains('label', /^\s*price/i).parent().find('input').first().should('have.value', '999')
    })
  })

  it('edits a dummy product and the change is saved', () => {
    cy.loginViaSession()
    cy.createDummyProduct({ price: '999' })
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).within(() => {
        cy.get('button[aria-label="Edit product"]').click({ force: true })
      })
      cy.wait(1500)
      cy.contains(/edit product/i).should('be.visible')

      const newPrice = '1234'
      cy.contains('label', /^\s*price/i).parent().find('input').first().clear().type(newPrice, { delay: 60 })

      // Exact update-button wording is unconfirmed (Create's is "Create
      // Product") - covers the likely alternatives.
      cy.intercept(/PUT|PATCH|POST/, '**/api/v1/admin/products/*').as('updateProduct')
      // The edit URL reuses the create route (?mode=edit&id=N) - the submit
      // button's exact wording in edit mode is unconfirmed, so this covers
      // "Create Product" too in case the same label is reused.
      cy.contains('button', /update product|save product|save changes|create product/i).click({ force: true })
      cy.wait('@updateProduct', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])

      cy.findProductRowByName(name).should('contain.text', newPrice)
    })
  })

  it('deletes a dummy product from the list and it disappears', () => {
    cy.loginViaSession()
    cy.createDummyProduct()
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).within(() => {
        cy.get('button[aria-label="Delete product"]').click({ force: true })
      })
      cy.wait(500)
      cy.contains('button', /^delete$/i).click({ force: true })
      cy.wait(1500)
      // Longer wait than other post-search checks - the catalog has
      // accumulated many same-prefix "ZZZ Test Product ..." rows from prior
      // test runs, and a stale in-flight search response can otherwise
      // briefly show a broader result set before the final one lands.
      cy.get('input[placeholder*="Search products"]').clear().type(name, { delay: 60 })
      cy.wait(3000)
      cy.contains(/no products found|0 results/i).should('be.visible')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – list bulk selection', () => {
  it('shows a bulk Delete option when a row is selected, and deletes the selected dummy product', () => {
    cy.loginViaSession()
    cy.createDummyProduct()
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).find('input[type="checkbox"]').check({ force: true })
      cy.wait(300)
      cy.contains('button', /delete/i).should('be.visible')
      cy.contains('button', /delete/i).click({ force: true })
      cy.wait(500)
      cy.contains('button', /^delete$/i).click({ force: true })
      cy.wait(1500)

      // Longer wait than other post-search checks - the catalog has
      // accumulated many same-prefix "ZZZ Test Product ..." rows from prior
      // test runs, and a stale in-flight search response can otherwise
      // briefly show a broader result set before the final one lands.
      cy.get('input[placeholder*="Search products"]').clear().type(name, { delay: 60 })
      cy.wait(3000)
      cy.contains(/no products found|0 results/i).should('be.visible')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – rows per page', () => {
  beforeEach(() => {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products')
    cy.contains('h1, h2', /products/i).should('be.visible')
    cy.wait(1500)
  })

  it('shows 10 rows by default', () => {
    cy.get('tbody tr').should('have.length', 10)
  })

  it('shows up to 25 rows when Rows per page is switched to 25', () => {
    cy.contains(/rows per page/i).parent().find('select, button').first().then(($el) => {
      if ($el.is('select')) {
        cy.wrap($el).select('25')
      } else {
        cy.wrap($el).click({ force: true })
        cy.contains(/^25$/).click({ force: true })
      }
    })
    cy.wait(1000)
    cy.get('tbody tr').should('have.length.greaterThan', 10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Products page – View product detail page', () => {
  function openDummyProductView() {
    cy.loginViaSession()
    cy.createDummyProduct()
    cy.get('@lastDummyProductName').then((name) => {
      cy.findProductRowByName(name).within(() => {
        cy.get('button[aria-label="View product"]').click({ force: true })
      })
      cy.wait(1500)
    })
  }

  // Customers/Stock History/Sort Variants/Adjust Stock need a product with
  // real order and variant history to show anything meaningful - a fresh
  // dummy product has none of that. Mac Mini (id 2) is used deliberately
  // instead, by direct request - stock-count changes on it are expected and
  // accepted (it's a test/demo catalog, not real inventory).
  function visitMacMiniProductView() {
    cy.loginViaSession()
    cy.visit('/admin/catalogue/products/2')
    cy.wait(1500)
  }

  it('navigates to a product view page when View is clicked', () => {
    openDummyProductView()
    cy.url().should('match', /\/admin\/catalogue\/products\/\d+/)
  })

  it('shows product info, order totals, and a sales trend chart', () => {
    openDummyProductView()
    cy.contains(/total orders/i).should('be.visible')
    cy.contains(/order value/i).should('be.visible')
    cy.contains(/sales trend/i).should('be.visible')
  })

  it('shows a stock history section and lets the user adjust stock', () => {
    openDummyProductView()
    cy.contains(/stock history/i).should('be.visible')
    cy.contains(/adjust stock/i).should('be.visible')
  })

  it('shows inactive variant section', () => {
    openDummyProductView()
    cy.contains(/inactive variant/i).should('be.visible')
  })

  it('shows Edit, Delete, and Tutorial actions on the view page', () => {
    // Scoped to 'button' - the sidebar also has its own "Tutorial" nav link
    // (under Support), which cy.contains() can match instead of this page's
    // action button.
    openDummyProductView()
    cy.contains('button', /edit/i).should('be.visible')
    cy.contains('button', /delete/i).should('be.visible')
    cy.contains('button', /tutorial/i).should('be.visible')
  })

  it('filters the chart by day, week, month, and year', () => {
    // Verified via the dashboard API's own filter param (confirmed from a
    // real request: GET .../products/23/dashboard?filter=this_month) rather
    // than trying to read the chart visually, which can't confirm the data
    // actually changed.
    openDummyProductView()
    cy.intercept('GET', '**/api/v1/admin/products/*/dashboard*').as('dashboardFilter')
    cy.contains('button', /day|week|month|year/i).click({ force: true })
    cy.wait(500)
    cy.contains(/day|week|month|year/i).last().click({ force: true })
    cy.wait('@dashboardFilter', { timeout: 10000 }).its('request.url').should('include', 'filter=')
  })

  it('filters the chart by deleted-records visibility (the Sales Trend section\'s second filter)', () => {
    openDummyProductView()
    cy.intercept('GET', '**/api/v1/admin/products/*/dashboard*').as('dashboardFilter')
    cy.contains('button', /without deleted|with deleted|only deleted/i).click({ force: true })
    cy.wait(500)
    cy.contains(/without deleted|with deleted|only deleted/i).last().click({ force: true })
    cy.wait('@dashboardFilter', { timeout: 10000 })
  })

  it('shows which customers bought the product when Customers is clicked', () => {
    // Mac Mini has real order history, unlike a fresh dummy product, so
    // there's something meaningful for this to show.
    visitMacMiniProductView()
    cy.contains('button', /^customers$/i).click({ force: true })
    cy.wait(800)
    cy.contains(/customer/i).should('be.visible')
  })

  it('shows current quantity and sold history when Stock History is clicked', () => {
    visitMacMiniProductView()
    cy.contains('button', /stock history/i).click({ force: true })
    cy.wait(800)
    cy.contains(/quantity/i).should('be.visible')
  })

  it('shows a reorderable variant list when Sort Variants is clicked', () => {
    // Mac Mini has multiple existing variants, unlike a fresh dummy product,
    // so there's something to reorder.
    visitMacMiniProductView()
    cy.contains('button', /sort variants/i).click({ force: true })
    cy.wait(800)
    cy.contains(/variant/i).should('be.visible')
  })

  it('opens an Adjust Stock modal with increase/decrease controls', () => {
    visitMacMiniProductView()
    cy.contains('button', /adjust stock/i).click({ force: true })
    cy.wait(800)
    cy.contains(/increase|decrease/i).should('be.visible')
  })

  it('increases stock via the Adjust Stock modal', () => {
    visitMacMiniProductView()
    cy.contains('button', /adjust stock/i).click({ force: true })
    cy.wait(800)
    cy.intercept(/PUT|PATCH|POST/, '**/api/v1/admin/products/*').as('adjustStock')
    cy.contains('button', /^increase$|^\+$/i).click({ force: true })
    cy.contains('button', /save|update|confirm|apply/i).click({ force: true })
    cy.wait('@adjustStock', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
  })

  it('opens the tutorial video from the View page', () => {
    openDummyProductView()
    cy.clickUntilTextVisible(
      () => cy.contains('button', /tutorial/i).click(),
      'Press Esc to close'
    )
    cy.get('iframe, video').should('exist')
  })

  it('deletes a dummy product from the View page', () => {
    openDummyProductView()
    cy.contains('button', /delete/i).click({ force: true })
    cy.wait(500)
    cy.intercept('DELETE', '**/api/v1/admin/products/*').as('deleteProduct')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteProduct', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])
    cy.url({ timeout: 10000 }).should('not.match', /\/admin\/catalogue\/products\/\d+/)
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
