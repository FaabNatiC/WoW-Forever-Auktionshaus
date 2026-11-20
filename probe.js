// Einmaliger Test: Woher bekommen wir alle Forever-Rezepte?
// Prüft Blizzard-Berufe/Rezepte (static-forever-eu) und ForeverDB. Ergebnis: <ausgabe>/probe.json
// Aufruf: node probe.js <ausgabe-ordner>
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'out';
const ID = process.env.BLIZZARD_CLIENT_ID, SECRET = process.env.BLIZZARD_CLIENT_SECRET;
const API = 'https://eu.api.blizzard.com';
const res = { zeit: new Date().toISOString(), blizzard: [], foreverdb: [] };
const cut = (s, n = 1500) => (s.length > n ? s.slice(0, n) + ' …' : s);

async function token() {
  if (!ID || !SECRET) return null;
  const r = await fetch('https://oauth.battle.net/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(ID + ':' + SECRET).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  return r.ok ? (await r.json()).access_token : null;
}
async function get(url, headers = {}) {
  try {
    const r = await fetch(url, { headers });
    const t = await r.text();
    return { status: r.status, len: t.length, text: t };
  } catch (e) { return { status: 0, len: 0, text: String(e) }; }
}
const keysOf = t => { try { return Object.keys(JSON.parse(t)); } catch { return null; } };

const tk = await token();
res.token = !!tk;
if (tk) {
  const H = { Authorization: 'Bearer ' + tk };
  const tries = [];
  for (const ns of ['static-forever-eu', 'static-classic-eu', 'static-classic1x-eu']) {
    tries.push(['/data/wow/profession/index', ns]);
    tries.push(['/data/wow/recipe/1', ns]);
  }
  tries.push(['/data/wow/item/14048', 'static-forever-eu']);   // Runenstoffballen
  tries.push(['/data/wow/item/1710', 'static-forever-eu']);    // Großer Heiltrank
  tries.push(['/data/wow/spell/18401', 'static-forever-eu']);  // Zauber „Runenstoffballen“
  tries.push(['/data/wow/search/item', 'static-forever-eu', '&name.de_DE=Runenstoff&_pageSize=5']);
  for (const [p, ns, extra = ''] of tries) {
    const r = await get(`${API}${p}?namespace=${ns}&locale=de_DE${extra}`, H);
    res.blizzard.push({ pfad: p, ns, status: r.status, schluessel: keysOf(r.text), auszug: cut(r.text) });
  }
  // Wenn der Berufe-Index geht: einen Beruf, eine Stufe und ein Rezept tiefer
  const idx = res.blizzard.find(x => x.pfad === '/data/wow/profession/index' && x.status === 200);
  if (idx) {
    const full = JSON.parse((await get(`${API}/data/wow/profession/index?namespace=${idx.ns}&locale=de_DE`, H)).text);
    const prof = full.professions?.[0];
    if (prof) {
      const pr = await get(`${API}/data/wow/profession/${prof.id}?namespace=${idx.ns}&locale=de_DE`, H);
      res.blizzard.push({ pfad: '/data/wow/profession/' + prof.id, ns: idx.ns, status: pr.status, auszug: cut(pr.text, 3000) });
      try {
        const tier = JSON.parse(pr.text).skill_tiers?.[0];
        if (tier) {
          const tr = await get(`${API}/data/wow/profession/${prof.id}/skill-tier/${tier.id}?namespace=${idx.ns}&locale=de_DE`, H);
          res.blizzard.push({ pfad: `/data/wow/profession/${prof.id}/skill-tier/${tier.id}`, ns: idx.ns, status: tr.status, auszug: cut(tr.text, 3000) });
          const rid = JSON.parse(tr.text).categories?.[0]?.recipes?.[0]?.id;
          if (rid) {
            const rr = await get(`${API}/data/wow/recipe/${rid}?namespace=${idx.ns}&locale=de_DE`, H);
            res.blizzard.push({ pfad: '/data/wow/recipe/' + rid, ns: idx.ns, status: rr.status, auszug: cut(rr.text, 3000) });
          }
        }
      } catch (e) { res.blizzard.push({ fehler: String(e) }); }
    }
  }
}

// ForeverDB: Berufsseite und mögliche Datenquellen
for (const u of ['https://foreverdb.net/profession/tailoring', 'https://foreverdb.net/profession/tailoring?p=2', 'https://foreverdb.net/robots.txt']) {
  const r = await get(u, { 'User-Agent': 'Forever-AH (github.com/FaabNatiC/WoW-Forever-Auktionshaus)' });
  const links = [...new Set((r.text.match(/(?:href|src)="([^"]+)"/g) || []).map(s => s.slice(s.indexOf('"') + 1, -1)))].slice(0, 80);
  const api = [...new Set(r.text.match(/["'](\/api\/[^"']+|[^"']+\.json)["']/g) || [])].slice(0, 20);
  res.foreverdb.push({ url: u, status: r.status, len: r.len, links, api, anfang: cut(r.text, 4000) });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(res, null, 1));
console.log('Token:', res.token);
for (const b of res.blizzard) console.log('Blizzard', b.status, b.ns || '', b.pfad || b.fehler);
for (const f of res.foreverdb) console.log('ForeverDB', f.status, f.len, f.url);
