/**
 * Pharaohs scraper
 * Pulls roster, schedule, and standings using direct URLs with query params.
 *
 * Usage:  node scripts/scrape.js
 */

import puppeteer from 'puppeteer'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')

const BASE    = 'https://www.stiltweb.com/eLeague/fhl'
const TEAM_ID = '1962'
const DIV_ID  = '321'
const EDGE    = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

// ── Helpers ────────────────────────────────────────────────────────────────

function writeJson(filename, data) {
  const payload = { ...data, _updated: new Date().toISOString() }
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(payload, null, 2))
  console.log(`✓ Wrote ${filename}`)
}

function parseDate(raw) {
  if (!raw) return null
  const cleaned = raw.trim()
  const full = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (full) {
    const [, m, d, y] = full
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const short = cleaned.match(/(\d{1,2})\/(\d{1,2})/)
  if (short) {
    const year = new Date().getFullYear()
    const [, m, d] = short
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

// Wait for at least one table with data rows to appear
async function waitForTable(page, timeout = 10000) {
  try {
    await page.waitForFunction(
      () => [...document.querySelectorAll('table')].some(t => t.rows.length > 1),
      { timeout }
    )
  } catch {
    console.warn('Timed out waiting for table — proceeding anyway')
  }
}

async function parseTables(page) {
  return page.$$eval('table', tables =>
    tables.map(t =>
      Array.from(t.querySelectorAll('tr')).map(r =>
        Array.from(r.querySelectorAll('th, td')).map(c => c.textContent.trim())
      )
    ).filter(rows => rows.length > 1)
  )
}

function headersFromRow(row) {
  return row.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''))
}

// ── Scrape roster ──────────────────────────────────────────────────────────

async function scrapeRoster(page) {
  console.log('Scraping roster...')
  await page.goto(`${BASE}/rosters.php?team=${TEAM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitForTable(page)

  const players = []
  try {
    const tables = await parseTables(page)
    for (const tableData of tables) {
      let headers = []
      for (const row of tableData) {
        const isHeader = row.some(c => /^(#|no\.?|num|name|pos)/i.test(c))
        if (isHeader && !headers.length) { headers = headersFromRow(row); continue }
        if (headers.length && row.some(c => c !== '')) {
          const p = {}
          headers.forEach((h, i) => {
            const val = row[i] ?? ''
            if (/^#$|^no$|^num/.test(h))   p.number   = val.replace('#', '')
            else if (/name/.test(h))        p.name     = val
            else if (/pos/.test(h))         p.position = val.toUpperCase()
            else if (/shoot/.test(h))       p.shoots   = val
            else if (/^gp$/.test(h))        p.gp       = parseInt(val) || 0
            else if (/^g$/.test(h))         p.g        = parseInt(val) || 0
            else if (/^a$/.test(h))         p.a        = parseInt(val) || 0
            else if (/pts|points/.test(h))  p.pts      = parseInt(val) || 0
            else if (/pim/.test(h))         p.pim      = parseInt(val) || 0
          })
          if (p.name) players.push(p)
        }
      }
      if (players.length) break
    }
  } catch (e) {
    console.warn('Roster parse error:', e.message)
  }

  writeJson('roster.json', { players })
  return players.length
}

// ── Scrape schedule ────────────────────────────────────────────────────────

async function scrapeSchedule(page) {
  console.log('Scraping schedule...')
  await page.goto(`${BASE}/schedule.php?team=${TEAM_ID}&div=${DIV_ID}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await waitForTable(page)

  const games = []
  try {
    const tables = await parseTables(page)
    for (const tableData of tables) {
      let headers = []
      for (const row of tableData) {
        const isHeader = row.some(c => /date|time|home|away|opponent/i.test(c))
        if (isHeader && !headers.length) { headers = headersFromRow(row); continue }
        if (headers.length && row.some(c => c !== '')) {
          const g = {}
          headers.forEach((h, i) => {
            const val = row[i] ?? ''
            if (/date/.test(h))              g.date     = parseDate(val)
            else if (/time/.test(h))         g.time     = val
            else if (/home/.test(h))         g.home     = val
            else if (/away|visit/.test(h))   g.away     = val
            else if (/oppon|vs/.test(h))     g.opponent = val
            else if (/score|result/.test(h)) g.score    = val
            else if (/rink|ice|sheet/.test(h)) g.rink   = val
          })
          if (!g.opponent && (g.home || g.away)) {
            const isPharaoh = t => t?.toLowerCase().includes('pharaoh')
            if (isPharaoh(g.home))      g.opponent = g.away
            else if (isPharaoh(g.away)) g.opponent = g.home
            else                        g.opponent = [g.home, g.away].filter(Boolean).join(' vs ')
          }
          if (g.score && !g.result) {
            const m = g.score.match(/(\d+)\s*[-–]\s*(\d+)/)
            if (m) {
              const weAreHome = g.home?.toLowerCase().includes('pharaoh')
              const ours   = parseInt(weAreHome ? m[1] : m[2])
              const theirs = parseInt(weAreHome ? m[2] : m[1])
              g.result = ours > theirs ? 'W' : ours < theirs ? 'L' : 'T'
            }
          }
          if (g.date || g.opponent) games.push(g)
        }
      }
      if (games.length) break
    }
  } catch (e) {
    console.warn('Schedule parse error:', e.message)
  }

  writeJson('schedule.json', { games })
  return games.length
}

// ── Scrape standings ───────────────────────────────────────────────────────

async function scrapeStandings(page) {
  console.log('Scraping standings...')

  // Intercept the AJAX request the dropdown triggers to get the URL pattern
  let ajaxUrl = null
  page.on('request', req => {
    const url = req.url()
    if (url.includes('actions.php') || url.includes('standings')) {
      console.log('AJAX request intercepted:', url)
      ajaxUrl = url
    }
  })

  await page.goto(`${BASE}/standings.php`, { waitUntil: 'networkidle2', timeout: 30000 })

  // Dump the form structure to understand how the dropdown submits
  try {
    await page.waitForSelector('#select-league-drop', { timeout: 8000 })
    const formInfo = await page.evaluate(() => {
      const sel = document.getElementById('select-league-drop')
      const form = sel.closest('form')
      const onchange = sel.getAttribute('onchange')
      const onclick = sel.getAttribute('onclick')
      return {
        onchange,
        onclick,
        formAction: form ? form.action : null,
        formMethod: form ? form.method : null,
        outerHTML: sel.outerHTML.slice(0, 300),
        parentHTML: sel.parentElement?.outerHTML?.slice(0, 500),
      }
    })
    console.log('Form info:', JSON.stringify(formInfo, null, 2))
  } catch(e) {
    console.warn(e.message)
  }

  const bodySnippet = await page.$eval('body', el => el.innerText.slice(0, 800))
  console.log('Page after selection:\n', bodySnippet)

  const standings = []
  try {
    const tables = await parseTables(page)
    console.log(`Found ${tables.length} tables on standings page`)
    for (const tableData of tables) {
      let headers = []
      for (const row of tableData) {
        const isHeader = row.some(c => /^(team|name|pts|points|wins|losses)/i.test(c)) &&
                         row.some(c => /^(w|wins|pts|points|gp)/i.test(c))
        if (isHeader && !headers.length) { headers = headersFromRow(row); continue }
        if (headers.length && row.length >= 3 && row.some(c => c !== '')) {
          const e = {}
          headers.forEach((h, i) => {
            const val = row[i] ?? ''
            if (/team|name/.test(h))        e.team = val
            else if (/^gp$/.test(h))        e.gp   = parseInt(val) || 0
            else if (/^w$/.test(h))         e.w    = parseInt(val) || 0
            else if (/^l$/.test(h))         e.l    = parseInt(val) || 0
            else if (/^t$|tie/.test(h))     e.t    = parseInt(val) || 0
            else if (/pts|points/.test(h))  e.pts  = parseInt(val) || 0
            else if (/^gf$|goalsf/.test(h)) e.gf   = parseInt(val) || 0
            else if (/^ga$|goalsa/.test(h)) e.ga   = parseInt(val) || 0
          })
          if (e.team) standings.push(e)
        }
      }
      if (standings.length >= 5) break  // found the right table
    }
  } catch (e) {
    console.warn('Standings parse error:', e.message)
  }

  writeJson('standings.json', { standings })
  return standings.length
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: EDGE,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36'
  )

  try {
    const rosterCount    = await scrapeRoster(page)
    const scheduleCount  = await scrapeSchedule(page)
    const standingsCount = await scrapeStandings(page)
    console.log(`\nDone. Roster: ${rosterCount} players | Schedule: ${scheduleCount} games | Standings: ${standingsCount} teams`)
  } catch (err) {
    console.error('Scrape failed:', err)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
