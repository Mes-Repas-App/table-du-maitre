import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { inputStyle } from "./form.jsx";

/** Petite fenêtre de saisie (nom de campagne…), utilisable au doigt sur tablette */
export default function TextDialog({ title, initial = "", okLabel = "Valider", onOk, onClose, validate }) {
  const [value, setValue] = useState(initial);
  const error = value.trim() && validate ? validate(value.trim()) : null; // message si la saisie est refusée

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
      <form
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-xl shadow-2xl p-4 space-y-3"
        style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!value.trim() || error) return;
          onOk(value.trim());
          onClose();
        }}
      >
        <div className="flex items-center gap-2">
          <span className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            {title}
          </span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md" style={inputStyle} title="Annuler (Échap)">
            <X size={14} />
          </button>
        </div>
        <input
          autoFocus
          value={value}
          onChange={(ev) => setValue(ev.target.value)}
          onFocus={(ev) => ev.target.select()}
          className="w-full rounded-md px-2.5 py-2 text-sm outline-none"
          style={inputStyle}
          aria-label={title}
          aria-invalid={!!error}
        />
        {error && (
          <p className="text-xs" style={{ color: "var(--blood-l)" }} role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm" style={inputStyle}>
            Annuler
          </button>
          <button disabled={!value.trim() || !!error}className="rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40" style={{ background: "var(--gold)", color: "#1a1409" }}>
            {okLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
