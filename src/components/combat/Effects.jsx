import { useState } from "react";
import { Hourglass, X, Plus } from "lucide-react";
import { CONDITIONS } from "../../data/reference.js";
import { NumInput, inputStyle } from "../ui/form.jsx";

/* Effets courants proposés à la saisie (texte libre possible) */
const SUGGESTIONS = ["Bénédiction", "Bouclier de la foi", "Hâte", "Lenteur", "Invisibilité", "Toile d'araignée", "Immobilisation de personne", "Faveur divine", "Marque du chasseur", "Maléfice"];

/**
 * Effets à durée limitée d'un pion : décomptés au début du tour d'un combattant
 * (par défaut celui qui joue au moment de l'ajout, souvent le lanceur), retirés à 0
 * avec l'état associé.
 */
export default function Effects({ t, effects, pieces, activeId, add, remove }) {
  const [label, setLabel] = useState("");
  const [rounds, setRounds] = useState(10);
  const [conditionId, setConditionId] = useState("");
  const [ownerId, setOwnerId] = useState(activeId || t.id);
  const name = (id) => pieces.find((p) => p.t.id === id)?.f.name || "?";

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
        Effets temporaires
      </span>
      {effects.map((ef) => (
        <div key={ef.id} className="flex items-center gap-1.5 text-xs py-0.5" style={{ color: "var(--parchment)" }}>
          <Hourglass size={12} style={{ color: "var(--arcane)" }} />
          <span className="flex-1 min-w-0 truncate">
            {ef.label}
            {ef.conditionId && <span style={{ color: "var(--muted)" }}> ({CONDITIONS.find((c) => c.id === ef.conditionId)?.label})</span>}
          </span>
          <b style={{ color: ef.rounds <= 1 ? "var(--blood-l)" : "var(--arcane)" }} title={`Décompté au début du tour de ${name(ef.ownerId)}`}>
            {ef.rounds} round{ef.rounds > 1 ? "s" : ""}
          </b>
          <button onClick={() => remove(ef)} className="p-0.5" style={{ color: "var(--muted)" }} aria-label={`Terminer ${ef.label}`}>
            <X size={12} />
          </button>
        </div>
      ))}
      <form
        className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 text-xs"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!label.trim()) return;
          add({ tokenId: t.id, label: label.trim(), rounds: Math.max(1, rounds), conditionId: conditionId || null, ownerId: pieces.some((p) => p.t.id === ownerId) ? ownerId : t.id });
          setLabel("");
          setConditionId("");
        }}
      >
        <input list="effect-names" value={label} onChange={(ev) => setLabel(ev.target.value)} placeholder="Bénédiction, Hâte…" className="min-w-0 rounded-md px-2 py-1 outline-none" style={inputStyle} aria-label="Effet" />
        <datalist id="effect-names">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <label className="inline-flex items-center gap-1" style={{ color: "var(--muted)" }} title="1 minute = 10 rounds">
          <NumInput min="1" value={rounds} onChange={(v) => setRounds(Math.max(1, v))} className="w-12 rounded-md px-1 py-1 text-center outline-none" style={inputStyle} aria-label="Durée en rounds" />
          rds
        </label>
        <select value={conditionId} onChange={(ev) => setConditionId(ev.target.value)} className="min-w-0 rounded-md px-1.5 py-1 outline-none" style={inputStyle} aria-label="État appliqué">
          <option value="">Sans état associé</option>
          {CONDITIONS.map((c) => (
            <option key={c.id} value={c.id}>
              + état {c.label}
            </option>
          ))}
        </select>
        <button className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 font-bold" style={{ background: "var(--arcane)", color: "#0d0f16" }}>
          <Plus size={12} /> Ajouter
        </button>
        <label className="col-span-2 inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          Décompté au tour de
          <select value={ownerId} onChange={(ev) => setOwnerId(ev.target.value)} className="flex-1 min-w-0 rounded-md px-1.5 py-1 outline-none" style={inputStyle} aria-label="Décompté au tour de">
            {pieces.map((p) => (
              <option key={p.t.id} value={p.t.id}>
                {p.f.name}
                {p.t.id === activeId ? " (joue en ce moment)" : ""}
              </option>
            ))}
          </select>
        </label>
      </form>
    </div>
  );
}
