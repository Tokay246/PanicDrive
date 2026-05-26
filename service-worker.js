const CACHE_NAME = "panicdrive-v0.1.12";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/css/styles.css",
  "./assets/logo/panicdrive-mark.png",
  "./assets/logo/ecg-underline.svg",
  "./assets/icons/exam.png",
  "./assets/icons/shield.png",
  "./assets/icons/phonebook.png",
  "./assets/icons/plus.svg",
  "./js/app.js",
  "./js/search.js",
  "./js/sync.js",
  "./js/guidelines.js",
  "./data/modules.json",
  "./data/README-pagine-gialle-import.md",
  "./data/pagine-gialle-template.csv",
  "./data/README-esami-obiettivi.md",
  "./data/_template-esame-obiettivo.json",
  "./data/esami-obiettivi.json",
  "./data/pagine-gialle.json",
  "./data/sources.json",
  "./data/guidelines/README.md",
  "./data/guidelines/_template-patologia.json",
  "./data/guidelines/index.json",
  "./data/guidelines/fibrillazione-atriale.json",
  "./data/guidelines/polmonite-comunita.json",
  "./data/guidelines/embolia-polmonare.json",
  "./data/guidelines/diarrea-acuta.json",
  "./data/guidelines/gastrite-dispepsia.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
