param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9][a-z0-9-]{0,60}$')][string]$Label,
    [string]$CaseIds = ''
)
$ErrorActionPreference = 'Stop'
$taskCredential = Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'PsychLab/featherless.credential.xml')
$taskSavedKey = $env:FEATHERLESS_API_KEY
$taskSavedModel = $env:FEATHERLESS_MODEL
try {
    $env:FEATHERLESS_API_KEY = $taskCredential.GetNetworkCredential().Password
    $env:FEATHERLESS_MODEL = 'Qwen/Qwen2.5-72B-Instruct'
    $taskArguments = @((Join-Path $PSScriptRoot 'run-full-conversation-evaluation.mjs'), '--live', '--label', $Label)
    if ($CaseIds) { $taskArguments += @('--ids', $CaseIds) }
    & node @taskArguments
    if ($LASTEXITCODE -ne 0) { throw 'Live evaluation did not finish successfully; inspect the preserved partial evidence.' }
} finally {
    $env:FEATHERLESS_API_KEY = $taskSavedKey
    $env:FEATHERLESS_MODEL = $taskSavedModel
    $taskCredential.Password.Dispose()
}
