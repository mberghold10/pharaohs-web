/**
 * useArchive — fetches Pharaohs data from archive.fairfax.beer
 *
 * Single hook that loads the team overview on mount and exposes
 * per-division loaders for current-season detail.
 */

import { useState, useEffect } from 'react'

const BASE = 'https://archive.fairfax.beer'

// ── Transform archive season → History.jsx season shape ───────────────────

function transformSeason(archiveSeason) {
  const { seasonName, divId, divisionLabel, record, roster, playoffs } = archiveSeason

  return {
    seasonId: divId,
    seasonName,
    divId,
    divisionLabel,
    teamHref: `/teams/${divId}`,
    breadcrumb: `${seasonName} ${divisionLabel} League Pharaohs`,
    record: record || { w: 0, l: 0, t: 0 },
    skaters: (roster?.skaters || []).filter(p => !p.name?.toLowerCase().includes('substitute')),
    goalies: (roster?.goalies || []).filter(g => !g.name?.toLowerCase().includes('substitute')),
    games: [],   // schedule games loaded separately via useCurrentSeason
    playoffs: playoffs ? {
      record: playoffs.record || { w: 0, l: 0, t: 0 },
      games: (playoffs.games || []).map(g => ({
        gameId: g.gameId,
        bracketGame: g.bracketGame || '',
        date: g.date,
        time: g.time || '',
        home: g.home,
        away: g.away,
        opponent: g.opponent,
        score: g.score,
        result: g.result,
        playoffs: true,
      })),
      skaters: playoffs.roster?.skaters || [],
      goalies: playoffs.roster?.goalies || [],
      playoffResult: playoffs.result || null,
    } : null,
  }
}

// ── useTeamHistory ─────────────────────────────────────────────────────────
// Loads /data/teams/pharaohs.json — all seasons, rosters, records

export function useTeamHistory() {
  const [seasons, setSeasons] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch(`${BASE}/data/teams/pharaohs.json`)
      .then(r => {
        if (!r.ok) throw new Error(`Archive returned ${r.status}`)
        return r.json()
      })
      .then(data => {
        const transformed = (data.seasons || []).map(transformSeason)
        setSeasons(transformed)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { seasons, loading, error }
}

// ── useCurrentSeason ───────────────────────────────────────────────────────
// Loads standings, schedule+scores, and leaders for a given divId

export function useCurrentSeason(divId) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!divId) return

    const base = `${BASE}/data/divisions/${divId}`

    Promise.all([
      fetch(`${base}/standings.json`).then(r => r.ok ? r.json() : null),
      fetch(`${base}/schedule.regular.json`).then(r => r.ok ? r.json() : null),
      fetch(`${base}/scores.json`).then(r => r.ok ? r.json() : null),
    ])
      .then(([standings, schedule, scores]) => {
        // Attach scores to schedule records
        const scoreMap = scores?.scores || {}
        const games = (schedule?.records || []).map(g => {
          const score = scoreMap[g.gameId]
          const pharTeamId = g.home?.teamId === '1962' ||
                             g.home?.teamId === '1911' ||
                             g.home?.teamId === '1848' ||
                             g.home?.teamId === '1829' ||
                             g.home?.teamId === '1766' ||
                             g.home?.teamId === '1708'
            ? g.home?.teamId : g.away?.teamId
          const weAreHome = score
            ? score.homeTeamId === pharTeamId
            : g.home?.name?.toLowerCase().includes('phar')
          const opponent = weAreHome ? g.away?.name : g.home?.name

          let result = null, scoreStr = null
          if (score) {
            const ourScore = weAreHome ? score.homeScore : score.awayScore
            const theirScore = weAreHome ? score.awayScore : score.homeScore
            scoreStr = `${ourScore}-${theirScore}`
            if (score.tie) result = 'T'
            else result = score.winnerTeamId === pharTeamId ? 'W' : 'L'
          }

          return {
            date: g.date,
            time: g.time || '',
            home: g.home?.name || '',
            homeTeamId: g.home?.teamId || '',
            away: g.away?.name || '',
            awayTeamId: g.away?.teamId || '',
            opponent,
            gameId: g.gameId,
            score: scoreStr,
            result,
          }
        })

        setData({
          standings: standings?.standings || [],
          games,
        })
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [divId])

  return { data, loading, error }
}
