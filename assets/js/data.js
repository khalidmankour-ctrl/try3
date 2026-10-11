/* ============================================================================
 * ATLAS PERFORMANCE — Jeu de données
 * ----------------------------------------------------------------------------
 * Les joueurs listés ici sont des internationaux marocains / binationaux en
 * activité. Les IDENTITÉS (nom, poste, club) sont réelles à titre indicatif,
 * mais TOUTES LES STATISTIQUES sont ILLUSTRATIVES (mode démo) : ce prototype
 * n'est connecté à aucun fournisseur de données officiel.
 *
 * Pour brancher de vraies données : remplacez le contenu de PLAYERS par la
 * réponse de votre API (même forme d'objet) — le reste de l'application suit.
 * ==========================================================================*/

export const META = {
  season: '2025 / 2026',
  updated: '17 septembre 2026',
  demo: true
};

/* État de la source de données, renseigné au démarrage par applyLiveData().
   Tant que `live` est faux, tout ce qu'affiche le site vient du jeu de
   démonstration ci-dessous. */
export const DATA_SOURCE = {
  live: false,
  source: null,
  fetchedAt: null,
  season: null,
  count: 0,
  /* Champs réellement mesurés quand la source est en direct. Les autres
     (radar, note, form) restent éditoriaux : aucune API gratuite ne les
     fournit, il ne faut donc pas les présenter comme mesurés. */
  provides: [],
  editorial: ['radar', 'note', 'form'],
  /* Axes du radar quand ils sont calculés depuis les vraies données.
     Null tant qu'on affiche le radar éditorial. */
  radarAxes: null
};

/**
 * Fusionne un instantané produit par scripts/fetch-stats.mjs dans PLAYERS,
 * sur place, pour que tous les modules qui ont déjà importé PLAYERS voient
 * les nouvelles valeurs. Seules les valeurs non nulles écrasent la démo.
 * @param {{players:Object, source?:string, fetchedAt?:string, season?:number}} payload
 * @returns {number} nombre de joueurs mis à jour
 */
export function applyLiveData (payload) {
  if (!payload || typeof payload.players !== 'object') return 0;

  const STAT_KEYS = ['apps', 'min', 'goals', 'assists', 'rating', 'pass', 'duels',
                     'keyPasses', 'dribbles', 'tackles', 'saves', 'goalsAgainst'];
  let n = 0;

  for (const [id, live] of Object.entries(payload.players)) {
    const p = BY_ID[id];
    if (!p || !live) continue;
    if (live.club)   p.club   = live.club;
    if (live.league) p.league = live.league;
    STAT_KEYS.forEach(k => {
      if (live[k] !== null && live[k] !== undefined) p.s[k] = live[k];
    });
    if (live.radar) p.radar = live.radar;
    p.live = true;
    n++;
  }

  DATA_SOURCE.live      = n > 0;
  DATA_SOURCE.source    = payload.source    || null;
  DATA_SOURCE.fetchedAt = payload.fetchedAt || null;
  DATA_SOURCE.season    = payload.season    || null;
  DATA_SOURCE.count     = n;
  if (Array.isArray(payload.provides))  DATA_SOURCE.provides  = payload.provides;
  if (Array.isArray(payload.editorial)) DATA_SOURCE.editorial = payload.editorial;
  if (Array.isArray(payload.radarAxes) && payload.radarAxes.length) {
    DATA_SOURCE.radarAxes = payload.radarAxes;
  }
  return n;
}

/* Palette de maillots pour les avatars générés (aucune photo utilisée). */
export const CLUB_COLORS = {
  'Paris Saint-Germain': ['#0b2545', '#e30613'],
  'Real Madrid':         ['#dfe3ea', '#0b1d51'],
  'Al-Hilal':            ['#0b3fa8', '#eaf0ff'],
  'Fenerbahçe':          ['#0b2f6b', '#f5d130'],
  'Manchester United':   ['#7a0b16', '#f0c040'],
  'Olympique de Marseille': ['#e8f4ff', '#1b9bd8'],
  'Real Betis':          ['#0f7a3d', '#f2f7f3'],
  'PSV Eindhoven':       ['#d3222a', '#f2f2f2'],
  'Olympiakos':          ['#b8232c', '#f4f4f4'],
  'Villarreal':          ['#e8c13a', '#1b3f8b'],
  'Bayer Leverkusen':    ['#1c1c1c', '#c8102e'],
  'VfB Stuttgart':       ['#f1f1f1', '#d21b26'],
  'AS Roma':             ['#7a1420', '#d99f3c'],
  'AFC Ajax':            ['#f0f0f0', '#c8102e'],
  'Fiorentina':          ['#5a2a82', '#f0f0f0'],
  'Crystal Palace':      ['#1b3f8b', '#c8102e'],
  'Toulouse FC':         ['#5a2a82', '#f0f0f0'],
  'Stade Brestois':      ['#c8102e', '#f0f0f0'],
  'Wydad AC':            ['#c8102e', '#f5f5f5'],
  'Raja CA':             ['#0f7a3d', '#f5f5f5'],
  'AFC Bournemouth':     ['#b8232c', '#1a1a1a'],
  'Panathinaïkos':       ['#0f7a3d', '#f5f5f5'],
  'Feyenoord':           ['#c8102e', '#f5f5f5'],
  'Everton':             ['#12336b', '#f5f5f5'],
  'Watford':             ['#e8c13a', '#1a1a1a'],
  'FC Famalicão':        ['#1a5ba8', '#f5f5f5'],
  'Girona FC':           ['#c8102e', '#f5f5f5'],
  'Al-Rayyan':           ['#8a1538', '#f5f5f5'],
  'Al-Shabab':           ['#f5f5f5', '#1a1a1a'],
  'Angers SCO':          ['#f5f5f5', '#1a1a1a'],
  'RC Lens':             ['#f0c040', '#c8102e'],
  'default':             ['#1d2225', '#c8102e']
};

export const POSITIONS = {
  GK:  { label: 'Gardien',         short: 'G'  },
  DEF: { label: 'Défenseur',       short: 'D'  },
  MID: { label: 'Milieu',          short: 'M'  },
  ATT: { label: 'Attaquant',       short: 'A'  }
};

/* Métriques du radar — ordre = ordre d'affichage (sens horaire). */
export const RADAR_AXES = [
  { key: 'finition', label: 'Finition'  },
  { key: 'passe',    label: 'Passe'     },
  { key: 'dribble',  label: 'Dribble'   },
  { key: 'vitesse',  label: 'Vitesse'   },
  { key: 'physique', label: 'Physique'  },
  { key: 'defense',  label: 'Défense'   }
];

export const PLAYERS = [
  {
    id: 'hakimi', name: 'Achraf Hakimi', pos: 'DEF', role: 'Latéral droit',
    club: 'Paris Saint-Germain', league: 'Ligue 1', number: 2, age: 27, foot: 'Droit',
    height: 181, caps: 89, intlGoals: 12, tier: 'international', value: 65,
    s: { apps: 31, min: 2643, goals: 6, assists: 9, rating: 7.62, xg: 3.9, xa: 6.8,
         keyPasses: 1.9, dribbles: 1.8, tackles: 2.2, duels: 61, pass: 88 },
    radar: { finition: 71, passe: 84, dribble: 86, vitesse: 94, physique: 82, defense: 77 },
    form: [6.8, 7.1, 7.0, 7.9, 8.3], trend: 12,
    note: 'Référence mondiale au poste : profil de piston offensif, volume de course et finition de latéral rentrant.'
  },
  {
    id: 'bounou', name: 'Yassine Bounou', pos: 'GK', role: 'Gardien',
    club: 'Al-Hilal', league: 'Saudi Pro League', number: 1, age: 35, foot: 'Droit',
    height: 192, caps: 84, intlGoals: 0, tier: 'international', value: 12,
    s: { apps: 28, min: 2520, goals: 0, assists: 0, rating: 7.18, saves: 89, cleanSheets: 12,
         goalsAgainst: 24, savePct: 78, pass: 82, duels: 64, sweeps: 1.1 },
    radar: { finition: 12, passe: 78, dribble: 32, vitesse: 44, physique: 80, defense: 92 },
    form: [6.9, 7.0, 7.2, 7.4, 7.6], trend: 18,
    note: 'Sérénité aérienne et réflexes courts : le point d\'ancrage défensif de la sélection depuis 2018.'
  },
  {
    id: 'brahim', name: 'Brahim Díaz', pos: 'MID', role: 'Milieu offensif',
    club: 'Real Madrid', league: 'LaLiga', number: 21, age: 27, foot: 'Gauche',
    height: 171, caps: 18, intlGoals: 4, tier: 'international', value: 60,
    s: { apps: 34, min: 1912, goals: 9, assists: 6, rating: 7.44, xg: 7.1, xa: 4.4,
         keyPasses: 1.6, dribbles: 3.1, tackles: 0.7, duels: 52, pass: 90 },
    radar: { finition: 82, passe: 83, dribble: 93, vitesse: 87, physique: 58, defense: 41 },
    form: [6.6, 7.0, 7.5, 7.7, 8.1], trend: 28,
    note: 'Créateur entre les lignes, conduite de balle courte et percussion dans les demi-espaces.'
  },
  {
    id: 'ennesyri', name: 'Youssef En-Nesyri', pos: 'ATT', role: 'Avant-centre',
    club: 'Fenerbahçe', league: 'Süper Lig', number: 9, age: 29, foot: 'Droit',
    height: 189, caps: 92, intlGoals: 24, tier: 'international', value: 22,
    s: { apps: 33, min: 2604, goals: 18, assists: 4, rating: 7.36, xg: 15.9, xa: 2.6,
         keyPasses: 1.1, dribbles: 0.9, tackles: 0.4, duels: 57, pass: 74 },
    radar: { finition: 89, passe: 62, dribble: 60, vitesse: 82, physique: 88, defense: 34 },
    form: [7.0, 7.2, 6.9, 7.6, 7.8], trend: 9,
    note: 'Jeu de tête d\'élite et attaque de la profondeur : le finisseur numéro un des Lions.'
  },
  {
    id: 'mazraoui', name: 'Noussair Mazraoui', pos: 'DEF', role: 'Latéral polyvalent',
    club: 'Manchester United', league: 'Premier League', number: 3, age: 28, foot: 'Droit',
    height: 183, caps: 40, intlGoals: 2, tier: 'international', value: 25,
    s: { apps: 30, min: 2410, goals: 2, assists: 4, rating: 7.09, xg: 1.2, xa: 3.1,
         keyPasses: 1.2, dribbles: 1.1, tackles: 2.5, duels: 59, pass: 89 },
    radar: { finition: 52, passe: 84, dribble: 74, vitesse: 79, physique: 74, defense: 82 },
    form: [6.7, 6.9, 7.1, 7.2, 7.4], trend: 7,
    note: 'Latéral des deux côtés, très propre techniquement : sécurise la relance courte.'
  },
  {
    id: 'aguerd', name: 'Nayef Aguerd', pos: 'DEF', role: 'Défenseur central',
    club: 'Olympique de Marseille', league: 'Ligue 1', number: 27, age: 30, foot: 'Gauche',
    height: 188, caps: 46, intlGoals: 3, tier: 'international', value: 20,
    s: { apps: 29, min: 2561, goals: 3, assists: 1, rating: 7.21, xg: 2.1, xa: 0.6,
         keyPasses: 0.4, dribbles: 0.5, tackles: 1.9, duels: 68, pass: 91, clearances: 4.4 },
    radar: { finition: 44, passe: 82, dribble: 48, vitesse: 71, physique: 86, defense: 88 },
    form: [7.0, 7.3, 7.1, 7.4, 7.5], trend: 6,
    note: 'Central gaucher : première relance longue et duels aériens, l\'équilibre de la charnière.'
  },
  {
    id: 'amrabat', name: 'Sofyan Amrabat', pos: 'MID', role: 'Milieu défensif',
    club: 'Real Betis', league: 'LaLiga', number: 4, age: 29, foot: 'Droit',
    height: 185, caps: 62, intlGoals: 1, tier: 'international', value: 14,
    s: { apps: 28, min: 2130, goals: 1, assists: 2, rating: 7.05, xg: 0.8, xa: 1.5,
         keyPasses: 0.8, dribbles: 1.4, tackles: 2.9, duels: 66, pass: 88, interceptions: 1.8 },
    radar: { finition: 38, passe: 80, dribble: 72, vitesse: 66, physique: 90, defense: 87 },
    form: [6.8, 7.0, 7.1, 7.0, 7.3], trend: 5,
    note: 'Récupérateur box-to-box : couverture de surface et capacité à casser la première ligne.'
  },
  {
    id: 'elkaabi', name: 'Ayoub El Kaabi', pos: 'ATT', role: 'Avant-centre',
    club: 'Olympiakos', league: 'Super League', number: 11, age: 33, foot: 'Droit',
    height: 182, caps: 34, intlGoals: 11, tier: 'international', value: 8,
    s: { apps: 32, min: 2440, goals: 21, assists: 5, rating: 7.52, xg: 17.2, xa: 3.4,
         keyPasses: 1.3, dribbles: 1.0, tackles: 0.5, duels: 55, pass: 76 },
    radar: { finition: 91, passe: 64, dribble: 63, vitesse: 74, physique: 82, defense: 36 },
    form: [7.3, 7.6, 7.4, 7.9, 8.0], trend: 15,
    note: 'Instinct de surface rare : le meilleur ratio buts / minutes du vivier marocain.'
  },
  {
    id: 'ounahi', name: 'Azzedine Ounahi', pos: 'MID', role: 'Milieu relayeur',
    club: 'Panathinaïkos', league: 'Super League', number: 8, age: 26, foot: 'Droit',
    height: 180, caps: 42, intlGoals: 4, tier: 'international', value: 12,
    s: { apps: 30, min: 2288, goals: 5, assists: 6, rating: 7.24, xg: 3.2, xa: 4.9,
         keyPasses: 1.9, dribbles: 2.4, tackles: 1.6, duels: 54, pass: 87 },
    radar: { finition: 62, passe: 86, dribble: 88, vitesse: 76, physique: 62, defense: 60 },
    form: [6.9, 7.2, 7.4, 7.5, 7.8], trend: 14,
    note: 'Conduite de balle en glissé et prise d\'espace : le liant technique du milieu.'
  },
  {
    id: 'ziyech', name: 'Hakim Ziyech', pos: 'ATT', role: 'Ailier droit',
    club: 'Wydad AC', league: 'Botola Pro', number: 7, age: 33, foot: 'Gauche',
    height: 181, caps: 63, intlGoals: 20, tier: 'international', value: 6,
    s: { apps: 24, min: 1786, goals: 7, assists: 9, rating: 7.31, xg: 4.1, xa: 7.6,
         keyPasses: 2.8, dribbles: 1.7, tackles: 0.8, duels: 47, pass: 82 },
    radar: { finition: 78, passe: 93, dribble: 79, vitesse: 62, physique: 55, defense: 38 },
    form: [7.1, 7.0, 7.4, 7.3, 7.6], trend: 8,
    note: 'Pied gauche de référence : coups de pied arrêtés, centres rentrants et passes cassantes.'
  },
  {
    id: 'saibari', name: 'Ismael Saibari', pos: 'MID', role: 'Milieu offensif',
    club: 'PSV Eindhoven', league: 'Eredivisie', number: 10, age: 25, foot: 'Droit',
    height: 184, caps: 22, intlGoals: 5, tier: 'international', value: 30,
    s: { apps: 31, min: 2352, goals: 12, assists: 8, rating: 7.48, xg: 9.4, xa: 6.1,
         keyPasses: 2.0, dribbles: 2.2, tackles: 1.4, duels: 58, pass: 86 },
    radar: { finition: 80, passe: 84, dribble: 85, vitesse: 81, physique: 76, defense: 58 },
    form: [7.2, 7.4, 7.3, 7.8, 8.0], trend: 17,
    note: 'Arrivée lancée dans la surface : profil de milieu buteur, très rentable en transition.'
  },
  {
    id: 'ezzalzouli', name: 'Abde Ezzalzouli', pos: 'ATT', role: 'Ailier gauche',
    club: 'Real Betis', league: 'LaLiga', number: 22, age: 24, foot: 'Droit',
    height: 180, caps: 26, intlGoals: 4, tier: 'international', value: 28,
    s: { apps: 32, min: 2210, goals: 7, assists: 7, rating: 7.27, xg: 5.6, xa: 5.2,
         keyPasses: 1.7, dribbles: 3.4, tackles: 1.1, duels: 56, pass: 79 },
    radar: { finition: 71, passe: 74, dribble: 92, vitesse: 89, physique: 66, defense: 44 },
    form: [6.9, 7.3, 7.2, 7.6, 7.9], trend: 20,
    note: 'Un contre un déséquilibrant côté gauche, capable de fixer deux adversaires.'
  },
  {
    id: 'elkhannouss', name: 'Bilal El Khannouss', pos: 'MID', role: 'Meneur de jeu',
    club: 'VfB Stuttgart', league: 'Bundesliga', number: 14, age: 22, foot: 'Gauche',
    height: 179, caps: 24, intlGoals: 3, tier: 'international', value: 35,
    s: { apps: 30, min: 2065, goals: 6, assists: 9, rating: 7.33, xg: 4.0, xa: 7.0,
         keyPasses: 2.4, dribbles: 2.6, tackles: 1.2, duels: 51, pass: 88 },
    radar: { finition: 69, passe: 89, dribble: 89, vitesse: 74, physique: 59, defense: 48 },
    form: [7.0, 7.2, 7.5, 7.6, 7.9], trend: 22,
    note: 'Vision de jeu précoce : dernière passe et conservation sous pression dans les zones serrées.'
  },
  {
    id: 'benseghir', name: 'Eliesse Ben Seghir', pos: 'ATT', role: 'Ailier / second attaquant',
    club: 'Bayer Leverkusen', league: 'Bundesliga', number: 19, age: 21, foot: 'Droit',
    height: 176, caps: 16, intlGoals: 3, tier: 'international', value: 40,
    s: { apps: 29, min: 1948, goals: 9, assists: 6, rating: 7.35, xg: 7.0, xa: 4.8,
         keyPasses: 1.8, dribbles: 3.0, tackles: 1.0, duels: 53, pass: 83 },
    radar: { finition: 79, passe: 78, dribble: 90, vitesse: 90, physique: 60, defense: 42 },
    form: [7.1, 7.3, 7.2, 7.7, 8.0], trend: 24,
    note: 'Accélération sur trois appuis et frappe enroulée : profil de différence en sortie de banc ou titulaire.'
  },
  {
    id: 'akhomach', name: 'Ilias Akhomach', pos: 'ATT', role: 'Ailier droit',
    club: 'Villarreal', league: 'LaLiga', number: 17, age: 22, foot: 'Gauche',
    height: 177, caps: 12, intlGoals: 2, tier: 'international', value: 20,
    s: { apps: 27, min: 1620, goals: 5, assists: 5, rating: 7.09, xg: 4.2, xa: 4.0,
         keyPasses: 1.5, dribbles: 3.2, tackles: 0.9, duels: 49, pass: 81 },
    radar: { finition: 68, passe: 75, dribble: 90, vitesse: 86, physique: 55, defense: 38 },
    form: [6.8, 7.0, 7.1, 7.3, 7.5], trend: 11,
    note: 'Ailier de débordement formé à La Masia : centres et repiquages sur son pied gauche.'
  },
  {
    id: 'adli', name: 'Amine Adli', pos: 'ATT', role: 'Ailier gauche',
    club: 'AFC Bournemouth', league: 'Premier League', number: 21, age: 26, foot: 'Droit',
    height: 175, caps: 15, intlGoals: 2, tier: 'international', value: 26,
    s: { apps: 31, min: 1980, goals: 6, assists: 6, rating: 7.12, xg: 5.1, xa: 4.6,
         keyPasses: 1.6, dribbles: 2.5, tackles: 1.3, duels: 50, pass: 80 },
    radar: { finition: 72, passe: 76, dribble: 86, vitesse: 88, physique: 62, defense: 46 },
    form: [6.9, 7.0, 7.2, 7.2, 7.5], trend: 10,
    note: 'Volume de courses sans ballon et pressing haut : très adapté au 4-3-3 de transition.'
  },
  {
    id: 'richardson', name: 'Amir Richardson', pos: 'MID', role: 'Milieu axial',
    club: 'Fiorentina', league: 'Serie A', number: 24, age: 24, foot: 'Droit',
    height: 193, caps: 18, intlGoals: 1, tier: 'international', value: 15,
    s: { apps: 26, min: 1584, goals: 3, assists: 3, rating: 6.95, xg: 2.4, xa: 2.2,
         keyPasses: 1.1, dribbles: 1.2, tackles: 1.8, duels: 60, pass: 85 },
    radar: { finition: 58, passe: 80, dribble: 66, vitesse: 62, physique: 88, defense: 76 },
    form: [6.7, 6.8, 7.0, 7.0, 7.2], trend: 6,
    note: 'Gabarit rare au milieu : présence aérienne sur coups de pied arrêtés dans les deux surfaces.'
  },
  {
    id: 'elaynaoui', name: 'Neil El Aynaoui', pos: 'MID', role: 'Milieu box-to-box',
    club: 'AS Roma', league: 'Serie A', number: 26, age: 25, foot: 'Droit',
    height: 190, caps: 10, intlGoals: 1, tier: 'international', value: 24,
    s: { apps: 28, min: 2016, goals: 5, assists: 4, rating: 7.06, xg: 4.0, xa: 3.1,
         keyPasses: 1.2, dribbles: 1.5, tackles: 2.0, duels: 62, pass: 86 },
    radar: { finition: 66, passe: 81, dribble: 72, vitesse: 70, physique: 89, defense: 78 },
    form: [6.8, 7.0, 7.1, 7.3, 7.4], trend: 13,
    note: 'Puissance dans les courses vers l\'avant : casse les lignes balle au pied.'
  },
  {
    id: 'aboukhlal', name: 'Zakaria Aboukhlal', pos: 'ATT', role: 'Ailier droit',
    club: 'Toulouse FC', league: 'Ligue 1', number: 10, age: 26, foot: 'Gauche',
    height: 180, caps: 30, intlGoals: 6, tier: 'international', value: 14,
    s: { apps: 30, min: 2190, goals: 10, assists: 5, rating: 7.18, xg: 8.4, xa: 3.8,
         keyPasses: 1.5, dribbles: 2.1, tackles: 1.0, duels: 52, pass: 78 },
    radar: { finition: 80, passe: 72, dribble: 82, vitesse: 85, physique: 68, defense: 42 },
    form: [7.0, 7.1, 7.0, 7.4, 7.6], trend: 9,
    note: 'Ailier finisseur : rentre systématiquement dans l\'axe pour frapper du gauche.'
  },
  {
    id: 'riad', name: 'Chadi Riad', pos: 'DEF', role: 'Défenseur central',
    club: 'Crystal Palace', league: 'Premier League', number: 34, age: 23, foot: 'Droit',
    height: 190, caps: 9, intlGoals: 0, tier: 'international', value: 22,
    s: { apps: 24, min: 2016, goals: 1, assists: 0, rating: 6.98, xg: 0.9, xa: 0.3,
         keyPasses: 0.3, dribbles: 0.4, tackles: 1.7, duels: 66, pass: 88, clearances: 4.0 },
    radar: { finition: 40, passe: 79, dribble: 44, vitesse: 73, physique: 87, defense: 84 },
    form: [6.7, 6.9, 6.8, 7.1, 7.2], trend: 8,
    note: 'Central droitier moderne, à l\'aise dans une défense à trois comme à quatre.'
  },
  {
    id: 'salaheddine', name: 'Anass Salah-Eddine', pos: 'DEF', role: 'Latéral gauche',
    club: 'AS Roma', league: 'Serie A', number: 30, age: 24, foot: 'Gauche',
    height: 183, caps: 8, intlGoals: 0, tier: 'international', value: 16,
    s: { apps: 23, min: 1656, goals: 1, assists: 3, rating: 6.92, xg: 0.7, xa: 2.4,
         keyPasses: 1.0, dribbles: 1.3, tackles: 2.1, duels: 57, pass: 85 },
    radar: { finition: 48, passe: 80, dribble: 76, vitesse: 84, physique: 72, defense: 78 },
    form: [6.6, 6.8, 7.0, 7.0, 7.2], trend: 7,
    note: 'Couloir gauche : projections longues et qualité de centre en course.'
  },
  {
    id: 'dari', name: 'Achraf Dari', pos: 'DEF', role: 'Défenseur central',
    club: 'Stade Brestois', league: 'Ligue 1', number: 5, age: 27, foot: 'Droit',
    height: 186, caps: 20, intlGoals: 1, tier: 'international', value: 7,
    s: { apps: 26, min: 2184, goals: 2, assists: 0, rating: 6.94, xg: 1.4, xa: 0.2,
         keyPasses: 0.3, dribbles: 0.3, tackles: 1.6, duels: 65, pass: 84, clearances: 4.6 },
    radar: { finition: 45, passe: 74, dribble: 40, vitesse: 68, physique: 85, defense: 83 },
    form: [6.7, 6.8, 6.9, 7.0, 7.1], trend: 4,
    note: 'Défenseur d\'impact : agressivité sur l\'homme et densité dans les duels.'
  },
  {
    id: 'targhalline', name: 'Oussama Targhalline', pos: 'MID', role: 'Sentinelle',
    club: 'Feyenoord', league: 'Eredivisie', number: 6, age: 24, foot: 'Droit',
    height: 178, caps: 11, intlGoals: 0, tier: 'international', value: 12,
    s: { apps: 27, min: 1944, goals: 1, assists: 3, rating: 6.99, xg: 0.6, xa: 2.0,
         keyPasses: 0.9, dribbles: 1.1, tackles: 2.6, duels: 59, pass: 89, interceptions: 1.9 },
    radar: { finition: 42, passe: 85, dribble: 70, vitesse: 65, physique: 74, defense: 84 },
    form: [6.8, 6.9, 7.0, 7.1, 7.2], trend: 6,
    note: 'Sentinelle de relance : oriente le jeu et sécurise la sortie de balle.'
  },
  {
    id: 'boufal', name: 'Sofiane Boufal', pos: 'ATT', role: 'Ailier gauche',
    club: 'Al-Rayyan', league: 'QSL', number: 17, age: 32, foot: 'Droit',
    height: 175, caps: 51, intlGoals: 6, tier: 'international', value: 5,
    s: { apps: 22, min: 1540, goals: 6, assists: 7, rating: 7.14, xg: 4.2, xa: 5.4,
         keyPasses: 2.1, dribbles: 3.6, tackles: 0.7, duels: 48, pass: 80 },
    radar: { finition: 70, passe: 80, dribble: 94, vitesse: 72, physique: 58, defense: 33 },
    form: [6.9, 7.1, 7.0, 7.3, 7.4], trend: 7,
    note: 'Dribbleur pur : conserve et fait remonter le bloc dans les fins de match.'
  },

  /* ----------------------------- LA RELÈVE ----------------------------- */
  {
    id: 'aznou', name: 'Adam Aznou', pos: 'DEF', role: 'Latéral gauche',
    club: 'Everton', league: 'Premier League', number: 33, age: 20, foot: 'Gauche',
    height: 180, caps: 6, intlGoals: 0, tier: 'prospect', value: 18,
    s: { apps: 21, min: 1428, goals: 1, assists: 4, rating: 6.96, xg: 0.6, xa: 2.9,
         keyPasses: 1.3, dribbles: 1.9, tackles: 1.8, duels: 54, pass: 86 },
    radar: { finition: 50, passe: 82, dribble: 82, vitesse: 89, physique: 68, defense: 73 },
    form: [6.6, 6.9, 7.0, 7.2, 7.4], trend: 26,
    note: 'Formé au Bayern : qualité de pied gauche et projection, l\'héritier naturel du couloir.'
  },
  {
    id: 'zabiri', name: 'Yassir Zabiri', pos: 'ATT', role: 'Avant-centre',
    club: 'FC Famalicão', league: 'Liga Portugal', number: 9, age: 21, foot: 'Droit',
    height: 180, caps: 5, intlGoals: 2, tier: 'prospect', value: 14,
    s: { apps: 26, min: 1690, goals: 11, assists: 3, rating: 7.16, xg: 9.0, xa: 2.1,
         keyPasses: 1.0, dribbles: 1.4, tackles: 0.5, duels: 51, pass: 75 },
    radar: { finition: 84, passe: 66, dribble: 72, vitesse: 84, physique: 74, defense: 32 },
    form: [6.8, 7.0, 7.3, 7.4, 7.7], trend: 31,
    note: 'Héros de la finale du Mondial U20 : sens du but et frappe de coup franc.'
  },
  {
    id: 'ouazane', name: 'Abdellah Ouazane', pos: 'MID', role: 'Milieu offensif',
    club: 'AFC Ajax', league: 'Eredivisie', number: 42, age: 19, foot: 'Droit',
    height: 178, caps: 3, intlGoals: 0, tier: 'prospect', value: 12,
    s: { apps: 19, min: 1045, goals: 4, assists: 4, rating: 6.98, xg: 2.9, xa: 3.2,
         keyPasses: 1.7, dribbles: 2.3, tackles: 1.1, duels: 48, pass: 85 },
    radar: { finition: 68, passe: 84, dribble: 86, vitesse: 78, physique: 56, defense: 45 },
    form: [6.6, 6.8, 7.1, 7.1, 7.4], trend: 29,
    note: 'Profil de numéro 8 créatif : première touche orientée et passes entre les lignes.'
  },
  {
    id: 'maamma', name: 'Othmane Maamma', pos: 'ATT', role: 'Ailier droit',
    club: 'Watford', league: 'Championship', number: 27, age: 20, foot: 'Gauche',
    height: 176, caps: 4, intlGoals: 1, tier: 'prospect', value: 11,
    s: { apps: 28, min: 1820, goals: 7, assists: 6, rating: 7.04, xg: 5.4, xa: 4.4,
         keyPasses: 1.6, dribbles: 3.3, tackles: 1.0, duels: 49, pass: 77 },
    radar: { finition: 72, passe: 72, dribble: 90, vitesse: 91, physique: 57, defense: 36 },
    form: [6.7, 6.9, 7.2, 7.3, 7.5], trend: 27,
    note: 'Explosivité sur les cinq premiers mètres : ailier de rupture à fort volume de dribbles.'
  },
  {
    id: 'elmehdi', name: 'El Mehdi Moubarik', pos: 'DEF', role: 'Défenseur central',
    club: 'Raja CA', league: 'Botola Pro', number: 4, age: 21, foot: 'Droit',
    height: 187, caps: 2, intlGoals: 0, tier: 'prospect', value: 4,
    s: { apps: 24, min: 2016, goals: 1, assists: 1, rating: 6.90, xg: 0.8, xa: 0.4,
         keyPasses: 0.3, dribbles: 0.5, tackles: 1.9, duels: 63, pass: 83, clearances: 4.2 },
    radar: { finition: 38, passe: 76, dribble: 46, vitesse: 74, physique: 83, defense: 81 },
    form: [6.6, 6.7, 6.9, 7.0, 7.1], trend: 19,
    note: 'Produit du championnat national : lecture défensive avancée pour son âge.'
  },
  {
    id: 'naimbyar', name: 'Naïm Byar', pos: 'MID', role: 'Milieu relayeur',
    club: 'Angers SCO', league: 'Ligue 1', number: 18, age: 20, foot: 'Droit',
    height: 181, caps: 1, intlGoals: 0, tier: 'prospect', value: 6,
    s: { apps: 22, min: 1210, goals: 2, assists: 3, rating: 6.88, xg: 1.6, xa: 2.3,
         keyPasses: 1.2, dribbles: 1.8, tackles: 1.7, duels: 52, pass: 84 },
    radar: { finition: 58, passe: 80, dribble: 79, vitesse: 77, physique: 67, defense: 66 },
    form: [6.5, 6.7, 6.9, 7.0, 7.2], trend: 23,
    note: 'Milieu complet en devenir : intensité défensive et capacité à porter le ballon.'
  },
  {
    id: 'kechta', name: 'Yassine Kechta', pos: 'ATT', role: 'Ailier gauche',
    club: 'Girona FC', league: 'LaLiga', number: 29, age: 21, foot: 'Droit',
    height: 174, caps: 2, intlGoals: 0, tier: 'prospect', value: 9,
    s: { apps: 20, min: 1120, goals: 4, assists: 5, rating: 6.94, xg: 3.1, xa: 3.6,
         keyPasses: 1.5, dribbles: 3.0, tackles: 0.8, duels: 46, pass: 79 },
    radar: { finition: 66, passe: 74, dribble: 88, vitesse: 87, physique: 52, defense: 34 },
    form: [6.5, 6.8, 6.9, 7.1, 7.3], trend: 25,
    note: 'Gabarit léger mais très déséquilibrant dans les petits espaces du couloir gauche.'
  },
  {
    id: 'hamza', name: 'Hamza Igamane', pos: 'ATT', role: 'Avant-centre',
    club: 'RC Lens', league: 'Ligue 1', number: 19, age: 23, foot: 'Droit',
    height: 184, caps: 3, intlGoals: 1, tier: 'prospect', value: 13,
    s: { apps: 27, min: 1701, goals: 10, assists: 2, rating: 7.08, xg: 8.1, xa: 1.7,
         keyPasses: 0.9, dribbles: 1.6, tackles: 0.4, duels: 53, pass: 74 },
    radar: { finition: 83, passe: 64, dribble: 74, vitesse: 86, physique: 76, defense: 30 },
    form: [6.7, 7.0, 7.1, 7.3, 7.6], trend: 21,
    note: 'Attaquant de profondeur : prise d\'espace dans le dos de la ligne défensive.'
  }
];

/* Composition illustrative (4-3-3) — coordonnées normalisées sur le terrain :
   x de 0 (sa propre ligne de but) à 1 (but adverse), y de 0 à 1 (largeur). */
export const FORMATION = {
  name: '4-3-3',
  slots: [
    { id: 'bounou',       x: 0.06, y: 0.50, tag: 'G'  },
    { id: 'mazraoui',     x: 0.26, y: 0.14, tag: 'DD' },
    { id: 'aguerd',       x: 0.22, y: 0.38, tag: 'DC' },
    { id: 'riad',         x: 0.22, y: 0.62, tag: 'DC' },
    { id: 'hakimi',       x: 0.30, y: 0.86, tag: 'DG' },
    { id: 'amrabat',      x: 0.44, y: 0.50, tag: 'MDC'},
    { id: 'elkhannouss',  x: 0.56, y: 0.26, tag: 'MC' },
    { id: 'saibari',      x: 0.56, y: 0.74, tag: 'MC' },
    { id: 'ziyech',       x: 0.80, y: 0.16, tag: 'AD' },
    { id: 'ennesyri',     x: 0.86, y: 0.50, tag: 'BU' },
    { id: 'ezzalzouli',   x: 0.80, y: 0.84, tag: 'AG' }
  ]
};

/* Index rapide */
export const BY_ID = Object.fromEntries(PLAYERS.map(p => [p.id, p]));

export function clubColors (club) {
  return CLUB_COLORS[club] || CLUB_COLORS.default;
}

export function initials (name) {
  const parts = name.split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
}
