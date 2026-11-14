import { useState, useEffect, useRef, useCallback } from "react";
import { get, put, del } from "./db.js";
import { uid } from "../utils/helpers.js";
import { folderSupported, saveCampaignFile, removeCampaignFile, scanFolder, fingerprint, matchCandidates, hasContent, withoutSync } from "../sync/folder.js";

const FOLDER_KEY = "__folder"; // { handle, files: { campaignId: nomDeFichier }, imported: { nomDeFichier: savedAt } }
const INSTALL_KEY = "__install"; // identifiant de ce navigateur, écrit dans nos fichiers
const CHECK_EVERY = 30 * 1000; // vérification des autres appareils au plus toutes les 30 s (retour sur l'onglet)

/**
 * Dossier de sauvegarde choisi par l'utilisateur : la campagne ouverte y est écrite
 * 2 s après chaque modification (et quand l'onglet est masqué). Au choix du dossier,
 * les sauvegardes déjà présentes sont proposées à l'import. Une version plus récente d'une
 * campagne déjà présente ici (venue d'un autre appareil) est proposée en mise à jour, à
 * l'ouverture de l'appli et au retour sur l'onglet.
 * Après un redémarrage du navigateur, celui-ci peut redemander l'autorisation d'accès.
 */
export function useFolderBackup({ loaded, currentId, camp, campaigns, readCampaign, addCampaigns, replaceCampaign }) {
  const [state, setState] = useState({ name: "", permission: "none", lastWrite: null, error: null }); // permission : none | prompt | granted
  const [found, setFound] = useState(null); // sauvegardes trouvées, à proposer à l'import
  // Dossier parcouru au moins une fois : avant, une écriture rajeunirait notre fichier et masquerait
  // une version plus récente venue d'un autre appareil
  const [scanned, setScanned] = useState(false);
  const rec = useRef(null);
  const installId = useRef(null);
  const cache = useRef(new Map()); // fichiers déjà lus et inchangés : pas relus à chaque vérification
  const scannedRef = useRef(false);
  const own = useRef({}); // campagne → { savedAt, print } de notre dernière écriture
  const declined = useRef(new Set()); // mises à jour refusées pendant cette visite (fichier@date)
  const lastCheck = useRef(0);
  const latest = useRef({});
  latest.current = { currentId, camp, campaigns, readCampaign };

  const fail = (err) => {
    console.error("Dossier de sauvegarde :", err);
    const denied = err?.name === "NotAllowedError" || err?.name === "SecurityError";
    const message =
      err?.name === "NotFoundError"
        ? "Dossier introuvable (déplacé, renommé ou supprimé ?). Choisissez-le à nouveau avec « Changer »."
        : err?.name === "QuotaExceededError"
          ? "Plus de place sur le disque pour enregistrer la sauvegarde."
          : `Écriture impossible (${err?.message || err}).`;
    setState((s) => ({ ...s, permission: denied ? "prompt" : s.permission, error: denied ? null : message }));
    return denied ? "Le navigateur demande de ré-autoriser l'accès au dossier." : message;
  };

  /* Parcourt le dossier : empreintes (pour ne pas recopier), nos dernières écritures, et propositions
     d'import, chacune reliée à la campagne locale correspondante s'il y en a une */
  const scan = useCallback(async () => {
    const { campaigns, readCampaign } = latest.current;
    const localPrints = new Set();
    const locals = [];
    for (const c of campaigns) {
      const d = await readCampaign(c.id);
      if (!d) continue;
      localPrints.add(fingerprint(d));
      locals.push({ ...c, syncId: d.settings?.syncId, empty: !hasContent(d) });
    }
    const res = await scanFolder(rec.current.handle, { installId: installId.current, localPrints, imported: rec.current.imported || {}, cache: cache.current });
    own.current = res.own;
    scannedRef.current = true;
    setScanned(true);
    return matchCandidates(res.candidates, locals, res.own);
  }, []);

  const write = useCallback(async (campaignId, name, data) => {
    if (!rec.current) return;
    const print = fingerprint(data);
    // Contenu et nom identiques à notre dernier fichier : rien à réécrire (sa date reste celle de la vraie dernière modification)
    const last = own.current[campaignId];
    if (last?.print === print && last.name === name) return;
    const files = await saveCampaignFile(rec.current.handle, rec.current.files, {
      installId: installId.current,
      campaignId,
      name,
      data,
    });
    if (hasContent(data)) own.current = { ...own.current, [campaignId]: { savedAt: Date.now(), print, name } };
    if (files !== rec.current.files) {
      rec.current = { ...rec.current, files };
      await put(FOLDER_KEY, rec.current);
    }
    setState((s) => ({ ...s, lastWrite: Date.now(), error: null }));
  }, []);

  /** Écrit toutes les campagnes (après le choix du dossier) */
  const writeAll = useCallback(async () => {
    const { campaigns, readCampaign } = latest.current;
    for (const c of campaigns) {
      const d = await readCampaign(c.id);
      if (d) await write(c.id, c.name, d);
    }
  }, [write]);

  /** Un autre appareil a-t-il enregistré une version plus récente d'une de nos campagnes ? */
  const checkUpdates = useCallback(async () => {
    if (!rec.current || Date.now() - lastCheck.current < CHECK_EVERY) return;
    lastCheck.current = Date.now();
    // Proposition automatique : seulement quand c'est certainement la même campagne
    const list = (await scan()).filter((c) => c.target && c.sure && c.newer && !declined.current.has(`${c.fileName}@${c.savedAt}`));
    if (list.length) setFound((f) => f || list);
  }, [scan]);

  /* Au démarrage : dossier déjà choisi ? autorisation encore valable ? */
  useEffect(() => {
    if (!folderSupported) return;
    (async () => {
      installId.current = (await get(INSTALL_KEY)) || uid() + uid();
      await put(INSTALL_KEY, installId.current);
      const r = await get(FOLDER_KEY);
      if (!r?.handle) return;
      rec.current = r;
      const permission = (await r.handle.queryPermission({ mode: "readwrite" })) === "granted" ? "granted" : "prompt";
      setState((s) => ({ ...s, name: r.handle.name, permission }));
    })().catch(fail);
  }, []);

  /* Campagnes chargées et dossier accessible : on regarde ce que les autres appareils ont enregistré */
  useEffect(() => {
    if (loaded && state.permission === "granted") checkUpdates().catch(fail);
  }, [loaded, state.permission, checkUpdates]);

  /** Choisir (ou changer) le dossier : propose d'importer ce qu'il contient déjà */
  const choose = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ id: "table-du-maitre", mode: "readwrite" });
      rec.current = { handle, files: {} };
      await put(FOLDER_KEY, rec.current);
      lastCheck.current = Date.now(); // la recherche complète ci-dessous tient lieu de vérification
      setState({ name: handle.name, permission: "granted", lastWrite: null, error: null });
      const candidates = await scan();
      if (candidates.length) setFound(candidates);
      else await writeAll();
    } catch (err) {
      if (err?.name !== "AbortError") fail(err); // AbortError : fenêtre fermée sans choisir
    }
  }, [scan, writeAll]);

  /** Rechercher à nouveau des sauvegardes à importer (ex. venues d'un autre appareil) */
  const lookForBackups = useCallback(async () => {
    try {
      const candidates = await scan();
      setFound(candidates);
    } catch (err) {
      fail(err);
    }
  }, [scan]);

  /** Fin de la fenêtre : nouvelles campagnes et mises à jour choisies, puis on écrit nos campagnes */
  const finishImport = useCallback(
    async (selected) => {
      // Ce qui n'a pas été retenu n'est plus proposé automatiquement pendant cette visite
      (found || []).forEach((c) => !selected.some((s) => s.fileName === c.fileName) && declined.current.add(`${c.fileName}@${c.savedAt}`));
      setFound(null);
      try {
        // Nom déjà pris dans l'appli : « (importée) » pour les distinguer dans le menu
        const taken = new Set(latest.current.campaigns.map((c) => c.name));
        const unique = (name) => {
          let n = taken.has(name) ? `${name} (importée)` : name;
          for (let i = 2; taken.has(n); i++) n = `${name} (importée ${i})`;
          taken.add(n);
          return n;
        };
        const adds = selected.filter((c) => c.mode !== "update");
        if (adds.length) await addCampaigns(adds.map((c) => ({ name: unique(c.name), data: c.sure ? withoutSync(c.data) : c.data })));
        for (const c of selected.filter((c) => c.mode === "update")) await replaceCampaign(c.target, c.data);
        if (selected.length) {
          // On retient la version importée de chaque fichier pour ne pas la reproposer
          const imported = { ...(rec.current.imported || {}) };
          selected.forEach((c) => (imported[c.fileName] = c.savedAt));
          rec.current = { ...rec.current, imported };
          await put(FOLDER_KEY, rec.current);
        }
        await writeAll();
      } catch (err) {
        fail(err);
      }
    },
    [found, addCampaigns, replaceCampaign, writeAll]
  );

  /** Ré-autoriser l'accès (le navigateur l'exige parfois après un redémarrage) */
  const reconnect = useCallback(async () => {
    try {
      const ok = (await rec.current.handle.requestPermission({ mode: "readwrite" })) === "granted";
      setState((s) => ({ ...s, permission: ok ? "granted" : "prompt", error: null }));
      // La vérification des autres appareils suit (effet ci-dessus), avant toute écriture
    } catch (err) {
      fail(err);
    }
  }, []);

  /** Bouton « Sauvegarder » : écrit la campagne ouverte tout de suite → { file } ou { error } */
  const saveNow = useCallback(async () => {
    const { currentId: id, camp: data, campaigns: list } = latest.current;
    try {
      if (!scannedRef.current) await scan(); // sinon notre écriture masquerait une version plus récente d'un autre appareil
      await write(id, list.find((c) => c.id === id)?.name, data);
      return { file: rec.current.files[id] };
    } catch (err) {
      return { error: fail(err) };
    }
  }, [write, scan]);

  /** Campagne supprimée dans l'appli : son fichier quitte aussi le dossier (seulement s'il est à nous) */
  const removeFile = useCallback(async (campaignId) => {
    if (!rec.current || state.permission !== "granted") return;
    try {
      const files = await removeCampaignFile(rec.current.handle, rec.current.files, { installId: installId.current, campaignId });
      rec.current = { ...rec.current, files };
      await put(FOLDER_KEY, rec.current);
      const rest = { ...own.current };
      delete rest[campaignId];
      own.current = rest;
    } catch (err) {
      fail(err);
    }
  }, [state.permission]);

  const forget = useCallback(async () => {
    rec.current = null;
    await del(FOLDER_KEY);
    setState({ name: "", permission: "none", lastWrite: null, error: null });
  }, []);

  /* Écriture de la campagne ouverte, 2 s après la dernière modification (pas pendant une proposition de mise à jour) */
  const currentName = campaigns.find((c) => c.id === currentId)?.name;
  const asking = !!found;
  useEffect(() => {
    if (!loaded || state.permission !== "granted" || !currentId || asking || !scanned) return;
    const t = setTimeout(() => write(currentId, currentName, camp).catch(fail), 2000);
    return () => clearTimeout(t);
  }, [camp, currentId, currentName, loaded, state.permission, write, asking, scanned]);

  /* Onglet masqué : écriture immédiate ; retour sur l'onglet : versions des autres appareils */
  useEffect(() => {
    const onVisibility = () => {
      if (state.permission !== "granted") return;
      if (document.visibilityState === "visible") return checkUpdates().catch(fail);
      const { currentId: id, camp: data, campaigns: list } = latest.current;
      if (id && !asking && scanned) write(id, list.find((c) => c.id === id)?.name, data).catch(fail);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state.permission, write, checkUpdates, asking, scanned]);

  return { supported: folderSupported, ...state, found, choose, reconnect, saveNow, removeFile, forget, lookForBackups, finishImport };
}
