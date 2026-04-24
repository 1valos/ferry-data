/**
 * fetcher.js — v3
 * Fixed: connections were empty because port names didn't match
 * what the MCP server expects. Now tries port codes first,
 * then falls back to title-cased names.
 */

const fs   = require('fs');
const path = require('path');

const MCP_URL  = 'https://mcp.ferryhopper.com/mcp';
const OUT_FILE = path.join(__dirname, 'data', 'routes.json');
const DELAY_MS = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function nextDates(n) {
  const dates = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    dates.push(next.toISOString().slice(0, 10));
  }
  return dates;
}

// Title-case: "HERAKLIO" → "Heraklio"
function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
    // SSE: find the line with actual data
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data:')) {
        const payload = line.slice(5).trim();
        if (payload && payload !== '[DONE]') {
          try { return JSON.parse(payload); } catch {}
        }
      }
    }
    throw new Error('No valid SSE data line found');
  }

  return JSON.parse(text);
}

async function callTool(name, args = {}) {
  const rpc  = await mcpPost('tools/call', { name, arguments: args });
  const text = rpc?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Empty result from ${name}: ${JSON.stringify(rpc).slice(0,200)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// Try to get connections using port code first, then title-cased name
async function getConnections(port) {
  // Try 1: port code (e.g. "HER")
  if (port.code) {
    try {
      const raw   = await callTool('get_direct_connections', { portLocation: port.code });
      const conns = normalizeConns(raw);
      if (conns.length > 0) return conns;
    } catch {}
  }

  await sleep(200);

  // Try 2: title-cased name (e.g. "Heraklio")
  const titleName = toTitleCase(port.name);
  try {
    const raw   = await callTool('get_direct_connections', { portLocation: titleName });
    const conns = normalizeConns(raw);
    if (conns.length > 0) return conns;
  } catch {}

  await sleep(200);

  // Try 3: original name as-is
  try {
    const raw   = await callTool('get_direct_connections', { portLocation: port.name });
    const conns = normalizeConns(raw);
    return conns;
  } catch {}

  return [];
}

function normalizeConns(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return raw.connections ?? raw.routes ?? raw.destinations ?? [];
}

function extractMinPrice(result) {
  if (!result) return null;
  const trips = Array.isArray(result)
    ? result
    : (result.trips ?? result.itineraries ?? result.results ?? []);

  let min = Infinity;
  for (const trip of trips) {
    const candidates = [
      trip.price, trip.minPrice, trip.totalPrice, trip.lowestPrice,
      trip.fare,  trip.cost,    trip.amount,      trip.basePrice,
      trip.prices?.min, trip.pricing?.from, trip.pricing?.base
    ];
    for (const val of candidates) {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }

    // Also check nested accommodations/fares arrays
    const nested = trip.accommodations ?? trip.fares ?? trip.tickets ?? [];
    for (const item of nested) {
      const n = parseFloat(item.price ?? item.fare ?? item.cost ?? item.amount);
      if (!isNaN(n) && n > 0 && n < min) min = n;
    }
  }
  return min === Infinity ? null : Math.round(min * 100) / 100;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Ferry data fetch v3`);

  // ── Step 1: List tools to understand the API ──────────────
  console.log('Step 0: Checking available MCP tools...');
  try {
    const toolList = await mcpPost('tools/list', {});
    const tools = toolList?.result?.tools ?? [];
    tools.forEach(t => {
      console.log(`  Tool: ${t.name}`);
      if (t.inputSchema?.properties) {
        console.log(`    Params: ${Object.keys(t.inputSchema.properties).join(', ')}`);
      }
    });
  } catch (e) {
    console.warn('  Could not list tools:', e.message);
  }

  // ── Step 2: Get ports ─────────────────────────────────────
  console.log('\nStep 1/3 — Fetching ports...');
  const rawPorts = await callTool('get_ports');
  const ports    = Array.isArray(rawPorts) ? rawPorts : (rawPorts.ports ?? []);
  console.log(`  Got ${ports.length} ports`);

  // ── Step 3: Debug with a known port first ─────────────────
  console.log('\nStep 1.5 — Debug: testing connections for Heraklio/HER...');
  const testPort = ports.find(p => p.code === 'HER' || p.name === 'HERAKLIO') ?? { name: 'HERAKLIO', code: 'HER' };
  console.log(`  Test port object: ${JSON.stringify(testPort)}`);

  const debugTests = [
    { portLocation: 'HER' },
    { portLocation: 'Heraklio' },
    { portLocation: 'HERAKLIO' },
    { portLocation: 'Heraklion' },
  ];

  let workingParam = null;
  for (const args of debugTests) {
    await sleep(DELAY_MS);
    try {
      const raw = await callTool('get_direct_connections', args);
      const conns = normalizeConns(raw);
      console.log(`  ${JSON.stringify(args)} → ${conns.length} connections`);
      if (conns.length > 0 && !workingParam) {
        workingParam = args;
        console.log(`  ✓ Working format found: ${JSON.stringify(args)}`);
        console.log(`  Sample connection: ${JSON.stringify(conns[0])}`);
      }
    } catch(e) {
      console.log(`  ${JSON.stringify(args)} → ERROR: ${e.message}`);
    }
  }

  // ── Step 4: Get connections for all ports ─────────────────
  console.log('\nStep 2/3 — Fetching connections...');
  const connections = {};
  let done = 0, withConns = 0;

  // Focus on ports that are likely to have data (skip tiny/obscure)
  // We still try all, but log progress clearly
  for (const port of ports) {
    await sleep(DELAY_MS);
    const conns = await getConnections(port);
    connections[port.name] = conns;
    if (conns.length > 0) withConns++;
    done++;
    if (done % 50 === 0 || conns.length > 0) {
      if (conns.length > 0) console.log(`  [${done}/${ports.length}] ${port.name}: ${conns.length} connections`);
      else if (done % 50 === 0) console.log(`  Progress: ${done}/${ports.length} (${withConns} with connections)`);
    }
  }

  console.log(`  Done: ${withConns}/${ports.length} ports have connections`);

  // ── Step 5: Fetch prices ──────────────────────────────────
  console.log('\nStep 3/3 — Fetching prices...');
  const dates = nextDates(7);
  let checked = 0, found = 0;

  for (const [portName, conns] of Object.entries(connections)) {
    if (!conns.length) continue;

    for (const conn of conns) {
      // Destination can be in various fields
      const dest = conn.destination ?? conn.destinationName ??
                   conn.destinationPort ?? conn.arrival ?? conn.to ?? '';
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
          if (price !== null) {
            if (lowestPrice === null || price < lowestPrice) lowestPrice = price;
            const trips = Array.isArray(result) ? result : (result.trips ?? []);
            if (trips[0]?.currency) currency = trips[0].currency;
          }
        } catch { /* no trips this date */ }

        if (lowestPrice !== null) break;
      }

      if (lowestPrice !== null) {
        conn.minPrice = lowestPrice;
        conn.currency = currency;
        found++;
      }
      checked++;
      if (checked % 20 === 0) console.log(`  ${checked} routes, ${found} with prices`);
    }
  }

  console.log(`  Prices: ${found} found across ${checked} routes`);

  // ── Write output ──────────────────────────────────────────
  const output = {
    fetchedAt  : new Date().toISOString(),
    portCount  : ports.length,
    ports,
    connections
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`\n[${new Date().toISOString()}] Done → ${OUT_FILE} (${kb} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
