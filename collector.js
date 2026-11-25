// Reeksstats verzamelaar: haalt alle wedstrijdbladen van 1e Afdeling/D1 tot 4e Provinciaal op
// en berekent de België-overzichten. Werkt in een browser (update.html) en in Node 18+ (update.mjs).
var Collector = (function () {
  const API = 'https://www.rbfa.be/graphql';
  const H = {
    cal: 'bf4ec6f8c53154da0406f98cd9d3562bfb856eee3db4345b589bf2c2a8ca9da9',
    md: 'e4194e20528d04a046bd71ea20a044dbd445144b1104f5e6f5992cfdcf43a793',
    search: 'ab24521d815f3fb7949955fbe2fbf29af563e12d761eb1f0f66a187cff539d53'
  };
  const PROV_VV = { Antw: 'Antwerpen', 'Vl Brab': 'Vlaams-Brabant', Limb: 'Limburg', Ovl: 'Oost-Vlaanderen', Wvl: 'West-Vlaanderen' };
  const PROV_FFA = { Hainaut: 'Henegouwen', Liege: 'Luik', Namur: 'Namen', Luxembourg: 'Luxemburg', 'Brabant Wallon/Bruxelles': 'Waals-Brabant/Brussel' };

  // RBFA laat 200 verzoeken per minuut toe: we houden ~175/min aan en wachten bij een blokkade.
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const GAP = 345;
  let nextSlot = 0, pauseUntil = 0;
  async function slot() {
    for (;;) {
      const now = Date.now();
      if (now < pauseUntil) { await sleep(pauseUntil - now); continue; }
      const t = Math.max(now, nextSlot);
      nextSlot = t + GAP;
      if (t > now) await sleep(t - now);
      return;
    }
  }
  async function gql(op, vars, hash) {
    let other = 0;
    for (let attempt = 0; attempt < 12; attempt++) {
      await slot();
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ operationName: op, variables: vars, extensions: { persistedQuery: { version: 1, sha256Hash: hash } } }) });
        const rl = r.headers && r.headers.get && r.headers.get('ratelimit');
        const m = rl && rl.match(/remaining=(\d+).*reset=(\d+)/);
        if (m && +m[1] < 4) pauseUntil = Math.max(pauseUntil, Date.now() + (+m[2] + 1) * 1000);
        if (r.status === 429) throw Object.assign(new Error('Too many requests'), { limited: true });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j.errors && !j.data) {
          const msg = j.errors[0].message || 'GraphQL-fout';
          throw Object.assign(new Error(msg), { limited: /too many/i.test(msg) });
        }
        return j.data;
      } catch (e) {
        if (e.limited) { pauseUntil = Math.max(pauseUntil, Date.now() + 20000); continue; }
        if (++other >= 3) throw e;
        await sleep(2000 * other);
      }
    }
    throw new Error('RBFA blijft verzoeken blokkeren');
  }
  function season(now) {
    const d = now || new Date(), y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return [y + '/07/01', (y + 1) + '/06/30', y + '-' + (y + 1)];
  }
  function classify(id, sn) {
    if (!/^CHP_/.test(id) || !/^Voetbal\s*:/.test(sn)) return null;
    const full = sn.replace(/^Voetbal\s*:\s*/, ''), i = full.indexOf(' - ');
    if (i < 0) return null;
    const reg = full.slice(0, i).trim(), rest = full.slice(i + 3).trim();
    let m;
    if (reg === 'Voetbal Vlaanderen' && (m = rest.match(/^(\d)(?:e|de|ste) Afdeling Voetb Vl(?: ([A-Z]))?$/)))
      return { id, lvl: +m[1], grp: 'Voetbal Vlaanderen', name: m[1] + 'e Afdeling' + (m[2] ? ' ' + m[2] : '') };
    if (reg === 'FFA' && (m = rest.match(/^D([123]) FFA(?: série ([A-Z]))?$/i)))
      return { id, lvl: +m[1], grp: 'FFA (Wallonië)', name: 'D' + m[1] + (m[2] ? ' ' + m[2] : '') };
    if (reg === 'Voetbal Vlaanderen' && (m = rest.match(/^([1-4]) Provinciaal (Antw|Vl Brab|Limb|Ovl|Wvl)(?: ([A-Z]))?$/)))
      return { id, lvl: 3 + +m[1], grp: PROV_VV[m[2]], name: m[1] + 'e Prov. ' + PROV_VV[m[2]] + (m[3] ? ' ' + m[3] : '') };
    if (PROV_FFA[reg] && (m = rest.match(/^([1-4])\s*PROV(?:\.|INCIALE)?\s*([A-Z])?\.?$/i)))
      return { id, lvl: 3 + +m[1], grp: PROV_FFA[reg], name: m[1] + 'e Prov. ' + PROV_FFA[reg] + (m[2] ? ' ' + m[2].toUpperCase() : '') };
    return null;
  }
  async function discoverSeries() {
    const page = (q, off) => gql('DoSearch', { first: 100, offset: off, filter: { query: q, type: 'competition' }, language: 'nl', channel: 'belgianfootball', location: 'BE' }, H.search).then(d => d.search || {});
    const all = async q => {
      const f = await page(q, 0), tot = (f.pageInfo && f.pageInfo.total) || 0, rest = [];
      for (let o = 100; o < tot && o < 1000; o += 100) rest.push(page(q, o));
      return [f, ...(await Promise.all(rest))].flatMap(s => s.results || []);
    };
    const qs = ['Afdeling', 'D1', 'D2', 'D3', 'Provinciaal', 'Prov', 'Hainaut', 'Liege', 'Namur', 'Luxembourg', 'Brabant Wallon'];
    const seen = new Map();
    (await Promise.all(qs.map(q => all(q).catch(() => [])))).flat().forEach(r => seen.set(r.id, r.seriesName));
    return [...seen].map(([id, sn]) => classify(id, sn)).filter(Boolean)
      .sort((a, b) => a.lvl - b.lvl || a.grp.localeCompare(b.grp) || a.name.localeCompare(b.name));
  }
  function compact(m) {
    const p = [];
    const add = (rows, starter) => (rows || []).forEach(pr => ['home', 'away'].forEach(side => {
      const x = pr && pr[side]; if (!x) return;
      const team = side === 'home' ? m.homeTeam : m.awayTeam;
      p.push({ t: String(team.id), n: ((x.firstName || '') + ' ' + (x.lastName || '')).trim(), s: starter ? 1 : 0,
        e: (x.events || []).map(e => [e.type, e.minute]) });
    }));
    add(m.lineup, true); add(m.substitutes, false);
    const o = m.outcome || {};
    return { id: m.id, d: m.startTime, h: [String(m.homeTeam.id), m.homeTeam.name], a: [String(m.awayTeam.id), m.awayTeam.name],
      sc: [o.homeTeamGoals, o.awayTeamGoals], p };
  }
  function minutes(pl) {
    let start = pl.s ? 0 : null, end = 90;
    for (const [t, mi] of pl.e) {
      const m = Math.min(Math.max(+mi || 0, 0), 90);
      if (t === 'in') start = m;
      if (t === 'out' || t === 'red' || t === 'yellowred') end = Math.min(end, m);
    }
    if (start === null) return null;
    return Math.max(end - start, 1);
  }
  const goalsOf = pl => pl.e.reduce((s, [t]) => s + (t === 'goal' || t === 'penalty' ? 1 : 0), 0);
  const pensOf = pl => pl.e.reduce((s, [t]) => s + (t === 'penalty' ? 1 : 0), 0);
  function monday(dateStr) {
    const [y, mo, d] = dateStr.slice(0, 10).split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d)), wd = (dt.getUTCDay() + 6) % 7;
    dt.setUTCDate(dt.getUTCDate() - wd);
    return dt.toISOString().slice(0, 10);
  }

  // Alle reeksen ophalen. progress(info) wordt regelmatig opgeroepen.
  async function collectAll(opts) {
    opts = opts || {};
    const conc = opts.concurrency || 4, progress = opts.progress || (() => {});
    const cache = opts.cache || null; // optioneel: { get(id) -> compact|undefined, set(id, compact) } (async mag)
    const [from, to, label] = season(opts.now);
    const series = opts.series || await discoverSeries();
    const st = { series: series.length, seriesDone: 0, matches: 0, matchesDone: 0, failed: 0 };
    progress(Object.assign({ phase: 'kalenders' }, st));
    const cals = [];
    for (let i = 0; i < series.length; i += conc) {
      const part = await Promise.all(series.slice(i, i + conc).map(s =>
        gql('GetSeriesCalendar', { seriesId: s.id, startDate: from, endDate: to, language: 'nl' }, H.cal)
          .then(d => (d.seriesCalendar || []).filter(m => m.state === 'finished')).catch(() => { st.failed++; return []; })));
      cals.push(...part);
      st.seriesDone = cals.length; progress(Object.assign({ phase: 'kalenders' }, st));
    }
    const jobs = [];
    cals.forEach((list, si) => list.forEach(m => jobs.push({ si, id: m.id })));
    st.matches = jobs.length;
    const out = series.map(() => []);
    let next = 0;
    async function worker() {
      while (next < jobs.length) {
        const j = jobs[next++];
        try {
          const hit = cache && await cache.get(j.id);
          if (hit) { out[j.si].push(hit); st.cached = (st.cached || 0) + 1; }
          else {
            const d = (await gql('GetMatchDetail', { matchId: j.id, language: 'nl' }, H.md)).matchDetail;
            if (d) { const c = compact(d); out[j.si].push(c); if (cache) await cache.set(j.id, c); }
          }
        } catch (e) { st.failed++; }
        st.matchesDone++;
        if (st.matchesDone % 50 === 0) progress(Object.assign({ phase: 'wedstrijdbladen' }, st));
      }
    }
    await Promise.all(Array.from({ length: conc }, worker));
    progress(Object.assign({ phase: 'klaar' }, st));
    return { series, matchesBySeries: out, season: label, failed: st.failed };
  }

  // België-overzichten berekenen
  // Top 3 per periode (week of maand) binnen één reeks: gedeelde plaats bij evenveel goals.
  function podium(map, periods, cap) {
    const keys = [...map.keys()].sort().reverse();
    return (periods ? keys.slice(0, periods) : keys).map(k => {
      const list = [...map.get(k).values()].sort((a, b) => b.g - a.g || a.n.localeCompare(b.n));
      const keep = list.filter(r => 1 + list.filter(x => x.g > r.g).length <= 3);
      const shown = keep.slice(0, cap || 5);
      return [k, shown.map(r => [r.n, r.t, r.tn, r.g]), keep.length - shown.length];
    });
  }
  function build(series, matchesBySeries, meta, opt) {
    opt = opt || {};
    const P = new Map(), perfs = [];
    const RW = series.map(() => new Map()), RM = series.map(() => new Map());
    let nMatches = 0, nGoals = 0;
    const add = (map, key, pk, base, g) => {
      if (!map.has(key)) map.set(key, new Map());
      const m = map.get(key);
      const r = m.get(pk) || Object.assign({ g: 0, mp: 0 }, base);
      r.g += g; r.mp++; m.set(pk, r);
    };
    matchesBySeries.forEach((list, si) => {
      const lvl = series[si].lvl;
      for (const m of list) {
        nMatches++;
        const tn = { [m.h[0]]: m.h[1], [m.a[0]]: m.a[1] };
        for (const pl of m.p) {
          if (!pl.n) continue;
          const pk = pl.t + '|' + pl.n.toLowerCase();
          let r = P.get(pk);
          if (!r) { r = { n: pl.n, t: pl.t, tn: tn[pl.t], s: si, lvl, g: 0, pen: 0, mp: 0, min: 0, hat: 0 }; P.set(pk, r); }
          const mins = minutes(pl), g = goalsOf(pl);
          if (mins !== null) { r.mp++; r.min += mins; }
          if (!g) continue;
          nGoals += g;
          r.g += g; r.pen += pensOf(pl); if (g >= 3) r.hat++;
          const home = pl.t === m.h[0];
          perfs.push({ n: pl.n, t: pl.t, tn: tn[pl.t], s: si, lvl, d: m.d.slice(0, 10), opp: home ? m.a[1] : m.h[1], home: home ? 1 : 0,
            gf: home ? m.sc[0] : m.sc[1], ga: home ? m.sc[1] : m.sc[0], g });
          const base = { n: pl.n, t: pl.t, tn: tn[pl.t], s: si, lvl };
          add(RW[si], monday(m.d), pk, base, g);
          add(RM[si], m.d.slice(0, 7), pk, base, g);
        }
      }
    });
    const byBest = (a, b) => b.g - a.g || a.lvl - b.lvl || (a.min || 0) - (b.min || 0) || a.n.localeCompare(b.n);
    const all = [...P.values()].filter(p => p.g > 0).sort(byBest);
    const keep = new Set(all.slice(0, opt.top || 300));
    for (let l = 1; l <= 7; l++) all.filter(p => p.lvl === l).slice(0, opt.perLevel || 15).forEach(p => keep.add(p));
    const top = [...keep].sort(byBest).map(p => [p.n, p.t, p.tn, p.s, p.g, p.pen, p.mp, p.min, p.hat]);
    const hattricks = perfs.filter(x => x.g >= 3).length;
    const single = perfs.sort((a, b) => b.g - a.g || a.lvl - b.lvl || b.d.localeCompare(a.d)).slice(0, opt.single || 50)
      .map(x => [x.n, x.t, x.tn, x.s, x.d, x.opp, x.home, x.gf, x.ga, x.g]);
    // Speler van de week / maand per reeks (top 3). periods = 0: hele seizoen.
    const rw = RW.map(m => podium(m, opt.periods || 0, opt.cap)), rm = RM.map(m => podium(m, opt.periods || 0, opt.cap));
    return {
      v: 2, generated: (meta && meta.generated) || new Date().toISOString(), season: meta && meta.season,
      totals: { series: series.length, matches: nMatches, goals: nGoals, scorers: all.length, hattricks },
      series: series.map(s => [s.id, s.name, s.lvl, s.grp]),
      top, single, rw, rm
    };
  }

  return { gql, season, classify, discoverSeries, compact, minutes, monday, collectAll, build };
})();
if (typeof module !== 'undefined') module.exports = Collector;
