/**
 * Diagnostic script — dumps page state to understand the stiltweb site structure.
 * Run: node scripts/diagnose.js
 */

import puppeteer from 'puppeteer'

const BASE = 'https://www.stiltweb.com/eLeague/fhl'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

async function diagnose() {
  const browser = await puppeteer.launch({
    headless: false, // visible so we can see what's happening
    executablePath: EDGE,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()
  page.on('console', msg => console.log('PAGE LOG:', msg.text()))
  page.on('request', req => {
    if (req.url().includes('stiltweb')) console.log('REQUEST:', req.url())
  })

  console.log('\n=== Loading rosters.php?team=1962 ===')
  await page.goto(`${BASE}/rosters.php?team=1962`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise(r => setTimeout(r, 2000))

  // Dump all selects and their options
  const selects = await page.$$eval('select', els => els.map(s => ({
    name: s.name,
    id: s.id,
    options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
  })))
  console.log('\n--- Selects on rosters.php ---')
  console.log(JSON.stringify(selects, null, 2))

  // Dump all tables before any selection
  const tablesBefore = await page.$$eval('table', ts => ts.map(t => ({
    rows: t.rows.length,
    firstRow: t.rows[0] ? Array.from(t.rows[0].cells).map(c => c.textContent.trim()) : []
  })))
  console.log('\n--- Tables before selection ---')
  console.log(JSON.stringify(tablesBefore, null, 2))

  // Try selecting division "Winter 2025 C"
  if (selects.length > 0) {
    const divSelect = selects.find(s =>
      s.options.some(o => o.text.includes('Winter 2025 C') || o.text.includes('C'))
    )
    if (divSelect) {
      console.log(`\nSelecting division in select[name="${divSelect.name}"]`)
      const divOption = divSelect.options.find(o => o.text.includes('Winter 2025 C')) ||
                        divSelect.options.find(o => o.text.includes(' C'))
      if (divOption) {
        await page.select(`select[name="${divSelect.name}"]`, divOption.value)
        console.log(`Selected: "${divOption.text}" (value: ${divOption.value})`)
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    // Re-dump selects after division selection (team dropdown may have populated)
    const selectsAfter = await page.$$eval('select', els => els.map(s => ({
      name: s.name,
      id: s.id,
      options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
    })))
    console.log('\n--- Selects AFTER division selection ---')
    console.log(JSON.stringify(selectsAfter, null, 2))

    // Try selecting Pharaohs team
    const teamSelect = selectsAfter.find(s =>
      s.options.some(o => o.text.toLowerCase().includes('pharaoh') || o.value === '1962')
    )
    if (teamSelect) {
      const teamOption = teamSelect.options.find(o =>
        o.text.toLowerCase().includes('pharaoh') || o.value === '1962'
      )
      if (teamOption) {
        console.log(`\nSelecting team: "${teamOption.text}" (value: ${teamOption.value})`)
        await page.select(`select[name="${teamSelect.name}"]`, teamOption.value)
        await new Promise(r => setTimeout(r, 3000))
      }
    } else {
      console.log('\nNo team select found with Pharaohs option')
    }
  }

  // Dump tables after all selections
  const tablesAfter = await page.$$eval('table', ts => ts.map((t, i) => ({
    index: i,
    rows: t.rows.length,
    allRows: Array.from(t.rows).map(r =>
      Array.from(r.cells).map(c => c.textContent.trim())
    )
  })))
  console.log('\n--- Tables AFTER selection ---')
  console.log(JSON.stringify(tablesAfter, null, 2))

  // Also dump the full page text to catch any non-table data
  const bodyText = await page.$eval('body', el => el.innerText)
  console.log('\n--- Body text (first 2000 chars) ---')
  console.log(bodyText.slice(0, 2000))

  console.log('\nKeeping browser open for 15 seconds so you can inspect...')
  await new Promise(r => setTimeout(r, 15000))
  await browser.close()
}

diagnose().catch(console.error)
