import { useState, useEffect } from "react";
import { X, History } from "lucide-react";
import { inputStyle } from "../ui/form.jsx";

/** Liste des copies de secours automatiques de la campagne ouverte */
export default function BackupsDialog({ listBackups, restore, onClose }) {
  const [list, setList] = useState(null);

  useEffect(() => {
    listBackups().then(setList, () => setList([]));
  }, [listBackups]);

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(10,8,5,.8)" }} onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Copies de secours" className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <History size={16} style={{ color: "var(--gold)" }} />
          <span className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Copies de secours
          </span>
          <button onClick={onClose} className="p-1.5 rounded-md" style={inputStyle} title="Fermer (Échap)">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 space-y-1.5 text-sm">
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Une copie est faite automatiquement au plus une fois par heure ; les 10 dernières sont gardées dans ce navigateur. Restaurer est annulable avec Ctrl+Z.
          </p>
          {list === null && <div style={{ color: "var(--muted)" }}>Chargement…</div>}
          {list?.length === 0 && <div style={{ color: "var(--muted)" }}>Aucune copie pour l'instant.</div>}
          {list?.map((b) => (
            <div key={b.t} className="flex items-center gap-2 rounded-md px-2 py-1.5" style={{ background: "var(--well)", border: "1px solid var(--edge)" }}>
              <div className="flex-1 min-w-0">
                <div style={{ color: "var(--parchment)" }}>{new Date(b.t).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {b.data.entities?.length || 0} fiches · {b.data.combats?.length || 0} combats · {b.data.sessions?.length || 0} sessions · {b.data.world?.length || 0} éléments du monde
                </div>
              </div>
              <button
                onClick={() => {
                  if (!confirm("Remplacer l'état actuel de la campagne par cette copie ? (Ctrl+Z pour revenir en arrière)")) return;
                  restore(b.data);
                  onClose();
                }}
                className="rounded-md px-2.5 py-1 text-xs font-semibold"
                style={{ background: "var(--gold)", color: "#1a1409" }}
              >
                Restaurer
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
