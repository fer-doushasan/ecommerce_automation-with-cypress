// Site Builder > Sites (/admin/site-builder/sites). Selectors/endpoints below
// were confirmed via live DOM dumps + network capture (temp explore specs),
// not guessed:
//   - List API: GET /api/v1/admin/sites?page=<n>&per_page=<n>  (host is
//     backend.bdfunnelbuilder.com, so intercepts are host-agnostic globs).
//   - The list <h1> text is literally " Sites " (padded) and the card header
//     is <h2>Sites</h2>; anchored regexes like /^sites$/i do NOT match the
//     padded h1 (Cypress does not trim text for regex matches), so headings
//     are matched here with whitespace-tolerant patterns against 'h1, h2'.
//   - Table columns: Name, Pages, Published, Actions. Per-row controls:
//       button[aria-label="View site"]   (eye)
//       button[aria-label="Edit site"]   (pencil)
//       button[aria-label="Delete site"] (trash)
//       a[aria-label="Visit site"]       (external link, ONLY rendered when
//                                         the site has a domain connected)
//       button.rounded-full              (the Published toggle - the action
//                                         buttons are .rounded-lg, so
//                                         .rounded-full is unique in a row;
//                                         bg-primary-500 = published/on,
//                                         bg-zinc-200 = unpublished/off)
//   - Result text is "<n> results" and "Showing a-b of <n> results".
//   - A <select> filters deleted state (All / Without deleted / Only
//     deleted); a second <select> is rows-per-page (10/25/50).
//   - New Site -> /admin/site-builder/sites/create : single "Site Name *"
//     field (input[placeholder="e.g. My Fashion Store"]), <button>s
//     Back / Cancel / Create Site.
//   - Edit reuses the create route: /admin/site-builder/sites/create?mode=
//     edit&id=<n>, <h1>Edit Site</h1>, same single name field prefilled,
//     <button>s Delete Site / Back / Cancel / Save Changes, plus a "Pages"
//     sub-section with its own list and a "New Page" <button>.
//   - "View site" -> /admin/site-builder/sites/<id> : a read-only detail
//     view. <h1> is the site name; a "Site Information" card shows Published/
//     Unpublished, SITE NAME, DOMAIN ("Not assigned yet" when none), TOTAL
//     PAGES, and a site-level Published toggle. Below it a "Pages" panel
//     (New Page <button>, All/Without deleted/Only deleted filter, columns
//     Name/Path/Published/Actions, "No pages found." empty state). Each page
//     row exposes: a[aria-label="Open in builder"] (-> external builder,
//     _blank), button[aria-label="Duplicate page"], button[aria-label=
//     "Download component JSON"] (can be disabled), a[aria-label="Visit
//     page"] (-> live page, _blank), button[aria-label="Edit page"],
//     button[aria-label="Delete page"], and a per-row .rounded-full Published
//     toggle. NONE of the page-row actions are clicked against macbook here -
//     its pages are real landing pages.
//
// SAFETY: "macbook" (a real published site with a real domain and live
// pages) and "lal shop" are LIVE production data and are never edited,
// toggled, or deleted here. Every mutating test operates only on a
// throwaway site named `ZZZ QA Test Site <timestamp>` that this file
// creates and then deletes. The unconditional after() hook sweeps up any
// leftover `ZZZ QA Test Site*` rows if a test aborts mid-flow (same
// live-data-safety convention as pages.cy.js).

const NAME_INPUT = 'input[placeholder*="Fashion Store"]'
const SITES_HEADING = /^\s*sites\s*$/i
const CANCEL_BTN = /^\s*cancel\s*$/i

function assertListLoaded() {
  cy.contains('h1, h2', SITES_HEADING, { timeout: 15000 }).should('be.visible')
}

function openSitesList() {
  cy.intercept('GET', '**/api/v1/admin/sites**').as('sitesList')
  cy.visit('/admin/site-builder/sites')
  assertListLoaded()
  cy.wait('@sitesList', { timeout: 15000 })
  cy.wait(500)
}

function searchSites(term) {
  cy.get('input[type="search"]').clear().type(term, { delay: 40 })
  cy.wait(1200)
}

function siteRow(name) {
  return cy.contains('tbody tr', name)
}

function openEditFor(name) {
  openSitesList()
  searchSites(name)
  siteRow(name).find('button[aria-label="Edit site"]').click({ force: true })
  cy.contains('h1', /edit site/i, { timeout: 15000 }).should('be.visible')
  cy.url().should('include', 'mode=edit')
  cy.wait(1000)
}

function openViewFor(name) {
  openSitesList()
  searchSites(name)
  cy.clickUntilUrlIncludes(
    () => siteRow(name).find('button[aria-label="View site"]'),
    '/site-builder/sites/'
  )
  cy.url().should('match', /\/admin\/site-builder\/sites\/\d+$/)
  cy.contains(/site information/i, { timeout: 15000 }).should('be.visible')
  cy.wait(1000)
}

function confirmDeleteIfPrompted() {
  cy.wait(600)
  cy.get('body').then(($body) => {
    if (/are you sure|cannot be undone|confirm|delete this site|permanently/i.test($body.text())) {
      cy.contains('button', /^\s*(delete|yes|confirm)/i).click({ force: true })
    }
  })
}

describe('Site Builder - Sites', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
  })

  describe('list', () => {
    beforeEach(openSitesList)

    it('loads with New Site, search, the deleted-state filter, and the table', () => {
      cy.contains('a, button', /new site/i).should('be.visible')
      cy.get('input[type="search"]').should('be.visible')

      cy.contains('th', /name/i).should('be.visible')
      cy.contains('th', /pages/i).should('be.visible')
      cy.contains('th', /published/i).should('be.visible')
      cy.contains('th', /actions/i).should('be.visible')

      cy.contains(/\d+ results?/i).should('be.visible')
      cy.contains(/showing \d+.*of \d+ results?/i).should('be.visible')

      cy.contains(/without deleted/i).should('exist')
      cy.contains(/only deleted/i).should('exist')
    })

    it('shows the real "macbook" site with its domain and page count', () => {
      // Wait for the row (incl. its domain cell) to fully paint, then
      // re-query siteRow() for each check - Vue swaps the <tr> node on
      // re-render, which detaches a .within() subject mid-retry.
      cy.contains('span', 'macbook-shop.bdfunnelbuilder.site').should('be.visible')

      siteRow('macbook').should('be.visible')
      // Live data - assert the Pages cell renders a count, not a fixed
      // number (macbook's page count drifts as pages are added/removed).
      siteRow('macbook').find('td').eq(1).invoke('text').then((t) => expect(t.trim()).to.match(/^\d+$/))
      siteRow('macbook').find('button[aria-label="View site"]').should('be.visible')
      siteRow('macbook').find('button[aria-label="Edit site"]').should('be.visible')
      siteRow('macbook').find('button[aria-label="Delete site"]').should('be.visible')
      siteRow('macbook').find('a[aria-label="Visit site"]')
        .should('have.attr', 'href', 'https://macbook-shop.bdfunnelbuilder.site')
        .and('have.attr', 'target', '_blank')
    })

    it('View site opens the read-only detail view + Pages panel with every page-row action', () => {
      cy.contains('span', 'macbook-shop.bdfunnelbuilder.site').should('be.visible')
      cy.clickUntilUrlIncludes(
        () => siteRow('macbook').find('button[aria-label="View site"]'),
        '/site-builder/sites/'
      )
      cy.url().should('match', /\/admin\/site-builder\/sites\/\d+$/)

      // Site Information card.
      cy.contains('h1', /^\s*macbook\s*$/i).should('be.visible')
      cy.contains(/site information/i).should('be.visible')
      cy.contains('macbook-shop.bdfunnelbuilder.site').should('be.visible')
      cy.contains(/total pages/i).should('be.visible')
      cy.contains(/visible to visitors|hidden from visitors/i).should('be.visible')

      // Pages panel.
      cy.contains(/manage pages for this site/i).should('be.visible')
      cy.contains('button', /new page/i).should('be.visible')
      cy.contains('th', /name/i).should('be.visible')
      cy.contains('th', /path/i).should('be.visible')
      cy.contains('th', /published/i).should('be.visible')
      cy.contains('th', /actions/i).should('be.visible')
      cy.get('table tbody tr').should('have.length.at.least', 1)

      // All six page-row actions render (attributes/visibility only - these
      // are real landing pages, so none of them get clicked).
      cy.get('a[aria-label="Open in builder"]').first()
        .should('have.attr', 'target', '_blank')
        .and('have.attr', 'href').and('match', /\/builder\/\d+\/editor/)
      cy.get('a[aria-label="Visit page"]').first()
        .should('have.attr', 'target', '_blank')
        .and('have.attr', 'href').and('include', 'macbook-shop.bdfunnelbuilder.site/')
      cy.get('button[aria-label="Duplicate page"]').should('have.length.at.least', 1)
      cy.get('button[aria-label="Download component JSON"]').should('have.length.at.least', 1)
      cy.get('button[aria-label="Edit page"]').should('have.length.at.least', 1)
      cy.get('button[aria-label="Delete page"]').should('have.length.at.least', 1)
    })

    it('filters the table via the search box', () => {
      searchSites('macbook')
      siteRow('macbook').should('be.visible')
      cy.get('tbody tr').should('have.length', 1)

      cy.get('input[type="search"]').clear().type('zzz-no-such-site-xyz', { delay: 40 })
      cy.wait(1200)
      cy.contains('tbody tr', 'macbook').should('not.exist')
    })

    it('switches the deleted-state filter without error', () => {
      cy.get('select').then(($sels) => {
        const filter = [...$sels].find((s) => /only deleted/i.test(s.textContent))
        expect(filter, 'a deleted-state filter <select>').to.exist
        cy.wrap(filter).select('Only deleted')
        cy.wait(1500)
        assertListLoaded()
        cy.wrap(filter).select('All')
        cy.wait(1200)
        siteRow('macbook').should('be.visible')
      })
    })
  })

  describe('New Site form', () => {
    it('navigates from the list to the create form', () => {
      openSitesList()
      cy.clickUntilUrlIncludes(() => cy.contains('a, button', /new site/i), '/site-builder/sites/create')
      cy.contains('h1', /add new site/i).should('be.visible')
      cy.contains(/site information/i).should('be.visible')
      cy.contains('label', /site name/i).should('be.visible')
      cy.get(NAME_INPUT).should('be.visible')
      cy.contains('button', /create site/i).should('be.visible')
      cy.contains('button', CANCEL_BTN).should('be.visible')
    })

    it('Cancel returns to the sites list without creating anything', () => {
      cy.visit('/admin/site-builder/sites/create')
      cy.contains('h1', /add new site/i).should('be.visible')
      cy.wait(1000)
      cy.contains('button', CANCEL_BTN).click({ force: true })
      cy.url().should('include', '/site-builder/sites').and('not.include', '/create')
      assertListLoaded()
    })
  })

  describe('site CRUD (throwaway site only - never the live sites)', () => {
    const siteName = `ZZZ QA Test Site ${Date.now()}`

    it('creates a new site via the New Site form', () => {
      openSitesList()
      cy.clickUntilUrlIncludes(() => cy.contains('a, button', /new site/i), '/site-builder/sites/create')
      cy.contains('h1', /add new site/i).should('be.visible')
      cy.wait(800)

      cy.typeReliably(NAME_INPUT, siteName)

      cy.intercept('POST', '**/api/v1/admin/sites**').as('createSite')
      cy.contains('button', /create site/i).click({ force: true })
      cy.wait('@createSite', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])

      openSitesList()
      searchSites(siteName)
      siteRow(siteName).should('be.visible')
      siteRow(siteName).find('td').eq(1).invoke('text').then((t) => expect(t.trim()).to.eq('0'))
    })

    it('View site opens the new site detail view with an empty Pages panel', () => {
      openViewFor(siteName)

      cy.contains('h1', siteName).should('be.visible')
      cy.contains(/site name/i).should('be.visible')
      cy.contains(/not assigned yet/i).should('be.visible') // no domain
      cy.contains(/total pages/i).should('be.visible')

      cy.contains(/manage pages for this site/i).should('be.visible')
      cy.contains('button', /new page/i).should('be.visible')
      cy.contains('th', /path/i).should('be.visible')
      cy.contains(/no pages found/i).should('be.visible')
      cy.get('button[aria-label="Delete page"]').should('not.exist')
    })

    it('opens the new site Edit page with the name prefilled and a Pages section', () => {
      openEditFor(siteName)

      cy.get(NAME_INPUT).should('have.value', siteName)
      cy.contains(/manage pages for this site/i).should('be.visible')
      cy.contains('a, button', /new page/i).should('be.visible')
      cy.contains('button', /save changes/i).should('be.visible')
      cy.contains('button', /delete site/i).should('be.visible')
    })

    it('renames the site, the change persists, then restores the original name', () => {
      const renamed = `${siteName} EDITED`

      openEditFor(siteName)
      cy.typeReliably(NAME_INPUT, renamed)
      cy.contains('button', /save changes/i).click({ force: true })
      cy.wait(2500)

      openSitesList()
      searchSites(renamed)
      siteRow(renamed).should('be.visible')

      // Restore so the delete test + after() hook can match on siteName.
      openEditFor(renamed)
      cy.typeReliably(NAME_INPUT, siteName)
      cy.contains('button', /save changes/i).click({ force: true })
      cy.wait(2500)

      openSitesList()
      searchSites(siteName)
      siteRow(siteName).should('be.visible')
    })

    it('toggles the site Published state on and off', () => {
      openSitesList()
      searchSites(siteName)

      siteRow(siteName).find('button.rounded-full').then(($toggle) => {
        const wasOn = $toggle.hasClass('bg-primary-500')

        siteRow(siteName).find('button.rounded-full').click({ force: true })
        cy.wait(1500)
        siteRow(siteName).find('button.rounded-full')
          .should('have.class', wasOn ? 'bg-zinc-200' : 'bg-primary-500')

        siteRow(siteName).find('button.rounded-full').click({ force: true })
        cy.wait(1500)
        siteRow(siteName).find('button.rounded-full')
          .should('have.class', wasOn ? 'bg-primary-500' : 'bg-zinc-200')
      })
    })

    it('deletes the throwaway site from its row', () => {
      openSitesList()
      searchSites(siteName)

      cy.intercept('DELETE', '**/api/v1/admin/sites/**').as('deleteSite')
      siteRow(siteName).find('button[aria-label="Delete site"]').click({ force: true })
      confirmDeleteIfPrompted()
      cy.wait('@deleteSite', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 204])

      openSitesList()
      searchSites(siteName)
      cy.contains('tbody tr', siteName).should('not.exist')
    })

    // Safety net: runs whether or not the tests above passed. Idempotent -
    // a no-op once the delete test has removed the site.
    after(() => {
      cy.on('uncaught:exception', () => false)
      cy.loginViaSession()
      const sweep = (attemptsLeft) => {
        if (attemptsLeft <= 0) return
        cy.visit('/admin/site-builder/sites')
        cy.contains('h1, h2', SITES_HEADING, { timeout: 15000 }).should('be.visible')
        cy.wait(2000)
        cy.get('input[type="search"]').clear().type('ZZZ QA Test Site', { delay: 30 })
        cy.wait(1500)
        cy.get('body').then(($body) => {
          const $row = $body.find('tbody tr').filter((i, el) => /ZZZ QA Test Site/.test(el.innerText))
          if (!$row.length) return
          cy.wrap($row.first()).find('button[aria-label="Delete site"]').click({ force: true })
          confirmDeleteIfPrompted()
          cy.wait(2000)
          sweep(attemptsLeft - 1)
        })
      }
      sweep(4)
    })
  })
})
