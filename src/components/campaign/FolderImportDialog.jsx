import { useState, useEffect } from "react";
import { FolderInput, RefreshCw, X } from "lucide-react";
import { inputStyle } from "../ui/form.jsx";

/**
 * Sauvegardes trouvées dans le dossier choisi. Celles d'une campagne déjà présente ici
 * (venue d'un autre appareil) peuvent la mettre à jour ; les autres deviennent de nouvelles
 * campagnes. Rien n'est perdu : une campagne mise à jour garde sa version précédente dans
 * les copies de secours, et les fichiers du dossier ne sont jamais modifiés.
 */
export default function FolderImportDialog({ found, onDone, fromFile }) {
  // Par défaut : mise à jour avec une version plus récente de la même campagne ; si seul le nom
  // correspond (peut-être une autre campagne), ajout en nouvelle campagne : rien n'est écrasé sans le choisir
  const [choice, setChoice] = useState(() =>
    Object.fromEntries(found.map((c) => [c.fileName, c.target && c.sure ? { on: c.newer, mode: "update" } : { on: true, mode: "new" }]))
  );

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key !== "Escape") return;
      ev.stopPropagation();
      onDone([]);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onDone]);

  const set = (fileName, patch) => setChoice((p) => ({ ...p, [fileName]: { ...p[fileName], ...patch } }));
  const selected = found.filter((c) => choice[c.fileName].on).map((c) => ({ ...c, mode: choice[c.fileName].mode }));
  const onlyUpdates = !fromFile && found.length > 0 && found.every((c) => c.target && c.sure && c.newer);
  const date = (t) => new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const detail = ({ entities, combats, sessions, world }) =>
    [entities && `${entities} fiche${entities > 1 ? "s" : ""}`, combats && `${combats} combat${combats > 1 ? "s" : ""}`, sessions && `${sessions} session${sessions > 1 ? "s" : ""}`, world && `${world} élément${world > 1 ? "s" : ""} du monde`]
      .filter(Boolean)
      .join(" · ") || "vide";
  const okLabel = selected.length && selected.every((c) => c.mode === "update") ? "Mettre à jour" : "Importer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(10,8,5,.8)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="folder-import-title" className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          {onlyUpdates ? <RefreshCw size={16} style={{ color: "var(--gold)" }} /> : <FolderInput size={16} style={{ color: "var(--gold)" }} />}
          <span id="folder-import-title" className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            {fromFile ? "Importer une campagne" : onlyUpdates ? "Version plus récente sur un autre appareil" : "Sauvegardes trouvées"}
          </span>
          <button onClick={() => onDone([])} className="p-1.5 rounded-md" style={inputStyle} title="Ne rien changer (Échap)" aria-label="Ne rien changer">
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
                {fromFile
                  ? "Cette campagne existe déjà ici. La mettre à jour avec le contenu du fichier, ou l'ajouter comme nouvelle campagne ?"
                  : onlyUpdates
                    ? "Un autre appareil a enregistré une version plus récente de votre campagne dans le dossier de sauvegarde. La mettre à jour ici ?"
                    : "Ce dossier contient des campagnes enregistrées ailleurs. Choisissez pour chacune : mettre à jour la même campagne ici, ou l'ajouter comme nouvelle campagne."}{" "}
                La version remplacée reste disponible dans les <b>copies de secours</b> (et Ctrl+Z annule la mise à jour de la campagne ouverte).
              </p>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {found.map((c) => {
                  const { on, mode } = choice[c.fileName];
                  return (
                    <div key={c.fileName} className="flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: on ? "var(--well)" : "transparent", border: "1px solid var(--edge)" }}>
                      <input type="checkbox" checked={on} onChange={(ev) => set(c.fileName, { on: ev.target.checked })} className="mt-1" aria-label={`Prendre « ${c.name} »`} />
                      <span className="flex-1 min-w-0 space-y-1">
                        <span className="block truncate" style={{ color: "var(--parchment)" }}>
                          {c.name}
                        </span>
                        <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>
                          {detail(c.counts)} · enregistrée le {date(c.savedAt)}
                        </span>
                        {c.target ? (
                          <select value={mode} onChange={(ev) => set(c.fileName, { mode: ev.target.value, on: true })} className="w-full rounded-md px-2 py-1 text-xs outline-none" style={inputStyle} aria-label={`Que faire de « ${c.name} »`}>
                            <option value="update">Mettre à jour « {c.targetName} »</option>
                            <option value="new">L'ajouter comme nouvelle campagne</option>
                          </select>
                        ) : (
                          <span className="block text-[11px]" style={{ color: "var(--arcane)" }}>
                            Nouvelle campagne
                          </span>
                        )}
                        {c.target && !c.sure && mode === "update" && (
                          <span className="block text-[11px]" style={{ color: "var(--blood-l)" }}>
                            Seul le nom est identique : vérifiez qu'il s'agit bien de la même campagne avant de remplacer « {c.targetName} ».
                          </span>
                        )}
                        {c.target && !c.newer && mode === "update" && (
                          <span className="block text-[11px]" style={{ color: "var(--blood-l)" }}>
                            Attention : plus ancienne que votre version actuelle de « {c.targetName} ».
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onDone([])} className="rounded-md px-3 py-1.5" style={inputStyle}>
              {found.length ? (onlyUpdates ? "Plus tard" : "Ne rien changer") : "Fermer"}
            </button>
            {found.length > 0 && (
              <button onClick={() => onDone(selected)} disabled={!selected.length} className="rounded-md px-3 py-1.5 font-semibold disabled:opacity-40" style={{ background: "var(--gold)", color: "#1a1409" }}>
                {okLabel} {found.length > 1 && `(${selected.length})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
