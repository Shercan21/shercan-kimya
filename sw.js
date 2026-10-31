/* SHERCAN Kimya service worker: uygulama kabuğunu ve verileri önbelleğe alır, internet yokken de açılır.
   İçerik değiştiğinde SURUM'ü artır. */
const SURUM = "shercan-v10";
const KABUK = [
  "./", "index.html", "app.css", "app.js", "manifest.webmanifest",
  "icons/atom.webp", "icons/neon.webp", "icons/ikon-192.png", "icons/ikon-64.png",
  "veri/9.json", "veri/10.json", "veri/11.json",
  "konu/10/1.1.html",
  "konu/10/1.2.html",
  "konu/10/2.1.html",
  "konu/10/3.1.html",
  "konu/11/1.1.html",
  "konu/11/1.2.html",
  "konu/11/2.1.html",
  "konu/11/2.2.html",
  "konu/11/2.3.html",
  "konu/11/3.1.html",
  "konu/9/1.1.html",
  "konu/9/1.2.html",
  "konu/9/2.1.html",
  "konu/9/2.2.html",
  "konu/9/3.1.html",
  "veri/etk9.json",
  "veri/etk10.json",
  "veri/etk11.json",
  "veri/yazili9.json", "veri/yazili10.json", "veri/yazili11.json",
  "img/etk/10/kh-1_1_1-6.png",
  "img/etk/10/kh-1_1_2-6.png",
  "img/etk/11/kh-1_1_1-6.png",
  "img/etk/11/kh-1_2_1-6.png",
  "img/etk/11/kh-1_2_3-6.png",
  "img/etk/11/kh-2_1_5-6.png",
  "img/etk/9/kh-1_1_1-5.png",
  "img/etk/9/kh-1_1_2-3-5.png",
  "img/etk/9/kh-1_1_4-5.png",
  "img/etk/9/kh-1_2_3-A-5.png",
  "img/etk/9/kh-1_2_3-B-6.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SURUM).then(c => c.addAll(KABUK.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== SURUM).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Önce önbellek, arkadan güncelle (stale-while-revalidate). Konu sayfaları, görseller ve yazı tipleri ilk açılışta saklanır. */
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const url = new URL(r.url);
  const font = url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com");
  if (url.origin !== location.origin && !font) return;
  if (url.pathname.includes("/yonetim")) return;  /* yönetim paneli her zaman en güncel hâliyle ağdan gelir */
  if (url.pathname.endsWith("/veri/ayar.json")) {
    /* Ayarlar her zaman ağdan; internet yoksa son kaydedilen. */
    e.respondWith(fetch(r, { cache: "no-store" }).then(cev => {
      const k = cev.clone(); caches.open(SURUM).then(c => c.put(r, k)); return cev;
    }).catch(() => caches.match(r, { ignoreSearch: true })));
    return;
  }
  e.respondWith(
    caches.open(SURUM).then(c => c.match(r, { ignoreSearch: true }).then(eski => {
      const yeni = fetch(r).then(cev => {
        if (cev && (cev.ok || cev.type === "opaque")) c.put(r, cev.clone());
        return cev;
      }).catch(() => eski);
      return eski || yeni;
    }))
  );
});
