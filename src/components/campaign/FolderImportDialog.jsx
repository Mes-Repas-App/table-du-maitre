import { useState, useEffect } from "react";
import { FolderInput, X } from "lucide-react";
import { inputStyle } from "../ui/form.jsx";

/**
 * Sauvegardes trouvées dans le dossier choisi : l'utilisateur coche celles à importer.
 * Chacune devient une nouvelle campagne ; rien n'est écrasé, ni dans l'appli ni dans le dossier.
 */
export default function FolderImportDialog({ found, onDone }) {
  const [picked, setPicked] = useState(() => found.map((c) => c.fileName));

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onDone([]);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  const selected = found.filter((c) => picked.includes(c.fileName));
  const detail = ({ entities, combats, sessions, world }) =>
    [entities && `${entities} fiche${entities > 1 ? "s" : ""}`, combats && `${combats} combat${combats > 1 ? "s" : ""}`, sessions && `${sessions} session${sessions > 1 ? "s" : ""}`, world && `${world} élément${world > 1 ? "s" : ""} du monde`]
      .filter(Boolean)
      .join(" · ") || "vide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(10,8,5,.8)" }}>
      <div role="dialog" aria-modal="true" aria-label="Sauvegardes trouvées" className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <FolderInput size={16} style={{ color: "var(--gold)" }} />
          <span className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Sauvegardes trouvées
          </span>
          <button onClick={() => onDone([])} className="p-1.5 rounded-md" style={inputStyle} title="Ne rien importer (Échap)" aria-label="Ne rien importer">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 space-y-2 text-sm">
          {found.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Aucune nouvelle sauvegarde dans ce dossier : tout ce qu'il contient est déjà dans l'appli.
            </p>
          ) : (
            <>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Ce dossier contient déjà des campagnes. Cochez celles à importer : chacune sera ajoutée comme <b>nouvelle campagne</b>. Rien n'est écrasé, ni vos campagnes actuelles, ni les fichiers du dossier.
              </p>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {found.map((c) => {
                  const on = picked.includes(c.fileName);
                  return (
                    <label key={c.fileName} className="flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer" style={{ background: on ? "var(--well)" : "transparent", border: "1px solid var(--edge)" }}>
                      <input type="checkbox" checked={on} onChange={(ev) => setPicked((p) => (ev.target.checked ? [...p, c.fileName] : p.filter((x) => x !== c.fileName)))} className="mt-1" />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ color: "var(--parchment)" }}>
                          {c.name}
                        </span>
                        <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>
                          {detail(c.counts)} · {new Date(c.savedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {c.fileName}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onDone([])} className="rounded-md px-3 py-1.5" style={inputStyle}>
              {found.length ? "Ne rien importer" : "Fermer"}
            </button>
            {found.length > 0 && (
              <button onClick={() => onDone(selected)} disabled={!selected.length} className="rounded-md px-3 py-1.5 font-semibold disabled:opacity-40" style={{ background: "var(--gold)", color: "#1a1409" }}>
                Importer ({selected.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
