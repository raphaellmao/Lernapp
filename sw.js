/* ==========================================================
   Wortschatz-Trainer — Service Worker
   Legt beim ersten Laden alles ab, was die App zum Laufen braucht,
   und bedient sie danach auch ohne Netz.

   BUILD wird von bauen.ps1 aus dem Inhalt der Dateien gestempelt.
   Ändert sich eine Datei, ändert sich die Kennung, und der Browser
   installiert den Worker neu — sonst bliebe ein alter Stand ewig liegen.
   ========================================================== */

var BUILD = 'd032f82f2e73';
var CACHE = 'wortschatz-' + BUILD;

/* Ohne diese Dateien läuft die App nicht — schlägt eine fehl, wird nicht
   installiert, damit kein halber Offline-Stand entsteht. */
var PFLICHT = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'daten/pack01.js', 'daten/pack02.js', 'daten/pack03.js', 'daten/pack04.js',
  'daten/pack05.js', 'daten/pack06.js', 'daten/pack07.js', 'daten/pack08.js',
  'daten/pack09.js', 'daten/pack10.js', 'daten/pack11.js', 'daten/pack12.js',
  'daten/pack13.js'
];

/* Nett zu haben, aber kein Grund zum Abbruch. */
var KUER = [
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

function holenUndAblegen(cache, pfad) {
  /* reload umgeht den HTTP-Cache des Browsers: beim Installieren wollen wir
     den frischen Stand, nicht eine womöglich veraltete Kopie. */
  return fetch(new Request(pfad, { cache: 'reload' })).then(function (antwort) {
    if (!antwort || !antwort.ok) throw new Error('HTTP ' + (antwort && antwort.status) + ' für ' + pfad);
    return cache.put(pfad, antwort);
  });
}

self.addEventListener('install', function (ereignis) {
  ereignis.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var pflicht = Promise.all(PFLICHT.map(function (p) { return holenUndAblegen(cache, p); }));

      var kuer = Promise.all(KUER.map(function (p) {
        return holenUndAblegen(cache, p).catch(function (fehler) {
          console.warn('[sw] übersprungen:', p, fehler.message);
        });
      }));

      return pflicht.then(function () { return kuer; });
    })
  );
});

self.addEventListener('activate', function (ereignis) {
  ereignis.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.map(function (name) {
        /* Nur eigene Bestände aufräumen, fremde auf derselben Herkunft in Ruhe lassen. */
        if (name.indexOf('wortschatz-') === 0 && name !== CACHE) {
          return caches.delete(name);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (ereignis) {
  var anfrage = ereignis.request;

  if (anfrage.method !== 'GET') return;
  if (new URL(anfrage.url).origin !== self.location.origin) return;

  /* Seitenaufrufe: erst Netz versuchen, damit eine neue Fassung ankommt;
     ohne Netz die abgelegte Hülle ausliefern. */
  if (anfrage.mode === 'navigate') {
    ereignis.respondWith(
      fetch(anfrage).catch(function () {
        return caches.match(anfrage).then(function (treffer) {
          return treffer || caches.match('index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  /* Alles Übrige: aus dem Cache, sonst aus dem Netz und dabei ablegen.
     Der Cachename trägt die Build-Kennung, deshalb ist Cache-first hier sicher. */
  ereignis.respondWith(
    caches.match(anfrage).then(function (treffer) {
      if (treffer) return treffer;

      return fetch(anfrage).then(function (antwort) {
        if (antwort && antwort.ok && antwort.type === 'basic') {
          var kopie = antwort.clone();
          caches.open(CACHE).then(function (cache) { cache.put(anfrage, kopie); });
        }
        return antwort;
      });
    })
  );
});
