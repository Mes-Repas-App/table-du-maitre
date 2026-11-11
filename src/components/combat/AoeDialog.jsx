import { useState, useEffect } from "react";
import { X, Flame, Dices } from "lucide-react";
import { ABILITIES } from "../../data/reference.js";
import { rollFormula, saveMod, takeDamage, d, fmtMod } from "../../utils/helpers.js";
import { inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";

const MULTS = [
  [2, "×2 (vulnérable)"],
  [1, "plein"],
  [0.5, "moitié"],
  [0, "aucun"],
];

/**
 * Dégâts de zone : un seul jet de dégâts, un JS par cible (moitié si réussi),
 * et un multiplicateur ajustable par cible (résistance, vulnérabilité, évasion…).
 */
export default function AoeDialog({ pieces, initialIds, apply, onLog, onClose }) {
  const [ids, setIds] = useState(initialIds);
  const [formula, setFormula] = useState("8d6");
  const [total, setTotal] = useState(null);
  const [ab, setAb] = useState("dex");
  const [dc, setDc] = useState(15);
  const [half, setHalf] = useState(true);
  const [saves, setSaves] = useState({}); // id du pion → { roll, ok }
  const [mults, setMults] = useState({}); // id du pion → multiplicateur choisi à la main

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const targets = pieces.filter((p) => ids.includes(p.t.id));
  const multOf = (id) => mults[id] ?? (saves[id]?.ok ? (half ? 0.5 : 0) : 1);
  const value = total ?? (/^\d+$/.test(formula.trim()) ? Number(formula) : null);

  const rollDamage = () => {
    const r = rollFormula(formula);
    if (!r) return alert("Formule invalide (ex : 8d6, 3d10+4, 28).");
    setTotal(r.total);
    onLog(`Dégâts de zone : ${r.total} (${r.detail})`);
  };

  const rollSaves = () => {
    const ab3 = ABILITIES.find(([k]) => k === ab)[1];
    setMults({});
    setSaves(
      Object.fromEntries(
        targets.map(({ t, f }) => {
          const n = d(20);
          const roll = n + saveMod(f, ab);
          return [t.id, { roll, ok: roll >= dc, detail: `${n}${fmtMod(saveMod(f, ab))}`, ab3 }];
        })
      )
    );
  };

  const confirm = () => {
    targets.forEach(({ t, f }) => {
      const dmg = Math.floor(value * multOf(t.id));
      const { patch, notes } = takeDamage(f, dmg);
      apply(t, patch);
      const s = saves[t.id];
      onLog(`${f.name} : -${dmg} PV${s ? ` (JS ${s.ab3} ${s.roll} : ${s.ok ? "réussi" : "raté"})` : ""} → ${patch.hp}/${f.hpMax}`);
      notes.forEach(onLog);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto" style={{ background: "rgba(10,8,5,.8)" }} onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Dégâts de zone" className="w-full max-w-lg rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <Flame size={16} style={{ color: "var(--blood-l)" }} />
          <span className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Dégâts de zone
          </span>
          <button onClick={onClose} className="p-1.5 rounded-md" style={inputStyle} title="Fermer (Échap)">
            <X size={14} />
          </button>
        </div>

        <div className="p-3 space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: "var(--muted)" }}>Dégâts</span>
            <input
              value={formula}
              onChange={(ev) => {
                setFormula(ev.target.value);
                setTotal(null);
              }}
              className="w-24 rounded-md px-2 py-1 outline-none"
              style={inputStyle}
              aria-label="Dégâts (formule ou nombre)"
            />
            <button onClick={rollDamage} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold" style={inputStyle}>
              <Dices size={12} /> Lancer
            </button>
            {value != null && <b className="text-base" style={{ color: "var(--blood-l)" }}>{value}</b>}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: "var(--muted)" }}>JS de</span>
            <select value={ab} onChange={(ev) => setAb(ev.target.value)} className="rounded-md px-1.5 py-1 outline-none" style={inputStyle} aria-label="Caractéristique du jet de sauvegarde">
              {ABILITIES.map(([k, abbr]) => (
                <option key={k} value={k}>
                  {abbr}
                </option>
              ))}
            </select>
            <span style={{ color: "var(--muted)" }}>DD</span>
            <input type="number" value={dc} onChange={(ev) => setDc(Number(ev.target.value) || 0)} className="w-14 rounded-md px-1.5 py-1 text-center outline-none" style={inputStyle} aria-label="DD" />
            <label className="inline-flex items-center gap-1 cursor-pointer" style={{ color: "var(--muted)" }}>
              <input type="checkbox" checked={half} onChange={(ev) => setHalf(ev.target.checked)} /> moitié si réussi
            </label>
            <button onClick={rollSaves} disabled={!targets.length} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold disabled:opacity-40" style={inputStyle}>
              <Dices size={12} /> Lancer les JS
            </button>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {pieces.map(({ t, f }) => {
              const on = ids.includes(t.id);
              const s = saves[t.id];
              const res = [f.resistances && `résiste : ${f.resistances}`, f.immunities && `immunisé : ${f.immunities}`, f.vulnerabilities && `vulnérable : ${f.vulnerabilities}`].filter(Boolean).join(" · ");
              return (
                <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-md px-1.5 py-1" style={{ background: on ? "var(--well)" : "transparent", opacity: on ? 1 : 0.55 }}>
                  <input type="checkbox" checked={on} onChange={(ev) => setIds((p) => (ev.target.checked ? [...p, t.id] : p.filter((x) => x !== t.id)))} aria-label={`Cibler ${f.name}`} />
                  <Portrait e={f} size={22} dead={f.hp === 0} />
                  <span className="flex-1 min-w-0 truncate" style={{ color: "var(--parchment)" }}>
                    {f.name}
                    {res && (
                      <span className="block text-[10px] truncate" style={{ color: "var(--arcane)" }} title={res}>
                        {res}
                      </span>
                    )}
                  </span>
                  {on && s && (
                    <span style={{ color: s.ok ? "var(--life-l)" : "var(--blood-l)" }} title={s.detail}>
                      JS {s.roll} {s.ok ? "✓" : "✗"}
                    </span>
                  )}
                  {on && (
                    <>
                      <select value={multOf(t.id)} onChange={(ev) => setMults((p) => ({ ...p, [t.id]: Number(ev.target.value) }))} className="rounded-md px-1 py-0.5 outline-none" style={inputStyle} aria-label="Dégâts subis">
                        {MULTS.map(([m, label]) => (
                          <option key={m} value={m}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {value != null && <b className="w-8 text-right" style={{ color: "var(--blood-l)" }}>{Math.floor(value * multOf(t.id))}</b>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button
            onClick={confirm}
            disabled={value == null || !targets.length}
            className="w-full rounded-md px-3 py-2 text-sm font-bold disabled:opacity-40"
            style={{ background: "var(--blood)", color: "var(--parchment)" }}
          >
            Appliquer à {targets.length} cible{targets.length > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
