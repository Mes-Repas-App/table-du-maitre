import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { normalizeCampaign, uid } from "../utils/helpers.js";

const DB_NAME = "table-du-maitre";
const STORE = "campagne";
const INDEX_KEY = "__index"; // { current, list: [{ id, name, updatedAt }], deleted: [ids] }
const FIRST_ID = "courante"; // clé de l'ancienne campagne unique
const LEGACY_KEY = "table-du-maitre:campagne"; // ancienne sauvegarde localStorage (limitée à ~5 Mo)
const HISTORY_MAX = 50;
const BURST_MS = 700; // modifications rapprochées (glisser un pion, taper un nom…) = une seule étape d'annulation
const BACKUP_EVERY = 60 * 60 * 1000; // une copie automatique par heure d'utilisation au plus
const BACKUP_MAX = 10;
const EXPORT_EVERY = 7 * 24 * 60 * 60 * 1000; // rappel d'export hebdomadaire
const backupKey = (id) => `__backups:${id}`;
const exportKey = (id) => `table-du-maitre:export:${id}`;

const EMPTY = { entities: [], combats: [], sessions: [], world: [], settings: { rules: "2024" } };

/** Mini-enveloppe IndexedDB : une clé par campagne, des centaines de Mo disponibles
    (cartes et portraits ne saturent plus la sauvegarde). */
function idb(mode, op) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => {
        db.close();
        resolve(req.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
const get = (k) => idb("readonly", (s) => s.get(k));
const put = (k, v) => idb("readwrite", (s) => s.put(v, k));
const del = (k) => idb("readwrite", (s) => s.delete(k));

/* Date du dernier export : simple confort local, on survit à un localStorage indisponible */
const readExport = (id) => {
  try {
    return Number(localStorage.getItem(exportKey(id))) || null;
  } catch {
    return null;
  }
};
const writeExport = (id, t) => {
  try {
    localStorage.setItem(exportKey(id), String(t));
  } catch {
    /* rien à faire */
  }
};

/**
 * Gère les campagnes (personnages, combats, sessions, monde) avec sauvegarde automatique
 * dans IndexedDB, copies de secours, plusieurs campagnes et annulation.
 */
export function useCampaign() {
  const [camp, setCamp] = useState(EMPTY);
  const [campaigns, setCampaigns] = useState([]); // [{ id, name, updatedAt (dernière vraie modification) }]
  const [currentId, setCurrentId] = useState(null);
  const [deleted, setDeleted] = useState([]); // campagnes supprimées, à supprimer aussi sur les autres appareils
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [canUndo, setCanUndo] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const pending = useRef(null); // { key, data } en attente d'écriture
  const currentRef = useRef(null);
  const campRef = useRef(EMPTY);
  currentRef.current = currentId;
  campRef.current = camp;
  const lastBackup = useRef({}); // id de campagne → date de la dernière copie
  const history = useRef({ stack: [], prev: null, last: 0 });
  // États de campagne qui ne sont pas des modifications (chargement, annulation, version venue
  // d'un autre appareil). Un ensemble plutôt qu'un drapeau : deux chargements rapprochés ne
  // peuvent pas « consommer » le drapeau l'un de l'autre.
  const notEdits = useRef(new WeakSet());

  /* Un « setter » par collection, à la manière de useState : setEntities(fn | valeur) */
  const setters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(EMPTY).map((k) => [k, (fn) => setCamp((c) => ({ ...c, [k]: typeof fn === "function" ? fn(c[k]) : fn }))])
      ),
    []
  );

  /* Affiche une campagne (vide si `data` est absent) et repart d'un historique vierge */
  const show = useCallback((id, data) => {
    const n = normalizeCampaign(data ?? { entities: [] });
    notEdits.current.add(n);
    setCamp(n);
    history.current = { stack: [], prev: null, last: 0 };
    setCanUndo(false);
    let t = readExport(id);
    if (!t) writeExport(id, (t = Date.now())); // premier rappel dans une semaine
    setLastExport(t);
  }, []);

  /* Chargement initial (reprend l'ancienne campagne unique ou le localStorage si besoin) */
  useEffect(() => {
    navigator.storage?.persist?.(); // demande au navigateur de ne jamais effacer les campagnes
    (async () => {
      try {
        const index = (await get(INDEX_KEY)) || { current: FIRST_ID, list: [{ id: FIRST_ID, name: "Ma campagne" }] };
        let data = await get(index.current);
        if (!data && index.current === FIRST_ID) {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) data = JSON.parse(raw);
        }
        show(index.current, data);
        setCampaigns(index.list);
        setCurrentId(index.current);
        setDeleted(index.deleted || []);
        setLoaded(true);
      } catch (err) {
        // On ne passe PAS en mode chargé : la sauvegarde automatique écraserait la campagne.
        console.error("Impossible de charger la campagne :", err);
        setLoadError(String(err?.message || err));
      }
    })();
  }, [show]);

  /* Copie de secours horaire (ou immédiate avec `force`), les 10 dernières sont gardées */
  const backup = async (key, data, force) => {
    if (!force && Date.now() - (lastBackup.current[key] ?? 0) < BACKUP_EVERY) return;
    const list = (await get(backupKey(key))) || [];
    lastBackup.current[key] = list[0]?.t ?? 0;
    if (!force && Date.now() - lastBackup.current[key] < BACKUP_EVERY) return;
    await put(backupKey(key), [{ t: Date.now(), data }, ...list].slice(0, BACKUP_MAX));
    lastBackup.current[key] = Date.now();
  };

  /* Marque la campagne ouverte comme modifiée (pour la synchronisation) */
  const touch = useCallback(() => {
    setCampaigns((p) => p.map((c) => (c.id === currentRef.current ? { ...c, updatedAt: Date.now() } : c)));
  }, []);

  const save = useCallback(() => {
    const job = pending.current;
    if (!job) return Promise.resolve();
    pending.current = null;
    return put(job.key, job.data)
      .then(() => {
        if (!pending.current) setSaveState("saved");
        localStorage.removeItem(LEGACY_KEY);
        backup(job.key, job.data).catch((err) => console.error("Copie de secours impossible :", err));
      })
      .catch((err) => {
        console.error("Sauvegarde impossible :", err);
        setSaveState("error");
      });
  }, []);

  /* Sauvegarde automatique (debounce 600 ms) */
  useEffect(() => {
    if (!loaded) return;
    pending.current = { key: currentId, data: camp };
    setSaveState("saving");
    const t = setTimeout(save, 600);
    return () => clearTimeout(t);
  }, [camp, loaded, currentId, save]);

  /* Liste des campagnes et campagne ouverte */
  useEffect(() => {
    if (loaded) put(INDEX_KEY, { current: currentId, list: campaigns, deleted }).catch(() => setSaveState("error"));
  }, [loaded, currentId, campaigns, deleted]);

  /* Onglet masqué ou fermé : on écrit tout de suite ce qui reste */
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && save();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [save]);

  /* Historique d'annulation : on mémorise l'état d'avant chaque rafale de modifications */
  useEffect(() => {
    if (!loaded) return;
    const h = history.current;
    if (notEdits.current.has(camp)) {
      // chargement, annulation ou version d'un autre appareil : rien à empiler ni à marquer
      h.last = 0;
    } else {
      // L'effet peut repasser sans que rien n'ait changé : ce n'est pas une modification
      if (h.prev && Object.keys(camp).every((k) => camp[k] === h.prev[k])) return;
      if (h.prev && Date.now() - h.last > BURST_MS) {
        h.stack = [...h.stack.slice(-(HISTORY_MAX - 1)), h.prev];
        setCanUndo(true);
      }
      h.last = Date.now();
      touch(); // vraie modification
    }
    h.prev = camp;
  }, [camp, loaded, touch]);

  const undo = useCallback(() => {
    const h = history.current;
    const prev = h.stack.pop();
    if (!prev) return;
    notEdits.current.add(prev);
    setCamp(prev);
    setCanUndo(h.stack.length > 0);
    touch();
  }, [touch]);

  const updateEntity = useCallback((id, patch) => {
    setCamp((c) => ({ ...c, entities: c.entities.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }, []);

  /* Gestion des campagnes */
  const switchCampaign = useCallback(
    async (id) => {
      await save(); // écrit d'abord la campagne qu'on quitte
      try {
        show(id, await get(id));
        setCurrentId(id);
      } catch (err) {
        console.error(err);
        alert("Impossible d'ouvrir cette campagne.");
      }
    },
    [save, show]
  );

  const createCampaign = useCallback(
    async (name, data) => {
      await save();
      const id = uid();
      show(id, data);
      setCampaigns((p) => [...p, { id, name, updatedAt: Date.now() }]); // créée exprès : à synchroniser
      setCurrentId(id);
    },
    [save, show]
  );

  const renameCampaign = useCallback(
    (name) => setCampaigns((p) => p.map((c) => (c.id === currentId ? { ...c, name, updatedAt: Date.now() } : c))),
    [currentId]
  );

  /** Supprime la campagne ouverte (et ses copies) puis bascule sur une autre */
  const deleteCampaign = useCallback(async () => {
    const others = campaigns.filter((c) => c.id !== currentId);
    if (!others.length) return;
    const gone = currentId;
    pending.current = null; // inutile d'écrire une campagne qu'on supprime
    try {
      show(others[0].id, await get(others[0].id));
      setCampaigns(others);
      setCurrentId(others[0].id);
      setDeleted((p) => [...p, gone]);
      await del(gone);
      await del(backupKey(gone));
      try {
        localStorage.removeItem(exportKey(gone));
      } catch {
        /* rien à faire */
      }
    } catch (err) {
      console.error(err);
      setSaveState("error");
    }
  }, [campaigns, currentId, show]);

  /* Copies de secours : la restauration est une modification ordinaire (donc annulable) */
  const listBackups = useCallback(async () => (await get(backupKey(currentId))) || [], [currentId]);
  const restoreBackup = useCallback((data) => setCamp(normalizeCampaign(data)), []);

  /* Export / import de la campagne en fichier JSON (l'import crée une nouvelle campagne) */
  const currentName = campaigns.find((c) => c.id === currentId)?.name || "campagne";
  const exportCampaign = useCallback(() => {
    const blob = new Blob([JSON.stringify({ name: currentName, ...camp }, null, 2)], { type: "application/json" });
    const slug = currentName.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "campagne";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    writeExport(currentId, Date.now());
    setLastExport(Date.now());
  }, [camp, currentName, currentId]);

  /** Repousse le rappel d'export de 3 jours */
  const snoozeExport = useCallback(() => {
    const t = Date.now() - EXPORT_EVERY + 3 * 24 * 60 * 60 * 1000;
    writeExport(currentId, t);
    setLastExport(t);
  }, [currentId]);

  const hasContent = camp.entities.length + camp.combats.length + camp.sessions.length + camp.world.length > 0;
  const exportDue = loaded && hasContent && lastExport != null && Date.now() - lastExport > EXPORT_EVERY;

  const importCampaign = useCallback(
    async (file) => {
      let data;
      try {
        data = JSON.parse(await file.text());
        normalizeCampaign(data); // valide avant de créer quoi que ce soit
      } catch {
        alert("Fichier de campagne invalide.");
        return;
      }
      await createCampaign(String(data.name || file.name.replace(/\.json$/i, "")), data);
    },
    [createCampaign]
  );

  /* Passerelle pour la synchronisation Google Drive : réassignée à chaque rendu,
     elle voit toujours l'état le plus récent, même au milieu d'une synchronisation. */
  const syncBridge = useRef({});
  syncBridge.current = {
    local: () => ({ list: campaigns, deleted }),
    setDeleted,
    read: async (id) => (id === currentRef.current ? campRef.current : get(id)),
    /** Remplace (ou ajoute) une campagne par la version venue d'un autre appareil */
    apply: async (id, name, data, updatedAt) => {
      const n = normalizeCampaign(data);
      if (campaigns.some((c) => c.id === id)) {
        const old = id === currentRef.current ? campRef.current : await get(id);
        if (old) await backup(id, old, true); // copie de secours avant d'écraser
      }
      await put(id, n);
      if (id === currentRef.current) show(id, n);
      setCampaigns((p) =>
        p.some((c) => c.id === id) ? p.map((c) => (c.id === id ? { ...c, name: name || c.name, updatedAt } : c)) : [...p, { id, name: name || "Campagne", updatedAt }]
      );
    },
    /** Supprime une campagne effacée sur un autre appareil (ses copies de secours sont gardées) */
    remove: async (id) => {
      if (id === currentRef.current) {
        const other = campaigns.find((c) => c.id !== id);
        const nextId = other?.id || uid();
        pending.current = null;
        show(nextId, other ? await get(nextId) : null);
        setCurrentId(nextId);
        if (!other) setCampaigns((p) => [...p, { id: nextId, name: "Ma campagne" }]);
      }
      setCampaigns((p) => p.filter((c) => c.id !== id));
      await del(id);
    },
  };
  const changeStamp = campaigns.reduce((m, c) => Math.max(m, c.updatedAt || 0), 0);

  return {
    syncBridge,
    changeStamp,
    ...camp,
    setEntities: setters.entities,
    setCombats: setters.combats,
    setSessions: setters.sessions,
    setWorld: setters.world,
    setSettings: setters.settings,
    updateEntity,
    loaded,
    loadError,
    saveState,
    exportCampaign,
    importCampaign,
    exportDue,
    lastExport,
    snoozeExport,
    undo,
    canUndo,
    campaigns,
    currentId,
    switchCampaign,
    createCampaign,
    renameCampaign,
    deleteCampaign,
    listBackups,
    restoreBackup,
  };
}
