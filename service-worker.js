const CACHE_NAME = "feuerwehr-lernapp-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./questions.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./assets/questions/gefahrgutklasse-1-explosive-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-2-1-brennbare-gase.jpg",
  "./assets/questions/gefahrgutklasse-2-2-nicht-brennbare-gase.jpg",
  "./assets/questions/gefahrgutklasse-2-3-giftige-gase.jpg",
  "./assets/questions/gefahrgutklasse-3-entzuendbare-fluessigkeiten.jpg",
  "./assets/questions/gefahrgutklasse-4-1-entzuendbare-feste-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-4-2-selbstentzuendliche-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-4-3-wasserreaktiv.jpg",
  "./assets/questions/gefahrgutklasse-5-1-oxidierend.jpg",
  "./assets/questions/gefahrgutklasse-5-2-organische-peroxide.jpg",
  "./assets/questions/gefahrgutklasse-6-1-giftige-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-6-2-ansteckungsgefaehrliche-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-7a-radioaktiv-kategorie-i.jpg",
  "./assets/questions/gefahrgutklasse-7b-radioaktiv-kategorie-ii.jpg",
  "./assets/questions/gefahrgutklasse-7c-radioaktiv-kategorie-iii.jpg",
  "./assets/questions/gefahrgutklasse-7e-spaltbare-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-8-aetzende-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-9-sonstige-gefaehrliche-stoffe.jpg",
  "./assets/questions/gefahrgutklasse-9a-lithium-batterien.jpg",
  "./assets/questions/brandklasse-a.avif",
  "./assets/questions/brandklasse-b.avif",
  "./assets/questions/brandklasse-c.avif",
  "./assets/questions/brandklasse-d.avif",
  "./assets/questions/brandklasse-f.avif",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
