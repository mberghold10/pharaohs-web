/**
 * Pharaohs scraper — stiltweb.com
 * Pulls regular season + playoff roster, schedule, and standings
 * for the Pharaohs (team 1962, div 321) using plain HTTPS — no browser needed.
 *
 * Usage:  node scripts/scrape.js
 */

import https from 'https'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../src/data')

const BASE    = 'https://www.stiltweb.com/eLeague/fhl'
const TEAM_ID = '1962'
const DIV_ID  = '321'

// ── Helpers ────────────────────────────────────────────────────────────────

function writeJson(filename, data) {
  const payload = { ...data, _updated: new Date().toISOString() }
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(payload, null, 2))
  console.log(`✓ Wrote ${filename}`)
}

// Get a session cookie then use it for all requests
let sessionCookie = ''

async function fetchHtml(path) {
  return new Promise((resolve, reject) => {
    const url = path.startsWith('http') ? path : `${BASE}/${path}`
    const req = https.get(url, {
      headers: {
        Referer: `${BASE}/`,
        Cookie: sessionCookie,
      }
    }, res => {
      // Capture session cookie on first response
      if (!sessionCookie && res.headers['set-cookie']) {
        sessionCookie = res.headers['set-cookie']
          .map(c => c.split(';')[0])
          .join('; ')
      }
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location).then(resolve).catch(reject)
      }
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve(d))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
  })
}

// Extract all tables with class='standings' from HTML, handling nested tables
function extractStandingsTables(html) {
  const tables = []

  // Find all opening tags for standings tables
  const openRe = /<[Tt][Aa][Bb][Ll][Ee][^>]*class='standings'[^>]*>/g
  let m
  while ((m = openRe.exec(html)) !== null) {
    // Walk forward counting <table> opens and closes to find the matching </table>
    let depth = 1
    let pos = m.index + m[0].length
    while (depth > 0 && pos < html.length) {
      const nextOpen  = html.indexOf('<', pos)
      if (nextOpen === -1) break
      const tag = html.slice(nextOpen, nextOpen + 8).toLowerCase()
      if (tag.startsWith('<table')) { depth++; pos = nextOpen + 6 }
      else if (tag.startsWith('</table')) { depth--; pos = nextOpen + 8 }
      else pos = nextOpen + 1
    }
    const tableHtml = html.slice(m.index, pos)

    // Parse rows from this table
    const rows = []
    for (const row of tableHtml.matchAll(/<[Tt][Rr][^>]*>([\s\S]*?)<\/[Tt][Rr]>/gi)) {
      const cells = []
      for (const cell of row[1].matchAll(/<[Tt][HhDd][^>]*>([\s\S]*?)<\/[Tt][HhDd]>/gi)) {
        cells.push(
          cell[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, '')
            .replace(/&amp;/g, '&')
            .trim()
        )
      }
      if (cells.some(c => c)) rows.push(cells)
    }
    if (rows.length > 1) tables.push(rows)
  }
  return tables
}

function tableToObjects(rows) {
  if (rows.length < 2) return []
  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9%]/g, ''))
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] ?? '' })
    return obj
  })
}

function parseDate(raw) {
  if (!raw) return null
  // "Monday, December 1, 2025 7:20 PM" or "12/01/2025"
  const long = raw.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d{4})\s+([\d:]+\s*[AP]M)/i)
  if (long) return `${long[4]}-${monthNum(long[2])}-${long[3].padStart(2,'0')}`
  const mdy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return raw.trim()
}

function parseTime(raw) {
  const t = raw?.match(/(\d+:\d+\s*[AP]M)/i)
  return t ? t[1] : ''
}

function monthNum(name) {
  const months = { january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
                   july:'07',august:'08',september:'09',october:'10',november:'11',december:'12' }
  return months[name.toLowerCase()] ?? '01'
}

function isPharaoh(t) { return t?.toLowerCase().includes('phar') ?? false }

// ── Roster ─────────────────────────────────────────────────────────────────

function parseRosterHtml(html) {
  const tables = extractStandingsTables(html)
  const players = []
  const goalies = []

  for (const tableRows of tables) {
    const headers = tableRows[0].map(h => h.toLowerCase())
    const isGoalie = headers.includes('gaa') || headers.includes('sv%') || headers.includes('sv')
    const objs = tableToObjects(tableRows)

    for (const p of objs) {
      if (!p['name']) continue
      if (isGoalie) {
        goalies.push({
          number: p['#'] || '',
          name: p['name'],
          gp: parseInt(p['gp']) || 0,
          w: parseInt(p['w']) || 0,
          l: parseInt(p['l']) || 0,
          t: parseInt(p['t']) || 0,
          ga: parseInt(p['ga']) || 0,
          sa: parseInt(p['sa']) || 0,
          sv: parseInt(p['sv']) || 0,
          svpct: p['sv%'] || '',
          gaa: p['gaa'] || '',
          so: parseInt(p['so']) || 0,
          pim: parseInt(p['pim']) || 0,
        })
      } else {
        players.push({
          number: p['#'] || '',
          name: p['name'],
          position: '',
          gp: parseInt(p['gp']) || 0,
          g: parseInt(p['g']) || 0,
          a: parseInt(p['a']) || 0,
          pts: parseInt(p['pts']) || 0,
          ppg: parseInt(p['ppg']) || 0,
          ppa: parseInt(p['ppa']) || 0,
          shg: parseInt(p['shg']) || 0,
          sha: parseInt(p['sha']) || 0,
          pim: parseInt(p['pim']) || 0,
        })
      }
    }
  }
  return { players, goalies }
}

// ── Schedule ───────────────────────────────────────────────────────────────

function parseScheduleHtml(html, isPlayoffs = false) {
  const tables = extractStandingsTables(html)

  if (!isPlayoffs) {
    // Regular season — simple parse, no bracket logic needed
    const games = []
    for (const tableRows of tables) {
      const headers = tableRows[0].map(h => h.toLowerCase())
      if (!headers.some(h => /date|home|away/i.test(h))) continue
      for (const g of tableToObjects(tableRows)) {
        const game = parseGameRow(g, false)
        if (game) games.push(game)
      }
      if (games.length) break
    }
    return games
  }

  // ── Playoff bracket traversal ──
  // The schedule has a letter label column (A, B, C...) before Date
  // Find which game letters involve Pharaohs, then recursively follow "Winner X" references

  // First pass: parse ALL games with their letter labels
  const allGames = []
  for (const tableRows of tables) {
    const headers = tableRows[0].map(h => h.toLowerCase())
    if (!headers.some(h => /date|home|away/i.test(h))) continue

    // Check if there's a label column (single letter like A, B, C)
    const hasLabel = /^[a-z]$/i.test(tableRows[1]?.[0] ?? '')

    for (const row of tableRows.slice(1)) {
      let label = '', dateIdx = 0
      if (hasLabel) { label = row[0]?.trim().toUpperCase(); dateIdx = 1 }

      const g = {}
      const headerOffset = hasLabel ? 1 : 0
      const effectiveHeaders = tableRows[0].slice(headerOffset).map(h => h.toLowerCase())
      effectiveHeaders.forEach((h, i) => {
        const val = row[i + headerOffset] ?? ''
        if (/date/i.test(h))       g.date   = val
        else if (/home/i.test(h))  g.home   = val
        else if (/away/i.test(h))  g.away   = val
        else if (/recap/i.test(h)) g.recap  = val
      })

      if (g.date || g.home || g.away) {
        allGames.push({ label, ...g })
      }
    }
    if (allGames.length) break
  }

  if (allGames.length === 0) return []

  // Second pass: find which game labels the Pharaohs are directly in
  const relevantLabels = new Set()
  for (const g of allGames) {
    if (isPharaoh(g.home) || isPharaoh(g.away)) {
      if (g.label) relevantLabels.add(g.label)
    }
  }

  // Third pass: recursively add games that reference a relevant label
  // e.g. "Winner A" in home/away pulls in that game's label too
  let changed = true
  while (changed) {
    changed = false
    for (const g of allGames) {
      if (!g.label || relevantLabels.has(g.label)) continue
      // Check if home or away references a game we already care about
      const homeRef = g.home?.match(/Winner\s+([A-Z])/i)?.[1]?.toUpperCase()
      const awayRef = g.away?.match(/Winner\s+([A-Z])/i)?.[1]?.toUpperCase()
      if ((homeRef && relevantLabels.has(homeRef)) ||
          (awayRef && relevantLabels.has(awayRef))) {
        relevantLabels.add(g.label)
        changed = true
      }
    }
  }

  // Final pass: convert relevant games to output format
  return allGames
    .filter(g => !g.label || relevantLabels.has(g.label))
    .map(g => {
      const weAreHome = isPharaoh(g.home)
      const opponent  = weAreHome ? g.away : g.home
      let result = '', score = ''
      const recap = g.recap || ''
      const wl  = recap.match(/^([WL])\s*\((\d+)\s*-\s*(\d+)\)/i)
      const tie = recap.match(/tie\s+(\d+)\s*-\s*(\d+)/i)
      if (wl)       { result = wl[1].toUpperCase(); score = `${wl[2]}-${wl[3]}` }
      else if (tie) { result = 'T'; score = `${tie[1]}-${tie[2]}` }
      else if (recap.toLowerCase().includes('forfeit')) { result = isPharaoh(recap.split(' ')[0]) ? 'W' : 'L' }
      return {
        bracketGame: g.label || '',
        date: parseDate(g.date),
        time: parseTime(g.date),
        home: g.home,
        away: g.away,
        opponent,
        score,
        result,
        playoffs: true,
      }
    })
}

function parseGameRow(g, isPlayoffs) {
  const home   = g['home'] || ''
  const away   = g['away'] || ''
  const recap  = g['recap'] || ''
  const dateRaw = g['date'] || ''
  if (!dateRaw && !home && !away) return null
  const weAreHome = isPharaoh(home)
  const opponent  = weAreHome ? away : home
  let result = '', score = ''
  const wl  = recap.match(/^([WL])\s*\((\d+)\s*-\s*(\d+)\)/i)
  const tie = recap.match(/tie\s+(\d+)\s*-\s*(\d+)/i)
  if (wl)       { result = wl[1].toUpperCase(); score = `${wl[2]}-${wl[3]}` }
  else if (tie) { result = 'T'; score = `${tie[1]}-${tie[2]}` }
  else if (recap.toLowerCase().includes('forfeit')) { result = isPharaoh(recap.split(' ')[0]) ? 'W' : 'L' }
  return { date: parseDate(dateRaw), time: parseTime(dateRaw), home, away, opponent, score, result, playoffs: isPlayoffs }
}

// ── Standings ──────────────────────────────────────────────────────────────

function parseStandingsHtml(html) {
  const tables = extractStandingsTables(html)
  for (const tableRows of tables) {
    const headers = tableRows[0].map(h => h.toLowerCase())
    if (!headers.some(h => /team|name/i.test(h))) continue
    const objs = tableToObjects(tableRows)
    const standings = objs.map(t => ({
      team: t['team'] || t['name'] || '',
      gp:  parseInt(t['gp'])  || 0,
      w:   parseInt(t['w'])   || 0,
      l:   parseInt(t['l'])   || 0,
      t:   parseInt(t['t'])   || 0,
      pts: parseInt(t['pts']) || 0,
      gf:  parseInt(t['gf'])  || 0,
      ga:  parseInt(t['ga'])  || 0,
    })).filter(t => t.team)
    if (standings.length) return standings
  }
  return []
}

// ── Main scrape ────────────────────────────────────────────────────────────

async function main() {
  // ── Establish session first ──
  console.log('Establishing session...')
  await fetchHtml(`schedule.php?team=${TEAM_ID}`)
  console.log('Session cookie:', sessionCookie)

  // ── Regular season roster ──
  console.log('Scraping regular season roster...')
  const rsRosterHtml = await fetchHtml(`rosters.php?team=${TEAM_ID}`)
  const { players, goalies } = parseRosterHtml(rsRosterHtml)
  writeJson('roster.json', { players, goalies })

  // ── Playoff roster ──
  console.log('Scraping playoff roster...')
  const poRosterHtml = await fetchHtml(`actions.php?playoffs=yes&page=rosters&team=${TEAM_ID}&div=${DIV_ID}`)
  const { players: poPlayers, goalies: poGoalies } = parseRosterHtml(poRosterHtml)
  writeJson('rosterPlayoffs.json', { players: poPlayers, goalies: poGoalies })

  // ── Regular season schedule ──
  console.log('Scraping regular season schedule...')
  const rsSchedHtml = await fetchHtml(`actions.php?playoffs=no&page=schedule&team=${TEAM_ID}&div=${DIV_ID}`)
  const rsGames = parseScheduleHtml(rsSchedHtml, false)

  // ── Playoff schedule ──
  console.log('Scraping playoff schedule...')
  const poSchedHtml = await fetchHtml(`actions.php?playoffs=yes&page=schedule&team=&div=${DIV_ID}`)
  const poGames = parseScheduleHtml(poSchedHtml, true)

  writeJson('schedule.json', { games: [...rsGames, ...poGames] })

  // ── Standings ──
  console.log('Scraping standings...')
  const standHtml = await fetchHtml(`actions.php?playoffs=no&page=standings&team=&div=${DIV_ID}`)
  const standings = parseStandingsHtml(standHtml)
  writeJson('standings.json', { standings })

  console.log(`\nDone.`)
  console.log(`  Regular season: ${players.length} skaters, ${goalies.length} goalies, ${rsGames.length} games`)
  console.log(`  Playoffs:       ${poPlayers.length} skaters, ${poGoalies.length} goalies, ${poGames.length} games`)
  console.log(`  Standings:      ${standings.length} teams`)
}

main().catch(e => { console.error('Scrape failed:', e); process.exit(1) })
