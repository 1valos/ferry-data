/**
 * fetcher.js  — v2
 * Gets ports + connections + indicative prices from Ferryhopper MCP.
 *
 * Strategy for prices (same as Ferryhopper map):
 *   For each connection, call search_trips for the next 7 days
 *   and store the lowest price found → the "from €X" value.
 */

const fs   = require('fs');
const path = require('path');

const MCP_URL  = 'https://mcp.ferryhopper.com/mcp';
const OUT_FILE = path.join(__dirname, 'data', 'routes.json');

const PRICE_DAYS = 7;   // days ahead to check per route
const DELAY_MS   = 400; // ms between requests — don't lower this

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nextDates(n) {
  const dates = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    d.setDate(d.getDate() + 1);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

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
    const line = text.split('\n').find(l => l.startsWith('data:'));
    if (!line) throw new Error('No SSE data line');
    return JSON.parse(line.slice(5).trim());
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
    : (result.trips ?? result.itineraries ?? result.results ?? []);

  let min = Infinity;
  for (const trip of trips) {
    const candidates = [
      trip.price, trip.minPrice, trip.totalPrice,
      trip.fare,  trip.cost,    trip.amount,
      trip.prices?.min, trip.pricing?.from
    ];
    for (const val of candidates) {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }
  }
  return min === Infinity ? null : min;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Ferry data fetch v2`);

  // 1 — ports
  console.log('Step 1/3 — ports...');
  const rawPorts = await callTool('get_ports');
  const ports    = Array.isArray(rawPorts) ? rawPorts : (rawPorts.ports ?? []);
  console.log(`  ${ports.length} ports`);

  // 2 — connections
  console.log('Step 2/3 — connections...');
  const connections = {};
  let done = 0;
  for (const port of ports) {
    await sleep(DELAY_MS);
    const name = port.name ?? port.id;
    try {
      const raw   = await callTool('get_direct_connections', { portLocation: name });
      const conns = Array.isArray(raw) ? raw : (raw.connections ?? raw.routes ?? []);
      connections[name] = conns;
    } catch (e) {
      console.warn(`  skip ${name}: ${e.message}`);
      connections[name] = [];
    }
    done++;
    if (done % 30 === 0) console.log(`  ${done}/${ports.length}`);
  }

  // 3 — prices
  console.log(`Step 3/3 — prices (${PRICE_DAYS} days per route)...`);
  const dates = nextDates(PRICE_DAYS);
  let checked = 0, found = 0;

  for (const [portName, conns] of Object.entries(connections)) {
    for (const conn of conns) {
      const dest = conn.destination ?? conn.destinationName ?? '';
      if (!dest) continue;

      let lowestPrice = null;
      let currency    = conn.currency ?? 'EUR';

      for (const date of dates) {
        await sleep(DELAY_MS);
        try {
          const result = await callTool('search_trips', {
            departureLocation: portName,
            arrivalLocation  : dest,
            date
          });
          const price = extractMinPrice(result);
          if (price !== null && (lowestPrice === null || price < lowestPrice)) {
            lowestPrice = price;
            const trips = Array.isArray(result) ? result : (result.trips ?? []);
            if (trips[0]?.currency) currency = trips[0].currency;
          }
        } catch { /* no trips this date */ }

        if (lowestPrice !== null) break; // found one, stop
      }

      if (lowestPrice !== null) { conn.minPrice = lowestPrice; conn.currency = currency; found++; }
      checked++;
      if (checked % 50 === 0) console.log(`  ${checked} routes checked, ${found} with prices`);
    }
  }

  console.log(`  ${found} prices across ${checked} routes`);

  const output = { fetchedAt: new Date().toISOString(), portCount: ports.length, ports, connections };
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  console.log(`Done → ${OUT_FILE} (${(fs.statSync(OUT_FILE).size/1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
