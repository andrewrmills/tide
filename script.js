/* =========================================================
   New Brighton Tide Chart — script.js
   ========================================================= */

// --------------- CONFIG -----------------------------------
const LAT = -43.5321;
const LON = 172.6362;
const TIMEZONE = 'Pacific/Auckland';

// NIWA requires an API key. Set it here if you have one.
// Sign up free at https://developer.niwa.co.nz/
// Leave as empty string to use the WorldTides fallback demo or
// the built-in cosine-model fallback.
const NIWA_API_KEY = 'X0jzuUyYmlXnxgCisufPDXa1aQNFGxAo';

// WorldTides API key (https://www.worldtides.info/developer)
// Leave empty to skip.
const WORLDTIDES_API_KEY = '';

// --------------- HELPERS ----------------------------------
function toNZDate(isoOrDate) {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return new Date(d.toLocaleString('en-NZ', { timeZone: TIMEZONE }));
}

function todayNZString() {
  return fmtYMD(new Date());
}

function fmtYMD(d) {
  // Use Intl to get the correct local date in NZ timezone — avoids
  // the unreliable new Date(localeString) pattern that produces NaN.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function fmt12(d) {
  return d.toLocaleTimeString('en-NZ', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  });
}

function fmtDuration(ms) {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// --------------- LOCAL STORAGE CACHE ---------------------
const CACHE_VERSION = 2; // bump this to auto-invalidate all cached entries

function cacheKey(date, type) {
  return `tide_v${CACHE_VERSION}_${type}_${date}`;
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    // expire after 6 hours
    if (Date.now() - ts > 6 * 3600 * 1000) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}

function cacheSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

// --------------- COSINE FALLBACK MODEL -------------------
// Generates a plausible 24-h tide curve when no API is available.
// Uses a mixed semi-diurnal pattern tuned loosely for Christchurch.
function buildFallbackTides(dateStr) {
  // Derive NZ midnight as a UTC ms value without hardcoding the DST offset.
  // UTC midnight on dateStr lands on the same NZ calendar day (NZ is UTC+12/+13),
  // so we read back the NZ hour-of-day and subtract it to reach NZ midnight.
  const utcMs = new Date(dateStr + 'T00:00:00Z').getTime();
  const nzHour = parseInt(
    new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(new Date(utcMs)), 10
  );
  const base = utcMs - nzHour * 3600000;
  const M2 = 12.4206 * 3600 * 1000; // principal lunar semi-diurnal period (ms)
  const S2 = 12.0000 * 3600 * 1000;
  const K1 = 23.9345 * 3600 * 1000;

  // Seed offset based on day-of-year for rough phase variation
  const dayOffset = (new Date(dateStr).getTime() / 86400000) % 1;
  const phi1 = dayOffset * 2 * Math.PI;
  const phi2 = dayOffset * 2.7 * Math.PI;
  const phi3 = dayOffset * 0.9 * Math.PI;

  const MEAN = 1.0; // mean water level (m above chart datum)
  const A_M2 = 0.65;
  const A_S2 = 0.22;
  const A_K1 = 0.12;

  const points = [];
  const STEP = 10 * 60 * 1000; // 10-minute intervals
  for (let t = 0; t <= 24 * 3600 * 1000; t += STEP) {
    const ms = base + t;
    const h = MEAN
      + A_M2 * Math.cos((2 * Math.PI * t) / M2 + phi1)
      + A_S2 * Math.cos((2 * Math.PI * t) / S2 + phi2)
      + A_K1 * Math.cos((2 * Math.PI * t) / K1 + phi3);
    points.push({ dt: ms, height: Math.max(0, parseFloat(h.toFixed(3))) });
  }

  // Extract extremes
  const extremes = [];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1].height;
    const cur  = points[i].height;
    const next = points[i + 1].height;
    if (cur > prev && cur > next) extremes.push({ dt: points[i].dt, height: points[i].height, type: 'High' });
    if (cur < prev && cur < next) extremes.push({ dt: points[i].dt, height: points[i].height, type: 'Low' });
  }

  return { points, extremes };
}

// --------------- NIWA TIDE FETCH -------------------------
async function fetchNIWA(dateStr) {
  if (!NIWA_API_KEY) return null;
  const ck = cacheKey(dateStr, 'niwa');
  const cached = cacheGet(ck);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: LAT,
    long: LON,
    datum: 'MSL',
    numberOfDays: 2,
    startDate: dateStr,
    interval: 10,
  });
  const url = `https://api.niwa.co.nz/tides/data?${params}`;
  console.log('NIWA request URL:', url);

  try {
    const res = await fetch(url, {
      headers: { 'x-apikey': NIWA_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('NIWA API error:', res.status, body);
      return null;
    }
    const json = await res.json();

    // NIWA returns { values: [{time, value}], …}
    const raw = json.values || [];
    if (!raw.length) return null;

    const points = raw.map(v => ({
      dt: new Date(v.time).getTime(),
      height: parseFloat(parseFloat(v.value).toFixed(3)),
    }));

    const extremes = extractExtremes(points);
    const result = { points, extremes };
    cacheSet(ck, result);
    return result;
  } catch (err) {
    console.warn('NIWA fetch failed, using fallback:', err);
    return null;
  }
}

// --------------- WORLDTIDES FETCH ------------------------
async function fetchWorldTides(dateStr) {
  if (!WORLDTIDES_API_KEY) return null;
  const ck = cacheKey(dateStr, 'wt');
  const cached = cacheGet(ck);
  if (cached) return cached;

  const startEpoch = Math.floor(new Date(`${dateStr}T00:00:00+12:00`).getTime() / 1000);
  const endEpoch   = startEpoch + 86400 + 3600;

  const base = `https://www.worldtides.info/api/v3?heights&extremes`
    + `&lat=${LAT}&lon=${LON}&datum=LAT&step=600`
    + `&start=${startEpoch}&end=${endEpoch}&key=${WORLDTIDES_API_KEY}`;

  const res = await fetch(base);
  if (!res.ok) return null;
  const json = await res.json();

  const points = (json.heights || []).map(v => ({
    dt: v.dt * 1000,
    height: parseFloat(v.height.toFixed(3)),
  }));

  const extremes = (json.extremes || []).map(v => ({
    dt: v.dt * 1000,
    height: parseFloat(v.height.toFixed(3)),
    type: v.type, // 'High' or 'Low'
  }));

  const result = { points, extremes };
  cacheSet(ck, result);
  return result;
}

function extractExtremes(points) {
  // Use >= on the trailing side so flat plateaus in rounded data are handled:
  // the last equal point before descent counts as the peak.
  const raw = [];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i - 1].height, c = points[i].height, n = points[i + 1].height;
    if (c >= p && c > n) raw.push({ dt: points[i].dt, height: c, type: 'High' });
    if (c <= p && c < n) raw.push({ dt: points[i].dt, height: c, type: 'Low' });
  }
  // Deduplicate: keep only the first of any cluster within 1 hour
  return raw.filter((e, i) => i === 0 || e.dt - raw[i - 1].dt > 3600000);
}

// --------------- FETCH TIDES (with fallback chain) -------
async function fetchTides(dateStr) {
  let data = await fetchNIWA(dateStr);
  if (!data) data = await fetchWorldTides(dateStr);
  if (!data) data = buildFallbackTides(dateStr);
  return data;
}

// --------------- SUNRISE/SUNSET --------------------------
async function fetchSun(dateStr) {
  const ck = cacheKey(dateStr, 'sun');
  const cached = cacheGet(ck);
  if (cached) return cached;

  const url = `https://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LON}&date=${dateStr}&formatted=0`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('sun api failed');
    const json = await res.json();
    if (json.status !== 'OK') throw new Error('sun api bad status');
    const result = {
      sunrise: new Date(json.results.sunrise).getTime(),
      sunset:  new Date(json.results.sunset).getTime(),
    };
    cacheSet(ck, result);
    return result;
  } catch {
    return null;
  }
}

// --------------- NEXT TIDE BANNER ------------------------
function updateBanner(extremes, dateStr) {
  const el = document.getElementById('next-tide-text');
  const now = Date.now();

  // Filter extremes on the selected date
  const dayStart = new Date(`${dateStr}T00:00:00+12:00`).getTime();
  const dayEnd   = dayStart + 86400000;

  // Combine with tomorrow's extremes if available (already fetched)
  const upcoming = extremes
    .filter(e => e.dt > now)
    .sort((a, b) => a.dt - b.dt);

  if (!upcoming.length) {
    el.textContent = 'No more tides today.';
    return;
  }

  const next = upcoming[0];
  const remaining = next.dt - now;
  const timeStr = fmt12(new Date(next.dt));
  const durStr  = fmtDuration(remaining);

  el.textContent = `Next tide: ${next.type} at ${timeStr} (${durStr})`;
}

// --------------- CHART -----------------------------------
let chartInstance = null;

function buildChart(points, extremes, dateStr) {
  const ctx = document.getElementById('tide-chart').getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  // Limit points to the selected date in NZ time
  const dayStart = new Date(`${dateStr}T00:00:00+12:00`).getTime();
  const dayEnd   = dayStart + 86400000;

  const filtered = points.filter(p => p.dt >= dayStart && p.dt <= dayEnd);
  if (!filtered.length) return;

  const labels = filtered.map(p => {
    const d = new Date(p.dt);
    return d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE });
  });
  const heights = filtered.map(p => p.height);

  // Extreme point datasets
  const highPoints = extremes
    .filter(e => e.type === 'High' && e.dt >= dayStart && e.dt <= dayEnd)
    .map(e => {
      const d = new Date(e.dt);
      const label = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE });
      const idx = labels.indexOf(label);
      return { x: label, y: e.height };
    });

  const lowPoints = extremes
    .filter(e => e.type === 'Low' && e.dt >= dayStart && e.dt <= dayEnd)
    .map(e => {
      const d = new Date(e.dt);
      const label = d.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIMEZONE });
      return { x: label, y: e.height };
    });

  // Current time annotation
  const isToday = dateStr === todayNZString();

  // Custom plugin: vertical "now" line — uses proportional position so it
  // always lands correctly regardless of data interval boundaries.
  const nowLinePlugin = {
    id: 'nowLine',
    afterDraw(chart) {
      if (!isToday) return;
      const { ctx: c, scales } = chart;

      const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(new Date());
      const h = parseInt(p.find(pt => pt.type === 'hour').value, 10);
      const m = parseInt(p.find(pt => pt.type === 'minute').value, 10);
      const fraction = (h * 60 + m) / (24 * 60);

      const { left, right } = scales.x;
      const x = left + fraction * (right - left);
      const top    = scales.y.top;
      const bottom = scales.y.bottom;

      c.save();
      c.beginPath();
      c.moveTo(x, top);
      c.lineTo(x, bottom);
      c.strokeStyle = '#facc15';
      c.lineWidth = 2;
      c.setLineDash([6, 4]);
      c.stroke();
      c.restore();
    },
  };

  chartInstance = new Chart(ctx, {
    type: 'line',
    plugins: [nowLinePlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Tide height (m)',
          data: heights,
          borderColor: '#38bdf8',
          borderWidth: 2,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          ticks: {
            color: '#94a3b8',
            maxTicksLimit: 7,
            font: { size: 11 },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          suggestedMin: -0.5,
          ticks: {
            color: '#94a3b8',
            font: { size: 11 },
            callback: v => `${v.toFixed(1)}m`,
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: { size: 12 },
            boxWidth: 12,
          },
        },
        tooltip: {
          backgroundColor: '#1e293b',
          titleColor: '#e5e7eb',
          bodyColor: '#94a3b8',
          borderColor: '#334155',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toFixed(2)} m`,
          },
        },
      },
    },
  });
}

// --------------- MAIN LOAD -------------------------------
async function loadData(dateStr) {
  document.getElementById('error-message').classList.add('hidden');
  document.getElementById('next-tide-text').textContent = 'Loading…';
  document.getElementById('sunrise-text').textContent = 'Sunrise: —';
  document.getElementById('sunset-text').textContent  = 'Sunset: —';

  let tideData, sunData;

  try {
    [tideData, sunData] = await Promise.all([
      fetchTides(dateStr),
      fetchSun(dateStr),
    ]);
  } catch (err) {
    document.getElementById('error-message').classList.remove('hidden');
    document.getElementById('next-tide-text').textContent = 'Error loading data.';
    console.error(err);
    return;
  }

  // Sunrise / Sunset
  if (sunData) {
    document.getElementById('sunrise-text').textContent = `Sunrise: ${fmt12(new Date(sunData.sunrise))}`;
    document.getElementById('sunset-text').textContent  = `Sunset: ${fmt12(new Date(sunData.sunset))}`;
  }

  // If today, also load tomorrow extremes for "next tide" when today's are past
  let allExtremes = [...tideData.extremes];
  const isToday = dateStr === todayNZString();
  if (isToday) {
    const td = new Date(dateStr + 'T00:00:00Z'); td.setUTCDate(td.getUTCDate() + 1);
    const tomorrow = td.toISOString().slice(0, 10);
    try {
      const tmData = await fetchTides(tomorrow);
      allExtremes = allExtremes.concat(tmData.extremes);
    } catch {}
  }

  updateBanner(allExtremes, dateStr);
  buildChart(tideData.points, tideData.extremes, dateStr);
}

// --------------- INIT ------------------------------------
(function init() {
  const picker = document.getElementById('date-picker');
  const today  = todayNZString();
  picker.value = today;
  const maxD = new Date(today + 'T00:00:00Z'); maxD.setUTCDate(maxD.getUTCDate() + 30);
  const minD = new Date(today + 'T00:00:00Z'); minD.setUTCDate(minD.getUTCDate() - 30);
  picker.max = maxD.toISOString().slice(0, 10);
  picker.min = minD.toISOString().slice(0, 10);

  picker.addEventListener('change', () => {
    if (picker.value) loadData(picker.value);
  });

  loadData(today);
})();
