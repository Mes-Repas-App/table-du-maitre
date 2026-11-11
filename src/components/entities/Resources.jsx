import { Plus, X } from "lucide-react";
import { uid, clamp } from "../../utils/helpers.js";
import { inputStyle, NumInput } from "../ui/form.jsx";

/**
 * Ressources limitées (emplacements de sorts, Ki, Rage…).
 * `edit` : fiche complète (nom, maximum, type de repos) ; sinon compteurs seuls (combat).
 */
export default function Resources({ e, update, edit }) {
  const list = e.resources || [];
  if (!edit && !list.length) return null;
  const set = (id, patch) => update({ resources: list.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
        Ressources & emplacements de sorts
      </span>
      <div className="space-y-1">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-1.5 text-xs">
            {edit ? (
              <input
                value={r.label}
                onChange={(ev) => set(r.id, { label: ev.target.value })}
                placeholder="Emplacements niv. 1, Ki, Rage…"
                className="flex-1 min-w-0 rounded-md px-2 py-1 outline-none"
                style={inputStyle}
              />
            ) : (
              <span className="flex-1 truncate" style={{ color: "var(--parchment)" }}>
                {r.label || "Ressource"}
              </span>
            )}
            <button onClick={() => set(r.id, { cur: clamp(r.cur - 1, 0, r.max) })} className="w-6 h-6 rounded-md" style={inputStyle} aria-label="Utiliser">
              −
            </button>
            <span className="w-10 text-center font-bold" style={{ color: r.cur ? "var(--parchment)" : "var(--blood-l)" }}>
              {r.cur}/{r.max}
            </span>
            <button onClick={() => set(r.id, { cur: clamp(r.cur + 1, 0, r.max) })} className="w-6 h-6 rounded-md" style={inputStyle} aria-label="Récupérer">
              +
            </button>
            {edit && (
              <>
                <NumInput
                  min="0"
                  value={r.max}
                  onChange={(v) => set(r.id, { max: Math.max(0, v), cur: clamp(r.cur, 0, Math.max(0, v)) })}
                  className="w-12 rounded-md px-1 py-1 text-center outline-none"
                  style={inputStyle}
                  title="Maximum"
                />
                <select value={r.reset} onChange={(ev) => set(r.id, { reset: ev.target.value })} className="rounded-md px-1 py-1 outline-none" style={inputStyle} title="Récupération">
                  <option value="short">repos court</option>
                  <option value="long">repos long</option>
                </select>
                <button onClick={() => update({ resources: list.filter((x) => x.id !== r.id) })} className="p-1" style={{ color: "var(--muted)" }} aria-label="Supprimer">
                  <X size={12} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      {edit && (
        <button
          onClick={() => update({ resources: [...list, { id: uid(), label: "", cur: 2, max: 2, reset: "long" }] })}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] underline"
          style={{ color: "var(--arcane)" }}
        >
          <Plus size={11} /> Ajouter une ressource
        </button>
      )}
    </div>
  );
}
