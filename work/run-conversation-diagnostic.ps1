param([string]$Model = '')
$ErrorActionPreference = 'Stop'
$taskCredential = Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'PsychLab/featherless.credential.xml')
$taskSavedKey = $env:FEATHERLESS_API_KEY
$taskSavedModel = $env:FEATHERLESS_MODEL
try {
    $env:FEATHERLESS_API_KEY = $taskCredential.GetNetworkCredential().Password
    $env:FEATHERLESS_MODEL = if ($Model) { $Model } else { $taskCredential.UserName }
    & node (Join-Path $PSScriptRoot 'diagnose-conversation.mjs')
} finally {
    $env:FEATHERLESS_API_KEY = $taskSavedKey
    $env:FEATHERLESS_MODEL = $taskSavedModel
    $taskCredential.Password.Dispose()
}
