/* Service worker : l'appli reste utilisable sans connexion (à la table, en déplacement).
   - Page : réseau d'abord (on voit tout de suite la dernière version), copie locale si hors ligne.
   - Fichiers (scripts, styles, polices, icônes) : copie locale d'abord ; leurs noms changent
     à chaque version, donc une copie n'est jamais périmée. */
const CACHE = "table-du-maitre-v3";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/** Fichiers chargés par la page (scripts, styles, icônes) */
const filesOf = (html) => [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|webmanifest))"/g)].map((m) => new URL(m[1], self.registration.scope).href);

/* Nouvelle version de la page : on retire du cache les fichiers des versions précédentes
   (sinon il grossit à chaque mise à jour). Seul le dossier assets/ est concerné.
   ponytail: suppose que la page charge tous ses scripts d'emblée (pas de découpage en morceaux). */
async function prune(res) {
  const keep = new Set(filesOf(await res.text()));
  if (!keep.size) return; // page inattendue : on ne touche à rien
  const cache = await caches.open(CACHE);
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (u.origin === location.origin && u.pathname.includes("/assets/") && !keep.has(req.url)) await cache.delete(req);
  }
}

/* Installation : on met tout de suite en cache la page et les fichiers qu'elle charge,
   pour que l'appli marche hors ligne dès la première visite (et pas seulement la suivante). */
self.addEventListener("install", (ev) =>
  ev.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(self.registration.scope, { cache: "no-cache" });
      const html = await res.clone().text();
      await cache.put(new Request(self.registration.scope), res);
      await cache.addAll(filesOf(html));
    })()
      .catch(() => {}) // hors ligne pendant l'installation : le cache se remplira à l'usage
      .then(() => self.skipWaiting())
  )
);
self.addEventListener("activate", (ev) =>
  ev.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

const save = (key, res) => {
  if (res.ok || res.type === "opaque") caches.open(CACHE).then((c) => c.put(key, res.clone()));
  return res;
};

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !FONT_HOSTS.includes(url.hostname)) return;

  if (req.mode === "navigate") {
    // Une seule page : « ?joueurs » et les autres adresses servent le même index.html
    const key = new Request(self.registration.scope);
    ev.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) ev.waitUntil(prune(res.clone()).catch(() => {}));
          return save(key, res);
        })
        .catch(() => caches.match(key, { ignoreVary: true }))
    );
    return;
  }
  // ignoreVary : certains serveurs répondent « Vary: Origin », et les scripts chargés en
  // « crossorigin » ne correspondraient alors jamais à la copie mise en cache à l'installation
  ev.respondWith(caches.match(req, { ignoreVary: true }).then((cached) => cached || fetch(req).then((res) => save(req, res))));
});
