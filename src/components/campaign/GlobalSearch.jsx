import { useState, useRef } from "react";
import { Search } from "lucide-react";
import { KINDS } from "../../data/reference.js";
import { WORLD_TYPES, plain } from "../../utils/helpers.js";
import { useDismiss } from "../../hooks/useDismiss.js";
import { inputStyle } from "../ui/form.jsx";

/** Recherche dans toute la campagne : fiches, sessions, monde et combats. */
export default function GlobalSearch({ entities, sessions, world, combats, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  const needle = plain(q.trim());
  const match = (...fields) => plain(fields.flat().join(" ")).includes(needle);
  const results = !needle
    ? []
    : [
        ...entities.filter((e) => match(e.name, e.race, e.clazz, e.background, e.notes, e.attacks, (e.items || []).map((i) => i.name), (e.spells || []).map((s) => s.name))).map((e) => ({ kind: "entity", id: e.id, name: e.name, group: KINDS[e.kind].single })),
        ...world.filter((w) => match(w.name, w.text, w.giver, w.reward, w.objectives.map((o) => o.text))).map((w) => ({ kind: "world", id: w.id, name: w.name, group: WORLD_TYPES[w.type].single })),
        ...sessions.filter((s) => match(s.title, s.summary, s.loot, s.prep.map((p) => p.text))).map((s) => ({ kind: "session", id: s.id, name: s.title, group: "Session" })),
        ...combats.filter((c) => match(c.name)).map((c) => ({ kind: "combat", id: c.id, name: c.name, group: "Combat" })),
      ].slice(0, 15);

  const pick = (r) => {
    onPick(r.kind, r.id);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative" ref={ref}>
      <label className="relative block">
        <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input
          type="search"
          value={q}
          onChange={(ev) => {
            setQ(ev.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(ev) => ev.key === "Enter" && results[0] && pick(results[0])}
          placeholder="Rechercher dans la campagne…"
          className="w-48 md:w-64 rounded-md pl-7 pr-2 py-1 text-xs outline-none"
          style={inputStyle}
          aria-label="Rechercher dans toute la campagne"
        />
      </label>
      {open && needle && (
        <div className="absolute right-0 top-full mt-1 z-40 w-72 max-h-80 overflow-y-auto rounded-lg p-1 shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
          {results.length === 0 && (
            <div className="p-2 text-xs" style={{ color: "var(--muted)" }}>
              Rien trouvé pour « {q} ».
            </div>
          )}
          {results.map((r) => (
            <button key={r.kind + r.id} onClick={() => pick(r)} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/5">
              <span className="truncate flex-1" style={{ color: "var(--parchment)" }}>
                {r.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider shrink-0" style={{ color: "var(--muted)" }}>
                {r.group}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
