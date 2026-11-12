import { X } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import { PLACE_KINDS, placeTree } from "../../utils/helpers.js";
import { inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";
import { QUEST_STATUS } from "./WorldView.jsx";

const icon = (p) => (PLACE_KINDS[p.kind] || PLACE_KINDS.other).icon;

/**
 * Liens d'un élément (scène…) vers des fiches, des lieux et des quêtes : pastilles
 * cliquables (ouvrent la fiche / le lieu / la quête) et un menu pour en ajouter.
 * `links` : { entities: [ids], places: [ids], quests: [ids] }
 */
export default function LinkPicker({ links, onChange, entities, world, onOpenEntity, onOpenWorld }) {
  const linkedEntities = links.entities.map((id) => entities.find((e) => e.id === id)).filter(Boolean);
  const linkedPlaces = links.places.map((id) => world.find((w) => w.id === id)).filter(Boolean);
  const linkedQuests = links.quests.map((id) => world.find((w) => w.id === id)).filter(Boolean);
  const places = world.filter((w) => w.type === "place");
  const quests = world.filter((w) => w.type === "quest");
  const remove = (key, id) => onChange({ [key]: links[key].filter((x) => x !== id) });

  const add = (value) => {
    const [kind, id] = value.split(":");
    const key = { e: "entities", p: "places", q: "quests" }[kind];
    if (key && !links[key].includes(id)) onChange({ [key]: [...links[key], id] });
  };

  const chip = (key, id, onOpen, content, title) => (
    <span key={id} className="inline-flex items-center rounded-full text-xs" style={{ ...inputStyle, background: "var(--chip)" }}>
      <button onClick={onOpen} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5" title={title}>
        {content}
      </button>
      <button onClick={() => remove(key, id)} className="pr-1.5 py-0.5" style={{ color: "var(--muted)" }} aria-label="Retirer le lien">
        <X size={11} />
      </button>
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {linkedEntities.map((e) => chip("entities", e.id, () => onOpenEntity(e.id), <><Portrait e={e} size={18} /> {e.name}</>, `Ouvrir la fiche (${KINDS[e.kind].single})`))}
      {linkedPlaces.map((p) => chip("places", p.id, () => onOpenWorld(p.id), <>{icon(p)} {p.name || "Sans nom"}</>, "Ouvrir le lieu"))}
      {linkedQuests.map((q) => chip("quests", q.id, () => onOpenWorld(q.id), <><span style={{ color: QUEST_STATUS[q.status]?.color }}>●</span> {q.name || "Sans nom"}</>, "Ouvrir la quête"))}
      <select value="" onChange={(ev) => ev.target.value && add(ev.target.value)} className="rounded-md px-1.5 py-1 text-xs outline-none max-w-full" style={inputStyle} aria-label="Lier un personnage, un lieu ou une quête">
        <option value="">+ Lier un personnage, un lieu, une quête…</option>
        {["pc", "npc", "monster"].map((k) => {
          const list = entities.filter((e) => e.kind === k && !links.entities.includes(e.id));
          return list.length ? (
            <optgroup key={k} label={KINDS[k].label}>
              {list.map((e) => (
                <option key={e.id} value={`e:${e.id}`}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
        {places.length > 0 && (
          <optgroup label="Lieux">
            {placeTree(places)
              .filter(({ p }) => !links.places.includes(p.id))
              .map(({ p, depth }) => (
                <option key={p.id} value={`p:${p.id}`}>
                  {"   ".repeat(depth)}
                  {icon(p)} {p.name || "Sans nom"}
                </option>
              ))}
          </optgroup>
        )}
        {quests.some((q) => !links.quests.includes(q.id)) && (
          <optgroup label="Quêtes">
            {quests
              .filter((q) => !links.quests.includes(q.id))
              .map((q) => (
                <option key={q.id} value={`q:${q.id}`}>
                  {q.name || "Sans nom"}
                </option>
              ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
