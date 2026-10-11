/* ============================================================================
 * ATLAS PERFORMANCE — logique applicative
 * ==========================================================================*/
import { PLAYERS, BY_ID, FORMATION, RADAR_AXES, POSITIONS, META, DATA_SOURCE,
         applyLiveData, clubColors, initials } from './data.js';
import { createHeroScene }  from './three/hero.js';
import { createPitchScene } from './three/pitch.js';
import { createRadarScene } from './three/radar.js';
import { renderJournal, playJournal } from './journal.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Axes du radar effectivement affichés : calculés si on a les vraies
    données, éditoriaux sinon. */
const axes = () => DATA_SOURCE.radarAxes || RADAR_AXES;

const state = {
  view: 'overview',
  unit: 'match',            // 'match' | 'p90'
  period: 'week',           // fenêtre de matchs prise en compte pour la forme
  watchTier: 'international',
  watchSort: { key: 'name', dir: 1 },
  gridTier: 'all',
  cmp: ['hakimi', 'brahim']
};

/* ==========================================================================
   1. Fabriques visuelles (avatars, sparklines, barres)
   ========================================================================== */

/** Avatar généré : dégradé aux couleurs du club + initiales. Aucune photo. */
function avatar (p, size = 'md') {
  const [c1, c2] = clubColors(p.club);
  const id = `g-${p.id}-${size}-${Math.random().toString(36).slice(2, 7)}`;
  return `
    <span class="avatar avatar--${size}" aria-hidden="true">
      <svg class="avatar__bg" viewBox="0 0 100 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <rect width="100" height="120" fill="url(#${id})"/>
        <path d="M0 120 L100 60 L100 120 Z" fill="rgba(0,0,0,.28)"/>
        <circle cx="78" cy="22" r="26" fill="rgba(255,255,255,.08)"/>
      </svg>
      <span class="avatar__ini">${initials(p.name)}</span>
      <span class="avatar__num">${p.number}</span>
    </span>`;
}

/** Sparkline animée des 5 derniers matchs. */
function sparkline (form, w = 150, h = 34) {
  const min = Math.min(...form) - 0.25;
  const max = Math.max(...form) + 0.25;
  const px = i => (i / (form.length - 1)) * (w - 6) + 3;
  const py = v => h - 5 - ((v - min) / (max - min || 1)) * (h - 12);
  const pts = form.map((v, i) => [px(i), py(v)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`;
  const dots = pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" style="--i:${i}"/>`).join('');
  /* Longueur approx. pour l'animation de tracé */
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return `<svg class="spark is-anim" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="--len:${len.toFixed(0)}" aria-hidden="true">
    <path class="area" d="${area}"/><path class="line" d="${line}"/>${dots}</svg>`;
}

function trendBadge (t) {
  const up = t >= 0;
  return `<span class="trend trend--${up ? 'up' : 'down'}">${up ? '+' : ''}${t}%
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="${up ? 'M12 4l7 9h-4v7h-6v-7H5z' : 'M12 20l-7-9h4V4h6v7h4z'}"/></svg></span>`;
}

/* Définitions SVG globales (dégradé des sparklines) */
document.body.insertAdjacentHTML('beforeend',
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
     <linearGradient id="sparkgrad" x1="0" y1="0" x2="0" y2="1">
       <stop offset="0%" stop-color="#22c55e" stop-opacity=".55"/>
       <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
     </linearGradient></defs></svg>`);

/* ==========================================================================
   2. Statistiques — conversion selon l'unité choisie
   ========================================================================== */

/** Renvoie la valeur d'une stat cumulée dans l'unité active. */
function per (p, total) {
  if (state.unit === 'p90') return total / (p.s.min / 90 || 1);
  return total / (p.s.apps || 1);
}

/** Trois indicateurs clés dépendant du poste, comme sur les cartes vedettes. */
function keyStats (p) {
  const minutes = state.unit === 'p90' ? 90 : Math.round(p.s.min / p.s.apps);
  const base = [{ v: minutes, l: 'Minutes' }];
  switch (p.pos) {
    case 'GK':
      return base.concat(
        { v: fmt(per(p, p.s.saves ?? 0), 1), l: 'Arrêts' },
        { v: fmt(per(p, p.s.goalsAgainst ?? 0), 1), l: 'Buts encaissés' });
    case 'DEF':
      return base.concat(
        { v: fmt(per(p, p.s.assists), 1), l: 'Passes décisives' },
        { v: fmt(per(p, (p.s.keyPasses ?? 0) * p.s.apps), 1), l: 'Occasions créées' });
    case 'MID':
      return base.concat(
        { v: fmt(per(p, p.s.goals), 1), l: 'Buts' },
        { v: fmt(per(p, p.s.assists), 1), l: 'Passes décisives' });
    default:
      return base.concat(
        { v: fmt(per(p, p.s.goals), 1), l: 'Buts' },
        { v: fmt(per(p, (p.s.dribbles ?? 0) * p.s.apps), 1), l: 'Dribbles réussis' });
  }
}

/* Fenêtre d'observation : combien de matchs récents la « forme » couvre. */
const PERIOD = {
  week:   { n: 3, label: '3 derniers matchs' },
  month:  { n: 5, label: '5 derniers matchs' },
  season: { n: 5, label: 'Tendance de la saison' }
};
const formWin = p => p.form.slice(-PERIOD[state.period].n);

/** Progression sur la fenêtre choisie (la saison utilise la tendance fournie). */
function trendWin (p) {
  if (state.period === 'season') return p.trend;
  const f = formWin(p);
  if (f.length < 2 || !f[0]) return p.trend;
  return Math.round(((f[f.length - 1] - f[0]) / f[0]) * 100);
}

/** Score de classement des cartes vedettes selon la période. */
function periodScore (p) {
  if (state.period === 'season') return p.s.rating;
  const f = formWin(p);
  return f.reduce((a, b) => a + b, 0) / f.length;
}

/* ==========================================================================
   3. Navigation entre vues
   ========================================================================== */
function setView (name) {
  if (!$(`#view-${name}`)) return;
  state.view = name;
  $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${name}`));
  $$('.nav__btn').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });

  /* Met en pause les scènes hors écran pour économiser le GPU */
  scenes.hero  && (name === 'overview' ? scenes.hero.resume()  : scenes.hero.pause());
  scenes.pitch && (name === 'overview' ? scenes.pitch.resume() : scenes.pitch.pause());
  if (name === 'lions')   mountLionsPitch();
  if (name === 'compare') mountRadar();
  if (name === 'journal') { renderJournal(); playJournal(); }
  revealScan();
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-view]');
  if (!t) return;
  e.preventDefault();
  if (t.dataset.tier) {
    state.gridTier = t.dataset.tier;
    syncSegment($('#tierSeg2'), 'tier', t.dataset.tier);
    renderGrid();
  }
  setView(t.dataset.view);
});

/* ==========================================================================
   4. Contrôles segmentés
   ========================================================================== */
function moveThumb (seg) {
  const thumb = seg.querySelector('.segment__thumb');
  const active = seg.querySelector('.segment__btn.is-active');
  if (!thumb || !active) return;
  thumb.style.left  = `${active.offsetLeft}px`;
  thumb.style.width = `${active.offsetWidth}px`;
}
function syncSegment (seg, attr, value) {
  if (!seg) return;
  $$('.segment__btn', seg).forEach(b => b.classList.toggle('is-active', b.dataset[attr] === value));
  moveThumb(seg);
}
function initSegment (seg, attr, onPick) {
  if (!seg) return;
  $$('.segment__btn', seg).forEach(btn => btn.addEventListener('click', () => {
    syncSegment(seg, attr, btn.dataset[attr]);
    onPick(btn.dataset[attr]);
  }));
  requestAnimationFrame(() => moveThumb(seg));
}

/* ==========================================================================
   5. Cartes vedettes + filtres « Performances en club »
   ========================================================================== */
function filteredFeatured () {
  const pos = $('#fPos').value;
  const league = $('#fLeague').value;
  return PLAYERS
    .filter(p => p.tier === 'international')
    .filter(p => pos === 'all' || p.pos === pos)
    .filter(p => league === 'all' || p.league === league)
    .sort((a, b) => periodScore(b) - periodScore(a))
    .slice(0, 3);
}

function renderFeatured () {
  const host = $('#featured');
  const list = filteredFeatured();
  if (!list.length) {
    host.innerHTML = `<div class="empty" style="grid-column:1/-1;padding:40px 10px"><h3>Aucun joueur pour ces filtres</h3></div>`;
    return;
  }
  host.innerHTML = list.map(p => `
    <article class="pcard" data-player="${p.id}" tabindex="0">
      <div class="pcard__top">
        ${avatar(p, 'lg')}
        <div class="pcard__info">
          <h3 class="pcard__name">${p.name}</h3>
          <div class="pcard__role">${p.role}</div>
          <div class="pcard__club">${p.club}</div>
        </div>
      </div>
      <div class="pcard__stats">
        ${keyStats(p).map(s => `<div class="stat"><div class="stat__v" data-count="${s.v}">0</div><span class="stat__l">${s.l}</span></div>`).join('')}
      </div>
      <div class="pcard__foot">
        <span class="pcard__foot-l">${PERIOD[state.period].label}</span>
        ${sparkline(formWin(p))}
        ${trendBadge(trendWin(p))}
      </div>
    </article>`).join('');
  countUpIn(host);
  tiltCards(host);
}

/* Effet de relief au survol */
function tiltCards (root) {
  $$('.pcard', root).forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width;
      const my = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${mx * 100}%`);
      card.style.setProperty('--my', `${my * 100}%`);
      card.style.transform = `perspective(900px) rotateY(${(mx - .5) * 7}deg) rotateX(${(.5 - my) * 7}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => { card.style.transform = ''; });
  });
}

/* ==========================================================================
   6. Tableau « Joueurs à suivre »
   ========================================================================== */
const SORTERS = {
  name:   (a, b) => a.name.localeCompare(b.name, 'fr'),
  pos:    (a, b) => a.pos.localeCompare(b.pos),
  min:    (a, b) => a.s.min - b.s.min,
  goals:  (a, b) => (a.s.goals + a.s.assists) - (b.s.goals + b.s.assists)
};

function renderWatch () {
  const rows = PLAYERS
    .filter(p => p.tier === state.watchTier)
    .sort((a, b) => SORTERS[state.watchSort.key](a, b) * state.watchSort.dir)
    .slice(0, 8);

  $('#watchBody').innerHTML = rows.map((p, i) => `
    <tr data-player="${p.id}" class="table__rowin" style="animation-delay:${i * 45}ms">
      <td><span class="c-player">${avatar(p, 'sm')}<strong>${p.name}</strong></span></td>
      <td class="c-muted hide-sm">${p.role}</td>
      <td class="c-num">${state.unit === 'p90' ? 90 : Math.round(p.s.min / p.s.apps)}</td>
      <td class="c-num hide-sm">${p.s.goals} / ${p.s.assists}</td>
      <td class="c-form" style="width:190px">${sparkline(formWin(p), 170)}</td>
      <td style="text-align:right">${trendBadge(trendWin(p))}</td>
    </tr>`).join('');

  $$('#view-overview .table thead th.sortable').forEach(th => {
    const on = th.dataset.sort === state.watchSort.key;
    th.classList.toggle('is-sorted', on);
    th.classList.toggle('desc', on && state.watchSort.dir === -1);
  });
}

$$('#view-overview .table thead th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.dataset.sort;
    state.watchSort = (state.watchSort.key === k)
      ? { key: k, dir: -state.watchSort.dir }
      : { key: k, dir: k === 'name' || k === 'pos' ? 1 : -1 };
    renderWatch();
  });
});

/* ==========================================================================
   7. Grille « Joueurs »
   ========================================================================== */
const GRID_SORT = {
  rating:  (a, b) => b.s.rating - a.s.rating,
  goals:   (a, b) => b.s.goals - a.s.goals,
  assists: (a, b) => b.s.assists - a.s.assists,
  min:     (a, b) => b.s.min - a.s.min,
  trend:   (a, b) => b.trend - a.trend,
  age:     (a, b) => a.age - b.age,
  name:    (a, b) => a.name.localeCompare(b.name, 'fr')
};

function renderGrid () {
  const pos = $('#pPos').value, league = $('#pLeague').value, sort = $('#pSort').value;
  const list = PLAYERS
    .filter(p => state.gridTier === 'all' || p.tier === state.gridTier)
    .filter(p => pos === 'all' || p.pos === pos)
    .filter(p => league === 'all' || p.league === league)
    .sort(GRID_SORT[sort]);

  $('#pCount').textContent = list.length;
  $('#playerEmpty').hidden = list.length > 0;

  const topAxes = p => axes()
    .map(a => ({ ...a, v: p.radar[a.key] }))
    .sort((x, y) => y.v - x.v).slice(0, 3);

  $('#playerGrid').innerHTML = list.map(p => `
    <article class="gcard" data-player="${p.id}" tabindex="0">
      <div class="gcard__glow"></div>
      <span class="gcard__pos">${POSITIONS[p.pos].short}</span>
      <div class="gcard__body">
        <div class="gcard__row">
          ${avatar(p, 'md')}
          <div style="min-width:0">
            <h3 class="gcard__name">${p.name}</h3>
            <div class="gcard__meta">${p.role} · ${p.age} ans</div>
            <div class="gcard__club">${p.club}</div>
          </div>
        </div>
        <div class="gcard__bars">
          ${topAxes(p).map(a => `
            <div class="bar">
              <span class="bar__l">${a.label}</span>
              <span class="bar__t"><i class="bar__f" data-w="${a.v}"></i></span>
              <span class="bar__v">${a.v}</span>
            </div>`).join('')}
        </div>
        <div class="gcard__foot">
          <div class="gcard__kpi">
            <div><b>${p.s.goals}</b><span>Buts</span></div>
            <div><b>${p.s.assists}</b><span>P. déc.</span></div>
            <div><b>${p.s.rating.toFixed(2)}</b><span>Note</span></div>
          </div>
          <span style="margin-left:auto">${trendBadge(p.trend)}</span>
        </div>
      </div>
    </article>`).join('');

  /* Apparition en cascade + remplissage des barres */
  $$('#playerGrid .gcard').forEach((el, i) => {
    setTimeout(() => {
      el.classList.add('is-in');
      $$('.bar__f', el).forEach(b => { b.style.width = `${b.dataset.w}%`; });
    }, Math.min(i, 14) * 45);
  });
}

/* ==========================================================================
   8. Terrain 3D + liste de la sélection
   ========================================================================== */
const scenes = { hero: null, pitch: null, pitch2: null, radar: null, drawerRadar: null };

function slotsWithNames () {
  return FORMATION.slots
    .filter(s => BY_ID[s.id])
    .map(s => ({ ...s, name: BY_ID[s.id].name }));
}

function bindPitchTip (tipEl, canvasHost) {
  return hit => {
    if (!hit) { tipEl.classList.remove('is-on'); return; }
    const p = BY_ID[hit.id];
    if (!p) return;
    tipEl.innerHTML = `<b>${p.name}</b><span>${p.role} · ${p.club}</span><br><i>${p.caps} sélections</i>`;
    tipEl.style.left = `${clamp(hit.x, 70, canvasHost.clientWidth - 70)}px`;
    tipEl.style.top  = `${hit.y}px`;
    tipEl.classList.add('is-on');
    highlightSquadRow(hit.id);
  };
}

function highlightSquadRow (id) {
  $$('.squad__row').forEach(r => r.classList.toggle('is-on', r.dataset.player === id));
}

function mountOverviewPitch () {
  if (scenes.pitch) return;
  scenes.pitch = createPitchScene(
    $('#pitchCanvas'), slotsWithNames(), bindPitchTip($('#pitchTip'), $('#pitchHost')));
}

function mountLionsPitch () {
  if (scenes.pitch2) { scenes.pitch2.resume(); return; }
  scenes.pitch2 = createPitchScene(
    $('#pitchCanvas2'), slotsWithNames(), bindPitchTip($('#pitchTip2'), $('#pitchHost2')));
}

function renderSquad () {
  $('#squadList').innerHTML = slotsWithNames().map(s => {
    const p = BY_ID[s.id];
    return `
      <div class="squad__row" data-player="${p.id}" data-slot="${s.id}">
        <span class="squad__tag">${s.tag}</span>
        ${avatar(p, 'sm')}
        <div style="min-width:0">
          <div class="squad__name">${p.name}</div>
          <div class="squad__club">${p.club}</div>
        </div>
        <div class="squad__caps"><b>${p.caps}</b><span>Sélections</span></div>
      </div>`;
  }).join('');

  $$('.squad__row').forEach(row => {
    row.addEventListener('mouseenter', () => {
      highlightSquadRow(row.dataset.player);
      scenes.pitch2?.highlight(row.dataset.slot);
    });
  });
}

function renderKpis () {
  const caps  = PLAYERS.reduce((s, p) => s + p.caps, 0);
  const goals = PLAYERS.reduce((s, p) => s + p.s.goals, 0);
  const leagues = new Set(PLAYERS.map(p => p.league)).size;
  $('#kpiPlayers').dataset.count  = PLAYERS.length;
  $('#kpiCaps').dataset.count     = caps;
  $('#kpiGoals').dataset.count    = goals;
  $('#kpiLeagues').dataset.count  = leagues;
}

/* ==========================================================================
   9. Comparateur
   ========================================================================== */
const DUELS = [
  { l: 'Note moyenne',      get: p => p.s.rating,                   d: 2, max: 9   },
  { l: 'Buts',              get: p => p.s.goals,                    d: 0, max: 25  },
  { l: 'Passes décisives',  get: p => p.s.assists,                  d: 0, max: 12  },
  { l: 'Minutes jouées',    get: p => p.s.min,                      d: 0, max: 3000 },
  { l: '% passes réussies', get: p => p.s.pass,                     d: 0, max: 100 },
  { l: 'Duels gagnés (%)',  get: p => p.s.duels,                    d: 0, max: 100 },
  { l: 'Sélections',        get: p => p.caps,                       d: 0, max: 100 }
];

function compCard (p, color) {
  if (!p) return '';
  return `
    <div class="comp__player">
      ${avatar(p, 'md')}
      <div>
        <h3>${p.name}</h3>
        <p>${p.role} · ${p.club}</p>
      </div>
    </div>
    <div class="comp__rows">
      ${axes().map(a => `
        <div class="crow">
          <div class="crow__top"><span>${a.label}</span><b>${p.radar[a.key]}</b></div>
          <div class="crow__t"><i class="crow__f" data-w="${p.radar[a.key]}" style="background:linear-gradient(90deg,${color}55,${color})"></i></div>
        </div>`).join('')}
    </div>`;
}

function renderCompare () {
  const a = BY_ID[state.cmp[0]], b = BY_ID[state.cmp[1]];
  $('#cmpA').value = state.cmp[0];
  $('#cmpB').value = state.cmp[1];
  $('#quickA').value = state.cmp[0];
  $('#quickB').value = state.cmp[1];
  $('#legA').textContent = a ? a.name : '—';
  $('#legB').textContent = b ? b.name : '—';

  $('#cmpCardA').innerHTML = compCard(a, '#ff3b46');
  $('#cmpCardB').innerHTML = compCard(b, '#38b6ff');

  $('#duels').innerHTML = DUELS.map(d => {
    const va = d.get(a) ?? 0, vb = d.get(b) ?? 0;
    return `
      <div class="duel">
        <div class="duel__side duel__side--a">
          <span class="duel__bar"><i data-w="${clamp(va / d.max * 100, 0, 100)}"></i></span>
          <span class="duel__v ${va > vb ? 'win' : ''}">${fmt(va, d.d)}</span>
        </div>
        <div class="duel__label">${d.l}</div>
        <div class="duel__side duel__side--b">
          <span class="duel__v ${vb > va ? 'win' : ''}">${fmt(vb, d.d)}</span>
          <span class="duel__bar"><i data-w="${clamp(vb / d.max * 100, 0, 100)}"></i></span>
        </div>
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    $$('#view-compare [data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; });
  });

  scenes.radar?.set(a?.radar, b?.radar);
}

function mountRadar () {
  if (!scenes.radar) scenes.radar = createRadarScene($('#radarCanvas'), axes());
  else scenes.radar.resume();
  const a = BY_ID[state.cmp[0]], b = BY_ID[state.cmp[1]];
  scenes.radar.set(a?.radar, b?.radar);
}

function fillPlayerSelects () {
  const opts = PLAYERS
    .slice()
    .sort((x, y) => x.name.localeCompare(y.name, 'fr'))
    .map(p => `<option value="${p.id}">${p.name} — ${p.club}</option>`).join('');
  ['#cmpA', '#cmpB', '#quickA', '#quickB'].forEach(sel => {
    const el = $(sel);
    el.innerHTML = (sel.includes('quick') ? '<option value="">Choisir un joueur</option>' : '') + opts;
  });
}

function setCompare (a, b) {
  state.cmp = [a || state.cmp[0], b || state.cmp[1]];
  renderCompare();
}

/* ==========================================================================
   10. Fiche joueur (panneau latéral)
   ========================================================================== */
function openPlayer (id) {
  const p = BY_ID[id];
  if (!p) return;
  const [c1, c2] = clubColors(p.club);

  $('#drawerPanel').innerHTML = `
    <div class="drawer__hero">
      <svg class="drawer__hero-bg" viewBox="0 0 100 60" preserveAspectRatio="none">
        <defs><linearGradient id="dh" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}" stop-opacity=".55"/>
          <stop offset="100%" stop-color="${c2}" stop-opacity=".18"/></linearGradient></defs>
        <rect width="100" height="60" fill="url(#dh)"/>
      </svg>
      <button class="drawer__close" data-close aria-label="Fermer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
      <div class="drawer__id">
        ${avatar(p, 'lg')}
        <div>
          <h2>${p.name}</h2>
          <p>${p.role} · ${p.age} ans · pied ${p.foot.toLowerCase()}</p>
          <div class="club">${p.club} — ${p.league}</div>
        </div>
      </div>
      <div class="drawer__facts">
        <div class="fact"><b>${p.s.apps}</b><span>Matchs</span></div>
        <div class="fact"><b>${fmt(p.s.min)}</b><span>Minutes</span></div>
        <div class="fact"><b>${p.s.goals}</b><span>Buts</span></div>
        <div class="fact"><b>${p.s.assists}</b><span>P. décisives</span></div>
      </div>
    </div>

    <div class="drawer__body">
      <div>
        <div class="block__t">Lecture du profil</div>
        <p class="drawer__note">${p.note}</p>
      </div>

      <div>
        <div class="block__t">Attributs (0–100)</div>
        <canvas class="drawer__radar" id="drawerRadar"></canvas>
      </div>

      <div>
        <div class="block__t">Saison ${META.season}</div>
        <div class="comp__rows">
          ${[
            ['Note moyenne', p.s.rating.toFixed(2)],
            ['Passes réussies', `${p.s.pass} %`],
            ['Duels gagnés', `${p.s.duels} %`],
            p.pos === 'GK' ? ['Clean sheets', p.s.cleanSheets] : ['Dribbles / match', fmt(p.s.dribbles ?? 0, 1)],
            ['Sélections', `${p.caps} (${p.intlGoals} buts)`],
            ['Taille', `${p.height} cm`]
          ].map(([k, v]) => `<div class="crow"><div class="crow__top"><span>${k}</span><b>${v}</b></div></div>`).join('')}
        </div>
      </div>

      <div>
        <div class="block__t">Forme — 5 derniers matchs</div>
        <div style="display:flex;align-items:center;gap:12px">${sparkline(p.form, 300, 52)}${trendBadge(p.trend)}</div>
      </div>

      <div class="drawer__actions">
        <button class="btn btn--sm" data-cmp-a="${p.id}">Placer à gauche du comparateur</button>
        <button class="btn btn--ghost" data-cmp-b="${p.id}">Placer à droite</button>
      </div>
    </div>`;

  $('#drawer').classList.add('is-open');
  document.body.classList.add('is-locked');

  scenes.drawerRadar?.dispose();
  scenes.drawerRadar = createRadarScene($('#drawerRadar'), axes());
  scenes.drawerRadar.set(p.radar, null);
}

function closeDrawer () {
  $('#drawer').classList.remove('is-open');
  document.body.classList.remove('is-locked');
  scenes.drawerRadar?.dispose();
  scenes.drawerRadar = null;
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) return closeDrawer();
  const a = e.target.closest('[data-cmp-a]');
  if (a) { setCompare(a.dataset.cmpA, null); closeDrawer(); setView('compare'); return; }
  const b = e.target.closest('[data-cmp-b]');
  if (b) { setCompare(null, b.dataset.cmpB); closeDrawer(); setView('compare'); return; }
  const card = e.target.closest('[data-player]');
  if (card) openPlayer(card.dataset.player);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDrawer(); closeSearch(); }
  if (e.key === 'Enter' && document.activeElement?.dataset?.player) openPlayer(document.activeElement.dataset.player);
});

/* ==========================================================================
   11. Recherche
   ========================================================================== */
function closeSearch () { $('#searchResults').classList.remove('is-open'); }

$('#search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  const box = $('#searchResults');
  if (!q) { closeSearch(); return; }
  const hits = PLAYERS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.club.toLowerCase().includes(q) ||
    p.role.toLowerCase().includes(q) ||
    p.league.toLowerCase().includes(q)).slice(0, 8);

  box.innerHTML = hits.length
    ? hits.map(p => `<button class="search__item" data-player="${p.id}">
         ${avatar(p, 'sm')}<span style="min-width:0"><strong>${p.name}</strong><span>${p.role} · ${p.club}</span></span></button>`).join('')
    : `<div class="search__empty">Aucun joueur pour « ${q} »</div>`;
  box.classList.add('is-open');
});
$('#search').addEventListener('focus', e => { if (e.target.value.trim()) $('#searchResults').classList.add('is-open'); });
document.addEventListener('click', e => { if (!e.target.closest('.search')) closeSearch(); });

/* ==========================================================================
   12. Compteurs animés & apparition au défilement
   ========================================================================== */
function countTo (el, to, dur = 900) {
  const isFloat = String(to).includes(',') || String(to).includes('.');
  const target = parseFloat(String(to).replace(/\s/g, '').replace(',', '.'));
  if (!isFinite(target)) { el.textContent = to; return; }
  const t0 = performance.now();
  (function step (t) {
    const k = clamp((t - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = isFloat ? fmt(target * e, 1) : fmt(Math.round(target * e));
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}
function countUpIn (root) {
  $$('[data-count]', root).forEach(el => countTo(el, el.dataset.count));
}

const revealIO = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('is-in');
    countUpIn(en.target);
    revealIO.unobserve(en.target);
  });
}, { threshold: 0.12 });

function revealScan () {
  $$('.reveal:not(.is-in), .kpi b[data-count]').forEach(el => revealIO.observe(el.classList?.contains('reveal') ? el : el.parentElement));
  $$('.reveal:not(.is-in)').forEach(el => revealIO.observe(el));
  $$('.kpi').forEach(el => revealIO.observe(el));
}

/* ==========================================================================
   13. Fond animé de la carte « La relève » (braises + skyline, canvas 2D)
   ========================================================================== */
function releveBackdrop (canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(devicePixelRatio, 2);
  const embers = Array.from({ length: 46 }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4,
    s: Math.random() * 0.12 + 0.03, a: Math.random() * 0.5 + 0.15
  }));
  /* Silhouette de ville figée (générée une fois) */
  const city = Array.from({ length: 40 }, (_, i) => ({
    x: i / 40, w: 0.02 + Math.random() * 0.035, h: 0.08 + Math.random() * 0.3
  }));

  function size () {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  new ResizeObserver(size).observe(canvas);
  size();

  let raf;
  (function draw (t = 0) {
    raf = requestAnimationFrame(draw);
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    /* Lueur de coucher de soleil */
    const g = ctx.createRadialGradient(w * 0.82, h * 0.82, 4, w * 0.82, h * 0.82, w * 0.75);
    g.addColorStop(0, 'rgba(255,92,70,.30)');
    g.addColorStop(0.45, 'rgba(160,30,36,.14)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    /* Ville */
    ctx.fillStyle = 'rgba(8,6,8,.72)';
    city.forEach(b => ctx.fillRect(b.x * w, h - b.h * h, b.w * w, b.h * h));
    /* Minaret repère */
    ctx.fillRect(w * 0.72, h * 0.34, w * 0.026, h * 0.66);
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.34);
    ctx.lineTo(w * 0.733, h * 0.27);
    ctx.lineTo(w * 0.746, h * 0.34);
    ctx.closePath(); ctx.fill();

    /* Braises montantes */
    embers.forEach(e => {
      e.y -= e.s / 100;
      if (e.y < -0.05) { e.y = 1.05; e.x = Math.random(); }
      const x = (e.x + Math.sin((t / 1400) + e.y * 8) * 0.012) * w;
      ctx.beginPath();
      ctx.arc(x, e.y * h, e.r, 0, 6.283);
      ctx.fillStyle = `rgba(255,${120 + e.r * 40 | 0},90,${e.a})`;
      ctx.fill();
    });
  })();
  return () => cancelAnimationFrame(raf);
}

/* ==========================================================================
   14. Source de données
   ========================================================================== */

/**
 * Charge l'instantané produit par scripts/fetch-stats.mjs, s'il existe.
 * En son absence — fichier manquant, JSON invalide, site ouvert en local —
 * on reste silencieusement sur le jeu de démonstration.
 */
async function hydrate () {
  try {
    const res = await fetch('assets/data/players.json', { cache: 'no-store' });
    if (!res.ok) return;
    applyLiveData(await res.json());
  } catch {
    /* Pas de données en direct : le jeu de démonstration fait foi. */
  }
}

/** Le bandeau doit dire la vérité sur ce qui est mesuré et ce qui ne l'est pas. */
function renderDataBanner () {
  const el = $('#demobarText');
  if (!el) return;

  if (!DATA_SOURCE.live) {
    el.innerHTML = '<b>Mode démo</b> — identités réelles, statistiques illustratives';
    return;
  }

  const d = DATA_SOURCE.fetchedAt ? new Date(DATA_SOURCE.fetchedAt) : null;
  const quand = d && !isNaN(d)
    ? d.toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : 'date inconnue';

  $('#demobar').style.background = 'linear-gradient(90deg,#04140c,#0a2e1a 35%,#0a2e1a 65%,#04140c)';
  $('#demobar').style.borderBottomColor = '#135c33';
  el.style.color = '#cdeedd';
  el.innerHTML = `<b>Données réelles</b> — ${DATA_SOURCE.count} joueurs via ${DATA_SOURCE.source || 'API'}, `
               + `relevé du ${quand} · ${DATA_SOURCE.radarAxes ? 'indices calculés par 90 min' : 'indices d\'attributs éditoriaux'}`;
}

/* ==========================================================================
   15. Initialisation
   ========================================================================== */
function fillLeagueSelects () {
  const leagues = [...new Set(PLAYERS.map(p => p.league))].sort((a, b) => a.localeCompare(b, 'fr'));
  const opts = leagues.map(l => `<option value="${l}">${l}</option>`).join('');
  $('#fLeague').insertAdjacentHTML('beforeend', opts);
  $('#pLeague').insertAdjacentHTML('beforeend', opts);
}

function userAvatar () {
  $('#userAvatar').innerHTML = `
    <svg viewBox="0 0 40 40" width="34" height="34">
      <defs><linearGradient id="ua" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8c0f18"/><stop offset="100%" stop-color="#1f9d55"/></linearGradient></defs>
      <rect width="40" height="40" fill="url(#ua)"/>
      <circle cx="20" cy="15" r="6.5" fill="rgba(255,255,255,.85)"/>
      <path d="M6 40c0-7.5 6.3-12 14-12s14 4.5 14 12z" fill="rgba(255,255,255,.85)"/>
    </svg>`;
}

async function boot () {
  userAvatar();
  await hydrate();
  renderDataBanner();
  fillLeagueSelects();
  fillPlayerSelects();
  renderFeatured();
  renderWatch();
  renderGrid();
  renderSquad();
  renderKpis();
  renderCompare();

  /* Filtres */
  ['#fPos', '#fLeague'].forEach(s => $(s).addEventListener('change', renderFeatured));
  $('#fPeriod').addEventListener('change', e => {
    state.period = e.target.value;
    renderFeatured();
    renderWatch();
  });
  ['#pPos', '#pLeague', '#pSort'].forEach(s => $(s).addEventListener('change', renderGrid));

  /* Segments */
  initSegment($('#tierSeg'), 'tier', v => { state.watchTier = v; renderWatch(); });
  initSegment($('#tierSeg2'), 'tier', v => { state.gridTier = v; renderGrid(); });
  initSegment($('#unitSeg'), 'unit', v => { state.unit = v; renderFeatured(); renderWatch(); });

  /* Comparateur rapide */
  $('#quickA').addEventListener('change', e => e.target.value && setCompare(e.target.value, null));
  $('#quickB').addEventListener('change', e => e.target.value && setCompare(null, e.target.value));
  $('#cmpA').addEventListener('change', e => setCompare(e.target.value, null));
  $('#cmpB').addEventListener('change', e => setCompare(null, e.target.value));
  const swap = () => { state.cmp = [state.cmp[1], state.cmp[0]]; renderCompare(); };
  $('#quickSwap').addEventListener('click', swap);
  $('#cmpSwap').addEventListener('click', swap);
  $('#quickGo').addEventListener('click', () => setView('compare'));

  /* Scènes 3D */
  scenes.hero = createHeroScene($('#heroCanvas'));
  mountOverviewPitch();
  releveBackdrop($('#releveCanvas'));

  revealScan();
  window.addEventListener('resize', () => $$('.segment').forEach(moveThumb));
  /* Les polices modifient la largeur des onglets : on repositionne après chargement */
  document.fonts?.ready.then(() => $$('.segment').forEach(moveThumb));

  /* Fermeture de l'écran de chargement */
  const bar = $('#loaderBar');
  let v = 0;
  const iv = setInterval(() => {
    v = Math.min(100, v + 12 + Math.random() * 18);
    bar.style.width = `${v}%`;
    if (v >= 100) {
      clearInterval(iv);
      setTimeout(() => $('#loader').classList.add('is-done'), 220);
    }
  }, 90);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
