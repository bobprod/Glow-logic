' Glow Logic - Silent Stop
' Arrete tous les services sans fenetre console visible

Dim WshShell, fso, rootDir, psPath
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath = rootDir & "\scripts\Stop-GlowLogic.ps1"

If Not fso.FileExists(psPath) Then
    WshShell.Popup "Erreur : Stop-GlowLogic.ps1 introuvable !" & vbCrLf & psPath, 6, "Glow Logic", 16
    WScript.Quit 1
End If

WshShell.CurrentDirectory = rootDir
WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """", 0, False

WScript.Quit 0
