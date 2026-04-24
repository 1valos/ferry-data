# Ferry Map — Universal Edition 🚢

Works on **any website** (WordPress, static HTML, PHP, Node.js, Wix embed, anything).
No server required. Prices auto-update every night for free via GitHub Actions.

---

## How it works

```
GitHub Actions (free, daily at 3am)
  → runs fetcher.js
  → calls Ferryhopper MCP API
  → writes data/routes.json
  → commits to your repo

Your website
  → ferrymap.html fetches routes.json on page load
  → draws the Leaflet map with ports, lines, price bubbles
```

---

## Setup (5 steps)

### Step 1 — Create a GitHub repo

Go to github.com → New repository → name it e.g. `ferry-data` → **Public**.

Public is important so the raw JSON URL is accessible without authentication.

### Step 2 — Push these files

```
your-repo/
├── .github/
│   └── workflows/
│       └── fetch.yml     ← the cron job
├── data/
│   └── routes.json       ← auto-generated (leave empty for now)
├── fetcher.js
└── ferrymap.html
```

```bash
git init
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git add .
git commit -m "init ferry map"
git push -u origin main
```

### Step 3 — Run the first data fetch

Go to your GitHub repo → **Actions** tab → click "Refresh ferry data" → click "Run workflow".

This takes about 3–5 minutes. When it finishes, `data/routes.json` will appear in your repo.

### Step 4 — Update the DATA_URL in ferrymap.html

Open `ferrymap.html` and replace this line near the top of the script:

```js
const DATA_URL = 'https://raw.githubusercontent.com/YOUR_GITHUB_USER/YOUR_REPO/main/data/routes.json';
```

with your actual GitHub username and repo name, e.g.:

```js
const DATA_URL = 'https://raw.githubusercontent.com/johndoe/ferry-data/main/data/routes.json';
```

### Step 5 — Add the page to your website

**Option A — WordPress**
Upload `ferrymap.html` to your server via FTP, then create a new page at
`yoursite.com/maps/ferrymap` using a "Full Width" template and embed it:
```html
<iframe src="/ferry-data/ferrymap.html" width="100%" height="620" frameborder="0"></iframe>
```

**Option B — Static HTML site**
Copy `ferrymap.html` into your site folder at `public/maps/ferrymap.html`.
Done — it's accessible at `yoursite.com/maps/ferrymap.html`.

**Option C — Any other site**
Just copy the entire `<div class="fm-root">...</div>` block from inside
`ferrymap.html` and paste it into any page template. Include the Leaflet CSS/JS
in the `<head>` as well.

---

## Customisation

### Change the map area
Edit these two lines in `ferrymap.html`:
```js
const MAP_CENTER = [37.5, 24.0];  // lat, lon — currently centred on Greece
const MAP_ZOOM   = 6;             // 5 = zoomed out, 8 = zoomed in
```

### Change the map height
In the CSS, find `.fm-root` and change:
```css
height: 600px;   /* change to whatever fits your page */
```
Or use `height: 100vh` to fill the full browser window.

### Change the map tile style
Find the `L.tileLayer(...)` call and replace the URL:
```js
// Dark (default)
'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

// Light / clean
'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'

// Satellite
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
```

### Change the refresh schedule
Edit `.github/workflows/fetch.yml`:
```yaml
- cron: '0 3 * * *'    # every day at 3am UTC  (default)
- cron: '0 */6 * * *'  # every 6 hours
- cron: '0 3 * * 1'    # every Monday at 3am
```
Reference: https://crontab.guru

---

## Files

| File | What it does |
|---|---|
| `fetcher.js` | Pulls data from Ferryhopper MCP, writes `data/routes.json` |
| `.github/workflows/fetch.yml` | Runs `fetcher.js` on a schedule via GitHub Actions |
| `ferrymap.html` | Self-contained map page — add to your website |
| `data/routes.json` | Auto-generated — do not edit manually |
