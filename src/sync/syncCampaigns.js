/**
 * Synchronise les campagnes locales avec un stockage distant (Google Drive).
 * Règle : la version modifiée le plus récemment gagne ; une campagne supprimée sur un
 * appareil l'est partout (liste « deleted » partagée dans un fichier d'index).
 * ponytail: dates des appareils comparées telles quelles ; une horloge très décalée peut
 * faire gagner la mauvaise version (la copie de secours faite avant remplacement limite la casse).
 *
 * drive  : { list(), download(fileId), upload(fileId | undefined, meta, content) → fileId, remove(fileId) }
 * local  : { list: [{ id, name, updatedAt }], deleted: [ids] }
 * read   : (id) → données locales de la campagne
 * apply  : (id, name, data, updatedAt) → remplace / ajoute la campagne localement
 * remove : (id) → supprime la campagne localement
 */
export async function syncCampaigns({ drive, local, read, apply, remove }) {
  const files = await drive.list();
  const indexFile = files.find((f) => f.appProperties?.kind === "index");
  const remoteDeleted = indexFile ? (await drive.download(indexFile.id)).deleted || [] : [];
  const deleted = [...new Set([...remoteDeleted, ...local.deleted])].slice(-500);
  const remote = new Map(
    files
      .filter((f) => f.appProperties?.kind === "campaign")
      .map((f) => [f.appProperties.campaignId, { fileId: f.id, updatedAt: Number(f.appProperties.updatedAt) || 0 }])
  );
  const report = { up: [], down: [], removed: [], deleted };

  for (const id of new Set([...local.list.map((c) => c.id), ...remote.keys()])) {
    const l = local.list.find((c) => c.id === id);
    const r = remote.get(id);
    if (deleted.includes(id)) {
      if (r) await drive.remove(r.fileId);
      if (l) {
        await remove(id);
        report.removed.push(id);
      }
      continue;
    }
    const lt = l?.updatedAt || 0;
    const rt = r?.updatedAt || 0;
    if (r && (!l || rt > lt)) {
      const content = await drive.download(r.fileId);
      await apply(id, content.name, content.data, rt);
      report.down.push(id);
    } else if (l && lt > rt) {
      // lt = 0 : campagne jamais modifiée (ex. campagne vide d'un nouvel appareil) → on n'envoie rien
      const data = await read(id);
      if (!data) continue;
      const meta = {
        name: `campagne-${id}.json`,
        appProperties: { kind: "campaign", campaignId: id, updatedAt: String(lt), title: (l.name || "").slice(0, 60) },
      };
      await drive.upload(r?.fileId, meta, { name: l.name, data });
      report.up.push(id);
    }
  }

  if (!indexFile || deleted.length !== remoteDeleted.length) {
    await drive.upload(indexFile?.id, { name: "index.json", appProperties: { kind: "index" } }, { deleted });
  }
  return report;
}
