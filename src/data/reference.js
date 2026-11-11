import { Users, Ghost, Skull } from "lucide-react";

/* États officiels D&D 5e (+ quelques effets de sorts courants), en français.
   La description s'affiche au survol dans toute l'application. */
export const CONDITIONS = [
  { id: "aveugle", label: "Aveuglé", icon: "🕶️", desc: "Échoue automatiquement aux tests basés sur la vue. Les jets d'attaque contre lui ont l'avantage, les siens ont le désavantage." },
  { id: "charme", label: "Charmé", icon: "💘", desc: "Ne peut pas attaquer le charmeur ni le cibler avec des capacités nuisibles. Le charmeur a l'avantage aux interactions sociales avec lui." },
  { id: "assourdi", label: "Assourdi", icon: "🔇", desc: "N'entend plus rien et échoue automatiquement à tout test de caractéristique basé sur l'ouïe." },
  { id: "effraye", label: "Effrayé", icon: "😱", desc: "Désavantage aux tests de caractéristique et aux jets d'attaque tant que la source de sa peur est dans son champ de vision. Ne peut pas s'approcher volontairement de la source." },
  { id: "agrippe", label: "Agrippé", icon: "✊", desc: "Vitesse réduite à 0, sans bénéfice de bonus de vitesse. L'état prend fin si l'agrippeur est neutralisé ou si la cible est éloignée de sa portée." },
  { id: "neutralise", label: "Neutralisé", icon: "💫", desc: "Ne peut effectuer aucune action ni réaction." },
  { id: "invisible", label: "Invisible", icon: "👻", desc: "Impossible à voir sans magie ou sens spécial. Les jets d'attaque contre lui ont le désavantage, les siens ont l'avantage." },
  { id: "paralyse", label: "Paralysé", icon: "🧊", desc: "Neutralisé, ne peut ni bouger ni parler. Échoue aux JS de Force et Dextérité. Les attaques contre lui ont l'avantage ; tout coup porté à 1,50 m ou moins est un critique." },
  { id: "petrifie", label: "Pétrifié", icon: "🗿", desc: "Transformé en pierre : neutralisé, ne bouge plus, poids ×10. Résistance à tous les dégâts, immunisé au poison et aux maladies. Attaques contre lui avantagées." },
  { id: "empoisonne", label: "Empoisonné", icon: "🤢", desc: "Désavantage aux jets d'attaque et aux tests de caractéristique." },
  { id: "aterre", label: "À terre", icon: "🛌", desc: "Ne peut que ramper. Ses attaques ont le désavantage. Les attaques contre lui ont l'avantage à 1,50 m ou moins, sinon le désavantage. Se relever coûte la moitié de la vitesse." },
  { id: "entrave", label: "Entravé", icon: "⛓️", desc: "Vitesse réduite à 0. Les attaques contre lui ont l'avantage, les siennes ont le désavantage. Désavantage aux JS de Dextérité." },
  { id: "etourdi", label: "Étourdi", icon: "🌀", desc: "Neutralisé, ne peut pas bouger et parle de façon hésitante. Échoue aux JS de Force et Dextérité. Les attaques contre lui ont l'avantage." },
  { id: "inconscient", label: "Inconscient", icon: "😵", desc: "Neutralisé, lâche ce qu'il tient et tombe à terre. Échoue aux JS de Force et Dextérité. Attaques contre lui avantagées ; tout coup à 1,50 m ou moins est un critique." },
  { id: "concentration", label: "Concentration", icon: "🧠", desc: "Maintient un sort de concentration. En cas de dégâts : JS de Constitution DD 10 ou moitié des dégâts (le plus élevé) pour ne pas perdre le sort." },
  { id: "beni", label: "Béni", icon: "✨", desc: "Sort Bénédiction : ajoute 1d4 à ses jets d'attaque et jets de sauvegarde." },
  { id: "hate", label: "Hâte", icon: "💨", desc: "Vitesse doublée, +2 à la CA, avantage aux JS de Dextérité, une action supplémentaire limitée par tour. À la fin du sort : ne peut ni bouger ni agir pendant 1 tour." },
  { id: "ralenti", label: "Ralenti", icon: "🐌", desc: "Sort Lenteur : vitesse divisée par deux, -2 à la CA et aux JS de Dextérité, une seule action OU action bonus par tour, pas de réaction." },
  { id: "maudit", label: "Maudit", icon: "🕯️", desc: "Sous l'effet d'une malédiction. Voir les notes du personnage pour l'effet exact." },
];

export const EXHAUSTION_DESC = [
  "",
  "Niv. 1 — Désavantage aux tests de caractéristique.",
  "Niv. 2 — Vitesse divisée par deux.",
  "Niv. 3 — Désavantage aux jets d'attaque et de sauvegarde.",
  "Niv. 4 — Points de vie maximum divisés par deux.",
  "Niv. 5 — Vitesse réduite à 0.",
  "Niv. 6 — Mort.",
];

/* Listes de suggestions : la saisie reste libre, ajoutez ici vos propres
   races et historiques de campagne. */
export const RACES = ["Humain", "Elfe", "Haut-Elfe", "Elfe des bois", "Drow", "Nain des collines", "Nain des montagnes", "Halfelin pied-léger", "Halfelin robuste", "Demi-Elfe", "Demi-Orc", "Gnome des forêts", "Gnome des roches", "Tieffelin", "Drakéide"];
export const CLASSES = ["Barbare", "Barde", "Clerc", "Druide", "Ensorceleur", "Guerrier", "Magicien", "Moine", "Occultiste", "Paladin", "Rôdeur", "Roublard"];
export const BACKGROUNDS = ["Acolyte", "Artisan de guilde", "Artiste", "Charlatan", "Criminel", "Enfant des rues", "Ermite", "Héros du peuple", "Marin", "Noble", "Sage", "Sauvageon", "Soldat"];

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
