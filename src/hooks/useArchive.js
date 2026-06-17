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
// Returns teamIds (all historical Pharaohs IDs) alongside seasons.

export function useTeamHistory() {
  const [seasons, setSeasons] = useState(null)
  const [teamIds, setTeamIds] = useState(new Set())
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
        // teamIds array from top-level of pharaohs.json (all historical IDs)
        setTeamIds(new Set((data.teamIds || []).map(String)))
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { seasons, teamIds, loading, error }
}

// ── useCurrentSeason ───────────────────────────────────────────────────────
// Loads standings and schedule+scores for a given divId.
// teamIds: Set of all Pharaohs historical team IDs (from useTeamHistory)

export function useCurrentSeason(divId, teamIds) {
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
        // scores.json has authoritative homeTeamId/awayTeamId (correct even for playoffs)
        const scoreMap = scores?.scores || {}

        const games = (schedule?.records || []).map(g => {
          const score = scoreMap[g.gameId]

          // Prefer teamIds from scores.json — they're authoritative.
          // Fall back to schedule teamIds for unplayed games.
          const homeTeamId = String(score?.homeTeamId || g.home?.teamId || '')
          const awayTeamId = String(score?.awayTeamId || g.away?.teamId || '')

          const weAreHome = teamIds?.size
            ? teamIds.has(homeTeamId)
            : g.home?.name?.toLowerCase().includes('phar')

          const pharTeamId = weAreHome ? homeTeamId : awayTeamId
          const opponent = weAreHome ? g.away?.name : g.home?.name

          let result = null, scoreStr = null
          if (score) {
            const ourScore = weAreHome ? score.homeScore : score.awayScore
            const theirScore = weAreHome ? score.awayScore : score.homeScore
            scoreStr = `${ourScore}-${theirScore}`
            result = score.tie ? 'T' : score.winnerTeamId === pharTeamId ? 'W' : 'L'
          }

          return {
            date: g.date,
            time: g.time || '',
            home: g.home?.name || '',
            homeTeamId,
            away: g.away?.name || '',
            awayTeamId,
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
  }, [divId, teamIds])

  return { data, loading, error }
}
