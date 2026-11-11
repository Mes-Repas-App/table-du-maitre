import { useState } from "react";
import { Plus, X, Brain, Wand2 } from "lucide-react";
import { ABILITIES } from "../../data/reference.js";
import { uid, mod, fmtMod, clamp, profBonus } from "../../utils/helpers.js";
import { NumInput, inputStyle } from "../ui/form.jsx";

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const levelLabel = (l) => (l === 0 ? "Sorts mineurs" : `Niveau ${l}`);

/**
 * Sorts et emplacements. « Lancer » consomme le plus petit emplacement disponible
 * (ou celui choisi pour un sort lancé à plus haut niveau) et gère la concentration.
 * `edit` : fiche complète ; sinon version compacte du panneau de combat.
 */
export default function Spells({ e, update, onLog, edit }) {
  const spells = e.spells || [];
  const slots = e.slots || {};
  const ab = e.spellAbility;
  if (!edit && !spells.length && !LEVELS.some((l) => slots[l]?.max)) return null;

  const setSpell = (id, patch) => update({ spells: spells.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const setSlot = (l, patch) => update({ slots: { ...slots, [l]: { cur: 0, max: 0, ...slots[l], ...patch } } });

  const cast = (s, level) => {
    const patch = {};
    if (s.level > 0) {
      if (!slots[level]?.cur) return alert(`Plus d'emplacement de niveau ${level}.`);
      patch.slots = { ...slots, [level]: { ...slots[level], cur: slots[level].cur - 1 } };
    }
    let msg = `${e.name} lance ${s.name || "un sort"}${s.level > 0 ? ` (emplacement niv. ${level})` : ""}`;
    if (s.concentration) {
      if (e.conditions.includes("concentration")) msg += " et abandonne sa concentration précédente";
      else patch.conditions = [...e.conditions, "concentration"];
    }
    update(patch);
    onLog?.(msg);
  };

  return (
    <div className="space-y-3">
      {edit && (
        <div className="flex flex-wrap items-center gap-2 text-xs rounded-lg p-2" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
          <span style={{ color: "var(--muted)" }}>Incantation</span>
          <select value={ab} onChange={(ev) => update({ spellAbility: ev.target.value })} className="rounded-md px-1.5 py-1 outline-none" style={{ ...inputStyle, background: "var(--panel)" }}>
            <option value="">—</option>
            {ABILITIES.map(([k, abbr, full]) => (
              <option key={k} value={k}>
                {abbr} ({full})
              </option>
            ))}
          </select>
          {ab && (
            <span className="ml-auto" style={{ color: "var(--muted)" }}>
              DD des sorts <b style={{ color: "var(--gold)" }}>{8 + profBonus(e) + mod(e.abilities[ab])}</b> · Attaque <b style={{ color: "var(--gold)" }}>{fmtMod(profBonus(e) + mod(e.abilities[ab]))}</b>
            </span>
          )}
        </div>
      )}

      {/* Emplacements */}
      <div>
        <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
          Emplacements de sorts {edit && "— maximum par niveau"}
        </span>
        <div className={edit ? "grid grid-cols-9 gap-1" : "flex flex-wrap gap-x-3 gap-y-1"}>
          {LEVELS.filter((l) => edit || slots[l]?.max).map((l) => {
            const sl = slots[l] || { cur: 0, max: 0 };
            return (
              <div key={l} className={edit ? "rounded-md p-1 text-center" : "inline-flex items-center gap-1 text-[11px]"} style={edit ? { background: "var(--well)", border: "1px solid var(--edge)" } : {}}>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                  {edit ? l : `Niv ${l}`}
                </span>
                {edit && (
                  <NumInput
                    min="0"
                    max="9"
                    value={sl.max}
                    onChange={(v) => setSlot(l, { max: clamp(v, 0, 9), cur: clamp(v, 0, 9) })}
                    className="w-full bg-transparent text-center text-sm font-bold outline-none"
                    style={{ color: "var(--parchment)" }}
                    aria-label={`Emplacements de niveau ${l}`}
                  />
                )}
                <span className="inline-flex flex-wrap justify-center gap-0.5">
                  {Array.from({ length: sl.max }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setSlot(l, { cur: sl.cur === i + 1 ? i : i + 1 })}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ border: "1px solid var(--arcane)", background: i < sl.cur ? "var(--arcane)" : "transparent" }}
                      aria-label={`Emplacement ${i + 1} de niveau ${l}`}
                    />
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sorts par niveau */}
      {[0, ...LEVELS].map((l) => {
        const list = spells.filter((s) => (s.level || 0) === l);
        if (!list.length) return null;
        return (
          <div key={l}>
            <div className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--gold)" }}>
              {levelLabel(l)}
            </div>
            {list.map((s) => (
              <SpellRow key={s.id} s={s} slots={slots} edit={edit} setSpell={setSpell} cast={cast} remove={() => update({ spells: spells.filter((x) => x.id !== s.id) })} />
            ))}
          </div>
        );
      })}

      {edit && (
        <button
          onClick={() => update({ spells: [...spells, { id: uid(), name: "", level: 1, concentration: false, notes: "" }] })}
          className="inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--arcane)" }}
        >
          <Plus size={11} /> Ajouter un sort
        </button>
      )}
    </div>
  );
}

function SpellRow({ s, slots, edit, setSpell, cast, remove }) {
  const available = LEVELS.filter((l) => l >= s.level && slots[l]?.cur > 0);
  const [at, setAt] = useState(null);
  const level = available.includes(at) ? at : available[0];

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs py-0.5">
      {edit ? (
        <>
          <input
            value={s.name}
            onChange={(ev) => setSpell(s.id, { name: ev.target.value })}
            placeholder="Nom du sort"
            className="flex-1 min-w-[7rem] rounded-md px-2 py-1 outline-none"
            style={inputStyle}
            aria-label="Nom du sort"
          />
          <select value={s.level} onChange={(ev) => setSpell(s.id, { level: Number(ev.target.value) })} className="rounded-md px-1 py-1 outline-none" style={inputStyle} aria-label="Niveau">
            <option value={0}>mineur</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                niv. {l}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1 cursor-pointer" style={{ color: s.concentration ? "var(--arcane)" : "var(--muted)" }} title="Sort de concentration">
            <input type="checkbox" checked={!!s.concentration} onChange={(ev) => setSpell(s.id, { concentration: ev.target.checked })} />
            <Brain size={11} /> C
          </label>
        </>
      ) : (
        <span className="flex-1 truncate" style={{ color: "var(--parchment)" }} title={s.notes}>
          {s.name || "Sort"} {s.concentration && <Brain size={10} className="inline" style={{ color: "var(--arcane)" }} />}
        </span>
      )}
      {s.level > 0 && available.length > 1 && (
        <select value={level} onChange={(ev) => setAt(Number(ev.target.value))} className="rounded-md px-1 py-1 outline-none" style={inputStyle} title="Lancer à un niveau supérieur">
          {available.map((l) => (
            <option key={l} value={l}>
              niv. {l}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={() => cast(s, level)}
        disabled={s.level > 0 && !level}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold disabled:opacity-35"
        style={{ background: "var(--arcane)", color: "#0d0f16" }}
        title={s.level > 0 && !level ? "Plus d'emplacement disponible" : "Lancer"}
      >
        <Wand2 size={11} /> Lancer
      </button>
      {edit && (
        <>
          <button onClick={remove} className="p-1" style={{ color: "var(--muted)" }} aria-label="Supprimer le sort">
            <X size={12} />
          </button>
          <input
            value={s.notes || ""}
            onChange={(ev) => setSpell(s.id, { notes: ev.target.value })}
            placeholder="Portée, composantes, effet…"
            className="w-full rounded-md px-2 py-0.5 outline-none text-[11px]"
            style={{ ...inputStyle, background: "transparent", border: "none", color: "var(--muted)" }}
            aria-label="Notes du sort"
          />
        </>
      )}
    </div>
  );
}
