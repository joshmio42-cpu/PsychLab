param([Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9-]+$')][string]$Label,[ValidatePattern('^[a-z0-9-]+$')][string]$Resume)
$ErrorActionPreference = 'Stop'
$taskCredential = Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'PsychLab/featherless.credential.xml')
$taskSavedKey = $env:FEATHERLESS_API_KEY
$taskSavedModel = $env:FEATHERLESS_MODEL
try {
    $env:FEATHERLESS_API_KEY = $taskCredential.GetNetworkCredential().Password
    $env:FEATHERLESS_MODEL = 'Qwen/Qwen2.5-72B-Instruct'
    $taskArguments = @((Join-Path $PSScriptRoot 'run-long-interview.mjs'), '--live', '--label', $Label)
    if ($Resume) { $taskArguments += @('--resume', $Resume) }
    & node @taskArguments
    if ($LASTEXITCODE -ne 0) { throw 'Live long interview did not complete; inspect preserved evidence.' }
} finally {
    $env:FEATHERLESS_API_KEY = $taskSavedKey
    $env:FEATHERLESS_MODEL = $taskSavedModel
    $taskCredential.Password.Dispose()
}
