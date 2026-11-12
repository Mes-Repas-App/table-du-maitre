import { useEffect } from "react";
import { X, MonitorPlay } from "lucide-react";
import { inputStyle } from "./form.jsx";

/** Image en grand, avec possibilité de la montrer sur l'écran joueurs */
export default function Lightbox({ src, title, onClose, onShow }) {
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
    <div role="dialog" aria-modal="true" aria-label={title || "Image"} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-3" style={{ background: "rgba(10,8,5,.94)" }} onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <img src={src} alt={title || ""} className="max-w-full max-h-[80vh] rounded-lg shadow-2xl" style={{ border: "1px solid var(--edge)" }} />
      <div className="flex gap-2">
        {onShow && (
          <button onClick={onShow} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
            <MonitorPlay size={15} /> Montrer aux joueurs
          </button>
        )}
        <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm" style={inputStyle} title="Fermer (Échap)">
          <X size={15} /> Fermer
        </button>
      </div>
    </div>
  );
}
