/* Service worker : l'appli reste utilisable sans connexion (à la table, en déplacement).
   Stratégie « cache puis réseau » : on sert la copie locale tout de suite et on la
   met à jour en arrière-plan ; une nouvelle version apparaît au chargement suivant. */
// ponytail: les anciens fichiers de version restent en cache ; changer CACHE pour tout purger si besoin.
const CACHE = "table-du-maitre-v1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) =>
  ev.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin && !FONT_HOSTS.includes(url.hostname)) return;

  // Une seule page : « ?joueurs » et les autres adresses servent le même index.html
  const key = req.mode === "navigate" ? new Request(self.registration.scope) : req;
  const fresh = caches.open(CACHE).then((cache) =>
    fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") cache.put(key, res.clone());
      return res;
    })
  );
  ev.waitUntil(fresh.catch(() => {}));
  ev.respondWith(caches.match(key).then((cached) => cached || fresh));
});
