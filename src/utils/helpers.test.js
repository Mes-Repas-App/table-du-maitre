// Lancer avec : npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHp, nextTurn, removeToken, rollInitiatives, rollFormula, normalizeCampaign, profBonus, newEntity, newToken } from "./helpers.js";
import { parseAttack, critFormula, takeDamage, inTemplate, inRevealed, saveMod } from "./helpers.js";
import { fromOpen5e } from "../data/srd.js";
import { spendHitDie, longRest, hitDieOf, tokenInTemplate, tickEffects, encounterDifficulty, crXp } from "./helpers.js";
import { syncCampaigns } from "../sync/syncCampaigns.js";

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

/** Faux Google Drive en mémoire */
function fakeDrive() {
  const files = new Map();
  let n = 0;
  return {
    files,
    list: async () => [...files.entries()].map(([id, f]) => ({ id, appProperties: f.meta.appProperties })),
    download: async (id) => structuredClone(files.get(id).content),
    upload: async (id, meta, content) => {
      const key = id || `f${++n}`;
      files.set(key, { meta, content: structuredClone(content) });
      return key;
    },
    remove: async (id) => files.delete(id),
  };
}

/** Faux appareil : ses campagnes locales et les fonctions attendues par syncCampaigns */
function device(campaigns) {
  const d = { campaigns, deleted: [] };
  d.sync = (drive) =>
    syncCampaigns({
      drive,
      local: { list: d.campaigns.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })), deleted: d.deleted },
      read: async (id) => d.campaigns.find((c) => c.id === id)?.data,
      apply: async (id, name, data, updatedAt) => {
        d.campaigns = [...d.campaigns.filter((c) => c.id !== id), { id, name, data, updatedAt }];
      },
      remove: async (id) => {
        d.campaigns = d.campaigns.filter((c) => c.id !== id);
      },
    });
  return d;
}

test("Synchro : l'ordinateur envoie, le téléphone récupère sans écraser avec sa campagne vide", async () => {
  const drive = fakeDrive();
  const pc = device([{ id: "courante", name: "Ma campagne", updatedAt: 100, data: { entities: ["Aria"] } }]);
  const phone = device([{ id: "courante", name: "Ma campagne", updatedAt: 0, data: { entities: [] } }]); // jamais modifiée
  assert.deepEqual((await pc.sync(drive)).up, ["courante"]);
  assert.deepEqual((await phone.sync(drive)).down, ["courante"]);
  assert.deepEqual(phone.campaigns[0].data.entities, ["Aria"]);
});

test("Synchro : la modification la plus récente gagne, dans les deux sens", async () => {
  const drive = fakeDrive();
  const pc = device([{ id: "c", name: "C", updatedAt: 100, data: { v: 1 } }]);
  const phone = device([]);
  await pc.sync(drive);
  await phone.sync(drive);
  phone.campaigns[0] = { ...phone.campaigns[0], updatedAt: 200, data: { v: 2 } }; // modif sur le téléphone
  assert.deepEqual((await phone.sync(drive)).up, ["c"]);
  assert.deepEqual((await pc.sync(drive)).down, ["c"]);
  assert.equal(pc.campaigns[0].data.v, 2);
  assert.deepEqual(await pc.sync(drive), { up: [], down: [], removed: [], deleted: [] }); // rien à faire
});

test("Synchro : une campagne supprimée sur un appareil disparaît partout", async () => {
  const drive = fakeDrive();
  const pc = device([{ id: "a", name: "A", updatedAt: 1, data: {} }, { id: "b", name: "B", updatedAt: 1, data: {} }]);
  const phone = device([]);
  await pc.sync(drive);
  await phone.sync(drive);
  pc.campaigns = pc.campaigns.filter((c) => c.id !== "b");
  pc.deleted = ["b"];
  await pc.sync(drive);
  assert.deepEqual((await phone.sync(drive)).removed, ["b"]);
  assert.deepEqual(phone.campaigns.map((c) => c.id), ["a"]);
  assert.ok(![...drive.files.values()].some((f) => f.meta.appProperties?.campaignId === "b"));
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
