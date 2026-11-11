import { newEntity, mod, fmtMod } from "../utils/helpers.js";

/* Bestiaires du SRD (Wizards of the Coast, licence CC-BY-4.0) via l'API publique Open5e :
   SRD 5.2 pour les règles 2024, SRD 5.1 pour les règles 2014.
   Les textes du SRD sont en anglais : seuls les noms de champs sont traduits. */
export const SRD = {
  2024: {
    search: (q) => `https://api.open5e.com/v2/creatures/?document__key=srd-2024&limit=20&name__icontains=${encodeURIComponent(q)}`,
    credit: "Contenu issu du SRD 5.2 (règles 2024) de Wizards of the Coast, sous licence CC-BY-4.0 (via Open5e).",
    convert: (m) => fromOpen5eV2(m),
  },
  2014: {
    search: (q) => `https://api.open5e.com/v1/monsters/?document__slug=wotc-srd&limit=20&search=${encodeURIComponent(q)}`,
    credit: "Contenu issu du SRD 5.1 (règles 2014) de Wizards of the Coast, sous licence CC-BY-4.0 (via Open5e).",
    convert: (m) => fromOpen5e(m),
  },
};
const SRD_CREDIT = SRD[2014].credit;

/** FP lisible : 0.25 → « 1/4 » */
export const fmtCr = (cr) => ({ 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" })[cr] ?? String(cr ?? "");

/** Résumé d'une créature des deux formats, pour la liste de résultats */
export const srdSummary = (m) => ({
  key: m.key || m.slug || m.name,
  name: m.name,
  line: `FP ${fmtCr(m.challenge_rating)} · ${m.size?.name ?? m.size} ${m.type?.name ?? m.type} · CA ${m.armor_class} · ${m.hit_points} PV`,
});

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

const ACTION_GROUPS = [
  ["BONUS_ACTION", "Actions bonus"],
  ["REACTION", "Réactions"],
  ["LEGENDARY_ACTION", "Actions légendaires"],
];

/** Convertit une créature du SRD 5.2 (API Open5e v2, règles 2024) en fiche de monstre */
export function fromOpen5eV2(m) {
  const e = newEntity("monster");
  const abilities = Object.fromEntries(Object.entries(AB).map(([en, fr]) => [fr, m.ability_scores?.[en] ?? 10]));
  // Maîtrise d'un JS : bonus de sauvegarde supérieur au simple modificateur
  const saves = Object.fromEntries(Object.entries(AB).filter(([en]) => (m.saving_throws?.[en] ?? 0) > (m.modifiers?.[en] ?? 0)).map(([, fr]) => [fr, 1]));
  const skills = Object.fromEntries(Object.keys(m.skill_bonuses || {}).filter((k) => SKILL[k]).map((k) => [SKILL[k], 1]));
  const ri = m.resistances_and_immunities || {};
  const actions = m.actions || [];
  const attackLine = (a) => {
    const x = a.attacks?.[0];
    const dice = x?.damage_die_count ? `${x.damage_die_count}d${String(x.damage_die_type).replace(/^d/i, "")}${x.damage_bonus ? fmtMod(x.damage_bonus) : ""}` : "";
    const head = [x?.to_hit_mod != null ? fmtMod(x.to_hit_mod) : "", dice].filter(Boolean).join(", ");
    return `${a.name}${head ? ` : ${head}` : ""} — ${a.desc}`;
  };
  const senses = [m.darkvision_range && `darkvision ${m.darkvision_range} ft.`, m.blindsight_range && `blindsight ${m.blindsight_range} ft.`, m.tremorsense_range && `tremorsense ${m.tremorsense_range} ft.`, m.truesight_range && `truesight ${m.truesight_range} ft.`, m.passive_perception && `passive Perception ${m.passive_perception}`].filter(Boolean).join(", ");
  return {
    ...e,
    name: m.name,
    race: [m.size?.name, m.type?.name].filter(Boolean).join(" "),
    cr: fmtCr(m.challenge_rating),
    abilities,
    saves,
    skills,
    hitDie: Number(String(m.hit_dice || "").split("d")[1]) || null,
    hpMax: m.hit_points ?? 10,
    hp: m.hit_points ?? 10,
    ac: m.armor_class ?? 10,
    speed: Math.round((m.speed?.walk ?? 30) * 0.3 * 2) / 2, // 30 ft = 9 m
    initBonus: m.initiative_bonus ?? mod(abilities.dex),
    senses,
    languages: m.languages?.as_string || "",
    resistances: ri.damage_resistances_display || "",
    immunities: [ri.damage_immunities_display, ri.condition_immunities_display && `États : ${ri.condition_immunities_display}`].filter(Boolean).join(" · "),
    vulnerabilities: ri.damage_vulnerabilities_display || "",
    attacks: actions.filter((a) => !a.action_type || a.action_type === "ACTION").map(attackLine).join("\n"),
    notes: [
      `${m.hit_dice ? `PV : ${m.hit_dice}. ` : ""}${m.armor_detail ? `CA : ${m.armor_detail}. ` : ""}${m.alignment || ""}`,
      block("Capacités", m.traits),
      ...ACTION_GROUPS.map(([type, title]) => block(title, actions.filter((a) => a.action_type === type))),
      SRD[2024].credit,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

/** Convertit une créature du SRD 5.1 (API Open5e v1, règles 2014) en fiche de monstre */
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
    hitDie: Number(String(m.hit_dice || "").split("d")[1]) || null,
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
