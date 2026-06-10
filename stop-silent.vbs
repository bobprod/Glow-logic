' Glow Logic - Silent Stop
' Arrete tous les services sans fenetre console

Dim WshShell, fso, rootDir, psPath
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath = rootDir & "\scripts\Stop-GlowLogic.ps1"

If fso.FileExists(psPath) Then
    WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """"", 0, False
End If

WScript.Quit 0
