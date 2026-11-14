/* Dossier de sauvegarde choisi par l'utilisateur (API « File System Access » :
   Chrome et Edge sur ordinateur). Chaque campagne y est écrite dans son propre fichier JSON,
   importable aussi avec le bouton « Importer ».

   Règle d'or : on n'écrase jamais un fichier qui n'est pas à nous. Nos fichiers portent
   l'identifiant de ce navigateur (installId) ; tout autre fichier est seulement lu, et proposé
   à l'import : en nouvelle campagne, ou en mise à jour de la même campagne (même syncId,
   ou à défaut même nom) si elle existe déjà ici. */

import { normalizeCampaign } from "../utils/helpers.js";

export const folderSupported = typeof window !== "undefined" && "showDirectoryPicker" in window;

const hasContent = (d) => ["entities", "combats", "sessions", "world"].some((k) => d?.[k]?.length);
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
async function isOurs(dir, name, installId, campaignId) {
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
 * renvoie la table mise à jour. Les campagnes vides et celles identiques à une sauvegarde
 * d'un autre appareil (`foreignPrints`, ex. juste importée) ne sont pas écrites.
 */
export async function saveCampaignFile(dir, files, { installId, campaignId, name, data, foreignPrints = new Set() }) {
  if (!hasContent(data) || foreignPrints.has(fingerprint(data))) return files;
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

/**
 * Parcourt le dossier : sauvegardes d'autres appareils (ou anciennes installations)
 * à proposer à l'import, sauf celles déjà présentes à l'identique dans l'appli et celles
 * déjà importées (`imported` : nom de fichier → date de la version importée). Une version
 * plus récente d'un fichier déjà importé est de nouveau proposée.
 * `own` : pour nos propres fichiers, campagne → { savedAt, print, name } (dernière version écrite ici).
 */
export async function scanFolder(dir, { installId, localPrints = new Set(), imported = {} }) {
  const candidates = [];
  const foreignPrints = new Set();
  const own = {};
  for await (const [fileName, handle] of dir.entries()) {
    if (handle.kind !== "file" || !/\.json$/i.test(fileName)) continue;
    try {
      const file = await handle.getFile();
      const json = JSON.parse(await file.text());
      const n = normalizeCampaign(json); // lève une erreur si ce n'est pas une campagne
      if (json.installId && json.installId === installId) {
        // nos propres sauvegardes : on retient seulement la dernière version écrite
        own[json.campaignId] = { savedAt: json.savedAt || file.lastModified, print: fingerprint(json), name: json.name };
        continue;
      }
      const print = fingerprint(json);
      foreignPrints.add(print);
      const savedAt = json.savedAt || file.lastModified;
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
  return { candidates: candidates.sort((a, b) => b.savedAt - a.savedAt), foreignPrints, own };
}

const baseName = (n) => String(n).replace(/ \(importée(?: \d+)?\)$/, "");

/**
 * Relie chaque sauvegarde trouvée à la campagne locale correspondante, s'il y en a une :
 * même identifiant commun (syncId), ou à défaut même nom (au suffixe « (importée) » près).
 * `newer` : la sauvegarde est plus récente que la dernière version de cette campagne écrite ici.
 * `locals` : [{ id, name, syncId }] ; `own` : renvoyé par scanFolder.
 */
export function matchCandidates(candidates, locals, own = {}) {
  return candidates.map((f) => {
    const t = (f.syncId && locals.find((l) => l.syncId === f.syncId)) || locals.find((l) => baseName(l.name) === baseName(f.name));
    return t ? { ...f, target: t.id, targetName: t.name, newer: f.savedAt > (own[t.id]?.savedAt || 0) } : f;
  });
}
