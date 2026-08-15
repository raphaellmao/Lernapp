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

Tastatur: `1`–`4` antworten, `⏎` weiter.

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

## Wörter ändern oder ergänzen

In `daten/` eine Zeile nach demselben Muster einfügen:

```javascript
["Wort","Bedeutung","Beispielsatz mit dem Wort darin.","Herkunft"],
```

Der Beispielsatz sollte das Stichwort wirklich enthalten — die App hebt es
hervor und erkennt dabei auch gebeugte Formen. Danach neu bauen:

```bash
powershell -ExecutionPolicy Bypass -File .\bauen.ps1
```

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
