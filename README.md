# New Brighton Tide Chart

A lightweight, mobile-friendly web app that displays tide information for New Brighton Beach, Christchurch, New Zealand.

## Features

- **Today's tide chart** — smooth curve for the full 24-hour period
- **Next tide banner** — shows whether the next tide is High or Low, the time, and how long until it arrives
- **Sunrise & sunset times** — fetched from the sunrise-sunset.org API
- **Wind conditions** — current wind speed, direction, and gusts from Open-Meteo
- **Date picker** — view tides for any date ±30 days, with a Today button to jump back
- **Current time indicator** — dotted line on the chart showing where you are in the day (DST-aware)
- **Dark theme** — designed for easy reading on a phone screen

## Data Sources

| Data | Source |
|------|--------|
| Tide predictions | [NIWA Tides API](https://developer.niwa.co.nz/) (primary) |
| Tide predictions | [WorldTides API](https://www.worldtides.info/developer) (fallback) |
| Tide predictions | Built-in cosine model (offline fallback) |
| Sunrise / sunset | [sunrise-sunset.org](https://api.sunrise-sunset.org) |
| Wind conditions | [Open-Meteo](https://open-meteo.com/) |

## Setup

1. Clone the repo
2. Open `script.js` and add your API keys:
   ```js
   const NIWA_API_KEY = 'your-niwa-key-here';       // https://developer.niwa.co.nz/
   const WORLDTIDES_API_KEY = 'your-wt-key-here';   // https://www.worldtides.info/developer
   ```
   Both are optional — the app falls back to a cosine tide model if neither key is set.
3. Open `index.html` in a browser, or serve with any static file server:
   ```
   npx serve .
   ```

No build step or dependencies to install.

## Location

**New Brighton Beach, Christchurch, New Zealand**
Coordinates: -43.5067, 172.7318
Timezone: Pacific/Auckland

## Tech Stack

- HTML / CSS / Vanilla JavaScript
- [Chart.js](https://www.chartjs.org/) for the tide curve
