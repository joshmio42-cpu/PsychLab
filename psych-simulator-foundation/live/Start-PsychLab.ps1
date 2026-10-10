# Saved credentials use Windows DPAPI for the current user, outside the project.
param([switch]$Configure, [switch]$Remember, [switch]$Forget)
$ErrorActionPreference = 'Stop'
$taskCredentialDirectory = Join-Path $env:LOCALAPPDATA 'PsychLab'
$taskCredentialPath = Join-Path $taskCredentialDirectory 'featherless.credential.xml'
if ($Forget) {
    if (Test-Path -LiteralPath $taskCredentialPath) { Remove-Item -LiteralPath $taskCredentialPath }
    Write-Host 'Saved Featherless configuration removed. Stop running servers to clear their in-memory key.'
    return
}
if ($Remember) { $Configure = $true }
$taskRuntimeLock = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-lock.json') -Raw | ConvertFrom-Json
$taskArchitecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
$taskVersion = [string]$taskRuntimeLock.version
$taskExpectedHash = [string]$taskRuntimeLock.windows.$taskArchitecture
if ($taskVersion -notmatch '^24\.\d+\.\d+$' -or $taskExpectedHash -notmatch '^[a-f0-9]{64}$') { throw 'Invalid pinned runtime configuration.' }
$taskNodePath = Join-Path $PSScriptRoot ".runtime/node-v$taskVersion-win-$taskArchitecture/node.exe"
if (-not (Test-Path -LiteralPath $taskNodePath)) { throw 'Run Install-PsychLabRuntime.ps1 once to install the verified project runtime.' }
if ((Get-FileHash -LiteralPath $taskNodePath -Algorithm SHA256).Hash -ne $taskExpectedHash) { throw 'The project runtime does not match its pinned checksum.' }
$taskOldKey = $env:FEATHERLESS_API_KEY
$taskOldModel = $env:FEATHERLESS_MODEL
$taskOldPort = $env:PSYCHLAB_PORT
$taskOldNodeEnvironment = $env:NODE_ENV
$taskOldNodeOptions = $env:NODE_OPTIONS
$taskOldNodeDebug = $env:NODE_DEBUG
$taskOldNodeDebugNative = $env:NODE_DEBUG_NATIVE
$taskOldTlsVerification = $env:NODE_TLS_REJECT_UNAUTHORIZED
$taskCredential = $null
try {
    # Production cannot inherit inspector, HTTP trace or heap-report settings.
    $env:NODE_ENV = 'production'
    $env:NODE_OPTIONS = $null
    $env:NODE_DEBUG = $null
    $env:NODE_DEBUG_NATIVE = $null
    $env:NODE_TLS_REJECT_UNAUTHORIZED = $null
    if ($Configure) {
        $taskPrompt = if ($Remember) { 'Featherless API key (hidden; saved encrypted for this Windows account)' } else { 'Featherless API key (hidden, not saved)' }
        $taskSecret = Read-Host $taskPrompt -AsSecureString
        $taskModel = Read-Host 'Exact Featherless model ID (Enter for Qwen/Qwen2.5-72B-Instruct)'
        if ([string]::IsNullOrWhiteSpace($taskModel)) { $taskModel = 'Qwen/Qwen2.5-72B-Instruct' }
        if ($taskSecret.Length -eq 0) { $taskSecret.Dispose(); throw 'API key cannot be empty.' }
        $taskCredential = New-Object System.Management.Automation.PSCredential($taskModel.Trim(), $taskSecret)
        if ($Remember) {
            [IO.Directory]::CreateDirectory($taskCredentialDirectory) | Out-Null
            # Replace the previous file only after encryption succeeds.
            $taskTemp = Join-Path $taskCredentialDirectory ([IO.Path]::GetRandomFileName())
            try {
                $taskCredential | Export-Clixml -LiteralPath $taskTemp
                Move-Item -LiteralPath $taskTemp -Destination $taskCredentialPath -Force
            } finally { if (Test-Path -LiteralPath $taskTemp) { Remove-Item -LiteralPath $taskTemp } }
            Write-Host 'Configuration saved encrypted for this Windows account. Future launches need no key prompt.'
        }
    } elseif ([string]::IsNullOrWhiteSpace($env:FEATHERLESS_API_KEY) -and (Test-Path -LiteralPath $taskCredentialPath)) {
        try { $taskCredential = Import-Clixml -LiteralPath $taskCredentialPath }
        catch { throw 'Saved configuration could not be decrypted. Run with -Remember to replace it on this Windows account.' }
        if ($taskCredential -isnot [System.Management.Automation.PSCredential]) { throw 'Invalid saved configuration. Run with -Remember to replace it.' }
        $taskSecret = $taskCredential.Password
        Write-Host 'Loaded saved Featherless configuration.'
    }
    if ($taskCredential) {
        $taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecret)
        try { $env:FEATHERLESS_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer); $taskSecret.Dispose() }
        $env:FEATHERLESS_MODEL = $taskCredential.UserName
    }
    if ([string]::IsNullOrWhiteSpace($env:FEATHERLESS_API_KEY) -or [string]::IsNullOrWhiteSpace($env:FEATHERLESS_MODEL)) { throw 'No complete Featherless configuration. Run Setup PsychLab.cmd once to save your key.' }
    if ([string]::IsNullOrWhiteSpace($env:PSYCHLAB_PORT)) { $env:PSYCHLAB_PORT = '8771' }
    $taskPort = 0
    if (-not [int]::TryParse($env:PSYCHLAB_PORT, [ref]$taskPort) -or $taskPort -lt 1024 -or $taskPort -gt 65535) { throw 'Invalid PSYCHLAB_PORT.' }
    if (Get-NetTCPConnection -LocalPort $taskPort -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "Port $taskPort is already in use. Open http://127.0.0.1:$taskPort/ if PsychLab is running."
        Write-Host 'If you just changed configuration, stop the old server with Ctrl+C, then run Open PsychLab.cmd.'
        return
    }
    & $taskNodePath --disable-sigusr1 (Join-Path $PSScriptRoot 'server.mjs')
} finally {
    $env:FEATHERLESS_API_KEY = $taskOldKey
    $env:FEATHERLESS_MODEL = $taskOldModel
    $env:PSYCHLAB_PORT = $taskOldPort
    $env:NODE_ENV = $taskOldNodeEnvironment
    $env:NODE_OPTIONS = $taskOldNodeOptions
    $env:NODE_DEBUG = $taskOldNodeDebug
    $env:NODE_DEBUG_NATIVE = $taskOldNodeDebugNative
    $env:NODE_TLS_REJECT_UNAUTHORIZED = $taskOldTlsVerification
}
