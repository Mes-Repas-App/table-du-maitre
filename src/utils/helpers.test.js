// Lancer avec : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHp, nextTurn, removeToken, rollInitiatives, rollFormula, normalizeCampaign, profBonus, newEntity, newToken } from "./helpers.js";
import { parseAttack, critFormula, takeDamage, inTemplate, inRevealed, saveMod } from "./helpers.js";
import { fromOpen5e } from "../data/srd.js";
import { spendHitDie, longRest, hitDieOf, tokenInTemplate, tickEffects, encounterDifficulty, crXp, placePath, sessionsMentioning, d20Malus, autoFailsSave } from "./helpers.js";
import { fileNameFor, writeCampaignFile, readCampaignFile, fileSavedAt, changedElsewhere, listCampaignFiles, removeFile, fingerprint, matchCandidates, withoutSync } from "../sync/folder.js";

test("Effets à durée : décompte au tour du lanceur, expiration", () => {
  let c = { activeId: "A", effects: [{ id: "e1", tokenId: "B", ownerId: "A", rounds: 2 }, { id: "e2", tokenId: "A", ownerId: "C", rounds: 1 }] };
  let r = tickEffects(c);
  assert.deepEqual([r.combat.effects.map((e) => e.rounds), r.expired], [[1, 1], []]); // seul e1 (décompté par A) bouge
  r = tickEffects(r.combat);
  assert.deepEqual(r.expired.map((e) => e.id), ["e1"]);
  assert.deepEqual(r.combat.effects.map((e) => e.id), ["e2"]);
});

test("Rencontres : XP par FP et difficulté 2024", () => {
  assert.deepEqual([crXp("1/4"), crXp("FP 5"), crXp("")], [50, 1800, 0]);
  const party = [5, 5, 5, 5]; // budget : 2000 / 3000 / 4400
  assert.deepEqual(encounterDifficulty(party, 1800).budget, [2000, 3000, 4400]);
  assert.deepEqual([1800, 2000, 3500, 4400, 6000].map((xp) => encounterDifficulty(party, xp).level), [-1, 0, 1, 2, 3]);
});

/** Faux dossier (API File System Access) en mémoire */
function fakeDir(initial = {}) {
  const files = new Map(Object.entries(initial)); // nom → texte
  const fileHandle = (name) => ({
    kind: "file",
    getFile: async () => {
      const text = files.get(name);
      const read = async () => (dir.reads++, text);
      return { text: read, slice: (a, b) => ({ text: async () => text.slice(a, b) }), lastModified: 1, size: text.length };
    },
    createWritable: async () => {
      let buf = "";
      return { write: async (s) => (buf += s), close: async () => files.set(name, buf) };
    },
  });
  const dir = {
    files,
    reads: 0, // lectures complètes de fichiers
    getFileHandle: async (name, opts = {}) => {
      if (!files.has(name)) {
        if (!opts.create) throw new Error("NotFoundError");
        files.set(name, "");
      }
      return fileHandle(name);
    },
    removeEntry: async (name) => files.delete(name),
    async *entries() {
      for (const name of files.keys()) yield [name, fileHandle(name)];
    },
  };
  return dir;
}

const campaignData = (who) => ({ entities: [{ ...newEntity("pc"), id: who, name: who }] });

test("Dossier : un fichier par nom de campagne, écrasé à chaque enregistrement", async () => {
  const dir = fakeDir({ "notes.json": '{"pas":"une campagne"}' });
  const f = fileNameFor("Ma campagne");
  assert.equal(f, "Ma campagne.json");
  assert.equal(fileNameFor('Les "Terres" : brisées'), "Les -Terres- - brisées.json"); // caractères interdits
  const t1 = await writeCampaignFile(dir, f, { name: "Ma campagne", data: campaignData("Aria") });
  await new Promise((r) => setTimeout(r, 2));
  const t2 = await writeCampaignFile(dir, f, { name: "Ma campagne", data: campaignData("Aria2") });
  assert.deepEqual([...dir.files.keys()].sort(), ["Ma campagne.json", "notes.json"]); // pas de copie : écrasé
  assert.ok(t2 > t1);
  assert.equal(await fileSavedAt(dir, f), t2); // lu dans le début du fichier
  const r = await readCampaignFile(dir, f);
  assert.equal(r.data.entities[0].name, "Aria2");
  assert.equal(r.print, fingerprint(campaignData("Aria2")));
  assert.equal(await readCampaignFile(dir, "notes.json"), null); // pas une campagne
  assert.equal(await fileSavedAt(dir, "absent.json"), null);
});

test("Dossier : un fichier modifié ailleurs n'est pas écrasé en silence", () => {
  const known = { fileName: "Ma campagne.json", savedAt: 100 };
  assert.equal(changedElsewhere(null, known, "Ma campagne.json"), false); // pas encore de fichier
  assert.equal(changedElsewhere(100, known, "Ma campagne.json"), false); // c'est notre dernière version
  assert.equal(changedElsewhere(150, known, "Ma campagne.json"), true); // réenregistré par un autre appareil
  assert.equal(changedElsewhere(100, undefined, "Ma campagne.json"), true); // jamais lu ici
  assert.equal(changedElsewhere(100, known, "Autre nom.json"), true); // renommée vers un fichier existant
});

test("Dossier : liste des campagnes, fichiers inchangés pas relus", async () => {
  const dir = fakeDir({
    "Tel.json": JSON.stringify({ app: "table-du-maitre", savedAt: 5, name: "Tel", ...campaignData("Cyra") }),
    "image.json": "pas du JSON",
  });
  const cache = new Map();
  const first = await listCampaignFiles(dir, cache);
  assert.deepEqual(first.map((c) => [c.fileName, c.name, c.savedAt, c.counts.entities]), [["Tel.json", "Tel", 5, 1]]);
  const reads = dir.reads;
  await listCampaignFiles(dir, cache);
  assert.equal(dir.reads, reads); // second passage : rien de relu
  dir.files.set("Tel.json", JSON.stringify({ app: "table-du-maitre", savedAt: 9, name: "Tel", ...campaignData("Cyra2") }));
  const again = await listCampaignFiles(dir, cache);
  assert.equal(dir.reads, reads + 1); // modifié (taille différente) : relu
  assert.equal(again[0].savedAt, 9);
  await removeFile(dir, "Tel.json");
  assert.deepEqual(await listCampaignFiles(dir, cache), []);
});

test("Importer : un fichier de la même campagne est proposé en mise à jour", () => {
  const withSync = (who, syncId) => ({ ...campaignData(who), settings: { rules: "2024", syncId } });
  // L'identifiant commun survit à la normalisation mais pas à l'empreinte (même contenu = identique)
  assert.equal(normalizeCampaign(withSync("A", "S1")).settings.syncId, "S1");
  assert.equal(fingerprint(withSync("A", "S1")), fingerprint(withSync("A", "S2")));
  const files = [
    { fileName: "a.json", name: "Terres (renommée)", syncId: "S1" },
    { fileName: "b.json", name: "Ma campagne", syncId: "S5" },
    { fileName: "c.json", name: "Autre", syncId: null },
  ];
  const locals = [
    { id: "loc1", name: "Terres", syncId: "S1" },
    { id: "loc2", name: "Ma campagne (importée)", syncId: "S9" },
  ];
  const m = Object.fromEntries(matchCandidates(files, locals).map((c) => [c.fileName, c]));
  assert.deepEqual([m["a.json"].target, m["a.json"].sure], ["loc1", true]); // même syncId, malgré un autre nom
  assert.deepEqual([m["b.json"].target, m["b.json"].sure], ["loc2", false]); // même nom seulement : jamais d'office
  assert.equal(m["c.json"].target, undefined);
  assert.equal(matchCandidates([files[1]], [{ id: "v", name: "Ma campagne", empty: true }])[0].sure, true); // campagne vide d'ici
  assert.equal(normalizeCampaign(withoutSync(withSync("A", "S1"))).settings.syncId, undefined);
});


test("Dés de vie et repos long selon les règles 2014 / 2024", () => {
  const guerrier = { clazz: "Guerrier", level: 6, hp: 10, hpMax: 50, tempHp: 0, abilities: { con: 14 }, hdUsed: 5 };
  assert.equal(hitDieOf(guerrier), 10);
  const r = spendHitDie(guerrier, () => 7); // 7 + CON 2
  assert.deepEqual([r.heal, r.patch.hp, r.patch.hdUsed], [9, 19, 6]);
  assert.equal(spendHitDie({ ...guerrier, abilities: { con: 3 } }, () => 1).heal, 0); // jamais négatif
  assert.equal(longRest(guerrier, "2014").hdUsed, 2); // récupère la moitié (3)
  assert.equal(longRest(guerrier, "2024").hdUsed, 0); // récupère tout
  assert.equal(longRest({ ...guerrier, slots: { 1: { cur: 0, max: 3 } } }).slots[1].cur, 3);
});

test("Gabarit : un grand pion est touché par le bord de son espace", () => {
  const c = { gridCols: 20, mapRatio: 1 };
  const sphere = { shape: "sphere", x: 10, y: 10, size: 3 }; // 2 cases de rayon
  const loin = { x: 65, y: 50 }; // centre à 3 cases du centre de la sphère
  assert.ok(!tokenInTemplate(sphere, { ...loin, size: 1 }, c));
  assert.ok(tokenInTemplate(sphere, { ...loin, size: 3 }, c)); // pion très grand (3×3)
});

test("Lieux : chemin depuis la racine, résistant aux boucles, et anciens lieux complétés", () => {
  const world = [
    { id: "r", type: "place", name: "Val-Brume", parentId: null },
    { id: "m", type: "place", name: "Le moulin", parentId: "r" },
    { id: "c", type: "place", name: "Cave", parentId: "m" },
    { id: "x", type: "place", name: "Boucle A", parentId: "y" },
    { id: "y", type: "place", name: "Boucle B", parentId: "x" },
  ];
  assert.deepEqual(placePath(world, "c").map((p) => p.name), ["Val-Brume", "Le moulin", "Cave"]);
  assert.equal(placePath(world, "x").length, 2); // pas de boucle infinie
  const [old] = normalizeCampaign({ entities: [], world: [{ id: "o", type: "place", name: "Ancien" }] }).world;
  assert.deepEqual([old.kind, old.residents], ["other", []]);
});

test("Sessions : scènes complétées et liens retour vers fiches, lieux et quêtes", () => {
  const { sessions } = normalizeCampaign({
    entities: [],
    sessions: [
      { id: "s1", date: "2026-01-01", present: ["aria"], prep: [{ id: "x", kind: "npc", text: "Garrick", refId: "garrick" }] },
      { id: "s2", date: "2026-02-01", scenes: [{ id: "a", title: "Le moulin", places: ["moulin"], entities: ["garrick"] }, { title: "Ancienne scène sans tableaux" }] },
    ],
  });
  assert.deepEqual(sessions[1].scenes[1].images, []); // champs manquants complétés
  assert.deepEqual(sessions[0].scenes, []); // ancienne session sans déroulé
  assert.deepEqual(sessionsMentioning(sessions, "garrick").map((s) => s.id), ["s2", "s1"]); // plus récente d'abord
  assert.deepEqual(sessionsMentioning(sessions, "moulin").map((s) => s.id), ["s2"]);
  assert.deepEqual(sessionsMentioning(sessions, "aria").map((s) => s.id), ["s1"]);
});

test("Import : anciennes tailles de pion et règles par défaut", () => {
  const e = { ...newEntity("monster"), id: "m" };
  const { combats, settings } = normalizeCampaign({ entities: [e], combats: [{ tokens: [{ entityId: "m", size: 1.35 }] }] });
  assert.equal(combats[0].tokens[0].size, 2);
  assert.equal(settings.rules, "2024");
  assert.equal(normalizeCampaign({ entities: [], settings: { rules: "2014" } }).settings.rules, "2014");
});

test("Attaques : lecture des lignes et critique", () => {
  assert.deepEqual(parseAttack("Épée longue : +5, 1d8+3 tranchant"), { name: "Épée longue", bonus: 5, damage: "1d8+3" });
  assert.deepEqual(parseAttack("Morsure : +4 au toucher. Touché : 7 (2d6 + 1) perforant"), { name: "Morsure", bonus: 4, damage: "2d6+1" });
  assert.equal(parseAttack("Vision dans le noir"), null);
  assert.equal(critFormula("1d8+2d6+3"), "2d8+4d6+3");
});

test("Dégâts : concentration (DD ou perte à 0 PV)", () => {
  const mage = { name: "Mage", hp: 30, hpMax: 30, tempHp: 0, conditions: ["concentration"] };
  assert.match(takeDamage(mage, 24).notes[0], /DD 12/);
  const ko = takeDamage(mage, 40);
  assert.deepEqual([ko.patch.hp, ko.patch.conditions], [0, []]);
  assert.equal(saveMod({ kind: "pc", level: 5, abilities: { dex: 14 }, saves: { dex: 1 } }, "dex"), 5);
});

test("Gabarits et brouillard", () => {
  const sphere = { shape: "sphere", x: 10, y: 10, size: 6 }; // 4 cases de rayon
  assert.ok(inTemplate(sphere, { x: 13, y: 10 }));
  assert.ok(!inTemplate(sphere, { x: 15, y: 10 }));
  const cone = { shape: "cone", x: 0, y: 0, angle: 0, size: 9 }; // 6 cases vers la droite
  assert.ok(inTemplate(cone, { x: 5, y: 2 }));
  assert.ok(!inTemplate(cone, { x: 5, y: 4 }));
  assert.ok(!inTemplate(cone, { x: -2, y: 0 }));
  const c = { gridCols: 20, mapRatio: 0.5, fog: { on: true, cells: ["2,1"] } };
  assert.ok(inRevealed({ x: 12.5, y: 15 }, c)); // case 2,1
  assert.ok(!inRevealed({ x: 50, y: 50 }, c));
});

test("Bestiaire SRD : conversion d'une créature Open5e", () => {
  const g = fromOpen5e({ name: "Goblin", size: "Small", type: "Humanoid", armor_class: 15, hit_points: 7, speed: { walk: 30 }, dexterity: 14, challenge_rating: "1/4", skills: { stealth: 6 }, actions: [{ name: "Scimitar", desc: "…", attack_bonus: 4, damage_dice: "1d6", damage_bonus: 2 }] });
  assert.deepEqual([g.kind, g.hp, g.ac, g.speed, g.cr, g.skills.discretion], ["monster", 7, 15, 9, "1/4", 1]);
  assert.deepEqual(parseAttack(g.attacks), { name: "Scimitar", bonus: 4, damage: "1d6+2" });
});

test("PV : les temporaires absorbent, dégâts à 0 PV = échec, soin remet les jets à zéro", () => {
  assert.deepEqual(applyHp({ hp: 10, hpMax: 10, tempHp: 4 }, -6), { hp: 8, tempHp: 0, deathSaves: { ok: 0, ko: 0 } });
  const down = applyHp({ hp: 0, hpMax: 10, tempHp: 0, deathSaves: { ok: 1, ko: 0 } }, -3);
  assert.equal(down.deathSaves.ko, 1);
  assert.deepEqual(applyHp({ ...down, hpMax: 10 }, 5).deathSaves, { ok: 0, ko: 0 });
});

test("Tours : le tour actif suit le combattant, pas sa position", () => {
  const byId = { a: { abilities: { dex: 10 } }, b: { abilities: { dex: 18 } }, c: { abilities: { dex: 10 } } };
  const tokens = [
    { id: "A", entityId: "a", init: 15 },
    { id: "B", entityId: "b", init: 12 },
    { id: "C", entityId: "c", init: 12 },
  ];
  let c = { tokens, started: true, round: 1, activeId: "B" };
  c = nextTurn(c, byId); // égalité B/C départagée par la DEX : B avant C
  assert.equal(c.activeId, "C");
  c = nextTurn(c, byId);
  assert.deepEqual([c.activeId, c.round], ["A", 2]);
  c = removeToken({ ...c, activeId: "B" }, "A", byId); // retirer A ne déplace pas le tour de B
  assert.equal(c.activeId, "B");
  c = removeToken(c, "B", byId); // retirer l'actif passe la main au suivant
  assert.equal(c.activeId, "C");
});

test("Initiatives : on garde celle déjà saisie par un joueur", () => {
  const byId = { p: { kind: "pc", abilities: { dex: 10 } }, m: { kind: "monster", abilities: { dex: 10 } } };
  const c = rollInitiatives({ tokens: [{ id: "P", entityId: "p", init: 25 }, { id: "M", entityId: "m", init: null }] }, byId);
  assert.equal(c.tokens[0].init, 25);
  assert.ok(c.tokens[1].init >= 1 && c.tokens[1].init <= 20);
  assert.equal(c.activeId, "P");
});

test("Formules de dés", () => {
  const r = rollFormula("2d6 + 3 - d4", (f) => f); // dé truqué : renvoie toujours le max
  assert.equal(r.total, 6 + 6 + 3 - 4);
  assert.equal(rollFormula("2d0"), null);
  assert.equal(rollFormula("bonjour"), null);
});

test("Maîtrise selon niveau ou FP", () => {
  assert.equal(profBonus({ kind: "pc", level: 5 }), 3);
  assert.equal(profBonus({ kind: "monster", cr: "FP 1/2" }), 2);
  assert.equal(profBonus({ kind: "monster", cr: "13" }), 5);
});

test("Import : ancien format complété, fichier invalide refusé", () => {
  const gob = { ...newEntity("monster"), id: "g", hp: 3, conditions: undefined };
  const old = { entities: [gob], combats: [{ id: "c", started: true, turn: 0, tokens: [{ entityId: "g", x: 1, y: 1 }, { entityId: "disparu" }] }] };
  const { entities, combats } = normalizeCampaign(old);
  assert.deepEqual(entities[0].conditions, []);
  const [tok] = combats[0].tokens;
  assert.equal(combats[0].tokens.length, 1);
  assert.equal(tok.stats.hp, 3);
  assert.equal(combats[0].activeId, tok.id);
  assert.throws(() => normalizeCampaign({ foo: 1 }));
});

test("Pions de monstre : PV propres et noms numérotés", () => {
  const gob = { ...newEntity("monster"), name: "Gobelin", hpMax: 7, hp: 2 };
  const t1 = newToken(gob, []);
  const t2 = newToken(gob, [t1]);
  assert.deepEqual([t1.stats.name, t2.stats.name, t2.stats.hp], ["Gobelin", "Gobelin 2", 7]);
  assert.equal(newToken(newEntity("pc"), []).stats, null);
});

test("Épuisement 2024 sur les d20 et JS ratés d'office", () => {
  const e = { ...newEntity("monster"), id: "m", exhaustion: 2, abilities: { ...newEntity("monster").abilities, dex: 14 } };
  assert.equal(d20Malus(e, "2024"), -4);
  assert.equal(d20Malus(e, "2014"), 0); // 2014 : désavantages par palier, pas de malus chiffré
  assert.equal(autoFailsSave({ conditions: ["paralyse"] }, "dex"), true);
  assert.equal(autoFailsSave({ conditions: ["paralyse"] }, "sag"), false);
  assert.equal(autoFailsSave({ conditions: ["aterre"] }, "dex"), false);
  // Initiative : épuisement propre au pion du monstre
  const t = { ...newToken(e, []), stats: { ...newToken(e, []).stats, exhaustion: 3 } };
  const c = rollInitiatives({ tokens: [t] }, { m: e }, "2024", () => 10);
  assert.equal(c.tokens[0].init, 10 + 2 - 6);
});
