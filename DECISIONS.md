# Decisions

## 2026-03-26 — Wind Data API Selection
**Chosen:** Open-Meteo (`api.open-meteo.com`)
**Alternatives:** OpenWeatherMap, WeatherAPI, NIWA weather endpoints
**Why:** Free with no API key required — critical for a public static site on GitHub Pages where secrets cannot be hidden. Returns hourly wind speed (km/h), direction, and gusts. Covers NZ locations. Single request returns a 21-day rolling window (past 5 + forecast 16), eliminating per-date re-fetching.
**Trade-offs:** 16-day forecast ceiling means dates beyond that show `—`. Not a real-time feed — data updates on Open-Meteo's schedule, not on demand.
**Revisit if:** User requests extended forecast range or real-time wind data.

---

## 2026-03-26 — Wind Display Style (Snapshot vs. Hourly Chart)
**Chosen:** Single snapshot — current hour for today, noon for other dates
**Alternatives:** Full hourly chart (second Chart.js instance), sparkline, min/max range
**Why:** A second chart would visually compete with the tide chart, double the rendering complexity, and complicate past/future date logic. The sun-row card pattern (snapshot values) is already established and works well on mobile.
**Trade-offs:** No hourly wind trend visible; user sees one point in time per day.
**Revisit if:** User requests hourly wind detail or a combined tide+wind chart.

---

## 2026-03-26 — Wind UI Placement (Separate Row vs. Extend Sun Row)
**Chosen:** New `#wind-row` card below `#sun-times`
**Alternatives:** Third column inside existing `.sun-row`
**Why:** `.sun-row` uses `flex: 1` columns in a 480px max-width container. Adding a third item compresses each to ~130px on mobile — too narrow for icon + label + value. A separate card keeps both rows readable and follows the existing pattern without layout changes.
**Trade-offs:** One more card in the vertical scroll stack.
**Revisit if:** Design direction shifts toward a more compact single-row layout.

---

## 2026-03-26 — NIWA API Key (No Change)
**Chosen:** Leave hardcoded in `script.js`
**Alternatives:** `config.js` gitignored, backend proxy, environment injection via GitHub Actions
**Why:** The repo is deployed on GitHub Pages (public static hosting). A gitignored `config.js` would not be deployed, breaking tide API calls in production. The key is already visible via view-source on the live site — gitignoring provides no meaningful security improvement. A backend proxy or build-time injection would require infrastructure changes incompatible with the current zero-dependency static setup.
**Trade-offs:** API key remains in version control and visible to anyone with repo access.
**Revisit if:** Repo goes private, a backend is introduced, or the NIWA key needs rotation.
