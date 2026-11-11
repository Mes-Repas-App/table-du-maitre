import { Gauge } from "lucide-react";
import { crXp, encounterDifficulty, DIFFICULTY } from "../../utils/helpers.js";

const COLORS = ["var(--life-l)", "var(--gold)", "var(--blood-l)"];

/**
 * Difficulté de la rencontre selon le Guide du maître 2024 : XP des adversaires
 * comparés au budget du groupe (somme des budgets par personnage).
 * Le groupe = PJ présents dans le combat, à défaut tous les PJ de la campagne.
 */
export default function Difficulty({ pieces, entities, rules }) {
  const inCombat = pieces.filter((p) => p.f.kind === "pc").map((p) => p.f);
  const party = inCombat.length ? inCombat : entities.filter((e) => e.kind === "pc");
  const foes = pieces.filter((p) => p.f.kind !== "pc");
  const xp = foes.reduce((s, p) => s + crXp(p.f.cr), 0);
  if (!party.length) return null;
  const { budget, level } = encounterDifficulty(party.map((e) => e.level), xp);
  const label = level < 0 ? "Sous « faible »" : level > 2 ? "Au-delà d'« élevée »" : DIFFICULTY[level];
  const color = level < 0 ? "var(--muted)" : COLORS[Math.min(level, 2)];
  const pct = Math.min(100, (xp / (budget[2] * 1.25)) * 100);

  return (
    <div className="mt-3 rounded-lg p-2 text-[11px]" style={{ background: "var(--well)", border: "1px solid var(--edge)", color: "var(--muted)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Gauge size={13} style={{ color }} />
        <span className="uppercase tracking-widest">Difficulté</span>
        <b className="ml-auto" style={{ color }}>
          {label}
        </b>
      </div>
      <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: "var(--panel)" }}>
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
        {budget.map((b, i) => (
          <span key={i} className="absolute top-0 h-full w-px" style={{ left: `${(b / (budget[2] * 1.25)) * 100}%`, background: "var(--edge2)" }} />
        ))}
      </div>
      <div className="mt-1">
        Adversaires : <b style={{ color: "var(--parchment)" }}>{xp.toLocaleString("fr-FR")} XP</b> · groupe de {party.length} (niv. {party.map((e) => e.level || 1).join(", ")})
        {!inCombat.length && " — PJ de la campagne"}
      </div>
      <div>
        Budget : {budget.map((b, i) => `${DIFFICULTY[i]} ${b.toLocaleString("fr-FR")}`).join(" · ")}
      </div>
      {foes.some((p) => p.f.cr === "" || p.f.cr == null) && <div style={{ color: "var(--gold)" }}>Certains adversaires n'ont pas de FP : ils ne comptent pas.</div>}
      {rules === "2014" && <div>Barème du Guide du maître 2024 (sans multiplicateur de groupe).</div>}
    </div>
  );
}
