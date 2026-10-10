param(
    [ValidateSet('check','upload','estimate','run','status','download')][string]$Action = 'check',
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,60}$')][string]$Label = 'pilot-25',
    [double]$MaxCredits = -1
)
$ErrorActionPreference = 'Stop'
$taskCredentialPath = Join-Path $env:LOCALAPPDATA 'PsychLab/adaption.credential.xml'
$taskOriginalKey = $env:ADAPTION_API_KEY
$taskOriginalNodeEnvironment = $env:NODE_ENV
$taskOriginalNodeOptions = $env:NODE_OPTIONS
$taskOriginalNodeDebug = $env:NODE_DEBUG
$taskOriginalNodeDebugNative = $env:NODE_DEBUG_NATIVE
$taskOriginalTlsVerification = $env:NODE_TLS_REJECT_UNAUTHORIZED
$taskCredential = $null
try {
    $env:NODE_ENV = 'production'
    $env:NODE_OPTIONS = $null
    $env:NODE_DEBUG = $null
    $env:NODE_DEBUG_NATIVE = $null
    $env:NODE_TLS_REJECT_UNAUTHORIZED = $null
    if ([string]::IsNullOrWhiteSpace($env:ADAPTION_API_KEY)) {
        if (-not (Test-Path -LiteralPath $taskCredentialPath)) { throw 'No saved Adaption key. Save the key for this Windows account first.' }
        try { $taskCredential = Import-Clixml -LiteralPath $taskCredentialPath }
        catch { throw 'The saved Adaption key could not be decrypted on this Windows account.' }
        if ($taskCredential -isnot [System.Management.Automation.PSCredential] -or $taskCredential.Password.Length -eq 0) { throw 'Invalid saved Adaption credential.' }
        $env:ADAPTION_API_KEY = $taskCredential.GetNetworkCredential().Password
    }
    $taskLiveRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../live'))
    $taskRuntimeLock = Get-Content -LiteralPath (Join-Path $taskLiveRoot 'runtime-lock.json') -Raw | ConvertFrom-Json
    $taskArchitecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
    $taskVersion = [string]$taskRuntimeLock.version
    $taskExpectedHash = [string]$taskRuntimeLock.windows.$taskArchitecture
    if ($taskVersion -notmatch '^24\.\d+\.\d+$' -or $taskExpectedHash -notmatch '^[a-f0-9]{64}$') { throw 'Invalid pinned runtime configuration.' }
    $taskNodePath = Join-Path $taskLiveRoot ".runtime/node-v$taskVersion-win-$taskArchitecture/node.exe"
    if (Test-Path -LiteralPath $taskNodePath) {
        if ((Get-FileHash -LiteralPath $taskNodePath -Algorithm SHA256).Hash -ne $taskExpectedHash) { throw 'The project runtime does not match its pinned checksum.' }
    } else {
        $taskNode = Get-Command node -ErrorAction SilentlyContinue
        if (-not $taskNode) { throw 'Install Node 24.21.0 LTS or run live/Install-PsychLabRuntime.ps1 first.' }
        $taskNodePath = $taskNode.Source
    }
    $taskActualVersion = & $taskNodePath --version
    if ($taskActualVersion -notmatch '^v24\.(\d+)\.(\d+)$' -or [int]$Matches[1] -lt 21) { throw 'Use Node 24.21.0 or a newer Node 24 LTS patch.' }
    $taskArguments = @((Join-Path $PSScriptRoot 'workflow.mjs'), $Action, '--label', $Label)
    if ($MaxCredits -ge 0) { $taskArguments += @('--max-credits', $MaxCredits.ToString([Globalization.CultureInfo]::InvariantCulture)) }
    & $taskNodePath --disable-sigusr1 @taskArguments
    if ($LASTEXITCODE -ne 0) { throw 'Adaption operation stopped. See the safe status message above.' }
} finally {
    $env:ADAPTION_API_KEY = $taskOriginalKey
    $env:NODE_ENV = $taskOriginalNodeEnvironment
    $env:NODE_OPTIONS = $taskOriginalNodeOptions
    $env:NODE_DEBUG = $taskOriginalNodeDebug
    $env:NODE_DEBUG_NATIVE = $taskOriginalNodeDebugNative
    $env:NODE_TLS_REJECT_UNAUTHORIZED = $taskOriginalTlsVerification
    if ($taskCredential -is [System.Management.Automation.PSCredential]) { $taskCredential.Password.Dispose() }
}
