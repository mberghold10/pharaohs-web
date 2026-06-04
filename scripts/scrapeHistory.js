/**
 * Pharaohs history scraper — russianrocket.net
 * Finds all Pharaohs team pages across every season, scrapes
 * roster stats and schedule, writes to src/data/history.json.
 *
 * Usage: node scripts/scrapeHistory.js
 *
 * Note: russianrocket.net has an expired SSL cert — we disable
 * certificate verification for this internal/trusted site only.
 */

import https from 'https'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '../src/data')
const BASE = 'https://russianrocket.net'

// Agent that ignores the expired cert on this specific trusted site
const agent = new https.Agent({ rejectUnauthorized: false })

// ── Helpers ────────────────────────────────────────────────────────────────

async function fetchHtml(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}${path}`
    https.get(url, { agent }, res => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })
}

// Minimal HTML parser using regex — sufficient for this structured site
function extractTable(html, tableId) {
  const tableMatch = html.match(new RegExp(`id=['"]${tableId}['"][^>]*>([\\s\\S]*?)</table>`))
  if (!tableMatch) return []

  const rows = []
  const rowMatches = tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)
  for (const row of rowMatches) {
    const cells = []
    const cellMatches = row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
    for (const cell of cellMatches) {
      // Strip tags, decode basic entities
      const text = cell[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
        .trim()
      cells.push(text)
    }
    if (cells.length) rows.push(cells)
  }
  return rows
}

function extractLinks(html, pattern) {
  const matches = []
  // Match href anywhere in an <a> tag, regardless of other attributes
  const re = new RegExp(`<a[^>]+href="(${pattern}[^"]*)"[^>]*>([^<]+)`, 'gi')
  for (const m of html.matchAll(re)) {
    matches.push({ href: m[1], text: m[2].trim() })
  }
  return matches
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

// ── Scrape seasons list ────────────────────────────────────────────────────

async function scrapeSeasons() {
  console.log('Fetching seasons list...')
  const html = await fetchHtml('/seasons')

  // Seasons are: <a ... href="/leagues/293">...<h3>Winter 2025</h3>...</a>
  const seen = new Set()
  const seasons = []

  // Match the whole anchor block including inner h3
  const re = /<a[^>]+href="(\/leagues\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi
  for (const m of html.matchAll(re)) {
    const href = m[1]
    const id = m[2]
    if (seen.has(id)) continue
    seen.add(id)
    // Extract text from inner h3 or fall back to stripped inner text
    const h3 = m[3].match(/<h3[^>]*>([^<]+)<\/h3>/i)
    const name = h3 ? h3[1].trim() : m[3].replace(/<[^>]+>/g, '').trim()
    if (name) seasons.push({ id, name, href })
  }

  console.log(`Found ${seasons.length} seasons:`, seasons.map(s => s.name).join(', '))
  return seasons
}

// ── Find Pharaohs team in a league ────────────────────────────────────────

async function findPharaohsInSeason(leagueId, seasonName) {
  const html = await fetchHtml(`/leagues/${leagueId}`)

  // The nav sidebar lists all teams — find ones matching "pharaoh"
  const teamLinks = extractLinks(html, '/teams/')
  const pharaohLinks = teamLinks.filter(l =>
    l.text.toLowerCase().includes('phar')
  )
  if (pharaohLinks.length === 0) return null

  const seen = new Set()
  return pharaohLinks.filter(l => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  }).map(l => ({ ...l, seasonName }))
}

// ── Scrape a team page ─────────────────────────────────────────────────────

async function scrapeTeamPage(teamHref, seasonName) {
  console.log(`  Scraping ${teamHref} (${seasonName})`)
  const html = await fetchHtml(teamHref)

  // Extract season/league from breadcrumb
  const breadcrumb = html.match(/<ol class='breadcrumb[^>]*>([\s\S]*?)<\/ol>/)?.[1] ?? ''
  const crumbs = breadcrumb.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  // Skater table
  const skaterRows = extractTable(html, 'skater_table')
  const skaters = tableToObjects(skaterRows).map(p => ({
    number: p['#'] || '',
    name: p['name'] || '',
    gp: parseInt(p['gp']) || 0,
    g: parseInt(p['g']) || 0,
    a: parseInt(p['a']) || 0,
    pts: parseInt(p['pts']) || 0,
    ppg: parseInt(p['ppg']) || 0,
    ppa: parseInt(p['ppa']) || 0,
    shg: parseInt(p['shg']) || 0,
    sha: parseInt(p['sha']) || 0,
    pim: parseInt(p['pim']) || 0,
  })).filter(p => p.name && p.name !== 'Name')

  // Goalie table
  const goalieRows = extractTable(html, 'goalie_table')
  const goalies = tableToObjects(goalieRows).map(g => ({
    number: g['#'] || '',
    name: g['name'] || '',
    gp: parseInt(g['gp']) || 0,
    w: parseInt(g['w']) || 0,
    l: parseInt(g['l']) || 0,
    t: parseInt(g['t']) || 0,
    ga: parseInt(g['ga']) || 0,
    sa: parseInt(g['sa']) || 0,
    sv: parseInt(g['sv']) || 0,
    svpct: g['sv%'] || '',
    gaa: g['gaa'] || '',
    so: parseInt(g['so']) || 0,
    pim: parseInt(g['pim']) || 0,
  })).filter(g => g.name && g.name !== 'Name')

  // Schedule table
  const scheduleRows = extractTable(html, 'schedule_table')
  const games = tableToObjects(scheduleRows).map(g => {
    const isPharaoh = t => t?.toLowerCase().includes('phar')
    const home = g['home'] || ''
    const away = g['away'] || ''
    const recap = g['recap'] || ''
    const weAreHome = isPharaoh(home)
    const opponent = weAreHome ? away : home

    // Parse result from recap e.g. "Pharoahs 7 - 4" or "Blue Crabs 12 - 1"
    let result = '', score = recap
    const scoreMatch = recap.match(/(\d+)\s*-\s*(\d+)/)
    if (scoreMatch) {
      const winnerText = recap.split(/\d/)[0].trim().toLowerCase()
      if (isPharaoh(winnerText)) result = 'W'
      else if (recap.toLowerCase().includes('tie')) result = 'T'
      else if (recap.toLowerCase().includes('forfeit')) result = 'W' // forfeit in our favor
      else result = 'L'
    }

    return {
      date: g['date'] || '',
      home,
      away,
      opponent,
      score,
      result,
    }
  }).filter(g => g.date)

  // Record: W/L/T from games
  const record = { w: 0, l: 0, t: 0 }
  games.forEach(g => {
    if (g.result === 'W') record.w++
    else if (g.result === 'L') record.l++
    else if (g.result === 'T') record.t++
  })

  return { breadcrumb: crumbs, skaters, goalies, games, record }
}

// ── Merge/deduplicate multiple Pharaohs teams in one season ───────────────

function datesOverlap(gamesA, gamesB) {
  const datesA = new Set(gamesA.map(g => g.date).filter(Boolean))
  return gamesB.some(g => g.date && datesA.has(g.date))
}

function mergeTeams(entries) {
  // 1. Discard entries with no games
  const withGames = entries.filter(e => e.games.length > 0)
  if (withGames.length === 0) return null
  if (withGames.length === 1) return withGames[0]

  // 2. Check for schedule overlap between all pairs
  for (let i = 0; i < withGames.length; i++) {
    for (let j = i + 1; j < withGames.length; j++) {
      if (datesOverlap(withGames[i].games, withGames[j].games)) {
        // Overlap = likely different teams with the same name, can't merge
        // Keep the one with more games
        console.log(`    Schedule overlap detected — keeping team with most games`)
        return withGames.sort((a, b) => b.games.length - a.games.length)[0]
      }
    }
  }

  // 3. No overlap — combine into one entry
  console.log(`    No schedule overlap — merging ${withGames.length} entries`)
  const merged = { ...withGames[0] }
  for (const entry of withGames.slice(1)) {
    merged.games = [...merged.games, ...entry.games]
    // Merge skaters: combine by name, summing stats
    for (const player of entry.skaters) {
      const existing = merged.skaters.find(p => p.name === player.name)
      if (existing) {
        existing.gp  += player.gp
        existing.g   += player.g
        existing.a   += player.a
        existing.pts += player.pts
        existing.ppg += player.ppg
        existing.ppa += player.ppa
        existing.shg += player.shg
        existing.sha += player.sha
        existing.pim += player.pim
      } else {
        merged.skaters.push({ ...player })
      }
    }
    // Merge goalies similarly
    for (const goalie of entry.goalies) {
      const existing = merged.goalies.find(g => g.name === goalie.name)
      if (existing) {
        existing.gp += goalie.gp
        existing.w  += goalie.w
        existing.l  += goalie.l
        existing.t  += goalie.t
        existing.ga += goalie.ga
        existing.sa += goalie.sa
        existing.sv += goalie.sv
        existing.so += goalie.so
        existing.pim += goalie.pim
        // Recalculate sv% and gaa
        existing.svpct = existing.sa > 0 ? (existing.sv / existing.sa).toFixed(3) : '0.000'
        existing.gaa   = existing.gp  > 0 ? (existing.ga / existing.gp).toFixed(2) : '0.00'
      } else {
        merged.goalies.push({ ...goalie })
      }
    }
    // Recalculate record
    merged.record = { w: 0, l: 0, t: 0 }
    merged.games.forEach(g => {
      if (g.result === 'W') merged.record.w++
      else if (g.result === 'L') merged.record.l++
      else if (g.result === 'T') merged.record.t++
    })
    // Note the merge in breadcrumb
    merged.breadcrumb = merged.breadcrumb || entry.breadcrumb
  }
  return merged
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const seasons = await scrapeSeasons()
  const history = []

  for (const season of seasons) {
    process.stdout.write(`Checking season: ${season.name} (league ${season.id})... `)
    let teamEntries
    try {
      teamEntries = await findPharaohsInSeason(season.id, season.name)
    } catch (e) {
      console.log(`error: ${e.message}`)
      continue
    }

    if (!teamEntries || teamEntries.length === 0) {
      console.log('no Pharaohs found')
      continue
    }
    console.log(`found ${teamEntries.length} Pharaohs team(s)`)

    // Scrape all candidate team pages
    const scraped = []
    for (const entry of teamEntries) {
      const teamId = entry.href.match(/\/teams\/(\d+)/)?.[1]
      try {
        const data = await scrapeTeamPage(entry.href, season.name)
        scraped.push({
          seasonId: season.id,
          seasonName: season.name,
          teamId,
          teamHref: entry.href,
          breadcrumb: data.breadcrumb,
          record: data.record,
          skaters: data.skaters,
          goalies: data.goalies,
          games: data.games,
        })
        await new Promise(r => setTimeout(r, 300))
      } catch (e) {
        console.warn(`  Error scraping ${entry.href}: ${e.message}`)
      }
    }

    // Merge/deduplicate into a single entry per season
    const merged = mergeTeams(scraped)
    if (merged) {
      history.push(merged)
    } else {
      console.log(`    All entries discarded (no games)`)
    }
  }

  history.sort((a, b) => parseInt(b.seasonId) - parseInt(a.seasonId))

  const output = { _updated: new Date().toISOString(), seasons: history }
  writeFileSync(join(DATA_DIR, 'history.json'), JSON.stringify(output, null, 2))
  console.log(`\n✓ Wrote history.json — ${history.length} Pharaohs season(s) found`)
}

main().catch(e => { console.error(e); process.exit(1) })
