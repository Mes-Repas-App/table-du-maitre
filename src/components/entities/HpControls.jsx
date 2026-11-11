import { useState } from "react";
import { Skull, Brain, Dices } from "lucide-react";
import { applyHp, takeDamage, d } from "../../utils/helpers.js";
import { inputStyle, NumInput } from "../ui/form.jsx";
import Tip from "../ui/Tip.jsx";
import HpBar from "../ui/HpBar.jsx";

/**
 * Barre de PV + boutons rapides de dégâts / soins / PV temporaires.
 * Les dégâts entament d'abord les PV temporaires, comme le veut la règle.
 * Rappel du JS de concentration et jets contre la mort à 0 PV.
 * Utilisé dans la fiche complète ET dans le panneau de combat.
 */
export default function HpControls({ e, update, onLog }) {
  const [amount, setAmount] = useState(5);
  const [concDc, setConcDc] = useState(null);
  const ds = e.deathSaves || { ok: 0, ko: 0 };
  const concentrating = e.conditions.includes("concentration");

  const apply = (delta, label) => {
    const { patch, notes } = delta < 0 ? takeDamage(e, -delta) : { patch: applyHp(e, delta), notes: [] };
    update(patch);
    onLog?.(`${e.name} : ${label || (delta < 0 ? `${delta} PV` : `+${delta} PV`)} → ${patch.hp}/${e.hpMax}`);
    notes.forEach((n) => onLog?.(n));
    setConcDc(delta < 0 && concentrating && patch.hp > 0 ? Math.max(10, Math.floor(-delta / 2)) : null);
  };

  const rollDeathSave = () => {
    const r = d(20);
    if (r === 20) {
      update({ hp: 1, deathSaves: { ok: 0, ko: 0 } });
      onLog?.(`${e.name} : jet contre la mort 20 — reprend conscience à 1 PV !`);
      return;
    }
    const next = r >= 10 ? { ...ds, ok: Math.min(3, ds.ok + 1) } : { ...ds, ko: Math.min(3, ds.ko + (r === 1 ? 2 : 1)) };
    update({ deathSaves: next });
    onLog?.(`${e.name} : jet contre la mort ${r} — ${r >= 10 ? "réussite" : r === 1 ? "deux échecs" : "échec"}`);
  };

  const btn = (delta, hue) => (
    <button
      key={delta}
      onClick={() => apply(delta)}
      className="rounded-md px-2 py-1 text-xs font-semibold transition-transform active:scale-90"
      style={{ background: "var(--well)", border: `1px solid ${hue}`, color: hue }}
    >
      {delta > 0 ? `+${delta}` : delta}
    </button>
  );

  const dots = (key, label, color) => (
    <span className="inline-flex items-center gap-1">
      {label}
      {[0, 1, 2].map((i) => (
        <button
          key={i}
          aria-label={`${label} ${i + 1}`}
          onClick={() => update({ deathSaves: { ...ds, [key]: ds[key] === i + 1 ? i : i + 1 } })}
          className="w-3.5 h-3.5 rounded-full"
          style={{ border: `1px solid ${color}`, background: i < ds[key] ? color : "transparent" }}
        />
      ))}
    </span>
  );

  return (
    <div>
      <HpBar e={e} />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {[-10, -5, -1].map((v) => btn(v, "var(--blood-l)"))}
        {[1, 5, 10].map((v) => btn(v, "var(--life-l)"))}
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <NumInput
          min="0"
          value={amount}
          onChange={(v) => setAmount(Math.max(0, v))}
          className="w-16 rounded-md px-2 py-1 text-sm text-center outline-none"
          style={inputStyle}
          aria-label="Montant"
        />
        <button
          onClick={() => apply(-amount, `-${amount} PV (dégâts)`)}
          className="flex-1 rounded-md px-2 py-1 text-xs font-semibold"
          style={{ background: "var(--blood)", color: "var(--parchment)" }}
        >
          Dégâts
        </button>
        <button
          onClick={() => apply(amount, `+${amount} PV (soin)`)}
          className="flex-1 rounded-md px-2 py-1 text-xs font-semibold"
          style={{ background: "var(--life)", color: "#0d130b" }}
        >
          Soin
        </button>
        <Tip text="Points de vie temporaires : absorbés en premier lors des dégâts. Ils ne se cumulent pas : on garde la valeur la plus haute.">
          <button
            onClick={() => {
              update({ tempHp: Math.max(e.tempHp || 0, amount) });
              onLog?.(`${e.name} : ${amount} PV temporaires`);
            }}
            className="rounded-md px-2 py-1 text-xs font-semibold"
            style={{ background: "var(--arcane)", color: "#0d0f16" }}
          >
            Temp
          </button>
        </Tip>
      </div>

      {concDc && (
        <div
          className="mt-2 text-xs rounded-md px-2 py-1.5 flex flex-wrap items-center gap-2"
          style={{ background: "rgba(139,157,212,.12)", border: "1px solid var(--arcane)", color: "var(--arcane)" }}
        >
          <Brain size={13} /> Concentration : JS de Constitution DD {concDc}
          <span className="ml-auto inline-flex gap-2">
            <button className="underline" onClick={() => setConcDc(null)}>
              Réussi
            </button>
            <button
              className="underline"
              onClick={() => {
                update({ conditions: e.conditions.filter((c) => c !== "concentration") });
                onLog?.(`${e.name} perd sa concentration`);
                setConcDc(null);
              }}
            >
              Raté
            </button>
          </span>
        </div>
      )}

      {e.hp === 0 && (
        <div
          className="mt-2 text-xs rounded-md px-2 py-1.5 space-y-1.5"
          style={{ background: "rgba(163,53,44,.15)", border: "1px solid var(--blood)", color: "var(--blood-l)" }}
        >
          <div className="flex items-center gap-2">
            <Skull size={13} />
            {e.kind !== "pc" ? "À 0 PV — hors de combat." : ds.ko >= 3 ? "Mort." : ds.ok >= 3 ? "Stabilisé (inconscient à 0 PV)." : "À 0 PV — inconscient, jets contre la mort."}
            <button
              className="ml-auto underline"
              onClick={() => {
                update({ hp: 1, deathSaves: { ok: 0, ko: 0 } });
                onLog?.(`${e.name} remonte à 1 PV`);
              }}
            >
              Remettre à 1 PV
            </button>
          </div>
          {e.kind === "pc" && (
            <div className="flex flex-wrap items-center gap-3">
              {dots("ok", "Succès", "var(--life-l)")}
              {dots("ko", "Échecs", "var(--blood-l)")}
              {ds.ok < 3 && ds.ko < 3 && (
                <button onClick={rollDeathSave} className="ml-auto inline-flex items-center gap-1 underline">
                  <Dices size={12} /> Lancer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
