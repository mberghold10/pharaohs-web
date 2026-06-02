import React, { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import './Layout.css'

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/roster', label: 'Roster' },
  { to: '/strategy', label: 'Strategy' },
  { to: '/links', label: 'Links' },
]

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { theme, toggle } = useTheme()

  return (
    <div className="layout">
      <header className="header">
        <div className="header-inner">
          <NavLink to="/" className="brand">
            <img
                src={theme === 'dark' ? '/pharaohs-web/logo-dark.jpg' : '/pharaohs-web/logo-light.png'}
                alt="Pharaohs Hockey"
                className="brand-logo"
              />
            <div className="brand-text-group">
              <span className="brand-text">PHARAOHS</span>
              <span className="brand-sub">HOCKEY</span>
            </div>
          </NavLink>

          <nav className={`nav ${menuOpen ? 'nav--open' : ''}`}>
            {NAV_LINKS.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <button
              className="hamburger"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>Pharaohs Hockey · Fairfax Ice Arena · Winter 2025 C</p>
      </footer>
    </div>
  )
}
