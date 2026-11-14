// ponytail: Math.random suffit pour des identifiants locaux ; crypto.randomUUID
// planterait si l'appli est ouverte en http sur le réseau local (tablette).
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Modificateur de caractéristique 5e : (score - 10) / 2 arrondi à l'inférieur */
export const mod = (score) => Math.floor((Number(score || 10) - 10) / 2);
export const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Lance un dé à `faces` faces */
export const d = (faces) => 1 + Math.floor(Math.random() * faces);

/** Texte simplifié pour la recherche : sans casse ni accents (« elfe » trouve « Élfe ») */
export const plain = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Canal de diffusion vers l'écran joueurs (autre fenêtre du même navigateur) */
export const PLAYER_CHANNEL = "table-du-maitre:joueurs";

/** Couleur de barre de vie selon le pourcentage restant */
export function hpColor(hp, hpMax) {
  const r = hpMax > 0 ? hp / hpMax : 0;
  return r > 0.5 ? "var(--life)" : r > 0.25 ? "var(--gold)" : "var(--blood)";
}

/** Bonus de maîtrise : selon le niveau (PJ / PNJ) ou le FP (monstres, « 1/2 » accepté) */
export function profBonus(e) {
  const x = e.kind === "monster" ? crValue(e.cr) : Number(e.level) || 1;
  return Math.max(2, Math.ceil(x / 4) + 1);
}

/** Valeur numérique d'un FP saisi librement (« FP 1/2 » → 0,5) ; null si absent */
export function crValue(cr) {
  const [a, b] = String(cr ?? "").replace(",", ".").replace(/[^\d./]/g, "").split("/");
  if (a === "" || a == null) return null;
  return b ? Number(a) / Number(b) : Number(a);
}

/* ---------- Difficulté des rencontres (Guide du maître 2024) ---------- */

/** XP d'une créature selon son FP (identique en 2014 et 2024) */
const CR_XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000,
};
export const crXp = (cr) => CR_XP[crValue(cr)] ?? 0;

/** Budget d'XP par personnage selon son niveau : [faible, modérée, élevée] */
const XP_BUDGET = [
  null, [50, 75, 100], [100, 150, 200], [150, 225, 400], [250, 375, 500], [500, 750, 1100],
  [600, 1000, 1400], [750, 1300, 1700], [1000, 1700, 2100], [1300, 2000, 2600], [1600, 2300, 3100],
  [1900, 2900, 4100], [2200, 3700, 4700], [2600, 4200, 5400], [2900, 4900, 6200], [3300, 5400, 7800],
  [3800, 6100, 9800], [4500, 7200, 11700], [5000, 8700, 14200], [5500, 10700, 17200], [6400, 13200, 22000],
];
export const DIFFICULTY = ["Faible", "Modérée", "Élevée"];

/** Budget du groupe et difficulté obtenue pour un total d'XP d'adversaires.
    `level` : -1 sous « faible », 0 faible, 1 modérée, 2 élevée, 3 au-delà d'élevée. */
export function encounterDifficulty(levels, xp) {
  const budget = [0, 1, 2].map((i) => levels.reduce((s, l) => s + XP_BUDGET[clamp(Math.round(l) || 1, 1, 20)][i], 0));
  let level = -1;
  budget.forEach((b, i) => xp >= b && b > 0 && (level = i));
  if (level === 2 && xp > budget[2] * 1.25) level = 3; // ponytail: « au-delà » = +25 % du budget élevé, repère arbitraire
  return { budget, level };
}

/* ---------- Effets à durée limitée ---------- */

/** Début du tour de c.activeId : les effets décomptés à ce tour perdent un round.
    Renvoie le combat mis à jour et les effets qui expirent. */
export function tickEffects(c) {
  const effects = [];
  const expired = [];
  for (const ef of c.effects || []) {
    if (ef.ownerId !== c.activeId) effects.push(ef);
    else if (ef.rounds <= 1) expired.push(ef);
    else effects.push({ ...ef, rounds: ef.rounds - 1 });
  }
  return { combat: { ...c, effects }, expired };
}

export function newEntity(kind) {
  return {
    id: uid(),
    kind,
    name: kind === "monster" ? "Nouveau monstre" : kind === "npc" ? "Nouveau PNJ" : "Nouveau personnage",
    race: "",
    clazz: "",
    background: "",
    level: 1,
    cr: "",
    abilities: { for: 10, dex: 10, con: 10, int: 10, sag: 10, cha: 10 },
    saves: {}, // { for: 1 } = maîtrise du JS de Force
    skills: {}, // { perception: 1 } = maîtrise, 2 = expertise
    hpMax: 10,
    hp: 10,
    tempHp: 0,
    ac: 10,
    speed: 9,
    initBonus: null,
    conditions: [],
    customConditions: [],
    exhaustion: 0,
    deathSaves: { ok: 0, ko: 0 },
    resources: [], // { id, label, cur, max, reset: "short" | "long" }
    image: "",
    notes: "",
    attacks: "",
    xp: 0,
    inspiration: false,
    languages: "",
    senses: "",
    resistances: "",
    immunities: "",
    vulnerabilities: "",
    money: { pc: 0, pa: 0, pe: 0, po: 0, pp: 0 },
    items: [], // { id, name, qty, magic, attuned, notes }
    spellAbility: "", // caractéristique d'incantation (« int », « sag », « cha »)
    spells: [], // { id, name, level (0 = sort mineur), concentration, notes }
    slots: {}, // { 1: { cur, max }, … 9 }
    relations: [], // { id, targetId, kind, note }
    hitDie: null, // 6, 8, 10, 12 ; null = déduit de la classe
    hdUsed: 0, // dés de vie dépensés
  };
}

/* ---------- Dés de vie et repos ---------- */

const CLASS_HIT_DIE = {
  Barbare: 12, Guerrier: 10, Paladin: 10, Rôdeur: 10,
  Barde: 8, Clerc: 8, Druide: 8, Moine: 8, Occultiste: 8, Roublard: 8,
  Ensorceleur: 6, Magicien: 6,
};
export const hitDieOf = (e) => e.hitDie || CLASS_HIT_DIE[e.clazz] || 8;
export const hitDiceMax = (e) => Math.max(1, Number(e.level) || 1);

/** Dépense un dé de vie (repos court) : 1dX + mod. de CON, jamais négatif */
export function spendHitDie(e, rng = d) {
  const roll = rng(hitDieOf(e));
  const heal = Math.max(0, roll + mod(e.abilities?.con));
  return { roll, heal, patch: { ...applyHp(e, heal), hdUsed: (e.hdUsed || 0) + 1 } };
}

const refill = (e, kinds) => ({
  resources: (e.resources || []).map((r) => (kinds.includes(r.reset) ? { ...r, cur: r.max } : r)),
});

export const shortRest = (e) => refill(e, ["short"]);

/** Repos long. 2014 : récupère la moitié des dés de vie ; 2024 : tous. */
export function longRest(e, rules = "2024") {
  const used = e.hdUsed || 0;
  return {
    ...refill(e, ["short", "long"]),
    hp: e.hpMax,
    tempHp: 0,
    exhaustion: Math.max(0, (e.exhaustion || 0) - 1),
    deathSaves: { ok: 0, ko: 0 },
    slots: Object.fromEntries(Object.entries(e.slots || {}).map(([l, s]) => [l, { ...s, cur: s.max }])),
    hdUsed: rules === "2024" ? 0 : Math.max(0, used - Math.max(1, Math.floor(hitDiceMax(e) / 2))),
  };
}

/** Ouvre l'écran joueurs, ou ramène au premier plan celui déjà ouvert (sans le recharger) */
export function openPlayerScreen() {
  const w = window.open("", "tdm-joueurs");
  if (!w) return;
  try {
    if (!w.location.search.includes("joueurs")) w.location.href = `${location.pathname}?joueurs`;
  } catch {
    w.location.href = `${location.pathname}?joueurs`;
  }
  w.focus();
}

export function newSession(n = 1) {
  return {
    id: uid(),
    title: `Session ${n}`,
    date: new Date().toISOString().slice(0, 10),
    summary: "",
    present: [], // ids des PJ présents
    xp: 0,
    xpGiven: false,
    loot: "",
    prep: [], // { id, kind: "scene" | "secret" | "npc" | "place", text, done, refId (fiche ou lieu lié) }
    gameDate: "", // date dans le monde du jeu (texte libre)
    scenes: [], // déroulé détaillé, voir newScene()
    nextHooks: "", // pistes pour la suite
  };
}

export const SCENE_KINDS = {
  scene: { label: "Scène", icon: "🎬" },
  combat: { label: "Combat", icon: "⚔️" },
  dialogue: { label: "Dialogue", icon: "💬" },
  discovery: { label: "Découverte", icon: "🔍" },
  travel: { label: "Voyage / exploration", icon: "🧭" },
  note: { label: "Note", icon: "📝" },
};

export function newScene(extra = {}) {
  return { id: uid(), title: "Nouvelle scène", kind: "scene", text: "", images: [], entities: [], places: [], quests: [], ...extra };
}

/** Tout ce qu'une session relie : personnages présents, liens des scènes, préparation */
export function sessionLinks(s) {
  const ids = new Set(s.present || []);
  for (const sc of s.scenes || []) [...(sc.entities || []), ...(sc.places || []), ...(sc.quests || [])].forEach((id) => ids.add(id));
  for (const p of s.prep || []) if (p.refId) ids.add(p.refId);
  return ids;
}

/** Sessions où apparaît une fiche, un lieu ou une quête (les plus récentes d'abord) */
export const sessionsMentioning = (sessions, id) =>
  sessions.filter((s) => sessionLinks(s).has(id)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

export const WORLD_TYPES = {
  quest: { label: "Quêtes", single: "Quête", fresh: "Nouvelle quête" },
  place: { label: "Lieux", single: "Lieu", fresh: "Nouveau lieu" },
  handout: { label: "Documents", single: "Document", fresh: "Nouveau document" },
};

export function newWorldItem(type) {
  return {
    id: uid(),
    type,
    name: WORLD_TYPES[type].fresh,
    image: "",
    text: "",
    status: "rumor", // quêtes : rumor | active | done | failed
    giver: "",
    reward: "",
    objectives: [], // { id, text, done }
    placeId: null, // quêtes : lieu où elle se déroule
    parentId: null, // lieux : lieu parent
    kind: "other", // lieux : région, ville, taverne… (voir PLACE_KINDS)
    residents: [], // lieux : ids des fiches (PNJ, monstres, PJ) qui s'y trouvent
  };
}

export const PLACE_KINDS = {
  region: { label: "Région", icon: "🗺️" },
  city: { label: "Ville", icon: "🏰" },
  village: { label: "Village", icon: "🏘️" },
  district: { label: "Quartier", icon: "🏙️" },
  building: { label: "Bâtiment", icon: "🏠" },
  tavern: { label: "Taverne / auberge", icon: "🍺" },
  temple: { label: "Temple", icon: "⛪" },
  dungeon: { label: "Donjon / grotte", icon: "🕳️" },
  wild: { label: "Nature", icon: "🌲" },
  other: { label: "Autre", icon: "📍" },
};

/** Lieux dans l'ordre de l'arbre, avec leur profondeur. Un lieu dont le parent
    n'existe plus est traité comme un lieu principal (il ne disparaît jamais d'une liste). */
export function placeTree(items, parentId = null, depth = 0) {
  const ids = new Set(items.map((p) => p.id));
  const isChild = (p) => (parentId === null ? !p.parentId || !ids.has(p.parentId) : p.parentId === parentId);
  return items
    .filter(isChild)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .flatMap((p) => [{ p, depth }, ...placeTree(items, p.id, depth + 1)]);
}

/** Chemin d'un lieu depuis la racine (« Val-Brume › Le moulin ») ; s'arrête en cas de boucle */
export function placePath(world, id) {
  const path = [];
  const seen = new Set();
  for (let p = world.find((w) => w.id === id); p && !seen.has(p.id); p = world.find((w) => w.id === p.parentId)) {
    seen.add(p.id);
    path.unshift(p);
  }
  return path;
}

export function newCombat() {
  return {
    id: uid(),
    name: "Nouvelle rencontre",
    map: "",
    mapRatio: 0.625,
    grid: true,
    gridCols: 20,
    tokens: [],
    round: 1,
    activeId: null, // id du pion dont c'est le tour
    started: false,
    log: [],
    templates: [], // gabarits de sorts : { id, shape: "sphere" | "cone", x, y (en cases), angle, size (m) }
    fog: { on: false, cells: [] }, // brouillard : cases révélées « x,y »
    effects: [], // effets temporaires : { id, tokenId, label, rounds, ownerId (tour qui décompte), conditionId }
  };
}

/* ---------- Grille : positions en cases (1 case = 1,5 m) ---------- */

/** Centre d'un pion en cases */
export function tokenCell(t, c) {
  const cols = c.gridCols || 20;
  return { x: (t.x / 100) * cols, y: (t.y / 100) * cols * (c.mapRatio || 0.625) };
}

/** Distance 5e en cases (une diagonale compte pour une case) */
export const cellDistance = (a, b) => Math.round(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)));

/** Le point (en cases) est-il dans le gabarit ? Sphère : rayon ; cône 5e : largeur au bout = longueur.
    ponytail: test sur le centre du pion, pas sur toute sa surface. */
export function inTemplate(tp, p) {
  const dx = p.x - tp.x;
  const dy = p.y - tp.y;
  const len = tp.size / 1.5;
  if (tp.shape === "sphere") return Math.hypot(dx, dy) <= len + 1e-9;
  const along = dx * Math.cos(tp.angle) + dy * Math.sin(tp.angle);
  const perp = Math.abs(-dx * Math.sin(tp.angle) + dy * Math.cos(tp.angle));
  return along >= 0 && along <= len + 1e-9 && perp <= along / 2 + 1e-9;
}

/** Sommets d'un cône (triangle) en cases, pour le dessin */
export function conePoints(tp) {
  const len = tp.size / 1.5;
  const at = (a, b) => [tp.x + a * Math.cos(tp.angle) - b * Math.sin(tp.angle), tp.y + a * Math.sin(tp.angle) + b * Math.cos(tp.angle)];
  return [[tp.x, tp.y], at(len, len / 2), at(len, -len / 2)];
}

/** Le pion est-il touché ? Règle 5e : il suffit qu'une partie de son espace soit dans la zone.
    ponytail: on teste le centre, les coins et les milieux des bords de l'espace, pas toute la surface. */
export function tokenInTemplate(tp, t, c) {
  const p = tokenCell(t, c);
  const h = ((t.size || 1) / 2) * 0.95;
  const offsets = [[0, 0], [h, h], [h, -h], [-h, h], [-h, -h], [h, 0], [-h, 0], [0, h], [0, -h]];
  return offsets.some(([dx, dy]) => inTemplate(tp, { x: p.x + dx, y: p.y + dy }));
}

/** Le pion est-il dans une zone révélée du brouillard ? */
export function inRevealed(t, c) {
  if (!c.fog?.on) return true;
  const { x, y } = tokenCell(t, c);
  return c.fog.cells.includes(`${Math.floor(x)},${Math.floor(y)}`);
}

/* ---------- Règles ---------- */

/** Modificateur de jet de sauvegarde (maîtrise comprise) */
export const saveMod = (e, ab) => mod(e.abilities?.[ab]) + (e.saves?.[ab] ? profBonus(e) : 0);

/** Malus de l'épuisement aux tests d20 (attaques, JS, tests, initiative, jets contre la mort) :
    −2 par niveau en 2024. En 2014, ce sont des désavantages par palier : rien à ajouter au jet. */
export const d20Malus = (e, rules = "2024") => (rules === "2014" ? 0 : -2 * (e.exhaustion || 0));

/** États qui font échouer automatiquement les JS de Force et de Dextérité */
export const AUTO_FAIL_STR_DEX = ["paralyse", "petrifie", "etourdi", "inconscient"];
export const autoFailsSave = (e, ab) => (ab === "for" || ab === "dex") && AUTO_FAIL_STR_DEX.some((c) => e.conditions?.includes(c));

/** Lit une ligne d'attaque (« Épée longue : +5, 1d8+3 tranchant ») ; null si ni bonus ni dés */
export function parseAttack(line) {
  const dice = line.match(/(?<!\p{L})\d*d\d+(?:\s*[+-]\s*\d+)*/iu);
  const before = dice ? line.slice(0, dice.index) : line;
  const bonus = [...before.matchAll(/(?:^|[^\w])([+-]\s?\d+)/g)].pop()?.[1];
  if (!dice && bonus == null) return null;
  return {
    name: line.split(/[:,(]/)[0].trim() || "Attaque",
    bonus: bonus == null ? null : Number(bonus.replace(/\s/g, "")),
    damage: dice ? dice[0].replace(/\s/g, "") : null,
  };
}

/** Coup critique : on double les dés, pas le bonus */
export const critFormula = (f) => f.replace(/(\d*)d(\d+)/gi, (_, n, s) => `${2 * (Number(n) || 1)}d${s}`);

/** DD du JS de concentration : 10 ou la moitié des dégâts ; plafonné à 30 en 2024 */
export const concentrationDc = (dmg, rules = "2024") => Math.min(rules === "2014" ? Infinity : 30, Math.max(10, Math.floor(dmg / 2)));

/** Dégâts + conséquences : concentration perdue à 0 PV, sinon DD du JS de concentration */
export function takeDamage(e, dmg, rules = "2024") {
  const patch = applyHp(e, -dmg);
  const notes = [];
  if (dmg > 0 && e.conditions.includes("concentration")) {
    if (patch.hp === 0) {
      patch.conditions = e.conditions.filter((c) => c !== "concentration");
      notes.push(`${e.name} tombe et perd sa concentration`);
    } else {
      notes.push(`${e.name} : JS de Constitution DD ${concentrationDc(dmg, rules)} pour garder sa concentration`);
    }
  }
  return { patch, notes };
}

/* Les PJ partagent les PV et états de leur fiche ; chaque pion de PNJ ou de
   monstre a les siens (« stats »), la fiche ne sert que de modèle. */
export const isShared = (e) => e.kind === "pc";
export const fighterOf = (t, e) => (t.stats ? { ...e, ...t.stats } : e);

export function newToken(e, tokens) {
  const same = tokens.filter((t) => t.entityId === e.id).length;
  const n = tokens.length;
  return {
    id: uid(),
    entityId: e.id,
    x: 8 + (n % 6) * 9,
    y: clamp(12 + Math.floor(n / 6) * 12, 1, 99),
    size: 1, // en cases : 2 = Grand, 3 = Très grand…
    init: null,
    hidden: false,
    stats: isShared(e)
      ? null
      : {
          name: same ? `${e.name} ${same + 1}` : e.name,
          hp: e.hpMax,
          tempHp: 0,
          conditions: [...e.conditions],
          customConditions: [...(e.customConditions || [])],
          exhaustion: e.exhaustion || 0,
        },
  };
}

/** Dégâts (delta < 0) ou soins (delta > 0) selon les règles 5e :
    les PV temporaires absorbent d'abord, des dégâts à 0 PV = un échec au jet contre la mort. */
export function applyHp(e, delta) {
  let tempHp = e.tempHp || 0;
  let deathSaves = e.deathSaves || { ok: 0, ko: 0 };
  let hp;
  if (delta < 0) {
    const absorbed = Math.min(tempHp, -delta);
    tempHp -= absorbed;
    const dmg = -delta - absorbed;
    if (e.hp === 0 && dmg > 0) deathSaves = { ...deathSaves, ko: Math.min(3, deathSaves.ko + 1) };
    hp = clamp(e.hp - dmg, 0, e.hpMax);
  } else {
    hp = clamp(e.hp + delta, 0, e.hpMax);
    if (hp > 0) deathSaves = { ok: 0, ko: 0 };
  }
  return { hp, tempHp, deathSaves };
}

/** Ordre d'initiative décroissant, égalités départagées par la DEX */
export function sortOrder(tokens, byId) {
  const dex = (t) => mod(byId[t.entityId].abilities?.dex);
  return tokens.filter((t) => byId[t.entityId]).sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || dex(b) - dex(a));
}

/** Passe au combattant suivant ; nouveau round quand on revient en tête */
export function nextTurn(c, byId) {
  const order = sortOrder(c.tokens, byId);
  if (!order.length) return c;
  const i = order.findIndex((t) => t.id === c.activeId);
  const wrapped = c.started && i === order.length - 1;
  return { ...c, started: true, activeId: order[(i + 1) % order.length].id, round: wrapped ? c.round + 1 : c.round };
}

/** Retire un pion ; si c'était son tour, la main passe au suivant */
export function removeToken(c, id, byId) {
  const next = c.started && c.activeId === id ? nextTurn(c, byId) : c;
  return {
    ...next,
    tokens: next.tokens.filter((t) => t.id !== id),
    // Ses effets disparaissent ; ceux qu'il décomptait se décomptent désormais au tour de leur cible
    effects: (next.effects || []).filter((ef) => ef.tokenId !== id).map((ef) => (ef.ownerId === id ? { ...ef, ownerId: ef.tokenId } : ef)),
  };
}

/** Lance les initiatives : monstres et PNJ toujours, PJ seulement s'ils n'en ont pas
    (les joueurs lancent souvent leur dé eux-mêmes). */
export function rollInitiatives(c, byId, rules = "2024", rng = d) {
  const tokens = c.tokens.map((t) => {
    const e = byId[t.entityId];
    if (!e || (isShared(e) && t.init != null)) return t;
    const f = fighterOf(t, e); // l'épuisement d'un monstre est propre à son pion
    return { ...t, init: rng(20) + (e.initBonus ?? mod(e.abilities.dex)) + d20Malus(f, rules) };
  });
  return { ...c, tokens, started: true, round: 1, activeId: sortOrder(tokens, byId)[0]?.id ?? null };
}

export const withLog = (c, msg) => ({ ...c, log: [{ t: Date.now(), msg }, ...c.log].slice(0, 120) });

/** Évalue une formule de dés (« 2d6+1d4+3 », « d20-1 ») ; null si invalide */
export function rollFormula(expr, rng = d) {
  const s = expr.replace(/\s+/g, "").toLowerCase();
  if (!/^[+-]?(\d*d[1-9]\d*|\d+)([+-](\d*d[1-9]\d*|\d+))*$/.test(s)) return null;
  let total = 0;
  const parts = [];
  for (const [, sign, n, faces, k] of s.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)) {
    const m = sign === "-" ? -1 : 1;
    if (faces) {
      const rolls = Array.from({ length: clamp(Number(n || 1), 1, 100) }, () => rng(Number(faces)));
      total += m * rolls.reduce((a, b) => a + b, 0);
      parts.push(`${sign}${rolls.length}d${faces}[${rolls.join(",")}]`);
    } else {
      total += m * Number(k);
      parts.push(sign + k);
    }
  }
  return { total, detail: parts.join(" ") };
}

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

/** Valide et complète une campagne chargée ou importée (anciens formats compris).
    Lève une erreur si ce n'est pas une campagne. */
export function normalizeCampaign(data) {
  if (!data || !Array.isArray(data.entities)) throw new Error("Format de campagne inconnu");
  const entities = data.entities.filter((e) => e && typeof e === "object").map((e) => {
    const base = newEntity(["pc", "npc", "monster"].includes(e.kind) ? e.kind : "monster");
    return {
      ...base,
      ...e,
      kind: base.kind,
      abilities: { ...base.abilities, ...obj(e.abilities) },
      saves: obj(e.saves),
      skills: obj(e.skills),
      deathSaves: { ...base.deathSaves, ...obj(e.deathSaves) },
      conditions: arr(e.conditions),
      customConditions: arr(e.customConditions),
      resources: arr(e.resources),
      money: { ...base.money, ...obj(e.money) },
      items: arr(e.items),
      spells: arr(e.spells),
      slots: obj(e.slots),
      relations: arr(e.relations),
    };
  });
  const byId = Object.fromEntries(entities.map((e) => [e.id, e]));
  const combats = arr(data.combats).filter((c) => c && typeof c === "object").map((c) => {
    const tokens = arr(c.tokens).filter((t) => byId[t?.entityId]).map((t) => {
      const e = byId[t.entityId];
      const tok = { id: uid(), x: 50, y: 50, size: 1, init: null, hidden: false, ...t };
      // Anciennes tailles (en pixels relatifs) → tailles en cases du menu actuel
      tok.size = { 1.15: 1, 1.35: 2, 1.8: 3 }[tok.size] ?? tok.size;
      // Anciens pions de monstre : leurs PV vivaient sur la fiche
      if (!isShared(e) && !tok.stats) {
        tok.stats = { name: e.name, hp: e.hp, tempHp: e.tempHp, conditions: e.conditions, customConditions: e.customConditions, exhaustion: e.exhaustion };
      }
      return tok;
    });
    const fog = obj(c.fog);
    const combat = { ...newCombat(), ...c, tokens, log: arr(c.log), templates: arr(c.templates), effects: arr(c.effects).filter((ef) => tokens.some((t) => t.id === ef.tokenId)), fog: { on: !!fog.on, cells: arr(fog.cells) } };
    // Ancien format : le tour actif était une position dans la liste
    if (combat.started && !tokens.some((t) => t.id === combat.activeId)) {
      combat.activeId = sortOrder(tokens, byId)[(c.turn || 0) % tokens.length]?.id ?? null;
    }
    delete combat.turn;
    return combat;
  });
  const sessions = arr(data.sessions)
    .filter((s) => s && typeof s === "object")
    .map((s) => ({
      ...newSession(),
      ...s,
      present: arr(s.present),
      prep: arr(s.prep),
      scenes: arr(s.scenes)
        .filter((sc) => sc && typeof sc === "object")
        .map((sc) => ({ ...newScene(), ...sc, images: arr(sc.images), entities: arr(sc.entities), places: arr(sc.places), quests: arr(sc.quests) })),
    }));
  const world = arr(data.world)
    .filter((w) => WORLD_TYPES[w?.type])
    .map((w) => ({ ...newWorldItem(w.type), ...w, objectives: arr(w.objectives), residents: arr(w.residents), kind: PLACE_KINDS[w.kind] ? w.kind : "other" }));
  // Règles 2024 par défaut ; 2014 seulement si la campagne l'a choisi
  const s = obj(data.settings);
  // syncId : identifiant commun d'une même campagne sur plusieurs appareils (voyage dans les fichiers)
  const settings = { rules: s.rules === "2014" ? "2014" : "2024", ...(typeof s.syncId === "string" && s.syncId ? { syncId: s.syncId } : {}) };
  return { entities, combats, sessions, world, settings };
}

/** Redimensionne une image en data-URL JPEG et renvoie aussi son ratio hauteur / largeur */
export function resizeImage(file, max, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve({ data: c.toDataURL("image/jpeg", quality), ratio: c.height / c.width });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible"));
    };
    img.src = url;
  });
}
