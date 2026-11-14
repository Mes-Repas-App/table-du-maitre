import { useState } from "react";
import { Swords, Flame } from "lucide-react";
import { parseAttack, critFormula, rollFormula, d, fmtMod, d20Malus } from "../../utils/helpers.js";
import { useRules } from "../../hooks/useRules.js";

/**
 * Attaques cliquables : chaque ligne « Nom : +5, 1d8+3 … » devient deux boutons.
 * Un 20 naturel rend les dégâts suivants critiques (dés doublés).
 */
export default function AttackList({ f, onLog }) {
  const [last, setLast] = useState({}); // ligne → dernier résultat affiché
  const [crit, setCrit] = useState({}); // ligne → prochain jet de dégâts critique
  const rules = useRules();
  const lines = (f.attacks || "").split("\n").filter((l) => l.trim());
  if (!lines.length) return null;

  const attack = (i, a) => {
    const n = d(20);
    const malus = d20Malus(f, rules);
    const total = n + (a.bonus || 0) + malus;
    const tag = n === 20 ? " — CRITIQUE !" : n === 1 ? " — échec critique" : "";
    setLast((p) => ({ ...p, [i]: `${total}${tag}` }));
    setCrit((p) => ({ ...p, [i]: n === 20 }));
    onLog?.(`${f.name} — ${a.name} : ${total} pour toucher (d20 = ${n}${a.bonus ? ` ${fmtMod(a.bonus)}` : ""}${malus ? `, épuisement ${malus}` : ""})${tag}`);
  };

  const damage = (i, a) => {
    const formula = crit[i] ? critFormula(a.damage) : a.damage;
    const r = rollFormula(formula);
    if (!r) return;
    setLast((p) => ({ ...p, [i]: `${r.total} dégâts${crit[i] ? " (critique)" : ""}` }));
    setCrit((p) => ({ ...p, [i]: false }));
    onLog?.(`${f.name} — ${a.name} : ${r.total} dégâts${crit[i] ? " (critique)" : ""} (${r.detail})`);
  };

  return (
    <div className="rounded-md p-2 space-y-1.5" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
      <span className="block text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Attaques & capacités
      </span>
      {lines.map((line, i) => {
        const a = parseAttack(line);
        if (!a) {
          return (
            <div key={i} className="text-xs whitespace-pre-wrap" style={{ color: "var(--parchment)" }}>
              {line}
            </div>
          );
        }
        return (
          <div key={i} className="text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold mr-auto" style={{ color: "var(--parchment)" }} title={line}>
                {a.name}
              </span>
              {a.bonus != null && (
                <button onClick={() => attack(i, a)} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold" style={{ background: "var(--chip)", border: "1px solid var(--gold)", color: "var(--gold)" }}>
                  <Swords size={11} /> {fmtMod(a.bonus)}
                </button>
              )}
              {a.damage && (
                <button
                  onClick={() => damage(i, a)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold"
                  style={{ background: crit[i] ? "var(--blood)" : "var(--chip)", border: "1px solid var(--blood-l)", color: crit[i] ? "var(--parchment)" : "var(--blood-l)" }}
                  title={crit[i] ? "Critique : dés doublés" : "Lancer les dégâts"}
                >
                  <Flame size={11} /> {crit[i] ? critFormula(a.damage) : a.damage}
                </button>
              )}
              {last[i] && <b style={{ color: "var(--parchment)" }}>→ {last[i]}</b>}
            </div>
            {line.length > a.name.length + 20 && (
              <div className="text-[10px] truncate" style={{ color: "var(--muted)" }} title={line}>
                {line}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
