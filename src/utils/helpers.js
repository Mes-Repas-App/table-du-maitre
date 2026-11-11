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
  let x = Number(e.level) || 1;
  if (e.kind === "monster") {
    const [a, b] = String(e.cr || "").replace(",", ".").replace(/[^\d./]/g, "").split("/");
    x = b ? a / b : Number(a) || 0;
  }
  return Math.max(2, Math.ceil(x / 4) + 1);
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
  };
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
    prep: [], // { id, kind: "scene" | "secret" | "npc" | "place", text, done }
  };
}

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
    parentId: null, // lieux : lieu parent
  };
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

/** Le pion est-il dans une zone révélée du brouillard ? */
export function inRevealed(t, c) {
  if (!c.fog?.on) return true;
  const { x, y } = tokenCell(t, c);
  return c.fog.cells.includes(`${Math.floor(x)},${Math.floor(y)}`);
}

/* ---------- Règles ---------- */

/** Modificateur de jet de sauvegarde (maîtrise comprise) */
export const saveMod = (e, ab) => mod(e.abilities?.[ab]) + (e.saves?.[ab] ? profBonus(e) : 0);

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

/** Dégâts + conséquences : concentration perdue à 0 PV, sinon DD du JS de concentration */
export function takeDamage(e, dmg) {
  const patch = applyHp(e, -dmg);
  const notes = [];
  if (dmg > 0 && e.conditions.includes("concentration")) {
    if (patch.hp === 0) {
      patch.conditions = e.conditions.filter((c) => c !== "concentration");
      notes.push(`${e.name} tombe et perd sa concentration`);
    } else {
      notes.push(`${e.name} : JS de Constitution DD ${Math.max(10, Math.floor(dmg / 2))} pour garder sa concentration`);
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
  return { ...next, tokens: next.tokens.filter((t) => t.id !== id) };
}

/** Lance les initiatives : monstres et PNJ toujours, PJ seulement s'ils n'en ont pas
    (les joueurs lancent souvent leur dé eux-mêmes). */
export function rollInitiatives(c, byId) {
  const tokens = c.tokens.map((t) => {
    const e = byId[t.entityId];
    if (!e || (isShared(e) && t.init != null)) return t;
    return { ...t, init: d(20) + (e.initBonus ?? mod(e.abilities.dex)) };
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
      // Anciens pions de monstre : leurs PV vivaient sur la fiche
      if (!isShared(e) && !tok.stats) {
        tok.stats = { name: e.name, hp: e.hp, tempHp: e.tempHp, conditions: e.conditions, customConditions: e.customConditions, exhaustion: e.exhaustion };
      }
      return tok;
    });
    const fog = obj(c.fog);
    const combat = { ...newCombat(), ...c, tokens, log: arr(c.log), templates: arr(c.templates), fog: { on: !!fog.on, cells: arr(fog.cells) } };
    // Ancien format : le tour actif était une position dans la liste
    if (combat.started && !tokens.some((t) => t.id === combat.activeId)) {
      combat.activeId = sortOrder(tokens, byId)[(c.turn || 0) % tokens.length]?.id ?? null;
    }
    delete combat.turn;
    return combat;
  });
  const sessions = arr(data.sessions)
    .filter((s) => s && typeof s === "object")
    .map((s) => ({ ...newSession(), ...s, present: arr(s.present), prep: arr(s.prep) }));
  const world = arr(data.world)
    .filter((w) => WORLD_TYPES[w?.type])
    .map((w) => ({ ...newWorldItem(w.type), ...w, objectives: arr(w.objectives) }));
  return { entities, combats, sessions, world };
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
