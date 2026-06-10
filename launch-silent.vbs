' Glow Logic - Silent Launcher
' Lance le backend + frontend sans aucune fenetre console visible

Dim WshShell, fso, rootDir, psPath
Set WshShell = CreateObject("WScript.Shell")
Set fso      = CreateObject("Scripting.FileSystemObject")

rootDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath  = rootDir & "\scripts\Launch-GlowLogic.ps1"

If Not fso.FileExists(psPath) Then
    WshShell.Popup "Erreur : Launch-GlowLogic.ps1 introuvable !" & vbCrLf & psPath, 6, "Glow Logic", 16
    WScript.Quit 1
End If

' Evite deux instances concurrentes qui se battent pour les ports 3000/3005.
Dim wmi, procs, proc, cmdLine
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set procs = wmi.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each proc In procs
    cmdLine = ""
    On Error Resume Next
    cmdLine = proc.CommandLine
    On Error GoTo 0
    If InStr(1, cmdLine, rootDir, vbTextCompare) > 0 Then
        WshShell.Popup "Glow Logic est deja en cours d'execution.", 4, "Glow Logic", 48
        WScript.Quit 0
    End If
Next

' WindowStyle 0 = cache, bWaitOnReturn = False - non bloquant
WshShell.CurrentDirectory = rootDir
WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """", 0, False

WScript.Quit 0
