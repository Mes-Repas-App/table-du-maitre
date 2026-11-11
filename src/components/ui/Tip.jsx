/* Info-bulle affichée au survol ou au focus (clavier, tablette) : utilisée
   pour les règles des états, les caractéristiques, etc. */
export default function Tip({ text, children, wide }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden group-hover:block group-focus-within:block bottom-full left-1/2 -translate-x-1/2 mb-2 ${wide ? "w-64" : "w-52"}`}
      >
        <span
          className="block rounded-md px-3 py-2 text-xs leading-snug shadow-xl"
          style={{ background: "var(--tip-bg)", color: "var(--parchment)", border: "1px solid var(--edge)" }}
        >
          {text}
        </span>
      </span>
    </span>
  );
}
