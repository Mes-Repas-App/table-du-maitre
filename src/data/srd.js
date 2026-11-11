import { newEntity, mod, fmtMod } from "../utils/helpers.js";

/* Bestiaire du SRD 5.1 (Wizards of the Coast, licence CC-BY-4.0) via l'API publique Open5e.
   Les textes du SRD sont en anglais : seuls les noms de champs sont traduits. */
export const SRD_SEARCH = "https://api.open5e.com/v1/monsters/?document__slug=wotc-srd&limit=20&search=";
export const SRD_CREDIT = "Contenu issu du SRD 5.1 de Wizards of the Coast, sous licence CC-BY-4.0 (via Open5e).";

const AB = { strength: "for", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "sag", charisma: "cha" };
const SKILL = {
  acrobatics: "acrobaties", arcana: "arcanes", athletics: "athletisme", stealth: "discretion",
  "animal handling": "dressage", animal_handling: "dressage", "sleight of hand": "escamotage", sleight_of_hand: "escamotage",
  history: "histoire", intimidation: "intimidation", insight: "intuition", investigation: "investigation",
  medicine: "medecine", nature: "nature", perception: "perception", persuasion: "persuasion",
  religion: "religion", performance: "representation", survival: "survie", deception: "tromperie",
};

/** Ligne d'attaque lisible par les boutons du combat : « Nom : +4, 1d6+2 — description » */
function actionLine(a) {
  const dice = a.damage_dice ? `${a.damage_dice}${a.damage_bonus ? fmtMod(a.damage_bonus) : ""}` : "";
  const head = [a.attack_bonus != null ? fmtMod(a.attack_bonus) : "", dice].filter(Boolean).join(", ");
  return `${a.name}${head ? ` : ${head}` : ""} — ${a.desc}`;
}

const block = (title, list) => (list?.length ? `${title}\n${list.map((a) => `• ${a.name}. ${a.desc}`).join("\n")}` : "");

/** Convertit une créature Open5e en fiche de monstre */
export function fromOpen5e(m) {
  const e = newEntity("monster");
  const abilities = Object.fromEntries(Object.entries(AB).map(([en, fr]) => [fr, m[en] ?? 10]));
  const saves = Object.fromEntries(Object.entries(AB).filter(([en]) => m[`${en}_save`] != null).map(([, fr]) => [fr, 1]));
  const skills = Object.fromEntries(
    Object.keys(m.skills || {}).filter((k) => SKILL[k.toLowerCase()]).map((k) => [SKILL[k.toLowerCase()], 1])
  );
  const feet = m.speed?.walk ?? 30;
  return {
    ...e,
    name: m.name,
    race: [m.size, m.type, m.subtype && `(${m.subtype})`].filter(Boolean).join(" "),
    cr: String(m.challenge_rating ?? ""),
    abilities,
    saves,
    skills,
    hpMax: m.hit_points ?? 10,
    hp: m.hit_points ?? 10,
    ac: m.armor_class ?? 10,
    speed: Math.round(feet * 0.3 * 2) / 2, // 30 ft = 9 m
    initBonus: mod(abilities.dex),
    senses: m.senses || "",
    languages: m.languages || "",
    resistances: m.damage_resistances || "",
    immunities: [m.damage_immunities, m.condition_immunities && `États : ${m.condition_immunities}`].filter(Boolean).join(" · "),
    vulnerabilities: m.damage_vulnerabilities || "",
    attacks: (m.actions || []).map(actionLine).join("\n"),
    notes: [
      `${m.hit_dice ? `PV : ${m.hit_dice}. ` : ""}${m.armor_desc ? `CA : ${m.armor_desc}. ` : ""}${m.alignment || ""}`,
      block("Capacités", m.special_abilities),
      block("Réactions", m.reactions),
      block(`Actions légendaires${m.legendary_desc ? ` — ${m.legendary_desc}` : ""}`, m.legendary_actions),
      SRD_CREDIT,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}
