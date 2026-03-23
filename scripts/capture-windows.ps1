# GP-200 USB-MIDI Capture Script (Windows)
# Benötigt: Wireshark mit tshark + USBPcap (wird bei Wireshark-Installation mitinstalliert)
#
# Verwendung:
#   .\capture-windows.ps1                     # interaktiv: Interface auswählen + analysieren
#   .\capture-windows.ps1 -Interface 3        # direkt Interface 3 nutzen
#   .\capture-windows.ps1 -OutFile C:\tmp\gp200.pcap
#
# Ausgabe: Pcap-Datei + automatische Analyse mit analyze-sysex.py

param(
    [int]$Interface = 0,
    [string]$OutFile = ""
)

# ----- Hilfsfunktionen -------------------------------------------------------

function Find-Tshark {
    $candidates = @(
        "tshark",
        "C:\Program Files\Wireshark\tshark.exe",
        "C:\Program Files (x86)\Wireshark\tshark.exe"
    )
    foreach ($c in $candidates) {
        try {
            $null = & $c --version 2>&1
            if ($LASTEXITCODE -eq 0) { return $c }
        } catch {}
    }
    return $null
}

function Find-Python {
    $candidates = @("python", "python3", "py")
    foreach ($c in $candidates) {
        try {
            $ver = & $c --version 2>&1
            if ($ver -match "Python 3") { return $c }
        } catch {}
    }
    return $null
}

function Get-UsbInterfaces($tshark) {
    # tshark -D gibt alle Interfaces aus; wir filtern auf USBPcap-Interfaces
    $lines = & $tshark -D 2>&1
    $usb = $lines | Where-Object { $_ -match "USBPcap|usbpcap|\\\\\.\\\\USB" }
    return $usb
}

function Show-Gp200Info {
    Write-Host ""
    Write-Host "GP-200 USB-Geraeteinfo (Windows Device Manager):" -ForegroundColor Cyan
    try {
        $dev = Get-PnpDevice -ErrorAction SilentlyContinue |
               Where-Object { ($_.HardwareId -match "VID_84EF" -and $_.HardwareId -match "PID_002A") -or
                               $_.FriendlyName -like "*GP-200*" -or $_.FriendlyName -like "*Valeton*" }
        if ($dev) {
            foreach ($d in $dev) {
                Write-Host "  Name:   $($d.FriendlyName)" -ForegroundColor Green
                Write-Host "  Status: $($d.Status)"
                Write-Host "  ID:     $($d.InstanceId)"
            }
        } else {
            Write-Host "  GP-200 nicht gefunden -- Geraet verbunden und eingeschaltet?" -ForegroundColor Yellow
            Write-Host "  (Erwartet: VID=84EF PID=002A, Normalmodus 6-In/4-Out)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  (Get-PnpDevice nicht verfuegbar)" -ForegroundColor Gray
    }
    Write-Host ""
}

# ----- Hauptprogramm ---------------------------------------------------------

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " GP-200 USB-MIDI Capture (Windows/USBPcap)  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 1. tshark prüfen
$tshark = Find-Tshark
if (-not $tshark) {
    Write-Host "FEHLER: tshark nicht gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Wireshark mit tshark + USBPcap installieren:" -ForegroundColor Yellow
    Write-Host "  1. https://www.wireshark.org/download.html"
    Write-Host "  2. Im Installer: 'TShark' und 'USBPcap' ankreuzen"
    Write-Host "  3. Nach Installation neues Terminal oeffnen"
    exit 1
}
Write-Host "tshark: $tshark" -ForegroundColor Green

# 2. Python prüfen
$python = Find-Python
if (-not $python) {
    Write-Host "WARNUNG: Python 3 nicht gefunden -- Analyse uebersprungen" -ForegroundColor Yellow
} else {
    Write-Host "python: $python" -ForegroundColor Green
}

# 3. GP-200 Gerätestatus anzeigen
Show-Gp200Info

# 4. USBPcap-Interfaces listen
Write-Host "Verfuegbare USB-Capture-Interfaces:" -ForegroundColor Cyan
$allIfaces = & $tshark -D 2>&1
$allIfaces | ForEach-Object { Write-Host "  $_" }
Write-Host ""

$usbIfaces = $allIfaces | Where-Object { $_ -match "USBPcap|usbpcap" }
if (-not $usbIfaces) {
    Write-Host "FEHLER: Keine USBPcap-Interfaces gefunden!" -ForegroundColor Red
    Write-Host ""
    Write-Host "USBPcap-Treiber aktivieren:" -ForegroundColor Yellow
    Write-Host "  Wireshark neu installieren und 'USBPcap' auswaehlen"
    Write-Host "  Oder: https://github.com/desowin/usbpcap/releases"
    exit 1
}

# 5. Interface auswählen
if ($Interface -eq 0) {
    Write-Host "USBPcap-Interfaces:" -ForegroundColor Cyan
    $i = 1
    $ifaceList = @()
    foreach ($line in $usbIfaces) {
        if ($line -match "^(\d+)\. (.+)") {
            $num = $Matches[1]
            $name = $Matches[2]
            Write-Host "  ${num}: $name"
            $ifaceList += $num
        }
    }
    Write-Host ""
    Write-Host "Tipp: Das GP-200 ist auf dem USB-Host-Controller, an dem es steckt." -ForegroundColor Gray
    Write-Host "      Im Zweifel alle USBPcap-Interfaces testen oder alle auf einmal:" -ForegroundColor Gray
    Write-Host "      Alle Interfaces als kommagetrennte Liste angeben (z.B. 1,2)" -ForegroundColor Gray
    Write-Host ""
    $sel = Read-Host "Interface-Nummer(n) eingeben"
    $ifaceArgs = ($sel -split ",") | ForEach-Object { "-i"; $_.Trim() }
} else {
    $ifaceArgs = @("-i", $Interface)
}

# 6. Output-Datei
if (-not $OutFile) {
    $ts = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutFile = "$PSScriptRoot\gp200-capture-$ts.pcap"
}
Write-Host ""
Write-Host "Capture-Datei: $OutFile" -ForegroundColor Cyan

# 7. Capture starten
Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Capture laeuft -- jetzt Valeton-Editor "
Write-Host " oder GP-200 Editor im Browser nutzen! "
Write-Host " ENTER druecken zum Beenden.            "
Write-Host "======================================" -ForegroundColor Green
Write-Host ""

# tshark im Hintergrund starten
$tsharkArgList = $ifaceArgs + @("-w", $OutFile)
$proc = Start-Process -FilePath $tshark -ArgumentList $tsharkArgList -NoNewWindow -PassThru

# Warten auf ENTER
Read-Host | Out-Null

# Capture stoppen
Write-Host ""
Write-Host "Capture wird gestoppt..." -ForegroundColor Yellow
if ($proc -and !$proc.HasExited) {
    Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue
}

# Kurze Pause damit tshark die Datei schließt
Start-Sleep -Milliseconds 500

if (-not (Test-Path $OutFile)) {
    Write-Host "FEHLER: Capture-Datei wurde nicht erstellt." -ForegroundColor Red
    Write-Host "       (War das GP-200 verbunden? Richtiges Interface?)" -ForegroundColor Yellow
    exit 1
}

$size = (Get-Item $OutFile).Length
Write-Host "Gespeichert: $OutFile ($($size) Bytes)" -ForegroundColor Green
Write-Host ""

# 8. Fertig (Analyse separat: python scripts\analyze-sysex.py <datei>)
