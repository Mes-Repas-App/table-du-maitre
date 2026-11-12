/* Service worker : l'appli reste utilisable sans connexion (à la table, en déplacement).
   - Page : réseau d'abord (on voit tout de suite la dernière version), copie locale si hors ligne.
   - Fichiers (scripts, styles, polices, icônes) : copie locale d'abord ; leurs noms changent
     à chaque version, donc une copie n'est jamais périmée. */
// ponytail: les anciens fichiers de version restent en cache ; changer CACHE pour tout purger si besoin.
const CACHE = "table-du-maitre-v3";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/* Installation : on met tout de suite en cache la page et les fichiers qu'elle charge,
   pour que l'appli marche hors ligne dès la première visite (et pas seulement la suivante). */
self.addEventListener("install", (ev) =>
  ev.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch(self.registration.scope, { cache: "no-cache" });
      const html = await res.clone().text();
      await cache.put(new Request(self.registration.scope), res);
      const files = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|webmanifest))"/g)].map((m) => new URL(m[1], self.registration.scope).href);
      await cache.addAll(files);
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
    ev.respondWith(fetch(req).then((res) => save(key, res)).catch(() => caches.match(key, { ignoreVary: true })));
    return;
  }
  // ignoreVary : certains serveurs répondent « Vary: Origin », et les scripts chargés en
  // « crossorigin » ne correspondraient alors jamais à la copie mise en cache à l'installation
  ev.respondWith(caches.match(req, { ignoreVary: true }).then((cached) => cached || fetch(req).then((res) => save(req, res))));
});
