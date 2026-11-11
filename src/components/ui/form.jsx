import { useState } from "react";

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
