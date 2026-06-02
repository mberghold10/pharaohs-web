import React, { useState } from 'react'
import rosterData from '../data/roster.json'
import './Roster.css'

const POSITION_ORDER = ['G', 'D', 'F', 'C', 'LW', 'RW']

function sortByPosition(players) {
  return [...players].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a.position) ?? 99
    const bi = POSITION_ORDER.indexOf(b.position) ?? 99
    if (ai !== bi) return ai - bi
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function Roster() {
  const [view, setView] = useState('cards') // 'cards' | 'table'
  const players = sortByPosition(rosterData.players || [])

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="page-subtitle">Winter 2025 C · Pharaohs</p>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${view === 'cards' ? 'toggle-btn--active' : ''}`}
            onClick={() => setView('cards')}
          >Grid</button>
          <button
            className={`toggle-btn ${view === 'table' ? 'toggle-btn--active' : ''}`}
            onClick={() => setView('table')}
          >Table</button>
        </div>
      </div>

      {players.length === 0 ? (
        <p className="loading">Roster data not yet loaded. Run the scraper to populate.</p>
      ) : view === 'cards' ? (
        <div className="player-grid">
          {players.map((p, i) => (
            <div key={i} className="player-card card">
              <div className="player-number">#{p.number || '—'}</div>
              <div className="player-info">
                <div className="player-name">{p.name}</div>
                <div className="player-meta">
                  <span className={`pos-badge pos-${(p.position || '').toLowerCase()}`}>
                    {p.position || '—'}
                  </span>
                  {p.shoots && <span className="player-detail">{p.shoots}</span>}
                </div>
              </div>
              {(p.gp != null || p.g != null) && (
                <div className="player-stats">
                  <span className="pstat"><span className="pstat-val">{p.gp ?? '—'}</span><span className="pstat-key">GP</span></span>
                  <span className="pstat"><span className="pstat-val">{p.g ?? '—'}</span><span className="pstat-key">G</span></span>
                  <span className="pstat"><span className="pstat-val">{p.a ?? '—'}</span><span className="pstat-key">A</span></span>
                  <span className="pstat"><span className="pstat-val">{(p.g ?? 0) + (p.a ?? 0)}</span><span className="pstat-key">PTS</span></span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Pos</th>
                <th>GP</th>
                <th>G</th>
                <th>A</th>
                <th>PTS</th>
                <th>PIM</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={i}>
                  <td>{p.number || '—'}</td>
                  <td><strong>{p.name}</strong></td>
                  <td>
                    <span className={`pos-badge pos-${(p.position || '').toLowerCase()}`}>
                      {p.position || '—'}
                    </span>
                  </td>
                  <td>{p.gp ?? '—'}</td>
                  <td>{p.g ?? '—'}</td>
                  <td>{p.a ?? '—'}</td>
                  <td><strong>{p.g != null && p.a != null ? p.g + p.a : '—'}</strong></td>
                  <td>{p.pim ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
