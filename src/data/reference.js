import { Users, Ghost, Skull } from "lucide-react";

/* États officiels D&D 5e (+ quelques effets de sorts courants), en français.
   La description s'affiche au survol dans toute l'application. */
export const CONDITIONS = [
  { id: "aveugle", label: "Aveuglé", icon: "🕶️", desc: "Échoue automatiquement aux tests basés sur la vue. Les jets d'attaque contre lui ont l'avantage, les siens ont le désavantage." },
  { id: "charme", label: "Charmé", icon: "💘", desc: "Ne peut pas attaquer le charmeur ni le cibler avec des capacités nuisibles. Le charmeur a l'avantage aux interactions sociales avec lui." },
  { id: "assourdi", label: "Assourdi", icon: "🔇", desc: "N'entend plus rien et échoue automatiquement à tout test de caractéristique basé sur l'ouïe." },
  { id: "effraye", label: "Effrayé", icon: "😱", desc: "Désavantage aux tests de caractéristique et aux jets d'attaque tant que la source de sa peur est dans son champ de vision. Ne peut pas s'approcher volontairement de la source." },
  {
    id: "agrippe", label: "Agrippé", icon: "✊",
    desc: "Vitesse réduite à 0, sans bénéfice de bonus de vitesse. L'état prend fin si l'agrippeur est neutralisé ou si la cible est éloignée de sa portée.",
    desc2024: "Vitesse 0. Désavantage aux jets d'attaque contre toute autre cible que l'agrippeur, qui peut le déplacer avec lui. S'échapper : action, test de Force (Athlétisme) ou Dextérité (Acrobaties) contre le DD.",
  },
  {
    id: "neutralise", label: "Neutralisé", icon: "💫",
    desc: "Ne peut effectuer aucune action ni réaction.",
    desc2024: "Aucune action, action bonus ni réaction. Perd sa concentration et ne peut pas parler. Désavantage à l'initiative s'il est neutralisé au moment de la lancer.",
  },
  {
    id: "invisible", label: "Invisible", icon: "👻",
    desc: "Impossible à voir sans magie ou sens spécial. Les jets d'attaque contre lui ont le désavantage, les siens ont l'avantage.",
    desc2024: "Avantage à l'initiative. Insensible aux effets qui exigent de le voir. Les attaques contre lui ont le désavantage, les siennes l'avantage — sauf face à qui peut le voir.",
  },
  { id: "paralyse", label: "Paralysé", icon: "🧊", desc: "Neutralisé, ne peut ni bouger ni parler. Échoue aux JS de Force et Dextérité. Les attaques contre lui ont l'avantage ; tout coup porté à 1,50 m ou moins est un critique." },
  { id: "petrifie", label: "Pétrifié", icon: "🗿", desc: "Transformé en pierre : neutralisé, ne bouge plus, poids ×10. Résistance à tous les dégâts, immunisé au poison et aux maladies. Attaques contre lui avantagées." },
  { id: "empoisonne", label: "Empoisonné", icon: "🤢", desc: "Désavantage aux jets d'attaque et aux tests de caractéristique." },
  { id: "aterre", label: "À terre", icon: "🛌", desc: "Ne peut que ramper. Ses attaques ont le désavantage. Les attaques contre lui ont l'avantage à 1,50 m ou moins, sinon le désavantage. Se relever coûte la moitié de la vitesse." },
  { id: "entrave", label: "Entravé", icon: "⛓️", desc: "Vitesse réduite à 0. Les attaques contre lui ont l'avantage, les siennes ont le désavantage. Désavantage aux JS de Dextérité." },
  {
    id: "etourdi", label: "Étourdi", icon: "🌀",
    desc: "Neutralisé, ne peut pas bouger et parle de façon hésitante. Échoue aux JS de Force et Dextérité. Les attaques contre lui ont l'avantage.",
    desc2024: "Neutralisé (donc perd sa concentration). Échoue aux JS de Force et Dextérité. Les attaques contre lui ont l'avantage.",
  },
  { id: "inconscient", label: "Inconscient", icon: "😵", desc: "Neutralisé, lâche ce qu'il tient et tombe à terre. Échoue aux JS de Force et Dextérité. Attaques contre lui avantagées ; tout coup à 1,50 m ou moins est un critique." },
  {
    id: "concentration", label: "Concentration", icon: "🧠",
    desc: "Maintient un sort de concentration. En cas de dégâts : JS de Constitution DD 10 ou moitié des dégâts (le plus élevé) pour ne pas perdre le sort.",
    desc2024: "Maintient un sort de concentration. En cas de dégâts : JS de Constitution DD 10 ou moitié des dégâts (le plus élevé, 30 au maximum). Prend fin si neutralisé ou mort.",
  },
  { id: "beni", label: "Béni", icon: "✨", desc: "Sort Bénédiction : ajoute 1d4 à ses jets d'attaque et jets de sauvegarde." },
  { id: "hate", label: "Hâte", icon: "💨", desc: "Vitesse doublée, +2 à la CA, avantage aux JS de Dextérité, une action supplémentaire limitée par tour. À la fin du sort : ne peut ni bouger ni agir pendant 1 tour." },
  { id: "ralenti", label: "Ralenti", icon: "🐌", desc: "Sort Lenteur : vitesse divisée par deux, -2 à la CA et aux JS de Dextérité, une seule action OU action bonus par tour, pas de réaction." },
  { id: "maudit", label: "Maudit", icon: "🕯️", desc: "Sous l'effet d'une malédiction. Voir les notes du personnage pour l'effet exact." },
];

const EXHAUSTION_2014 = [
  "",
  "Niv. 1 — Désavantage aux tests de caractéristique.",
  "Niv. 2 — Vitesse divisée par deux (+ niv. 1).",
  "Niv. 3 — Désavantage aux jets d'attaque et de sauvegarde (+ niv. 1-2).",
  "Niv. 4 — Points de vie maximum divisés par deux (+ niv. 1-3).",
  "Niv. 5 — Vitesse réduite à 0 (+ niv. 1-4).",
  "Niv. 6 — Mort.",
];

/** Règle d'un état selon l'édition choisie pour la campagne */
export const conditionDesc = (c, rules) => (rules === "2024" && c.desc2024) || c.desc;

/** Effet du niveau d'épuisement : 2014 par paliers, 2024 cumulatif (−2 par niveau aux d20) */
export function exhaustionDesc(n, rules) {
  if (!n) return "Aucun niveau d'épuisement.";
  if (rules !== "2024") return EXHAUSTION_2014[n];
  if (n >= 6) return "Niv. 6 — Mort.";
  return `Niv. ${n} — −${2 * n} à tous les tests d20 (attaques, tests, JS), vitesse −${(1.5 * n).toLocaleString("fr-FR")} m. Un repos long retire un niveau.`;
}

/* Dés de vie proposés sur la fiche */
export const HIT_DICE = [6, 8, 10, 12];

/* Listes de suggestions : la saisie reste libre, ajoutez ici vos propres
   races et historiques de campagne. */
// Espèces et historiques du Manuel des joueurs 2024 d'abord, puis ceux de 2014
export const RACES = ["Aasimar", "Drakéide", "Elfe", "Gnome", "Goliath", "Halfelin", "Humain", "Nain", "Orc", "Tieffelin", "Haut-Elfe", "Elfe des bois", "Drow", "Demi-Elfe", "Demi-Orc"];
export const CLASSES = ["Barbare", "Barde", "Clerc", "Druide", "Ensorceleur", "Guerrier", "Magicien", "Moine", "Occultiste", "Paladin", "Rôdeur", "Roublard"];
export const BACKGROUNDS = ["Acolyte", "Artisan", "Artiste", "Charlatan", "Criminel", "Ermite", "Fermier", "Garde", "Guide", "Marchand", "Marin", "Noble", "Sage", "Scribe", "Soldat", "Voyageur", "Enfant des rues", "Héros du peuple", "Sauvageon"];

export const ABILITIES = [
  ["for", "FOR", "Force"],
  ["dex", "DEX", "Dextérité"],
  ["con", "CON", "Constitution"],
  ["int", "INT", "Intelligence"],
  ["sag", "SAG", "Sagesse"],
  ["cha", "CHA", "Charisme"],
];

/* [id, nom, caractéristique associée] */
export const SKILLS = [
  ["acrobaties", "Acrobaties", "dex"],
  ["arcanes", "Arcanes", "int"],
  ["athletisme", "Athlétisme", "for"],
  ["discretion", "Discrétion", "dex"],
  ["dressage", "Dressage", "sag"],
  ["escamotage", "Escamotage", "dex"],
  ["histoire", "Histoire", "int"],
  ["intimidation", "Intimidation", "cha"],
  ["intuition", "Intuition", "sag"],
  ["investigation", "Investigation", "int"],
  ["medecine", "Médecine", "sag"],
  ["nature", "Nature", "int"],
  ["perception", "Perception", "sag"],
  ["persuasion", "Persuasion", "cha"],
  ["religion", "Religion", "int"],
  ["representation", "Représentation", "cha"],
  ["survie", "Survie", "sag"],
  ["tromperie", "Tromperie", "cha"],
];

export const KINDS = {
  pc: { label: "Personnages", single: "Personnage", icon: Users, ring: "var(--gold)" },
  npc: { label: "PNJ", single: "PNJ", icon: Ghost, ring: "var(--arcane)" },
  monster: { label: "Monstres", single: "Monstre", icon: Skull, ring: "var(--blood)" },
};
