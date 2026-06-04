/**
 * Stiltweb historical scraper
 * Scans all historical div IDs on stiltweb.com/eLeague/fhl,
 * finds every div containing the Pharaohs, and scrapes:
 *   - Playoff roster stats (rosters.php?div=N&playoffs=yes)
 *   - Playoff schedule with bracket traversal (schedule.php?div=N&playoffs=yes)
 *   - Season name from breadcrumb
 *
 * Merges results into history.json alongside the russianrocket data.
 *
 * Usage: node scripts/scrapeStiltweb.js
 */

import https from 'https'
import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR  = join(__dirname, '../src/data')
const BASE      = 'https://www.stiltweb.com/eLeague/fhl'

// Known Pharaohs div IDs — hardcoded from scan on 2026-06-04
// Re-run with SCAN_MODE=1 to rediscover if needed
const PHARAOH_DIVS = [167, 168, 176, 185, 191, 204, 210, 232, 242, 250, 259, 268, 277, 287, 297, 300, 312]

// Div range for discovery scan (only used when SCAN_MODE=1)
const DIV_START = 1
const DIV_END   = 319

let sessionCookie = ''

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchHtml(path, retries = 2) {
  const url = path.startsWith('http') ? path : `${BASE}/${path}`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const req = https.get(url, {
          headers: { Referer: `${BASE}/`, Cookie: sessionCookie }
        }, res => {
          // Capture/merge cookies
          if (res.headers['set-cookie']) {
            const newCookies = res.headers['set-cookie'].map(c => c.split(';')[0])
            const cookieMap = {}
            sessionCookie.split(';').filter(Boolean).forEach(c => {
              const [k, v] = c.trim().split('='); cookieMap[k] = v
            })
            newCookies.forEach(c => { const [k, v] = c.split('='); cookieMap[k] = v })
            sessionCookie = Object.entries(cookieMap).map(([k,v]) => `${k}=${v}`).join('; ')
          }
          // Follow 302 redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const loc = res.headers.location.startsWith('http')
              ? res.headers.location
              : `${BASE}/${res.headers.location.replace(/^.*\/fhl\//, '')}`
            res.resume()
            return fetchHtml(loc, retries - attempt).then(resolve).catch(reject)
          }
          let d = ''
          res.on('data', c => d += c)
          res.on('end', () => resolve(d))
        })
        req.on('error', reject)
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')) })
      })
      return result
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 1000))
    }
  }
}

function isPharaoh(t) { return /phar/i.test(t ?? '') }

// Extract tables with class='standings', depth-aware
function extractTables(html) {
  const tables = []
  const openRe = /<[Tt][Aa][Bb][Ll][Ee][^>]*class='standings'[^>]*>/g
  let m
  while ((m = openRe.exec(html)) !== null) {
    let depth = 1, pos = m.index + m[0].length
    while (depth > 0 && pos < html.length) {
      const next = html.indexOf('<', pos)
      if (next === -1) break
      const tag = html.slice(next, next + 8).toLowerCase()
      if (tag.startsWith('<table'))       { depth++; pos = next + 6 }
      else if (tag.startsWith('</table')) { depth--; pos = next + 8 }
      else pos = next + 1
    }
    const tableHtml = html.slice(m.index, pos)
    const rows = []
    for (const row of tableHtml.matchAll(/<[Tt][Rr][^>]*>([\s\S]*?)<\/[Tt][Rr]>/gi)) {
      const cells = [...row[1].matchAll(/<[Tt][HhDd][^>]*>([\s\S]*?)<\/[Tt][HhDd]>/gi)]
        .map(c => c[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'').replace(/&amp;/g,'&').trim())
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
  const long = raw.match(/\w+,\s+(\w+)\s+(\d+),\s+(\d{4})/i)
  if (long) {
    const months = {january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
                    july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'}
    return `${long[3]}-${months[long[1].toLowerCase()]||'01'}-${long[2].padStart(2,'0')}`
  }
  const mdy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return raw.trim()
}

function parseTime(raw) {
  return raw?.match(/(\d+:\d+\s*[AP]M)/i)?.[1] || ''
}

// ── Get season name for a div ──────────────────────────────────────────────

async function getSeasonName(divId) {
  const html = await fetchHtml(`standings.php?div=${divId}`)
  // Breadcrumb: "Summer 2022 \ C \ ..."
  const bc = html.match(/class='content-title[^']*'[^>]*>([\s\S]*?)<\/div>/)?.[1]
    ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  // Try to extract season name from first breadcrumb link
  const seasonLink = html.match(/<a href='standings\.php'>([^<]+)<\/a>/i)?.[1]?.trim()
  return seasonLink || bc?.split('\\')[0]?.trim() || `Div ${divId}`
}

// ── Scrape playoff roster for a div ───────────────────────────────────────

async function scrapePlayoffRoster(divId) {
  const html = await fetchHtml(`rosters.php?div=${divId}&playoffs=yes`)
  if (!isPharaoh(html)) return null

  const players = [], goalies = []
  let currentTeam = ''

  // Team headers appear as content-title links before each table
  // Find team name sections containing Pharaohs
  const teamSections = html.split(/(?=<div class='content-body'>)/i)

  for (const section of teamSections) {
    const teamName = section.match(/class='content-title[^']*'[^>]*>[\s\S]*?\\[^\\]*\\([^\\<]+)/i)?.[1]?.trim()
      || section.match(/<strong>([^<]+)<\/strong>/i)?.[1]?.trim()
    if (teamName) currentTeam = teamName

    if (!isPharaoh(currentTeam) && !isPharaoh(section.slice(0, 200))) continue

    const tables = extractTables(section)
    for (const tableRows of tables) {
      const headers = tableRows[0].map(h => h.toLowerCase())
      const isGoalie = headers.includes('gaa') || headers.includes('pctg') || headers.includes('saves')
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
            sv: parseInt(p['saves']||p['sv']) || 0,
            svpct: p['pctg'] || p['sv%'] || '',
            gaa: p['gaa'] || '',
            so: parseInt(p['so']) || 0,
          })
        } else {
          players.push({
            number: p['#'] || '',
            name: p['name'],
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
  }

  // Fallback: if section parsing didn't work, grab all tables
  if (players.length === 0) {
    const allTables = extractTables(html)
    for (const tableRows of allTables) {
      const headers = tableRows[0].map(h => h.toLowerCase())
      const isGoalie = headers.includes('gaa') || headers.includes('pctg')
      const objs = tableToObjects(tableRows)
      for (const p of objs) {
        if (!p['name']) continue
        if (isGoalie) goalies.push({ name: p['name'], gp: parseInt(p['gp'])||0, w: parseInt(p['w'])||0, l: parseInt(p['l'])||0, gaa: p['gaa']||'' })
        else players.push({ name: p['name'], gp: parseInt(p['gp'])||0, g: parseInt(p['g'])||0, a: parseInt(p['a'])||0, pts: parseInt(p['pts'])||0, pim: parseInt(p['pim'])||0 })
      }
    }
  }

  return players.length > 0 ? { players, goalies } : null
}

// ── Scrape playoff schedule for a div ─────────────────────────────────────

async function scrapePlayoffSchedule(divId) {
  // Step 1: switch session to playoff mode for this div
  const switchRes = await fetchHtml(`actions.php?playoffs=yes&page=results&team=&div=${divId}`)
  // actions.php returns a redirect — follow it (fetchHtml handles 302s via the redirect logic)
  // The session is now in playoff mode

  // Step 2: load the results page in playoff mode to get playoff game IDs
  const resultsHtml = await fetchHtml(`results.php?div=${divId}`)
  const gameIds = [...new Set(
    [...resultsHtml.matchAll(/results\.php\?game=(\d+)/gi)].map(m => parseInt(m[1]))
  )].sort((a, b) => a - b)

  if (gameIds.length === 0) return []
  console.log(`    div ${divId}: ${gameIds.length} playoff game IDs: ${gameIds.join(', ')}`)

  // Step 3: fetch each game recap and parse
  const games = []
  for (const gameId of gameIds) {
    try {
      const gameHtml = await fetchHtml(`results.php?game=${gameId}`)
      const game = parseGameRecap(gameHtml, gameId)
      if (game) games.push(game)
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.warn(`    Error fetching game ${gameId}:`, e.message)
    }
  }

  // Step 4: switch back to regular season mode
  await fetchHtml(`actions.php?playoffs=no&page=results&team=&div=${divId}`)

  const pharGames = games.filter(g => isPharaoh(g.home) || isPharaoh(g.away))
  console.log(`    ${pharGames.length} Pharaohs playoff games out of ${games.length} total`)
  return pharGames
}

function parseGameRecap(html, gameId) {
  // Team links: href='results.php?team=N'>TeamName</a>
  const teamLinks = [...html.matchAll(/href='results\.php\?team=\d+'[^>]*>([^<]+)<\/a>/gi)]
    .map(m => m[1].trim())
  if (teamLinks.length < 2) return null

  const home = teamLinks[0]
  const away = teamLinks[1]

  // Score rows format: [TeamName, P1, P2, P3, FinalScore]
  // These are the first two data rows in the recap table
  const allRows = [...html.matchAll(/<TR[^>]*>([\s\S]*?)<\/TR>/gi)]
    .map(r => [...r[1].matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/gi)]
      .map(c => c[1].replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'').trim()))
    .filter(r => r.length >= 4 && r.some(c => c))

  // Score rows: exactly 4-5 cells, first cell is team name, last cell is a number
  const scoreRows = allRows.filter(r =>
    r.length >= 4 &&
    /^\d+$/.test(r[r.length - 1]) &&
    (r[0] === home || r[0] === away || isPharaoh(r[0]))
  )

  let homeScore = null, awayScore = null
  for (const row of scoreRows) {
    const finalScore = parseInt(row[row.length - 1])
    if (isNaN(finalScore)) continue
    if (row[0] === home || isPharaoh(row[0]) && isPharaoh(home)) homeScore = finalScore
    else if (row[0] === away) awayScore = finalScore
    else if (homeScore === null) homeScore = finalScore
    else if (awayScore === null) awayScore = finalScore
  }

  // Fallback: just take first two score rows by order
  if ((homeScore === null || awayScore === null) && scoreRows.length >= 2) {
    homeScore = parseInt(scoreRows[0][scoreRows[0].length - 1])
    awayScore = parseInt(scoreRows[1][scoreRows[1].length - 1])
  }

  const dateText = html.match(/(\w+,\s+\w+\s+\d+,\s+\d{4})/)?.[1] || ''
  const timeText = html.match(/(\d+:\d+\s*[AP]M)/i)?.[1] || ''

  const weAreHome = isPharaoh(home)
  let result = '', score = ''
  if (homeScore !== null && awayScore !== null) {
    score = weAreHome ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`
    const pharScore = weAreHome ? homeScore : awayScore
    const oppScore  = weAreHome ? awayScore : homeScore
    if (pharScore > oppScore)      result = 'W'
    else if (pharScore < oppScore) result = 'L'
    else                           result = 'T'
  }

  return {
    gameId,
    bracketGame: '',
    date: parseDate(dateText),
    time: parseTime(timeText),
    home, away,
    opponent: weAreHome ? away : home,
    score, result, playoffs: true,
  }
}

// ── Infer playoff result from bracket ─────────────────────────────────────

function inferPlayoffResult(games) {
  if (!games || games.length === 0) return null

  // Only look at completed games (have a result)
  const completed = games.filter(g => g.result)
  if (completed.length === 0) return null

  // Sort by date ascending
  const sorted = [...completed].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const totalGames = sorted.length
  const lastGame = sorted[totalGames - 1]
  const wonLast = lastGame?.result === 'W'

  // Infer round depth from total number of Pharaohs playoff games
  // 1 game = first round exit or bye+loss
  // 2-3 games = made it further
  // 4+ games = deep run
  if (wonLast) {
    // Won their last game — how deep?
    if (totalGames >= 4) return '🏆 Champions'
    if (totalGames === 3) return '🏆 Champions'
    if (totalGames === 2) return '🥈 Runner-up'
    return '🥉 Semifinal'
  } else {
    // Lost their last game — what round?
    if (totalGames >= 4) return '🥈 Runner-up'
    if (totalGames === 3) return '🥉 Semifinal'
    if (totalGames === 2) return 'Quarterfinal'
    return 'First Round'
  }
}

async function main() {
  // Establish session — required for actions.php to honor playoffs=yes
  await fetchHtml('schedule.php')
  console.log('Session established')

  let pharaohDivs = PHARAOH_DIVS

  // Only scan if explicitly requested
  if (process.env.SCAN_MODE === '1') {
    console.log(`Scanning divs ${DIV_START}–${DIV_END} for Pharaohs...`)
    pharaohDivs = []
    let consecutiveEmpty = 0
    for (let div = DIV_START; div <= DIV_END; div++) {
      try {
        const html = await fetchHtml(`rosters.php?div=${div}`)
        const hasData = html.includes("class='standings'")
        if (isPharaoh(html)) { process.stdout.write(`P(${div})`); pharaohDivs.push(div); consecutiveEmpty = 0 }
        else if (hasData)    { process.stdout.write('.'); consecutiveEmpty = 0 }
        else {
          process.stdout.write('-'); consecutiveEmpty++
          if (consecutiveEmpty >= 30 && pharaohDivs.length === 0 && div < 100) {
            process.stdout.write(`(skip to ${div + 20})`); div += 19
          }
        }
      } catch { process.stdout.write('!'); consecutiveEmpty++ }
      await new Promise(r => setTimeout(r, 150))
    }
    console.log(`\nFound Pharaohs in ${pharaohDivs.length} divs: ${pharaohDivs.join(', ')}`)
  } else {
    console.log(`Using ${pharaohDivs.length} hardcoded Pharaohs divs: ${pharaohDivs.join(', ')}`)
  }

  // For each div with Pharaohs, scrape playoff data
  const playoffSeasons = []
  for (const div of pharaohDivs) {
    console.log(`\nScraping div ${div}...`)
    const [seasonName, rosterData, scheduleGames] = await Promise.all([
      getSeasonName(div),
      scrapePlayoffRoster(div),
      scrapePlayoffSchedule(div),
    ])

    if (!rosterData && scheduleGames.length === 0) {
      console.log(`  No playoff data found`)
      continue
    }

    const record = { w: 0, l: 0, t: 0 }
    scheduleGames.forEach(g => {
      if (g.result === 'W') record.w++
      else if (g.result === 'L') record.l++
      else if (g.result === 'T') record.t++
    })

    const playoffResult = inferPlayoffResult(scheduleGames)

    playoffSeasons.push({
      divId: div,
      seasonName,
      source: 'stiltweb',
      record,
      skaters: rosterData?.players || [],
      goalies: rosterData?.goalies || [],
      games: scheduleGames,
      playoffResult,
    })
    console.log(`  ${seasonName}: ${scheduleGames.length} playoff games, record ${record.w}-${record.l}-${record.t}, result: ${playoffResult || 'unknown'}`)
  }

  // Merge into existing history.json
  const existing = JSON.parse(readFileSync(join(DATA_DIR, 'history.json'), 'utf8'))

  // Group by season name — when two divs match the same season (C1 vs C2),
  // keep the one with more completed Pharaohs games (that's our division)
  const grouped = {}
  for (const po of playoffSeasons) {
    const key = po.seasonName
    if (!grouped[key]) { grouped[key] = po; continue }
    const existingCompleted = grouped[key].games.filter(g => g.result).length
    const newCompleted      = po.games.filter(g => g.result).length
    if (newCompleted > existingCompleted) { grouped[key] = po; continue }
    if (newCompleted === existingCompleted && po.skaters.length > grouped[key].skaters.length) grouped[key] = po
  }

  for (const po of Object.values(grouped)) {
    const match = existing.seasons.find(s =>
      s.seasonName?.toLowerCase().includes(po.seasonName?.toLowerCase()) ||
      po.seasonName?.toLowerCase().includes(s.seasonName?.toLowerCase())
    )
    if (match) {
      match.playoffs = { record: po.record, skaters: po.skaters, goalies: po.goalies, games: po.games, playoffResult: po.playoffResult }
      match.playoffDivId = po.divId
      const completed = po.games.filter(g => g.result).length
      console.log(`Merged playoff data into ${match.seasonName} (${completed} completed games, result: ${po.playoffResult})`)
    } else {
      existing.seasons.push({
        seasonName: po.seasonName,
        seasonId: String(po.divId),
        divId: po.divId,
        source: 'stiltweb',
        record: { w: 0, l: 0, t: 0 },
        skaters: [], goalies: [], games: [],
        playoffs: { record: po.record, skaters: po.skaters, goalies: po.goalies, games: po.games, playoffResult: po.playoffResult }
      })
      console.log(`Added new season entry: ${po.seasonName} (result: ${po.playoffResult})`)
    }
  }

  existing._updated = new Date().toISOString()
  writeFileSync(join(DATA_DIR, 'history.json'), JSON.stringify(existing, null, 2))
  console.log(`\n✓ Updated history.json with ${playoffSeasons.length} playoff season(s)`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
