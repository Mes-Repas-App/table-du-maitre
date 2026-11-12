import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, X, ImagePlus, MonitorPlay, Map as MapIcon, ChevronRight, CornerLeftUp } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import { WORLD_TYPES, PLACE_KINDS, newWorldItem, placePath, resizeImage, uid } from "../../utils/helpers.js";
import { Field, TitleInput, inputCls, inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";

export const QUEST_STATUS = {
  rumor: { label: "Rumeur", color: "var(--muted)" },
  active: { label: "En cours", color: "var(--gold)" },
  done: { label: "Terminée", color: "var(--life-l)" },
  failed: { label: "Échouée", color: "var(--blood-l)" },
};
const STATUS_ORDER = ["active", "rumor", "done", "failed"];
const THE = { quest: "la quête", place: "le lieu", handout: "le document" };
const NAME_LABEL = { quest: "Nom de la quête", place: "Nom du lieu", handout: "Titre du document" };
const placeIcon = (p) => (PLACE_KINDS[p.kind] || PLACE_KINDS.other).icon;

/** Lieux dans l'ordre de l'arbre, avec leur profondeur. Un lieu dont le parent
    n'existe plus est traité comme un lieu principal (il ne disparaît jamais de la liste). */
function placeTree(items, parentId = null, depth = 0) {
  const ids = new Set(items.map((p) => p.id));
  const isChild = (p) => (parentId === null ? !p.parentId || !ids.has(p.parentId) : p.parentId === parentId);
  return items
    .filter(isChild)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .flatMap((p) => [{ p, depth }, ...placeTree(items, p.id, depth + 1)]);
}

/**
 * Fiches de monde : quêtes (statut, lieu, objectifs, commanditaire, récompense),
 * lieux imbriqués (type, occupants, quêtes du lieu) et documents à montrer aux joueurs.
 */
export default function WorldView({ world, setWorld, entities, selectedId, select, showHandout, openEditor }) {
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
  const create = (extra = {}, as = type) => {
    const n = { ...newWorldItem(as), ...extra };
    setWorld((p) => [...p, n]);
    setType(as);
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-xl p-2 self-start space-y-0.5 max-h-48 md:max-h-none overflow-y-auto" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
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
                {depth > 0 && <ChevronRight size={11} className="shrink-0" style={{ color: "var(--muted)" }} />}
                {type === "place" && <span className="shrink-0">{placeIcon(p)}</span>}
                <span className="truncate flex-1">{p.name || <i style={{ color: "var(--muted)" }}>Sans nom</i>}</span>
                {type === "quest" && (
                  <span className="text-[9px] uppercase shrink-0" style={{ color: QUEST_STATUS[p.status]?.color }}>
                    {QUEST_STATUS[p.status]?.label}
                  </span>
                )}
              </button>
            ))}
          </div>
          <Detail
            key={item.id}
            item={item}
            world={world}
            entities={entities}
            set={(patch) => set(item.id, patch)}
            setWorld={setWorld}
            select={select}
            create={create}
            showHandout={showHandout}
            openEditor={openEditor}
          />
        </div>
      )}
    </div>
  );
}

/** Pastille cliquable (lieu, quête, fiche) avec bouton de retrait facultatif */
function Chip({ children, onClick, onRemove, title }) {
  return (
    <span className="inline-flex items-center rounded-full text-xs" style={{ ...inputStyle, background: "var(--chip)" }}>
      <button onClick={onClick} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5" title={title}>
        {children}
      </button>
      {onRemove && (
        <button onClick={onRemove} className="pr-1.5 py-0.5" style={{ color: "var(--muted)" }} aria-label="Retirer">
          <X size={11} />
        </button>
      )}
    </span>
  );
}

const SectionTitle = ({ children }) => (
  <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
    {children}
  </span>
);

function Detail({ item, world, entities, set, setWorld, select, create, showHandout, openEditor }) {
  const fileRef = useRef(null);
  const [objective, setObjective] = useState("");
  const places = world.filter((w) => w.type === "place");
  const isPlace = item.type === "place";
  const children = isPlace ? places.filter((w) => w.parentId === item.id) : [];
  const path = isPlace ? placePath(world, item.id) : [];
  const quests = isPlace ? world.filter((w) => w.type === "quest" && w.placeId === item.id) : [];
  const residents = isPlace ? (item.residents || []).map((id) => entities.find((e) => e.id === id)).filter(Boolean) : [];
  // Un lieu ne peut pas être rangé dans lui-même ni dans ses propres sous-lieux
  const descendants = new Set();
  const walk = (id) => places.filter((w) => w.parentId === id && !descendants.has(w.id)).forEach((w) => (descendants.add(w.id), walk(w.id)));
  walk(item.id);
  const placeOptions = placeTree(places).filter(({ p }) => p.id !== item.id && !descendants.has(p.id));

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
      {/* Fil d'Ariane : remonter vers les lieux parents */}
      {isPlace && path.length > 1 && (
        <nav className="flex flex-wrap items-center gap-1 text-xs -mb-2" style={{ color: "var(--muted)" }} aria-label="Emplacement du lieu">
          {path.slice(0, -1).map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <button onClick={() => select(p.id)} className="underline-offset-2 hover:underline" style={{ color: "var(--arcane)" }}>
                {placeIcon(p)} {p.name || "Sans nom"}
              </button>
              <ChevronRight size={11} />
            </span>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <TitleInput value={item.name} onChange={(name) => set({ name })} label={NAME_LABEL[item.type]} className="flex-1 basis-full sm:basis-0" />
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
            const n = isPlace ? children.length : 0;
            const extra = n === 1 ? "\n\nSon sous-lieu remontera d'un niveau." : n > 1 ? `\n\nSes ${n} sous-lieux remonteront d'un niveau.` : "";
            if (!confirm(`Supprimer ${THE[item.type]} « ${item.name || "sans nom"} » ?${extra}`)) return;
            setWorld((p) =>
              p
                .filter((w) => w.id !== item.id)
                // Les sous-lieux remontent d'un niveau ; les quêtes perdent ce lieu
                .map((w) => (w.parentId === item.id ? { ...w, parentId: item.parentId ?? null } : w))
                .map((w) => (w.placeId === item.id ? { ...w, placeId: null } : w))
            );
            select(isPlace ? item.parentId ?? null : null);
          }}
          className="p-2 rounded-md"
          style={{ ...inputStyle, color: "var(--blood-l)" }}
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {item.type === "quest" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Statut">
            <select value={item.status} onChange={(ev) => set({ status: ev.target.value })} className={inputCls} style={{ ...inputStyle, color: QUEST_STATUS[item.status]?.color }}>
              {Object.entries(QUEST_STATUS).map(([k, S]) => (
                <option key={k} value={k}>
                  {S.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lieu">
            <select value={item.placeId ?? ""} onChange={(ev) => set({ placeId: ev.target.value || null })} className={inputCls} style={inputStyle}>
              <option value="">— aucun —</option>
              {placeTree(places).map(({ p, depth }) => (
                <option key={p.id} value={p.id}>
                  {"   ".repeat(depth)}
                  {placeIcon(p)} {p.name || "Sans nom"}
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

      {isPlace && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Type de lieu">
            <select value={item.kind || "other"} onChange={(ev) => set({ kind: ev.target.value })} className={inputCls} style={inputStyle}>
              {Object.entries(PLACE_KINDS).map(([k, K]) => (
                <option key={k} value={k}>
                  {K.icon} {K.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Situé dans">
            <select value={item.parentId ?? ""} onChange={(ev) => set({ parentId: ev.target.value || null })} className={inputCls} style={inputStyle}>
              <option value="">— lieu principal —</option>
              {placeOptions.map(({ p, depth }) => (
                <option key={p.id} value={p.id}>
                  {"   ".repeat(depth)}
                  {placeIcon(p)} {p.name || "Sans nom"}
                </option>
              ))}
            </select>
          </Field>
        </div>
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
            <ImagePlus size={13} /> {isPlace ? "Ajouter une image ou un plan" : "Ajouter une image"}
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

      <Field label={item.type === "handout" ? "Texte (affiché aux joueurs)" : isPlace ? "Description (ambiance, ce qu'on y trouve, secrets…)" : "Description et notes"}>
        <textarea rows={5} value={item.text} onChange={(ev) => set({ text: ev.target.value })} className={inputCls} style={{ ...inputStyle, resize: "vertical" }} />
      </Field>

      {item.type === "quest" && (
        <div>
          <SectionTitle>Objectifs</SectionTitle>
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

      {isPlace && (
        <>
          <div>
            <SectionTitle>Qui se trouve ici ({residents.length})</SectionTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {residents.map((e) => (
                <Chip key={e.id} onClick={() => openEditor(e.id)} onRemove={() => set({ residents: item.residents.filter((id) => id !== e.id) })} title={`Ouvrir la fiche (${KINDS[e.kind].single})`}>
                  <Portrait e={e} size={18} /> {e.name}
                </Chip>
              ))}
              <select
                value=""
                onChange={(ev) => ev.target.value && set({ residents: [...(item.residents || []), ev.target.value] })}
                className="rounded-md px-1.5 py-1 text-xs outline-none"
                style={inputStyle}
                aria-label="Ajouter un occupant"
              >
                <option value="">+ PNJ, monstre ou personnage…</option>
                {["npc", "monster", "pc"].map((k) => {
                  const list = entities.filter((e) => e.kind === k && !(item.residents || []).includes(e.id));
                  return list.length ? (
                    <optgroup key={k} label={KINDS[k].label}>
                      {list.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>
            </div>
          </div>

          <div>
            <SectionTitle>Quêtes liées à ce lieu ({quests.length})</SectionTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {quests.map((q) => (
                <Chip key={q.id} onClick={() => select(q.id)} title="Ouvrir la quête">
                  <span style={{ color: QUEST_STATUS[q.status]?.color }}>●</span> {q.name || "Sans nom"}
                </Chip>
              ))}
              <button onClick={() => create({ placeId: item.id }, "quest")} className="inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--arcane)" }}>
                <Plus size={11} /> Nouvelle quête ici
              </button>
            </div>
          </div>

          <div>
            <SectionTitle>Lieux à l'intérieur ({children.length})</SectionTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              {children
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name, "fr"))
                .map((c) => (
                  <Chip key={c.id} onClick={() => select(c.id)} title="Ouvrir ce lieu">
                    {placeIcon(c)} {c.name || "Sans nom"}
                  </Chip>
                ))}
              <button onClick={() => create({ parentId: item.id })} className="inline-flex items-center gap-1 text-[11px] underline" style={{ color: "var(--arcane)" }}>
                <Plus size={11} /> Ajouter un lieu ici
              </button>
            </div>
          </div>

          {item.parentId && (
            <button onClick={() => select(item.parentId)} className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--muted)" }}>
              <CornerLeftUp size={12} /> Revenir au lieu parent
            </button>
          )}
        </>
      )}

      {item.type === "quest" && item.placeId && (
        <button onClick={() => select(item.placeId)} className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--arcane)" }}>
          <MapIcon size={12} /> Voir le lieu : {places.find((p) => p.id === item.placeId)?.name || "?"}
        </button>
      )}
    </div>
  );
}
