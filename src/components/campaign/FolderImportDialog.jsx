import { useState, useEffect } from "react";
import { FolderInput, X } from "lucide-react";
import { inputStyle } from "../ui/form.jsx";

/**
 * Au choix du dossier : pour chaque campagne d'ici qui a déjà un fichier à son nom (mais
 * différent), charger la version du dossier ou garder celle d'ici ; les autres fichiers
 * peuvent être importés en nouvelles campagnes.
 * Avec le bouton « Importer » (`fromFile`) : mettre à jour la campagne existante, ou l'ajouter.
 * Rien n'est perdu : une campagne remplacée garde sa version précédente dans les copies de secours.
 */
export default function FolderImportDialog({ found, onDone, fromFile }) {
  const [choice, setChoice] = useState(() =>
    Object.fromEntries(
      found.map((c) => [
        c.fileName,
        c.byName ? { on: true, mode: "update" } : fromFile && c.target ? { on: true, mode: c.sure ? "update" : "new" } : { on: true, mode: "new" },
      ])
    )
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
  const date = (t) => new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const detail = ({ entities, combats, sessions, world }) =>
    [entities && `${entities} fiche${entities > 1 ? "s" : ""}`, combats && `${combats} combat${combats > 1 ? "s" : ""}`, sessions && `${sessions} session${sessions > 1 ? "s" : ""}`, world && `${world} élément${world > 1 ? "s" : ""} du monde`]
      .filter(Boolean)
      .join(" · ") || "vide";
  const hasExisting = found.some((c) => c.byName);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(10,8,5,.8)" }}>
      <div role="dialog" aria-modal="true" aria-labelledby="folder-import-title" className="w-full max-w-md rounded-xl shadow-2xl" style={{ background: "var(--panel)", border: "1px solid var(--edge)" }}>
        <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--edge)" }}>
          <FolderInput size={16} style={{ color: "var(--gold)" }} />
          <span id="folder-import-title" className="flex-1" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            {fromFile ? "Importer une campagne" : "Campagnes dans le dossier"}
          </span>
          <button onClick={() => onDone([])} className="p-1.5 rounded-md" style={inputStyle} title="Fermer (Échap)" aria-label="Fermer">
            <X size={14} />
          </button>
        </div>
        <div className="p-3 space-y-2 text-sm">
          {found.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Aucune autre campagne dans ce dossier : tout ce qu'il contient est déjà dans l'appli.
            </p>
          ) : (
            <>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {fromFile
                  ? "Cette campagne existe déjà ici. La mettre à jour avec le contenu du fichier, ou l'ajouter comme nouvelle campagne ?"
                  : hasExisting
                    ? "Le dossier contient déjà un fichier pour certaines de vos campagnes (le fichier porte le nom de la campagne). Choisissez quelle version garder ; les autres campagnes du dossier peuvent être importées."
                    : "Ces campagnes du dossier n'existent pas encore ici : cochez celles à importer."}{" "}
                Une version remplacée reste disponible dans les <b>copies de secours</b>.
              </p>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {found.map((c) => {
                  const { on, mode } = choice[c.fileName];
                  return (
                    <div key={c.fileName} className="flex items-start gap-2 rounded-md px-2 py-1.5" style={{ background: on ? "var(--well)" : "transparent", border: "1px solid var(--edge)" }}>
                      {!c.byName && <input type="checkbox" checked={on} onChange={(ev) => set(c.fileName, { on: ev.target.checked })} className="mt-1" aria-label={`Prendre « ${c.name} »`} />}
                      <span className="flex-1 min-w-0 space-y-1">
                        <span className="block truncate" style={{ color: "var(--parchment)" }}>
                          {c.fileName}
                        </span>
                        <span className="block text-[11px] truncate" style={{ color: "var(--muted)" }}>
                          {detail(c.counts)} · enregistré le {date(c.savedAt)}
                        </span>
                        {c.byName ? (
                          <select value={mode} onChange={(ev) => set(c.fileName, { mode: ev.target.value })} className="w-full rounded-md px-2 py-1 text-xs outline-none" style={inputStyle} aria-label={`Quelle version garder pour « ${c.targetName} »`}>
                            <option value="update">Charger la version du dossier dans « {c.targetName} »</option>
                            <option value="keep">Garder la version de cet appareil (remplace le fichier)</option>
                          </select>
                        ) : fromFile && c.target ? (
                          <select value={mode} onChange={(ev) => set(c.fileName, { mode: ev.target.value })} className="w-full rounded-md px-2 py-1 text-xs outline-none" style={inputStyle} aria-label={`Que faire de « ${c.name} »`}>
                            <option value="update">Mettre à jour « {c.targetName} »</option>
                            <option value="new">L'ajouter comme nouvelle campagne</option>
                          </select>
                        ) : (
                          <span className="block text-[11px]" style={{ color: "var(--arcane)" }}>
                            Nouvelle campagne « {c.name} »
                          </span>
                        )}
                        {fromFile && c.target && !c.sure && mode === "update" && (
                          <span className="block text-[11px]" style={{ color: "var(--blood-l)" }}>
                            Seul le nom est identique : vérifiez qu'il s'agit bien de la même campagne avant de remplacer « {c.targetName} ».
                          </span>
                        )}
                        {c.byName && mode === "keep" && !c.empty && (
                          <span className="block text-[11px]" style={{ color: "var(--blood-l)" }}>
                            Le fichier du dossier sera écrasé par la version de cet appareil.
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
              {found.length ? "Annuler" : "Fermer"}
            </button>
            {found.length > 0 && (
              <button onClick={() => onDone(selected)} className="rounded-md px-3 py-1.5 font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
                Valider
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
