import { useState, useEffect, useRef, useCallback } from "react";
import { get, put, del } from "./db.js";
import { folderSupported, fileNameFor, fileSavedAt, readCampaignFile, writeCampaignFile, removeFile as removeFolderFile, changedElsewhere, listCampaignFiles, fingerprint, hasContent } from "../sync/folder.js";

const FOLDER_KEY = "__folder"; // { handle, sync: { campaignId: { fileName, savedAt, print } } }
const CHECK_EVERY = 30 * 1000; // vérification du dossier au plus toutes les 30 s (retour sur l'onglet)

/**
 * Dossier de sauvegarde choisi par l'utilisateur. Chaque campagne y a un fichier à son nom,
 * partagé entre appareils : la campagne ouverte y est écrite (en écrasant) 2 s après chaque
 * modification, et avec le bouton « Sauvegarder » ; « Rafraîchir » la recharge depuis ce fichier.
 *
 * Sécurité : si le fichier a été enregistré par un autre appareil depuis notre dernière lecture,
 * on ne l'écrase pas en silence. L'appli le signale (`remote`) et propose de rafraîchir, ou
 * d'écraser avec la version d'ici. Après un redémarrage, le navigateur peut redemander l'accès.
 */
export function useFolderBackup({ loaded, currentId, camp, campaigns, readCampaign, addCampaigns, replaceCampaign }) {
  // permission : none | prompt | granted ; remote : { campaignId, fileName, savedAt } modifié ailleurs
  const [state, setState] = useState({ name: "", permission: "none", lastWrite: null, error: null, remote: null });
  const [found, setFound] = useState(null); // au choix du dossier : fichiers à charger ou importer
  const rec = useRef(null);
  const cache = useRef(new Map()); // fichiers déjà lus et inchangés : pas relus
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

  const nameOf = (id) => latest.current.campaigns.find((c) => c.id === id)?.name;

  /** Mémorise la version du fichier que cet appareil a lue ou écrite en dernier */
  const remember = async (campaignId, entry) => {
    rec.current = { ...rec.current, sync: { ...rec.current.sync, [campaignId]: entry } };
    await put(FOLDER_KEY, rec.current);
  };
  const clearRemote = (campaignId) => setState((s) => (s.remote?.campaignId === campaignId ? { ...s, remote: null } : s));

  /**
   * Écrit une campagne dans son fichier (en l'écrasant).
   * → { file, savedAt } | { empty } | { same } (rien à écrire) | { conflict: { fileName, savedAt } }
   * `force` : écrase même si le fichier a été modifié ailleurs (choix explicite de l'utilisateur).
   */
  const write = useCallback(async (campaignId, name, data, { force = false } = {}) => {
    if (!rec.current) return {};
    if (!hasContent(data)) return { empty: true };
    const dir = rec.current.handle;
    const fileName = fileNameFor(name);
    const known = rec.current.sync?.[campaignId];
    const print = fingerprint(data);
    if (!force) {
      const savedAt = await fileSavedAt(dir, fileName);
      if (changedElsewhere(savedAt, known, fileName)) {
        // Même contenu que le fichier : simplement à jour
        const remote = await readCampaignFile(dir, fileName);
        if (remote?.print === print) {
          await remember(campaignId, { fileName, savedAt: remote.savedAt, print });
          clearRemote(campaignId);
          return { same: true, file: fileName, savedAt: remote.savedAt };
        }
        setState((s) => ({ ...s, remote: { campaignId, fileName, savedAt } }));
        return { conflict: { fileName, savedAt } };
      }
      if (known?.fileName === fileName && known.print === print) return { same: true, file: fileName, savedAt: known.savedAt };
    }
    const savedAt = await writeCampaignFile(dir, fileName, { name, data });
    // Campagne renommée : l'ancien fichier part (le nouveau nom fait référence)
    if (known?.fileName && known.fileName !== fileName) await removeFolderFile(dir, known.fileName);
    await remember(campaignId, { fileName, savedAt, print });
    clearRemote(campaignId);
    setState((s) => ({ ...s, lastWrite: Date.now(), error: null }));
    return { file: fileName, savedAt };
  }, []);

  /** Écrit toutes les campagnes (après le choix du dossier) */
  const writeAll = useCallback(async () => {
    const { campaigns, readCampaign } = latest.current;
    for (const c of campaigns) {
      const d = await readCampaign(c.id);
      if (d) await write(c.id, c.name, d);
    }
  }, [write]);

  /** Le fichier de la campagne ouverte a-t-il été modifié sur un autre appareil ? */
  const checkRemote = useCallback(async ({ throttle = true } = {}) => {
    if (!rec.current || (throttle && Date.now() - lastCheck.current < CHECK_EVERY)) return;
    lastCheck.current = Date.now();
    const { currentId: id, camp: data } = latest.current;
    const fileName = fileNameFor(nameOf(id));
    const known = rec.current.sync?.[id];
    const savedAt = await fileSavedAt(rec.current.handle, fileName);
    if (!changedElsewhere(savedAt, known, fileName)) return clearRemote(id);
    const remote = await readCampaignFile(rec.current.handle, fileName);
    if (!remote) return;
    if (remote.print === fingerprint(data)) {
      await remember(id, { fileName, savedAt: remote.savedAt, print: remote.print });
      return clearRemote(id);
    }
    setState((s) => ({ ...s, remote: { campaignId: id, fileName, savedAt: remote.savedAt } }));
  }, []);

  /* Au démarrage : dossier déjà choisi ? autorisation encore valable ? */
  useEffect(() => {
    if (!folderSupported) return;
    (async () => {
      const r = await get(FOLDER_KEY);
      if (!r?.handle) return;
      rec.current = { handle: r.handle, sync: r.sync || {} }; // (les anciennes versions avaient files/imported)
      const permission = (await r.handle.queryPermission({ mode: "readwrite" })) === "granted" ? "granted" : "prompt";
      setState((s) => ({ ...s, name: r.handle.name, permission }));
    })().catch(fail);
  }, []);

  /* Dossier accessible, ou autre campagne ouverte : on regarde si son fichier a changé ailleurs */
  useEffect(() => {
    if (loaded && state.permission === "granted" && currentId) checkRemote({ throttle: false }).catch(fail);
  }, [loaded, state.permission, currentId, checkRemote]);

  /**
   * Choisir (ou changer) le dossier. Les fichiers qui portent le nom d'une campagne d'ici sont
   * proposés au chargement ; les autres, à l'import en nouvelles campagnes.
   */
  const choose = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ id: "table-du-maitre", mode: "readwrite" });
      rec.current = { handle, sync: {} };
      await put(FOLDER_KEY, rec.current);
      cache.current = new Map();
      lastCheck.current = Date.now();
      setState({ name: handle.name, permission: "granted", lastWrite: null, error: null, remote: null });
      const candidates = await candidatesIn(handle, { all: true });
      if (candidates.length) setFound(candidates);
      else await writeAll();
    } catch (err) {
      if (err?.name !== "AbortError") fail(err); // AbortError : fenêtre fermée sans choisir
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [writeAll]);

  /** Fichiers du dossier à proposer : campagnes inconnues ici (et, au choix du dossier, celles qui diffèrent) */
  const candidatesIn = async (dir, { all }) => {
    const { campaigns, readCampaign } = latest.current;
    // Un fichier par nom de campagne : « <nom>.json » fait référence. Les anciennes copies
    // (« Ma campagne (2).json »…) ne servent que s'il n'existe pas de fichier à ce nom.
    const byName = new Map();
    for (const f of await listCampaignFiles(dir, cache.current)) {
      const ref = fileNameFor(f.name);
      const cur = byName.get(ref);
      if (!cur || (f.fileName === ref && cur.fileName !== ref)) byName.set(ref, { ...f, ref });
    }
    const out = [];
    for (const f of byName.values()) {
      const local = campaigns.find((c) => fileNameFor(c.name) === f.ref);
      if (!local) {
        out.push(f); // nouvelle campagne
        continue;
      }
      if (!all) continue;
      const d = await readCampaign(local.id);
      if (d && fingerprint(d) === f.print) {
        if (f.fileName === f.ref) await remember(local.id, { fileName: f.ref, savedAt: f.savedAt, print: f.print });
      } else out.push({ ...f, target: local.id, targetName: local.name, empty: !hasContent(d), byName: true });
    }
    return out;
  };

  /** Importer les autres campagnes du dossier (celles qui n'existent pas ici) */
  const lookForBackups = useCallback(async () => {
    try {
      setFound(await candidatesIn(rec.current.handle, { all: false }));
    } catch (err) {
      fail(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fin de la fenêtre : chargements et imports choisis, puis on écrit les campagnes d'ici */
  const finishImport = useCallback(
    async (selected) => {
      setFound(null);
      try {
        const adds = selected.filter((c) => c.mode === "new");
        if (adds.length) {
          const added = await addCampaigns(adds.map((c) => ({ name: c.name, data: c.data })));
          for (const [i, a] of added.entries()) if (adds[i].fileName === adds[i].ref) await remember(a.id, { fileName: adds[i].ref, savedAt: adds[i].savedAt, print: adds[i].print });
        }
        for (const c of selected.filter((c) => c.mode === "update")) await replaceCampaign(c.target, c.data);
        // Chargées ou gardées telles quelles : le fichier de référence est désormais connu ici (une
        // version gardée l'écrasera donc normalement, puisque c'est le choix qui vient d'être fait)
        // (Annuler ne retient rien : le fichier restera signalé comme « modifié ailleurs », sans être écrasé)
        for (const c of selected.filter((c) => c.target)) {
          const savedAt = await fileSavedAt(rec.current.handle, c.ref);
          if (savedAt != null) await remember(c.target, { fileName: c.ref, savedAt, print: c.mode === "update" && c.fileName === c.ref ? c.print : "" });
        }
        await writeAll();
        // La vérification lancée pendant que la fenêtre était ouverte ne tenait pas compte de ces choix
        setState((s) => ({ ...s, remote: null }));
        await checkRemote({ throttle: false });
      } catch (err) {
        fail(err);
      }
    },
    [found, addCampaigns, replaceCampaign, writeAll, checkRemote]
  );

  /** Ré-autoriser l'accès (le navigateur l'exige parfois après un redémarrage) */
  const reconnect = useCallback(async () => {
    try {
      const ok = (await rec.current.handle.requestPermission({ mode: "readwrite" })) === "granted";
      setState((s) => ({ ...s, permission: ok ? "granted" : "prompt", error: null }));
    } catch (err) {
      fail(err);
    }
  }, []);

  /**
   * Bouton « Sauvegarder » : écrase le fichier de la campagne ouverte, puis le relit pour vérifier.
   * → { file, savedAt } | { empty } | { conflict } | { error }. `force` : écraser malgré une version d'ailleurs.
   */
  const saveNow = useCallback(
    async ({ force = false } = {}) => {
      const { currentId: id, camp: data } = latest.current;
      try {
        const before = Date.now();
        const r = await write(id, nameOf(id), data, { force });
        if (r.empty || r.conflict) return r;
        const written = r.same ? await write(id, nameOf(id), data, { force: true }) : r; // inchangé : réécrit quand même
        const savedAt = await fileSavedAt(rec.current.handle, written.file);
        if (!(savedAt >= before)) return { error: `le fichier « ${written.file} » n'a pas été mis à jour.` };
        return { file: written.file, savedAt };
      } catch (err) {
        return { error: fail(err) };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [write]
  );

  /** Bouton « Rafraîchir » : recharge la campagne ouverte depuis son fichier du dossier */
  const refresh = useCallback(async () => {
    const { currentId: id, camp: data } = latest.current;
    try {
      const fileName = fileNameFor(nameOf(id));
      const remote = await readCampaignFile(rec.current.handle, fileName);
      if (!remote) return { missing: fileName };
      await remember(id, { fileName, savedAt: remote.savedAt, print: remote.print });
      clearRemote(id);
      if (remote.print === fingerprint(data)) return { same: true, file: fileName, savedAt: remote.savedAt };
      await replaceCampaign(id, remote.data);
      return { loaded: true, file: fileName, savedAt: remote.savedAt };
    } catch (err) {
      return { error: fail(err) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaceCampaign]);

  /** Campagne supprimée dans l'appli : son fichier quitte aussi le dossier */
  const removeFile = useCallback(
    async (campaignId, name) => {
      if (!rec.current || state.permission !== "granted") return;
      try {
        await removeFolderFile(rec.current.handle, rec.current.sync?.[campaignId]?.fileName || fileNameFor(name));
        const sync = { ...rec.current.sync };
        delete sync[campaignId];
        rec.current = { ...rec.current, sync };
        await put(FOLDER_KEY, rec.current);
      } catch (err) {
        fail(err);
      }
    },
    [state.permission]
  );

  const forget = useCallback(async () => {
    rec.current = null;
    await del(FOLDER_KEY);
    setState({ name: "", permission: "none", lastWrite: null, error: null, remote: null });
  }, []);

  /* Écriture automatique de la campagne ouverte, 2 s après la dernière modification
     (jamais pendant la fenêtre de choix, ni par-dessus une version enregistrée ailleurs) */
  const currentName = campaigns.find((c) => c.id === currentId)?.name;
  const blocked = !!found || state.remote?.campaignId === currentId;
  useEffect(() => {
    if (!loaded || state.permission !== "granted" || !currentId || blocked) return;
    const t = setTimeout(() => write(currentId, currentName, camp).catch(fail), 2000);
    return () => clearTimeout(t);
  }, [camp, currentId, currentName, loaded, state.permission, write, blocked]);

  /* Onglet masqué : écriture immédiate ; retour sur l'onglet : le fichier a-t-il changé ailleurs ? */
  useEffect(() => {
    const onVisibility = () => {
      if (state.permission !== "granted") return;
      if (document.visibilityState === "visible") return checkRemote().catch(fail);
      const { currentId: id, camp: data } = latest.current;
      if (id && !blocked) write(id, nameOf(id), data).catch(fail);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.permission, write, checkRemote, blocked]);

  return { supported: folderSupported, ...state, found, choose, reconnect, saveNow, refresh, removeFile, forget, lookForBackups, finishImport };
}
