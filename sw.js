/* ==========================================================
   Wortschatz-Trainer — Service Worker
   Legt beim ersten Laden alles ab, was die App zum Laufen braucht,
   und bedient sie danach auch ohne Netz.

   BUILD wird von bauen.ps1 aus dem Inhalt der Dateien gestempelt.
   Ändert sich eine Datei, ändert sich die Kennung, und der Browser
   installiert den Worker neu — sonst bliebe ein alter Stand ewig liegen.
   ========================================================== */

var BUILD = '53c8b1f1fa54';
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

  /* Alles aus GENAU DIESEM Bestand bedienen, auch Seitenaufrufe.
     Das ist der entscheidende Punkt: Solange ein neuer Worker nur wartet,
     bedient weiterhin der alte — und zwar vollständig. Holte man die Seite
     vom Netz und die Dateien aus dem Cache, bekäme man neues HTML mit altem
     JavaScript. Genau das ist passiert: das Feld war da, die Logik nicht.

     caches.match() ohne Cache-Angabe durchsucht ausserdem ALLE Bestände und
     kann aus einem veralteten antworten. Deshalb überall cache.match(). */
  ereignis.respondWith(
    caches.open(CACHE).then(function (cache) {

      if (anfrage.mode === 'navigate') {
        return cache.match('index.html').then(function (treffer) {
          if (treffer) return treffer;
          return cache.match('./').then(function (wurzel) {
            return wurzel || fetch(anfrage);
          });
        });
      }

      return cache.match(anfrage).then(function (treffer) {
        if (treffer) return treffer;

        return fetch(anfrage).then(function (antwort) {
          if (antwort && antwort.ok && antwort.type === 'basic') {
            cache.put(anfrage, antwort.clone());
          }
          return antwort;
        });
      });
    }).catch(function () {
      return fetch(anfrage);
    })
  );
});
