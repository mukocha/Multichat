Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = currentDir

If fso.FileExists(currentDir & "\bin\node.exe") Then
    WshShell.Run """" & currentDir & "\bin\node.exe"" """ & currentDir & "\server.js""", 0, False
Else
    WshShell.Run "node server.js", 0, False
End If
