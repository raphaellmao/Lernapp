/* ==========================================================
   Wortschatz-Trainer — Anwendungslogik
   Lernstand liegt ausschliesslich im localStorage.
   ========================================================== */
(function () {
'use strict';

/* ---------------------------------------------------------
   1. Stammdaten
   --------------------------------------------------------- */

var KATEGORIEN = {
  alltag:  'Bildungssprache im Alltag',
  bildung: 'Bildungssprache',
  sprach:  'Sprache & Rhetorik',
  phil:    'Philosophie & Psychologie',
  recht:   'Recht & Verwaltung',
  wirt:    'Wirtschaft & Finanzen',
  pol:     'Politik & Geschichte',
  natur:   'Medizin & Naturwissenschaft',
  kunst:   'Kunst, Kultur & Religion'
};

var KAT_REIHE = ['alltag','bildung','sprach','phil','recht','wirt','pol','natur','kunst'];

/* Leitner: Wartezeit in Tagen, bis ein Wort im jeweiligen Fach wieder drankommt. */
var FACH_TAGE = { 1: 0, 2: 1, 3: 3, 4: 8, 5: 21 };
var FACH_MAX  = 5;
var TAG_MS    = 86400000;

var SPEICHER_SCHLUESSEL = 'wortschatz-trainer-v1';
var THEMA_SCHLUESSEL    = 'wortschatz-trainer-thema';

/* ---------------------------------------------------------
   2. Wortvorrat aufbereiten
   --------------------------------------------------------- */

var WOERTER = [];        /* bereinigte Liste */
var NACH_KAT = {};       /* Kategorie -> Wörter */
var NACH_ID  = {};       /* Nummer -> Wort */
var NACH_SLUG = {};      /* alter Schlüssel aus dem Wortlaut -> Nummer, nur zur Umstellung */
var DATEN_MAENGEL = [];  /* Wörter ohne oder mit doppelter Nummer */

/* Die Nummer steht fest in den Daten (erstes Feld je Zeile) und wird niemals
   aus der Position im Array abgeleitet. Umsortieren, Einfügen oder Löschen
   lässt die Nummern der übrigen Wörter unberührt — der Lernstand bleibt
   deshalb auch dann zugeordnet, wenn ein Stichwort später korrigiert wird. */
function datenAufbereiten() {
  var gesehen = {};
  var roh = window.WORTSCHATZ || [];

  for (var i = 0; i < roh.length; i++) {
    var e = roh[i];
    if (!e || !e.w || !e.d) continue;

    var nr = e.id;
    if (typeof nr !== 'number' || !isFinite(nr) || nr <= 0 || Math.floor(nr) !== nr) {
      DATEN_MAENGEL.push('„' + e.w + '“ hat keine gültige Nummer');
      continue;
    }

    var id = String(nr);
    if (gesehen[id]) {
      DATEN_MAENGEL.push('Nummer ' + id + ' ist doppelt vergeben („' + e.w + '“)');
      continue;
    }
    gesehen[id] = true;

    var kat = KATEGORIEN[e.k] ? e.k : 'bildung';
    var wort = {
      id: id,
      w: e.w,
      d: e.d,
      b: e.b || '',
      h: e.h || '',
      k: kat,
      katName: KATEGORIEN[kat]
    };

    WOERTER.push(wort);
    NACH_ID[id] = wort;
    NACH_SLUG[e.w.toLowerCase().replace(/\s+/g, ' ').trim()] = id;
    (NACH_KAT[kat] = NACH_KAT[kat] || []).push(wort);
  }

  WOERTER.sort(function (a, b) {
    return a.w.localeCompare(b.w, 'de');
  });
}

/* ---------------------------------------------------------
   3. Lernstand
   --------------------------------------------------------- */

var stand = null;

function leererStand() {
  return {
    version: 1,
    karten: {},                 /* id -> {fach, r, f, letzte, faellig} */
    tage: {},                   /* "JJJJ-MM-TT" -> [richtig, falsch] */
    besteSerie: 0,
    sitzungen: 0,
    hilfen: { tipp: 0, fuenfzig: 0, aufgeloest: 0 },   /* genutzte Joker insgesamt */
    laufendeSitzung: null,      /* unterbrochene Sitzung, zum Fortsetzen */
    bekannteKategorien: KAT_REIHE.slice(),   /* für später ergänzte Bereiche */
    einstellungen: {
      kategorien: KAT_REIHE.slice(),
      laenge: 20,
      modus: 'w2b',
      auswahl: 'klug'
    }
  };
}

var umstellungsBericht = null;   /* für den Hinweis nach der Umstellung */

/* Früher war der Schlüssel der kleingeschriebene Wortlaut. Diese Stände werden
   auf die festen Nummern übertragen. Nicht zuordenbare Einträge bleiben
   unangetastet stehen — es wird nichts verworfen. */
function kartenUmschluesseln(karten) {
  var neu = {}, umgestellt = 0, offen = 0;

  for (var k in karten) {
    if (!Object.prototype.hasOwnProperty.call(karten, k)) continue;
    var e = karten[k];
    if (!e || typeof e !== 'object') continue;

    if (/^\d+$/.test(k)) { neu[k] = e; continue; }   /* schon eine Nummer */

    var id = NACH_SLUG[k];
    if (!id) { neu[k] = e; offen++; continue; }      /* unbekannt: behalten */

    if (neu[id]) {
      /* Beide Formen vorhanden: zusammenführen statt eine zu überschreiben. */
      neu[id].r = (neu[id].r || 0) + (e.r || 0);
      neu[id].f = (neu[id].f || 0) + (e.f || 0);
      if ((e.letzte || 0) > (neu[id].letzte || 0)) {
        neu[id].fach    = e.fach;
        neu[id].letzte  = e.letzte;
        neu[id].faellig = e.faellig;
      }
    } else {
      neu[id] = e;
    }
    umgestellt++;
  }

  return { karten: neu, umgestellt: umgestellt, offen: offen };
}

function standLaden() {
  var s = leererStand();
  try {
    var roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (roh) {
      var geladen = JSON.parse(roh);
      if (geladen && typeof geladen === 'object') {
        var um = kartenUmschluesseln(geladen.karten || {});
        if (um.umgestellt) umstellungsBericht = um;
        s.karten     = um.karten;
        s.tage       = geladen.tage       || {};
        s.besteSerie = geladen.besteSerie || 0;
        s.sitzungen  = geladen.sitzungen  || 0;
        if (geladen.laufendeSitzung && typeof geladen.laufendeSitzung === 'object') {
          s.laufendeSitzung = geladen.laufendeSitzung;
        }
        if (geladen.hilfen && typeof geladen.hilfen === 'object') {
          s.hilfen.tipp       = geladen.hilfen.tipp       || 0;
          s.hilfen.fuenfzig   = geladen.hilfen.fuenfzig   || 0;
          s.hilfen.aufgeloest = geladen.hilfen.aufgeloest || 0;
        }
        var e = geladen.einstellungen || {};
        if (Array.isArray(e.kategorien) && e.kategorien.length) {
          s.einstellungen.kategorien = e.kategorien.filter(function (k) {
            return !!KATEGORIEN[k];
          });
          if (!s.einstellungen.kategorien.length) {
            s.einstellungen.kategorien = KAT_REIHE.slice();
          }
        }
        if (e.laenge !== undefined) s.einstellungen.laenge = +e.laenge;
        if (e.modus)   s.einstellungen.modus   = e.modus;
        if (e.auswahl) s.einstellungen.auswahl = e.auswahl;

        /* Bereiche, die es beim letzten Speichern noch nicht gab, werden
           mitgenommen — sonst bliebe eine Erweiterung unsichtbar. */
        var bekannt = Array.isArray(geladen.bekannteKategorien) ? geladen.bekannteKategorien : [];
        KAT_REIHE.forEach(function (k) {
          if (bekannt.indexOf(k) === -1 && s.einstellungen.kategorien.indexOf(k) === -1) {
            s.einstellungen.kategorien.push(k);
          }
        });
      }
    }
  } catch (err) {
    /* Beschädigter Stand: lieber leer weiterarbeiten als abstürzen. */
    console.warn('Lernstand nicht lesbar, starte leer.', err);
  }
  return s;
}

var speicherFehler = false;

function standSichern() {
  try {
    stand.bekannteKategorien = KAT_REIHE.slice();
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(stand));
    speicherFehler = false;
  } catch (err) {
    if (!speicherFehler) {
      speicherFehler = true;
      toast('Der Lernstand konnte nicht gespeichert werden. Läuft der Browser im privaten Modus?');
    }
  }
}

function karte(id) {
  return stand.karten[id] || null;
}

function heuteSchluessel(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, t = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
}

function kartenEintrag(wort) {
  var k = stand.karten[wort.id];
  if (!k) k = stand.karten[wort.id] = { fach: 1, r: 0, f: 0, letzte: 0, faellig: 0 };
  return k;
}

/* Aufgelöst, ohne zu antworten: zählt weder als Treffer noch als Fehler.
   Das Fach bleibt, das Wort bleibt fällig und kommt bald wieder. */
function aufloesungVerbuchen(wort) {
  var k = kartenEintrag(wort);
  var jetzt = Date.now();
  k.letzte  = jetzt;
  k.faellig = jetzt;
  return k.fach;
}

/* Verbucht eine Antwort und schiebt das Wort im Leitner-System.
   mitHilfe = true, wenn für diese Karte ein Joker gezogen wurde: dann rückt
   sie trotz richtiger Antwort nicht vor. Sonst entstünde ein Fach 5, das nie
   ohne Hilfe erreicht wurde, und die Wiederholung käme viel zu spät. */
function antwortVerbuchen(wort, richtig, mitHilfe) {
  var k = kartenEintrag(wort);

  var vorher = k.fach;

  if (richtig) {
    k.r++;
    if (!mitHilfe) k.fach = Math.min(FACH_MAX, k.fach + 1);
  } else {
    k.f++;
    k.fach = 1;
  }

  var jetzt = Date.now();
  k.letzte  = jetzt;
  k.faellig = jetzt + FACH_TAGE[k.fach] * TAG_MS;

  var tag = heuteSchluessel();
  if (!stand.tage[tag]) stand.tage[tag] = [0, 0];
  stand.tage[tag][richtig ? 0 : 1]++;

  return { vorher: vorher, nachher: k.fach, gehalten: richtig && mitHilfe };
}

/* ---------------------------------------------------------
   4. Kleine Helfer
   --------------------------------------------------------- */

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mischen(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function zufall(a) { return a[Math.floor(Math.random() * a.length)]; }

var toastTimer = null;
function toast(text) {
  var el = $('toast');
  el.textContent = text;
  el.classList.add('sichtbar');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove('sichtbar'); }, 3400);
}

/* Buchstaben einschließlich Akzentformen — für Détente, Attaché, Œuvre. */
var BUCHSTABEN = 'A-Za-zÄÖÜäöüßÀ-ÖØ-öø-ÿŒœ';

/* Markiert das Stichwort im Beispielsatz — auch in gebeugter Form.
   Der Stamm wird von hinten gekürzt, bis eine Form im Satz greift. */
function satzHervorheben(satz, wort) {
  var text = esc(satz);

  /* Mehrwortbegriffe zuerst als Ganzes versuchen: „Treu und Glauben“, „a priori“. */
  if (/\s/.test(wort)) {
    var ganz = esc(wort).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      var reGanz = new RegExp('(' + ganz + ')', 'i');
      if (reGanz.test(text)) return text.replace(reGanz, '<b>$1</b>');
    } catch (err) { /* dann eben über den Wortstamm */ }
  }

  var kern = wort.split(/[\s,(]/)[0].replace(new RegExp('[^' + BUCHSTABEN + '-]', 'g'), '');
  if (kern.length < 3) return text;

  var kuerzeste = Math.max(3, Math.ceil(kern.length * 0.6));

  for (var len = kern.length; len >= kuerzeste; len--) {
    var muster = kern.slice(0, len).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      var re = new RegExp('(' + muster + '[' + BUCHSTABEN + ']*)', 'i');
      if (re.test(text)) return text.replace(re, '<b>$1</b>');
    } catch (err) {
      return text;   /* Ausdruck nicht baubar: unmarkiert lassen */
    }
  }
  return text;
}

function prozent(r, f) {
  var g = r + f;
  return g ? Math.round(r / g * 100) : 0;
}

function kachel(zahl, label, akzent) {
  return '<div class="kachel' + (akzent ? ' kachel-akzent' : '') + '">' +
           '<div class="kachel-zahl">' + esc(zahl) + '</div>' +
           '<div class="kachel-label">' + esc(label) + '</div>' +
         '</div>';
}

/* ---------------------------------------------------------
   5. Kartenauswahl
   --------------------------------------------------------- */

function aktiveWoerter() {
  var aktiv = {};
  stand.einstellungen.kategorien.forEach(function (k) { aktiv[k] = true; });
  return WOERTER.filter(function (w) { return aktiv[w.k]; });
}

function standVon(w) {
  var k = karte(w.id);
  if (!k) return 'neu';
  if (k.f >= 2 && k.f > k.r) return 'schwach';
  if (k.fach >= 4) return 'sitzt';
  return 'lernen';
}

/* Stellt die Wortliste einer Sitzung zusammen. */
function sitzungBauen(anzahl, art) {
  var pool = aktiveWoerter();
  if (!pool.length) return [];

  var jetzt = Date.now();
  var neue = [], faellige = [], rest = [];

  pool.forEach(function (w) {
    var k = karte(w.id);
    if (!k) neue.push(w);
    else if (k.faellig <= jetzt) faellige.push(w);
    else rest.push(w);
  });

  var liste;

  if (art === 'neu') {
    liste = mischen(neue);
    if (!liste.length) return [];
  } else if (art === 'schwach') {
    liste = pool.filter(function (w) { return standVon(w) === 'schwach'; });
    liste.sort(function (a, b) {
      var ka = karte(a.id), kb = karte(b.id);
      return (kb.f - kb.r) - (ka.f - ka.r);
    });
    if (!liste.length) return [];
  } else if (art === 'alle') {
    liste = mischen(pool.slice());
  } else {
    /* klug: fällige zuerst, dazu ein Drittel frische Wörter */
    faellige.sort(function (a, b) {
      var ka = karte(a.id), kb = karte(b.id);
      return (ka.fach - kb.fach) || (ka.faellig - kb.faellig);
    });
    mischen(neue);

    var ziel     = anzahl > 0 ? anzahl : 40;
    var neuAnteil = Math.max(1, Math.round(ziel / 3));
    var ausNeu   = neue.slice(0, neuAnteil);
    var ausFaell = faellige.slice(0, ziel - ausNeu.length);

    /* Auffüllen, falls eine Seite nicht genug hergibt */
    if (ausFaell.length + ausNeu.length < ziel) {
      ausNeu = neue.slice(0, ziel - ausFaell.length);
    }
    if (ausFaell.length + ausNeu.length < ziel) {
      ausFaell = faellige.slice(0, ziel - ausNeu.length);
    }

    liste = mischen(ausNeu.concat(ausFaell));

    /* Immer noch zu wenig? Dann noch nicht fällige Wörter dazunehmen. */
    if (anzahl > 0 && liste.length < anzahl) {
      rest.sort(function (a, b) { return karte(a.id).faellig - karte(b.id).faellig; });
      liste = liste.concat(rest.slice(0, anzahl - liste.length));
    }
  }

  return anzahl > 0 ? liste.slice(0, anzahl) : liste;
}

/* Sucht drei plausible Falschantworten: gleicher Bereich, ähnliche Länge. */
function ablenker(wort, feld) {
  var gleiche = (NACH_KAT[wort.k] || []).filter(function (w) {
    return w.id !== wort.id && w[feld] !== wort[feld];
  });

  var kandidaten = gleiche.length >= 30 ? gleiche : WOERTER.filter(function (w) {
    return w.id !== wort.id && w[feld] !== wort[feld];
  });

  var ziel = wort[feld].length;
  var sortiert = kandidaten.slice().sort(function (a, b) {
    return Math.abs(a[feld].length - ziel) - Math.abs(b[feld].length - ziel);
  });

  /* Aus dem engeren Kreis ähnlich langer Einträge zufällig ziehen. */
  var kreis = mischen(sortiert.slice(0, Math.min(40, sortiert.length)));
  var raus = [], benutzt = {};
  benutzt[wort[feld]] = true;

  for (var i = 0; i < kreis.length && raus.length < 3; i++) {
    if (benutzt[kreis[i][feld]]) continue;
    benutzt[kreis[i][feld]] = true;
    raus.push(kreis[i]);
  }
  return raus;
}

/* ---------------------------------------------------------
   6. Sitzung
   --------------------------------------------------------- */

var sitzung = null;

function sitzungStarten() {
  var e = stand.einstellungen;
  var liste = sitzungBauen(e.laenge, e.auswahl);

  if (!liste.length) {
    var text = 'Für diese Auswahl gibt es gerade keine Wörter.';
    if (e.auswahl === 'neu')     text = 'Alle Wörter der gewählten Bereiche sind schon einmal drangekommen.';
    if (e.auswahl === 'schwach') text = 'Keine Schwachstellen vorhanden — es gibt noch kein Wort mit mehr Fehlern als Treffern.';
    if (!stand.einstellungen.kategorien.length) text = 'Es ist kein Bereich ausgewählt. Das lässt sich in den Einstellungen ändern.';
    $('startHinweis').textContent = text;
    return;
  }

  sitzung = {
    liste: liste,
    pos: 0,
    richtig: 0,
    falsch: 0,
    serie: 0,
    besteSerie: 0,
    fehler: [],
    beantwortet: false,
    aktuell: null,
    hilfe: jokerVorrat(liste.length),
    tippGezeigt: false,      /* Joker bei DIESER Karte schon gezogen? */
    fuenfzigGenutzt: false,
    karteHilfe: false,       /* wurde bei dieser Karte überhaupt geholfen? */
    raus: [],                /* bei 50:50 entfernte Antwortplätze */
    tippText: null
  };

  stand.sitzungen++;
  laufendeSitzungLoeschen();
  standSichern();

  $('start').classList.add('versteckt');
  $('endePanel').classList.add('versteckt');
  $('kartePanel').classList.remove('versteckt');
  $('startHinweis').textContent = '';

  karteZeigen();
}

/* wieder = gespeicherter Kartenstand einer unterbrochenen Sitzung. Dann werden
   dieselben Antwortmöglichkeiten und bereits gezogene Joker wiederhergestellt,
   statt die Karte neu zu ziehen — sonst wäre ein bezahlter Joker verfallen. */
function karteZeigen(wieder) {
  var wort = sitzung.liste[sitzung.pos];
  var e = stand.einstellungen;
  var modus, feld, optionen;

  if (wieder) {
    modus    = wieder.modus === 'b2w' ? 'b2w' : 'w2b';
    feld     = modus === 'b2w' ? 'w' : 'd';
    optionen = wieder.optionen.map(function (id) { return NACH_ID[id]; });
  } else {
    modus    = e.modus === 'mix' ? (Math.random() < 0.5 ? 'w2b' : 'b2w') : e.modus;
    feld     = modus === 'b2w' ? 'w' : 'd';   /* Feld, aus dem die Antworten kommen */
    optionen = mischen(ablenker(wort, feld).concat([wort]));
  }

  sitzung.aktuell = { wort: wort, modus: modus, feld: feld, optionen: optionen };
  sitzung.beantwortet     = false;
  sitzung.tippGezeigt     = false;
  sitzung.fuenfzigGenutzt = false;
  sitzung.karteHilfe      = false;
  sitzung.raus            = [];
  sitzung.tippText        = null;
  $('tippFeld').classList.add('versteckt');

  /* Kopfzeile */
  var gesamt = sitzung.liste.length;
  $('fortschrittText').textContent = 'Karte ' + (sitzung.pos + 1) + ' von ' + gesamt;
  $('fortschrittFuell').style.width = (sitzung.pos / gesamt * 100) + '%';
  $('serieText').textContent = sitzung.serie >= 3 ? sitzung.serie + " in Folge" : '';

  $('chipKategorie').textContent = wort.katName;
  var k = karte(wort.id);
  $('chipFach').textContent = k ? 'Fach ' + k.fach : 'neues Wort';

  /* Frage */
  var frageEl = $('frage');
  if (modus === 'b2w') {
    frageEl.textContent = wort.d;
    frageEl.classList.add('frage-lang');
    $('frageZusatz').textContent = 'Welches Wort ist gemeint?';
  } else {
    frageEl.textContent = wort.w;
    frageEl.classList.remove('frage-lang');
    $('frageZusatz').textContent = 'Was bedeutet das?';
  }

  /* Antworten */
  var box = $('antworten');
  box.innerHTML = '';
  optionen.forEach(function (opt, i) {
    var b = document.createElement('button');
    b.className = 'antwort';
    b.dataset.nr = i;
    b.innerHTML = '<span class="antwort-nr">' + (i + 1) + '</span><span>' + esc(opt[feld]) + '</span>';
    b.addEventListener('click', function () { antworten(i); });
    box.appendChild(b);
  });

  $('aufloesung').classList.add('versteckt');

  /* Gezogene Joker der unterbrochenen Karte wieder sichtbar machen */
  if (wieder) {
    if (wieder.tipp) {
      sitzung.tippText    = wieder.tipp;
      sitzung.tippGezeigt = true;
      $('tippText').textContent = wieder.tipp;
      $('tippFeld').classList.remove('versteckt');
    }
    if (Array.isArray(wieder.raus) && wieder.raus.length) {
      sitzung.raus            = wieder.raus.slice();
      sitzung.fuenfzigGenutzt = true;
      var knoepfe = box.querySelectorAll('.antwort');
      wieder.raus.forEach(function (i) {
        if (knoepfe[i]) { knoepfe[i].disabled = true; knoepfe[i].classList.add('raus'); }
      });
    }
    sitzung.karteHilfe = !!wieder.hilfeGenutzt;
  }

  jokerAnzeigen();
  sitzungSichern();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function antworten(nr) {
  if (sitzung.beantwortet) return;
  sitzung.beantwortet = true;

  var a = sitzung.aktuell;
  var wort = a.wort;
  var gewaehlt = a.optionen[nr];
  var richtig = gewaehlt.id === wort.id;

  var schub = antwortVerbuchen(wort, richtig, sitzung.karteHilfe);

  if (richtig) {
    sitzung.richtig++;
    sitzung.serie++;
    if (sitzung.serie > sitzung.besteSerie) sitzung.besteSerie = sitzung.serie;
    if (sitzung.serie > stand.besteSerie) stand.besteSerie = sitzung.serie;
  } else {
    sitzung.falsch++;
    sitzung.serie = 0;
    sitzung.fehler.push({ wort: wort, gewaehlt: gewaehlt });
  }
  standSichern();

  /* Antwortknöpfe einfärben */
  var knoepfe = $('antworten').querySelectorAll('.antwort');
  for (var i = 0; i < knoepfe.length; i++) {
    knoepfe[i].disabled = true;
    var opt = a.optionen[i];
    if (opt.id === wort.id) knoepfe[i].classList.add('gut');
    else if (i === nr)      knoepfe[i].classList.add('schlecht');
    else                    knoepfe[i].classList.add('blass');
  }

  $('chipFach').textContent = schub.gehalten
    ? 'Fach ' + schub.nachher + ' — mit Joker, bleibt stehen'
    : 'Fach ' + schub.vorher + ' → ' + schub.nachher;
  $('serieText').textContent = sitzung.serie >= 3 ? sitzung.serie + ' in Folge' : '';

  aufloesungFuellen(wort);
}

/* Füllt den Auflösungsbereich und zeigt ihn an. */
function aufloesungFuellen(wort) {
  $('aflWort').textContent = wort.w;
  $('aflBedeutung').textContent = wort.d;

  if (wort.b) {
    $('aflSatz').innerHTML = satzHervorheben(wort.b, wort.w);
    $('aflSatz').parentNode.classList.remove('versteckt');
  } else {
    $('aflSatz').parentNode.classList.add('versteckt');
  }

  if (wort.h) {
    $('aflHerkunft').textContent = wort.h;
    $('aflHerkunftBlock').classList.remove('versteckt');
  } else {
    $('aflHerkunftBlock').classList.add('versteckt');
  }

  $('aufloesung').classList.remove('versteckt');
  jokerAnzeigen();
  sitzungSichern();
  $('btnWeiter').focus({ preventScroll: true });
  $('aufloesung').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------------------------------------------------------
   6a. Unterbrochene Sitzung
   --------------------------------------------------------- */

/* Nach jedem Schritt wird der Stand der laufenden Sitzung mitgeschrieben.
   Gespeichert werden nur Wortnummern, nie die Wörter selbst — so bleibt der
   Eintrag klein und übersteht auch eine Änderung am Wortbestand. */
function sitzungSichern() {
  if (!sitzung) return;
  var a = sitzung.aktuell;

  stand.laufendeSitzung = {
    ids:        sitzung.liste.map(function (w) { return w.id; }),
    pos:        sitzung.pos,
    richtig:    sitzung.richtig,
    falsch:     sitzung.falsch,
    serie:      sitzung.serie,
    besteSerie: sitzung.besteSerie,
    fehler:     sitzung.fehler.map(function (f) { return [f.wort.id, f.gewaehlt.id]; }),
    hilfe:      sitzung.hilfe,
    erledigt:   sitzung.beantwortet,
    karte: a ? {
      modus:       a.modus,
      optionen:    a.optionen.map(function (o) { return o.id; }),
      tipp:        sitzung.tippText || null,
      raus:        sitzung.raus.slice(),
      hilfeGenutzt: sitzung.karteHilfe
    } : null,
    zeit: Date.now()
  };
  standSichern();
}

function laufendeSitzungLoeschen() {
  if (!stand.laufendeSitzung) return;
  stand.laufendeSitzung = null;
  standSichern();
}

/* Liefert den gespeicherten Stand nur, wenn er noch brauchbar ist. pos zeigt
   danach immer auf die Karte, die als nächste dran wäre. */
function gespeicherteSitzung() {
  var g = stand.laufendeSitzung;
  if (!g || !Array.isArray(g.ids) || !g.ids.length) return null;

  for (var i = 0; i < g.ids.length; i++) {
    if (!NACH_ID[g.ids[i]]) return null;   /* Wort gibt es nicht mehr */
  }

  /* War die Karte schon beantwortet, ist die Antwort längst verbucht —
     fortgesetzt wird dann bei der nächsten, sonst zählte sie doppelt. */
  var pos = g.erledigt ? g.pos + 1 : g.pos;
  if (pos < 0 || pos >= g.ids.length) return null;   /* nichts mehr offen */

  var karte = null;
  if (!g.erledigt && g.karte && Array.isArray(g.karte.optionen) &&
      g.karte.optionen.every(function (id) { return !!NACH_ID[id]; })) {
    karte = g.karte;
  }

  return {
    ids: g.ids, pos: pos,
    richtig: g.richtig || 0, falsch: g.falsch || 0,
    serie: g.serie || 0, besteSerie: g.besteSerie || 0,
    fehler: Array.isArray(g.fehler) ? g.fehler : [],
    hilfe: g.hilfe || jokerVorrat(g.ids.length),
    karte: karte, zeit: g.zeit || 0
  };
}

function vorWieLange(zeit) {
  if (!zeit) return '';
  var s = Math.max(0, Math.round((Date.now() - zeit) / 1000));
  if (s < 90) return 'gerade eben';
  var m = Math.round(s / 60);
  if (m < 60) return 'vor ' + m + ' Minuten';
  var h = Math.round(m / 60);
  if (h < 24) return 'vor ' + h + (h === 1 ? ' Stunde' : ' Stunden');
  var d = Math.round(h / 24);
  return 'vor ' + d + (d === 1 ? ' Tag' : ' Tagen');
}

function fortsetzenAnbieten() {
  var box = $('fortsetzen');
  var g = gespeicherteSitzung();
  if (!g) { box.classList.add('versteckt'); return; }

  var teile = ['Karte ' + (g.pos + 1) + ' von ' + g.ids.length];
  if (g.richtig + g.falsch) teile.push(g.richtig + ' richtig, ' + g.falsch + ' daneben');
  var wann = vorWieLange(g.zeit);
  if (wann) teile.push(wann);

  $('fortsetzenInfo').textContent = teile.join(' · ');
  box.classList.remove('versteckt');
}

function sitzungFortsetzen() {
  var g = gespeicherteSitzung();
  if (!g) { fortsetzenAnbieten(); return; }

  sitzung = {
    liste:      g.ids.map(function (id) { return NACH_ID[id]; }),
    pos:        g.pos,
    richtig:    g.richtig,
    falsch:     g.falsch,
    serie:      g.serie,
    besteSerie: g.besteSerie,
    fehler: g.fehler.map(function (f) {
      return { wort: NACH_ID[f[0]], gewaehlt: NACH_ID[f[1]] };
    }).filter(function (f) { return f.wort && f.gewaehlt; }),
    beantwortet: false,
    aktuell: null,
    hilfe: g.hilfe,
    tippGezeigt: false, fuenfzigGenutzt: false, karteHilfe: false,
    raus: [], tippText: null
  };

  /* stand.sitzungen wird hier bewusst nicht erhöht — die Sitzung lief schon. */
  $('start').classList.add('versteckt');
  $('endePanel').classList.add('versteckt');
  $('kartePanel').classList.remove('versteckt');
  $('startHinweis').textContent = '';

  karteZeigen(g.karte);
}

function sitzungVerwerfen() {
  laufendeSitzungLoeschen();
  fortsetzenAnbieten();
  toast('Unterbrochene Sitzung verworfen. Die bereits beantworteten Wörter bleiben verbucht.');
}

/* ---------------------------------------------------------
   6b. Joker
   --------------------------------------------------------- */

/* Vorrat je Sitzung, bemessen an der tatsächlichen Kartenzahl: etwa ein Tipp
   je fünf und ein 50:50 je sieben Karten, mindestens aber zwei davon.
   Großzügig genug, um nicht zu nerven, knapp genug, dass man ihn sich einteilt.
   Bei „ohne Ende“ umfasst die Liste den ganzen Vorrat, das Verhältnis bleibt
   dadurch dasselbe. */
function jokerVorrat(anzahl) {
  return {
    tippFrei:     Math.max(2, Math.round(anzahl / 5)),
    fuenfzigFrei: Math.max(2, Math.round(anzahl / 7)),
    tipp: 0, fuenfzig: 0, aufgeloest: 0
  };
}

function jokerAnzeigen() {
  if (!sitzung) return;
  var h = sitzung.hilfe;
  var offen = !sitzung.beantwortet;

  $('tippZahl').textContent     = h.tippFrei;
  $('fuenfzigZahl').textContent = h.fuenfzigFrei;

  $('btnTipp').disabled      = !offen || h.tippFrei <= 0 || sitzung.tippGezeigt;
  $('btn5050').disabled      = !offen || h.fuenfzigFrei <= 0 || sitzung.fuenfzigGenutzt;
  $('btnAufloesen').disabled = !offen;
}

/* Tipp: bei „Wort → Bedeutung“ hilft die Herkunft am meisten. Umgekehrt
   verriete sie das gesuchte Wort oft direkt — dort gibt es stattdessen die
   Form: Anfangsbuchstabe und Länge. */
function jokerTipp() {
  if (!sitzung || sitzung.beantwortet || sitzung.tippGezeigt) return;
  if (sitzung.hilfe.tippFrei <= 0) return;

  var a = sitzung.aktuell, wort = a.wort, text;

  if (a.modus === 'b2w') {
    var kern = wort.w.replace(new RegExp('[^' + BUCHSTABEN + ']', 'g'), '');
    text = 'Beginnt mit „' + wort.w.charAt(0) + '“ und hat ' +
           kern.length + ' Buchstaben.';
  } else if (wort.h) {
    text = 'Herkunft: ' + wort.h;
  } else {
    /* Sollte nicht vorkommen — dann aber auch keinen Joker verbrauchen. */
    toast('Für dieses Wort ist kein Tipp hinterlegt.');
    return;
  }

  $('tippText').textContent = text;
  $('tippFeld').classList.remove('versteckt');

  sitzung.tippText    = text;
  sitzung.tippGezeigt = true;
  sitzung.karteHilfe  = true;
  sitzung.hilfe.tippFrei--;
  sitzung.hilfe.tipp++;
  stand.hilfen.tipp++;
  jokerAnzeigen();
  sitzungSichern();
}

/* 50:50 — zwei falsche Antworten fallen weg. */
function joker5050() {
  if (!sitzung || sitzung.beantwortet || sitzung.fuenfzigGenutzt) return;
  if (sitzung.hilfe.fuenfzigFrei <= 0) return;

  var a = sitzung.aktuell;
  var falsche = [];
  a.optionen.forEach(function (opt, i) {
    if (opt.id !== a.wort.id) falsche.push(i);
  });

  var weg = mischen(falsche).slice(0, 2);
  var knoepfe = $('antworten').querySelectorAll('.antwort');
  weg.forEach(function (i) {
    knoepfe[i].disabled = true;
    knoepfe[i].classList.add('raus');
  });

  sitzung.raus            = weg.slice();
  sitzung.fuenfzigGenutzt = true;
  sitzung.karteHilfe      = true;
  sitzung.hilfe.fuenfzigFrei--;
  sitzung.hilfe.fuenfzig++;
  stand.hilfen.fuenfzig++;
  jokerAnzeigen();
  sitzungSichern();
}

/* Aufgeben: zeigt die Lösung, ohne als Fehler zu zählen. Das Wort bleibt
   fällig und kommt wieder — die Trefferquote bleibt davon unberührt. */
function jokerAufloesen() {
  if (!sitzung || sitzung.beantwortet) return;
  sitzung.beantwortet = true;

  var a = sitzung.aktuell, wort = a.wort;
  var fach = aufloesungVerbuchen(wort);

  sitzung.hilfe.aufgeloest++;
  stand.hilfen.aufgeloest++;
  sitzung.serie = 0;
  standSichern();

  var knoepfe = $('antworten').querySelectorAll('.antwort');
  for (var i = 0; i < knoepfe.length; i++) {
    knoepfe[i].disabled = true;
    knoepfe[i].classList.remove('raus');
    knoepfe[i].classList.add(a.optionen[i].id === wort.id ? 'gut' : 'blass');
  }

  $('chipFach').textContent = 'Fach ' + fach + ' — aufgelöst, bleibt fällig';
  $('serieText').textContent = '';
  aufloesungFuellen(wort);
}

function weiter() {
  if (!sitzung || !sitzung.beantwortet) return;
  sitzung.pos++;
  if (sitzung.pos >= sitzung.liste.length) sitzungBeenden();
  else karteZeigen();
}

function sitzungBeenden() {
  $('kartePanel').classList.add('versteckt');
  $('endePanel').classList.remove('versteckt');

  var q = prozent(sitzung.richtig, sitzung.falsch);
  $('endeQuote').textContent = q + ' %';

  $('endeZahlen').innerHTML =
    kachel(sitzung.richtig, 'richtig') +
    kachel(sitzung.falsch, 'daneben') +
    kachel(sitzung.besteSerie, 'längste Serie', true);

  var h = sitzung.hilfe;
  var hilfsText = [];
  if (h.tipp)       hilfsText.push(h.tipp + '× Tipp');
  if (h.fuenfzig)   hilfsText.push(h.fuenfzig + '× 50:50');
  if (h.aufgeloest) hilfsText.push(h.aufgeloest + '× aufgelöst');
  var hilfeEl = $('endeHilfe');
  if (hilfsText.length) {
    hilfeEl.textContent = 'Joker: ' + hilfsText.join(' · ') +
      ' — mit Joker gelöste Wörter sind nicht vorgerückt.';
    hilfeEl.classList.remove('versteckt');
  } else {
    hilfeEl.textContent = 'Ohne Joker gelöst.';
    hilfeEl.classList.remove('versteckt');
  }

  if (sitzung.fehler.length) {
    $('endeListe').innerHTML = sitzung.fehler.map(function (f) {
      return '<div class="ende-zeile"><b>' + esc(f.wort.w) + '</b> — <span>' + esc(f.wort.d) + '</span></div>';
    }).join('');
    $('endeListeHuelle').classList.remove('versteckt');
  } else {
    $('endeListeHuelle').classList.add('versteckt');
  }

  laufendeSitzungLoeschen();
  standSichern();
  startAufbauen();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function zurStartansicht() {
  sitzung = null;
  laufendeSitzungLoeschen();
  $('kartePanel').classList.add('versteckt');
  $('endePanel').classList.add('versteckt');
  $('start').classList.remove('versteckt');
  startAufbauen();
}

/* ---------------------------------------------------------
   7. Ansicht: Start
   --------------------------------------------------------- */

function startAufbauen() {
  var pool = aktiveWoerter();
  var jetzt = Date.now();
  var neu = 0, faellig = 0, sitzt = 0;

  pool.forEach(function (w) {
    var k = karte(w.id);
    if (!k) neu++;
    else {
      if (k.faellig <= jetzt) faellig++;
      if (k.fach >= 4) sitzt++;
    }
  });

  var beruehrt = pool.length - neu;

  $('startUnter').textContent =
    pool.length + ' Wörter in ' + stand.einstellungen.kategorien.length + ' von ' +
    KAT_REIHE.length + ' Bereichen · ' + beruehrt + ' davon schon einmal abgefragt';

  $('startKacheln').innerHTML =
    kachel(faellig, faellig === 1 ? 'Wort ist fällig' : 'Wörter fällig', true) +
    kachel(neu, 'noch nie gesehen') +
    kachel(sitzt, 'sitzen (Fach 4–5)') +
    kachel(stand.besteSerie, 'beste Serie');

  fortsetzenAnbieten();

  var hinweis = '';
  if (!pool.length) hinweis = 'Kein Bereich ausgewählt — bitte in den Einstellungen mindestens einen anhaken.';
  else if (!faellig && !neu) hinweis = 'Alles wiederholt. Die nächsten Wörter werden erst später wieder fällig — „Alles gemischt“ geht trotzdem jederzeit.';
  $('startHinweis').textContent = hinweis;
}

/* ---------------------------------------------------------
   8. Ansicht: Lexikon
   --------------------------------------------------------- */

var lexGrenze = 100;
var lexOffen = {};

function lexAufbauen(zuruecksetzen) {
  if (zuruecksetzen) lexGrenze = 100;

  var suche = $('lexSuche').value.trim().toLowerCase();
  var kat   = $('lexKategorie').value;
  var st    = $('lexStand').value;

  var treffer = WOERTER.filter(function (w) {
    if (kat && w.k !== kat) return false;
    if (st && standVon(w) !== st) return false;
    if (suche) {
      var heu = (w.w + ' ' + w.d + ' ' + w.b + ' ' + w.h).toLowerCase();
      if (heu.indexOf(suche) === -1) return false;
    }
    return true;
  });

  $('lexZaehler').textContent = treffer.length === WOERTER.length
    ? WOERTER.length + ' Wörter im Vorrat'
    : treffer.length + ' von ' + WOERTER.length + ' Wörtern';

  var zeigen = treffer.slice(0, lexGrenze);
  var liste = $('lexListe');

  if (!zeigen.length) {
    liste.innerHTML = '<div class="lex-leer">Kein Wort passt zu dieser Suche.</div>';
    $('lexMehr').classList.add('versteckt');
    return;
  }

  liste.innerHTML = zeigen.map(function (w) {
    var offen = !!lexOffen[w.id];
    var s = '<div class="lex-eintrag">' +
      '<button class="lex-kopfzeile" data-id="' + esc(w.id) + '">' +
        '<span class="lex-punkt" data-stand="' + standVon(w) + '"></span>' +
        '<span class="lex-wort">' + esc(w.w) + '</span>' +
        '<span class="lex-kurz">' + esc(w.d) + '</span>' +
      '</button>';

    if (offen) {
      var k = karte(w.id);
      s += '<div class="lex-koerper">' +
             '<div class="lex-zeile"><span class="lex-marke">Bedeutung</span>' + esc(w.d) + '</div>' +
             (w.b ? '<div class="lex-zeile lex-beispiel">' + satzHervorheben(w.b, w.w) + '</div>' : '') +
             (w.h ? '<div class="lex-zeile"><span class="lex-marke">Herkunft</span>' + esc(w.h) + '</div>' : '') +
             '<div class="lex-stand">' + esc(w.katName) + ' · ' +
               (k ? 'Fach ' + k.fach + ' · ' + k.r + ' richtig, ' + k.f + ' falsch'
                  : 'noch nicht abgefragt') +
             '</div>' +
           '</div>';
    }
    return s + '</div>';
  }).join('');

  var mehr = $('lexMehr');
  if (treffer.length > lexGrenze) {
    mehr.classList.remove('versteckt');
    mehr.textContent = 'Weitere ' + Math.min(100, treffer.length - lexGrenze) + ' anzeigen';
  } else {
    mehr.classList.add('versteckt');
  }
}

/* ---------------------------------------------------------
   9. Ansicht: Statistik
   --------------------------------------------------------- */

function statistikAufbauen() {
  var gesR = 0, gesF = 0;
  var faecher = [0, 0, 0, 0, 0];
  var beruehrt = 0;

  WOERTER.forEach(function (w) {
    var k = karte(w.id);
    if (!k) return;
    beruehrt++;
    gesR += k.r;
    gesF += k.f;
    faecher[k.fach - 1]++;
  });

  $('statKacheln').innerHTML =
    kachel(prozent(gesR, gesF) + ' %', 'Trefferquote', true) +
    kachel(gesR + gesF, 'Antworten insgesamt') +
    kachel(beruehrt + ' / ' + WOERTER.length, 'Wörter angefasst') +
    kachel(stand.besteSerie, 'beste Serie') +
    kachel(stand.sitzungen, 'Sitzungen') +
    kachel(stand.hilfen.tipp + stand.hilfen.fuenfzig + stand.hilfen.aufgeloest, 'Joker genutzt');

  /* Leitner-Fächer */
  var namen = ['Fach 1 · täglich', 'Fach 2 · nach 1 Tag', 'Fach 3 · nach 3 Tagen',
               'Fach 4 · nach 8 Tagen', 'Fach 5 · nach 21 Tagen'];
  var maxF = Math.max.apply(null, faecher.concat([1]));

  $('faecher').innerHTML = faecher.map(function (n, i) {
    return '<div class="fach-zeile">' +
             '<span class="fach-name">' + namen[i] + '</span>' +
             '<span class="fach-balken"><span class="fach-fuell" style="width:' + (n / maxF * 100) + '%"></span></span>' +
             '<span class="fach-zahl">' + n + '</span>' +
           '</div>';
  }).join('');

  /* Verlauf der letzten 14 Tage */
  var tage = [], maxTag = 1;
  for (var i = 13; i >= 0; i--) {
    var d = new Date(Date.now() - i * TAG_MS);
    var s = heuteSchluessel(d);
    var e = stand.tage[s] || [0, 0];
    maxTag = Math.max(maxTag, e[0] + e[1]);
    tage.push({ datum: d, r: e[0], f: e[1] });
  }

  $('verlauf').innerHTML = tage.map(function (t) {
    var summe = t.r + t.f;
    var hoehe = summe / maxTag * 100;
    var inhalt = summe
      ? '<span class="tag-teil-schlecht" style="height:' + (t.f / summe * 100) + '%"></span>' +
        '<span class="tag-teil-gut" style="height:' + (t.r / summe * 100) + '%"></span>'
      : '<span class="tag-leer"></span>';
    return '<div class="tag-saeule" title="' + heuteSchluessel(t.datum) + ': ' + t.r + ' richtig, ' + t.f + ' falsch">' +
             '<div class="tag-stapel" style="height:' + (summe ? hoehe : 0) + '%">' + inhalt + '</div>' +
             '<span class="tag-label">' + t.datum.getDate() + '.</span>' +
           '</div>';
  }).join('');

  /* Bereiche */
  $('bereiche').innerHTML = KAT_REIHE.map(function (k) {
    var liste = NACH_KAT[k] || [];
    var sitzt = 0;
    liste.forEach(function (w) {
      var kk = karte(w.id);
      if (kk && kk.fach >= 4) sitzt++;
    });
    var anteil = liste.length ? sitzt / liste.length * 100 : 0;
    return '<div class="fach-zeile">' +
             '<span class="fach-name">' + esc(KATEGORIEN[k]) + '</span>' +
             '<span class="fach-balken"><span class="fach-fuell" style="width:' + anteil + '%"></span></span>' +
             '<span class="fach-zahl">' + sitzt + '/' + liste.length + '</span>' +
           '</div>';
  }).join('');

  /* Hartnäckige Wörter */
  var wackel = WOERTER.filter(function (w) {
    var k = karte(w.id);
    return k && k.f > 0;
  }).sort(function (a, b) {
    var ka = karte(a.id), kb = karte(b.id);
    return (kb.f - kb.r) - (ka.f - ka.r) || kb.f - ka.f;
  }).slice(0, 15);

  $('wackelListe').innerHTML = wackel.length
    ? wackel.map(function (w) {
        var k = karte(w.id);
        return '<div class="wackel-zeile">' +
                 '<span class="wackel-wort">' + esc(w.w) + '</span>' +
                 '<span class="wackel-bed">' + esc(w.d) + '</span>' +
                 '<span class="wackel-zahl">' + k.f + '× falsch</span>' +
               '</div>';
      }).join('')
    : '<div class="leer-hinweis">Noch keine Fehler verbucht.</div>';
}

/* ---------------------------------------------------------
   10. Ansicht: Einstellungen
   --------------------------------------------------------- */

function einstellungenAufbauen() {
  var aktiv = {};
  stand.einstellungen.kategorien.forEach(function (k) { aktiv[k] = true; });

  $('katListe').innerHTML = KAT_REIHE.map(function (k) {
    var n = (NACH_KAT[k] || []).length;
    return '<label class="kat-zeile">' +
             '<input type="checkbox" data-kat="' + k + '"' + (aktiv[k] ? ' checked' : '') + '>' +
             '<span class="kat-zeile-text">' + esc(KATEGORIEN[k]) + '</span>' +
             '<span class="kat-zeile-zahl">' + n + '</span>' +
           '</label>';
  }).join('');

  $('infoAnzahl').textContent = WOERTER.length;
  $('infoBereiche').textContent = KAT_REIHE.length;

  if (DATEN_MAENGEL.length) {
    $('infoNummern').textContent = DATEN_MAENGEL.length + ' fehlerhaft';
  } else if (WOERTER.length) {
    var kleinste = Infinity, groesste = 0;
    WOERTER.forEach(function (w) {
      var n = +w.id;
      if (n < kleinste) kleinste = n;
      if (n > groesste) groesste = n;
    });
    $('infoNummern').textContent = kleinste + '–' + groesste + ', eindeutig';
  } else {
    $('infoNummern').textContent = '—';
  }

  var bytes = 0;
  try { bytes = (localStorage.getItem(SPEICHER_SCHLUESSEL) || '').length; } catch (e) {}
  $('infoSpeicher').textContent = bytes ? (bytes / 1024).toFixed(1) + ' KB' : 'noch leer';

  $('infoOffline').textContent = offlineZustand;
}

function kategorienUebernehmen() {
  var gewaehlt = [];
  var kaesten = $('katListe').querySelectorAll('input[data-kat]');
  for (var i = 0; i < kaesten.length; i++) {
    if (kaesten[i].checked) gewaehlt.push(kaesten[i].dataset.kat);
  }
  stand.einstellungen.kategorien = gewaehlt;
  standSichern();
  startAufbauen();
}

/* ---------------------------------------------------------
   11. Sichern / Einspielen
   --------------------------------------------------------- */

function exportieren() {
  var paket = {
    typ: 'wortschatz-trainer-lernstand',
    version: 1,
    erstellt: new Date().toISOString(),
    stand: stand
  };
  var blob = new Blob([JSON.stringify(paket, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'wortschatz-lernstand-' + heuteSchluessel() + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  $('sicherungHinweis').textContent = 'Datei erzeugt. Sie enthält Fächer, Trefferquoten und den Verlauf.';
}

function einspielen(datei) {
  var leser = new FileReader();
  leser.onload = function () {
    var paket;
    try {
      paket = JSON.parse(leser.result);
    } catch (e) {
      $('sicherungHinweis').textContent = 'Die Datei ist kein lesbares JSON — nichts geändert.';
      return;
    }

    var neu = paket && paket.stand ? paket.stand : paket;
    if (!neu || typeof neu !== 'object' || !neu.karten) {
      $('sicherungHinweis').textContent = 'Kein Lernstand in der Datei gefunden — nichts geändert.';
      return;
    }

    var anzahl = Object.keys(neu.karten).length;
    var jetzige = Object.keys(stand.karten).length;
    if (jetzige > 0 && !confirm(
        'Der eingespielte Stand ersetzt den jetzigen vollständig.\n\n' +
        'Jetzt gespeichert: ' + jetzige + ' Wörter\nIn der Datei: ' + anzahl + ' Wörter\n\nFortfahren?')) {
      $('sicherungHinweis').textContent = 'Abgebrochen — der bisherige Lernstand bleibt.';
      return;
    }

    var frisch = leererStand();
    var umImport      = kartenUmschluesseln(neu.karten || {});
    frisch.karten     = umImport.karten;
    frisch.tage       = neu.tage       || {};
    frisch.besteSerie = neu.besteSerie || 0;
    frisch.sitzungen  = neu.sitzungen  || 0;
    if (neu.einstellungen) {
      var e = neu.einstellungen;
      if (Array.isArray(e.kategorien) && e.kategorien.length) {
        var gefiltert = e.kategorien.filter(function (k) { return !!KATEGORIEN[k]; });
        if (gefiltert.length) frisch.einstellungen.kategorien = gefiltert;
      }
      if (e.laenge !== undefined) frisch.einstellungen.laenge = +e.laenge;
      if (e.modus)   frisch.einstellungen.modus   = e.modus;
      if (e.auswahl) frisch.einstellungen.auswahl = e.auswahl;
    }

    stand = frisch;
    standSichern();
    einstellungenAnzeigen();
    einstellungenAufbauen();
    startAufbauen();
    $('sicherungHinweis').textContent = anzahl + ' Wörter eingespielt.' +
      (umImport.umgestellt ? ' Davon ' + umImport.umgestellt + ' aus einer älteren Sicherung auf feste Nummern übertragen.' : '');
    toast('Lernstand eingespielt.');
  };
  leser.readAsText(datei);
}

var resetScharf = false;
var resetTimer = null;

function resetKlick() {
  var btn = $('btnReset');
  if (!resetScharf) {
    resetScharf = true;
    btn.textContent = 'Wirklich? Nochmal klicken zum Löschen';
    resetTimer = setTimeout(function () {
      resetScharf = false;
      btn.textContent = 'Lernstand löschen';
    }, 6000);
    return;
  }

  clearTimeout(resetTimer);
  resetScharf = false;
  btn.textContent = 'Lernstand löschen';

  stand = leererStand();
  standSichern();
  sitzung = null;
  zurStartansicht();
  einstellungenAnzeigen();
  einstellungenAufbauen();
  toast('Lernstand gelöscht. Der Wortvorrat ist unverändert.');
}

/* ---------------------------------------------------------
   12. Ansichtswechsel, Thema, Tastatur
   --------------------------------------------------------- */

function ansichtZeigen(name) {
  var abschnitte = document.querySelectorAll('.ansicht');
  for (var i = 0; i < abschnitte.length; i++) {
    abschnitte[i].classList.toggle('aktiv', abschnitte[i].id === 'ansicht-' + name);
  }
  var knoepfe = $('nav').querySelectorAll('.nav-btn');
  for (var j = 0; j < knoepfe.length; j++) {
    knoepfe[j].classList.toggle('aktiv', knoepfe[j].dataset.ansicht === name);
  }

  if (name === 'lexikon')        lexAufbauen(true);
  if (name === 'statistik')      statistikAufbauen();
  if (name === 'einstellungen')  einstellungenAufbauen();
  if (name === 'ueben' && !sitzung) startAufbauen();

  window.scrollTo({ top: 0 });
}

function themaSetzen(t) {
  document.documentElement.setAttribute('data-thema', t);
  try { localStorage.setItem(THEMA_SCHLUESSEL, t); } catch (e) {}
}

function einstellungenAnzeigen() {
  $('selLaenge').value  = String(stand.einstellungen.laenge);
  $('selModus').value   = stand.einstellungen.modus;
  $('selAuswahl').value = stand.einstellungen.auswahl;
}

function tastatur(ev) {
  /* In Eingabefeldern nichts abfangen. */
  var ziel = ev.target;
  if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'SELECT' || ziel.tagName === 'TEXTAREA')) return;

  var uebenAktiv = $('ansicht-ueben').classList.contains('aktiv');
  if (!uebenAktiv || !sitzung) return;
  if ($('kartePanel').classList.contains('versteckt')) return;

  if (ev.key >= '1' && ev.key <= '4') {
    var nr = +ev.key - 1;
    if (!sitzung.beantwortet && nr < sitzung.aktuell.optionen.length) {
      /* Bei 50:50 ausgeblendete Antworten bleiben auch per Taste gesperrt. */
      var knopf = $('antworten').querySelectorAll('.antwort')[nr];
      if (knopf && !knopf.disabled) {
        ev.preventDefault();
        antworten(nr);
      }
    }
    return;
  }

  if (!sitzung.beantwortet) {
    var taste = ev.key.toLowerCase();
    if (taste === 't') { ev.preventDefault(); jokerTipp();      return; }
    if (taste === 'h') { ev.preventDefault(); joker5050();      return; }
    if (taste === 'l') { ev.preventDefault(); jokerAufloesen(); return; }
  }

  if (ev.key === 'Enter' || ev.key === ' ') {
    if (sitzung.beantwortet) {
      ev.preventDefault();
      weiter();
    }
  }
}

/* ---------------------------------------------------------
   13. Offline-Betrieb
   --------------------------------------------------------- */

var offlineZustand = 'unbekannt';

function offlineEinrichten() {
  if (!('serviceWorker' in navigator)) {
    offlineZustand = 'vom Browser nicht unterstützt';
    return;
  }

  /* Über file:// erlauben Browser keine Service Worker. Das ist kein Mangel:
     die Doppelklick-Fassung liegt ohnehin auf der Platte und braucht kein Netz. */
  if (location.protocol !== 'http:' && location.protocol !== 'https:') {
    offlineZustand = 'entfällt — lokale Datei';
    return;
  }

  offlineZustand = 'wird eingerichtet …';

  navigator.serviceWorker.register('sw.js').then(function (reg) {
    offlineZustand = navigator.serviceWorker.controller ? 'bereit' : 'wird geladen …';

    /* Wartet schon eine neue Fassung aus einem früheren Besuch? Dann feuert
       updatefound nicht mehr, und ohne diese Abfrage bliebe sie unerwähnt. */
    if (reg.waiting && navigator.serviceWorker.controller) {
      offlineZustand = 'neue Fassung wartet — beim nächsten Öffnen aktiv';
    }

    reg.addEventListener('updatefound', function () {
      var neuer = reg.installing;
      if (!neuer) return;

      neuer.addEventListener('statechange', function () {
        if (neuer.state !== 'installed') return;

        if (navigator.serviceWorker.controller) {
          /* Es lief schon eine Fassung: die neue übernimmt beim nächsten Start. */
          offlineZustand = 'neue Fassung wartet — beim nächsten Öffnen aktiv';
          toast('Neue Fassung geladen. Sie wird aktiv, sobald die App einmal ganz geschlossen und neu geöffnet wurde.');
        } else {
          offlineZustand = 'bereit';
          toast('Der Wortschatz ist jetzt auch ohne Netz verfügbar.');
        }
        einstellungenAufbauen();
      });
    });
  }).catch(function (fehler) {
    offlineZustand = 'fehlgeschlagen';
    console.warn('Service Worker nicht registriert:', fehler);
  });
}

/* ---------------------------------------------------------
   14. Start
   --------------------------------------------------------- */

function verdrahten() {
  /* Navigation */
  $('nav').addEventListener('click', function (ev) {
    var b = ev.target.closest('.nav-btn');
    if (b) ansichtZeigen(b.dataset.ansicht);
  });

  /* Thema */
  $('themaBtn').addEventListener('click', function () {
    var jetzt = document.documentElement.getAttribute('data-thema');
    themaSetzen(jetzt === 'dunkel' ? 'hell' : 'dunkel');
  });

  /* Sitzungssteuerung */
  $('btnStart').addEventListener('click', sitzungStarten);
  $('btnFortsetzen').addEventListener('click', sitzungFortsetzen);
  $('btnVerwerfen').addEventListener('click', sitzungVerwerfen);
  $('btnTipp').addEventListener('click', jokerTipp);
  $('btn5050').addEventListener('click', joker5050);
  $('btnAufloesen').addEventListener('click', jokerAufloesen);
  $('btnWeiter').addEventListener('click', weiter);
  $('btnNochmal').addEventListener('click', sitzungStarten);
  $('btnZumStart').addEventListener('click', zurStartansicht);
  $('btnAbbruch').addEventListener('click', function () {
    if (sitzung && sitzung.richtig + sitzung.falsch > 0) sitzungBeenden();
    else zurStartansicht();
  });

  /* Sitzungsoptionen */
  $('selLaenge').addEventListener('change', function () {
    stand.einstellungen.laenge = +this.value; standSichern();
  });
  $('selModus').addEventListener('change', function () {
    stand.einstellungen.modus = this.value; standSichern();
  });
  $('selAuswahl').addEventListener('change', function () {
    stand.einstellungen.auswahl = this.value; standSichern(); startAufbauen();
  });

  /* Lexikon */
  var suchTimer = null;
  $('lexSuche').addEventListener('input', function () {
    clearTimeout(suchTimer);
    suchTimer = setTimeout(function () { lexAufbauen(true); }, 160);
  });
  $('lexKategorie').addEventListener('change', function () { lexAufbauen(true); });
  $('lexStand').addEventListener('change', function () { lexAufbauen(true); });
  $('lexMehr').addEventListener('click', function () { lexGrenze += 100; lexAufbauen(false); });
  $('lexListe').addEventListener('click', function (ev) {
    var kopf = ev.target.closest('.lex-kopfzeile');
    if (!kopf) return;
    var id = kopf.dataset.id;
    if (lexOffen[id]) delete lexOffen[id]; else lexOffen[id] = true;
    lexAufbauen(false);
  });

  /* Einstellungen */
  $('katListe').addEventListener('change', kategorienUebernehmen);
  $('btnKatAlle').addEventListener('click', function () {
    stand.einstellungen.kategorien = KAT_REIHE.slice();
    standSichern(); einstellungenAufbauen(); startAufbauen();
  });
  $('btnKatKeine').addEventListener('click', function () {
    stand.einstellungen.kategorien = [];
    standSichern(); einstellungenAufbauen(); startAufbauen();
  });

  $('btnExport').addEventListener('click', exportieren);
  $('btnImport').addEventListener('click', function () { $('importDatei').click(); });
  $('importDatei').addEventListener('change', function () {
    if (this.files && this.files[0]) einspielen(this.files[0]);
    this.value = '';
  });
  $('btnReset').addEventListener('click', resetKlick);

  document.addEventListener('keydown', tastatur);
}

function los() {
  datenAufbereiten();
  stand = standLaden();

  var t = 'hell';
  try { t = localStorage.getItem(THEMA_SCHLUESSEL) || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dunkel' : 'hell'); } catch (e) {}
  themaSetzen(t);

  /* Kategorie-Auswahl im Lexikon füllen */
  var sel = $('lexKategorie');
  KAT_REIHE.forEach(function (k) {
    var o = document.createElement('option');
    o.value = k;
    o.textContent = KATEGORIEN[k] + ' (' + (NACH_KAT[k] || []).length + ')';
    sel.appendChild(o);
  });

  einstellungenAnzeigen();
  verdrahten();
  startAufbauen();
  offlineEinrichten();

  if (!WOERTER.length) {
    $('startHinweis').textContent = 'Der Wortvorrat konnte nicht geladen werden. Liegt der Ordner „daten“ neben dieser Datei?';
  }

  /* Ein einmal übertragener Stand wird sofort in der neuen Form gesichert. */
  if (umstellungsBericht) {
    standSichern();
    toast('Lernstand auf feste Wortnummern übertragen: ' + umstellungsBericht.umgestellt + ' Wörter.');
  }

  if (DATEN_MAENGEL.length) {
    console.warn('Wortschatz-Trainer — Mängel im Datenbestand:', DATEN_MAENGEL);
    toast(DATEN_MAENGEL.length + ' Wörter ohne gültige Nummer wurden übersprungen. Einzelheiten in der Browser-Konsole.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', los);
} else {
  los();
}

})();
