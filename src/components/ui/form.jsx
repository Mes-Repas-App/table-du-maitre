import { useState, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";

/* Styles partagés des champs de formulaire + composant d'étiquette */

export const inputCls = "w-full rounded-md px-2.5 py-1.5 text-sm outline-none";
export const inputStyle = {
  background: "var(--well)",
  border: "1px solid var(--edge)",
  color: "var(--parchment)",
};

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

/** Noms par défaut des éléments neufs : leur champ de nom est sélectionné d'office */
const FRESH_NAME = /^Nouve(au|lle) /;

/**
 * Nom d'un élément (fiche, lieu, quête, session, rencontre) : grand et lisible comme un
 * titre, mais visiblement modifiable (souligné pointillé + crayon). Pour un élément neuf,
 * le nom par défaut est sélectionné : il suffit de taper pour le remplacer.
 */
export function TitleInput({ value, onChange, label = "Nom", size = "text-xl", className = "", placeholder }) {
  const ref = useRef(null);
  const fresh = FRESH_NAME.test(value);
  useEffect(() => {
    if (fresh) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- seulement à l'ouverture
  return (
    <label className={`group relative flex items-center min-w-0 ${className}`} title="Cliquer pour modifier le nom">
      <input
        ref={ref}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder || label}
        aria-label={label}
        className={`w-full min-w-0 bg-transparent rounded-md pl-1.5 pr-8 py-1 outline-none border border-transparent border-b-[var(--edge2)] border-dashed hover:border-[var(--edge2)] focus:border-solid focus:border-[var(--gold)] ${size}`}
        style={{ fontFamily: "var(--display)", color: "var(--parchment)", boxShadow: "none" }}
      />
      <Pencil size={14} className="absolute right-2 pointer-events-none opacity-50 group-hover:opacity-100 group-focus-within:opacity-0" style={{ color: "var(--gold)" }} />
    </label>
  );
}

/** Champ numérique qu'on peut vider le temps de retaper une valeur
    (sans repasser par 0 à chaque effacement). */
export function NumInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      type="number"
      {...props}
      value={draft ?? value}
      onChange={(ev) => {
        setDraft(ev.target.value);
        if (ev.target.value !== "" && !Number.isNaN(Number(ev.target.value))) onChange(Number(ev.target.value));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
