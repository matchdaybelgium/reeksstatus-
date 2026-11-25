// Reeksstats: haalt nieuwe wedstrijdbladen op bij RBFA en schrijft data.js.
// Gebruik: node update.mjs   (Node 18 of nieuwer). Oude matchen worden onthouden in cache/matches.json.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Collector = require('./collector.js');
const CACHE = 'cache/matches.json';

const label = Collector.season()[2];
let cache = { season: label, m: {} };
try {
  const old = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  if (old.season === label && old.m) cache = old;
} catch (e) { /* eerste keer: alles ophalen */ }
const save = () => { fs.mkdirSync('cache', { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(cache)); };
console.log(`Seizoen ${label}: ${Object.keys(cache.m).length} matchen al bekend`);

const t0 = Date.now();
let lastLog = 0;
try {
  const r = await Collector.collectAll({
    concurrency: 4,
    cache: { get: id => cache.m[id], set: (id, v) => { cache.m[id] = v; } },
    progress: i => {
      if (i.phase === 'wedstrijdbladen' && i.matchesDone % 1000 === 0) save(); // tussentijds bewaren
      if (Date.now() - lastLog < 30000 && i.phase !== 'klaar') return;
      lastLog = Date.now();
      console.log(`[${Math.round((Date.now() - t0) / 60000)} min] ${i.phase}: reeksen ${i.seriesDone}/${i.series}, matchen ${i.matchesDone}/${i.matches} (${i.cached || 0} uit geheugen, ${i.failed} mislukt)`);
    }
  });
  const data = Collector.build(r.series, r.matchesBySeries, { season: r.season });
  fs.writeFileSync('data.js', 'window.REEKS_DATA = ' + JSON.stringify(data) + ';\n');
  console.log(`Klaar: ${data.totals.matches} matchen, ${data.totals.goals} goals, ${r.failed} mislukt.`);
  if (r.failed > 50) process.exitCode = 1;
} finally {
  save();
}
