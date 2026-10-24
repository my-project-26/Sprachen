// Service Worker: macht die App offline nutzbar (Lernen geht ohne Internet,
// nur Geschichten/KI brauchen eine Verbindung).
const CACHE = "wortwerk-v49";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "skins.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/cloud.js",
  "js/listen.js",
  "js/practice.js",
  "js/chat.js",
  "js/firebase-config.js",
  "js/store.js",
  "js/fsrs.js",
  "js/words.js",
  "js/wordbank.js",
  "js/prompts.js",
  "js/api.js",
  "js/tts.js",
  "js/skins.js",
  "js/langs.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.includes("/api/")) return;
  if (url.origin !== location.origin) {
    // Nur Schriften cachen; KI-, Übersetzungs- und andere Dienste direkt durchlassen
    if (!/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) && !(url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/"))) return;
    // Schriften: aus dem Cache, sonst Netz
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
    return;
  }
  // Eigene Dateien: Netz zuerst (immer aktuell), offline aus dem Cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
