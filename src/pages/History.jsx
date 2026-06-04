import React, { useState } from 'react'
import historyData from '../data/history.json'
import './History.css'

const HOF = [
  // { name: 'Player Name', years: '20XX–20XX', note: 'Description' },
]

// Group consecutive games against the same opponent into series rounds,
// then infer round labels working backwards from the final series
function inferRounds(games) {
  if (!games.length) return games

  // Group into series: consecutive games where opponent is the same
  const series = []
  for (const game of games) {
    const last = series[series.length - 1]
    const sameOpponent = last && last.opponent === game.opponent
    if (sameOpponent) {
      last.games.push(game)
    } else {
      series.push({ opponent: game.opponent, games: [game] })
    }
  }

  // Label rounds working backwards: last series = Championship, etc.
  const roundNames = ['Championship', 'Semifinal', 'Quarterfinal', 'Round 1', 'Round 2']
  const labeled = []
  series.forEach((s, i) => {
    const fromEnd = series.length - 1 - i
    const roundLabel = roundNames[fromEnd] || `Round ${i + 1}`
    s.games.forEach(g => labeled.push({ ...g, roundLabel }))
  })
  return labeled
}

function SeasonCard({ season }) {
  const [showRoster, setShowRoster] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showPoRoster, setShowPoRoster] = useState(false)
  const [showPoSchedule, setShowPoSchedule] = useState(true)

  const { w, l, t } = season.record
  const pts = w * 2 + t
  const po = season.playoffs

  // Pharaohs player name set for filtering playoff stats
  const rosterNames = new Set(season.skaters.map(p => p.name.toLowerCase()))

  // Top scorers
  const topScorers = [...season.skaters]
    .filter(p => p.gp > 0 && !p.name.toLowerCase().includes('substitute'))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 5)

  // Playoff stats filtered to only Pharaohs players
  const poSkaters = (po?.skaters || [])
    .filter(p => rosterNames.has(p.name.toLowerCase()) || season.skaters.some(r =>
      r.name.toLowerCase() === p.name.toLowerCase()
    ))
    .sort((a, b) => b.pts - a.pts)

  const poGames = po?.games || []
  const lastPoGame = poGames.filter(g => g.result).slice(-1)[0]
  const wonLastPoGame = lastPoGame?.result === 'W'
  const inFinal = po?.playoffResult?.includes('Runner-up') || po?.playoffResult?.includes('Champion') || po?.playoffResult?.includes('🥈') || po?.playoffResult?.includes('🏆')
  const isChampSeason = inFinal && wonLastPoGame

  return (
    <div className="season-card card">
      <div className="card-header season-card-header">
        <div>
          <h2>{season.seasonName}</h2>
          <span className="season-league">{season.breadcrumb}</span>
        </div>
        <div className="season-record-group">
          <div className="season-record">
            <span className="record-stat"><span className="record-val">{w}</span><span className="record-key">W</span></span>
            <span className="record-stat"><span className="record-val">{l}</span><span className="record-key">L</span></span>
            <span className="record-stat"><span className="record-val">{t}</span><span className="record-key">T</span></span>
            <span className="record-stat"><span className="record-val">{pts}</span><span className="record-key">PTS</span></span>
          </div>
          {po?.playoffResult && (
            <span className={`playoff-result-badge ${isChampSeason ? 'playoff-champ' : po.playoffResult.includes('Runner-up') || po.playoffResult.includes('🥈') ? 'playoff-finalist' : 'playoff-other'}`}>
              {isChampSeason ? '🏆 Champions' : po.playoffResult}
            </span>
          )}
        </div>
      </div>

      <div className="card-body season-body">

        {/* ── Playoffs section — top ── */}
        {po && (poGames.length > 0 || poSkaters.length > 0) && (
          <div className="playoffs-section playoffs-section--top">
            <div className="playoffs-header">
              <span className="playoffs-label">🏒 Playoffs</span>
              {po.playoffResult && <span className="playoffs-result">{isChampSeason ? '🏆 Champions' : po.playoffResult}</span>}
              {po.record && (
                <span className="playoffs-record">
                  {po.record.w}–{po.record.l}{po.record.t > 0 ? `–${po.record.t}` : ''}
                </span>
              )}
            </div>

            {/* Playoff bracket */}
            {poGames.length > 0 && (
              <div className="season-toggle-section">
                <button className="toggle-link" onClick={() => setShowPoSchedule(v => !v)}>
                  {showPoSchedule ? '▼ Hide playoff games' : `▶ Playoff bracket (${poGames.length} games)`}
                </button>
                {showPoSchedule && (
                  <table className="leaders-table" style={{ marginTop: 8 }}>
                    <thead>
                      <tr><th>Round</th><th>Date</th><th>Home</th><th>Away</th><th>Result</th></tr>
                    </thead>
                    <tbody>
                      {inferRounds(poGames).map((g, i) => {
                        const isFuture = !g.result && (g.home?.includes('Winner') || g.away?.includes('Winner'))
                        return (
                          <tr key={i} className={isFuture ? 'row-future' : ''}>
                            <td><strong>{g.roundLabel || g.bracketGame}</strong></td>
                            <td>{g.date}</td>
                            <td>{g.home}</td>
                            <td>{g.away}</td>
                            <td>
                              {g.result
                                ? <span className={`badge ${g.result === 'W' ? 'badge-win' : g.result === 'L' ? 'badge-loss' : 'badge-tie'}`}>{g.score || g.result}</span>
                                : <span className="badge badge-gold">TBD</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Playoff stats — hidden for now, needs roster filtering fix */}
            {false && poSkaters.length > 0 && (
              <div className="season-toggle-section" style={{ marginTop: 8 }}>
                <button className="toggle-link" onClick={() => setShowPoRoster(v => !v)}>
                  {showPoRoster ? '▼ Hide playoff stats' : `▶ Playoff stats (${poSkaters.length} players)`}
                </button>
                {showPoRoster && (
                  <table className="leaders-table" style={{ marginTop: 8 }}>
                    <thead>
                      <tr><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th></tr>
                    </thead>
                    <tbody>
                      {poSkaters.map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td>{p.gp}</td>
                          <td>{p.g}</td>
                          <td>{p.a}</td>
                          <td><strong>{p.pts}</strong></td>
                          <td>{p.pim}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Regular season top scorers ── */}
        {topScorers.length > 0 && (
          <div className="season-leaders">
            <h3 className="season-section-title">Top Scorers</h3>
            <table className="leaders-table">
              <thead>
                <tr><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th></tr>
              </thead>
              <tbody>
                {topScorers.map((p, i) => (
                  <tr key={i}>
                    <td>{p.name}</td>
                    <td>{p.gp}</td>
                    <td>{p.g}</td>
                    <td>{p.a}</td>
                    <td><strong>{p.pts}</strong></td>
                    <td>{p.pim}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Goalie stats ── */}
        {season.goalies.filter(g => !g.name.toLowerCase().includes('substitute')).length > 0 && (
          <div className="season-leaders">
            <h3 className="season-section-title">Goaltending</h3>
            <table className="leaders-table">
              <thead>
                <tr><th>Goalie</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>GAA</th><th>Sv%</th><th>SO</th></tr>
              </thead>
              <tbody>
                {season.goalies.filter(g => !g.name.toLowerCase().includes('substitute')).map((g, i) => (
                  <tr key={i}>
                    <td>{g.name}</td>
                    <td>{g.gp}</td>
                    <td>{g.w}</td>
                    <td>{g.l}</td>
                    <td>{g.t}</td>
                    <td>{g.gaa}</td>
                    <td>{g.svpct}</td>
                    <td>{g.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Full roster toggle ── */}
        {season.skaters.length > 0 && (
          <div className="season-toggle-section">
            <button className="toggle-link" onClick={() => setShowRoster(v => !v)}>
              {showRoster ? '▼ Hide full roster' : `▶ Full roster (${season.skaters.length} players)`}
            </button>
            {showRoster && (
              <table className="leaders-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>#</th><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PPG</th><th>SHG</th><th>PIM</th></tr>
                </thead>
                <tbody>
                  {[...season.skaters].sort((a, b) => b.pts - a.pts).map((p, i) => (
                    <tr key={i}>
                      <td>{p.number}</td>
                      <td>{p.name}</td>
                      <td>{p.gp}</td>
                      <td>{p.g}</td>
                      <td>{p.a}</td>
                      <td><strong>{p.pts}</strong></td>
                      <td>{p.ppg}</td>
                      <td>{p.shg}</td>
                      <td>{p.pim}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Schedule toggle ── */}
        {season.games.length > 0 && (
          <div className="season-toggle-section">
            <button className="toggle-link" onClick={() => setShowSchedule(v => !v)}>
              {showSchedule ? '▼ Hide schedule' : `▶ Schedule & results (${season.games.length} games)`}
            </button>
            {showSchedule && (
              <table className="leaders-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr><th>Date</th><th>Home</th><th>Away</th><th>Result</th></tr>
                </thead>
                <tbody>
                  {season.games.map((g, i) => (
                    <tr key={i}>
                      <td>{g.date}</td>
                      <td>{g.home}</td>
                      <td>{g.away}</td>
                      <td>
                        {g.result && (
                          <span className={`badge ${g.result === 'W' ? 'badge-win' : g.result === 'L' ? 'badge-loss' : 'badge-tie'}`}>
                            {g.score || g.result}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function History() {
  const [activeTab, setActiveTab] = useState('seasons')
  const [activeSeason, setActiveSeason] = useState(0)
  const seasons = historyData.seasons || []

  return (
    <div className="page-container history-page">
      <h1 className="page-title">Team History</h1>
      <p className="page-subtitle">
        {seasons.length > 0
          ? `${seasons.length} season${seasons.length !== 1 ? 's' : ''} of Pharaohs hockey`
          : 'Seasons, championships, and the people who made it happen'}
      </p>

      <div className="history-tabs">
        {['seasons', 'hof', 'memorial'].map(tab => (
          <button
            key={tab}
            className={`history-tab ${activeTab === tab ? 'history-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'seasons' ? '📅 Seasons' : tab === 'hof' ? '🏆 Hall of Fame' : '🕯 Memorial'}
          </button>
        ))}
      </div>

      {activeTab === 'seasons' && (
        <div className="history-content">
          {seasons.length === 0 ? (
            <p className="loading">Season history loading — run <code>npm run scrape:history</code> to populate.</p>
          ) : (
            <div className="seasons-layout">
              {/* Sidebar */}
              <nav className="seasons-sidebar">
                {seasons.map((s, i) => {
                  const pr = s.playoffs?.playoffResult
                  const lastGame = s.playoffs?.games?.filter(g => g.result).slice(-1)[0]
                  const wonLast = lastGame?.result === 'W'
                  const inFinal = pr?.includes('Runner-up') || pr?.includes('Champion') || pr?.includes('🥈') || pr?.includes('🏆')
                  const isChamp = inFinal && wonLast
                  const isRunnerUp = inFinal && !wonLast
                  return (
                    <button
                      key={i}
                      className={`season-nav-btn ${activeSeason === i ? 'season-nav-btn--active' : ''}`}
                      onClick={() => setActiveSeason(i)}
                    >
                      <span className="season-nav-name">{s.seasonName}</span>
                      <div className="season-nav-bottom">
                        <span className="season-nav-record">
                          {s.record.w}–{s.record.l}{s.record.t > 0 ? `–${s.record.t}` : ''}
                        </span>
                        {isChamp && <span className="season-nav-badge season-nav-champ">🏆 Champs</span>}
                        {!isChamp && isRunnerUp && <span className="season-nav-badge season-nav-runner">🥈 Runner-up</span>}
                      </div>
                    </button>
                  )
                })}
              </nav>

              {/* Selected season */}
              <div className="season-detail">
                {activeSeason !== null && seasons[activeSeason] && (
                  <SeasonCard season={seasons[activeSeason]} />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'hof' && (
        <div className="history-content">
          <div className="hof-intro card">
            <div className="card-body">
              <p>The Pharaohs Hall of Fame honors players who have made an outstanding contribution to the team — on and off the ice.</p>
            </div>
          </div>
          {HOF.length === 0 ? (
            <p className="loading" style={{ marginTop: 20 }}>Hall of Fame inductees coming soon.</p>
          ) : (
            <div className="hof-grid">
              {HOF.map((p, i) => (
                <div key={i} className="hof-card card">
                  <div className="hof-icon">🏆</div>
                  <div className="hof-name">{p.name}</div>
                  <div className="hof-years">{p.years}</div>
                  {p.note && <p className="hof-note">{p.note}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'memorial' && (
        <div className="history-content">
          <div className="memorial-card card">
            <div className="card-body memorial-body">
              <div className="memorial-candle" aria-hidden="true">🕯</div>
              <h2 className="memorial-name">Kevin Via</h2>
              <p className="memorial-tagline">Gone But Not Forgotten</p>
              <div className="memorial-divider" />
              <p className="memorial-text">
                Kevin was a cherished member of the Pharaohs family. His spirit, camaraderie,
                and love for the game live on with everyone who had the privilege of sharing
                the ice with him. We play in his memory.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
