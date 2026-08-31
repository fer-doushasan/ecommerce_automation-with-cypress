// Throwaway exploration spec for /admin/site-builder/sites.
// Run it, then hand back cypress/fixtures/_tmp-sites-explore.txt so the real
// sites.cy.js can be written against the actual DOM (not guessed selectors).
describe('explore /admin/site-builder/sites', () => {
  it('dumps the sites list page structure + API calls', () => {
    cy.on('uncaught:exception', () => false)
    cy.loginViaSession()

    const apiCalls = []
    cy.intercept('**/api/**', (req) => {
      apiCalls.push(`${req.method} ${req.url}`)
    })

    cy.visit('/admin/site-builder/sites')
    cy.wait(4000)

    cy.get('body').then(($body) => {
      const $ = Cypress.$
      const out = []

      out.push('===== URL =====')
      out.push(location.href)

      out.push('\n===== HEADINGS (h1-h4) =====')
      $body.find('h1,h2,h3,h4').each((i, el) => {
        out.push(`<${el.tagName.toLowerCase()}> ${$(el).text().trim()}`)
      })

      out.push('\n===== BUTTONS (visible) =====')
      $body.find('button:visible').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ')
        out.push(`[${t}] :: ${el.outerHTML.slice(0, 300)}`)
      })

      out.push('\n===== LINKS (visible, text + href) =====')
      $body.find('a:visible').each((i, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ')
        if (t || el.getAttribute('href')) out.push(`[${t}] -> ${el.getAttribute('href')}`)
      })

      out.push('\n===== INPUTS / SELECTS / TEXTAREAS =====')
      $body.find('input,select,textarea').each((i, el) => {
        out.push(`<${el.tagName.toLowerCase()}> type=${el.getAttribute('type')} name=${el.getAttribute('name')} placeholder=${el.getAttribute('placeholder')}`)
      })

      out.push('\n===== TABLE HEADERS =====')
      $body.find('table th').each((i, el) => out.push(`th: ${$(el).text().trim()}`))

      out.push('\n===== FIRST 3 TABLE ROWS (cell text) =====')
      $body.find('table tbody tr').slice(0, 3).each((r, tr) => {
        const cells = $(tr).find('td').map((i, td) => $(td).text().trim().replace(/\s+/g, ' ')).get()
        out.push(`row ${r}: ${JSON.stringify(cells)}`)
        out.push(`  row ${r} html: ${tr.outerHTML.slice(0, 800)}`)
      })

      out.push('\n===== "records found" / pagination text =====')
      const bt = $body.text()
      const rec = bt.match(/\d+\s+records?\s+found/i)
      out.push(rec ? rec[0] : '(no "records found" text)')

      out.push('\n===== SIDEBAR / NAV links containing site-builder =====')
      $body.find('a').each((i, el) => {
        const href = el.getAttribute('href') || ''
        if (/site-builder|site_builder|sitebuilder/i.test(href)) {
          out.push(`[${$(el).text().trim().replace(/\s+/g, ' ')}] -> ${href}`)
        }
      })

      out.push('\n===== FULL BODY innerText =====')
      out.push($body[0].innerText.trim())

      cy.writeFile('cypress/fixtures/_tmp-sites-explore.txt', out.join('\n'))
    })

    cy.then(() => {
      cy.writeFile('cypress/fixtures/_tmp-sites-api-calls.txt', apiCalls.join('\n'))
    })
  })
})
