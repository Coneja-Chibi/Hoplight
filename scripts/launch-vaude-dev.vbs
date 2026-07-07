' Launch Vaude (dev): the native app window over LIVE source, with no console window.
' A Start Menu shortcut points here, so the Windows search-bar "Vaude (Dev)" always opens today's
' code - no compile, no snapshot; it hot-reloads from src/ on every open. Shipped Vaude.exe is separate.
' Self-locating: repo root is this script's parent's parent (scripts/ sits under the repo root), so
' there is no hardcoded user path to rot.
Dim fso : Set fso = CreateObject("Scripting.FileSystemObject")
Dim repoRoot : repoRoot = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Dim shell : Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = repoRoot
' 0 = hidden window (no console), False = don't block. Relies on `bun` being on PATH (the installer adds it).
shell.Run "bun run src/desktop-dev.ts", 0, False
