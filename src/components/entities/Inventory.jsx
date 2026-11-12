import { Plus, X, Sparkles } from "lucide-react";
import { uid } from "../../utils/helpers.js";
import { NumInput, inputStyle } from "../ui/form.jsx";

const COINS = [
  ["pc", "PC", "Pièces de cuivre", 0.01],
  ["pa", "PA", "Pièces d'argent", 0.1],
  ["pe", "PE", "Pièces d'électrum", 0.5],
  ["po", "PO", "Pièces d'or", 1],
  ["pp", "PP", "Pièces de platine", 10],
];
export const MAX_ATTUNED = 3;

/** Bourse + objets, dont objets magiques avec harmonisation (3 au maximum) */
export default function Inventory({ e, update }) {
  const items = e.items || [];
  const money = e.money || {};
  const attuned = items.filter((i) => i.attuned).length;
  const total = COINS.reduce((s, [k, , , v]) => s + (money[k] || 0) * v, 0);
  const setItem = (id, patch) => update({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
          Bourse — {(Math.round(total * 100) / 100).toLocaleString("fr-FR")} po au total
        </span>
        <div className="grid grid-cols-5 gap-2">
          {COINS.map(([k, abbr, full]) => (
            <label key={k} className="rounded-lg p-1.5 text-center" style={{ background: "var(--well)", border: "1px solid var(--edge)" }} title={full}>
              <span className="block text-[10px] tracking-widest" style={{ color: k === "po" ? "var(--gold)" : "var(--muted)" }}>
                {abbr}
              </span>
              <NumInput
                min="0"
                value={money[k] || 0}
                onChange={(v) => update({ money: { ...money, [k]: Math.max(0, v) } })}
                className="w-full bg-transparent text-center font-bold outline-none"
                style={{ color: "var(--parchment)" }}
                aria-label={full}
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Objets ({items.length})
          </span>
          <span className="text-[11px]" style={{ color: attuned >= MAX_ATTUNED ? "var(--gold)" : "var(--muted)" }}>
            Harmonisation {attuned}/{MAX_ATTUNED}
          </span>
        </div>
        <div className="space-y-1">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-1.5 text-xs rounded-md p-1.5" style={{ background: "var(--well)", border: `1px solid ${i.magic ? "var(--arcane)" : "var(--edge)"}` }}>
              <NumInput
                min="0"
                value={i.qty}
                onChange={(v) => setItem(i.id, { qty: Math.max(0, v) })}
                className="w-12 rounded-md px-1 py-1 text-center outline-none"
                style={{ ...inputStyle, background: "var(--panel)" }}
                aria-label="Quantité"
              />
              <input
                value={i.name}
                onChange={(ev) => setItem(i.id, { name: ev.target.value })}
                placeholder="Corde de chanvre, Épée +1…"
                className="flex-1 min-w-[8rem] rounded-md px-2 py-1 outline-none"
                style={{ ...inputStyle, background: "var(--panel)" }}
                aria-label="Objet"
              />
              <label className="inline-flex items-center gap-1 cursor-pointer" style={{ color: i.magic ? "var(--arcane)" : "var(--muted)" }}>
                <input type="checkbox" checked={!!i.magic} onChange={(ev) => setItem(i.id, { magic: ev.target.checked, attuned: ev.target.checked && i.attuned })} />
                <Sparkles size={11} /> magique
              </label>
              {i.magic && (
                <label
                  className="inline-flex items-center gap-1 cursor-pointer"
                  style={{ color: i.attuned ? "var(--gold)" : "var(--muted)" }}
                  title={!i.attuned && attuned >= MAX_ATTUNED ? "Déjà 3 objets harmonisés" : "Harmonisé"}
                >
                  <input type="checkbox" checked={!!i.attuned} disabled={!i.attuned && attuned >= MAX_ATTUNED} onChange={(ev) => setItem(i.id, { attuned: ev.target.checked })} />
                  harmonisé
                </label>
              )}
              <button onClick={() => update({ items: items.filter((x) => x.id !== i.id) })} className="p-1" style={{ color: "var(--muted)" }} aria-label="Supprimer">
                <X size={12} />
              </button>
              <input
                value={i.notes || ""}
                onChange={(ev) => setItem(i.id, { notes: ev.target.value })}
                placeholder="Notes (effet, charges, poids…)"
                className="w-full rounded-md px-2 py-1 outline-none text-[11px]"
                style={{ ...inputStyle, background: "transparent", border: "none", color: "var(--muted)" }}
                aria-label="Notes de l'objet"
              />
            </div>
          ))}
        </div>
        <button
          onClick={() => update({ items: [...items, { id: uid(), name: "", qty: 1, magic: false, attuned: false, notes: "" }] })}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--arcane)" }}
        >
          <Plus size={11} /> Ajouter un objet
        </button>
      </div>
    </div>
  );
}
