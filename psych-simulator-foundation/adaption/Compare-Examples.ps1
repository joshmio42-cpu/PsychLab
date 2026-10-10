param(
 [string]$Pack,
 [string]$Model,
 [ValidateSet('baseline','candidate','both')][string]$Variant='both',
 [ValidatePattern('^[a-z0-9][a-z0-9-]{0,60}$')][string]$Label='pilot-25',
 [switch]$Live,
 [switch]$Transfer,
 [switch]$Generalization,
 [switch]$ReleaseGeneralization,
 [switch]$Planned
)
$ErrorActionPreference='Stop'
$taskOldKey=$env:FEATHERLESS_API_KEY
$taskOldModel=$env:FEATHERLESS_MODEL
$taskCredential=$null
try {
 if ($Live) {
  $taskCredential=Import-Clixml -LiteralPath (Join-Path $env:LOCALAPPDATA 'PsychLab/featherless.credential.xml')
  $env:FEATHERLESS_API_KEY=$taskCredential.GetNetworkCredential().Password
  $env:FEATHERLESS_MODEL=if ($Model) { $Model } else { $taskCredential.UserName }
 }
 $taskArguments=@((Join-Path $PSScriptRoot 'evaluate.mjs'),'--variant',$Variant,'--label',$Label)
 if ($Pack) { $taskArguments+=@('--pack',(Resolve-Path -LiteralPath $Pack).Path) }
 if ($Model) { $taskArguments+=@('--model',$Model) }
 if ($Live) { $taskArguments+='--live' }
 if ($Transfer) { $taskArguments+='--transfer' }
 if ($Generalization) { $taskArguments+='--generalization' }
 if ($ReleaseGeneralization) { $taskArguments+='--release-generalization' }
 if ($Planned) { $taskArguments+='--planned' }
 & node @taskArguments
 if ($LASTEXITCODE -ne 0) { throw 'Comparison stopped. Preserve partial evidence before any deliberate new run.' }
} finally {
 $env:FEATHERLESS_API_KEY=$taskOldKey
 $env:FEATHERLESS_MODEL=$taskOldModel
 if ($taskCredential) { $taskCredential.Password.Dispose() }
}
