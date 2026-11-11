import { useState } from "react";
import { Plus, Search, BookOpen } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import { newEntity, profBonus, plain } from "../../utils/helpers.js";
import { inputStyle } from "../ui/form.jsx";
import Portrait from "../ui/Portrait.jsx";
import HpBar from "../ui/HpBar.jsx";
import ConditionChips from "../ui/ConditionChips.jsx";
import Bestiary from "./Bestiary.jsx";

const SORTS = {
  created: { label: "Ordre de création", fn: null },
  name: { label: "Nom", fn: (a, b) => a.name.localeCompare(b.name, "fr") },
  hurt: { label: "Plus blessés d'abord", fn: (a, b) => a.hp / (a.hpMax || 1) - b.hp / (b.hpMax || 1) },
  power: { label: "Niveau / FP", fn: (a, b) => profBonus(b) - profBonus(a) || (b.level || 0) - (a.level || 0) },
};

/** Grille de cartes pour un type d'entité (personnages, PNJ ou monstres). */
export default function Roster({ kind, entities, setEntities, openEditor }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("created");
  const [bestiary, setBestiary] = useState(false);
  const all = entities.filter((e) => e.kind === kind);
  const q = plain(query);
  const list = all.filter((e) => !q || plain([e.name, e.race, e.clazz, e.background, e.notes].join(" ")).includes(q));
  if (SORTS[sort].fn) list.sort(SORTS[sort].fn);
  const K = KINDS[kind];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <h2 className="text-lg md:text-xl mr-auto" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
          {K.label}{" "}
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            ({all.length})
          </span>
        </h2>
        {all.length > 1 && (
          <>
            <label className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
              <input
                type="search"
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder="Rechercher…"
                className="w-40 rounded-md pl-7 pr-2 py-1.5 text-sm outline-none"
                style={inputStyle}
                aria-label="Rechercher"
              />
            </label>
            <select value={sort} onChange={(ev) => setSort(ev.target.value)} className="rounded-md px-2 py-1.5 text-sm outline-none" style={inputStyle} aria-label="Trier">
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          onClick={() => {
            const e = newEntity(kind);
            setEntities((p) => [...p, e]);
            openEditor(e.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-transform active:scale-95"
          style={{ background: "var(--gold)", color: "#1a1409" }}
        >
          <Plus size={15} /> Créer
        </button>
        {kind === "monster" && (
          <button onClick={() => setBestiary(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold" style={inputStyle}>
            <BookOpen size={15} /> Bestiaire SRD
          </button>
        )}
      </div>
      {bestiary && <Bestiary onAdd={(e) => setEntities((p) => [...p, e])} onClose={() => setBestiary(false)} />}

      {all.length > 0 && list.length === 0 ? (
        <div className="rounded-xl p-6 text-center text-sm" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          Aucun résultat pour « {query} ».
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--edge)", color: "var(--muted)" }}>
          <K.icon size={32} className="mx-auto mb-3 opacity-50" />
          Aucun {K.single.toLowerCase()} pour l'instant. Créez-en un pour commencer votre campagne.
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() => openEditor(e.id)}
              className="text-left rounded-xl p-3 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--panel)", border: "1px solid var(--edge)", boxShadow: "0 2px 8px rgba(0,0,0,.35)" }}
            >
              <div className="flex items-center gap-3">
                <Portrait e={e} size={52} dead={e.hp === 0} />
                <div className="min-w-0 flex-1">
                  <div className="truncate" style={{ fontFamily: "var(--display)", color: "var(--parchment)", fontSize: 16 }}>
                    {e.name}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                    {[
                      e.race,
                      e.kind === "monster" ? e.cr && `FP ${e.cr.replace(/^FP\s*/i, "")}` : e.clazz,
                      e.kind !== "monster" && `niv. ${e.level}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </div>
              <div className="mt-2.5">
                <HpBar e={e} />
              </div>
              <ConditionChips e={e} size="sm" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
