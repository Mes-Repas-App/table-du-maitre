import { useState, useRef } from "react";
import { Dices } from "lucide-react";
import { uid, d, rollFormula } from "../../utils/helpers.js";
import { useDismiss } from "../../hooks/useDismiss.js";
import { inputStyle } from "../ui/form.jsx";

const tone20 = (v) => (v === 20 ? "var(--life-l)" : v === 1 ? "var(--blood-l)" : "var(--parchment)");

/**
 * Lanceur de dés de l'en-tête : d4 → d100, formules (« 2d6+3 »),
 * avantage / désavantage sur le d20. `onRoll` reçoit le résultat (journal du combat ouvert).
 */
export default function DiceRoller({ onRoll }) {
  const [open, setOpen] = useState(false);
  const [rolls, setRolls] = useState([]);
  const [formula, setFormula] = useState("");
  const [bad, setBad] = useState(false);
  const [adv, setAdv] = useState(0); // -1 désavantage, 0 normal, 1 avantage
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  const push = (label, val, detail = "", color = "var(--parchment)") => {
    setRolls((p) => [{ id: uid(), label, val, detail, color }, ...p].slice(0, 8));
    onRoll?.(`🎲 ${label} : ${val}${detail ? ` (${detail})` : ""}`);
  };

  const rollDie = (f) => {
    if (f !== 20) return push(`d${f}`, d(f));
    if (!adv) {
      const v = d(20);
      return push("d20", v, "", tone20(v));
    }
    const a = d(20);
    const b = d(20);
    const v = adv > 0 ? Math.max(a, b) : Math.min(a, b);
    push(`d20 ${adv > 0 ? "avantage" : "désavantage"}`, v, `${a} et ${b}`, tone20(v));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold" style={inputStyle}>
        <Dices size={14} /> Dés
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-64 rounded-xl p-3 shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
          <div className="grid grid-cols-3 gap-1 mb-2 text-[11px]">
            {[
              [-1, "Désavantage"],
              [0, "Normal"],
              [1, "Avantage"],
            ].map(([v, label]) => (
              <button
                key={v}
                onClick={() => setAdv(v)}
                className="rounded-md py-1"
                style={{
                  background: adv === v ? "var(--chip)" : "transparent",
                  border: `1px solid ${adv === v ? "var(--gold)" : "var(--edge)"}`,
                  color: adv === v ? "var(--gold)" : "var(--muted)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[4, 6, 8, 10, 12, 20, 100].map((f) => (
              <button
                key={f}
                onClick={() => rollDie(f)}
                className="rounded-md py-1.5 text-xs font-bold transition-transform active:scale-90"
                style={{ background: "var(--well)", border: "1px solid var(--edge)", color: f === 20 ? "var(--gold)" : "var(--parchment)" }}
              >
                d{f}
              </button>
            ))}
          </div>
          <form
            className="flex gap-1.5 mt-2"
            onSubmit={(ev) => {
              ev.preventDefault();
              const r = rollFormula(formula);
              setBad(!r);
              if (r) push(formula.replace(/\s+/g, ""), r.total, r.detail);
            }}
          >
            <input
              value={formula}
              onChange={(ev) => {
                setFormula(ev.target.value);
                setBad(false);
              }}
              placeholder="2d6+3"
              className="flex-1 min-w-0 rounded-md px-2 py-1 text-xs outline-none"
              style={{ ...inputStyle, borderColor: bad ? "var(--blood-l)" : "var(--edge)" }}
              aria-label="Formule de dés"
              aria-invalid={bad}
            />
            <button className="rounded-md px-2.5 py-1 text-xs font-bold" style={{ background: "var(--gold)", color: "#1a1409" }}>
              Lancer
            </button>
          </form>
          <div className="mt-2 space-y-1 text-xs" style={{ color: "var(--muted)" }}>
            {rolls.map((r) => (
              <div key={r.id} className="flex justify-between gap-2">
                <span className="truncate" title={r.detail}>
                  {r.label}
                  {r.detail && <span className="text-[10px] opacity-70"> {r.detail}</span>}
                </span>
                <b style={{ color: r.color }}>{r.val}</b>
              </div>
            ))}
            {!rolls.length && <span>Lancez un dé…</span>}
            {onRoll && rolls.length > 0 && <div className="text-[10px] pt-1">Résultats ajoutés au journal du combat.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
