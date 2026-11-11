/* Accès à Google Drive depuis le navigateur, sans serveur :
   - connexion via Google Identity Services (fenêtre Google, jeton valable ~1 h) ;
   - données rangées dans le dossier d'application caché de Drive (« appDataFolder ») :
     invisibles dans « Mon Drive », accessibles seulement à cette appli. */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata email";

/** Identifiant client OAuth, fourni à la construction (variable GOOGLE_CLIENT_ID du dépôt) */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

let gis;
function loadGis() {
  gis ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = resolve;
    s.onerror = () => {
      gis = null;
      reject(new Error("Impossible de joindre Google (connexion Internet ?)"));
    };
    document.head.appendChild(s);
  });
  return gis;
}

/** Ouvre la fenêtre Google et renvoie { token, expiresAt, email }.
    À appeler depuis un clic (sinon le navigateur bloque la fenêtre). */
export async function signIn(hint) {
  await loadGis();
  const r = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      hint,
      prompt: "", // ne redemande le consentement que la première fois
      callback: (res) => (res.error ? reject(new Error(res.error_description || res.error)) : resolve(res)),
      error_callback: (err) => reject(new Error(err.type === "popup_closed" ? "Connexion annulée" : err.message || err.type)),
    });
    client.requestAccessToken();
  });
  let email = hint || "";
  try {
    const me = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${r.access_token}` } });
    email = (await me.json()).email || email;
  } catch {
    /* l'adresse n'est qu'un affichage */
  }
  return { token: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) - 60) * 1000, email };
}

export async function signOut(token) {
  try {
    await loadGis();
    window.google.accounts.oauth2.revoke(token);
  } catch {
    /* jeton déjà expiré ou Google injoignable : on oublie simplement la session */
  }
}

/** Client Drive minimal pour syncCampaigns */
export function driveClient(token) {
  const call = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } });
    if (res.status === 401) throw Object.assign(new Error("Session Google expirée"), { expired: true });
    if (!res.ok) throw new Error(`Google Drive : erreur ${res.status}`);
    return res;
  };

  return {
    async list() {
      const res = await call(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name,appProperties)`);
      return (await res.json()).files || [];
    },
    async download(fileId) {
      return (await call(`${API}/files/${fileId}?alt=media`)).json();
    },
    /** Envoi « reprenable » : sans limite de taille (cartes et portraits compris) */
    async upload(fileId, meta, content) {
      const init = await call(fileId ? `${UPLOAD}/files/${fileId}?uploadType=resumable` : `${UPLOAD}/files?uploadType=resumable`, {
        method: fileId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(fileId ? meta : { ...meta, parents: ["appDataFolder"] }),
      });
      const location = init.headers.get("Location");
      if (!location) throw new Error("Google Drive : adresse d'envoi manquante");
      const res = await fetch(location, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
      if (!res.ok) throw new Error(`Google Drive : envoi refusé (${res.status})`);
      return (await res.json()).id;
    },
    async remove(fileId) {
      await call(`${API}/files/${fileId}`, { method: "DELETE" });
    },
  };
}
