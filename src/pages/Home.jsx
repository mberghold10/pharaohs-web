import React from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import scheduleData from '../data/schedule.json'
import standingsData from '../data/standings.json'
import './Home.css'

function getNextGames(games, count = 5) {
  const now = new Date()
  return games
    .filter(g => new Date(g.date) >= now)
    .slice(0, count)
}

function getRecentResults(games, count = 5) {
  const now = new Date()
  return games
    .filter(g => new Date(g.date) < now && g.result)
    .slice(-count)
    .reverse()
}

export default function Home() {
  const { theme } = useTheme()
  const upcoming = getNextGames(scheduleData.games || [])
  const recent = getRecentResults(scheduleData.games || [])
  const pharaohs = (standingsData.standings || []).find(
    t => t.team?.toLowerCase().includes('pharaoh')
  )

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">Winter 2025 · Division C</div>
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
              <div className="card-body"><p className="loading">No upcoming games found.</p></div>
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
                    <tr key={i}>
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
              <div className="card-body"><p className="loading">No recent results found.</p></div>
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
                    <tr key={i}>
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
        {(standingsData.standings || []).length > 0 && (
          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header">
              <h2>Division C Standings</h2>
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
                {standingsData.standings.map((t, i) => (
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
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function resultBadge(result) {
  if (!result) return 'badge-gold'
  const r = result.toUpperCase()
  if (r === 'W') return 'badge-win'
  if (r === 'L') return 'badge-loss'
  return 'badge-tie'
}
