// Second throwaway exploration pass: the New Site form, the Edit route, and
// the full Actions cell markup. Hand back the 3 fixture files it writes.
describe('explore sites create/edit', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()
  })

  it('dumps the New Site (/admin/site-builder/sites/create) form', () => {
    cy.visit('/admin/site-builder/sites/create')
    cy.wait(4000)
    cy.get('body').then(($body) => {
      const $ = Cypress.$
      const out = []
      out.push('===== URL =====')
      out.push(location.href)
      out.push('\n===== HEADINGS =====')
      $body.find('h1,h2,h3,h4').each((i, el) => out.push(`<${el.tagName.toLowerCase()}> ${$(el).text().trim()}`))
      out.push('\n===== LABELS =====')
      $body.find('label').each((i, el) => out.push(`label: "${$(el).text().trim().replace(/\s+/g, ' ')}"`))
      out.push('\n===== INPUTS / SELECTS / TEXTAREAS =====')
      $body.find('input,select,textarea').each((i, el) => {
        out.push(`<${el.tagName.toLowerCase()}> type=${el.getAttribute('type')} name=${el.getAttribute('name')} placeholder=${el.getAttribute('placeholder')} :: ${el.outerHTML.slice(0, 250)}`)
      })
      out.push('\n===== BUTTONS (visible) =====')
      $body.find('button:visible').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ')
        if (t) out.push(`[${t}]`)
      })
      out.push('\n===== FULL BODY innerText =====')
      out.push($body[0].innerText.trim())
      cy.writeFile('cypress/fixtures/_tmp-sites-create.txt', out.join('\n'))
    })
  })

  it('dumps the Actions cell markup + follows Edit site on row 0', () => {
    cy.intercept('GET', '**/api/v1/admin/sites**').as('sitesList')
    cy.visit('/admin/site-builder/sites')
    cy.wait('@sitesList', { timeout: 15000 })
    cy.wait(2000)

    cy.get('table tbody tr').first().then(($tr) => {
      cy.writeFile('cypress/fixtures/_tmp-sites-row0.txt', $tr[0].outerHTML)
    })

    cy.get('table tbody tr').first().find('button[aria-label="Edit site"]').click({ force: true })
    cy.wait(3000)
    cy.get('body').then(($body) => {
      const $ = Cypress.$
      const out = []
      out.push('===== URL after Edit site click =====')
      out.push(location.href)
      out.push('\n===== HEADINGS =====')
      $body.find('h1,h2,h3,h4').each((i, el) => out.push(`<${el.tagName.toLowerCase()}> ${$(el).text().trim()}`))
      out.push('\n===== LABELS =====')
      $body.find('label').each((i, el) => out.push(`label: "${$(el).text().trim().replace(/\s+/g, ' ')}"`))
      out.push('\n===== INPUTS / SELECTS / TEXTAREAS =====')
      $body.find('input,select,textarea').each((i, el) => {
        out.push(`<${el.tagName.toLowerCase()}> type=${el.getAttribute('type')} name=${el.getAttribute('name')} placeholder=${el.getAttribute('placeholder')} value="${el.value}"`)
      })
      out.push('\n===== BUTTONS (visible) =====')
      $body.find('button:visible').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ')
        if (t) out.push(`[${t}]`)
      })
      out.push('\n===== FULL BODY innerText =====')
      out.push($body[0].innerText.trim())
      cy.writeFile('cypress/fixtures/_tmp-sites-edit.txt', out.join('\n'))
    })
  })
})
