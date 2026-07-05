# Create Desktop + Start Menu shortcuts for Vaude.exe with the beam-V icon.
# Run: powershell -ExecutionPolicy Bypass -File scripts/install-shortcuts.ps1
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "dist\Vaude.exe"
$icon = Join-Path $root "build\vaude.ico"
if (-not (Test-Path $exe)) { Write-Error "dist\Vaude.exe not found - run: bun run scripts/build-desktop.ts"; exit 1 }

$shell = New-Object -ComObject WScript.Shell
$targets = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop")) "Vaude.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "Vaude.lnk")
)
foreach ($path in $targets) {
    $lnk = $shell.CreateShortcut($path)
    $lnk.TargetPath = $exe
    $lnk.WorkingDirectory = (Split-Path -Parent $exe)
    if (Test-Path $icon) { $lnk.IconLocation = "$icon,0" }
    $lnk.Description = "Vaude. - the forge for AI-roleplay content"
    $lnk.Save()
    Write-Host "created $path"
}
