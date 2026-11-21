# Wortschatz-Trainer

Karteikarten-Abfrage für Fremdwörter, Fachbegriffe und bildungssprachliche
Ausdrücke. 1242 Wörter, vier Antwortmöglichkeiten, danach Beispielsatz und
Herkunft.

## Womit anfangen

**`wortschatz-trainer.html`** — doppelklicken, fertig. Eine einzige Datei,
alles eingebettet, kein Server, kein Internet nötig. Das ist die Fassung zum
Benutzen und zum Mitnehmen (USB-Stick, zweiter Rechner, Anhang).

Die übrigen Dateien sind der Bauplan dahinter.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Gerüst der Oberfläche |
| `style.css` | Gestaltung, hell und dunkel |
| `app.js` | Ablauflogik: Auswahl, Leitner, Lexikon, Statistik |
| `daten/pack01…13.js` | die Wörter, nach Bereichen gebündelt |
| `manifest.json` | Angaben für die Installation als App |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `icon-*.png` | App-Symbole |
| `ids-vergeben.ps1` | vergibt feste Nummern an neue Wörter |
| `icons-erzeugen.ps1` | erzeugt die Symbole neu |
| `bauen.ps1` | fügt alles zu `wortschatz-trainer.html` zusammen |

Die Ordnerfassung (`index.html`) lässt sich ebenso doppelklicken und ist
identisch — nur eben aufgeteilt. Praktisch, wenn Sie etwas ändern wollen.

## Wortvorrat

| Bereich | Wörter |
|---|---:|
| Bildungssprache im Alltag | 242 |
| Bildungssprache | 300 |
| Sprache & Rhetorik | 100 |
| Philosophie & Psychologie | 100 |
| Recht & Verwaltung | 100 |
| Wirtschaft & Finanzen | 100 |
| Politik & Geschichte | 100 |
| Medizin & Naturwissenschaft | 100 |
| Kunst, Kultur & Religion | 100 |

Jeder Eintrag hat vier Felder: Wort, Bedeutung, Beispielsatz, Herkunft.

„Bildungssprache im Alltag“ enthält Wörter, die im Gespräch, in Mails und in
Besprechungen wirklich vorkommen — Eigenschaften, Verben und Substantive. Die
übrigen Bereiche gehen fachlich in die Tiefe.

Kommt später ein Bereich hinzu, schaltet die App ihn beim nächsten Start von
selbst mit ein. Bereiche, die Sie bewusst abgewählt haben, bleiben abgewählt.

## Abfrage

Die falschen Antworten stammen aus demselben Bereich und haben eine ähnliche
Länge wie die richtige — sonst ließe sich die Lösung an der Form erraten.

Drei Frageweisen: **Wort → Bedeutung**, **Bedeutung → Wort**, **gemischt**.

Tastatur: `1`–`4` antworten, `⏎` weiter, `T` Tipp, `H` 50:50, `L` Lösung.

## Unterbrochene Sitzung

Wird die Seite mitten in einer Runde neu geladen — Handy gesperrt, Tab zu,
Browser abgestürzt —, steht beim nächsten Start ein Hinweis mit *Fortsetzen*
und *Verwerfen*.

Fortgesetzt wird die Karte, bei der Sie waren, und zwar genau so: dieselben vier
Antwortmöglichkeiten in derselben Reihenfolge, ein gezogener Tipp noch sichtbar,
die bei 50:50 entfernten Antworten weiterhin entfernt. Ein bezahlter Joker
verfällt also nicht.

War die Karte bereits beantwortet und nur „Weiter“ noch nicht gedrückt, geht es
bei der **nächsten** weiter — die Antwort ist ja längst verbucht und zählte
sonst doppelt.

Der Hinweis erscheint nicht mehr, sobald Sie die Sitzung regulär beenden, eine
neue starten oder *Verwerfen* drücken. Verwerfen betrifft nur die angefangene
Runde: alle bis dahin beantworteten Wörter bleiben im Lernstand.

Gespeichert werden nur Wortnummern, keine Texte. Passt der Stand nicht mehr zum
Wortbestand — etwa weil ein Wort entfernt wurde —, wird er stillschweigend
verworfen statt mit einem Fehler zu enden.

## Joker

Über den Antworten liegen drei Hilfen. Tipp und 50:50 haben einen Vorrat je
Sitzung, der neben dem Knopf mitzählt — etwa ein Tipp je fünf und ein 50:50 je
sieben Karten, mindestens zwei.

| Joker | Wirkung |
|---|---|
| **Tipp** | Bei *Wort → Bedeutung* erscheint die Herkunft, die den Sinn meist schon trägt. Bei *Bedeutung → Wort* verriete sie das Wort, deshalb gibt es dort stattdessen Anfangsbuchstabe und Länge. |
| **50 : 50** | Zwei falsche Antworten fallen weg. Sie sind auch per Zifferntaste gesperrt. |
| **Ich weiß es nicht** | Zeigt die Lösung sofort. Unbegrenzt. |

**Jokers kosten etwas — sonst wären sie wertlos:** Ein Wort, das Sie mit Tipp
oder 50:50 richtig beantworten, **rückt kein Fach vor**. Es bleibt, wo es war,
und kommt entsprechend bald wieder. Sonst entstünde ein Fach 5, das nie ohne
Hilfe erreicht wurde, und die Wiederholung käme viel zu spät.

„Ich weiß es nicht“ zählt weder als Treffer noch als Fehler — die Trefferquote
bleibt unberührt. Das Wort behält sein Fach und bleibt fällig. Die Serie reißt
dabei allerdings ab.

Am Sitzungsende steht, welche Joker Sie gezogen haben; die Statistik führt sie
dauerhaft mit.

## Wiederholung nach Leitner

Jedes Wort sitzt in einem von fünf Fächern. Richtig beantwortet rückt es eins
vor, falsch fällt es zurück in Fach 1.

| Fach | wieder fällig nach |
|---|---|
| 1 | sofort |
| 2 | 1 Tag |
| 3 | 3 Tagen |
| 4 | 8 Tagen |
| 5 | 21 Tagen |

„Klug (fällige + neue)“ nimmt zuerst, was fällig ist, und mischt etwa ein
Drittel frische Wörter dazu.

## Als App installieren, Betrieb ohne Netz

Die Ordnerfassung ist eine PWA: über eine Webadresse aufgerufen lässt sie sich
auf dem Startbildschirm ablegen und läuft danach auch ohne Verbindung.

**Voraussetzung ist HTTPS.** Service Worker sind über `file://` von allen
Browsern gesperrt — das ist keine Einstellungssache. Für den Offline-Betrieb
muss die App also von einer Adresse kommen, etwa über GitHub Pages:

> Repository → **Settings** → **Pages** → *Source*: „Deploy from a branch“ →
> Branch `main`, Ordner `/ (root)` → **Save**

Danach unter `https://<konto>.github.io/Lernapp/` aufrufen, im Browsermenü
*Zum Startbildschirm hinzufügen* wählen — fertig.

Die Doppelklick-Datei `wortschatz-trainer.html` braucht davon nichts: Sie liegt
ohnehin auf der Platte und funktioniert ohne Verbindung.

### Was abgelegt wird

Beim ersten Aufruf legt der Service Worker die vollständige Anwendung ab —
`index.html`, `style.css`, `app.js`, alle 13 Wortpakete, Manifest und Symbole.
Zusammen rund 300 KB. Ab dem zweiten Aufruf startet die App aus diesem Bestand,
auch im Flugmodus.

Der Lernstand liegt davon unberührt im localStorage. Der Cache hält die
Anwendung vor, nicht Ihren Fortschritt.

### Wie Aktualisierungen ankommen

`bauen.ps1` bildet aus dem Inhalt aller abgelegten Dateien eine Kennung und
stempelt sie in `sw.js`. Ändert sich irgendwo ein Zeichen, ändert sich die
Kennung und damit der Cachename — der Browser lädt den neuen Stand. Ohne diesen
Stempel behielte ein Gerät die erste Fassung für immer.

Eine neue Fassung wird im Hintergrund geladen. Sie wird aktiv, sobald die App
einmal **ganz geschlossen und neu geöffnet** wurde — nicht schon beim Neuladen
der Seite. Unter *Einstellungen → Wortschatz* steht, woran der Offline-Betrieb
gerade ist, auch wenn eine Fassung wartet.

Bis dahin bedient weiterhin die alte Fassung, und zwar **vollständig**: Seite
und alle Dateien stammen immer aus demselben Bestand. Das ist Absicht. Holte man
die Seite frisch vom Netz und die Dateien aus dem Cache, bekäme man neues HTML
mit altem JavaScript — Bedienelemente, hinter denen nichts liegt.

## Feste Wortnummern

Jedes Wort trägt als erstes Feld eine feste Nummer:

```javascript
[42,"Wort","Bedeutung","Beispielsatz mit dem Wort darin.","Herkunft"],
```

Diese Nummer ist der Schlüssel, unter dem der Lernstand gespeichert wird — **nicht**
die Position im Array und **nicht** der Wortlaut. Daraus folgt:

- Zeilen umsortieren, einfügen oder löschen lässt alle anderen Nummern unberührt.
- Selbst wenn Sie später einen Tippfehler im Stichwort korrigieren, bleibt der
  Lernstand an der Karte hängen.
- Nummern werden nie neu vergeben: gelöschte Nummern bleiben frei, der Zähler
  läuft nur vorwärts.

Ein früher gespeicherter Lernstand aus der Zeit vor den Nummern wird beim ersten
Start automatisch übertragen; dasselbe gilt für ältere Sicherungsdateien beim
Einspielen. Einträge, die sich nicht zuordnen lassen, bleiben unangetastet
stehen statt gelöscht zu werden.

Unter *Einstellungen → Wortschatz* zeigt die App den belegten Nummernbereich und
meldet Dubletten.

## Wörter ändern oder ergänzen

In `daten/` eine Zeile einfügen — **ohne** Nummer, die vergibt das Skript:

```javascript
["Wort","Bedeutung","Beispielsatz mit dem Wort darin.","Herkunft"],
```

Der Beispielsatz sollte das Stichwort wirklich enthalten — die App hebt es
hervor und erkennt dabei auch gebeugte Formen.

Danach zwei Schritte, in dieser Reihenfolge:

```bash
powershell -ExecutionPolicy Bypass -File .\ids-vergeben.ps1
```

```bash
powershell -ExecutionPolicy Bypass -File .\bauen.ps1
```

`ids-vergeben.ps1` trägt die nächste freie Nummer nach, bricht bei doppelt
vergebenen Nummern ab und setzt ans Ende jeder Eintragszeile ein Komma. Das
Komma ist kein Schönheitsfehler: ohne es wäre die letzte Zeile ein Sonderfall,
und ein Umsortieren würde die Liste zerreißen. Mehrfaches Ausführen ist
gefahrlos — bestehende Nummern rührt das Skript nicht an.

Das Skript zählt die Wörter mit und meldet, wenn ein Verweis nicht eingebettet
werden konnte.

## Lernstand

Der Lernstand liegt **ausschließlich im localStorage des Browsers** auf diesem
Rechner — Fächer, Trefferquoten, Tagesverlauf. Es gibt keine zweite Kopie.

Wer den Browserverlauf samt Websitedaten löscht, löscht ihn mit. Auch ein
anderer Browser oder das Verschieben der Datei in einen anderen Ordner zeigt
einen leeren Stand, weil sich damit die Herkunft ändert.

Deshalb: **Einstellungen → Lernstand exportieren.** Das ist die einzige
Sicherung. Die JSON-Datei lässt sich dort auch wieder einspielen.

## Hinweis zu den Paragrafen

Im Bereich Recht & Verwaltung sowie bei den steuerlichen Begriffen in
Wirtschaft & Finanzen stehen Fundstellen (AO, EStG, VwVfG, VwGO, FGO, HGB,
BGB, GG). Stand: August 2026. Sie dienen der Einordnung beim Lernen und
ersetzen keine Prüfung am geltenden Gesetzestext.
