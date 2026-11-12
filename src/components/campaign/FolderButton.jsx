import { useState, useRef } from "react";
import { FolderOpen, FolderCheck, FolderX, AlertTriangle, Search, LogOut } from "lucide-react";
import { useDismiss } from "../../hooks/useDismiss.js";
import { inputStyle } from "../ui/form.jsx";

const ago = (t) => {
  if (!t) return "pas encore";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  return new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

/** État et réglages du dossier de sauvegarde */
export default function FolderButton({ folder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  const { supported, name, permission, lastWrite, error } = folder;

  const Icon = !supported ? FolderX : error ? AlertTriangle : permission === "granted" ? FolderCheck : FolderOpen;
  const color = error || permission === "prompt" ? "var(--blood-l)" : permission === "granted" ? "var(--gold)" : "var(--muted)";
  const title = !supported
    ? "Dossier de sauvegarde : non disponible dans ce navigateur"
    : permission === "granted"
      ? `Sauvegarde dans le dossier « ${name} » (${ago(lastWrite)})`
      : permission === "prompt"
        ? `Dossier « ${name} » : accès à ré-autoriser`
        : "Choisir un dossier de sauvegarde";
  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    // Sur téléphone, le panneau se cale sur l'en-tête (pleine largeur) plutôt que sur le bouton
    <div className="md:relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-md" style={{ ...inputStyle, color }} title={title} aria-label={title}>
        <Icon size={16} />
        {permission === "prompt" && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "var(--blood-l)" }} />}
      </button>
      {open && (
        <div
          className="absolute inset-x-3 md:inset-x-auto md:right-0 top-full mt-1.5 z-40 md:w-80 rounded-xl p-3 shadow-2xl text-xs space-y-2"
          style={{ background: "var(--panel)", border: "1px solid var(--edge)", color: "var(--muted)" }}
        >
          <div className="text-sm" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Dossier de sauvegarde
          </div>
          {!supported ? (
            <p>
              Ce navigateur ne permet pas de choisir un dossier (c'est possible avec <b>Chrome</b> ou <b>Edge</b> sur ordinateur). Vos campagnes restent enregistrées dans le navigateur ; utilisez <b>Exporter</b> / <b>Importer</b> pour les copier
              ailleurs.
            </p>
          ) : permission === "none" ? (
            <>
              <p>
                Choisissez un dossier : chaque campagne y sera enregistrée dans son propre fichier, mis à jour automatiquement. Astuce : un dossier synchronisé (Google Drive pour ordinateur, OneDrive, Dropbox…) garde aussi une copie en ligne.
              </p>
              <p>S'il contient déjà des sauvegardes, l'appli vous proposera de les importer, sans rien écraser.</p>
              <button onClick={run(folder.choose)} className="w-full rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
                Choisir un dossier…
              </button>
            </>
          ) : (
            <>
              <div>
                Dossier : <b style={{ color: "var(--parchment)" }}>{name}</b>
              </div>
              {permission === "granted" ? (
                <div>
                  Dernier enregistrement : <b style={{ color: "var(--parchment)" }}>{ago(lastWrite)}</b>
                </div>
              ) : (
                <>
                  <p style={{ color: "var(--blood-l)" }}>Le navigateur demande de ré-autoriser l'accès à ce dossier (après un redémarrage, par exemple). En attendant, rien n'y est écrit.</p>
                  <button onClick={run(folder.reconnect)} className="w-full rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
                    Autoriser l'accès
                  </button>
                </>
              )}
              {error && <p style={{ color: "var(--blood-l)" }}>{error}</p>}
              <div className="flex flex-wrap gap-1.5">
                {permission === "granted" && (
                  <button onClick={run(folder.lookForBackups)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5" style={inputStyle}>
                    <Search size={12} /> Chercher des sauvegardes à importer
                  </button>
                )}
                <button onClick={run(folder.choose)} className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5" style={inputStyle}>
                  <FolderOpen size={12} /> Changer
                </button>
                <button onClick={run(folder.forget)} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5" style={inputStyle} title="Ne plus enregistrer dans ce dossier (les fichiers restent)">
                  <LogOut size={12} />
                </button>
              </div>
              <p className="text-[10px]">L'appli n'écrit que dans ses propres fichiers ; les sauvegardes d'autres appareils sont seulement lues, et proposées à l'import.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
