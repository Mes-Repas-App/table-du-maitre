import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, FolderOpen, Download } from "lucide-react";
import { inputStyle } from "../ui/form.jsx";

/**
 * Confirmation des boutons « Sauvegarder » et « Rafraîchir ». Se ferme seule après 3 s si tout va bien
 * dans un dossier ; sinon elle reste, avec les actions pour garder une copie ailleurs.
 */
export default function SaveDialog({ result, folder, onExport, onRefresh, onOverwrite, onClose }) {
  const { ok, lines, offer, title } = result;

  useEffect(() => {
    const onKey = (ev) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = ok && !offer ? setTimeout(onClose, 3000) : null;
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [ok, offer, onClose]);

  const then = (fn) => () => {
    onClose();
    fn();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3" style={{ background: "rgba(10,8,5,.6)" }} onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="save-title" className="w-full max-w-sm rounded-xl shadow-2xl p-4 space-y-3" style={{ background: "var(--panel)", border: `1px solid ${ok ? "var(--gold)" : "var(--blood-l)"}` }}>
        <div id="save-title" className="flex items-center gap-2 text-base" style={{ fontFamily: "var(--display)", color: ok ? "var(--gold)" : "var(--blood-l)" }}>
          {ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          {title || (ok ? "Sauvegarde effectuée" : "Sauvegarde incomplète")}
        </div>
        <ul className="space-y-1 text-sm" style={{ color: "var(--parchment)" }}>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {offer === "folder" && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Pour garder aussi une copie hors du navigateur (sur votre Drive, par exemple), choisissez un dossier de sauvegarde ou exportez un fichier.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {offer === "folder" && folder.supported && (
            <button onClick={then(folder.choose)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm" style={inputStyle}>
              <FolderOpen size={14} /> Choisir un dossier
            </button>
          )}
          {offer === "folder" && (
            <button onClick={then(onExport)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm" style={inputStyle}>
              <Download size={14} /> Exporter
            </button>
          )}
          {offer === "conflict" && (
            <>
              <button onClick={then(onOverwrite)} className="rounded-md px-3 py-1.5 text-sm" style={inputStyle} title="Remplace le fichier du dossier par la version de cet appareil">
                Écraser avec ma version
              </button>
              <button onClick={then(onRefresh)} className="rounded-md px-3 py-1.5 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }} title="Charge la version du dossier (la vôtre part dans les copies de secours)">
                Rafraîchir
              </button>
            </>
          )}
          {offer === "reconnect" && (
            <button onClick={then(folder.reconnect)} className="rounded-md px-3 py-1.5 text-sm" style={inputStyle}>
              Autoriser le dossier
            </button>
          )}
          <button autoFocus onClick={onClose} className="rounded-md px-4 py-1.5 text-sm font-semibold" style={offer === "conflict" ? inputStyle : { background: "var(--gold)", color: "#1a1409" }}>
            {offer === "conflict" ? "Plus tard" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
