import React from 'react'
import './Links.css'

const LINK_GROUPS = [
  {
    title: 'Registration',
    links: [
      {
        label: 'Register for the Pharaohs',
        url: 'https://apps.daysmartrecreation.com/dash/x/#/online/fairfax/programs',
        desc: 'To register: (1) Create an account in the Fairfax DaySmart, then (2) Register for the Pharaohs in C league',
      },
    ],
  },
  {
    links: [
      { label: 'Team Roster', url: 'https://www.stiltweb.com/eLeague/fhl/rosters.php?team=1962', desc: 'Pharaohs player roster' },
      { label: 'Team Schedule', url: 'https://www.stiltweb.com/eLeague/fhl/schedule.php?team=1962', desc: 'Pharaohs game schedule and results' },
    ],
  },
  {
    title: 'League',
    links: [
      { label: 'FHL Home', url: 'https://www.stiltweb.com/eLeague/fhl/', desc: 'Fairfax Ice Arena Hockey League' },
      { label: 'Standings', url: 'https://www.stiltweb.com/eLeague/fhl/standings.php', desc: 'Division C standings' },
      { label: 'Schedule', url: 'https://www.stiltweb.com/eLeague/fhl/schedule.php', desc: 'Full season schedule' },
      { label: 'Rosters', url: 'https://www.stiltweb.com/eLeague/fhl/rosters.php', desc: 'All team rosters' },
      { label: 'Stats Leaders', url: 'https://www.stiltweb.com/eLeague/fhl/stats.php', desc: 'League scoring leaders' },
      { label: 'Scores', url: 'https://www.stiltweb.com/eLeague/fhl/results.php', desc: 'Game results' },
    ],
  },
  {
    title: 'Rink',
    links: [
      { label: 'Fairfax Ice Arena', url: 'https://www.fairfaxicearena.com/', desc: 'Rink info, hours, and contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'USA Hockey Rules', url: 'https://www.usahockey.com/page/show/839230-official-rules', desc: 'Official rule book' },
      { label: 'Hockey Reference', url: 'https://www.hockey-reference.com/', desc: 'Stats and records' },
    ],
  },
]

export default function Links() {
  return (
    <div className="page-container">
      <h1 className="page-title">Links</h1>
      <p className="page-subtitle">Useful resources for the Pharaohs</p>

      <div className="links-groups">
        {LINK_GROUPS.map((group) => (
          <section key={group.title} className="link-group">
            <h2 className="link-group-title">{group.title}</h2>
            <div className="link-list">
              {group.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-card card"
                >
                  <div className="link-card-inner">
                    <div>
                      <div className="link-label">{link.label}</div>
                      {link.desc && <div className="link-desc">{link.desc}</div>}
                    </div>
                    <span className="link-arrow" aria-hidden="true">→</span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
