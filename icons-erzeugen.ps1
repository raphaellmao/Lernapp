# Erzeugt die App-Symbole fuer die PWA.
# Aufruf:  powershell -ExecutionPolicy Bypass -File .\icons-erzeugen.ps1
# Muss nur laufen, wenn sich das Symbol aendern soll - die PNGs liegen im Repo.

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

$grund    = [System.Drawing.ColorTranslator]::FromHtml('#6b4f27')   # warmes Braun
$schrift  = [System.Drawing.ColorTranslator]::FromHtml('#f4f2ee')   # Papierton

function Neues-Symbol {
    param(
        [int]$Groesse,
        [string]$Datei,
        [double]$Anteil = 0.62,     # Hoehe des Buchstabens im Verhaeltnis zur Kachel
        [bool]$Rund = $true         # abgerundete Ecken (bei maskable: volle Flaeche)
    )

    $bmp = New-Object System.Drawing.Bitmap($Groesse, $Groesse)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $pinsel = New-Object System.Drawing.SolidBrush($grund)

    if ($Rund) {
        # Abgerundetes Quadrat, transparente Ecken
        $r    = [int]($Groesse * 0.22)
        $pfad = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d    = $r * 2
        $pfad.AddArc(0, 0, $d, $d, 180, 90)
        $pfad.AddArc($Groesse - $d, 0, $d, $d, 270, 90)
        $pfad.AddArc($Groesse - $d, $Groesse - $d, $d, $d, 0, 90)
        $pfad.AddArc(0, $Groesse - $d, $d, $d, 90, 90)
        $pfad.CloseFigure()
        $g.FillPath($pinsel, $pfad)
        $pfad.Dispose()
    } else {
        # Maskable: die ganze Flaeche fuellen, Zuschnitt uebernimmt das System
        $g.FillRectangle($pinsel, 0, 0, $Groesse, $Groesse)
    }

    # Serifen-W, mittig
    $schriftgroesse = [float]($Groesse * $Anteil * 0.72)
    $font = New-Object System.Drawing.Font('Georgia', $schriftgroesse, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment     = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textpinsel = New-Object System.Drawing.SolidBrush($schrift)
    $rechteck = New-Object System.Drawing.RectangleF(0, [float]($Groesse * -0.03), [float]$Groesse, [float]$Groesse)
    $g.DrawString('W', $font, $textpinsel, $rechteck, $format)

    $ziel = Join-Path $root $Datei
    $bmp.Save($ziel, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose(); $format.Dispose(); $pinsel.Dispose(); $textpinsel.Dispose()
    $g.Dispose(); $bmp.Dispose()

    $kb = [math]::Round((Get-Item $ziel).Length / 1KB, 1)
    Write-Host ("  {0}  {1}x{1}  {2} KB" -f $Datei, $Groesse, $kb)
}

Write-Host 'Erzeuge Symbole:'
Neues-Symbol -Groesse 192 -Datei 'icon-192.png'
Neues-Symbol -Groesse 512 -Datei 'icon-512.png'
# Maskable braucht Rand: der Inhalt muss in einen Kreis mit 80 % Durchmesser passen
Neues-Symbol -Groesse 512 -Datei 'icon-512-maskable.png' -Anteil 0.42 -Rund $false
Write-Host 'Fertig.'
