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
    $anzahl += ([regex]::Matches($js, '(?m)^\["')).Count
}

# --- Anwendungslogik einbetten ---
$app  = Lies (Join-Path $root 'app.js')
$html = $html.Replace('<script src="app.js"></script>', "<script>`r`n$app`r`n</script>")

if ($html -match '<script src=' -or $html -match '<link rel="stylesheet"') {
    throw 'Es sind noch externe Verweise uebrig - die Einzeldatei waere unvollstaendig.'
}

Set-Content -LiteralPath $ziel -Value $html -Encoding UTF8

$kb = [math]::Round((Get-Item $ziel).Length / 1KB, 1)
Write-Host "Fertig: wortschatz-trainer.html  ($kb KB, $anzahl Woerter)"
