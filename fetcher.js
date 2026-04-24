/**
 * fetcher.js — v6 (CRS API)
 * Uses the real Ferryhopper CRS backend:
 *   GET https://crs.ferryhopper.com/api/connections/active-prices/{CODE}/{YEAR}/{MONTH}
 *
 * Prices are returned in cents → divide by 100 for euros.
 * Fetches current month + next 5 months, takes global minimum per route.
 */

const fs   = require('fs');
const path = require('path');

const CRS_BASE = 'https://crs.ferryhopper.com/api/connections/active-prices';
const OUT_FILE = path.join(__dirname, 'data', 'routes.json');
const DELAY_MS = 300;

// ─── Operator names ───────────────────────────────────────────────────
const OPERATORS = {
  'ATC'  : 'Blue Star Ferries',
  'SJT'  : 'SeaJets',
  'FFE'  : 'Fast Ferries',
  'GST'  : 'Golden Star Ferries',
  'MSF'  : 'Hellenic Seaways',
  'MNA'  : 'Minoan Lines',
  'SRN'  : 'Saronic Ferries',
  'ANES' : 'ANES Ferries',
  'SLF'  : 'Saronikos Ferries',
  'SLFI' : 'Saronikos Ferries',
  'ALF'  : 'Alpha Ferries',
  'AF1'  : 'Aegean Flying Dolphins',
  'AFD'  : 'Aegean Flying Dolphins',
  'RMZ'  : 'Rolly Marine',
  'SKO'  : 'Skopelitis Lines',
};

// ─── Port list: code, name, lat, lon ─────────────────────────
// Greek + major Mediterranean ports with coordinates
const PORTS = [
  // Greece - Attica
  { code:'PIR', name:'Piraeus',         lat:37.9426, lon:23.6461 },
  { code:'RAF', name:'Rafina',          lat:38.0225, lon:24.0071 },
  { code:'LAV', name:'Lavrio',          lat:37.7167, lon:24.0583 },
  // Cyclades
  { code:'JTR', name:'Santorini',       lat:36.3932, lon:25.4615 },
  { code:'JMK', name:'Mykonos',         lat:37.4467, lon:25.3289 },
  { code:'JNX', name:'Naxos',           lat:37.1036, lon:25.3761 },
  { code:'PAS', name:'Paros',           lat:37.0856, lon:25.1499 },
  { code:'IOS', name:'Ios',             lat:36.7219, lon:25.2742 },
  { code:'MLO', name:'Milos',           lat:36.7142, lon:24.4392 },
  { code:'SIF', name:'Sifnos',          lat:36.9753, lon:24.7282 },
  { code:'JSY', name:'Syros',           lat:37.4415, lon:24.9369 },
  { code:'TIN', name:'Tinos',           lat:37.5386, lon:25.1625 },
  { code:'AND', name:'Andros',          lat:37.8451, lon:24.9442 },
  { code:'KEA', name:'Kea',             lat:37.6500, lon:24.3333 },
  { code:'KYT', name:'Kythnos',         lat:37.3833, lon:24.4167 },
  { code:'SER', name:'Serifos',         lat:37.1500, lon:24.5000 },
  { code:'SIK', name:'Sikinos',         lat:36.6853, lon:25.1133 },
  { code:'FOL', name:'Folegandros',     lat:36.6106, lon:24.9228 },
  { code:'ANA', name:'Anafi',           lat:36.3667, lon:25.7667 },
  { code:'AMO', name:'Amorgos',         lat:36.8333, lon:25.9000 },
  { code:'KOU', name:'Koufonissi',      lat:36.9333, lon:25.6000 },
  { code:'IRK', name:'Iraklia',         lat:36.8500, lon:25.4667 },
  { code:'SXI', name:'Schinoussa',      lat:36.8667, lon:25.5167 },
  { code:'DON', name:'Donoussa',        lat:37.1000, lon:25.8167 },
  // Crete
  { code:'HER', name:'Heraklion',       lat:35.3387, lon:25.1442 },
  { code:'RNO', name:'Rethimno',        lat:35.3667, lon:24.4833 },
  { code:'CHA', name:'Chania',          lat:35.5167, lon:24.0167 },
  { code:'AGN', name:'Ag. Nikolaos',    lat:35.1833, lon:25.7167 },
  { code:'JSH', name:'Sitia',           lat:35.2000, lon:26.1000 },
  // Dodecanese
  { code:'RHO', name:'Rhodes',          lat:36.4431, lon:28.2176 },
  { code:'KGS', name:'Kos',             lat:36.8933, lon:27.2877 },
  { code:'KAL', name:'Kalymnos',        lat:36.9549, lon:26.9835 },
  { code:'LER', name:'Leros',           lat:37.1509, lon:26.8481 },
  { code:'PMS', name:'Patmos',          lat:37.3206, lon:26.5456 },
  { code:'SYM', name:'Symi',            lat:36.6101, lon:27.8433 },
  { code:'AOK', name:'Karpathos',       lat:35.5071, lon:27.2131 },
  { code:'KSJ', name:'Kasos',           lat:35.4067, lon:26.9231 },
  { code:'THL', name:'Tilos',           lat:36.4273, lon:27.3875 },
  { code:'NIS', name:'Nisyros',         lat:36.5875, lon:27.1648 },
  { code:'CHL', name:'Chalki',          lat:36.2225, lon:27.5999 },
  { code:'KAZ', name:'Kastellorizo',    lat:36.1500, lon:29.5833 },
  { code:'JTY', name:'Astypalea',       lat:36.5500, lon:26.3667 },
  // Saronic
  { code:'AEG', name:'Aegina',          lat:37.7474, lon:23.4271 },
  { code:'HYD', name:'Hydra',           lat:37.3494, lon:23.4641 },
  { code:'SPE', name:'Spetses',         lat:37.2596, lon:23.1579 },
  { code:'POR', name:'Poros',           lat:37.5074, lon:23.4561 },
  { code:'PHE', name:'Porto Heli',      lat:37.3167, lon:23.1500 },
  // North Aegean
  { code:'LES', name:'Mytilene',        lat:39.1072, lon:26.5540 },
  { code:'CHI', name:'Chios',           lat:38.3671, lon:26.1366 },
  { code:'BTH', name:'Samos',           lat:37.7549, lon:26.9764 },
  { code:'IKA', name:'Ikaria',          lat:37.6190, lon:26.1421 },
  { code:'LMN', name:'Limnos',          lat:39.8781, lon:25.0631 },
  { code:'SAM', name:'Samothraki',      lat:40.4667, lon:25.5333 },
  { code:'AES', name:'Ag. Efstratios', lat:39.5333, lon:24.9833 },
  // Sporades
  { code:'JSI', name:'Skiathos',        lat:39.1622, lon:23.4936 },
  { code:'SKO', name:'Skopelos',        lat:39.1207, lon:23.7228 },
  { code:'ALO', name:'Alonissos',       lat:39.1575, lon:23.8666 },
  { code:'SKU', name:'Skyros',          lat:38.9000, lon:24.5667 },
  // Ionian
  { code:'CFU', name:'Corfu',           lat:39.6243, lon:19.9217 },
  { code:'IGO', name:'Igoumenitsa',     lat:39.5026, lon:20.2680 },
  { code:'GRA', name:'Patras',          lat:38.2462, lon:21.7346 },
  { code:'LEV', name:'Lefkada',         lat:38.8333, lon:20.7000 },
  { code:'ARM', name:'Argostoli',       lat:38.1753, lon:20.5690 },
  { code:'ZTH', name:'Zakynthos',       lat:37.7833, lon:20.8833 },
  { code:'KIL', name:'Kilini',          lat:37.9333, lon:21.1167 },
  { code:'VAS', name:'Vassiliki',       lat:38.6167, lon:20.5833 },
  // Mainland Greece
  { code:'KAV', name:'Kavala',          lat:40.9395, lon:24.4022 },
  { code:'VOL', name:'Volos',           lat:39.3597, lon:22.9435 },
  { code:'AGC', name:'Ag. Konstantinos',lat:38.7533, lon:22.8696 },
  { code:'KTH', name:'Kythira',         lat:36.1499, lon:22.9999 },
  // Italy (Adriatic)
  { code:'ANC', name:'Ancona',          lat:43.6158, lon:13.5189 },
  { code:'BAR', name:'Bari',            lat:41.1289, lon:16.8669 },
  { code:'BRI', name:'Brindisi',        lat:40.6326, lon:17.9436 },
  { code:'VEN', name:'Venice',          lat:45.4408, lon:12.3155 },
  { code:'TRE', name:'Trieste',         lat:45.6495, lon:13.7768 },
  // Italy (Tyrrhenian)
  { code:'GOA', name:'Genoa',           lat:44.4056, lon:8.9463  },
  { code:'LIV', name:'Livorno',         lat:43.5480, lon:10.3147 },
  { code:'CIV', name:'Civitavecchia',   lat:42.0939, lon:11.7944 },
  { code:'NAP', name:'Naples',          lat:40.8358, lon:14.2488 },
  { code:'PLE', name:'Palermo',         lat:38.1157, lon:13.3615 },
  { code:'CGA', name:'Cagliari',        lat:39.2238, lon:9.1217  },
  { code:'OLB', name:'Olbia',           lat:40.9236, lon:9.4989  },
  // Croatia
  { code:'SPA', name:'Split',           lat:43.5081, lon:16.4402 },
  { code:'DBV', name:'Dubrovnik',       lat:42.6507, lon:18.0944 },
  { code:'ZAD', name:'Zadar',           lat:44.1194, lon:15.2314 },
  { code:'HVA', name:'Hvar',            lat:43.1729, lon:16.4413 },
  { code:'KOR', name:'Korcula',         lat:42.9597, lon:17.1356 },
  // Albania / Montenegro
  { code:'DRZ', name:'Durres',          lat:41.3233, lon:19.4536 },
  { code:'SAR', name:'Sarandë',         lat:39.8753, lon:20.0042 },
];

// ─── Months to fetch ──────────────────────────────────────────
function getMonths(count = 6) {
  const months = [];
  const now    = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return months;
}

// ─── Helpers ──────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchPrices(code, year, month) {
  const url = `${CRS_BASE}/${code}/${year}/${month}`;
  const res  = await fetch(url, {
    headers: {
      'Origin' : 'https://www.ferryhopper.com',
      'Referer': 'https://www.ferryhopper.com/en/maps/ferries-map',
      'Accept' : 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; ferry-map-bot/1.0)'
    }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Ferry data fetch v6 (CRS API)`);

  const months = getMonths(6);
  console.log(`  Fetching ${PORTS.length} ports × ${months.length} months`);
  console.log(`  Months: ${months.map(m => `${m.year}/${m.month}`).join(', ')}`);

  // Build a port lookup: code → port object
  const portByCode = {};
  PORTS.forEach(p => { portByCode[p.code] = p; });

  // priceMap: { portCode: { destCode: minPriceCents } }
  const priceMap = {};
  // operatorMap: { portCode: { destCode: [{code, name, price}] } }
  const operatorMap = {};
  PORTS.forEach(p => { priceMap[p.code] = {}; operatorMap[p.code] = {}; });

  let reqDone = 0, totalReqs = PORTS.length * months.length;

  for (const port of PORTS) {
    for (const { year, month } of months) {
      await sleep(DELAY_MS);
      try {
        const rows = await fetchPrices(port.code, year, month);
        for (const row of rows) {
          const dest     = row.destination;
          const price    = parseInt(row.general_min_adult_price, 10);
          const opCode   = row.operator_code || '';
          if (!dest || isNaN(price)) continue;

          // Track min price
          if (!priceMap[port.code][dest] || price < priceMap[port.code][dest]) {
            priceMap[port.code][dest] = price;
          }

          // Track operators - deduplicate by code, keep lowest price per operator
          if (!operatorMap[port.code][dest]) operatorMap[port.code][dest] = {};
          if (!operatorMap[port.code][dest][opCode] || price < operatorMap[port.code][dest][opCode]) {
            operatorMap[port.code][dest][opCode] = price;
          }
        }
      } catch (e) {
        console.warn(`  skip ${port.code} ${year}/${month}: ${e.message}`);
      }

      reqDone++;
      if (reqDone % 50 === 0) {
        console.log(`  ${reqDone}/${totalReqs} requests done`);
      }
    }

    const connCount = Object.keys(priceMap[port.code]).length;
    if (connCount > 0) {
      console.log(`  ${port.code} (${port.name}): ${connCount} destinations`);
    }
  }

  // Build final connections structure
  const connections = {};
  for (const port of PORTS) {
    connections[port.code] = Object.entries(priceMap[port.code])
      .map(([destCode, cents]) => {
        // Build sorted operator list for this route
        const ops = Object.entries(operatorMap[port.code][destCode] || {})
          .map(([code, opCents]) => ({
            code,
            name : OPERATORS[code] || code,
            price: (opCents / 100).toFixed(2)
          }))
          .sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

        return {
          destination    : destCode,
          destinationName: portByCode[destCode]?.name ?? destCode,
          minPrice       : (cents / 100).toFixed(2),
          currency       : 'EUR',
          operators      : ops
        };
      })
      .sort((a, b) => parseFloat(a.minPrice) - parseFloat(b.minPrice));
  }

  const totalConnections = Object.values(connections).reduce((s, c) => s + c.length, 0);
  const portsWithConns   = Object.values(connections).filter(c => c.length > 0).length;
  console.log(`\n  ✓ ${portsWithConns}/${PORTS.length} ports have connections`);
  console.log(`  ✓ ${totalConnections} total route prices`);

  const output = {
    fetchedAt  : new Date().toISOString(),
    portCount  : PORTS.length,
    ports      : PORTS,
    connections,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(output));
  const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`[${new Date().toISOString()}] Done → ${OUT_FILE} (${kb} KB)`);
}

main().catch(e => { console.error(e); process.exit(1); });
