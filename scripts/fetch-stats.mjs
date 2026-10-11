#!/usr/bin/env node
/* ============================================================================
 * Récupère les statistiques de saison depuis API-Football et écrit
 * assets/data/players.json, que le site charge au démarrage.
 *
 * Usage :
 *   API_FOOTBALL_KEY=xxx node scripts/fetch-stats.mjs --discover
 *       Remplit les identifiants API dans scripts/players-map.json en
 *       cherchant chaque joueur par son nom. À vérifier à la main ensuite.
 *
 *   API_FOOTBALL_KEY=xxx node scripts/fetch-stats.mjs
 *       Récupère les stats et écrit assets/data/players.json.
 *
 * Quota du palier gratuit : 100 requêtes/jour, 10/minute. Le script attend
 * donc 7 secondes entre deux appels et s'arrête net si le quota est atteint.
 *
 * La clé n'est jamais écrite dans un fichier ni affichée dans les journaux.
 * ==========================================================================*/

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = resolve(ROOT, 'scripts/players-map.json');
const OUT_FILE = resolve(ROOT, 'assets/data/players.json');

const BASE  = 'https://v3.football.api-sports.io';
const KEY   = process.env.API_FOOTBALL_KEY;
const DELAY = 7000;                       // 7 s → sous la limite de 10 req/min
const DISCOVER = process.argv.includes('--discover');

if (!KEY) {
  console.error('Erreur : la variable API_FOOTBALL_KEY n\'est pas définie.');
  console.error('Sur le serveur, elle vient de /etc/atlas-performance.env.');
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

let callCount = 0;

/** Un appel à l'API, avec contrôle des erreurs applicatives (HTTP 200 + errors). */
async function api (path) {
  callCount++;
  const res = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': KEY } });

  if (res.status === 429) throw new Error('QUOTA : limite de requêtes atteinte.');
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${path}`);

  const body = await res.json();

  /* L'API renvoie ses erreurs dans un champ `errors` avec un HTTP 200. */
  const errs = body.errors;
  const hasErrors = Array.isArray(errs) ? errs.length > 0 : errs && Object.keys(errs).length > 0;
  if (hasErrors) {
    const msg = JSON.stringify(errs);
    if (/limit|quota|plan/i.test(msg)) throw new Error(`QUOTA : ${msg}`);
    throw new Error(`API : ${msg}`);
  }
  return body.response || [];
}

/* ------------------------------------------------- recherche des identifiants */
async function discover (map) {
  let found = 0;
  for (const p of map.players) {
    if (p.apiId) continue;
    const lastName = p.name.split(' ').slice(-1)[0];
    try {
      const hits = await api(`/players/profiles?search=${encodeURIComponent(lastName)}`);
      /* On ne retient que les Marocains pour limiter les homonymes. */
      const moroccan = hits.filter(h => h.player?.nationality === 'Morocco');
      const pool = moroccan.length ? moroccan : hits;
      const best = pool[0];
      if (best) {
        p.apiId = best.player.id;
        p.apiName = `${best.player.firstname || ''} ${best.player.lastname || ''}`.trim();
        p.verified = false;    // à confirmer à la main
        found++;
        console.log(`  ${p.name.padEnd(26)} → ${p.apiId}  (${p.apiName})`);
      } else {
        console.log(`  ${p.name.padEnd(26)} → introuvable`);
      }
    } catch (e) {
      console.error(`  ${p.name} : ${e.message}`);
      if (/QUOTA/.test(e.message)) break;
    }
    await sleep(DELAY);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 2) + '\n');
  console.log(`\n${found} identifiant(s) trouvé(s), écrits dans scripts/players-map.json.`);
  console.log('VÉRIFIEZ-LES : la recherche par nom de famille peut se tromper d\'homonyme.');
  console.log('Passez verified à true une fois contrôlé.');
}

/* ------------------------------------------------------- agrégation des stats */
function aggregate (entries) {
  /* Un joueur a une ligne de stats par compétition. On cumule les compétitions
     de club et on garde le club/championnat de la ligne la plus jouée. */
  const club = entries.filter(s => s.team?.national !== true);
  if (!club.length) return null;

  const main = club.reduce((a, b) => ((b.games?.minutes || 0) > (a.games?.minutes || 0) ? b : a));
  const sum = k => club.reduce((t, s) => t + (k(s) || 0), 0);

  const apps = sum(s => s.games?.appearences);
  const min  = sum(s => s.games?.minutes);

  /* Note : moyenne pondérée par les minutes jouées. */
  let ratingNum = 0, ratingDen = 0;
  club.forEach(s => {
    const r = parseFloat(s.games?.rating);
    const m = s.games?.minutes || 0;
    if (isFinite(r) && m > 0) { ratingNum += r * m; ratingDen += m; }
  });

  const duelsTotal = sum(s => s.duels?.total);
  const duelsWon   = sum(s => s.duels?.won);

  return {
    club:   main.team?.name   || null,
    league: main.league?.name || null,
    apps, min,
    goals:   sum(s => s.goals?.total),
    assists: sum(s => s.goals?.assists),
    rating:  ratingDen ? +(ratingNum / ratingDen).toFixed(2) : null,
    pass:    main.passes?.accuracy != null ? Math.min(100, Number(main.passes.accuracy)) : null,
    duels:   duelsTotal ? Math.round((duelsWon / duelsTotal) * 100) : null,
    keyPasses: apps ? +(sum(s => s.passes?.key)       / apps).toFixed(1) : null,
    dribbles:  apps ? +(sum(s => s.dribbles?.success) / apps).toFixed(1) : null,
    tackles:   apps ? +(sum(s => s.tackles?.total)    / apps).toFixed(1) : null,
    saves:        sum(s => s.goals?.saves)    || null,
    goalsAgainst: sum(s => s.goals?.conceded) || null
  };
}

async function fetchStats (map) {
  const out = {};
  const skipped = [];

  for (const p of map.players) {
    if (!p.apiId) { skipped.push(`${p.name} (pas d'identifiant API)`); continue; }
    try {
      const res = await api(`/players?id=${p.apiId}&season=${map.season}`);
      const stats = res[0]?.statistics;
      if (!stats?.length) { skipped.push(`${p.name} (aucune stat pour ${map.season})`); }
      else {
        const agg = aggregate(stats);
        if (agg) { out[p.id] = agg; console.log(`  ${p.name.padEnd(26)} ${agg.apps} m, ${agg.goals} b, ${agg.assists} pd`); }
        else skipped.push(`${p.name} (aucune ligne de club)`);
      }
    } catch (e) {
      console.error(`  ${p.name} : ${e.message}`);
      if (/QUOTA/.test(e.message)) { skipped.push('— arrêt : quota atteint —'); break; }
      skipped.push(`${p.name} (${e.message})`);
    }
    await sleep(DELAY);
  }

  const payload = {
    source: 'API-Football (api-sports.io)',
    season: map.season,
    fetchedAt: new Date().toISOString(),
    /* Ce que ce fichier contient vraiment, pour que l'interface puisse
       étiqueter honnêtement ce qui est mesuré et ce qui ne l'est pas. */
    provides: ['club', 'league', 'apps', 'min', 'goals', 'assists', 'rating',
               'pass', 'duels', 'keyPasses', 'dribbles', 'tackles', 'saves', 'goalsAgainst'],
    editorial: ['radar', 'note', 'form'],
    players: out
  };

  await mkdir(dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2) + '\n');

  console.log(`\n${Object.keys(out).length} joueur(s) écrits dans assets/data/players.json`);
  if (skipped.length) console.log(`Ignorés :\n  - ${skipped.join('\n  - ')}`);
  console.log(`${callCount} requête(s) consommée(s) sur le quota du jour.`);
}

/* ---------------------------------------------------------------------- main */
const map = JSON.parse(await readFile(MAP_FILE, 'utf8'));
console.log(DISCOVER ? 'Recherche des identifiants API…\n' : `Récupération des stats, saison ${map.season}…\n`);
await (DISCOVER ? discover(map) : fetchStats(map));
