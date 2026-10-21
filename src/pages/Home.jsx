import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import './Home.css'

const ARCHIVE_BASE = 'https://archive.fairfax.beer'
const CURRENT_SEASON_LABEL = 'Division C' // fallback label while loading
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

function parseGameDate(dateStr, timeStr = '', useEndOfDay = false) {
  if (!dateStr) return null

  const isoDate = String(dateStr).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const date = isoDate
    ? new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))
    : new Date(dateStr)

  if (Number.isNaN(date.getTime())) return null

  const time = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (time) {
    let hour = Number(time[1]) % 12
    if (time[3].toUpperCase() === 'PM') hour += 12
    date.setHours(hour, Number(time[2]), 0, 0)
  } else if (useEndOfDay) {
    date.setHours(23, 59, 59, 999)
  }

  return date
}

function getNextGames(games, count = 5) {
  const now = Date.now()
  return games
    .map(game => ({ game, startsAt: parseGameDate(game.date, game.time, true)?.getTime() }))
    .filter(({ game, startsAt }) => !game.result && Number.isFinite(startsAt) && startsAt >= now)
    .sort((a, b) => a.startsAt - b.startsAt)
    .slice(0, count)
    .map(({ game }) => game)
}

function getRecentResults(games, count = 5) {
  return games
    .map(game => ({ game, startsAt: parseGameDate(game.date, game.time)?.getTime() }))
    .filter(({ game, startsAt }) => game.result && Number.isFinite(startsAt))
    .sort((a, b) => b.startsAt - a.startsAt)
    .slice(0, count)
    .map(({ game }) => game)
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { cache: 'no-cache', signal })
  return response.ok ? response.json() : null
}

export default function Home() {
  const { theme } = useTheme()
  const [games, setGames] = useState([])
  const [standings, setStandings] = useState([])
  const [currentSeason, setCurrentSeason] = useState(null)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    let disposed = false
    let activeController = null

    async function loadData() {
      activeController?.abort()
      activeController = new AbortController()
      const { signal } = activeController

      try {
        // Discover the current division dynamically from the team archive.
        const team = await fetchJson(`${ARCHIVE_BASE}/data/teams/pharaohs.json`, signal)
        if (!team?.seasons?.length || disposed) return

        const current = team.seasons[0] // most recent first
        const pharaohsIds = new Set(
          [...(team.teamIds || []), current.teamId].filter(Boolean).map(String)
        )
        setCurrentSeason({ ...current })

        const base = `${ARCHIVE_BASE}/data/divisions/${current.divId}`
        const [regularSchedule, playoffSchedule, scores, standingsData] = await Promise.all([
          fetchJson(`${base}/schedule.regular.json`, signal),
          fetchJson(`${base}/schedule.playoff.json`, signal),
          fetchJson(`${base}/scores.json`, signal),
          fetchJson(`${base}/standings.json`, signal),
        ])
        if (disposed) return

        const scoreMap = scores?.scores || {}
        const allScheduleRecords = [
          ...(regularSchedule?.records || []),
          ...(playoffSchedule?.records || []),
        ]
        const uniqueScheduleRecords = Array.from(new Map(
          allScheduleRecords.map(game => {
            const key = game.gameId
              ? `id:${game.gameId}`
              : `${game.date}|${game.time}|${game.home?.name}|${game.away?.name}`
            return [key, game]
          })
        ).values())

        const parsedGames = uniqueScheduleRecords
          .filter(game => {
            const score = scoreMap[game.gameId]
            const homeId = String(score?.homeTeamId || game.home?.teamId || '')
            const awayId = String(score?.awayTeamId || game.away?.teamId || '')
            return pharaohsIds.has(homeId) || pharaohsIds.has(awayId) ||
              game.home?.name?.toLowerCase().includes('phar') ||
              game.away?.name?.toLowerCase().includes('phar')
          })
          .map(game => {
            const score = scoreMap[game.gameId]
            const homeTeamId = String(score?.homeTeamId || game.home?.teamId || '')
            const weAreHome = pharaohsIds.has(homeTeamId) ||
              (!score?.homeTeamId && game.home?.name?.toLowerCase().includes('phar'))
            const opponent = weAreHome ? game.away?.name : game.home?.name
            const hasScore = score && score.homeScore != null && score.awayScore != null &&
              Number.isFinite(Number(score.homeScore)) && Number.isFinite(Number(score.awayScore))
            let result = game.result || null
            let scoreStr = game.score || null

            if (hasScore) {
              const homeScore = Number(score.homeScore)
              const awayScore = Number(score.awayScore)
              const ourScore = weAreHome ? homeScore : awayScore
              const theirScore = weAreHome ? awayScore : homeScore
              scoreStr = `${ourScore}-${theirScore}`
              result = ourScore === theirScore ? 'T' : ourScore > theirScore ? 'W' : 'L'
            }

            return {
              date: game.date,
              time: game.time || '',
              home: game.home?.name,
              away: game.away?.name,
              opponent,
              gameId: game.gameId,
              rink: game.rink || game.location || '',
              score: scoreStr,
              result,
              playoffs: game.mode === 'playoff' || game.playoffs === true,
            }
          })

        setGames(parsedGames)
        setStandings(standingsData?.standings || [])
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to refresh home-page data:', error)
        }
      } finally {
        if (!disposed && !signal.aborted) setLoadingData(false)
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') loadData()
    }

    loadData()
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    const refreshInterval = window.setInterval(refreshWhenVisible, REFRESH_INTERVAL_MS)

    return () => {
      disposed = true
      activeController?.abort()
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.clearInterval(refreshInterval)
    }
  }, [])

  const upcoming = getNextGames(games)
  const recent = getRecentResults(games)
  const pharaohs = standings.find(t => t.team?.toLowerCase().includes('pharaoh'))

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">{currentSeason ? `${currentSeason.seasonName} · Division ${currentSeason.divisionLabel}` : CURRENT_SEASON_LABEL}</div>
          <img
            src={theme === 'dark' ? '/logo-dark.jpg' : '/logo-light.png'}
            alt="Pharaohs Hockey"
            className="hero-logo"
          />
          <h1 className="hero-title">Pharaohs<br />Hockey</h1>
          <p className="hero-sub">Fairfax Ice Arena Hockey League</p>
          <div className="hero-actions">
            <Link to="/roster" className="btn btn-primary">View Roster</Link>
            <Link to="/strategy" className="btn btn-outline">Team Strategy</Link>
          </div>
        </div>
        <div className="hero-decoration" aria-hidden="true">
          <span>⚜</span>
        </div>
      </section>

      <div className="page-container home-content">
        {/* Standing card */}
        {pharaohs && (
          <section className="standing-banner card">
            <div className="standing-banner-inner">
              <span className="standing-label">Team Standing</span>
              <div className="standing-stats">
                <div className="stat"><span className="stat-val">{pharaohs.gp ?? '—'}</span><span className="stat-key">GP</span></div>
                <div className="stat"><span className="stat-val">{pharaohs.w ?? '—'}</span><span className="stat-key">W</span></div>
                <div className="stat"><span className="stat-val">{pharaohs.l ?? '—'}</span><span className="stat-key">L</span></div>
                <div className="stat"><span className="stat-val">{pharaohs.t ?? '—'}</span><span className="stat-key">T</span></div>
                <div className="stat"><span className="stat-val">{pharaohs.pts ?? '—'}</span><span className="stat-key">PTS</span></div>
              </div>
              <span className="standing-pos">
                {pharaohs.pos ? `${pharaohs.pos} in division` : ''}
              </span>
            </div>
          </section>
        )}

        <div className="grid-2">
          {/* Upcoming games */}
          <div className="card">
            <div className="card-header">
              <h2>Upcoming Games</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="card-body"><p className="loading">{loadingData ? 'Loading...' : 'No upcoming games found.'}</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Opponent</th>
                    <th>Rink</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((g, i) => (
                    <tr key={g.gameId || `${g.date}-${i}`}>
                      <td>{formatDate(g.date)}</td>
                      <td>{g.time || '—'}</td>
                      <td>{g.opponent || g.home || g.away || '—'}</td>
                      <td>{g.rink || 'FIA'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent results */}
          <div className="card">
            <div className="card-header">
              <h2>Recent Results</h2>
            </div>
            {recent.length === 0 ? (
              <div className="card-body"><p className="loading">{loadingData ? 'Loading...' : 'No recent results found.'}</p></div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Opponent</th>
                    <th>Score</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((g, i) => (
                    <tr key={g.gameId || `${g.date}-${i}`}>
                      <td>{formatDate(g.date)}</td>
                      <td>{g.opponent || g.home || g.away || '—'}</td>
                      <td>{g.score || '—'}</td>
                      <td>
                        <span className={`badge ${resultBadge(g.result)}`}>
                          {g.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Standings preview */}
        {standings.length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h2>Division Standings</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Team</th>
                  <th>GP</th>
                  <th>W</th>
                  <th>L</th>
                  <th>T</th>
                  <th>PTS</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((t, i) => (
                  <tr key={i} className={t.team?.toLowerCase().includes('pharaoh') ? 'row-highlight' : ''}>
                    <td>{i + 1}</td>
                    <td><strong>{t.team}</strong></td>
                    <td>{t.gp ?? '—'}</td>
                    <td>{t.w ?? '—'}</td>
                    <td>{t.l ?? '—'}</td>
                    <td>{t.t ?? '—'}</td>
                    <td><strong>{t.pts ?? '—'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  const date = parseGameDate(dateStr)
  return date
    ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—'
}

function resultBadge(result) {
  if (!result) return 'badge-gold'
  const r = result.toUpperCase()
  if (r === 'W') return 'badge-win'
  if (r === 'L') return 'badge-loss'
  return 'badge-tie'
}
