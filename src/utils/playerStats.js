/**
 * Player stats aggregation utilities
 * Uses Jaro-Winkler string similarity for fuzzy name matching across seasons
 * (handles typos like "Pharoahs" vs "Pharaohs", name formatting differences, etc.)
 */

// ── Jaro-Winkler similarity ────────────────────────────────────────────────

function jaro(s1, s2) {
  if (s1 === s2) return 1
  const l1 = s1.length, l2 = s2.length
  if (l1 === 0 || l2 === 0) return 0

  const matchDist = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0)
  const s1Matches = new Array(l1).fill(false)
  const s2Matches = new Array(l2).fill(false)
  let matches = 0, transpositions = 0

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDist)
    const end   = Math.min(i + matchDist + 1, l2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = s2Matches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < l1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  return (matches / l1 + matches / l2 + (matches - transpositions / 2) / matches) / 3
}

function jaroWinkler(s1, s2, p = 0.1) {
  const j = jaro(s1, s2)
  let prefix = 0
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++
    else break
  }
  return j + prefix * p * (1 - j)
}

function normalize(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Find the best matching canonical name from the existing player map.
 * Returns the canonical name if similarity >= threshold, otherwise null.
 */
export function findMatch(name, canonicalNames, threshold = 0.88) {
  const norm = normalize(name)
  let bestScore = 0, bestName = null

  for (const canonical of canonicalNames) {
    const score = jaroWinkler(norm, normalize(canonical))
    if (score > bestScore) {
      bestScore = score
      bestName = canonical
    }
  }
  return bestScore >= threshold ? bestName : null
}

// ── Aggregate all players across seasons ──────────────────────────────────

export function aggregatePlayers(seasons) {
  const playerMap = new Map()

  for (const season of seasons) {
    const seasonName = season.seasonName

    // Only use regular season skaters — these come from team-specific pages
    // and are definitively Pharaohs players. Playoff skaters come from division-
    // level pages and may include non-Pharaohs players.
    for (const p of (season.skaters || [])) {
      if (!p.name || p.name.toLowerCase().includes('substitute')) continue
      addSkater(playerMap, p, seasonName, false)
    }

    // Same for goalies
    for (const g of (season.goalies || [])) {
      if (!g.name || g.name.toLowerCase().includes('substitute')) continue
      addGoalie(playerMap, g, seasonName, false)
    }
  }

  return [...playerMap.values()].sort((a, b) => b.totals.pts - a.totals.pts)
}

function addSkater(playerMap, p, seasonName, isPlayoffs) {
  const canonical = resolveCanonical(playerMap, p.name)

  if (!playerMap.has(canonical)) {
    playerMap.set(canonical, {
      name: canonical,
      isGoalie: false,
      seasons: [],
      totals: { gp: 0, g: 0, a: 0, pts: 0, ppg: 0, shg: 0, pim: 0,
                poGp: 0, poG: 0, poA: 0, poPts: 0, poPim: 0 }
    })
  }

  const entry = playerMap.get(canonical)
  let seasonEntry = entry.seasons.find(s => s.season === seasonName)
  if (!seasonEntry) {
    seasonEntry = { season: seasonName, gp: 0, g: 0, a: 0, pts: 0, pim: 0,
                    poGp: 0, poG: 0, poA: 0, poPts: 0, poPim: 0 }
    entry.seasons.push(seasonEntry)
  }

  if (isPlayoffs) {
    seasonEntry.poGp  += p.gp  || 0
    seasonEntry.poG   += p.g   || 0
    seasonEntry.poA   += p.a   || 0
    seasonEntry.poPts += p.pts || 0
    seasonEntry.poPim += p.pim || 0
    entry.totals.poGp  += p.gp  || 0
    entry.totals.poG   += p.g   || 0
    entry.totals.poA   += p.a   || 0
    entry.totals.poPts += p.pts || 0
    entry.totals.poPim += p.pim || 0
  } else {
    seasonEntry.gp  += p.gp  || 0
    seasonEntry.g   += p.g   || 0
    seasonEntry.a   += p.a   || 0
    seasonEntry.pts += p.pts || 0
    seasonEntry.pim += p.pim || 0
    entry.totals.gp  += p.gp  || 0
    entry.totals.g   += p.g   || 0
    entry.totals.a   += p.a   || 0
    entry.totals.pts += p.pts || 0
    entry.totals.ppg = (entry.totals.ppg || 0) + (p.ppg || 0)
    entry.totals.shg = (entry.totals.shg || 0) + (p.shg || 0)
    entry.totals.pim += p.pim || 0
  }
}

function addGoalie(playerMap, g, seasonName, isPlayoffs) {
  const canonical = resolveCanonical(playerMap, g.name)

  if (!playerMap.has(canonical)) {
    playerMap.set(canonical, {
      name: canonical,
      isGoalie: true,
      seasons: [],
      totals: { gp: 0, w: 0, l: 0, t: 0, ga: 0, so: 0, pim: 0,
                poGp: 0, poW: 0, poL: 0, poGA: 0 }
    })
  }

  const entry = playerMap.get(canonical)
  let seasonEntry = entry.seasons.find(s => s.season === seasonName)
  if (!seasonEntry) {
    seasonEntry = { season: seasonName, gp: 0, w: 0, l: 0, t: 0, ga: 0, so: 0,
                    poGp: 0, poW: 0, poL: 0 }
    entry.seasons.push(seasonEntry)
  }

  if (isPlayoffs) {
    seasonEntry.poGp += g.gp || 0
    seasonEntry.poW  += g.w  || 0
    seasonEntry.poL  += g.l  || 0
    entry.totals.poGp += g.gp || 0
    entry.totals.poW  += g.w  || 0
    entry.totals.poL  += g.l  || 0
  } else {
    seasonEntry.gp += g.gp || 0
    seasonEntry.w  += g.w  || 0
    seasonEntry.l  += g.l  || 0
    seasonEntry.t  += g.t  || 0
    seasonEntry.ga += g.ga || 0
    seasonEntry.so += g.so || 0
    entry.totals.gp += g.gp || 0
    entry.totals.w  += g.w  || 0
    entry.totals.l  += g.l  || 0
    entry.totals.t  += g.t  || 0
    entry.totals.ga += g.ga || 0
    entry.totals.so += g.so || 0
  }
}

/**
 * Resolve a name to a canonical form using Jaro-Winkler matching.
 * If a close enough existing canonical exists, return it.
 * Otherwise add the new name as canonical.
 */
function resolveCanonical(playerMap, name) {
  const existing = [...playerMap.keys()]
  const match = findMatch(name, existing, 0.88)
  if (match) return match
  // New player — use this name as canonical
  return name
}

// ── All-time leaders ──────────────────────────────────────────────────────

export function getAllTimeLeaders(players, count = 5) {
  const skaters = players.filter(p => !p.isGoalie)
  const goalies = players.filter(p => p.isGoalie)

  return {
    goals:       top(skaters, 'g',   count),
    assists:     top(skaters, 'a',   count),
    points:      top(skaters, 'pts', count),
    gamesPlayed: top(skaters, 'gp',  count),
    pim:         top(skaters, 'pim', count),
    goalieWins:  top(goalies, 'w',   count),
    goalieGP:    top(goalies, 'gp',  count),
  }
}

function top(players, stat, count) {
  return [...players]
    .filter(p => (p.totals[stat] || 0) > 0)
    .sort((a, b) => (b.totals[stat] || 0) - (a.totals[stat] || 0))
    .slice(0, count)
}
