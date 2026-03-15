# New Brighton Tide Chart

A lightweight, mobile-friendly web app that displays tide information for New Brighton Beach, Christchurch, New Zealand.

## Features

- **Today's tide chart** — smooth curve for the full 24-hour period
- **Next tide banner** — shows whether the next tide is High or Low, the time, and how long until it arrives
- **Sunrise & sunset times** — fetched from the sunrise-sunset.org API
- **Date picker** — view tides for any date ±30 days
- **Current time indicator** — dotted line on the chart showing where you are in the day
- **Dark theme** — designed for easy reading on a phone screen

## Data Sources

| Data | Source |
|------|--------|
| Tide predictions | [NIWA Tides API](https://developer.niwa.co.nz/) |
| Sunrise / sunset | [sunrise-sunset.org](https://api.sunrise-sunset.org) |

Tide data falls back to a cosine model if the NIWA API key is not set.

## Setup

1. Clone the repo
2. Open `script.js` and add your NIWA API key:
   ```js
   const NIWA_API_KEY = 'your-key-here';
   ```
3. Open `index.html` in a browser, or serve with any static file server:
   ```
   npx serve .
   ```

No build step or dependencies to install.

## Location

**New Brighton Beach, Christchurch, New Zealand**
Coordinates: -43.5321, 172.6362
Timezone: Pacific/Auckland

## Tech Stack

- HTML / CSS / Vanilla JavaScript
- [Chart.js](https://www.chartjs.org/) for the tide curve
