import React, { useState, useMemo } from 'react'
import { useTeamHistory } from '../hooks/useArchive'
import { aggregatePlayers, getAllTimeLeaders } from '../utils/playerStats'
import './History.css'

const HOF = [
  // { name: 'Player Name', years: '20XX–20XX', note: 'Description' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function inferRounds(games) {
  if (!games.length) return games
  const series = []
  for (const game of games) {
    const last = series[series.length - 1]
    if (last && last.opponent === game.opponent) last.games.push(game)
    else series.push({ opponent: game.opponent, games: [game] })
  }
  const roundNames = ['Championship', 'Semifinal', 'Quarterfinal', 'Round 1', 'Round 2']
  const labeled = []
  series.forEach((s, i) => {
    const fromEnd = series.length - 1 - i
    const roundLabel = roundNames[fromEnd] || `Round ${i + 1}`
    s.games.forEach(g => labeled.push({ ...g, roundLabel }))
  })
  return labeled
}

// ── Player Card ────────────────────────────────────────────────────────────

function PlayerCard({ player, onClose }) {
  const skaterSeasons = player.seasons.filter(s => !player.isGoalie)
  const isGoalie = player.isGoalie
  const t = player.totals

  return (
    <div className="player-card-overlay" onClick={onClose}>
      <div className="player-card-modal card" onClick={e => e.stopPropagation()}>
        <div className="card-header player-card-header">
          <div>
            <h2 className="player-card-name">{player.name}</h2>
            <span className="player-card-sub">{isGoalie ? 'Goalie' : 'Skater'} · {player.seasons.length} season{player.seasons.length !== 1 ? 's' : ''}</span>
          </div>
          <button className="player-card-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="card-body">
          {/* Career totals */}
          <div className="player-totals">
            {isGoalie ? (
              <>
                <div className="ptotal"><span className="ptotal-val">{t.gp}</span><span className="ptotal-key">GP</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.w}</span><span className="ptotal-key">W</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.l}</span><span className="ptotal-key">L</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.so}</span><span className="ptotal-key">SO</span></div>
              </>
            ) : (
              <>
                <div className="ptotal"><span className="ptotal-val">{t.gp}</span><span className="ptotal-key">GP</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.g}</span><span className="ptotal-key">G</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.a}</span><span className="ptotal-key">A</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.pts}</span><span className="ptotal-key">PTS</span></div>
                <div className="ptotal"><span className="ptotal-val">{t.pim}</span><span className="ptotal-key">PIM</span></div>
              </>
            )}
          </div>

          {/* Season by season */}
          <h3 className="season-section-title" style={{ marginTop: 20, marginBottom: 8 }}>Season by Season</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="leaders-table">
              <thead>
                {isGoalie
                  ? <tr><th>Season</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>SO</th><th>PO GP</th><th>PO W</th></tr>
                  : <tr><th>Season</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th><th>PO GP</th><th>PO G</th><th>PO A</th><th>PO PTS</th></tr>
                }
              </thead>
              <tbody>
                {[...player.seasons].sort((a, b) => {
                  const parseS = s => {
                    const m = s.season.match(/^(\w+)\s+(\d{4})$/)
                    if (!m) return [0, 0]
                    const order = { Spring: 1, Summer: 2, Fall: 3, Winter: 4 }
                    return [parseInt(m[2]), order[m[1]] ?? 0]
                  }
                  const [ay, at] = parseS(a)
                  const [by, bt] = parseS(b)
                  return by !== ay ? by - ay : bt - at
                }).map((s, i) => (
                  isGoalie ? (
                    <tr key={i}>
                      <td>{s.season}</td>
                      <td>{s.gp}</td>
                      <td>{s.w}</td>
                      <td>{s.l}</td>
                      <td>{s.t}</td>
                      <td>{s.so}</td>
                      <td>{s.poGp || '—'}</td>
                      <td>{s.poW || '—'}</td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td>{s.season}</td>
                      <td>{s.gp}</td>
                      <td>{s.g}</td>
                      <td>{s.a}</td>
                      <td><strong>{s.pts}</strong></td>
                      <td>{s.pim}</td>
                      <td>{s.poGp || '—'}</td>
                      <td>{s.poG || '—'}</td>
                      <td>{s.poA || '—'}</td>
                      <td>{s.poPts || '—'}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── All-Time Leaders ───────────────────────────────────────────────────────

function LeaderCategory({ title, players, stat, label }) {
  return (
    <div className="leader-category card">
      <div className="card-header"><h2>{title}</h2></div>
      <table className="leaders-table">
        <tbody>
          {players.map((p, i) => (
            <tr key={i}>
              <td className="leader-rank">#{i + 1}</td>
              <td>{p.name}</td>
              <td><strong>{p.totals[stat]}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Season Card ────────────────────────────────────────────────────────────

function SeasonCard({ season }) {
  const [showRoster, setShowRoster] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [showPoSchedule, setShowPoSchedule] = useState(true)

  const { w, l, t } = season.record
  const pts = w * 2 + t
  const po = season.playoffs

  const topScorers = [...season.skaters]
    .filter(p => p.gp > 0 && !p.name.toLowerCase().includes('substitute'))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 5)

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
        {/* Playoffs */}
        {po && poGames.length > 0 && (
          <div className="playoffs-section playoffs-section--top">
            <div className="playoffs-header">
              <span className="playoffs-label">🏒 Playoffs</span>
              {po.playoffResult && <span className="playoffs-result">{isChampSeason ? '🏆 Champions' : po.playoffResult}</span>}
              {po.record && <span className="playoffs-record">{po.record.w}–{po.record.l}{po.record.t > 0 ? `–${po.record.t}` : ''}</span>}
            </div>
            <div className="season-toggle-section">
              <button className="toggle-link" onClick={() => setShowPoSchedule(v => !v)}>
                {showPoSchedule ? '▼ Hide playoff games' : `▶ Playoff bracket (${poGames.length} games)`}
              </button>
              {showPoSchedule && (
                <table className="leaders-table" style={{ marginTop: 8 }}>
                  <thead><tr><th>Round</th><th>Date</th><th>Home</th><th>Away</th><th>Result</th></tr></thead>
                  <tbody>
                    {inferRounds(poGames).map((g, i) => {
                      const isFuture = !g.result && (g.home?.includes('Winner') || g.away?.includes('Winner'))
                      return (
                        <tr key={i} className={isFuture ? 'row-future' : ''}>
                          <td><strong>{g.roundLabel || g.bracketGame}</strong></td>
                          <td>{g.date}</td><td>{g.home}</td><td>{g.away}</td>
                          <td>{g.result ? <span className={`badge ${g.result === 'W' ? 'badge-win' : g.result === 'L' ? 'badge-loss' : 'badge-tie'}`}>{g.score || g.result}</span> : <span className="badge badge-gold">TBD</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Top scorers */}
        {topScorers.length > 0 && (
          <div className="season-leaders">
            <h3 className="season-section-title">Top Scorers</h3>
            <table className="leaders-table">
              <thead><tr><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th></tr></thead>
              <tbody>{topScorers.map((p, i) => <tr key={i}><td>{p.name}</td><td>{p.gp}</td><td>{p.g}</td><td>{p.a}</td><td><strong>{p.pts}</strong></td><td>{p.pim}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {/* Goalies */}
        {season.goalies.filter(g => !g.name.toLowerCase().includes('substitute')).length > 0 && (
          <div className="season-leaders">
            <h3 className="season-section-title">Goaltending</h3>
            <table className="leaders-table">
              <thead><tr><th>Goalie</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>GAA</th><th>Sv%</th><th>SO</th></tr></thead>
              <tbody>{season.goalies.filter(g => !g.name.toLowerCase().includes('substitute')).map((g, i) => <tr key={i}><td>{g.name}</td><td>{g.gp}</td><td>{g.w}</td><td>{g.l}</td><td>{g.t}</td><td>{g.gaa}</td><td>{g.svpct}</td><td>{g.so}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {/* Full roster */}
        {season.skaters.length > 0 && (
          <div className="season-toggle-section">
            <button className="toggle-link" onClick={() => setShowRoster(v => !v)}>
              {showRoster ? '▼ Hide full roster' : `▶ Full roster (${season.skaters.length} players)`}
            </button>
            {showRoster && (
              <table className="leaders-table" style={{ marginTop: 8 }}>
                <thead><tr><th>#</th><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PPG</th><th>SHG</th><th>PIM</th></tr></thead>
                <tbody>{[...season.skaters].sort((a, b) => b.pts - a.pts).map((p, i) => <tr key={i}><td>{p.number}</td><td>{p.name}</td><td>{p.gp}</td><td>{p.g}</td><td>{p.a}</td><td><strong>{p.pts}</strong></td><td>{p.ppg}</td><td>{p.shg}</td><td>{p.pim}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Schedule */}
        {season.games.length > 0 && (
          <div className="season-toggle-section">
            <button className="toggle-link" onClick={() => setShowSchedule(v => !v)}>
              {showSchedule ? '▼ Hide schedule' : `▶ Schedule & results (${season.games.length} games)`}
            </button>
            {showSchedule && (
              <table className="leaders-table" style={{ marginTop: 8 }}>
                <thead><tr><th>Date</th><th>Home</th><th>Away</th><th>Result</th></tr></thead>
                <tbody>{season.games.map((g, i) => <tr key={i}><td>{g.date}</td><td>{g.home}</td><td>{g.away}</td><td>{g.result && <span className={`badge ${g.result === 'W' ? 'badge-win' : g.result === 'L' ? 'badge-loss' : 'badge-tie'}`}>{g.score || g.result}</span>}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function History() {
  const [activeTab, setActiveTab] = useState('seasons')
  const [activeSeason, setActiveSeason] = useState(0)
  const [activePlayer, setActivePlayer] = useState(null)
  const { seasons, loading, error } = useTeamHistory()
  const allSeasons = seasons || []

  const allPlayers = useMemo(() => aggregatePlayers(allSeasons), [allSeasons])
  const leaders = useMemo(() => getAllTimeLeaders(allPlayers, 10), [allPlayers])
  const skaterPlayers = allPlayers.filter(p => !p.isGoalie)
  const goaliePlayers = allPlayers.filter(p => p.isGoalie)

  return (
    <div className="page-container history-page">
      <h1 className="page-title">Team History</h1>
      <p className="page-subtitle">
        {loading ? 'Loading...' :
         error ? 'Could not load history' :
         allSeasons.length > 0
          ? `${allSeasons.length} season${allSeasons.length !== 1 ? 's' : ''} of Pharaohs hockey`
          : 'Seasons, championships, and the people who made it happen'}
      </p>

      <div className="history-tabs">
        {['seasons', 'hof', 'players', 'memorial'].map(tab => (
          <button key={tab} className={`history-tab ${activeTab === tab ? 'history-tab--active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'seasons' ? '📅 Seasons' : tab === 'hof' ? '🏆 Hall of Fame' : tab === 'players' ? '👤 Players' : '🕯 Memorial'}
          </button>
        ))}
      </div>

      {/* ── Seasons tab ── */}
      {activeTab === 'seasons' && (
        <div className="history-content">
          {loading ? (
            <p className="loading">Loading season history...</p>
          ) : error ? (
            <p className="loading">Failed to load history: {error}</p>
          ) : allSeasons.length === 0 ? (
            <p className="loading">No season data found.</p>
          ) : (
            <div className="seasons-layout">
              <nav className="seasons-sidebar">
                {allSeasons.map((s, i) => {
                  const pr = s.playoffs?.playoffResult
                  const lastGame = s.playoffs?.games?.filter(g => g.result).slice(-1)[0]
                  const wonLast = lastGame?.result === 'W'
                  const inFinal = pr?.includes('Runner-up') || pr?.includes('Champion') || pr?.includes('🥈') || pr?.includes('🏆')
                  const isChamp = inFinal && wonLast
                  const isRunnerUp = inFinal && !wonLast
                  return (
                    <button key={i} className={`season-nav-btn ${activeSeason === i ? 'season-nav-btn--active' : ''}`} onClick={() => setActiveSeason(i)}>
                      <span className="season-nav-name">{s.seasonName}</span>
                      <div className="season-nav-bottom">
                        <span className="season-nav-record">{s.record.w}–{s.record.l}{s.record.t > 0 ? `–${s.record.t}` : ''}</span>
                        {isChamp && <span className="season-nav-badge season-nav-champ">🏆 Champs</span>}
                        {!isChamp && isRunnerUp && <span className="season-nav-badge season-nav-runner">🥈 Runner-up</span>}
                      </div>
                    </button>
                  )
                })}
              </nav>
              <div className="season-detail">
                {activeSeason !== null && allSeasons[activeSeason] && <SeasonCard season={allSeasons[activeSeason]} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Hall of Fame tab ── */}
      {activeTab === 'hof' && (
        <div className="history-content">

          {/* All-time leaders */}
          {allPlayers.length > 0 && (
            <section className="alltime-section">
              <h2 className="alltime-title">All-Time Leaders</h2>
              <div className="alltime-grid">
                <LeaderCategory title="Goals" players={leaders.goals} stat="g" label="G" />
                <LeaderCategory title="Assists" players={leaders.assists} stat="a" label="A" />
                <LeaderCategory title="Points" players={leaders.points} stat="pts" label="PTS" />
                <LeaderCategory title="Games Played" players={leaders.gamesPlayed} stat="gp" label="GP" />
                <LeaderCategory title="Penalty Minutes" players={leaders.pim} stat="pim" label="PIM" />
                <LeaderCategory title="Goalie Wins" players={leaders.goalieWins} stat="w" label="W" />
              </div>
            </section>
          )}

          {/* HOF inductees */}
          <div className="hof-intro card" style={{ marginTop: 32 }}>
            <div className="card-body">
              <p>The Pharaohs Hall of Fame honors players who have made an outstanding contribution to the team — on and off the ice.</p>
            </div>
          </div>
          {HOF.length === 0 ? (
            <p className="loading" style={{ marginTop: 20 }}>Hall of Fame inductees coming soon.</p>
          ) : (
            <div className="hof-grid" style={{ marginTop: 16 }}>
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

      {/* ── Players tab ── */}
      {activeTab === 'players' && (
        <div className="history-content">
          {allPlayers.length === 0 ? (
            <p className="loading">Player data loading...</p>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                {skaterPlayers.length} skaters · {goaliePlayers.length} goalies — click any card for season-by-season breakdown
              </p>
              <div className="player-profiles-grid">
                {skaterPlayers.map((p, i) => (
                  <button key={i} className="profile-card card" onClick={() => setActivePlayer(p)}>
                    <div className="profile-name">{p.name}</div>
                    <div className="profile-stats">
                      <span><strong>{p.totals.gp}</strong> GP</span>
                      <span><strong>{p.totals.pts}</strong> PTS</span>
                      <span><strong>{p.seasons.length}</strong> {p.seasons.length === 1 ? 'season' : 'seasons'}</span>
                    </div>
                  </button>
                ))}
                {goaliePlayers.map((p, i) => (
                  <button key={`g${i}`} className="profile-card profile-card--goalie card" onClick={() => setActivePlayer(p)}>
                    <div className="profile-name">{p.name}</div>
                    <div className="profile-stats">
                      <span><strong>{p.totals.gp}</strong> GP</span>
                      <span><strong>{p.totals.w}</strong> W</span>
                      <span>Goalie</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Memorial tab ── */}
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
              <p className="memorial-note">Note: Kevin is alive and well.</p>
            </div>
          </div>
        </div>
      )}

      {/* Player card modal */}
      {activePlayer && <PlayerCard player={activePlayer} onClose={() => setActivePlayer(null)} />}
    </div>
  )
}
