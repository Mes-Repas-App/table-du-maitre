import { useEffect } from "react";

/** Ferme un menu ouvert au clic à l'extérieur de `ref` ou avec Échap. */
export function useDismiss(ref, open, close) {
  useEffect(() => {
    if (!open) return;
    const onDown = (ev) => ref.current && !ref.current.contains(ev.target) && close();
    const onKey = (ev) => ev.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, open, close]);
}
