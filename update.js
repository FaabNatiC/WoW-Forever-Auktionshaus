// Holt stündlich die EU-Forever-AH-Preise (Normal) und baut Preisverlauf auf.
// Aufruf: node update.js <ausgabe-ordner>  (ES-Modul, siehe package.json)
// Preise: Blizzard-API direkt (BLIZZARD_CLIENT_ID/SECRET), Ausweichquelle forever-prices.
// Namen/Icons: Blizzard-API (static-forever-eu, de_DE), schrittweise je Lauf ergänzt.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'out';
const ID = process.env.BLIZZARD_CLIENT_ID, SECRET = process.env.BLIZZARD_CLIENT_SECRET;
const API = process.env.BZ_API || 'https://eu.api.blizzard.com';
const RULESET = 2; // Normal
const HOUSES = { A: 111, H: 114, N: 117 }; // Normal (PvE): Allianz, Horde, Blackwater
const FALLBACK = 'https://raw.githubusercontent.com/mkborik-cloud/forever-prices/data/prices.lua';
const SHARDS = 32, HOURS_KEEP = 168, DAYS_KEEP = 30;
const NAME_BUDGET = 3000;          // neue Item-Namen je Lauf
const RETRY_MISS_MS = 7 * 864e5;   // nicht gefundene Items nach 7 Tagen erneut prüfen

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const writeJson = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d)); };
const log = (...a) => console.log(...a);

// ---------- Blizzard ----------
let token = null;
async function getToken() {
  if (!ID || !SECRET) return null;
  const r = await fetch(process.env.BZ_OAUTH || 'https://oauth.battle.net/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(ID + ':' + SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!r.ok) { log('Token fehlgeschlagen:', r.status); return null; }
  return (await r.json()).access_token;
}
async function bz(p, ns, extra = '') {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}${p}?namespace=${ns}${extra}`, { headers: { Authorization: 'Bearer ' + token } });
    if (r.status === 404) return null;
    if (r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 1000 * (i + 1))); continue; }
    if (!r.ok) throw new Error(`${p} → ${r.status}`);
    return r.json();
  }
  throw new Error(`${p} → keine Antwort`);
}

// Ein Auktionshaus zu Item-Zeilen [min, markt, 7d(später), menge, auktionen] verdichten
function summarize(auctions) {
  const by = {};
  for (const a of auctions) {
    const id = a.item?.id; if (!id) continue;
    const qty = a.quantity || 1;
    const unit = a.unit_price ?? (a.buyout != null ? Math.round(a.buyout / qty) : null);
    if (!unit) continue;
    (by[id] ||= []).push([unit, qty]);
  }
  const out = {};
  for (const [id, list] of Object.entries(by)) {
    list.sort((x, y) => x[0] - y[0]);
    const total = list.reduce((s, x) => s + x[1], 0);
    // Marktpreis: mengengewichteter Schnitt der günstigsten 15 % (mind. 1 Einheit)
    let need = Math.max(1, Math.ceil(total * 0.15)), sum = 0, got = 0;
    for (const [u, q] of list) { const take = Math.min(q, need - got); sum += u * take; got += take; if (got >= need) break; }
    out[id] = [list[0][0], Math.round(sum / got), 0, total, list.length];
  }
  return out;
}

async function pricesFromBlizzard() {
  const res = {};
  for (const [f, hid] of Object.entries(HOUSES)) {
    const base = `/data/wow/ruleset/${RULESET}/auctions/${hid}`;
    const house = await bz(base, 'dynamic-forever-eu');
    const comm = await bz(base + '/commodities', 'dynamic-forever-eu').catch(() => null);
    const all = [...(house?.auctions || []), ...(comm?.auctions || [])];
    const items = summarize(all);
    if (Object.keys(items).length < 300) throw new Error(`Haus ${hid}: nur ${Object.keys(items).length} Items`);
    res[f] = { scanned: Date.now(), items };
    log(`Blizzard ${f}/${hid}: ${all.length} Auktionen, ${Object.keys(items).length} Items`);
  }
  return res;
}

async function pricesFromFallback() {
  const r = await fetch(FALLBACK, { headers: { 'User-Agent': 'WoW-Forever-Auktionshaus (GitHub Actions)' } });
  if (!r.ok) throw new Error('Ausweichquelle nicht erreichbar: ' + r.status);
  const houses = {}; let cur = null;
  for (const line of (await r.text()).split('\n')) {
    let m = line.match(/^M\[(\d+)\] = \{.*?scanned = (\d+)/);
    if (m) { cur = +m[1]; houses[cur] = { scanned: +m[2] * 1000, items: {} }; continue; }
    m = line.match(/^do local d = M\[(\d+)\]/);
    if (m) { cur = +m[1]; houses[cur] ||= { scanned: 0, items: {} }; continue; }
    m = line.match(/^d\[(\d+)\]="([^"]+)"/);
    if (m && cur != null) houses[cur].items[m[1]] = m[2].split(',').map(Number);
  }
  const res = {};
  for (const [f, hid] of Object.entries(HOUSES)) {
    if (!houses[hid] || !Object.keys(houses[hid].items).length) throw new Error('Haus fehlt: ' + hid);
    res[f] = houses[hid];
  }
  return res;
}

// ---------- Ablauf ----------
token = await getToken().catch(e => { log('Token:', e.message); return null; });
let prices, source;
if (token) {
  try { prices = await pricesFromBlizzard(); source = 'Blizzard-API'; }
  catch (e) { log('Blizzard-AH fehlgeschlagen, nutze Ausweichquelle:', e.message); }
}
if (!prices) { prices = await pricesFromFallback(); source = 'forever-prices (Blizzard-API)'; }

const latestOld = readJson(path.join(OUT, 'latest.json'), null);
const latest = { updated: Date.now(), source, scanned: {} };

for (const [f, h] of Object.entries(prices)) {
  latest.scanned[f] = h.scanned;
  const hour = Math.floor(h.scanned / 36e5) * 36e5;
  const day = new Date(h.scanned).toISOString().slice(0, 10);
  for (let s = 0; s < SHARDS; s++) {
    const hf = path.join(OUT, 'h', `${f}-${s}.json`), df = path.join(OUT, 'd', `${f}-${s}.json`);
    const H = readJson(hf, { t: [], i: {} }), D = readJson(df, { t: [], i: {} });
    let hi = H.t.indexOf(hour); if (hi < 0) { H.t.push(hour); hi = H.t.length - 1; for (const k in H.i) H.i[k].push(null); }
    let di = D.t.indexOf(day);  if (di < 0) { D.t.push(day);  di = D.t.length - 1; for (const k in D.i) D.i[k].push(null); }
    for (const [id, v] of Object.entries(h.items)) {
      if (+id % SHARDS !== s) continue;
      (H.i[id] ||= new Array(H.t.length).fill(null))[hi] = v[1];
      (D.i[id] ||= new Array(D.t.length).fill(null))[di] = [v[0], v[1], v[3]];
      // 7-Tage-Schnitt aus eigenem Verlauf, wenn die Quelle keinen liefert
      if (!v[2]) {
        const vals = D.i[id].slice(-7).filter(Boolean).map(x => x[1]);
        v[2] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : v[1];
      }
    }
    const cutH = Math.max(0, H.t.length - HOURS_KEEP), cutD = Math.max(0, D.t.length - DAYS_KEEP);
    if (cutH) { H.t = H.t.slice(cutH); for (const k in H.i) H.i[k] = H.i[k].slice(cutH); }
    if (cutD) { D.t = D.t.slice(cutD); for (const k in D.i) D.i[k] = D.i[k].slice(cutD); }
    for (const k in H.i) if (H.i[k].every(x => x == null)) delete H.i[k];
    for (const k in D.i) if (D.i[k].every(x => x == null)) delete D.i[k];
    writeJson(hf, H); writeJson(df, D);
  }
  latest[f] = h.items;
}
writeJson(path.join(OUT, 'latest.json'), latest);
log(`Preise gespeichert (Quelle: ${source}).`, latestOld?.scanned?.A === latest.scanned.A ? 'Kein neuer Scan.' : '');

// ForeverDB-Addon-Daten (GPL-3.0, „Data from ForeverDB.net“): Rezepte-Datei für die Forever-Fertigkeitswerte, täglich prüfen
{
  const dir = path.join(OUT, 'fdb'), mf = path.join(dir, 'Recipes.lua');
  let age = Infinity; try { age = Date.now() - fs.statSync(mf).mtimeMs; } catch {}
  if (age > 864e5) {
    try {
      const m = await (await fetch('https://foreverdb.net/downloads/addon-manifest.json')).json();
      writeJson(path.join(dir, 'manifest.json'), m);
      const f = (m.data?.files || []).find(x => /Recipes\.lua$/.test(x.path));
      if (!f) throw new Error('Recipes.lua nicht im Manifest');
      const r = await fetch(new URL(f.url, 'https://foreverdb.net/').href);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(mf, Buffer.from(await r.arrayBuffer()));
      log('ForeverDB Recipes.lua geladen:', fs.statSync(mf).size, 'Bytes');
    } catch (e) { log('ForeverDB-Rezepte nicht geladen:', e.message); }
  }
}

// ---------- Rezepte aller Berufe (wöchentlich) ----------
// recipes.json: { updated, profs: { id: name }, items: { id: name }, list: [[rezeptId, berufId, kategorie, ausItem, menge, [[item, anzahl], …], fertigkeit|null]] }
const RECIPE_MAX_AGE = 7 * 864e5;
const CLASSIC = readJson(new URL('./classic.json', import.meta.url), { skill: {}, vendor: {} });
async function buildRecipes() {
  const NS = 'static-forever-eu', L = '&locale=de_DE';
  const idx = await bz('/data/wow/profession/index', NS, L);
  if (!idx?.professions?.length) throw new Error('Berufe-Index leer');
  const profs = {}, refs = [];
  for (const p of idx.professions) {
    const pd = await bz(`/data/wow/profession/${p.id}`, NS, L);
    for (const t of pd?.skill_tiers || []) {
      const td = await bz(`/data/wow/profession/${p.id}/skill-tier/${t.id}`, NS, L);
      for (const c of td?.categories || []) for (const r of c.recipes || []) refs.push([r.id, p.id, c.name]);
    }
    profs[p.id] = p.name;
  }
  const list = [], items = {}; let err = 0;
  const work = async ([rid, pid, cat]) => {
    try {
      const r = await bz(`/data/wow/recipe/${rid}`, NS, L);
      const out = r?.crafted_item?.id; if (!out) return;   // Verzauberungen u. Ä. ohne Item
      items[out] = r.crafted_item.name;
      const mats = (r.reagents || []).map(x => { items[x.reagent.id] = x.reagent.name; return [String(x.reagent.id), x.quantity]; });
      list.push([rid, pid, cat, String(out), r.crafted_quantity?.value || 1, mats, CLASSIC.skill[out] ?? null]);
    } catch (e) { if (++err <= 3) log('Rezept', rid, e.message); }
  };
  for (let i = 0; i < refs.length; i += 20) await Promise.all(refs.slice(i, i + 20).map(work));
  list.sort((a, b) => a[0] - b[0]);
  log(`Rezepte: ${list.length} mit Item (von ${refs.length}), ${Object.keys(profs).length} Berufe, ${err} Fehler`);
  if (list.length < 50) throw new Error('zu wenige Rezepte');
  return { updated: Date.now(), source: 'Blizzard-API', profs, items, vendor: CLASSIC.vendor, list };
}
let RECIPE_IDS = new Set();
if (token) {
  const file = path.join(OUT, 'recipes.json'), old = readJson(file, null);
  let rec = old;
  if (!old || Date.now() - old.updated > RECIPE_MAX_AGE || process.env.RECIPES_FORCE) {
    try { rec = await buildRecipes(); writeJson(file, rec); }
    catch (e) { log('Rezepte nicht aktualisiert:', e.message); }
  }
  // Forever-Fertigkeitswerte aus ForeverDB (fdb/Recipes.lua, ausgabe-Item → kleinste benötigte Fertigkeit)
  if (rec) {
    try {
      const lua = fs.readFileSync(path.join(OUT, 'fdb', 'Recipes.lua'), 'utf8');
      const sk = {}, re = /\{(\d+),"(?:[^"\\]|\\.)*",(\d+),\d+,\d+,\d+,(\d+),/g; let m;
      while ((m = re.exec(lua))) { const it = m[3], v = +m[2]; if (sk[it] == null || v < sk[it]) sk[it] = v; }
      let hit = 0;
      for (const r of rec.list) { if (sk[r[3]] != null) { r[6] = sk[r[3]]; r[7] = 'fdb'; hit++; } else r[7] = r[6] != null ? 'classic' : null; }
      rec.skillSource = 'ForeverDB'; writeJson(file, rec);
      log(`Fertigkeit aus ForeverDB: ${hit} von ${rec.list.length} Rezepten`);
    } catch (e) { log('ForeverDB-Fertigkeit nicht übernommen:', e.message); }
  }
  if (rec) for (const r of rec.list) { RECIPE_IDS.add(r[3]); for (const m of r[5]) RECIPE_IDS.add(m[0]); }
}
// ---------- Deutsche Namen und Icons (schrittweise) ----------
// names.json: { id: [name, qualität 0–5, iconUrl, klasse, unterklasse] }, miss.json: { id: zeitpunkt }
const QUAL = { POOR: 0, COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5, ARTIFACT: 5, HEIRLOOM: 5 };
if (token) {
  const names = readJson(path.join(OUT, 'names.json'), {}), miss = readJson(path.join(OUT, 'miss.json'), {});
  const ids = new Set(); for (const f of Object.keys(prices)) for (const id of Object.keys(prices[f].items)) ids.add(id);
  // Reihenfolge: Rezept-Items zuerst, dann nach Handelsvolumen (Auktionen über alle Fraktionen)
  const vol = {}; for (const f of Object.keys(prices)) for (const [id, r] of Object.entries(prices[f].items)) vol[id] = (vol[id] || 0) + (r[4] || 0);
  const prio = id => (RECIPE_IDS.has(id) ? 1e12 : 0) + (vol[id] || 0);
  const todo = [...ids].filter(id => !names[id] && !(miss[id] && Date.now() - miss[id] < RETRY_MISS_MS))
    .sort((a, b) => prio(b) - prio(a)).slice(0, NAME_BUDGET);
  let ok = 0, nf = 0, err = 0;
  const work = async (id) => {
    try {
      const it = await bz(`/data/wow/item/${id}`, 'static-forever-eu', '&locale=de_DE');
      if (!it || !it.name) { miss[id] = Date.now(); nf++; return; }
      let icon = '';
      const md = await bz(`/data/wow/media/item/${id}`, 'static-forever-eu').catch(() => null);
      icon = md?.assets?.find(a => a.key === 'icon')?.value || '';
      names[id] = [it.name, QUAL[it.quality?.type] ?? 1, icon, it.item_class?.id ?? -1, it.item_subclass?.id ?? -1];
      delete miss[id]; ok++;
    } catch (e) { err++; if (err <= 3) log('Item', id, e.message); }
  };
  for (let i = 0; i < todo.length; i += 20) await Promise.all(todo.slice(i, i + 20).map(work));
  writeJson(path.join(OUT, 'names.json'), names); writeJson(path.join(OUT, 'miss.json'), miss);
  log(`Namen: ${ok} neu, ${nf} nicht gefunden, ${err} Fehler · gesamt ${Object.keys(names).length} von ${ids.size}`);
} else {
  log('Keine Blizzard-Zugangsdaten: Namen/Icons übersprungen.');
}
