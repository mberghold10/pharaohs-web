import React from 'react'
import './Jerseys.css'

export default function Jerseys() {
  return (
    <div className="page-container jerseys-page">
      <h1 className="page-title">Jerseys & Swag</h1>
      <p className="page-subtitle">Team gear, jersey ordering, and apparel</p>

      <div className="jerseys-coming-soon card">
        <div className="card-body coming-soon-body">
          <div className="coming-soon-icon" aria-hidden="true">🏒</div>
          <h2 className="coming-soon-title">Coming Soon</h2>
          <p className="coming-soon-text">
            Jersey ordering and team swag details will be posted here.
            Check back soon or reach out to a team admin for current ordering info.
          </p>
        </div>
      </div>
    </div>
  )
}
