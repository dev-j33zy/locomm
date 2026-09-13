param(
    [Parameter(Mandatory = $true)]
    [string]$CertPath,
    [string]$CertPassword,
    [string]$TimestampUrl = "http://timestamp.digicert.com",
    [string]$SignToolPath = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe"
)

$ErrorActionPreference = "Stop"

function Test-SecurePath {
    param([string]$Path)
    return -not [string]::IsNullOrWhiteSpace($Path)
}

if (-not (Test-Path -LiteralPath $CertPath)) {
    throw "Certificate not found: $CertPath"
}

foreach ($Tool in @($SignToolPath, "$PSScriptRoot\dist\SECTalk.exe")) {
    if (-not (Test-Path -LiteralPath $Tool)) {
        throw "Required file not found: $Tool"
    }
}

$installer = Get-ChildItem -LiteralPath $PSScriptRoot -Filter "SECTalk-Setup-*.exe" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $installer) {
    throw "No SECTalk-Setup-*.exe found in $PSScriptRoot. Compile the installer first."
}

function Invoke-Sign {
    param(
        [string]$Target,
        [string]$Purpose
    )
    $args = @("sign", "/fd", "SHA256", "/t", $TimestampUrl, "/f", $CertPath)
    if (Test-SecurePath $CertPassword) {
        $args += @("/p", $CertPassword)
    } else {
        $args += @("/c", (Get-PfxCertificate -FilePath $CertPath).Thumbprint)
    }
    $args += @("/a", $Target)

    Write-Host "Signing $Purpose: $Target" -ForegroundColor Cyan
    & $SignToolPath $args
    if ($LASTEXITCODE -ne 0) {
        throw "signtool failed for $Target with exit code $LASTEXITCODE"
    }
}

function Test-Signed {
    param([string]$Target)
    & $SignToolPath verify /pa $Target *> $null
    return ($LASTEXITCODE -eq 0)
}

if (Test-Signed -Target $installer.FullName) {
    Write-Warning "$($installer.Name) is already signed."
} else {
    Invoke-Sign -Target $installer.FullName -Purpose "installer"
}

if (Test-Signed -Target "$PSScriptRoot\dist\SECTalk.exe") {
    Write-Warning "dist\SECTalk.exe is already signed."
} else {
    Invoke-Sign -Target "$PSScriptRoot\dist\SECTalk.exe" -Purpose "launcher"
}

Write-Host ""
Write-Host "Verifying signatures:"
& $SignToolPath verify /pa /v $installer.FullName
& $SignToolPath verify /pa /v "$PSScriptRoot\dist\SECTalk.exe"
Write-Host ""
Write-Host "Done. Files signed successfully." -ForegroundColor Green