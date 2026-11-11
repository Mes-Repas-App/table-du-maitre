import { useState } from "react";
import { CONDITIONS, conditionDesc, exhaustionDesc } from "../../data/reference.js";
import { useRules } from "../../hooks/useRules.js";
import { uid, clamp } from "../../utils/helpers.js";
import { inputCls, inputStyle } from "../ui/form.jsx";
import Tip from "../ui/Tip.jsx";

/**
 * Grille d'états cliquables (la règle s'affiche au survol),
 * compteur d'épuisement et création d'états personnalisés.
 */
export default function ConditionPicker({ e, update, onLog }) {
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const rules = useRules();

  const toggle = (cid) => {
    const has = e.conditions.includes(cid);
    const conditions = has ? e.conditions.filter((x) => x !== cid) : [...e.conditions, cid];
    update({ conditions });
    const c = CONDITIONS.find((x) => x.id === cid);
    onLog && onLog(`${e.name} : ${has ? "perd" : "gagne"} l'état ${c.label}`);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {CONDITIONS.map((c) => {
          const on = e.conditions.includes(c.id);
          return (
            <Tip key={c.id} text={conditionDesc(c, rules)}>
              <button
                onClick={() => toggle(c.id)}
                className="rounded-full px-2 py-0.5 text-[11px] transition-all"
                style={{
                  background: on ? "var(--gold)" : "var(--well)",
                  color: on ? "#1a1409" : "var(--muted)",
                  border: `1px solid ${on ? "var(--gold)" : "var(--edge)"}`,
                  fontWeight: on ? 700 : 400,
                }}
              >
                {c.icon} {c.label}
              </button>
            </Tip>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2.5">
        <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Épuisement
        </span>
        <div className="flex items-center gap-1">
          <button onClick={() => update({ exhaustion: clamp((e.exhaustion || 0) - 1, 0, 6) })} className="w-6 h-6 rounded-md text-sm" style={inputStyle}>
            −
          </button>
          <Tip text={exhaustionDesc(e.exhaustion, rules)} wide>
            <span tabIndex={0} className="w-8 text-center font-bold cursor-help" style={{ color: e.exhaustion > 0 ? "var(--blood-l)" : "var(--parchment)" }}>
              {e.exhaustion || 0}
            </span>
          </Tip>
          <button onClick={() => update({ exhaustion: clamp((e.exhaustion || 0) + 1, 0, 6) })} className="w-6 h-6 rounded-md text-sm" style={inputStyle}>
            +
          </button>
        </div>
        <button onClick={() => setShowCustom(!showCustom)} className="ml-auto text-[11px] underline" style={{ color: "var(--arcane)" }}>
          + état personnalisé
        </button>
      </div>

      {(e.customConditions || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {e.customConditions.map((c) => (
            <Tip key={c.id} text={c.desc || "État personnalisé."}>
              <button
                onClick={() => update({ customConditions: e.customConditions.filter((x) => x.id !== c.id) })}
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{ background: "var(--chip)", border: "1px solid var(--arcane)", color: "var(--parchment)" }}
              >
                {c.icon || "◆"} {c.label} ✕
              </button>
            </Tip>
          ))}
        </div>
      )}

      {showCustom && (
        <div className="mt-2 p-2 rounded-md space-y-1.5" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
          <input
            placeholder="Nom de l'état (ex : Marque du chasseur)"
            value={customName}
            onChange={(ev) => setCustomName(ev.target.value)}
            className={inputCls}
            style={{ ...inputStyle, background: "var(--panel)" }}
          />
          <input
            placeholder="Description (visible au survol)"
            value={customDesc}
            onChange={(ev) => setCustomDesc(ev.target.value)}
            className={inputCls}
            style={{ ...inputStyle, background: "var(--panel)" }}
          />
          <button
            disabled={!customName.trim()}
            onClick={() => {
              update({
                customConditions: [...(e.customConditions || []), { id: uid(), label: customName.trim(), desc: customDesc.trim(), icon: "🎯" }],
              });
              onLog && onLog(`${e.name} : gagne l'état ${customName.trim()}`);
              setCustomName("");
              setCustomDesc("");
              setShowCustom(false);
            }}
            className="rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--gold)", color: "#1a1409" }}
          >
            Ajouter l'état
          </button>
        </div>
      )}
    </div>
  );
}
