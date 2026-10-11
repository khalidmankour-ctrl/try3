/* ============================================================================
 * LE JOURNAL DES LIONS
 * Une « une » de journal assemblée en motion design à partir des seules
 * statistiques. Aucune image, aucune séquence vidéo : tout est dessiné.
 * Le contenu se régénère donc à chaque rafraîchissement des données.
 * ==========================================================================*/
import { PLAYERS, BY_ID, FORMATION, DATA_SOURCE, clubColors, initials } from './data.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = n => Number(n).toLocaleString('fr-FR');

/* --------------------------------------------------------------- sélection */
function pick () {
  const act = PLAYERS.filter(p => p.s.min > 0);
  const by = (f) => act.slice().sort((a, b) => f(b) - f(a));

  const scorers = by(p => p.s.goals).slice(0, 5);
  const best    = by(p => p.s.rating)[0];
  const riser   = by(p => p.trend)[0];
  const passer  = by(p => p.s.assists)[0];
  const workhorse = by(p => p.s.min)[0];

  return {
    best, riser, passer, workhorse, scorers,
    totals: {
      goals:   act.reduce((s, p) => s + p.s.goals, 0),
      assists: act.reduce((s, p) => s + p.s.assists, 0),
      minutes: act.reduce((s, p) => s + p.s.min, 0),
      caps:    PLAYERS.reduce((s, p) => s + p.caps, 0),
      leagues: new Set(act.map(p => p.league)).size,
      players: act.length
    }
  };
}

/* ------------------------------------------------------------ petits blocs */
function crest (p, size = 64) {
  const [c1, c2] = clubColors(p.club);
  const gid = `jg-${p.id}-${size}`;
  return `<svg class="jn-crest" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
    <path d="M32 2 60 15v22c0 13-12 22-28 25C16 59 4 50 4 37V15z" fill="url(#${gid})"/>
    <path d="M32 2 60 15v22c0 13-12 22-28 25C16 59 4 50 4 37V15z" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
    <text x="32" y="38" text-anchor="middle" font-family="Archivo,sans-serif" font-weight="800"
          font-size="21" fill="#fff" opacity=".95">${initials(p.name)}</text>
  </svg>`;
}

/** Barre de classement, largeur animée par la timeline. */
function raceRow (p, i, max) {
  return `<li class="jn-race__row" style="--d:${i}">
    <span class="jn-race__rank">${i + 1}</span>
    <span class="jn-race__name">${p.name}</span>
    <span class="jn-race__track"><i style="--w:${Math.round((p.s.goals / max) * 100)}%"></i></span>
    <span class="jn-race__v">${p.s.goals}</span>
  </li>`;
}

/* ------------------------------------------------------------------ rendu */
export function renderJournal () {
  const host = $('#journalPage');
  if (!host) return;
  const d = pick();
  const maxG = d.scorers[0]?.s.goals || 1;

  const dateStr = new Date().toLocaleDateString('fr-FR',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const provenance = DATA_SOURCE.live
    ? `Chiffres ${DATA_SOURCE.source} · saison ${DATA_SOURCE.season}`
    : 'Chiffres de démonstration · aucune source officielle';

  host.innerHTML = `
    <div class="jn" id="jn">
      <header class="jn-head">
        <div class="jn-head__rule" data-step="0"></div>
        <h1 class="jn-masthead" data-step="0">
          ${'LE JOURNAL DES LIONS'.split('').map((c, i) =>
            `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}
        </h1>
        <div class="jn-head__meta" data-step="1">
          <span>${dateStr}</span><span class="jn-dot">•</span><span>${provenance}</span>
        </div>
        <div class="jn-head__rule" data-step="1"></div>
      </header>

      <div class="jn-grid">
        <!-- LA UNE -->
        <article class="jn-card jn-card--lead" data-step="2">
          <span class="jn-kicker">La une</span>
          <div class="jn-lead">
            ${crest(d.best, 76)}
            <div>
              <h2 class="jn-lead__name">${d.best.name}</h2>
              <p class="jn-lead__sub">${d.best.role} · ${d.best.club}</p>
            </div>
          </div>
          <p class="jn-lead__body">
            Meilleure note du groupe suivi avec
            <b class="jn-num" data-to="${d.best.s.rating}" data-dec="2">0</b> de moyenne
            sur <b class="jn-num" data-to="${d.best.s.apps}">0</b> matchs,
            pour <b class="jn-num" data-to="${d.best.s.goals}">0</b> but(s)
            et <b class="jn-num" data-to="${d.best.s.assists}">0</b> passe(s) décisive(s).
          </p>
        </article>

        <!-- LE CHIFFRE -->
        <article class="jn-card jn-card--figure" data-step="3">
          <span class="jn-kicker">Le chiffre</span>
          <div class="jn-figure" data-to="${d.totals.goals}">0</div>
          <p class="jn-figure__l">buts inscrits en club<br>par les ${d.totals.players} joueurs suivis</p>
        </article>

        <!-- CLASSEMENT BUTEURS -->
        <article class="jn-card jn-card--race" data-step="4">
          <span class="jn-kicker">Classement des buteurs</span>
          <ul class="jn-race">${d.scorers.map((p, i) => raceRow(p, i, maxG)).join('')}</ul>
        </article>

        <!-- EN PROGRESSION -->
        <article class="jn-card jn-card--rise" data-step="5">
          <span class="jn-kicker">En progression</span>
          <div class="jn-rise">
            ${crest(d.riser, 48)}
            <div>
              <h3>${d.riser.name}</h3>
              <p>${d.riser.club}</p>
            </div>
            <span class="jn-rise__pct">+<b class="jn-num" data-to="${d.riser.trend}">0</b>%</span>
          </div>
          <svg class="jn-spark" viewBox="0 0 220 56" preserveAspectRatio="none" aria-hidden="true">
            ${(() => {
              const f = d.riser.form, mn = Math.min(...f) - .2, mx = Math.max(...f) + .2;
              const pts = f.map((v, i) => [8 + (i / (f.length - 1)) * 204, 48 - ((v - mn) / (mx - mn || 1)) * 40]);
              const dd = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
              return `<path class="jn-spark__l" d="${dd}"/>` +
                     pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" style="--i:${i}"/>`).join('');
            })()}
          </svg>
        </article>

        <!-- BRÈVES -->
        <article class="jn-card jn-card--briefs" data-step="6">
          <span class="jn-kicker">En bref</span>
          <ul class="jn-briefs">
            <li><b>${d.passer.name}</b> mène les passes décisives avec <b>${d.passer.s.assists}</b>.</li>
            <li><b>${d.workhorse.name}</b> est le plus utilisé : <b>${fmt(d.workhorse.s.min)}</b> minutes.</li>
            <li>Le groupe pèse <b>${fmt(d.totals.caps)}</b> sélections cumulées.</li>
            <li>Les Lions sont représentés dans <b>${d.totals.leagues}</b> championnats.</li>
          </ul>
        </article>

        <!-- LE ONZE -->
        <article class="jn-card jn-card--eleven" data-step="7">
          <span class="jn-kicker">Le onze type</span>
          <ul class="jn-eleven">
            ${FORMATION.slots.filter(s => BY_ID[s.id]).map((s, i) => `
              <li style="--d:${i}"><span>${s.tag}</span>${BY_ID[s.id].name}</li>`).join('')}
          </ul>
        </article>
      </div>

      <footer class="jn-foot" data-step="8">
        <span>Édition générée automatiquement — aucune image ni séquence vidéo, uniquement des données mises en scène.</span>
        <button class="btn btn--ghost" id="jnReplay">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>
          Rejouer
        </button>
      </footer>
    </div>`;

  $('#jnReplay').addEventListener('click', playJournal);
}

/* --------------------------------------------------------------- timeline */
let playing = false;

/** Compteur animé, utilisé par la timeline. */
function countTo (el) {
  const to  = parseFloat(el.dataset.to);
  const dec = Number(el.dataset.dec || 0);
  if (!isFinite(to)) return;
  const t0 = performance.now(), dur = 900;
  (function step (t) {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = (to * e).toLocaleString('fr-FR',
      { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (k < 1) requestAnimationFrame(step);
  })(t0);
}

export function playJournal () {
  const root = $('#jn');
  if (!root || playing) return;
  playing = true;

  /* Remise à zéro */
  $$('[data-step]', root).forEach(el => el.classList.remove('is-in'));
  $$('.jn-num, .jn-figure', root).forEach(el => (el.textContent = '0'));
  root.classList.remove('is-played');

  const steps = [...new Set($$('[data-step]', root).map(el => +el.dataset.step))].sort((a, b) => a - b);

  steps.forEach((n, i) => {
    setTimeout(() => {
      $$(`[data-step="${n}"]`, root).forEach(el => {
        el.classList.add('is-in');
        $$('.jn-num, .jn-figure', el).forEach(countTo);
      });
      if (i === steps.length - 1) {
        setTimeout(() => { root.classList.add('is-played'); playing = false; }, 900);
      }
    }, i * 420);
  });
}
