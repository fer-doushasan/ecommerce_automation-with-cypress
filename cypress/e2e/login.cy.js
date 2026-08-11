// This app occasionally drops the first keystroke right after page load
// (the input isn't fully hydrated yet), which silently turns a correct
// email into a wrong one. Typing then re-checking the field's actual value
// (and retrying if it doesn't match) avoids false failures caused by that,
// rather than a fixed real login/credentials bug.
function typeReliably(selector, text) {
  const attempt = (retriesLeft) => {
    cy.get(selector).clear().type(text, { delay: 100 })
    cy.get(selector).invoke('val').then((actual) => {
      if (actual !== text && retriesLeft > 0) {
        attempt(retriesLeft - 1)
      } else {
        expect(actual, `${selector} value`).to.eq(text)
      }
    })
  }
  attempt(3)
}

function attemptLogin(email, password) {
  cy.intercept('POST', '**/api/login').as('loginRequest')

  cy.visit('/login')

  cy.get('input[placeholder="email@example.com"]').should('have.length', 1)
  typeReliably('input[placeholder="email@example.com"]', email)

  cy.get('input[placeholder="Enter password"]').should('have.length', 1)
  typeReliably('input[placeholder="Enter password"]', password)

  cy.contains('button', /log in/i).click()

  return cy.wait('@loginRequest')
}

function loginViaSession() {
  cy.session('validAdminSession', () => {
    cy.visit('/login')
    typeReliably('input[placeholder="email@example.com"]', Cypress.env('loginEmail'))
    typeReliably('input[placeholder="Enter password"]', Cypress.env('loginPassword'))
    cy.contains('button', /log in/i).click()
    cy.url().should('not.include', '/login')
  })
}

describe('Admin login', () => {
  it('logs in with valid email and valid password', () => {
    attemptLogin(Cypress.env('loginEmail'), Cypress.env('loginPassword')).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })

    cy.url().should('not.include', '/login')
  })

  it('rejects wrong email and wrong password', () => {
    attemptLogin('wrong@example.com', 'wrongpass123').then((interception) => {
      expect(interception.response.statusCode).to.eq(401)
    })

    cy.url().should('include', '/login')
  })

  it('rejects valid email with wrong password', () => {
    attemptLogin(Cypress.env('loginEmail'), 'wrongpass123').then((interception) => {
      expect(interception.response.statusCode).to.eq(401)
    })

    cy.url().should('include', '/login')
  })

  it('rejects wrong email with valid password', () => {
    attemptLogin('wrong@example.com', Cypress.env('loginPassword')).then((interception) => {
      expect(interception.response.statusCode).to.eq(401)
    })

    cy.url().should('include', '/login')
  })

  it('blocks submit when email is empty', () => {
    cy.intercept('POST', '**/api/login').as('loginRequest')
    cy.visit('/login')

    typeReliably('input[placeholder="Enter password"]', Cypress.env('loginPassword'))
    cy.contains('button', /log in/i).click()

    cy.get('@loginRequest.all').should('have.length', 0)
    cy.url().should('include', '/login')
  })

  it('blocks submit when password is empty', () => {
    cy.intercept('POST', '**/api/login').as('loginRequest')
    cy.visit('/login')

    typeReliably('input[placeholder="email@example.com"]', Cypress.env('loginEmail'))
    cy.contains('button', /log in/i).click()

    cy.get('@loginRequest.all').should('have.length', 0)
    cy.url().should('include', '/login')
  })

  it('blocks submit when both fields are empty', () => {
    cy.intercept('POST', '**/api/login').as('loginRequest')
    cy.visit('/login')

    cy.contains('button', /log in/i).click()

    cy.get('@loginRequest.all').should('have.length', 0)
    cy.url().should('include', '/login')
  })

  it('blocks submit for invalid email format', () => {
    cy.intercept('POST', '**/api/login').as('loginRequest')
    cy.visit('/login')

    typeReliably('input[placeholder="email@example.com"]', 'notanemail')
    typeReliably('input[placeholder="Enter password"]', Cypress.env('loginPassword'))
    cy.contains('button', /log in/i).click()

    cy.get('@loginRequest.all').should('have.length', 0)
    cy.url().should('include', '/login')
  })

  it('logs in when email has leading/trailing whitespace', () => {
    attemptLogin(`  ${Cypress.env('loginEmail')}  `, Cypress.env('loginPassword')).then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })

    cy.url().should('not.include', '/login')
  })

  it('logs in by pressing Enter instead of clicking the button', () => {
    cy.intercept('POST', '**/api/login').as('loginRequest')
    cy.visit('/login')

    typeReliably('input[placeholder="email@example.com"]', Cypress.env('loginEmail'))
    typeReliably('input[placeholder="Enter password"]', Cypress.env('loginPassword'))
    cy.get('input[placeholder="Enter password"]').type('{enter}')

    cy.wait('@loginRequest').then((interception) => {
      expect(interception.response.statusCode).to.eq(200)
    })
    cy.url().should('not.include', '/login')
  })

  it('redirects an already logged-in user away from /login', () => {
    loginViaSession()
    cy.visit('/admin/dashboard')
    cy.url().should('not.include', '/login')

    cy.visit('/login')
    cy.url().should('not.include', '/login')
  })

  it('redirects to /login when visiting a protected route while logged out', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/admin/dashboard')

    cy.url().should('include', '/login')
  })
})
