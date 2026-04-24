/**
 * fetcher.js
 * Run by GitHub Actions every night.
 * Calls the Ferryhopper MCP, collects all ports + connections,
 * writes the result to data/routes.json.
 */

const fs   = require('fs');
const path = require('path');

const MCP_URL   = 'https://mcp.ferryhopper.com/mcp';
const OUT_FILE  = path.join(__dirname, 'data', 'routes.json');

// ─── MCP helpers ─────────────────────────────────────────────

async function mcpPost(method, params = {}) {
  const res = await fetch(MCP_URL, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body   : JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  // MCP can reply as SSE or plain JSON
  if (contentType.includes('text/event-stream')) {
    const line = text.split('\n').find(l => l.startsWith('data:'));
    if (!line) throw new Error('No data line in SSE');
    return JSON.parse(line.slice(5).trim());
  }
  return JSON.parse(text);
}

async function callTool(name, args = {}) {
  const rpc = await mcpPost('tools/call', { name, arguments: args });
  const text = rpc?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Empty result from ${name}: ${JSON.stringify(rpc)}`);
  try { return JSON.parse(text); } catch { return text; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log(`[${new Date().toISOString()}] Fetching ports...`);

  const raw   = await callTool('get_ports');
  const ports = Array.isArray(raw) ? raw : (raw.ports ?? []);
  console.log(`  ${ports.length} ports found`);

  const connections = {};
  let i = 0;

  for (const port of ports) {
    await sleep(300); // be polite — 300ms between requests
    const name = port.name ?? port.id;

    try {
      const data  = await callTool('get_direct_connections', { portLocation: name });
      const conns = Array.isArray(data) ? data : (data.connections ?? data.routes ?? []);
      connections[name] = conns;
    } catch (e) {
      console.warn(`  skip ${name}: ${e.message}`);
      connections[name] = [];
    }

    i++;
    if (i % 20 === 0) console.log(`  ${i}/${ports.length}...`);
  }

  const output = {
    fetchedAt  : new Date().toISOString(),
    portCount  : ports.length,
    ports,
    connections        // { "Heraklion": [{destination, minPrice, ...}], ... }
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));   // minified — smaller file
  console.log(`Done → ${OUT_FILE}  (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
