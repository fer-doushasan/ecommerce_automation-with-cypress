// Role-permission ENFORCEMENT matrix - Users and Roles section (21 perms).
//   Invitations(3), Activities(2), Users(5), Customers(7), Roles(4)
//
// Note: /admin/user-and-roles/roles loads for role@gmail.com even at
// baseline (page not gated), but the roles LIST is empty without `view role`
// and the "New Role" button is absent without `create role`.

const INVITATIONS = '/admin/user-and-roles/invitations'
const ACTIVITIES = '/admin/user-and-roles/activities'
const USERS = '/admin/user-and-roles/users'
const CUSTOMERS = '/admin/user-and-roles/customers'
const ROLES = '/admin/user-and-roles/roles'
const diag = []

describe('Role matrix - Users and Roles', () => {
  before(() => cy.on('uncaught:exception', () => false))
  after(() => {
    cy.on('uncaught:exception', () => false)
    cy.restoreRoleTestBaseline()
    cy.then(() => cy.writeFile('cypress/screenshots/_diag-roles-matrix-users-roles.json', diag))
  })

  // --- Invitations ---
  it('baseline -> invitations denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(INVITATIONS)
  })
  it('view invitation -> invitations page loads', () => {
    cy.grantRoleTest(['view invitation'])
    cy.assertAreaGranted(INVITATIONS)
    cy.dumpPage(diag, 'view invitation', INVITATIONS)
    cy.contains('button, a', /invite user/i).should('not.exist')
  })
  it('view + create invitation -> "Invite User" button', () => {
    cy.grantRoleTest(['view invitation', 'create invitation'])
    cy.assertAreaGranted(INVITATIONS)
    cy.contains('button, a', /invite user/i).should('be.visible')
  })
  it('view + delete invitation -> page loads', () => {
    cy.grantRoleTest(['view invitation', 'delete invitation'])
    cy.assertAreaGranted(INVITATIONS)
  })

  // --- Activities ---
  it('baseline -> activities denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(ACTIVITIES)
  })
  it('view activity log -> activities page loads', () => {
    cy.grantRoleTest(['view activity log'])
    cy.assertAreaGranted(ACTIVITIES)
    cy.dumpPage(diag, 'view activity log', ACTIVITIES)
  })
  it('view activity log + view order activity log -> page loads', () => {
    cy.grantRoleTest(['view activity log', 'view order activity log'])
    cy.assertAreaGranted(ACTIVITIES)
  })

  // --- Users ---
  it('baseline -> users denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(USERS)
  })
  it('view user -> users page loads', () => {
    cy.grantRoleTest(['view user'])
    cy.assertAreaGranted(USERS)
    cy.dumpPage(diag, 'view user', USERS)
  })
  ;['add user', 'create user', 'update user', 'remove user'].forEach((perm) => {
    it(`view user + ${perm} -> users page loads`, () => {
      cy.grantRoleTest(['view user', perm])
      cy.assertAreaGranted(USERS)
    })
  })

  // --- Customers ---
  it('baseline -> customers denied', () => {
    cy.grantRoleTest([])
    cy.assertAreaDenied(CUSTOMERS)
  })
  it('view customer -> customers page loads', () => {
    cy.grantRoleTest(['view customer'])
    cy.assertAreaGranted(CUSTOMERS)
    cy.dumpPage(diag, 'view customer', CUSTOMERS)
  })
  ;['create customer', 'edit customer', 'update customer', 'delete customer', 'customer import', 'customer export'].forEach(
    (perm) => {
      it(`view customer + ${perm} -> customers page loads`, () => {
        cy.grantRoleTest(['view customer', perm])
        cy.assertAreaGranted(CUSTOMERS)
      })
    }
  )

  // --- Roles (page not gated; list + actions are) ---
  it('view role -> roles list is populated', () => {
    cy.grantRoleTest(['view role'])
    cy.visit(ROLES, { failOnStatusCode: false })
    cy.wait(4000)
    cy.dumpPage(diag, 'view role', ROLES)
    cy.contains(/no roles found|0 roles found/i).should('not.exist')
    cy.contains('table tbody tr', /super admin/i).should('exist')
  })
  it('baseline only -> roles list empty / no New Role button', () => {
    cy.grantRoleTest([])
    cy.visit(ROLES, { failOnStatusCode: false })
    cy.wait(4000)
    cy.contains('button, a', /new role/i).should('not.exist')
  })
  it('create role -> "New Role" button appears', () => {
    cy.grantRoleTest(['view role', 'create role'])
    cy.visit(ROLES, { failOnStatusCode: false })
    cy.wait(4000)
    cy.contains('button, a', /new role/i).should('be.visible')
  })
  ;['update role', 'delete role'].forEach((perm) => {
    it(`view role + ${perm} -> roles page loads`, () => {
      cy.grantRoleTest(['view role', perm])
      cy.visit(ROLES, { failOnStatusCode: false })
      cy.wait(4000)
      cy.get('body').should('not.contain', 'Page not found')
    })
  })
})
