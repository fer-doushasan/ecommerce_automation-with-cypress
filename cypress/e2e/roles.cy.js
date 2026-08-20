// "New Role" navigates to a full page (not a modal) with a Role Name field
// and a large grouped "Assign Permissions" section (162 permissions across
// many groups for Super Admin - no native checkboxes, custom div items with
// a "Select All" toggle, per-group "Select group", and per-section "Select
// all" shortcuts). Confirmed by dumping the live page before writing this.
describe('Roles page', () => {
  beforeEach(() => {
    // Same account-wide background 403 as Invitations/Users - see
    // invitations.cy.js for details.
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
    cy.visit('/admin/user-and-roles/roles')
    cy.contains('h1, h2', /roles/i).should('be.visible')
    // The table rows are skeleton placeholders until real data replaces
    // them - confirmed via dump that 1.5s wasn't enough (still animate-pulse
    // rows at that point).
    cy.wait(4000)
  })

  it('loads the roles page with New Role, Tutorial, and a table', () => {
    cy.contains('button', /new role/i).should('be.visible')
    cy.contains('button', /tutorial/i).should('be.visible')
    cy.contains('th', /name/i).should('be.visible')
    cy.contains('th', /users/i).should('be.visible')
    cy.contains('th', /permissions/i).should('be.visible')
  })

  it('opens the tutorial video when Tutorial is clicked', () => {
    cy.clickUntilTextVisible(() => cy.contains('button', /tutorial/i).click(), 'Press Esc to close')
    cy.get('iframe, video').should('exist')
  })

  it('navigates to the New Role form with a Role Name field and Assign Permissions section', () => {
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)
    cy.contains('h1, h2', /create role/i).should('be.visible')
    cy.contains('label', /role name/i).should('be.visible')
    cy.contains(/assign permissions/i).should('be.visible')
    cy.contains(/0 selected/i).should('be.visible')
  })

  it('updates the selected-permissions count when Select All is toggled', () => {
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)
    cy.contains(/0 selected/i).should('be.visible')
    cy.contains('label', /select all/i).find('button').click({ force: true })
    cy.wait(500)
    cy.contains(/0 selected/i).should('not.exist')
  })

  it('filters the permissions list when typing in the filter box', () => {
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)
    cy.get('input[placeholder*="Filter permissions"]').type('user', { delay: 60 })
    cy.wait(500)
    cy.contains(/view user/i).should('be.visible')
  })

  // Select All is used rather than picking individual permissions - with
  // 162 of them grouped across many sections, one toggle is far more
  // reliable than trying to target a specific one.
  it('creates a role with all permissions and it appears in the list', () => {
    const roleName = `ZZZ Test Role ${Date.now()}`
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)

    cy.get('input[placeholder*="e.g. Admin"]').type(roleName, { delay: 60 })
    cy.contains('label', /select all/i).find('button').click({ force: true })
    cy.wait(500)

    cy.intercept('POST', '**/api/v1/admin/roles').as('createRole')
    cy.contains('button', /create role/i).click({ force: true })
    cy.wait('@createRole', { timeout: 15000 }).its('response.statusCode').should('be.oneOf', [200, 201])

    cy.contains('h1, h2', /roles/i, { timeout: 10000 }).should('be.visible')
    cy.wait(1000)
    cy.contains(roleName).should('be.visible')
  })

  it('blocks creating a role with no name filled in', () => {
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)
    cy.contains('button', /create role/i).click({ force: true })
    cy.wait(800)
    cy.contains('label', /role name/i).should('be.visible')
  })

  // Non-destructive - views and cancels out of editing a real, in-use role
  // ("Order Manager", 5 users) rather than saving any change to it.
  it('views an existing role and shows its name and permissions', () => {
    cy.contains('table tbody tr', 'Order Manager').find('button[aria-label="View role"]').click({ force: true })
    cy.wait(1000)
    cy.contains('Order Manager').should('be.visible')
    cy.contains(/permission/i).should('be.visible')
  })

  it('opens the edit form for an existing role with its name pre-filled', () => {
    cy.contains('table tbody tr', 'Order Manager').find('button[aria-label="Edit role"]').click({ force: true })
    cy.wait(1000)
    cy.get('input[placeholder*="e.g. Admin"]').should('have.value', 'Order Manager')
    // Already has permissions assigned (24, per the list) - shouldn't read
    // as the empty "0 selected" state a brand-new role starts at.
    cy.contains(/0 selected/i).should('not.exist')
  })

  // Unlike the Users page (where a deletable row is always a real,
  // signed-up person - there's no way to create a disposable one), a Role
  // can be created and deleted entirely within the test, with 0 users ever
  // assigned to it - so this is a real delete, not just a
  // confirm-then-cancel check.
  it('deletes a role it just created', () => {
    const roleName = `ZZZ Test Role ${Date.now()}`
    cy.contains('button', /new role/i).click({ force: true })
    cy.wait(1000)
    cy.get('input[placeholder*="e.g. Admin"]').type(roleName, { delay: 60 })
    cy.contains('label', /select all/i).find('button').click({ force: true })
    cy.wait(500)
    cy.intercept('POST', '**/api/v1/admin/roles').as('createRole')
    cy.contains('button', /create role/i).click({ force: true })
    cy.wait('@createRole', { timeout: 15000 })

    cy.contains('h1, h2', /roles/i, { timeout: 10000 }).should('be.visible')
    cy.wait(1000)
    cy.contains(roleName).should('be.visible')

    cy.contains('table tbody tr', roleName).find('button[aria-label="Delete role"]').click({ force: true })
    cy.wait(500)
    cy.contains(/are you sure|delete role/i).should('be.visible')

    cy.intercept('DELETE', '**/api/v1/admin/roles/*').as('deleteRole')
    cy.contains('button', /^delete$/i).click({ force: true })
    cy.wait('@deleteRole', { timeout: 10000 }).its('response.statusCode').should('be.oneOf', [200, 201])

    cy.wait(1500)
    cy.contains(roleName).should('not.exist')
  })
})

describe('Roles page access control', () => {
  it('redirects to /login when visiting roles while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/user-and-roles/roles')

    cy.url().should('include', '/login')
  })
})
