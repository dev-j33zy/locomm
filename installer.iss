; SECTalk Windows Installer — Inno Setup Script
; Bundles: SECTalk.exe launcher, Node.js portable, backend + built frontend

#define MyAppName "SECTalk"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SECTalk"
#define MyAppExeName "SECTalk.exe"

[Setup]
AppId={{B3F1A2D4-7E8C-4F5A-9D6B-1C2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.
OutputBaseFilename=SECTalk-Setup-{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Launcher executable
Source: "dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion

; Node.js portable runtime (only node.exe is needed for production)
Source: "node\node.exe"; DestDir: "{app}\node"; Flags: ignoreversion

; Backend server + dependencies
Source: "backend\server.js"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "backend\package.json"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "backend\node_modules\*"; DestDir: "{app}\backend\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs

; SSL certs (if they exist — generated on first run if not)
Source: "backend\cert.pem"; DestDir: "{app}\backend"; Flags: ignoreversion skipifsourcedoesntexist
Source: "backend\key.pem"; DestDir: "{app}\backend"; Flags: ignoreversion skipifsourcedoesntexist

; Built frontend (production static files)
Source: "frontend\dist\*"; DestDir: "{app}\frontend\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch SECTalk"; Flags: nowait postinstall skipifsilent
