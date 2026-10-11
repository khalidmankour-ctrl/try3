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
    /* Totaux bruts, gardés pour le calcul des indices par 90 minutes. */
    _raw: {
      keyPasses:     sum(s => s.passes?.key),
      dribbles:      sum(s => s.dribbles?.success),
      tackles:       sum(s => s.tackles?.total),
      interceptions: sum(s => s.tackles?.interceptions)
    },
    saves:        sum(s => s.goals?.saves)    || null,
    goalsAgainst: sum(s => s.goals?.conceded) || null
  };
}

/* ------------------------------------------------- indices par 90 minutes */

/** Six axes, tous calculables depuis ce que renvoie API-Football. */
const RADAR_AXES = [
  { key: 'finition', label: 'Finition', per90: a => a.goals,            needsMin: true },
  { key: 'creation', label: 'Création', per90: a => a._raw.keyPasses,   needsMin: true },
  { key: 'passe',    label: 'Passe',    pct:   a => a.pass },
  { key: 'dribble',  label: 'Dribble',  per90: a => a._raw.dribbles,    needsMin: true },
  { key: 'defense',  label: 'Défense',  per90: a => a._raw.tackles + a._raw.interceptions, needsMin: true },
  { key: 'duels',    label: 'Duels',    pct:   a => a.duels }
];

/**
 * Convertit les statistiques brutes en indices 0–100.
 *
 * Méthode, volontairement simple et vérifiable : pour chaque axe on ramène la
 * valeur à 90 minutes, puis on classe le joueur parmi les autres joueurs
 * récupérés. L'indice est donc un RANG DANS CE GROUPE, pas une note absolue.
 *
 * Deux limites assumées : le classement mélange tous les postes, donc un
 * gardien ressort très bas en finition et en dribble ; et les joueurs ayant
 * très peu joué sont instables. Les deux sont documentés dans le README.
 */
function deriveRadar (byId) {
  const ids = Object.keys(byId).filter(id => (byId[id].min || 0) >= 180);
  if (ids.length < 4) return null;   // trop peu de monde pour un classement

  const radars = {};
  ids.forEach(id => (radars[id] = {}));

  for (const axis of RADAR_AXES) {
    const values = ids.map(id => {
      const a = byId[id];
      if (axis.pct) return Number(axis.pct(a)) || 0;
      return (Number(axis.per90(a)) || 0) / (a.min / 90);
    });

    const sorted = [...values].sort((x, y) => x - y);
    ids.forEach((id, i) => {
      const below = sorted.filter(v => v < values[i]).length;
      const pct = ids.length > 1 ? (below / (ids.length - 1)) * 100 : 50;
      /* Bornes 5–98 : un indice n'est jamais une vérité absolue. */
      radars[id][axis.key] = Math.round(Math.min(98, Math.max(5, pct)));
    });
  }
  return radars;
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

  const radars = deriveRadar(out);
  if (radars) {
    Object.entries(radars).forEach(([id, r]) => { out[id].radar = r; });
    console.log(`\nIndices par 90 min calculés pour ${Object.keys(radars).length} joueur(s).`);
  } else {
    console.log('\nPas assez de joueurs pour classer les indices : radar éditorial conservé.');
  }

  /* Les totaux bruts ne servaient qu'au calcul : inutile de les publier. */
  Object.values(out).forEach(p => delete p._raw);

  const payload = {
    source: 'API-Football (api-sports.io)',
    season: map.season,
    fetchedAt: new Date().toISOString(),
    /* Ce que ce fichier contient vraiment, pour que l'interface puisse
       étiqueter honnêtement ce qui est mesuré et ce qui ne l'est pas. */
    provides: ['club', 'league', 'apps', 'min', 'goals', 'assists', 'rating',
               'pass', 'duels', 'keyPasses', 'dribbles', 'tackles', 'saves', 'goalsAgainst'
              ].concat(radars ? ['radar'] : []),
    editorial: radars ? ['note', 'form'] : ['radar', 'note', 'form'],
    /* Axes du radar calculé, pour que l'interface affiche les bons libellés. */
    radarAxes: radars ? RADAR_AXES.map(a => ({ key: a.key, label: a.label })) : null,
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
