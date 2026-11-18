// Holt stündlich die EU-Forever-AH-Preise und baut Preisverlauf auf.
// Aufruf: node update.mjs <ausgabe-ordner>
// Quelle (Übergang): forever-prices (Blizzard-API, stündlich), github.com/mkborik-cloud/forever-prices
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'out';
const SRC = 'https://raw.githubusercontent.com/mkborik-cloud/forever-prices/data/prices.lua';
const HOUSES = { A: 111, H: 114, N: 117 }; // Normal (PvE): Allianz, Horde, Blackwater
const SHARDS = 32;
const HOURS_KEEP = 168; // 7 Tage stündlich
const DAYS_KEEP = 30;   // 30 Tage täglich

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const writeJson = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d)); };

const res = await fetch(SRC, { headers: { 'User-Agent': 'WoW-Forever-Auktionshaus (GitHub Actions)' } });
if (!res.ok) { console.error('Quelle nicht erreichbar:', res.status); process.exit(1); }
const lua = await res.text();

// prices.lua einlesen: Häuser mit Scan-Zeit und Items "min,markt,7d,menge,auktionen"
const houses = {};
let cur = null;
for (const line of lua.split('\n')) {
  let m = line.match(/^M\[(\d+)\] = \{.*?scanned = (\d+)/);
  if (m) { cur = +m[1]; houses[cur] = { scanned: +m[2] * 1000, items: {} }; continue; }
  m = line.match(/^do local d = M\[(\d+)\]/);
  if (m) { cur = +m[1]; houses[cur] ||= { scanned: 0, items: {} }; continue; }
  m = line.match(/^d\[(\d+)\]="([^"]+)"/);
  if (m && cur != null) houses[cur].items[m[1]] = m[2].split(',').map(Number);
}

const latestOld = readJson(path.join(OUT, 'latest.json'), null);
const latest = { updated: Date.now(), source: 'forever-prices (Blizzard-API)', scanned: {} };
let changed = false;

for (const [f, hid] of Object.entries(HOUSES)) {
  const h = houses[hid];
  if (!h || !Object.keys(h.items).length) { console.error('Haus fehlt:', hid); process.exit(1); }
  latest.scanned[f] = h.scanned;
  latest[f] = h.items;
  if (!latestOld || latestOld.scanned?.[f] !== h.scanned) changed = true;

  const hour = Math.floor(h.scanned / 36e5) * 36e5;
  const day = new Date(h.scanned).toISOString().slice(0, 10);
  for (let s = 0; s < SHARDS; s++) {
    // Stündlich: Marktpreis je Stunde
    const hf = path.join(OUT, 'h', `${f}-${s}.json`);
    const H = readJson(hf, { t: [], i: {} });
    let hi = H.t.indexOf(hour);
    if (hi < 0) { H.t.push(hour); hi = H.t.length - 1; for (const k in H.i) H.i[k].push(null); }
    // Tageswerte: Tief, Markt, Menge (letzter Stand des Tages)
    const df = path.join(OUT, 'd', `${f}-${s}.json`);
    const D = readJson(df, { t: [], i: {} });
    let di = D.t.indexOf(day);
    if (di < 0) { D.t.push(day); di = D.t.length - 1; for (const k in D.i) D.i[k].push(null); }

    for (const [id, v] of Object.entries(h.items)) {
      if (+id % SHARDS !== s) continue;
      (H.i[id] ||= new Array(H.t.length).fill(null))[hi] = v[1];
      (D.i[id] ||= new Array(D.t.length).fill(null))[di] = [v[0], v[1], v[3]];
    }
    // Kürzen
    const cutH = Math.max(0, H.t.length - HOURS_KEEP), cutD = Math.max(0, D.t.length - DAYS_KEEP);
    if (cutH) { H.t = H.t.slice(cutH); for (const k in H.i) H.i[k] = H.i[k].slice(cutH); }
    if (cutD) { D.t = D.t.slice(cutD); for (const k in D.i) D.i[k] = D.i[k].slice(cutD); }
    for (const k in H.i) if (H.i[k].every(x => x == null)) delete H.i[k];
    for (const k in D.i) if (D.i[k].every(x => x == null)) delete D.i[k];
    writeJson(hf, H); writeJson(df, D);
  }
}

writeJson(path.join(OUT, 'latest.json'), latest);
console.log(changed ? 'Neuer Datenstand gespeichert.' : 'Kein neuer Scan, Dateien aktualisiert.');
