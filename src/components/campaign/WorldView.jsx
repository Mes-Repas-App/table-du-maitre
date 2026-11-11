import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, X, ImagePlus, MonitorPlay, Map as MapIcon, ChevronRight } from "lucide-react";
import { WORLD_TYPES, newWorldItem, resizeImage, uid } from "../../utils/helpers.js";
import { Field, inputCls, inputStyle } from "../ui/form.jsx";

export const QUEST_STATUS = {
  rumor: { label: "Rumeur", color: "var(--muted)" },
  active: { label: "En cours", color: "var(--gold)" },
  done: { label: "Terminée", color: "var(--life-l)" },
  failed: { label: "Échouée", color: "var(--blood-l)" },
};
const STATUS_ORDER = ["active", "rumor", "done", "failed"];

/** Lieux dans l'ordre de l'arbre, avec leur profondeur */
function placeTree(items, parentId = null, depth = 0) {
  return items
    .filter((p) => (p.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .flatMap((p) => [{ p, depth }, ...placeTree(items, p.id, depth + 1)]);
}

/**
 * Fiches de monde : quêtes (statut, objectifs, commanditaire, récompense),
 * lieux imbriqués et documents à montrer aux joueurs.
 */
export default function WorldView({ world, setWorld, selectedId, select, showHandout }) {
  const selected = world.find((w) => w.id === selectedId);
  const [type, setType] = useState(selected?.type || "quest");
  useEffect(() => {
    if (selected) setType(selected.type);
  }, [selected?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  const ofType = world.filter((w) => w.type === type);
  const item = selected?.type === type ? selected : ofType[0];
  const T = WORLD_TYPES[type];

  const rows =
    type === "place"
      ? placeTree(ofType)
      : ofType
          .slice()
          .sort((a, b) => (type === "quest" ? STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) : 0) || a.name.localeCompare(b.name, "fr"))
          .map((p) => ({ p, depth: 0 }));

  const set = (id, patch) => setWorld((p) => p.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  const create = (extra = {}) => {
    const n = { ...newWorldItem(type), ...extra };
    setWorld((p) => [...p, n]);
    select(n.id);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
          Monde
        </h2>
        <div className="flex gap-1 mr-auto">
          {Object.entries(WORLD_TYPES).map(([k, W]) => (
            <button
              key={k}
              onClick={() => {
                setType(k);
                select(null);
              }}
              className="rounded-full px-3 py-1 text-xs"
              style={{
                background: type === k ? "var(--chip)" : "transparent",
                border: `1px solid ${type === k ? "var(--gold)" : "var(--edge)"}`,
                color: type === k ? "var(--gold)" : "var(--muted)",
              }}
            >
              {W.label} ({world.filter((w) => w.type === k).length})
            </button>
          ))}
        </div>
        <button
          onClick={() => create()}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold"
          style={{ background: "var(--gold)", color: "#1a1409" }}
        >
          <Plus size={15} /> {T.fresh}
        </button>
      </div>

      {!item ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          <MapIcon size={32} className="mx-auto mb-3 opacity-50" />
          {type === "quest" && "Aucune quête. Notez les rumeurs, les missions en cours et leurs objectifs."}
          {type === "place" && "Aucun lieu. Créez une région, puis ses villes et leurs lieux remarquables."}
          {type === "handout" && "Aucun document. Lettres, cartes, portraits : préparez ce que vous montrerez aux joueurs."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-xl p-2 self-start space-y-0.5" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
            {rows.map(({ p, depth }) => (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className="w-full flex items-center gap-1.5 text-left rounded-lg px-2 py-1.5 text-sm"
                style={{
                  paddingLeft: 8 + depth * 14,
                  background: p.id === item.id ? "rgba(201,162,39,.14)" : "transparent",
                  border: `1px solid ${p.id === item.id ? "var(--gold)" : "transparent"}`,
                  color: "var(--parchment)",
                }}
              >
                {depth > 0 && <ChevronRight size={11} style={{ color: "var(--muted)" }} />}
                <span className="truncate flex-1">{p.name}</span>
                {type === "quest" && (
                  <span className="text-[9px] uppercase shrink-0" style={{ color: QUEST_STATUS[p.status]?.color }}>
                    {QUEST_STATUS[p.status]?.label}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Detail item={item} world={world} set={(patch) => set(item.id, patch)} setWorld={setWorld} select={select} create={create} showHandout={showHandout} />
        </div>
      )}
    </div>
  );
}

function Detail({ item, world, set, setWorld, select, create, showHandout }) {
  const fileRef = useRef(null);
  const [objective, setObjective] = useState("");
  const children = item.type === "place" ? world.filter((w) => w.parentId === item.id) : [];
  // Un lieu ne peut pas être rangé dans lui-même ni dans ses propres sous-lieux
  const descendants = new Set();
  const walk = (id) => world.filter((w) => w.parentId === id).forEach((w) => (descendants.add(w.id), walk(w.id)));
  walk(item.id);

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={item.name}
          onChange={(ev) => set({ name: ev.target.value })}
          className="flex-1 min-w-[10rem] bg-transparent outline-none text-xl"
          style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}
          aria-label="Nom"
        />
        <button
          onClick={() => showHandout({ title: item.name, image: item.image, text: item.type === "handout" ? item.text : "" })}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold"
          style={inputStyle}
          title="Affiche le nom et l'image sur l'écran joueurs (et le texte pour un document)"
        >
          <MonitorPlay size={14} /> Montrer aux joueurs
        </button>
        <button
          onClick={() => {
            if (!confirm(`Supprimer « ${item.name} » ?`)) return;
            // Les sous-lieux remontent d'un niveau
            setWorld((p) => p.filter((w) => w.id !== item.id).map((w) => (w.parentId === item.id ? { ...w, parentId: item.parentId ?? null } : w)));
            select(null);
          }}
          className="p-2 rounded-md"
          style={{ ...inputStyle, color: "var(--blood-l)" }}
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {item.type === "quest" && (
        <div className="grid sm:grid-cols-3 gap-2">
          <Field label="Statut">
            <select value={item.status} onChange={(ev) => set({ status: ev.target.value })} className={inputCls} style={{ ...inputStyle, color: QUEST_STATUS[item.status]?.color }}>
              {Object.entries(QUEST_STATUS).map(([k, S]) => (
                <option key={k} value={k}>
                  {S.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Commanditaire">
            <input list="entity-names" value={item.giver} onChange={(ev) => set({ giver: ev.target.value })} className={inputCls} style={inputStyle} placeholder="PNJ, faction…" />
          </Field>
          <Field label="Récompense">
            <input value={item.reward} onChange={(ev) => set({ reward: ev.target.value })} className={inputCls} style={inputStyle} placeholder="200 po, une faveur…" />
          </Field>
        </div>
      )}

      {item.type === "place" && (
        <Field label="Situé dans">
          <select value={item.parentId ?? ""} onChange={(ev) => set({ parentId: ev.target.value || null })} className={inputCls} style={inputStyle}>
            <option value="">— (lieu principal)</option>
            {placeTree(world.filter((w) => w.type === "place"))
              .filter(({ p }) => p.id !== item.id && !descendants.has(p.id))
              .map(({ p, depth }) => (
                <option key={p.id} value={p.id}>
                  {"  ".repeat(depth)}
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
      )}

      <div>
        {item.image ? (
          <div className="relative inline-block">
            <img src={item.image} alt={item.name} className="max-h-72 rounded-lg" style={{ border: "1px solid var(--edge)" }} />
            <button onClick={() => set({ image: "" })} className="absolute top-1.5 right-1.5 p-1 rounded-md" style={inputStyle} aria-label="Retirer l'image">
              <X size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs" style={inputStyle}>
            <ImagePlus size={13} /> Ajouter une image
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = "";
            if (!f) return;
            try {
              set({ image: (await resizeImage(f, 1600)).data });
            } catch {
              alert("Impossible de lire cette image.");
            }
          }}
        />
      </div>

      <Field label={item.type === "handout" ? "Texte (affiché aux joueurs)" : "Description et notes"}>
        <textarea rows={6} value={item.text} onChange={(ev) => set({ text: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      {item.type === "quest" && (
        <div>
          <span className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Objectifs
          </span>
          {item.objectives.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm py-0.5">
              <input
                type="checkbox"
                checked={o.done}
                onChange={(ev) => set({ objectives: item.objectives.map((x) => (x.id === o.id ? { ...x, done: ev.target.checked } : x)) })}
                aria-label="Atteint"
              />
              <span className="flex-1" style={{ color: o.done ? "var(--muted)" : "var(--parchment)", textDecoration: o.done ? "line-through" : "none" }}>
                {o.text}
              </span>
              <button onClick={() => set({ objectives: item.objectives.filter((x) => x.id !== o.id) })} style={{ color: "var(--muted)" }} aria-label="Retirer">
                <X size={12} />
              </button>
            </div>
          ))}
          <form
            className="flex gap-1.5 mt-1"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!objective.trim()) return;
              set({ objectives: [...item.objectives, { id: uid(), text: objective.trim(), done: false }] });
              setObjective("");
            }}
          >
            <input value={objective} onChange={(ev) => setObjective(ev.target.value)} placeholder="Nouvel objectif" className="flex-1 min-w-0 rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} aria-label="Nouvel objectif" />
            <button className="rounded-md px-2.5 py-1 text-xs font-bold" style={{ background: "var(--gold)", color: "#1a1409" }}>
              Ajouter
            </button>
          </form>
        </div>
      )}

      {item.type === "place" && (
        <div>
          <span className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
            Lieux à l'intérieur ({children.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {children.map((c) => (
              <button key={c.id} onClick={() => select(c.id)} className="rounded-full px-2.5 py-0.5 text-xs" style={{ ...inputStyle, background: "var(--chip)" }}>
                {c.name}
              </button>
            ))}
            <button onClick={() => create({ parentId: item.id })} className="inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--arcane)" }}>
              <Plus size={11} /> Ajouter un lieu ici
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
