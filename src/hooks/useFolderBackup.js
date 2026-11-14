import { useState, useEffect, useRef, useCallback } from "react";
import { get, put, del } from "./db.js";
import { uid } from "../utils/helpers.js";
import { folderSupported, saveCampaignFile, scanFolder, fingerprint } from "../sync/folder.js";

const FOLDER_KEY = "__folder"; // { handle, files: { campaignId: nomDeFichier }, imported: { nomDeFichier: savedAt } }
const INSTALL_KEY = "__install"; // identifiant de ce navigateur, écrit dans nos fichiers

/**
 * Dossier de sauvegarde choisi par l'utilisateur : la campagne ouverte y est écrite
 * 2 s après chaque modification (et quand l'onglet est masqué). Au choix du dossier,
 * les sauvegardes déjà présentes sont proposées à l'import (en nouvelles campagnes).
 * Après un redémarrage du navigateur, celui-ci peut redemander l'autorisation d'accès.
 */
export function useFolderBackup({ loaded, currentId, camp, campaigns, readCampaign, addCampaigns }) {
  const [state, setState] = useState({ name: "", permission: "none", lastWrite: null, error: null }); // permission : none | prompt | granted
  const [found, setFound] = useState(null); // sauvegardes trouvées, à proposer à l'import
  const rec = useRef(null);
  const installId = useRef(null);
  const foreignPrints = useRef(new Set());
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

  /* Empreintes des sauvegardes étrangères (pour ne pas les recopier) et propositions d'import */
  const scan = useCallback(async () => {
    const { campaigns, readCampaign } = latest.current;
    const localPrints = new Set();
    for (const c of campaigns) {
      const d = await readCampaign(c.id);
      if (d) localPrints.add(fingerprint(d));
    }
    const res = await scanFolder(rec.current.handle, { installId: installId.current, localPrints, imported: rec.current.imported || {} });
    foreignPrints.current = res.foreignPrints;
    return res.candidates;
  }, []);

  const write = useCallback(async (campaignId, name, data) => {
    if (!rec.current) return;
    const files = await saveCampaignFile(rec.current.handle, rec.current.files, {
      installId: installId.current,
      campaignId,
      name,
      data,
      foreignPrints: foreignPrints.current,
    });
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
      if (permission === "granted") await scan(); // seulement les empreintes : pas de proposition au démarrage
    })().catch(fail);
  }, [scan]);

  /** Choisir (ou changer) le dossier : propose d'importer ce qu'il contient déjà */
  const choose = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ id: "table-du-maitre", mode: "readwrite" });
      rec.current = { handle, files: {} };
      await put(FOLDER_KEY, rec.current);
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

  /** Fin de la fenêtre d'import : on importe la sélection, puis on écrit nos campagnes */
  const finishImport = useCallback(
    async (selected) => {
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
        if (selected.length) {
          await addCampaigns(selected.map((c) => ({ name: unique(c.name), data: c.data })));
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
    [addCampaigns, writeAll]
  );

  /** Ré-autoriser l'accès (le navigateur l'exige parfois après un redémarrage) */
  const reconnect = useCallback(async () => {
    try {
      const ok = (await rec.current.handle.requestPermission({ mode: "readwrite" })) === "granted";
      setState((s) => ({ ...s, permission: ok ? "granted" : "prompt", error: null }));
      if (ok) {
        await scan();
        await writeAll();
      }
    } catch (err) {
      fail(err);
    }
  }, [scan, writeAll]);

  /** Bouton « Sauvegarder » : écrit la campagne ouverte tout de suite → { file } ou { error } */
  const saveNow = useCallback(async () => {
    const { currentId: id, camp: data, campaigns: list } = latest.current;
    try {
      await write(id, list.find((c) => c.id === id)?.name, data);
      return { file: rec.current.files[id] };
    } catch (err) {
      return { error: fail(err) };
    }
  }, [write]);

  const forget = useCallback(async () => {
    rec.current = null;
    await del(FOLDER_KEY);
    setState({ name: "", permission: "none", lastWrite: null, error: null });
  }, []);

  /* Écriture de la campagne ouverte, 2 s après la dernière modification */
  const currentName = campaigns.find((c) => c.id === currentId)?.name;
  useEffect(() => {
    if (!loaded || state.permission !== "granted" || !currentId) return;
    const t = setTimeout(() => write(currentId, currentName, camp).catch(fail), 2000);
    return () => clearTimeout(t);
  }, [camp, currentId, currentName, loaded, state.permission, write]);

  /* Onglet masqué ou fermé : écriture immédiate */
  useEffect(() => {
    const onHide = () => {
      const { currentId: id, camp: data, campaigns: list } = latest.current;
      if (document.visibilityState === "hidden" && state.permission === "granted" && id) {
        write(id, list.find((c) => c.id === id)?.name, data).catch(fail);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [state.permission, write]);

  return { supported: folderSupported, ...state, found, choose, reconnect, saveNow, forget, lookForBackups, finishImport };
}
