import React, { useState, useEffect } from 'react'
import './Roster.css'

const ARCHIVE_BASE = 'https://archive.fairfax.beer'

function sortByNumber(players) {
  return [...players].sort((a, b) => {
    const na = parseInt(a.number) || 999
    const nb = parseInt(b.number) || 999
    if (na !== nb) return na - nb
    return (a.name || '').localeCompare(b.name || '')
  })
}

export default function Roster() {
  const [skaters, setSkaters] = useState([])
  const [goalies, setGoalies] = useState([])
  const [seasonLabel, setSeasonLabel] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${ARCHIVE_BASE}/data/teams/pharaohs.json`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.seasons?.length) { setLoading(false); return }
        const current = data.seasons[0]
        setSeasonLabel(`${current.seasonName} ${current.divisionLabel} · Pharaohs`)

        const rawSkaters = (current.roster?.skaters || [])
          .filter(p => p.name && !p.name.toLowerCase().includes('substitute'))
        const rawGoalies = (current.roster?.goalies || [])
          .filter(g => g.name && !g.name.toLowerCase().includes('substitute'))

        setSkaters(sortByNumber(rawSkaters))
        setGoalies(sortByNumber(rawGoalies))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-container">
        <h1 className="page-title">Roster</h1>
        <p className="loading">Loading roster...</p>
      </div>
    )
  }

  if (!skaters.length && !goalies.length) {
    return (
      <div className="page-container">
        <h1 className="page-title">Roster</h1>
        <p className="loading">No roster data available.</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Roster</h1>
          <p className="page-subtitle">{seasonLabel}</p>
        </div>
      </div>

      {/* Skaters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><h2>Skaters</h2></div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>GP</th>
              <th>G</th>
              <th>A</th>
              <th>PTS</th>
              <th>PIM</th>
            </tr>
          </thead>
          <tbody>
            {skaters.map((p, i) => (
              <tr key={i}>
                <td>{p.number || '—'}</td>
                <td><strong>{p.name}</strong></td>
                <td>{p.gp ?? '—'}</td>
                <td>{p.g ?? '—'}</td>
                <td>{p.a ?? '—'}</td>
                <td><strong>{p.pts ?? (p.g != null && p.a != null ? p.g + p.a : '—')}</strong></td>
                <td>{p.pim ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Goalies */}
      {goalies.length > 0 && (
        <div className="card">
          <div className="card-header"><h2>Goalies</h2></div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>GP</th>
                <th>W</th>
                <th>L</th>
                <th>T</th>
                <th>GAA</th>
                <th>SV%</th>
                <th>SO</th>
              </tr>
            </thead>
            <tbody>
              {goalies.map((g, i) => (
                <tr key={i}>
                  <td>{g.number || '—'}</td>
                  <td><strong>{g.name}</strong></td>
                  <td>{g.gp ?? '—'}</td>
                  <td>{g.w ?? '—'}</td>
                  <td>{g.l ?? '—'}</td>
                  <td>{g.t ?? '—'}</td>
                  <td>{g.gaa || '—'}</td>
                  <td>{g.svpct || '—'}</td>
                  <td>{g.so ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
