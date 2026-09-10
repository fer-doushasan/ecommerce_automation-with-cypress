// Helpers for the role-permission ENFORCEMENT matrix on v2.
//
// "Role Test" (role id 11) is role@gmail.com's dedicated role. It ships with
// one baseline permission ("dashboard page view"). Each matrix spec adds
// permissions on top of that baseline, logs in as role@gmail.com, and
// asserts what that account can now reach. Every spec's after() hook calls
// cy.restoreRoleTestBaseline() so the role is always left as found.
//
// v2 permission form facts (confirmed by exploration):
//  - direct edit URL below
//  - each permission is a <div class="...cursor-pointer group..."> with a
//    small "w-4 h-4" square child + a direct-child <span> label (lowercased)
//  - CHECKED  => square className contains "bg-primary-500"
//  - a header "N selected" reflects the total; per-group headers show "x/y"
//  - denied page  => app redirects to /no-access?area=<Area>&from=<path>

export const ROLE_TEST_EDIT_URL = '/admin/user-and-roles/roles/create?mode=edit&id=11'
export const ROLE_TEST_BASELINE = ['dashboard page view']

const leafRows = (root) =>
  [...root.querySelectorAll('div.cursor-pointer')].filter((d) => {
    const sq = d.querySelector('div')
    return (
      sq &&
      /(^|\s)w-4(\s|$)/.test(sq.className) &&
      /(^|\s)h-4(\s|$)/.test(sq.className) &&
      d.querySelector(':scope > span') &&
      !d.querySelector('div.cursor-pointer')
    )
  })
const rowLabel = (d) => (d.querySelector(':scope > span')?.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
const rowChecked = (d) => /bg-primary-500/.test(d.querySelector('div')?.className || '')

// --- logins -----------------------------------------------------------------
// The UI login form is slow and Cloudflare-throttled under rapid repeats.
// The app's own auth is just non-httpOnly cookies on v2, so we reproduce it
// with two cy.request calls (~1-2s, no form, no throttle):
//   POST backend/api/login                        -> access_token + user
//   GET  backend/api/v1/admin/user-shop-permission -> permission label list
// then set the 5 auth_* cookies exactly as the app does (URL-encoded).
const BACKEND = 'https://backend.bdfunnelbuilder.com'
const COOKIE_OPTS = { domain: 'v2.bdfunnelbuilder.com', path: '/', secure: true, sameSite: 'lax' }

// cy.request with retry on 5xx (Cloudflare 521/502/503 when the origin is
// slow or briefly down). A full outage still fails, but with a clear message.
function backendRequest(opts, triesLeft = 4) {
  return cy
    .request({ failOnStatusCode: false, timeout: 120000, ...opts })
    .then((res) => {
      if (res.status >= 500 && triesLeft > 0) {
        cy.log(`backend ${res.status} - retrying in 15s (${triesLeft} left)`)
        cy.wait(15000)
        return backendRequest(opts, triesLeft - 1)
      }
      return res
    })
}

Cypress.Commands.add('apiLogin', (email, password) => {
  cy.clearCookies()
  cy.clearLocalStorage()

  backendRequest({ method: 'POST', url: `${BACKEND}/api/login`, body: { email, password } }).then((loginRes) => {
    if (loginRes.status !== 200) {
      throw new Error(
        `apiLogin: backend returned ${loginRes.status} for /api/login (origin may be down - Cloudflare 521). Not a test failure.`
      )
    }
    const data = loginRes.body.data
    const token = data.access_token
    const user = data.user

    backendRequest({
      method: 'GET',
      url: `${BACKEND}/api/v1/admin/user-shop-permission`,
      // the app scopes this to the current shop via a `subdomain` header;
      // without it the backend returns [] and the middleware fails open.
      headers: { Authorization: `Bearer ${token}`, subdomain: user.current_shop_subdomain },
    }).then((permRes) => {
      const permissions = (permRes.body && permRes.body.data && permRes.body.data.permissions) || []

      const authUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        phone: user.phone,
        phone_verified_at: user.phone_verified_at,
        image: user.image,
        is_super_admin: user.is_super_admin,
        roles: user.roles || [],
        current_shop_subdomain: user.current_shop_subdomain,
      }
      const authShops = { shops: user.shops || [], current_shop_id: user.current_shop_id }

      // The admin's near-full permission list (~162 items) blows past the
      // ~4KB cookie limit and Electron rejects it. The admin only needs the
      // client-side middleware to let it reach the role editor and see Save
      // (the real save is authorized by the bearer token, not this cookie),
      // so collapse any near-full list to a curated minimum.
      const permsJson = JSON.stringify(permissions)
      const permsValue =
        permsJson.length > 3000
          ? '["view role","create role","update role","delete role","view user","view product","view order","view customer","view site","view invitation","manage ecommerce"]'
          : permsJson

      cy.setCookie('auth_token', token, COOKIE_OPTS)
      cy.setCookie('auth_token_type', data.token_type || 'bearer', COOKIE_OPTS)
      cy.setCookie('auth_user', encodeURIComponent(JSON.stringify(authUser)), COOKIE_OPTS)
      cy.setCookie('auth_shops', encodeURIComponent(JSON.stringify(authShops)), COOKIE_OPTS)
      cy.setCookie('auth_permissions', encodeURIComponent(permsValue), COOKIE_OPTS)
    })
  })
})

Cypress.Commands.add('freshLoginAdmin', () =>
  cy.apiLogin(Cypress.env('loginEmail'), Cypress.env('loginPassword'))
)
Cypress.Commands.add('freshLoginRoleUser', () =>
  cy.apiLogin(Cypress.env('roleUserEmail'), Cypress.env('roleUserPassword'))
)

// --- role editing (must be logged in as admin) -----------------------------
// Sets "Role Test" to EXACTLY  baseline + extraPermissions  and saves.
Cypress.Commands.add('setRoleTestPermissions', (extraPermissions = []) => {
  const want = new Set([...ROLE_TEST_BASELINE, ...extraPermissions].map((s) => s.toLowerCase()))

  // Open the edit form and wait for the permission list to actually render.
  // Late in a long run the app is slow and the old fixed cy.wait(5000)
  // sometimes started toggling against an empty form ("0"/"NaN selected").
  const openForm = (tries) => {
    cy.visit(ROLE_TEST_EDIT_URL, { failOnStatusCode: false })
    cy.wait(3000)
    cy.get('body').then(($b) => {
      const rows = leafRows($b[0]).length
      const hasCounter = /\d+\s+selected/i.test($b[0].innerText || '')
      if ((rows < 120 || !hasCounter) && tries > 0) {
        cy.wait(4000)
        openForm(tries - 1)
      } else {
        expect(rows, 'permission rows rendered').to.be.greaterThan(120)
      }
    })
  }
  openForm(4)

  cy.get('body').then(($b) => {
    const exp = [...$b[0].querySelectorAll('button')].find((e) => /expand all/i.test(e.textContent))
    if (exp) cy.wrap(exp).click({ force: true })
  })
  cy.wait(1000)

  // Fix one wrong row per pass, re-querying each time (avoids stale refs).
  // A few labels ("view agent", "view sales target", "view order activity
  // log") render as a row in two groups; allow up to 2 clicks per label,
  // then give up on that label (a "mirror" row that follows its twin and
  // can't be toggled on its own) - the counter, which counts unique
  // permissions, is the source of truth.
  const clicks = {}
  const fixNext = (i) => {
    if (i >= 320) throw new Error('setRoleTestPermissions: toggle did not converge')
    cy.get('body').then(($b) => {
      const wrong = leafRows($b[0]).find((d) => {
        const lbl = rowLabel(d)
        return rowChecked(d) !== want.has(lbl) && (clicks[lbl] || 0) < 4
      })
      if (!wrong) return
      const lbl = rowLabel(wrong)
      clicks[lbl] = (clicks[lbl] || 0) + 1
      cy.wrap(wrong).scrollIntoView().click({ force: true })
      cy.wait(400) // let the class toggle re-render before the next scan (avoids a stale double-click)
      fixNext(i + 1)
    })
  }
  fixNext(0)

  cy.get('body').then(($b) => {
    // "N selected" counts unique permissions, so it should equal want.size.
    const n = Number((($b[0].innerText || '').match(/(\d+)\s+selected/i) || [])[1])
    expect(n, `Role Test selected count should be ${want.size}`).to.eq(want.size)
  })
  cy.contains('button', /save changes/i).click({ force: true })
  cy.wait(1500)
  cy.url({ timeout: 15000 }).should('include', '/admin/user-and-roles/roles')
  cy.wait(1500)
})

// admin: set perms  ->  role user: logged in, ready to assert
Cypress.Commands.add('grantRoleTest', (extraPermissions = []) => {
  cy.freshLoginAdmin()
  cy.setRoleTestPermissions(extraPermissions)
  cy.freshLoginRoleUser()
})

// UNCONDITIONAL restore - call from an after() hook in every matrix spec.
Cypress.Commands.add('restoreRoleTestBaseline', () => {
  cy.freshLoginAdmin()
  cy.setRoleTestPermissions([])
})

// --- assertions (run while logged in as role@gmail.com) --------------------
Cypress.Commands.add('assertAreaGranted', (route, headingRe) => {
  cy.visit(route, { failOnStatusCode: false })
  cy.wait(3500)
  cy.url().should('not.include', '/no-access')
  cy.get('body').should('not.contain', "You don't have permission to access")
  cy.get('body').should('not.contain', 'Page not found') // catches a wrong route guess (v2 404)
  // scope to real headings - unscoped cy.contains() can match hidden hover
  // tooltips (fixed, opacity-0) or nav/breadcrumb links with the same word.
  if (headingRe) cy.contains('h1, h2, h3', headingRe, { timeout: 10000 }).should('be.visible')
})

Cypress.Commands.add('assertAreaDenied', (route) => {
  cy.visit(route, { failOnStatusCode: false })
  cy.wait(3500)
  cy.url().should('include', '/no-access')
})

// Record what a route looks like for the current (role@gmail.com) session -
// used once per spec so a wrong route/gate guess is self-documenting.
Cypress.Commands.add('dumpPage', (bag, label, route) => {
  cy.visit(route, { failOnStatusCode: false })
  cy.wait(3500)
  cy.get('body').then(($b) => {
    const href = $b[0].ownerDocument.location.href
    bag.push({
      label,
      route,
      landed: href,
      noAccess: href.includes('/no-access'),
      area: (href.match(/area=([^&]+)/) || [])[1] || null,
      notFound: /Page not found/i.test($b[0].innerText || ''),
      heading: ([...$b[0].querySelectorAll('h1,h2,h3')].map((h) => h.textContent.replace(/\s+/g, ' ').trim())[0]) || null,
      buttons: [...$b[0].querySelectorAll('button,a[href]')]
        .map((e) => ({ t: e.textContent.replace(/\s+/g, ' ').trim().slice(0, 26), a: e.getAttribute('aria-label') }))
        .filter((x) => x.t || x.a)
        .slice(0, 50),
    })
  })
})
