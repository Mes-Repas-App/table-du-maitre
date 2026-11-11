import Tip from "./Tip.jsx";
import { CONDITIONS, conditionDesc, exhaustionDesc } from "../../data/reference.js";
import { useRules } from "../../hooks/useRules.js";

/* Affiche la liste des états d'une entité sous forme de puces,
   avec la règle complète (de l'édition choisie) au survol. */
export default function ConditionChips({ e, size = "md" }) {
  const rules = useRules();
  const all = [
    ...e.conditions.map((cid) => CONDITIONS.find((c) => c.id === cid)).filter(Boolean).map((c) => ({ ...c, desc: conditionDesc(c, rules) })),
    ...(e.customConditions || []),
  ];
  if (e.exhaustion > 0) {
    all.push({ id: "exh", label: `Épuisement ${e.exhaustion}`, icon: "🥵", desc: exhaustionDesc(e.exhaustion, rules) });
  }
  if (!all.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {all.map((c, i) => (
        <Tip key={c.id + i} text={c.desc || "État personnalisé."}>
          <span
            tabIndex={0}
            className={`inline-flex items-center gap-1 rounded-full cursor-help ${size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
            style={{ background: "var(--chip)", border: "1px solid var(--edge)", color: "var(--parchment)" }}
          >
            <span>{c.icon || "◆"}</span>
            {c.label}
          </span>
        </Tip>
      ))}
    </div>
  );
}
