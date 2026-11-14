/* Dossier de sauvegarde choisi par l'utilisateur (API « File System Access » :
   Chrome et Edge, ordinateur et Android). Chaque campagne y a UN fichier, nommé d'après
   la campagne (« Ma campagne.json ») : c'est la référence partagée entre appareils.
   Enregistrer écrase ce fichier ; « Rafraîchir » le relit. Les fichiers s'importent aussi
   avec le bouton « Importer ». */

import { normalizeCampaign } from "../utils/helpers.js";

export const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

export const hasContent = (d) => ["entities", "combats", "sessions", "world"].some((k) => d?.[k]?.length);
export const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "Campagne";
/** Le fichier d'une campagne dans le dossier : son nom */
export const fileNameFor = (name) => `${safeName(name)}.json`;

/** Empreinte du contenu d'une campagne, pour repérer les versions identiques (l'identifiant commun n'en fait pas partie) */
export function fingerprint(data) {
  const n = normalizeCampaign(data);
  return JSON.stringify([n.entities, n.combats, n.sessions, n.world, n.settings.rules]);
}

async function fileOf(dir, fileName) {
  try {
    return await (await dir.getFileHandle(fileName)).getFile();
  } catch {
    return null; // absent
  }
}

/** Date d'enregistrement d'un fichier de campagne, en ne lisant que son début ; null s'il n'existe pas */
export async function fileSavedAt(dir, fileName) {
  const file = await fileOf(dir, fileName);
  if (!file) return null;
  const m = (await file.slice(0, 600).text()).match(/"savedAt":(\d+)/);
  return m ? Number(m[1]) : file.lastModified;
}

/** Lit un fichier de campagne → { data, savedAt, print } ; null s'il n'existe pas ou n'est pas une campagne */
export async function readCampaignFile(dir, fileName) {
  const file = await fileOf(dir, fileName);
  if (!file) return null;
  try {
    const data = JSON.parse(await file.text());
    normalizeCampaign(data); // lève une erreur si ce n'est pas une campagne
    return { data, savedAt: data.savedAt || file.lastModified, print: fingerprint(data) };
  } catch {
    return null;
  }
}

/** Écrit (en écrasant) le fichier d'une campagne ; renvoie sa date d'enregistrement */
export async function writeCampaignFile(dir, fileName, { name, data }) {
  const savedAt = Date.now();
  const w = await (await dir.getFileHandle(fileName, { create: true })).createWritable();
  // savedAt en tête : fileSavedAt() le lit sans charger tout le fichier
  await w.write(JSON.stringify({ app: "table-du-maitre", savedAt, name, ...data }));
  await w.close();
  return savedAt;
}

export async function removeFile(dir, fileName) {
  await dir.removeEntry(fileName).catch(() => {});
}

/**
 * Le fichier a-t-il été enregistré ailleurs depuis la dernière fois que cet appareil l'a lu ou écrit ?
 * `known` : { fileName, savedAt } de notre dernière synchronisation avec ce fichier.
 * Un fichier présent mais jamais synchronisé d'ici compte aussi comme « modifié ailleurs ».
 */
export const changedElsewhere = (savedAt, known, fileName) => savedAt != null && (!known || known.fileName !== fileName || savedAt > known.savedAt);

/**
 * Toutes les campagnes du dossier → [{ fileName, name, data, savedAt, print, counts }].
 * `cache` (Map, facultatif) : les fichiers inchangés depuis le dernier passage ne sont pas relus
 * (utile sur un dossier Drive, où chaque lecture peut télécharger le fichier).
 */
export async function listCampaignFiles(dir, cache = new Map()) {
  const list = [];
  const seen = new Set();
  for await (const [fileName, handle] of dir.entries()) {
    if (handle.kind !== "file" || !/\.json$/i.test(fileName)) continue;
    seen.add(fileName);
    try {
      const file = await handle.getFile();
      let entry = cache.get(fileName);
      if (!entry || entry.lastModified !== file.lastModified || entry.size !== file.size) {
        let json = null;
        try {
          json = JSON.parse(await file.text());
          normalizeCampaign(json);
        } catch {
          json = null; // autre fichier JSON : ignoré (et mémorisé pour ne pas le relire)
        }
        entry = { lastModified: file.lastModified, size: file.size, json, print: json && fingerprint(json) };
        cache.set(fileName, entry);
      }
      const { json, print } = entry;
      if (!json) continue;
      const n = normalizeCampaign(json);
      list.push({
        fileName,
        name: String(json.name || fileName.replace(/\.json$/i, "")),
        data: json,
        savedAt: json.savedAt || file.lastModified,
        print,
        counts: { entities: n.entities.length, combats: n.combats.length, sessions: n.sessions.length, world: n.world.length },
      });
    } catch {
      /* fichier illisible : ignoré */
    }
  }
  for (const k of [...cache.keys()]) if (!seen.has(k)) cache.delete(k); // fichiers disparus
  return list.sort((a, b) => b.savedAt - a.savedAt);
}

/* ——— Bouton « Importer » (fichier JSON choisi à la main) ——— */

const baseName = (n) => String(n).replace(/ \(importée(?: \d+)?\)$/, "");

/**
 * Relie un fichier importé à la campagne locale correspondante, s'il y en a une :
 * même identifiant commun (syncId), ou à défaut même nom (au suffixe « (importée) » près).
 * `sure` : certainement la même campagne (même syncId), ou celle d'ici est vide. Un simple nom
 * identique peut désigner deux campagnes différentes : jamais coché d'office.
 * `locals` : [{ id, name, syncId, empty }].
 */
export function matchCandidates(candidates, locals) {
  return candidates.map((f) => {
    const bySync = f.syncId && locals.find((l) => l.syncId === f.syncId);
    const t = bySync || locals.find((l) => baseName(l.name) === baseName(f.name));
    if (!t) return f;
    return { ...f, target: t.id, targetName: t.name, sure: !!bySync || !!t.empty };
  });
}

/** Copie d'une campagne ajoutée « en nouvelle campagne » alors qu'elle existe déjà ici : elle reçoit son propre identifiant */
export const withoutSync = (data) => ({ ...data, settings: { ...data.settings, syncId: undefined } });
