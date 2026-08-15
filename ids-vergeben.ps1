# Vergibt jedem Wort in daten\pack*.js eine feste Nummer als erstes Feld.
#
#   ["Wort","Bedeutung","Beispiel","Herkunft"],      ->  [42,"Wort","Bedeutung","Beispiel","Herkunft"],
#
# Regeln:
#   - Bereits vergebene Nummern werden NIE geaendert oder neu verteilt.
#   - Neue Zeilen ohne Nummer bekommen die naechste freie, hoeher als jede bisherige.
#   - Geloeschte Nummern werden nicht wiederverwendet: der Zaehler laeuft nur vorwaerts.
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\ids-vergeben.ps1
# Danach immer bauen.ps1 laufen lassen.

$root    = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dateien = Get-ChildItem (Join-Path $root 'daten\pack*.js') | Sort-Object Name
$utf8    = New-Object System.Text.UTF8Encoding($false)   # ohne BOM

if (-not $dateien) { throw "Keine Paketdateien in $root\daten gefunden." }

function Lies($pfad) { ([System.IO.File]::ReadAllText($pfad, [System.Text.Encoding]::UTF8)) -split "`n" }

# ---- Durchgang 1: bestehende Nummern einsammeln und auf Dubletten pruefen ----
$belegt = @{}
$hoechste = 0
foreach ($d in $dateien) {
    $nr = 0
    foreach ($z in (Lies $d.FullName)) {
        $nr++
        if ($z -match '^\[(\d+),') {
            $id = [int]$Matches[1]
            if ($belegt.ContainsKey($id)) {
                throw "Nummer $id ist doppelt vergeben: $($belegt[$id]) und $($d.Name) Zeile $nr"
            }
            $belegt[$id] = "$($d.Name) Zeile $nr"
            if ($id -gt $hoechste) { $hoechste = $id }
        }
    }
}

Write-Host ("Bestehende Nummern: {0}, hoechste: {1}" -f $belegt.Count, $hoechste)

# ---- Durchgang 2: fehlende Nummern ergaenzen, Kommas vereinheitlichen ----
#
# Jede Eintragszeile endet auf ein Komma, auch die letzte. Vor der schliessenden
# Klammer ist ein solches Komma gueltiges JavaScript und macht die Datei
# unempfindlich gegen Umsortieren: ohne es waere die letzte Zeile ein Sonderfall,
# und jedes Verschieben wuerde die Liste zerreissen.
$neu = 0
$kommas = 0
foreach ($d in $dateien) {
    $zeilen    = Lies $d.FullName
    $geaendert = $false

    for ($i = 0; $i -lt $zeilen.Count; $i++) {
        if ($zeilen[$i] -match '^\["') {
            $hoechste++
            $zeilen[$i] = '[' + $hoechste + ',' + $zeilen[$i].Substring(1)
            $belegt[$hoechste] = "$($d.Name)"
            $neu++
            $geaendert = $true
        }

        if ($zeilen[$i] -match '^\[\d+,"' -and $zeilen[$i].TrimEnd() -notmatch ',$') {
            $zeilen[$i] = $zeilen[$i].TrimEnd() + ','
            $kommas++
            $geaendert = $true
        }
    }

    if ($geaendert) {
        # Zeilenenden bewusst als LF belassen, damit der Git-Diff klein bleibt
        [System.IO.File]::WriteAllText($d.FullName, ($zeilen -join "`n"), $utf8)
        Write-Host ("  ergaenzt in {0}" -f $d.Name)
    }
}

if ($neu -gt 0) {
    Write-Host ("Neu vergeben: {0} Nummern (bis {1})" -f $neu, $hoechste)
} else {
    Write-Host "Alle Woerter hatten bereits eine Nummer."
}
if ($kommas -gt 0) { Write-Host ("Kommas ergaenzt: {0} Zeilen" -f $kommas) }
Write-Host ("Gesamt: {0} Woerter" -f $belegt.Count)
