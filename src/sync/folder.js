/* Dossier de sauvegarde choisi par l'utilisateur (API « File System Access » :
   Chrome et Edge sur ordinateur). Chaque campagne y est écrite dans son propre fichier JSON,
   importable aussi avec le bouton « Importer ».

   Règle d'or : on n'écrase jamais un fichier qui n'est pas à nous. Nos fichiers portent
   l'identifiant de ce navigateur (installId) ; tout autre fichier est seulement lu, et proposé
   à l'import : en nouvelle campagne, ou en mise à jour de la même campagne (même syncId,
   ou à défaut même nom) si elle existe déjà ici. */

import { normalizeCampaign } from "../utils/helpers.js";

export const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

export const hasContent = (d) => ["entities", "combats", "sessions", "world"].some((k) => d?.[k]?.length);
export const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || "Campagne";
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Empreinte du contenu d'une campagne, pour repérer les doublons exacts (l'identifiant commun n'en fait pas partie) */
export function fingerprint(data) {
  const n = normalizeCampaign(data);
  return JSON.stringify([n.entities, n.combats, n.sessions, n.world, n.settings.rules]);
}

async function exists(dir, name) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function freeName(dir, base) {
  for (let i = 1; ; i++) {
    const name = i === 1 ? `${base}.json` : `${base} (${i}).json`;
    if (!(await exists(dir, name))) return name;
  }
}

/** Le fichier appartient-il à ce navigateur, pour cette campagne ? (lit seulement le début) */
export async function isOurs(dir, name, installId, campaignId) {
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    const head = await file.slice(0, 400).text();
    return head.includes(`"installId":"${installId}"`) && head.includes(`"campaignId":"${campaignId}"`);
  } catch {
    return false; // disparu ou illisible : on en créera un nouveau
  }
}

/**
 * Écrit une campagne dans le dossier. `files` associe chaque campagne à son fichier ;
 * renvoie la table mise à jour. Les campagnes vides ne sont pas écrites. Une campagne identique
 * à la sauvegarde d'un autre appareil l'est quand même : notre fichier doit toujours refléter
 * l'état de la campagne ici (les autres appareils l'ignorent, puisqu'ils l'ont déjà).
 */
export async function saveCampaignFile(dir, files, { installId, campaignId, name, data }) {
  if (!hasContent(data)) return files;
  const base = safeName(name);
  let file = files[campaignId];
  const sameName = file && new RegExp(`^${escapeRe(base)}( \\(\\d+\\))?\\.json$`).test(file);
  if (!file || !sameName || !(await isOurs(dir, file, installId, campaignId))) {
    const next = await freeName(dir, base);
    // Campagne renommée : on retire l'ancien fichier, seulement s'il est bien à nous
    if (file && file !== next && (await isOurs(dir, file, installId, campaignId))) await dir.removeEntry(file).catch(() => {});
    file = next;
    files = { ...files, [campaignId]: file };
  }
  const handle = await dir.getFileHandle(file, { create: true });
  const w = await handle.createWritable();
  // installId et campaignId en tête : isOurs() les lit sans charger tout le fichier
  await w.write(JSON.stringify({ installId, campaignId, app: "table-du-maitre", name, savedAt: Date.now(), ...data }));
  await w.close();
  return files;
}

/** Campagne supprimée : on retire son fichier (seulement s'il est bien à nous) ; renvoie la table mise à jour */
export async function removeCampaignFile(dir, files, { installId, campaignId }) {
  const file = files[campaignId];
  if (!file) return files;
  if (await isOurs(dir, file, installId, campaignId)) await dir.removeEntry(file).catch(() => {});
  const rest = { ...files };
  delete rest[campaignId];
  return rest;
}

/**
 * Parcourt le dossier : sauvegardes d'autres appareils (ou anciennes installations)
 * à proposer à l'import, sauf celles déjà présentes à l'identique dans l'appli et celles
 * déjà importées (`imported` : nom de fichier → date de la version importée). Une version
 * plus récente d'un fichier déjà importé est de nouveau proposée.
 * `own` : pour nos propres fichiers, campagne → { savedAt, print, name } (dernière version écrite ici).
 * `cache` (Map, facultatif) : les fichiers inchangés depuis le dernier passage ne sont pas relus
 * (utile sur un dossier Drive, où chaque lecture peut télécharger le fichier).
 */
export async function scanFolder(dir, { installId, localPrints = new Set(), imported = {}, cache = new Map() }) {
  const candidates = [];
  const own = {};
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
          normalizeCampaign(json); // lève une erreur si ce n'est pas une campagne
        } catch {
          json = null; // autre fichier JSON : ignoré (et mémorisé pour ne pas le relire)
        }
        entry = { lastModified: file.lastModified, size: file.size, json, print: json && fingerprint(json) };
        cache.set(fileName, entry);
      }
      const { json, print } = entry;
      if (!json) continue;
      const n = normalizeCampaign(json);
      const savedAt = json.savedAt || file.lastModified;
      if (json.installId && json.installId === installId) {
        // nos propres sauvegardes : on retient la dernière version écrite de chaque campagne
        if (!(own[json.campaignId]?.savedAt > savedAt)) own[json.campaignId] = { savedAt, print, name: json.name };
        continue;
      }
      if (localPrints.has(print) || imported[fileName] === savedAt) continue;
      candidates.push({
        fileName,
        name: String(json.name || fileName.replace(/\.json$/i, "")),
        data: json,
        savedAt,
        syncId: n.settings.syncId || null,
        counts: { entities: n.entities.length, combats: n.combats.length, sessions: n.sessions.length, world: n.world.length },
      });
    } catch {
      /* autre fichier JSON : ignoré */
    }
  }
  for (const k of [...cache.keys()]) if (!seen.has(k)) cache.delete(k); // fichiers disparus
  return { candidates: candidates.sort((a, b) => b.savedAt - a.savedAt), own };
}

const baseName = (n) => String(n).replace(/ \(importée(?: \d+)?\)$/, "");

/**
 * Relie chaque sauvegarde trouvée à la campagne locale correspondante, s'il y en a une :
 * même identifiant commun (syncId), ou à défaut même nom (au suffixe « (importée) » près).
 * `sure` : c'est certainement la même campagne (même syncId), ou celle d'ici est vide (première
 * installation). Un simple nom identique peut désigner deux campagnes différentes (deux « Ma
 * campagne ») : ce n'est alors jamais proposé automatiquement ni coché d'office.
 * `newer` : la sauvegarde est plus récente que la dernière version de cette campagne écrite ici.
 * `locals` : [{ id, name, syncId, empty }] ; `own` : renvoyé par scanFolder.
 */
export function matchCandidates(candidates, locals, own = {}) {
  return candidates.map((f) => {
    const bySync = f.syncId && locals.find((l) => l.syncId === f.syncId);
    const t = bySync || locals.find((l) => baseName(l.name) === baseName(f.name));
    if (!t) return f;
    return { ...f, target: t.id, targetName: t.name, sure: !!bySync || !!t.empty, newer: f.savedAt > (own[t.id]?.savedAt || 0) };
  });
}



/** Copie d'une campagne ajoutée « en nouvelle campagne » alors qu'elle existe déjà ici : elle reçoit son propre identifiant */
export const withoutSync = (data) => ({ ...data, settings: { ...data.settings, syncId: undefined } });
