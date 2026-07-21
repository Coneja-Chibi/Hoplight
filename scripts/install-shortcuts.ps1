# Create the packaged, browser, and live-development shortcuts from this checkout.
# Run: powershell -ExecutionPolicy Bypass -File scripts/install-shortcuts.ps1
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "dist\Hoplight.exe"
$icon = Join-Path $root "build\vaude.ico"
$packagedLauncher = Join-Path $root "scripts\launch-hoplight.vbs"
$browserLauncher = Join-Path $root "scripts\launch-hoplight-browser.vbs"
$devLauncher = Join-Path $root "scripts\launch-hoplight-dev.vbs"
$wscript = Join-Path $env:WINDIR "System32\wscript.exe"

$required = @($exe, $packagedLauncher, $browserLauncher, $devLauncher, $wscript)
foreach ($path in $required) {
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Error "Shortcut target not found: $path"
        exit 1
    }
}

$shell = New-Object -ComObject WScript.Shell
$programs = [Environment]::GetFolderPath("Programs")
$desktop = [Environment]::GetFolderPath("Desktop")
$definitions = @(
    @{
        Name = "Hoplight"
        Target = $wscript
        Arguments = "`"$packagedLauncher`""
        WorkingDirectory = (Split-Path -Parent $exe)
        Description = "Hoplight - the forge for AI-roleplay content"
        Desktop = $true
    },
    @{
        Name = "Hoplight (Browser)"
        Target = $wscript
        Arguments = "`"$browserLauncher`""
        WorkingDirectory = $root
        Description = "Hoplight in the default browser, running from live source"
        Desktop = $false
    },
    @{
        Name = "Hoplight (Dev)"
        Target = $wscript
        Arguments = "`"$devLauncher`""
        WorkingDirectory = $root
        Description = "Hoplight native development window, running from live source"
        Desktop = $false
    }
)

foreach ($definition in $definitions) {
    $destinations = @((Join-Path $programs "$($definition.Name).lnk"))
    if ($definition.Desktop -and $desktop) {
        $destinations += (Join-Path $desktop "$($definition.Name).lnk")
    }
    foreach ($path in $destinations) {
        $lnk = $shell.CreateShortcut($path)
        $lnk.TargetPath = $definition.Target
        $lnk.Arguments = $definition.Arguments
        $lnk.WorkingDirectory = $definition.WorkingDirectory
        $lnk.Description = $definition.Description
        if (Test-Path -LiteralPath $icon) {
            $lnk.IconLocation = "$icon,0"
        } else {
            $lnk.IconLocation = "$exe,0"
        }
        $lnk.Save()
        Write-Host "created $path"
    }
}
