import { KINDS } from "../../data/reference.js";

/** `size` en pixels, ou toute longueur CSS (ex. « 5cqw » pour suivre la grille). */
export default function Portrait({ e, size = 56, active, dead }) {
  const ring = KINDS[e.kind]?.ring || "var(--gold)";
  const dim = typeof size === "number" ? `${size}px` : size;
  return (
    <div
      className="relative rounded-full flex items-center justify-center overflow-hidden select-none shrink-0"
      style={{
        width: dim,
        height: dim,
        background: "var(--well)",
        border: `2px solid ${active ? "var(--gold)" : ring}`,
        boxShadow: active
          ? "0 0 0 3px rgba(201,162,39,.35), 0 0 18px rgba(201,162,39,.45)"
          : "0 2px 6px rgba(0,0,0,.5)",
        filter: dead ? "grayscale(1) brightness(.6)" : "none",
      }}
    >
      {e.image ? (
        <img src={e.image} alt={e.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span style={{ fontFamily: "var(--display)", color: ring, fontSize: `calc(${dim} * 0.42)` }}>
          {(e.name || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      {dead && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: `calc(${dim} * 0.5)` }}>
          💀
        </span>
      )}
    </div>
  );
}
