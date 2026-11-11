import { useState, useEffect, useRef, useCallback } from "react";
import { GOOGLE_CLIENT_ID, signIn, signOut, driveClient } from "../sync/drive.js";
import { syncCampaigns } from "../sync/syncCampaigns.js";

const KEY = "table-du-maitre:google"; // { token, expiresAt, email, lastSync }
const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};
const writeSession = (s) => {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* session simplement non mémorisée */
  }
};
const isValid = (s) => !!s?.token && s.expiresAt > Date.now();

/**
 * Synchronise les campagnes avec le Google Drive de l'utilisateur :
 * au démarrage, 20 s après la dernière modification, au retour sur l'onglet,
 * quand l'onglet est masqué, et toutes les 2 minutes.
 * Le jeton Google dure environ 1 h : ensuite, un clic sur « Reconnecter » suffit.
 */
export function useDriveSync(bridge, { loaded, changeStamp }) {
  const [session, setSession] = useState(readSession);
  const [status, setStatus] = useState("idle"); // idle | syncing | error
  const [error, setError] = useState(null);
  const sessionRef = useRef(session);
  const running = useRef(false);
  const again = useRef(false);

  const save = (s) => {
    sessionRef.current = s;
    writeSession(s);
    setSession(s);
  };

  const sync = useCallback(async () => {
    const s = sessionRef.current;
    if (!GOOGLE_CLIENT_ID || !loaded || !isValid(s)) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus("syncing");
    setError(null);
    try {
      const report = await syncCampaigns({
        drive: driveClient(s.token),
        local: bridge.current.local(),
        read: (id) => bridge.current.read(id),
        apply: (...a) => bridge.current.apply(...a),
        remove: (id) => bridge.current.remove(id),
      });
      bridge.current.setDeleted(report.deleted);
      save({ ...sessionRef.current, lastSync: Date.now() });
      setStatus("idle");
    } catch (err) {
      console.error("Synchronisation Google :", err);
      if (err.expired) save({ ...sessionRef.current, expiresAt: 0 });
      setError(err.message);
      setStatus("error");
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(() => sync(), 1000);
      }
    }
  }, [bridge, loaded]);

  /** Connexion (ou reconnexion) : doit venir d'un clic */
  const connect = useCallback(async () => {
    setError(null);
    try {
      save({ ...sessionRef.current, ...(await signIn(sessionRef.current?.email)) });
      await sync();
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [sync]);

  const disconnect = useCallback(async () => {
    if (sessionRef.current?.token) await signOut(sessionRef.current.token);
    save(null);
    setStatus("idle");
    setError(null);
  }, []);

  /* Au démarrage */
  useEffect(() => {
    if (loaded) sync();
  }, [loaded, sync]);

  /* 20 s après la dernière modification */
  useEffect(() => {
    if (!loaded || !changeStamp) return;
    const t = setTimeout(sync, 20000);
    return () => clearTimeout(t);
  }, [changeStamp, loaded, sync]);

  /* Retour sur l'onglet, onglet masqué, et toutes les 2 minutes */
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") sync();
      else if (Date.now() - (sessionRef.current?.lastSync || 0) > 30000) sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => document.visibilityState === "visible" && sync(), 120000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(timer);
    };
  }, [sync]);

  return {
    configured: !!GOOGLE_CLIENT_ID,
    connected: !!session?.token || !!session?.email,
    valid: isValid(session),
    email: session?.email || "",
    lastSync: session?.lastSync || null,
    pending: changeStamp > (session?.lastSync || 0), // modifications pas encore envoyées
    status,
    error,
    connect,
    disconnect,
    sync,
  };
}
