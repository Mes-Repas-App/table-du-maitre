import { useState, useRef } from "react";
import { Cloud, CloudOff, RefreshCw, AlertTriangle, LogOut } from "lucide-react";
import { useDismiss } from "../../hooks/useDismiss.js";
import { inputStyle } from "../ui/form.jsx";

const ago = (t) => {
  if (!t) return "jamais";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  return new Date(t).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

/** État et commandes de la sauvegarde Google Drive (synchronisation entre appareils) */
export default function SyncButton({ sync }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));
  const { configured, connected, valid, email, lastSync, pending, status, error } = sync;

  const needsLogin = configured && connected && !valid;
  const Icon = !configured || !connected ? CloudOff : status === "syncing" ? RefreshCw : status === "error" ? AlertTriangle : Cloud;
  const color = !configured || !connected ? "var(--muted)" : status === "error" || needsLogin ? "var(--blood-l)" : "var(--gold)";
  const title = !configured
    ? "Sauvegarde Google : non configurée"
    : !connected
      ? "Se connecter à Google pour synchroniser ses appareils"
      : needsLogin
        ? "Session Google expirée : cliquer pour reconnecter"
        : `Synchronisé avec Google (${ago(lastSync)})`;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded-md" style={{ ...inputStyle, color }} title={title} aria-label={title}>
        <Icon size={14} className={status === "syncing" ? "animate-spin" : ""} />
        {(needsLogin || (valid && pending)) && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: needsLogin ? "var(--blood-l)" : "var(--gold)" }} />}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-40 w-72 rounded-xl p-3 shadow-2xl text-xs space-y-2" style={{ background: "var(--panel)", border: "1px solid var(--edge)", color: "var(--muted)" }}>
          <div className="text-sm" style={{ fontFamily: "var(--display)", color: "var(--parchment)" }}>
            Sauvegarde Google Drive
          </div>
          {!configured ? (
            <p>
              Pas encore activée : il faut un identifiant client Google (à créer une fois dans Google Cloud, puis à enregistrer dans le dépôt GitHub sous le nom <b>GOOGLE_CLIENT_ID</b>). La marche à suivre est dans le README.
            </p>
          ) : !connected ? (
            <>
              <p>Connectez votre compte Google pour retrouver les mêmes campagnes sur l'ordinateur, la tablette et le téléphone. Les données vont dans un dossier caché de votre Google Drive, réservé à cette appli.</p>
              <button onClick={sync.connect} className="w-full rounded-md px-3 py-2 text-sm font-semibold" style={{ background: "var(--gold)", color: "#1a1409" }}>
                Se connecter à Google
              </button>
            </>
          ) : (
            <>
              <div>
                Compte : <b style={{ color: "var(--parchment)" }}>{email || "Google"}</b>
              </div>
              <div>
                Dernière synchronisation : <b style={{ color: "var(--parchment)" }}>{ago(lastSync)}</b>
                {pending && <span style={{ color: "var(--gold)" }}> · modifications en attente</span>}
              </div>
              {needsLogin && <p style={{ color: "var(--blood-l)" }}>La session Google a expiré (au bout d'une heure environ). Reconnectez-vous pour reprendre la synchronisation.</p>}
              {error && !needsLogin && <p style={{ color: "var(--blood-l)" }}>{error}</p>}
              <div className="flex gap-1.5">
                <button
                  onClick={needsLogin ? sync.connect : sync.sync}
                  disabled={status === "syncing"}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-semibold disabled:opacity-50"
                  style={{ background: "var(--gold)", color: "#1a1409" }}
                >
                  <RefreshCw size={12} className={status === "syncing" ? "animate-spin" : ""} /> {needsLogin ? "Reconnecter" : status === "syncing" ? "Synchronisation…" : "Synchroniser"}
                </button>
                <button onClick={sync.disconnect} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5" style={inputStyle} title="Se déconnecter (les données restent sur cet appareil et dans Drive)">
                  <LogOut size={12} />
                </button>
              </div>
              <p className="text-[10px]">Synchronisation automatique à l'ouverture, après chaque modification et toutes les 2 minutes. En cas de conflit, la version la plus récente gagne ; l'autre reste dans les copies de secours.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
