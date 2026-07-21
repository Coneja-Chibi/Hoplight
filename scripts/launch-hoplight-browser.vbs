' Open Hoplight in the default browser (hot-reloading), no console window. A Start Menu shortcut points
' here. Self-locating: repo root is this script's parent's parent (scripts/ sits under the repo root).
Dim fso : Set fso = CreateObject("Scripting.FileSystemObject")
Dim repoRoot : repoRoot = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Dim shell : Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = repoRoot
shell.Run "bun run scripts/vaude-browser.ts", 0, False
