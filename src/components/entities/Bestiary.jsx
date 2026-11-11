import { useState, useEffect, useRef } from "react";
import { X, Search, BookOpen, Check, Upload } from "lucide-react";
import { SRD, srdSummary, fromOpen5e, fromOpen5eV2 } from "../../data/srd.js";
import { useRules } from "../../hooks/useRules.js";
import { inputStyle } from "../ui/form.jsx";

/**
 * Recherche de monstres du SRD (5.2 pour les règles 2024, 5.1 pour 2014) via l'API Open5e
 * (nécessite une connexion), ou import d'un fichier JSON de créatures Open5e.
 */
export default function Bestiary({ onAdd, onClose }) {
  const rules = useRules();
  const src = SRD[rules] || SRD[2024];
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | error
  const [added, setAdded] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const search = async (ev) => {
    ev.preventDefault();
    if (!query.trim()) return;
    setState("loading");
    try {
      const res = await fetch(src.search(query.trim()));
      if (!res.ok) throw new Error(res.status);
      setResults((await res.json()).results || []);
      setState("idle");
    } catch {
      setState("error");
    }
  };

  const add = (m) => {
    onAdd(src.convert(m));
    setAdded((p) => [...p, srdSummary(m).key]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-2 md:p-6 overflow-y-auto" style={{ background: "rgba(10,8,5,.8)" }} onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Bestiaire SRD" className="w-full max-w-xl rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <BookOpen size={16} style={{ color: "var(--gold)" }} />
          <span className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Bestiaire SRD {rules === "2014" ? "5.1 (règles 2014)" : "5.2 (règles 2024)"}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-md" style={inputStyle} title="Fermer (Échap)">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 space-y-3 text-sm">
          <form onSubmit={search} className="flex gap-1.5">
            <input
              autoFocus
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder="Nom anglais : goblin, owlbear, dragon…"
              className="flex-1 min-w-0 rounded-md px-2.5 py-1.5 outline-none"
              style={inputStyle}
              aria-label="Rechercher un monstre"
            />
            <button className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold" style={{ background: "var(--gold)", color: "#1a1409" }}>
              <Search size={13} /> Chercher
            </button>
          </form>

          {state === "loading" && <div style={{ color: "var(--muted)" }}>Recherche…</div>}
          {state === "error" && <div style={{ color: "var(--blood-l)" }}>Impossible de joindre le bestiaire en ligne. Vérifiez votre connexion, ou importez un fichier JSON.</div>}
          {results && state === "idle" && !results.length && <div style={{ color: "var(--muted)" }}>Aucun monstre trouvé. Les noms du SRD sont en anglais.</div>}

          {results?.length > 0 && (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {results.map((m) => {
                const sum = srdSummary(m);
                const done = added.includes(sum.key);
                return (
                  <div key={sum.key} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ color: "var(--parchment)" }}>
                        {m.name}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                        {sum.line}
                      </div>
                    </div>
                    <button
                      onClick={() => add(m)}
                      className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold"
                      style={done ? { ...inputStyle, color: "var(--life-l)" } : { background: "var(--gold)", color: "#1a1409" }}
                      title={done ? "Ajouté — cliquer pour en ajouter une autre fiche" : "Ajouter aux monstres"}
                    >
                      {done ? <Check size={12} /> : null} {done ? "Ajouté" : "Ajouter"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px]" style={{ color: "var(--muted)" }}>
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md px-2 py-1" style={inputStyle}>
              <Upload size={12} /> Importer un fichier JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (!f) return;
                try {
                  const data = JSON.parse(await f.text());
                  const list = Array.isArray(data) ? data : data.results || [data];
                  const valid = list.filter((m) => m && typeof m.name === "string");
                  // Format v2 (SRD 5.2) reconnu à ses caractéristiques groupées
                  valid.forEach((m) => onAdd(m.ability_scores ? fromOpen5eV2(m) : fromOpen5e(m)));
                  alert(`${valid.length} monstre${valid.length > 1 ? "s" : ""} importé${valid.length > 1 ? "s" : ""}.`);
                } catch {
                  alert("Fichier JSON invalide (format attendu : créatures Open5e).");
                }
              }}
            />
            <span className="flex-1">{src.credit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
