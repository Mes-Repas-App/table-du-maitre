import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { normalizeCampaign, uid } from "../utils/helpers.js";
import { get, put, del } from "./db.js";

const INDEX_KEY = "__index"; // { current, list: [{ id, name }] }
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
  const [campaigns, setCampaigns] = useState([]); // [{ id, name }]
  const [currentId, setCurrentId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [canUndo, setCanUndo] = useState(false);
  const [lastExport, setLastExport] = useState(null);
  const pending = useRef(null); // { key, data } en attente d'écriture
  const lastBackup = useRef({}); // id de campagne → date de la dernière copie
  const history = useRef({ stack: [], prev: null, last: 0 });
  // États de campagne qui ne sont pas des modifications (chargement, annulation). Un ensemble
  // plutôt qu'un drapeau : deux chargements rapprochés ne peuvent pas « consommer » le drapeau
  // l'un de l'autre.
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
    // Identifiant commun, attribué à l'ouverture : il suit la campagne dans ses fichiers de sauvegarde
    if (!n.settings.syncId) n.settings = { ...n.settings, syncId: uid() + uid() };
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
        setLoaded(true);
      } catch (err) {
        // On ne passe PAS en mode chargé : la sauvegarde automatique écraserait la campagne.
        console.error("Impossible de charger la campagne :", err);
        setLoadError(String(err?.message || err));
      }
    })();
  }, [show]);

  /* Copie de secours horaire, les 10 dernières sont gardées */
  const backup = async (key, data) => {
    if (Date.now() - (lastBackup.current[key] ?? 0) < BACKUP_EVERY) return;
    const list = (await get(backupKey(key))) || [];
    lastBackup.current[key] = list[0]?.t ?? 0;
    if (Date.now() - lastBackup.current[key] < BACKUP_EVERY) return;
    await put(backupKey(key), [{ t: Date.now(), data }, ...list].slice(0, BACKUP_MAX));
    lastBackup.current[key] = Date.now();
  };

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

  /** Bouton « Sauvegarder » : écriture immédiate, sans attendre le délai (lève une erreur en cas d'échec) */
  const saveNow = useCallback(async () => {
    pending.current = null;
    await put(currentId, camp);
    setSaveState("saved");
  }, [currentId, camp]);

  /* Liste des campagnes et campagne ouverte */
  useEffect(() => {
    if (loaded) put(INDEX_KEY, { current: currentId, list: campaigns }).catch(() => setSaveState("error"));
  }, [loaded, currentId, campaigns]);

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
      // chargement ou annulation : rien à empiler
      h.last = 0;
    } else {
      // L'effet peut repasser sans que rien n'ait changé : ce n'est pas une modification
      if (h.prev && Object.keys(camp).every((k) => camp[k] === h.prev[k])) return;
      if (h.prev && Date.now() - h.last > BURST_MS) {
        h.stack = [...h.stack.slice(-(HISTORY_MAX - 1)), h.prev];
        setCanUndo(true);
      }
      h.last = Date.now();
    }
    h.prev = camp;
  }, [camp, loaded]);

  const undo = useCallback(() => {
    const h = history.current;
    const prev = h.stack.pop();
    if (!prev) return;
    notEdits.current.add(prev);
    setCamp(prev);
    setCanUndo(h.stack.length > 0);
  }, []);

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
      setCampaigns((p) => [...p, { id, name }]);
      setCurrentId(id);
    },
    [save, show]
  );

  const renameCampaign = useCallback(
    (name) => setCampaigns((p) => p.map((c) => (c.id === currentId ? { ...c, name } : c))),
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
    async (file, parsed) => {
      let data = parsed;
      try {
        data ??= JSON.parse(await file.text());
        normalizeCampaign(data); // valide avant de créer quoi que ce soit
      } catch {
        alert("Fichier de campagne invalide.");
        return;
      }
      // Nom déjà pris : « (importée) » pour distinguer les deux campagnes dans le menu
      const base = String(data.name || file.name.replace(/\.json$/i, ""));
      const taken = new Set(campaigns.map((c) => c.name));
      let name = taken.has(base) ? `${base} (importée)` : base;
      for (let i = 2; taken.has(name); i++) name = `${base} (importée ${i})`;
      await createCampaign(name, data);
    },
    [createCampaign, campaigns]
  );

  /* Pour le dossier de sauvegarde : lecture de n'importe quelle campagne, et ajout de
     campagnes trouvées dans le dossier (toujours en nouvelles campagnes : rien n'est écrasé) */
  const readCampaign = useCallback(async (id) => (id === currentId ? camp : get(id)), [currentId, camp]);
  const addCampaigns = useCallback(async (list) => {
    const added = [];
    for (const { name, data } of list) {
      const id = uid();
      await put(id, normalizeCampaign(data));
      added.push({ id, name });
    }
    setCampaigns((p) => [...p, ...added]);
    return added;
  }, []);

  /**
   * Remplace le contenu d'une campagne par une version venue d'un autre appareil.
   * La version actuelle part d'abord dans les copies de secours ; sur la campagne ouverte,
   * c'est une modification ordinaire (donc annulable avec Ctrl+Z).
   */
  const replaceCampaign = useCallback(
    async (id, data) => {
      const old = id === currentId ? camp : await get(id);
      const n = normalizeCampaign(data);
      if (old) {
        const list = (await get(backupKey(id))) || [];
        await put(backupKey(id), [{ t: Date.now(), data: old }, ...list].slice(0, BACKUP_MAX));
        if (!n.settings.syncId && old.settings?.syncId) n.settings = { ...n.settings, syncId: old.settings.syncId };
      }
      if (id === currentId) setCamp(n);
      else await put(id, n);
    },
    [currentId, camp]
  );

  return {
    camp, // l'objet complet (référence stable entre deux modifications)
    readCampaign,
    addCampaigns,
    replaceCampaign,
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
    saveNow,
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
