/**
 * fetcher.js — v4
 * Skips get_direct_connections entirely (unreliable).
 * Uses a hardcoded list of real ferry routes and calls
 * search_trips directly for each one to get live prices.
 */

const fs   = require('fs');
const path = require('path');

const MCP_URL  = 'https://mcp.ferryhopper.com/mcp';
const OUT_FILE = path.join(__dirname, 'data', 'routes.json');
const DELAY_MS = 500;

// ─── Known ferry routes ───────────────────────────────────────
// Add or remove routes here to customise your map.
// Format: [departure, arrival]
const ROUTES = [
  // Piraeus hub
  ['PIRAEUS', 'THIRA (SANTORINI)'],
  ['PIRAEUS', 'MYKONOS'],
  ['PIRAEUS', 'NAXOS'],
  ['PIRAEUS', 'PAROS'],
  ['PIRAEUS', 'IOS'],
  ['PIRAEUS', 'MILOS'],
  ['PIRAEUS', 'SIFNOS'],
  ['PIRAEUS', 'SYROS'],
  ['PIRAEUS', 'TINOS'],
  ['PIRAEUS', 'ANDROS'],
  ['PIRAEUS', 'HERAKLIO'],
  ['PIRAEUS', 'RODOS'],
  ['PIRAEUS', 'KOS'],
  ['PIRAEUS', 'CHIOS'],
  ['PIRAEUS', 'MITILINI (LESBOS)'],
  ['PIRAEUS', 'SAMOS'],
  ['PIRAEUS', 'IKARIA'],
  ['PIRAEUS', 'LIMNOS'],
  ['PIRAEUS', 'KAVALA'],
  ['PIRAEUS', 'PATMOS'],
  ['PIRAEUS', 'KALYMNOS'],
  ['PIRAEUS', 'LEROS'],
  ['PIRAEUS', 'KYTHIRA'],
  ['PIRAEUS', 'HYDRA'],
  ['PIRAEUS', 'SPETSES'],
  ['PIRAEUS', 'POROS'],
  ['PIRAEUS', 'AEGINA'],
  ['PIRAEUS', 'SKIATHOS'],
  ['PIRAEUS', 'SKOPELOS'],
  ['PIRAEUS', 'CORFU'],
  ['PIRAEUS', 'KEFALONIA (ALL PORTS)'],
  ['PIRAEUS', 'IGOUMENITSA'],
  ['PIRAEUS', 'PATRA'],
  // Rafina hub
  ['RAFINA', 'MYKONOS'],
  ['RAFINA', 'ANDROS'],
  ['RAFINA', 'TINOS'],
  ['RAFINA', 'NAXOS'],
  ['RAFINA', 'PAROS'],
  ['RAFINA', 'THIRA (SANTORINI)'],
  ['RAFINA', 'SYROS'],
  // Heraklion hub
  ['HERAKLIO', 'THIRA (SANTORINI)'],
  ['HERAKLIO', 'MYKONOS'],
  ['HERAKLIO', 'PAROS'],
  ['HERAKLIO', 'NAXOS'],
  ['HERAKLIO', 'IOS'],
  ['HERAKLIO', 'RODOS'],
  ['HERAKLIO', 'KOS'],
  // Santorini hub
  ['THIRA (SANTORINI)', 'MYKONOS'],
  ['THIRA (SANTORINI)', 'NAXOS'],
  ['THIRA (SANTORINI)', 'PAROS'],
  ['THIRA (SANTORINI)', 'IOS'],
  ['THIRA (SANTORINI)', 'HERAKLIO'],
  ['THIRA (SANTORINI)', 'RODOS'],
  ['THIRA (SANTORINI)', 'KOS'],
  ['THIRA (SANTORINI)', 'MILOS'],
  ['THIRA (SANTORINI)', 'FOLEGANDROS'],
  ['THIRA (SANTORINI)', 'SIKINOS'],
  // Mykonos hub
  ['MYKONOS', 'NAXOS'],
  ['MYKONOS', 'PAROS'],
  ['MYKONOS', 'IOS'],
  ['MYKONOS', 'THIRA (SANTORINI)'],
  ['MYKONOS', 'TINOS'],
  ['MYKONOS', 'SYROS'],
  ['MYKONOS', 'IKARIA'],
  ['MYKONOS', 'SAMOS'],
  ['MYKONOS', 'PATMOS'],
  ['MYKONOS', 'RODOS'],
  ['MYKONOS', 'KOS'],
  // Rhodes hub
  ['RODOS', 'KOS'],
  ['RODOS', 'KALYMNOS'],
  ['RODOS', 'PATMOS'],
  ['RODOS', 'SYMI (ALL PORTS)'],
  ['RODOS', 'KARPATHOS (ALL PORTS)'],
  ['RODOS', 'KASOS'],
  ['RODOS', 'TILOS'],
  ['RODOS', 'NISYROS'],
  ['RODOS', 'CHALKI'],
  // Corfu / Ionian
  ['CORFU', 'IGOUMENITSA'],
  ['CORFU', 'PATRA'],
  ['IGOUMENITSA', 'PATRA'],
  ['IGOUMENITSA', 'BRINDISI'],
  ['IGOUMENITSA', 'ANCONA'],
  ['IGOUMENITSA', 'BARI'],
  ['PATRA', 'BRINDISI'],
  ['PATRA', 'ANCONA'],
  ['PATRA', 'BARI'],
  // Dodecanese
  ['KOS', 'KALYMNOS'],
  ['KOS', 'LEROS'],
  ['KOS', 'PATMOS'],
  ['KOS', 'SAMOS'],
  ['KOS', 'RODOS'],
  // Sporades
  ['AG. KONSTANTINOS', 'SKIATHOS'],
  ['AG. KONSTANTINOS', 'SKOPELOS'],
  ['AG. KONSTANTINOS', 'ALONISSOS'],
  ['SKIATHOS', 'SKOPELOS'],
  ['SKIATHOS', 'ALONISSOS'],
  ['VOLOS', 'SKIATHOS'],
  ['VOLOS', 'SKOPELOS'],
  ['VOLOS', 'ALONISSOS'],
  // North Aegean
  ['KAVALA', 'LIMNOS'],
  ['KAVALA', 'MITILINI (LESBOS)'],
  ['MITILINI (LESBOS)', 'CHIOS'],
  ['CHIOS', 'SAMOS'],
  ['SAMOS', 'IKARIA'],
  ['SAMOS', 'PATMOS'],
];

// Port coordinates (lat, lon) for the map dots
// These are the ports referenced in ROUTES above
const PORT_COORDS = {
  'PIRAEUS'              : { lat: 37.9426, lon: 23.6461 },
  'RAFINA'               : { lat: 38.0225, lon: 24.0071 },
  'HERAKLIO'             : { lat: 35.3387, lon: 25.1442 },
  'THIRA (SANTORINI)'    : { lat: 36.3932, lon: 25.4615 },
  'MYKONOS'              : { lat: 37.4467, lon: 25.3289 },
  'NAXOS'                : { lat: 37.1036, lon: 25.3761 },
  'PAROS'                : { lat: 37.0856, lon: 25.1499 },
  'IOS'                  : { lat: 36.7219, lon: 25.2742 },
  'MILOS'                : { lat: 36.7142, lon: 24.4392 },
  'SIFNOS'               : { lat: 36.9753, lon: 24.7282 },
  'SYROS'                : { lat: 37.4415, lon: 24.9369 },
  'TINOS'                : { lat: 37.5386, lon: 25.1625 },
  'ANDROS'               : { lat: 37.8451, lon: 24.9442 },
  'RODOS'                : { lat: 36.4431, lon: 28.2176 },
  'KOS'                  : { lat: 36.8933, lon: 27.2877 },
  'CHIOS'                : { lat: 38.3671, lon: 26.1366 },
  'MITILINI (LESBOS)'    : { lat: 39.1072, lon: 26.5540 },
  'SAMOS'                : { lat: 37.7549, lon: 26.9764 },
  'IKARIA'               : { lat: 37.6190, lon: 26.1421 },
  'LIMNOS'               : { lat: 39.8781, lon: 25.0631 },
  'KAVALA'               : { lat: 40.9395, lon: 24.4022 },
  'PATMOS'               : { lat: 37.3206, lon: 26.5456 },
  'KALYMNOS'             : { lat: 36.9549, lon: 26.9835 },
  'LEROS'                : { lat: 37.1509, lon: 26.8481 },
  'KYTHIRA'              : { lat: 36.1499, lon: 22.9999 },
  'HYDRA'                : { lat: 37.3494, lon: 23.4641 },
  'SPETSES'              : { lat: 37.2596, lon: 23.1579 },
  'POROS'                : { lat: 37.5074, lon: 23.4561 },
  'AEGINA'               : { lat: 37.7474, lon: 23.4271 },
  'SKIATHOS'             : { lat: 39.1622, lon: 23.4936 },
  'SKOPELOS'             : { lat: 39.1207, lon: 23.7228 },
  'ALONISSOS'            : { lat: 39.1575, lon: 23.8666 },
  'CORFU'                : { lat: 39.6243, lon: 19.9217 },
  'IGOUMENITSA'          : { lat: 39.5026, lon: 20.2680 },
  'PATRA'                : { lat: 38.2462, lon: 21.7346 },
  'BRINDISI'             : { lat: 40.6326, lon: 17.9436 },
  'ANCONA'               : { lat: 43.6158, lon: 13.5189 },
  'BARI'                 : { lat: 41.1289, lon: 16.8669 },
  'FOLEGANDROS'          : { lat: 36.6106, lon: 24.9228 },
  'SIKINOS'              : { lat: 36.6853, lon: 25.1133 },
  'SYMI (ALL PORTS)'     : { lat: 36.6101, lon: 27.8433 },
  'KARPATHOS (ALL PORTS)': { lat: 35.5071, lon: 27.2131 },
  'KASOS'                : { lat: 35.4067, lon: 26.9231 },
  'TILOS'                : { lat: 36.4273, lon: 27.3875 },
  'NISYROS'              : { lat: 36.5875, lon: 27.1648 },
  'CHALKI'               : { lat: 36.2225, lon: 27.5999 },
  'AG. KONSTANTINOS'     : { lat: 38.7533, lon: 22.8696 },
  'VOLOS'                : { lat: 39.3597, lon: 22.9435 },
};

// ─── Helpers ──────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function mcpPost(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept'      : 'application/json, text/event-stream'
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });

  const ct   = res.headers.get('content-type') || '';
  const text = await res.text();

  if (ct.includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload && payload !== '[DONE]') {
          try { return JSON.parse(payload); } catch {}
        }
      }
    }
    throw new Error('No valid SSE data line');
  }
  return JSON.parse(text);
}

async function callTool(name, args = {}) {
  const rpc  = await mcpPost('tools/call', { name, arguments: args });
  const text = rpc?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Empty result from ${name}`);
  try { return JSON.parse(text); } catch { return text; }
}

function extractMinPrice(result) {
  if (!result) return null;
  const trips = Array.isArray(result)
    ? result
    : (result.trips ?? result.itineraries ?? result.results ?? result.ferries ?? []);

  let min = Infinity;

  for (const trip of trips) {
    const vals = [
      trip.price, trip.minPrice, trip.lowestPrice, trip.totalPrice,
      trip.fare,  trip.cost,    trip.amount,
      trip.prices?.min, trip.pricing?.from, trip.pricing?.base
    ];
    for (const v of vals) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }

    // check nested fare arrays
    for (const arr of [trip.accommodations, trip.fares, trip.tickets, trip.cabins]) {
      for (const item of (arr ?? [])) {
        const n = parseFloat(item.price ?? item.fare ?? item.cost ?? item.amount ?? item.value);
        if (!isNaN(n) && n > 0 && n < min) min = n;
      }
    }
  }
  return min === Infinity ? null : Math.round(min * 100) / 100;
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Ferry data fetch v4`);
  console.log(`  ${ROUTES.length} routes to check`);

  // Collect unique port names from routes
  const portNames = [...new Set(ROUTES.flat())];

  // Build port list with coordinates
  const ports = portNames.map(name => ({
    name,
    ...(PORT_COORDS[name] ?? {}),
  }));

  // Dates to check: next 7 days
  const dates = nextDates(7);

  // connections map: { portName: [{destination, minPrice, currency}] }
  const connections = {};
  portNames.forEach(p => { connections[p] = []; });

  let done = 0, found = 0;

  for (const [dep, arr] of ROUTES) {
    await sleep(DELAY_MS);
    done++;

    let lowestPrice = null;
    let currency    = 'EUR';

    for (const date of dates) {
      await sleep(DELAY_MS);
      try {
        const result = await callTool('search_trips', {
          departureLocation: dep,
          arrivalLocation  : arr,
          date
        });

        // Log raw result for first route so we can debug field names
        if (done === 1 && date === dates[0]) {
          const raw = JSON.stringify(result).slice(0, 500);
          console.log(`  [DEBUG] search_trips raw sample: ${raw}`);
        }

        const price = extractMinPrice(result);
        if (price !== null) {
          if (lowestPrice === null || price < lowestPrice) lowestPrice = price;
          const trips = Array.isArray(result) ? result : (result.trips ?? result.itineraries ?? []);
          if (trips[0]?.currency) currency = trips[0].currency;
          break; // found a price, no need to check more dates
        }
      } catch (e) {
        // no trips this date, continue
      }
    }

    if (lowestPrice !== null) found++;

    connections[dep].push({
      destination: arr,
      minPrice   : lowestPrice,
      currency
    });

    console.log(`  [${done}/${ROUTES.length}] ${dep} → ${arr}: ${lowestPrice !== null ? `€${lowestPrice}` : 'no price'}`);
  }

  console.log(`\n  ✓ ${found}/${ROUTES.length} routes have prices`);

  const output = {
    fetchedAt  : new Date().toISOString(),
    portCount  : ports.length,
    ports,
    connections
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`[${new Date().toISOString()}] Written → ${OUT_FILE} (${kb} KB)`);
}

function nextDates(n) {
  const dates = [];
  const base  = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

main().catch(e => { console.error(e); process.exit(1); });
