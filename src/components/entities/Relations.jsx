import { Plus, X } from "lucide-react";
import { uid } from "../../utils/helpers.js";
import { inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";

export const RELATION_KINDS = {
  ally: { label: "Allié", color: "var(--life-l)" },
  friend: { label: "Ami", color: "var(--life-l)" },
  family: { label: "Famille", color: "var(--gold)" },
  employer: { label: "Employeur", color: "var(--arcane)" },
  rival: { label: "Rival", color: "var(--blood-l)" },
  enemy: { label: "Ennemi", color: "var(--blood-l)" },
  other: { label: "Autre", color: "var(--muted)" },
};

/** Relations vers d'autres fiches, et celles que les autres déclarent envers celle-ci */
export default function Relations({ e, update, entities, openEditor }) {
  const rels = e.relations || [];
  const byId = Object.fromEntries(entities.map((x) => [x.id, x]));
  const others = entities.filter((x) => x.id !== e.id).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const incoming = entities.flatMap((x) => (x.id === e.id ? [] : (x.relations || []).filter((r) => r.targetId === e.id).map((r) => ({ ...r, from: x }))));
  const setRel = (id, patch) => update({ relations: rels.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
        Relations
      </span>
      <div className="space-y-1">
        {rels.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-1.5 text-xs">
            {byId[r.targetId] && (
              <button onClick={() => openEditor(r.targetId)} title="Ouvrir la fiche">
                <Portrait e={byId[r.targetId]} size={22} />
              </button>
            )}
            <select value={r.targetId} onChange={(ev) => setRel(r.id, { targetId: ev.target.value })} className="flex-1 min-w-[8rem] rounded-md px-1.5 py-1 outline-none" style={inputStyle} aria-label="Avec qui">
              <option value="">— choisir —</option>
              {others.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <select value={r.kind} onChange={(ev) => setRel(r.id, { kind: ev.target.value })} className="rounded-md px-1.5 py-1 outline-none" style={{ ...inputStyle, color: RELATION_KINDS[r.kind]?.color }} aria-label="Type de relation">
              {Object.entries(RELATION_KINDS).map(([k, K]) => (
                <option key={k} value={k}>
                  {K.label}
                </option>
              ))}
            </select>
            <button onClick={() => update({ relations: rels.filter((x) => x.id !== r.id) })} className="p-1" style={{ color: "var(--muted)" }} aria-label="Retirer">
              <X size={12} />
            </button>
            <input
              value={r.note}
              onChange={(ev) => setRel(r.id, { note: ev.target.value })}
              placeholder="Précision : lui doit 50 po, frère cadet…"
              className="w-full rounded-md px-2 py-0.5 outline-none text-[11px]"
              style={{ ...inputStyle, background: "transparent", border: "none", color: "var(--muted)" }}
              aria-label="Précision"
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => update({ relations: [...rels, { id: uid(), targetId: "", kind: "ally", note: "" }] })}
        className="mt-1 inline-flex items-center gap-1 text-[11px] underline"
        style={{ color: "var(--arcane)" }}
      >
        <Plus size={11} /> Ajouter une relation
      </button>

      {incoming.length > 0 && (
        <div className="mt-3">
          <span className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Ce que les autres en pensent
          </span>
          <div className="flex flex-wrap gap-1.5">
            {incoming.map((r) => (
              <button
                key={r.from.id + r.id}
                onClick={() => openEditor(r.from.id)}
                className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 text-xs"
                style={{ background: "var(--chip)", border: "1px solid var(--edge)", color: "var(--parchment)" }}
                title={r.note}
              >
                <Portrait e={r.from} size={18} /> {r.from.name} → <span style={{ color: RELATION_KINDS[r.kind]?.color }}>{RELATION_KINDS[r.kind]?.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
