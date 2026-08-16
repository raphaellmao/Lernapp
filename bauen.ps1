# Baut aus den Einzeldateien die eigenstaendige Fassung wortschatz-trainer.html.
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\bauen.ps1
# Nach jeder Aenderung an index.html, style.css, app.js oder daten\*.js erneut ausfuehren.

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ziel = Join-Path $root 'wortschatz-trainer.html'

function Lies($pfad) {
    if (-not (Test-Path $pfad)) { throw "Datei fehlt: $pfad" }
    return (Get-Content -LiteralPath $pfad -Raw -Encoding UTF8)
}

$html = Lies (Join-Path $root 'index.html')

# --- CSS einbetten (String.Replace ist literal, kein Regex: $-Zeichen bleiben heil) ---
$css  = Lies (Join-Path $root 'style.css')
$html = $html.Replace('<link rel="stylesheet" href="style.css">', "<style>`r`n$css`r`n</style>")

# --- Datenpakete einbetten ---
$anzahl = 0
foreach ($i in 1..13) {
    $n     = '{0:00}' -f $i
    $datei = Join-Path $root "daten\pack$n.js"
    $js    = Lies $datei
    $html  = $html.Replace("<script src=`"daten/pack$n.js`"></script>", "<script>`r`n$js`r`n</script>")
    $anzahl += ([regex]::Matches($js, '(?m)^\[\d+,"')).Count
}

# --- Anwendungslogik einbetten ---
$app  = Lies (Join-Path $root 'app.js')
$html = $html.Replace('<script src="app.js"></script>', "<script>`r`n$app`r`n</script>")

if ($html -match '<script src=' -or $html -match '<link rel="stylesheet"') {
    throw 'Es sind noch externe Verweise uebrig - die Einzeldatei waere unvollstaendig.'
}

Set-Content -LiteralPath $ziel -Value $html -Encoding UTF8

# --- Service Worker stempeln ---------------------------------------------
# Die Kennung wird aus dem Inhalt aller zwischengespeicherten Dateien gebildet.
# Aendert sich irgendwo ein Zeichen, aendert sich die Kennung, damit auch der
# Cachename - und der Browser holt den neuen Stand. Ohne das behielte ein
# Geraet die erste Fassung fuer immer.
# sw.js selbst bleibt aussen vor: eine Aenderung daran erkennt der Browser
# ohnehin am Byte-Vergleich der Datei.
$swPfad = Join-Path $root 'sw.js'
if (Test-Path $swPfad) {
    $zuHashen = @('index.html', 'style.css', 'app.js', 'manifest.json') +
                (1..13 | ForEach-Object { 'daten\pack{0:00}.js' -f $_ })

    $strom = New-Object System.IO.MemoryStream
    foreach ($rel in $zuHashen) {
        $f = Join-Path $root $rel
        if (Test-Path $f) {
            $b = [System.IO.File]::ReadAllBytes($f)
            $strom.Write($b, 0, $b.Length)
        } else {
            throw "Fuer den Service Worker fehlt: $rel"
        }
    }

    $sha  = [System.Security.Cryptography.SHA256]::Create()
    $hash = ($sha.ComputeHash($strom.ToArray()) | ForEach-Object { $_.ToString('x2') }) -join ''
    $strom.Dispose(); $sha.Dispose()
    $kennung = $hash.Substring(0, 12)

    $swText = [System.IO.File]::ReadAllText($swPfad, [System.Text.Encoding]::UTF8)
    $swNeu  = [regex]::Replace($swText, "var BUILD = '[^']*';", "var BUILD = '$kennung';")

    if ($swNeu -ne $swText) {
        [System.IO.File]::WriteAllText($swPfad, $swNeu, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Service Worker gestempelt: $kennung"
    } else {
        Write-Host "Service Worker unveraendert: $kennung"
    }
}

$kb = [math]::Round((Get-Item $ziel).Length / 1KB, 1)
Write-Host "Fertig: wortschatz-trainer.html  ($kb KB, $anzahl Woerter)"
