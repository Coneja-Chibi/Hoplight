' Launch the packaged Hoplight app from this checkout without baking an absolute repo path into the
' shortcut target. The launcher locates the repository from its own path, so moving or renaming the
' checkout only requires rerunning install-shortcuts.ps1.
Dim fso : Set fso = CreateObject("Scripting.FileSystemObject")
Dim repoRoot : repoRoot = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
Dim exePath : exePath = fso.BuildPath(repoRoot, "dist\Hoplight.exe")

If Not fso.FileExists(exePath) Then
    MsgBox "Hoplight.exe was not found. Run bun run scripts/build-desktop.ts, then reinstall the shortcuts.", 16, "Hoplight"
    WScript.Quit 1
End If

Dim shell : Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = fso.GetParentFolderName(exePath)
shell.Run """" & exePath & """", 0, False
