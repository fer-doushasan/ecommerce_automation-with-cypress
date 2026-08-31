// Call Center addon (/admin/addons/call-center) is one page with 5 tabs
// switched via a `?tab=` query param when clicked (confirmed by clicking
// through and reading the resulting URLs, not guessed) - but see the second
// comment block below: that URL is not reliably visitable directly.
//   (default, labeled "Call Center Addon Purchase" in the tab bar) - Team
//     Management: Active status, Current Agents/Limit/Expiry stats, Add
//     Agents (৳2,000/agent) and Renew (৳4,000/month) billing CTAs, plus a
//     static "Advanced Call Center Features" marketing block.
//   Configure Vendor - real vendor telephony config (ManyDial), read-only
//     display + an Edit Vendor action.
//   Balance Purchase - Current Balance/Call Rate + a Recharge form
//     (Amount input, 100/200/300/500 TK quick-select, Proceed to Payment).
//   Call Center History - a call log table with filters, empty on this
//     account.
//   Call Center Agents - existing assigned agents (User + Nick Name), with
//     an Add Agent modal (pick an existing user, set a nickname) and a
//     per-row Delete action.
//
// SCOPE NOTE: Add Agents and Renew are deliberately NOT exercised as real
// clicks here. A single click on Add Agents during exploration did redirect
// to the real SSLCommerz sandbox and created a genuine ৳4,000 Pending
// transaction (SP-0EMPFXPB4HFY, confirmed via the Payments page) - but three
// subsequent attempts produced no redirect at all with no visible error,
// even after an 8s wait (ruled out as a timing issue). Since each working
// click appears to create a new real transaction record rather than being
// idempotent, retry-clicking it (this repo's usual fix for hydration
// flakiness) risks stacking up pending transactions instead of just
// re-attempting a UI action - so these two are covered as visibility-only
// checks. Recharge (Balance Purchase) does NOT have this problem - it has a
// normal on-page form and only redirects once you explicitly submit it - so
// it gets the full real-payment treatment via the SSLCommerz sandbox, same
// pattern as subscription.cy.js.
//
// A first pass at this file navigated tabs via cy.visit() straight to their
// `?tab=` URL and failed repeatedly on Configure Vendor/Balance Purchase
// with "content never found", even with network confirmed stable and a
// "Loading…" skeleton guard in place. Root cause: those two tabs only fetch
// their data on a client-side route change (i.e. when the tab link is
// actually clicked) - a hard cy.visit() straight to the URL with `?tab=`
// already set shows the right tab shell but never fires that fetch. Every
// exploration run that worked used click-based tab switching, never a
// direct visit - this is that same pattern made permanent. Team Management
// is the one exception, since it's the page's own default/landing tab and
// needs no click to load.
function goToCallCenter() {
  cy.visit('/admin/addons/call-center')
  cy.contains('h1, h2', /^call center$/i).should('be.visible')
  cy.wait(1500)
  cy.contains(/loading/i).should('not.exist')
  cy.wait(500)
}

// `waitForText`, when given, is a signature piece of that tab's real
// content, retried via cy.clickUntilTextVisible.
//
// KNOWN LIMITATION - Configure Vendor / Balance Purchase: these two tabs'
// key fields (Outbound Caller ID, the balance figure, the 100/200/300/500
// TK quick-select buttons) are unreliable specifically under Cypress, even
// with this retry-click wait (6 retries) and even with the tab's own
// heading already visible. Manually confirmed in a real browser (opened
// repeatedly, outside Cypress) that the data loads correctly every time -
// so this is not an app bug and not something these tests can fix by
// waiting differently. Best guess from a network-call capture taken while
// diagnosing this: these fields may arrive over a websocket/broadcast
// channel (repeated POST /api/broadcasting/auth calls were seen per tab
// visit) rather than the plain REST response most of this app's data uses,
// and Cypress's browser is known to handle that unreliably in some setups.
// These two tabs' tests are left in place, accepting they may fail/flake
// under Cypress specifically - re-run them individually if in doubt, rather
// than trusting a red result here as evidence of a real regression.
function clickTab(label, waitForText) {
  cy.contains(/loading/i).should('not.exist')
  if (waitForText) {
    cy.clickUntilTextVisible(
      () => cy.contains('button, a', label).click({ force: true }),
      waitForText,
      6
    )
  } else {
    cy.contains('button, a', label).click({ force: true })
    cy.wait(1000)
    cy.contains(/loading/i).should('not.exist')
  }
  cy.wait(300)
}

describe('Call Center addon', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
  })

  describe('Team Management tab', () => {
    beforeEach(() => {
      goToCallCenter()
    })

    it('shows the Active status and current agent/limit/expiry stats', () => {
      cy.contains('span', /active/i).should('be.visible')
      cy.contains(/call center team management/i).should('be.visible')
      cy.contains(/current agents/i).should('be.visible')
      cy.contains(/agent's limit/i).should('be.visible')
      cy.contains(/expiry date/i).should('be.visible')
    })

    // Add Agents/Renew are visible and priced correctly, but never clicked -
    // see the file-level SCOPE NOTE for why.
    it('shows the Add Agents and Renew billing options with correct pricing, without submitting either', () => {
      cy.contains(/add more agents/i).should('be.visible')
      cy.contains(/2,000/).should('be.visible')
      cy.contains('button', /add agents/i).should('be.visible').and('not.be.disabled')

      cy.contains(/renew access/i).should('be.visible')
      cy.contains(/4,000/).should('be.visible')
      cy.get('button[aria-label="Renew"]').should('be.visible')
    })

    it('lists the Advanced Call Center Features', () => {
      cy.contains(/advanced call center features/i).should('be.visible')
      cy.contains(/call queue management/i).should('be.visible')
      cy.contains(/call back scheduling/i).should('be.visible')
      cy.contains(/vip caller tagging/i).should('be.visible')
      cy.contains(/agent status/i).should('be.visible')
      cy.contains(/call transfer/i).should('be.visible')
      cy.contains(/live call monitoring/i).should('be.visible')
    })
  })

  describe('Configure Vendor tab', () => {
    beforeEach(() => {
      goToCallCenter()
      clickTab('Configure Vendor', 'Outbound Caller ID')
    })

    // Read-only - Edit Vendor is visible but never clicked, since it's live
    // telephony routing config for the real account.
    it('shows the vendor configuration read-only', () => {
      cy.contains(/vendor configuration/i).should('be.visible')
      cy.contains('span', /active/i).should('be.visible')
      cy.contains(/configured on/i).should('be.visible')
      cy.contains(/outbound caller id/i).should('be.visible')
      cy.contains(/approved/i).should('be.visible')
      cy.contains(/last updated/i).should('be.visible')
      cy.contains('button, a', /edit vendor/i).should('be.visible')
    })
  })

  describe('Balance Purchase tab', () => {
    beforeEach(() => {
      goToCallCenter()
      clickTab('Balance Purchase', '100 TK')
    })

    it('shows the current balance, call rate, and recharge form', () => {
      cy.contains(/current balance/i).should('be.visible')
      cy.contains(/your current balance is/i).should('be.visible')
      cy.contains(/call rate/i).should('be.visible')
      cy.contains(/recharge your balance/i).should('be.visible')
      cy.get('input[type="number"][placeholder*="Minimum"]').should('be.visible')
      cy.contains('button', /^100 tk$/i).should('be.visible')
      cy.contains('button', /^200 tk$/i).should('be.visible')
      cy.contains('button', /^300 tk$/i).should('be.visible')
      cy.contains('button', /^500 tk$/i).should('be.visible')
      cy.contains('button', /proceed to payment/i).should('be.visible')
    })

    it('fills the amount via a quick-select button', () => {
      cy.contains('button', /^100 tk$/i).click({ force: true })
      cy.get('input[type="number"][placeholder*="Minimum"]').should('have.value', '100')
    })

    // Real SSLCommerz sandbox recharge - same Mobile Banking -> bKash ->
    // Success/Failed flow as subscription.cy.js. Uses the smallest
    // quick-select (100 TK) to keep each real run's balance increase small.
    it('recharges the balance via SSLCommerz sandbox and the balance increases', () => {
      cy.contains(/your current balance is (\d[\d,]*) tk/i).invoke('text').then((beforeText) => {
        const before = parseInt(beforeText.replace(/[^\d]/g, ''), 10)

        cy.contains('button', /^100 tk$/i).click({ force: true })
        cy.get('input[type="number"][placeholder*="Minimum"]').should('have.value', '100')
        cy.contains('button', /proceed to payment/i).click({ force: true })

        cy.url({ timeout: 15000 }).should('include', 'sslcommerz.com')
        cy.origin('https://sandbox.sslcommerz.com', () => {
          cy.on('uncaught:exception', () => false)
          cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
          cy.wait(1000)
          cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
          cy.wait(2000)
          cy.get('input[value="Success"]', { timeout: 10000 }).should('be.visible').click()
        })

        cy.on('uncaught:exception', () => false)
        cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')
        cy.wait(2000)

        cy.loginViaSession()
        goToCallCenter()
        clickTab('Balance Purchase', '100 TK')

        cy.contains(/your current balance is (\d[\d,]*) tk/i, { timeout: 20000 }).invoke('text').should((afterText) => {
          const after = parseInt(afterText.replace(/[^\d]/g, ''), 10)
          expect(after, 'balance after successful recharge').to.eq(before + 100)
        })
      })
    })

    it('records a failed recharge and leaves the balance unchanged', () => {
      cy.contains(/your current balance is (\d[\d,]*) tk/i).invoke('text').then((beforeText) => {
        const before = parseInt(beforeText.replace(/[^\d]/g, ''), 10)

        cy.contains('button', /^100 tk$/i).click({ force: true })
        cy.contains('button', /proceed to payment/i).click({ force: true })

        cy.url({ timeout: 15000 }).should('include', 'sslcommerz.com')
        cy.origin('https://sandbox.sslcommerz.com', () => {
          cy.on('uncaught:exception', () => false)
          cy.contains(/mobile banking/i, { timeout: 15000 }).click({ force: true })
          cy.wait(1000)
          cy.get('img[alt*="kash" i], img[src*="kash" i]', { timeout: 10000 }).first().click({ force: true })
          cy.wait(2000)
          cy.get('input[value="Failed"]:visible', { timeout: 10000 }).first().click({ force: true })
        })

        cy.on('uncaught:exception', () => false)
        cy.url({ timeout: 20000 }).should('include', 'frontend-bdfunnelbuilder.vercel.app')
        cy.wait(2000)

        cy.loginViaSession()
        goToCallCenter()
        clickTab('Balance Purchase', '100 TK')

        cy.contains(/your current balance is (\d[\d,]*) tk/i, { timeout: 20000 }).invoke('text').should((afterText) => {
          const after = parseInt(afterText.replace(/[^\d]/g, ''), 10)
          expect(after, 'balance after failed recharge').to.eq(before)
        })
      })
    })
  })

  describe('Call Center History tab', () => {
    it('shows the call history table with filters', () => {
      goToCallCenter()
      clickTab('Call Center History', 'Call History')
      cy.contains(/^call history$/i).should('be.visible')
      cy.contains(/filters/i).should('be.visible')
      cy.contains('th, label', /agent/i).should('be.visible')
      cy.contains('th, label', /^status$/i).should('be.visible')
      cy.contains('th, label', /duration/i).should('be.visible')
    })
  })

  describe('Call Center Agents tab', () => {
    beforeEach(() => {
      goToCallCenter()
      // No waitForText here (unlike Vendor/Balance) - this tab was already
      // confirmed reliable with just the base "not Loading" wait; adding a
      // retry-click on top of that isn't needed and only adds risk.
      clickTab('Call Center Agents')
    })

    it('lists existing agents with User/Phone/Added/Action columns', () => {
      cy.contains('th, label', /^agent/i).should('be.visible')
      cy.contains('th', /^user$/i).should('be.visible')
      cy.contains('th', /^phone$/i).should('be.visible')
      cy.contains('th', /^added$/i).should('be.visible')
      cy.contains('th', /action/i).should('be.visible')
      cy.contains('button, a', /add agent/i).should('be.visible')
    })

    // Assigns one of the account's existing (already-invited) users as a
    // call center agent - this uses already-purchased agent-limit capacity
    // (2 of 13 used at time of writing), not a new billed purchase, so it's
    // safe to create and delete repeatably, unlike Add Agents on the Team
    // Management tab. Picks "John Doe" specifically rather than "Super
    // Admin" (the account owner, first in the list) to avoid touching the
    // owner's own account role.
    //
    // The modal's own "Add Agent" submit button shares its exact text with
    // the page-level "Add Agent" trigger button that opens the modal (both
    // still present in the DOM at once) - targeting it via its "Cancel"
    // sibling (confirmed adjacent in the modal's button row) avoids
    // ambiguity between the two, which caused the first version of this
    // test to time out finding "the" Add Agent button.
    it('adds an existing user as a call center agent, then removes them', () => {
      const nickname = `QA Agent ${Date.now()}`

      cy.clickUntilTextVisible(() => cy.contains('button, a', /add agent/i).click({ force: true }), 'Nick Name')
      cy.clickUntilTextVisible(() => cy.contains('button', /select a user/i).click({ force: true }), 'Search users')
      cy.contains('button', 'John Doe').click({ force: true })
      // Selecting a user closes the dropdown - waiting for its search input
      // to be gone confirms the selection actually registered before typing
      // the nickname and looking for the submit button, rather than trusting
      // a fixed delay.
      cy.get('input[placeholder*="Search users"]').should('not.exist')
      cy.get('input[placeholder*="Rahul"]').type(nickname, { delay: 40 })

      cy.contains('button', /^cancel$/i, { timeout: 10000 }).next('button').should('contain.text', 'Add Agent').click({ force: true })
      cy.wait(2000)

      cy.contains(nickname, { timeout: 10000 }).should('be.visible')

      // Cleanup.
      cy.contains('tr', nickname).within(() => {
        cy.get('button[aria-label="Delete"]').click({ force: true })
      })
      cy.wait(800)
      cy.get('body').then(($body) => {
        if (/are you sure/i.test($body.text())) {
          cy.contains('button', /^delete$/i).click({ force: true })
        }
      })
      cy.wait(1000)
      cy.contains(nickname).should('not.exist')
    })
  })
})
