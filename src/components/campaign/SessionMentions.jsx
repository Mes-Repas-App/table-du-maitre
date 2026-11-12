import { ScrollText } from "lucide-react";
import { sessionsMentioning } from "../../utils/helpers.js";
import { inputStyle } from "../ui/form.jsx";

/** Sessions où apparaît une fiche, un lieu ou une quête (liens retour) */
export default function SessionMentions({ sessions, id, onOpen }) {
  const list = sessionsMentioning(sessions, id);
  return (
    <div>
      <span className="block text-[11px] uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
        Dans les sessions ({list.length})
      </span>
      {list.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Pas encore apparu en session. Liez-le à une scène depuis l'onglet Sessions.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {list.map((s) => (
            <button key={s.id} onClick={() => onOpen(s.id)} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs" style={{ ...inputStyle, background: "var(--chip)" }} title="Ouvrir la session">
              <ScrollText size={11} style={{ color: "var(--gold)" }} /> {s.title || "Sans titre"}
              {s.date && <span style={{ color: "var(--muted)" }}>· {new Date(`${s.date}T12:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
