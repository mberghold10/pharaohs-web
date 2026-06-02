import React, { useState } from 'react'
import './Strategy.css'

const SECTIONS = [
  {
    id: 'defensive-structure',
    title: 'Defensive Structure',
    icon: '🛡',
    subsections: [
      {
        title: 'Corner Coverage',
        content: `When play goes into a corner, the strong-side defenseman engages the battle. The weak-side D holds the front of the net and covers the high slot — especially when our winger or center isn't there to support.

It should be extremely rare for both defensemen to fight for the same corner. In a decade of high-level recreational play, this scenario comes up only a handful of times per season. When it does happen, it means someone has made a positioning mistake.

If both D are genuinely required in the corner, the swap must be called and deliberate — not accidental.`,
        callout: {
          type: 'rule',
          text: 'Weak-side D = front of the net. Strong-side D = corner battle. Never both in the same corner without a deliberate swap.',
        },
      },
      {
        title: 'Supporting Your Defensive Partner',
        content: `The two defensemen must support one another at all times. Leaving your partner out to dry is poor hockey and has directly contributed to goals against.

There are two critical moments where this breaks down with the worst consequences:`,
        subpoints: [
          {
            heading: 'Situation 1 — D with puck under pressure in our zone',
            body: `When one defenseman has the puck in our half of the ice and is under pressure, the other D must skate back to a supporting position — behind and to the side of the puck carrier.

This creates a backward pass angle, typically 20–30 degrees. That pass is almost never interceptable because opposing forwards are focused on cutting off forward options. The receiving D now has open ice and forces the other team to pivot and reposition.

After making the pass, the original puck carrier backs up a couple strides so his partner can pass right back if needed.

What must NOT happen: the off-puck D skating up toward the forwards looking for a diagonal pass. That leaves the puck carrier as the last man back, forces him to chip the puck blindly up the wall, and any interception instantly creates a 2-on-1 or 3-on-1 against.`,
            icon: '⚠️',
          },
          {
            heading: 'Situation 2 — D at the offensive blue line under pressure',
            body: `When one of our defensemen has the puck at the offensive blue line and is under pressure, the other D must assume the puck could be lost at any moment.

The supporting D should flip his hips toward our own net, point his skates at the goalie, and take a couple of slow backward strides out of the zone. This keeps him positioned to defend a breakout or a breakaway.

An experienced defensive pairing with strong chemistry can attempt to hold the line with a cross-ice pass — but only if there is deep trust and awareness between the two. Even then, both players must be prepared to sprint back immediately.

What must NOT happen: the supporting D hanging at the far side boards while his partner gets stripped. Any turnover with that positioning results in a clean breakaway — and we've given up multiple goals this way in recent games.`,
            icon: '⚠️',
          },
        ],
        callout: {
          type: 'tip',
          text: 'Watch any NHL game and you\'ll see D-men supporting each other with lateral and laterally-backward passes constantly. It\'s fundamental defensive hockey.',
        },
      },
    ],
  },
  {
    id: 'offensive-zone',
    title: 'Offensive Zone Play',
    icon: '⚡',
    subsections: [
      {
        title: 'Blue Line Management',
        content: `Defensemen in the offensive zone own the blue line — but that ownership comes with responsibility. Holding the line is optional, not mandatory. When in doubt, protect the break.

Key principles:
• One D holds the line, the other is the safety valve
• Communication between D is non-negotiable at the line
• If the puck goes past you toward the neutral zone, let it go and get back — don't gamble`,
      },
    ],
  },
  {
    id: 'neutral-zone',
    title: 'Neutral Zone',
    icon: '↔',
    subsections: [
      {
        title: 'Transitioning Through the Neutral Zone',
        content: `Moving through the neutral zone with possession is about creating good angles and supporting the puck carrier. Forwards should look to stretch, but not so far that they leave the D isolated.

When we're defending through the neutral zone, collapse and re-group beats trying to win pucks at the red line — a turnover at the red line is one of the highest-danger plays in hockey.`,
      },
    ],
  },
]

export default function Strategy() {
  const [unlocked, setUnlocked] = useState(false)
  const [active, setActive] = useState(null)

  if (!unlocked) {
    return (
      <div className="strategy-gate">
        <div className="gate-inner">
          <div className="gate-icon" aria-hidden="true">⛔</div>
          <h1 className="gate-title">OPPOSING TEAMS:</h1>
          <h2 className="gate-subtitle">DO NOT CLICK FURTHER</h2>
          <p className="gate-desc">This section contains confidential team strategy and tactical information for Pharaohs players only.</p>
          <button className="gate-btn" onClick={() => setUnlocked(true)}>
            I'm a Pharaoh — Let Me In
          </button>
        </div>
      </div>
    )
  }

  const section = SECTIONS.find(s => s.id === active)

  return (
    <div className="page-container strategy-page">
      <h1 className="page-title">Team Strategy</h1>
      <p className="page-subtitle">Pharaohs system, tactics, and concepts</p>

      <div className="strategy-layout">
        {/* Sidebar nav */}
        <nav className="strategy-nav" aria-label="Strategy sections">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              className={`strategy-nav-btn ${active === s.id ? 'strategy-nav-btn--active' : ''}`}
              onClick={() => setActive(active === s.id ? null : s.id)}
            >
              <span className="nav-btn-icon" aria-hidden="true">{s.icon}</span>
              <span>{s.title}</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="strategy-content">
          {!section ? (
            <div className="strategy-empty">
              <p>Select a topic from the left to get started.</p>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <span className="section-icon" aria-hidden="true">{section.icon}</span>
                <h2>{section.title}</h2>
              </div>

              {section.subsections.map((sub, si) => (
                <div key={si} className="subsection card">
                  <div className="card-header">
                    <h2>{sub.title}</h2>
                  </div>
                  <div className="card-body">
                    {sub.content && (
                      <div className="strategy-text">
                        {sub.content.split('\n').map((line, li) =>
                          line.trim() === '' ? <br key={li} /> : <p key={li}>{line}</p>
                        )}
                      </div>
                    )}

                    {sub.subpoints && sub.subpoints.map((sp, spi) => (
                      <div key={spi} className="subpoint">
                        <div className="subpoint-header">
                          <span aria-hidden="true">{sp.icon}</span>
                          <h3>{sp.heading}</h3>
                        </div>
                        <div className="strategy-text">
                          {sp.body.split('\n').map((line, li) =>
                            line.trim() === '' ? <br key={li} /> : <p key={li}>{line}</p>
                          )}
                        </div>
                      </div>
                    ))}

                    {sub.callout && (
                      <div className={`callout callout-${sub.callout.type}`}>
                        <span className="callout-icon" aria-hidden="true">
                          {sub.callout.type === 'rule' ? '📋' : '💡'}
                        </span>
                        <p>{sub.callout.text}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
