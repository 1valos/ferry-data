/**
 * fetcher.js — v5
 * Fixed: port names must be natural English (title case),
 * not all-caps codes. The MCP is an LLM that matches by name.
 */

const fs   = require('fs');
const path = require('path');

const MCP_URL  = 'https://mcp.ferryhopper.com/mcp';
const OUT_FILE = path.join(__dirname, 'data', 'routes.json');
const DELAY_MS = 600;

// ─── Routes: [departure, arrival, dep_lat, dep_lon, arr_lat, arr_lon] ──
const ROUTES = [
  // Piraeus hub
  ['Piraeus','Santorini',37.9426,23.6461,36.3932,25.4615],
  ['Piraeus','Mykonos',37.9426,23.6461,37.4467,25.3289],
  ['Piraeus','Naxos',37.9426,23.6461,37.1036,25.3761],
  ['Piraeus','Paros',37.9426,23.6461,37.0856,25.1499],
  ['Piraeus','Ios',37.9426,23.6461,36.7219,25.2742],
  ['Piraeus','Milos',37.9426,23.6461,36.7142,24.4392],
  ['Piraeus','Sifnos',37.9426,23.6461,36.9753,24.7282],
  ['Piraeus','Syros',37.9426,23.6461,37.4415,24.9369],
  ['Piraeus','Tinos',37.9426,23.6461,37.5386,25.1625],
  ['Piraeus','Andros',37.9426,23.6461,37.8451,24.9442],
  ['Piraeus','Heraklion',37.9426,23.6461,35.3387,25.1442],
  ['Piraeus','Rhodes',37.9426,23.6461,36.4431,28.2176],
  ['Piraeus','Kos',37.9426,23.6461,36.8933,27.2877],
  ['Piraeus','Chios',37.9426,23.6461,38.3671,26.1366],
  ['Piraeus','Mytilene',37.9426,23.6461,39.1072,26.5540],
  ['Piraeus','Samos',37.9426,23.6461,37.7549,26.9764],
  ['Piraeus','Ikaria',37.9426,23.6461,37.6190,26.1421],
  ['Piraeus','Limnos',37.9426,23.6461,39.8781,25.0631],
  ['Piraeus','Kavala',37.9426,23.6461,40.9395,24.4022],
  ['Piraeus','Patmos',37.9426,23.6461,37.3206,26.5456],
  ['Piraeus','Kalymnos',37.9426,23.6461,36.9549,26.9835],
  ['Piraeus','Leros',37.9426,23.6461,37.1509,26.8481],
  ['Piraeus','Hydra',37.9426,23.6461,37.3494,23.4641],
  ['Piraeus','Spetses',37.9426,23.6461,37.2596,23.1579],
  ['Piraeus','Poros',37.9426,23.6461,37.5074,23.4561],
  ['Piraeus','Aegina',37.9426,23.6461,37.7474,23.4271],
  ['Piraeus','Skiathos',37.9426,23.6461,39.1622,23.4936],
  ['Piraeus','Skopelos',37.9426,23.6461,39.1207,23.7228],
  ['Piraeus','Corfu',37.9426,23.6461,39.6243,19.9217],
  ['Piraeus','Kefalonia',37.9426,23.6461,38.1753,20.5690],
  ['Piraeus','Igoumenitsa',37.9426,23.6461,39.5026,20.2680],
  ['Piraeus','Patras',37.9426,23.6461,38.2462,21.7346],
  // Rafina hub
  ['Rafina','Mykonos',38.0225,24.0071,37.4467,25.3289],
  ['Rafina','Andros',38.0225,24.0071,37.8451,24.9442],
  ['Rafina','Tinos',38.0225,24.0071,37.5386,25.1625],
  ['Rafina','Naxos',38.0225,24.0071,37.1036,25.3761],
  ['Rafina','Paros',38.0225,24.0071,37.0856,25.1499],
  ['Rafina','Santorini',38.0225,24.0071,36.3932,25.4615],
  ['Rafina','Syros',38.0225,24.0071,37.4415,24.9369],
  // Heraklion hub
  ['Heraklion','Santorini',35.3387,25.1442,36.3932,25.4615],
  ['Heraklion','Mykonos',35.3387,25.1442,37.4467,25.3289],
  ['Heraklion','Paros',35.3387,25.1442,37.0856,25.1499],
  ['Heraklion','Naxos',35.3387,25.1442,37.1036,25.3761],
  ['Heraklion','Ios',35.3387,25.1442,36.7219,25.2742],
  ['Heraklion','Rhodes',35.3387,25.1442,36.4431,28.2176],
  ['Heraklion','Kos',35.3387,25.1442,36.8933,27.2877],
  // Santorini hub
  ['Santorini','Mykonos',36.3932,25.4615,37.4467,25.3289],
  ['Santorini','Naxos',36.3932,25.4615,37.1036,25.3761],
  ['Santorini','Paros',36.3932,25.4615,37.0856,25.1499],
  ['Santorini','Ios',36.3932,25.4615,36.7219,25.2742],
  ['Santorini','Heraklion',36.3932,25.4615,35.3387,25.1442],
  ['Santorini','Rhodes',36.3932,25.4615,36.4431,28.2176],
  ['Santorini','Milos',36.3932,25.4615,36.7142,24.4392],
  ['Santorini','Folegandros',36.3932,25.4615,36.6106,24.9228],
  // Mykonos hub
  ['Mykonos','Naxos',37.4467,25.3289,37.1036,25.3761],
  ['Mykonos','Paros',37.4467,25.3289,37.0856,25.1499],
  ['Mykonos','Ios',37.4467,25.3289,36.7219,25.2742],
  ['Mykonos','Santorini',37.4467,25.3289,36.3932,25.4615],
  ['Mykonos','Tinos',37.4467,25.3289,37.5386,25.1625],
  ['Mykonos','Syros',37.4467,25.3289,37.4415,24.9369],
  ['Mykonos','Ikaria',37.4467,25.3289,37.6190,26.1421],
  ['Mykonos','Samos',37.4467,25.3289,37.7549,26.9764],
  ['Mykonos','Patmos',37.4467,25.3289,37.3206,26.5456],
  ['Mykonos','Rhodes',37.4467,25.3289,36.4431,28.2176],
  // Rhodes hub
  ['Rhodes','Kos',36.4431,28.2176,36.8933,27.2877],
  ['Rhodes','Kalymnos',36.4431,28.2176,36.9549,26.9835],
  ['Rhodes','Patmos',36.4431,28.2176,37.3206,26.5456],
  ['Rhodes','Symi',36.4431,28.2176,36.6101,27.8433],
  ['Rhodes','Karpathos',36.4431,28.2176,35.5071,27.2131],
  ['Rhodes','Tilos',36.4431,28.2176,36.4273,27.3875],
  ['Rhodes','Nisyros',36.4431,28.2176,36.5875,27.1648],
  // Corfu / Ionian
  ['Corfu','Igoumenitsa',39.6243,19.9217,39.5026,20.2680],
  ['Igoumenitsa','Patras',39.5026,20.2680,38.2462,21.7346],
  ['Igoumenitsa','Brindisi',39.5026,20.2680,40.6326,17.9436],
  ['Igoumenitsa','Ancona',39.5026,20.2680,43.6158,13.5189],
  ['Igoumenitsa','Bari',39.5026,20.2680,41.1289,16.8669],
  ['Patras','Brindisi',38.2462,21.7346,40.6326,17.9436],
  ['Patras','Ancona',38.2462,21.7346,43.6158,13.5189],
  ['Patras','Bari',38.2462,21.7346,41.1289,16.8669],
  // Dodecanese
  ['Kos','Kalymnos',36.8933,27.2877,36.9549,26.9835],
  ['Kos','Leros',36.8933,27.2877,37.1509,26.8481],
  ['Kos','Patmos',36.8933,27.2877,37.3206,26.5456],
  ['Kos','Samos',36.8933,27.2877,37.7549,26.9764],
  // Sporades
  ['Skiathos','Skopelos',39.1622,23.4936,39.1207,23.7228],
  ['Volos','Skiathos',39.3597,22.9435,39.1622,23.4936],
  ['Volos','Skopelos',39.3597,22.9435,39.1207,23.7228],
  // North Aegean
  ['Mytilene','Chios',39.1072,26.5540,38.3671,26.1366],
  ['Chios','Samos',38.3671,26.1366,37.7549,26.9764],
  ['Samos','Ikaria',37.7549,26.9764,37.6190,26.1421],
  ['Samos','Patmos',37.7549,26.9764,37.3206,26.5456],
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nextDates(n) {
  const dates = [], base = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

async function mcpPost(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body   : JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const p = line.slice(5).trim();
        if (p && p !== '[DONE]') { try { return JSON.parse(p); } catch {} }
      }
    }
    throw new Error('No SSE data');
  }
  return JSON.parse(text);
}

async function callTool(name, args = {}) {
  const rpc  = await mcpPost('tools/call', { name, arguments: args });
  const text = rpc?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Empty from ${name}`);
  try { return JSON.parse(text); } catch { return text; }
}

function extractMinPrice(result) {
  // If it's a plain string ("Found 0 trips...") there's nothing to parse
  if (typeof result === 'string') return null;
  if (!result) return null;

  const trips = Array.isArray(result)
    ? result
    : (result.trips ?? result.itineraries ?? result.results ?? result.ferries ?? []);

  let min = Infinity;
  for (const trip of trips) {
    const vals = [
      trip.price, trip.minPrice, trip.lowestPrice, trip.totalPrice,
      trip.fare,  trip.cost,    trip.amount,
      trip.prices?.min, trip.pricing?.from
    ];
    for (const v of vals) {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }
    for (const arr of [trip.accommodations, trip.fares, trip.tickets, trip.cabins]) {
      for (const item of (arr ?? [])) {
        const n = parseFloat(item.price ?? item.fare ?? item.cost ?? item.amount);
        if (!isNaN(n) && n > 0 && n < min) min = n;
      }
    }
  }
  return min === Infinity ? null : Math.round(min * 100) / 100;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Ferry data fetch v5`);
  console.log(`  ${ROUTES.length} routes to check`);

  const dates = nextDates(14); // check 2 weeks ahead for better price coverage

  // Build unique port list
  const portMap = {};
  for (const [dep, arr, dlat, dlon, alat, alon] of ROUTES) {
    if (!portMap[dep]) portMap[dep] = { name: dep, lat: dlat, lon: dlon };
    if (!portMap[arr]) portMap[arr] = { name: arr, lat: alat, lon: alon };
  }
  const ports = Object.values(portMap);

  const connections = {};
  ports.forEach(p => { connections[p.name] = []; });

  let done = 0, found = 0;

  // Debug: print raw result for first route/date combination
  let debugDone = false;

  for (const [dep, arr] of ROUTES) {
    await sleep(DELAY_MS);
    done++;
    let lowestPrice = null;
    let currency = 'EUR';

    for (const date of dates) {
      await sleep(DELAY_MS);
      try {
        const result = await callTool('search_trips', {
          departureLocation: dep,
          arrivalLocation  : arr,
          date
        });

        if (!debugDone) {
          console.log(`  [DEBUG] ${dep} → ${arr} on ${date}:`);
          console.log(`  ${JSON.stringify(result).slice(0, 400)}`);
          debugDone = true;
        }

        const price = extractMinPrice(result);
        if (price !== null) {
          if (lowestPrice === null || price < lowestPrice) lowestPrice = price;
          const trips = Array.isArray(result) ? result : (result.trips ?? []);
          if (trips[0]?.currency) currency = trips[0].currency;
          break;
        }
      } catch {}
    }

    if (lowestPrice !== null) found++;
    connections[dep].push({ destination: arr, minPrice: lowestPrice, currency });
    console.log(`  [${done}/${ROUTES.length}] ${dep} → ${arr}: ${lowestPrice !== null ? `€${lowestPrice}` : 'no price'}`);
  }

  console.log(`\n  ✓ ${found}/${ROUTES.length} routes have prices`);

  const output = { fetchedAt: new Date().toISOString(), portCount: ports.length, ports, connections };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  console.log(`[${new Date().toISOString()}] Done → ${OUT_FILE} (${(fs.statSync(OUT_FILE).size/1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
