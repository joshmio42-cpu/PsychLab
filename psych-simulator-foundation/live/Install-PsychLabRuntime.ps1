# Install only this project's pinned Node binary; do not change PATH or a running server.
param()
$ErrorActionPreference = 'Stop'
$taskRuntimeLock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-lock.json') -Raw | ConvertFrom-Json
$taskArchitecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
$taskVersion = [string]$taskRuntimeLock.version
$taskExpectedHash = [string]$taskRuntimeLock.windows.$taskArchitecture
if ($taskVersion -notmatch '^24\.\d+\.\d+$' -or $taskExpectedHash -notmatch '^[a-f0-9]{64}$') { throw 'Invalid pinned runtime configuration.' }
$taskRuntimeRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.runtime'))
$taskRuntimeDirectory = Join-Path $taskRuntimeRoot "node-v$taskVersion-win-$taskArchitecture"
$taskRuntimePath = Join-Path $taskRuntimeDirectory 'node.exe'
if (Test-Path -LiteralPath $taskRuntimePath) {
    if ((Get-FileHash -LiteralPath $taskRuntimePath -Algorithm SHA256).Hash -ne $taskExpectedHash) { throw 'The existing project runtime does not match its pinned checksum.' }
    Write-Host "Verified project Node $taskVersion is already installed."
    return
}
[IO.Directory]::CreateDirectory($taskRuntimeDirectory) | Out-Null
$taskDownloadPath = Join-Path $taskRuntimeDirectory ([IO.Path]::GetRandomFileName())
try {
    Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$taskVersion/win-$taskArchitecture/node.exe" -OutFile $taskDownloadPath -MaximumRedirection 0 -TimeoutSec 120
    if ((Get-FileHash -LiteralPath $taskDownloadPath -Algorithm SHA256).Hash -ne $taskExpectedHash) { throw 'Node download checksum verification failed.' }
    $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskDownloadPath
    if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'CN=OpenJS Foundation(?:,|$)') { throw 'Node download publisher verification failed.' }
    Move-Item -LiteralPath $taskDownloadPath -Destination $taskRuntimePath
    Write-Host "Installed verified Node $taskVersion for PsychLab. It will be used on the next launch."
} finally {
    if (Test-Path -LiteralPath $taskDownloadPath) { Remove-Item -LiteralPath $taskDownloadPath }
}
