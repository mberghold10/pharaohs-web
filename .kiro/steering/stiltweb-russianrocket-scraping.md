# Scraping stiltweb.com and russianrocket.net

This document captures everything learned about scraping Fairfax Hockey League data from stiltweb.com and russianrocket.net. It serves as a reference for future development on the Pharaohs web project.

---

## Sites Overview

### stiltweb.com/eLeague/fhl
The primary live data source. Hosts the current season's roster stats, schedules, standings, and playoff brackets for the Fairfax Hockey League (FHL).

### russianrocket.net
A historical archive site covering Pharaohs seasons going back further than stiltweb. Has an **expired SSL certificate** — you must disable cert verification (`rejectUnauthorized: false`) when scraping it.

---

## stiltweb.com — Architecture and Quirks

### Session-Based Navigation
The site uses PHP sessions and stateful server-side rendering. Before making data requests, you must:
1. Hit any page to establish a session cookie (usually `schedule.php?team={TEAM_ID}`)
2. Capture the `Set-Cookie` header and send it on all subsequent requests
3. Use `actions.php` to switch modes (regular season vs playoffs) before loading data pages

Without a valid session cookie, pages return empty or redirect to the home page.

### URL Patterns
```
/eLeague/fhl/rosters.php?team={TEAM_ID}              # Regular season roster for a team
/eLeague/fhl/rosters.php?div={DIV_ID}&playoffs=yes   # Playoff roster for a division
/eLeague/fhl/schedule.php?team={TEAM_ID}             # Regular season schedule (team view)
/eLeague/fhl/actions.php?playoffs=yes&page=schedule&team={TEAM_ID}&div={DIV_ID}  # Switch to playoff mode + load schedule
/eLeague/fhl/actions.php?playoffs=no&page=schedule&team={TEAM_ID}&div={DIV_ID}   # Switch back to regular season
/eLeague/fhl/standings.php?div={DIV_ID}              # Standings for a division
/eLeague/fhl/results.php?div={DIV_ID}                # Results (links to individual game recaps)
/eLeague/fhl/results.php?game={GAME_ID}              # Individual game recap
```

### Mode Switching is Critical
The server tracks a "playoffs mode" flag in the session. If a previous scrape run ended in playoff mode, the next run will load playoff data when you want regular season data. Always explicitly reset to regular season at the start of a scrape run:
```javascript
await fetchHtml(`actions.php?playoffs=no&page=schedule&team=${TEAM_ID}&div=${DIV_ID}`)
```

### HTML Structure — Tables
All meaningful data is in HTML tables with `class='standings'`. Key characteristics:
- Tables are **nested** — a `<table class='standings'>` may contain inner tables. Always use depth-aware parsing (counting `<table>` opens/closes) rather than simple regex.
- Headers are in `<th>` cells in the first `<tr>`. Normalize them: `h.toLowerCase().replace(/[^a-z0-9%]/g, '')`.
- The `sv%` goalie column normalizes to `sv` (the `%` is stripped). Check for `gaa` or `sv%` in headers to distinguish goalie vs skater tables.
- Some cells use `&nbsp;` for empty values — strip it.

### Roster Pages
- A team's roster page shows **both** skater and goalie tables on the same page.
- Identify goalie tables by presence of `gaa`, `sv%`, or `sv` in the header row.
- Player stats: `#, Name, GP, G, A, PTS, PPG, PPA, SHG, SHA, PIM`
- Goalie stats: `#, Name, GP, W, L, T, GA, SA, SV, SV%, GAA, SO, PIM`

### Schedule Pages — Regular Season
Simple table structure. Columns: `Date, Home, Away, Recap`.
- The `Recap` column contains the result in formats like:
  - `W (7-4)` or `L (2-8)` for wins/losses
  - `Tie 3-3` for ties
  - `Forfeit` for forfeits
- Date formats encountered: `"Monday, December 1, 2025 7:20 PM"` (long form) and `"12/01/2025"` (short form). Always handle both.

### Schedule Pages — Playoffs
Significantly more complex. The playoff bracket uses a **letter-labeled** system:
- Games have letter labels (A, B, C...) in the first column
- Home/Away fields may contain `"Winner A"` instead of actual team names (bracket references)
- Algorithm: 
  1. Find all games where Pharaohs appear directly
  2. Collect their letter labels
  3. Recursively add any games that reference those labels via "Winner X" patterns
  4. This traces the full path through the bracket

Alternatively (and more reliably): use `results.php?div={DIV_ID}` to get all game IDs, then scrape each individual game recap to determine scores and participants.

### Individual Game Recaps (results.php?game=N)
- Team names appear in links: `href='results.php?team=N'>TeamName</a>`
- Score table rows have format: `[TeamName, P1, P2, P3, FinalScore]` (4-5 cells, last cell is a number)
- Date/time in body text: extract with `/(\w+,\s+\w+\s+\d+,\s+\d{4})/` and `/(\d+:\d+\s*[AP]M)/i`

### Redirect Handling
`actions.php` always issues HTTP 302 redirects. Your fetch function must follow redirects automatically and merge cookies from each hop.

### Rate Limiting
Add ~150-300ms delays between requests. The site is a small operation and will throttle aggressive scrapers. For playoff game-by-game fetching, 100ms between individual game recaps is usually sufficient.

---

## russianrocket.net — Architecture and Quirks

### SSL Certificate
The site has an **expired SSL certificate**. Use:
```javascript
const agent = new https.Agent({ rejectUnauthorized: false })
```
This is safe for this specific trusted internal site but should not be used generally.

### URL Patterns
```
/seasons          # Lists all seasons
/leagues/{ID}     # A league (season) page with all teams listed in nav
/teams/{ID}       # A team page with roster, schedule, record
```

### Seasons Discovery
`/seasons` page lists all seasons as anchor tags linking to `/leagues/{ID}`. The season name is in an inner `<h3>` tag. Extract via:
```javascript
/<a[^>]+href="(\/leagues\/(\d+))"[^>]*>([\s\S]*?)<\/a>/gi
// Inner season name from: <h3>Winter 2025</h3>
```

### Finding Pharaohs in a Season
`/leagues/{ID}` page has all team links in the nav sidebar. Filter by `href.includes('/teams/')` and `text.toLowerCase().includes('phar')`. Sometimes the team appears multiple times (regular season C1 + C2 division split) — deduplicate by href.

### Team Pages
Each team page has three data tables identified by HTML `id` attributes:
- `id="skater_table"` — skater stats
- `id="goalie_table"` — goalie stats  
- `id="schedule_table"` — game schedule with results

Extract via: `html.match(new RegExp(`id=['"]${tableId}['"][^>]*>([\\s\\S]*?)</table>`))`

### Schedule Result Format on russianrocket
The `Recap` column contains the full score as `"TeamName 7 - 4"` (winner's name first). Parse:
1. Extract score with `/(\d+)\s*-\s*(\d+)/`
2. Determine winner by checking if the text before the first digit contains "pharaoh"
3. `"Tie 3-3"` for ties, `"Forfeit"` for forfeits

### Multiple Pharaohs Teams Per Season
Sometimes the Pharaohs appear in two divisions in the same season (e.g., C1 and C2, or regular season + rec). Handle this by:
1. Scraping all candidate team pages
2. Check for **schedule overlap** (same game dates) — overlap means two different teams with the same name (keep the one with more games)
3. No overlap — **merge** the rosters and schedules into one combined season entry (summing stats for players appearing in both)

---

## Pharaohs Team IDs Reference

### stiltweb.com Division IDs (archive)
These are the division IDs where Pharaohs appear in the stiltweb archive (`archive/divisions/`):

| Season | Div Label | Division ID | Team ID |
|--------|-----------|-------------|---------|
| Summer 2017 | D2 | 167 | 1084 |
| Summer 2017 | D3 | 168 | 1071 |
| Winter 2017 | D2 | 176 | 1122 |
| Summer 2018 | D2 | 185 | 1176 |
| Winter 2018 | C2 | 191 | 1210 |
| Summer 2019 | C2 | 204 | 1291 |
| Winter 2019 | C2 | 210 | 1328 |
| Winter 2023 | C | 277 | 1708 |
| Summer 2024 | C2 | 297 | 1829 |
| Winter 2025 | C | 321 | 1962 |

### stiltweb.com Playoff Division IDs (scrapeStiltweb.js hardcoded list)
Divisions known to have Pharaohs playoff data:
`[167, 168, 176, 185, 191, 204, 210, 232, 242, 250, 259, 268, 277, 287, 297, 300, 312]`

### russianrocket.net Season IDs
The russianrocket `/leagues/{ID}` IDs differ from stiltweb div IDs — they're a separate numbering system. The `scrapeHistory.js` script discovers these dynamically via the `/seasons` page.

---

## Archive Data Structure (public/data/divisions/{divId}/)

After scraping the full archive with the stiltweb scraper, each division directory contains:

```
divisions/{divId}/
  meta.json              # {seasonName, divisionLabel, teams: {teamId: teamName}, divId}
  rosters.regular.json   # {divId, mode, kind, records: {teamId: {skaters, goalies}}}
  rosters.playoff.json   # Same structure, playoff stats
  schedule.regular.json  # {divId, mode, kind, records: [{date, time, home, away, gameId, ...}]}
  schedule.playoff.json  # Same structure, playoff games
  suspensions.json       # {divId, suspensions: [...]}
```

### Critical: Roster Records Key Structure
In `rosters.regular.json`, the `records` object uses team IDs as keys. However, **all players from the entire division may be stored under a single team ID** (the first team scraped). Each individual player object has a `team.teamId` field indicating their actual team.

**Never rely on the top-level key to filter players. Always check `player.team.teamId`.**

```javascript
// WRONG:
const pharaohsRoster = roster.records[pharaohsTeamId]

// CORRECT:
const allSkaters = []
for (const key of Object.keys(roster.records)) {
  for (const skater of roster.records[key].skaters || []) {
    if (String(skater.team.teamId) === String(targetTeamId)) {
      allSkaters.push(skater)
    }
  }
}
```

### Schedule Records Format
Each game in `schedule.regular.json` records array:
```json
{
  "date": "2025-12-01",
  "time": "7:20 PM",
  "home": { "teamId": "1970", "name": "Outlaws" },
  "away": { "teamId": "1962", "name": "Pharaohs" },
  "gameId": "18590",
  "mode": "regular",
  "divId": 321,
  "seasonName": "Winter 2025"
}
```

---

## Current Season Scraping Workflow

The `scrape.js` script handles the live current season (currently Winter 2025, div 321, team 1962):

1. Establish session
2. Reset to regular season mode
3. Scrape regular season roster → `roster.json`
4. Scrape playoff roster → `rosterPlayoffs.json`
5. Scrape regular season schedule → `schedule.json`
6. Scrape playoff schedule (bracket traversal or game-by-game) → merged into `schedule.json`
7. Scrape standings → `standings.json`

**Update `TEAM_ID` and `DIV_ID` constants at the start of each new season.**

---

## history.json Data Format

The `src/data/history.json` file consumed by `History.jsx`:

```json
{
  "_updated": "ISO timestamp",
  "seasons": [
    {
      "seasonId": "293",
      "seasonName": "Winter 2025",
      "teamId": "1962",
      "teamHref": "/teams/1962",
      "breadcrumb": "Winter 2025 C League Pharaohs",
      "record": { "w": 3, "l": 12, "t": 0 },
      "skaters": [{ "number": "", "name": "Last, First", "gp": 0, "g": 0, "a": 0, "pts": 0, "ppg": 0, "ppa": 0, "shg": 0, "sha": 0, "pim": 0 }],
      "goalies": [{ "number": "", "name": "Last, First", "gp": 0, "w": 0, "l": 0, "t": 0, "ga": 0, "sa": 0, "sv": 0, "svpct": "0.844", "gaa": "5.88", "so": 0, "pim": 0 }],
      "games": [{ "date": "Mon, 1 Dec 7:20pm", "home": "Outlaws", "away": "Pharaohs", "opponent": "Outlaws", "score": "Outlaws 9 - 3", "result": "L" }],
      "playoffs": {
        "record": { "w": 1, "l": 1, "t": 0 },
        "games": [{ "gameId": 12345, "date": "2025-03-10", "home": "Pharaohs", "away": "Blue Crabs", "result": "W", "score": "5-3", "playoffs": true }],
        "playoffResult": "🥈 Runner-up"
      }
    }
  ]
}
```

Seasons are sorted most recent first (by `seasonId` descending or by season name parsing).

---

## Playoff Result Inference

Without explicit bracket metadata, playoff results are inferred from game count and last result:

| Games Played | Last Result | Inferred Result |
|-------------|-------------|-----------------|
| 1 | L | First Round |
| 2 | L | Quarterfinal |
| 3 | L | Semifinal (🥉) |
| 4+ | L | Runner-up (🥈) |
| 2 | W | Runner-up (🥈) |
| 3+ | W | Champions (🏆) |

This is approximate — bracket sizes vary by season.

---

## Common Pitfalls

1. **Session state persists between runs** — always reset playoff/regular mode explicitly at the start of each scrape.

2. **Empty response ≠ no data** — stiltweb may return a valid HTML page with no data tables if session is invalid. Check for `class='standings'` in the response before treating it as real data.

3. **Substitutes** — both sites list "Substitute" players. Filter them with `name.toLowerCase().includes('substitute')`.

4. **Name inconsistency** — "Pharoahs" (typo) appears in some stiltweb data. Always use `/phar/i` regex, not an exact match.

5. **Player name formats** — stiltweb uses `"Last, First"` format. russianrocket is inconsistent. The `playerIdentity.mjs` module handles fuzzy matching across these.

6. **SSL on russianrocket** — the expired cert causes Node to reject the connection. The `rejectUnauthorized: false` agent is mandatory.

7. **archive vs live team IDs** — the full archive (`archive/` directory) was scraped by a different script and uses different team ID ranges than the live `scrape.js` which targets specific current-season IDs. Don't mix them up.
