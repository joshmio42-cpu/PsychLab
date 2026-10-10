import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const live=fileURLToPath(new URL('../',import.meta.url));
const {version}=JSON.parse(readFileSync(new URL('../runtime-lock.json',import.meta.url),'utf8'));
const runtimeInstalled=existsSync(new URL(`../.runtime/node-v${version}-win-x64/node.exe`,import.meta.url))||existsSync(new URL(`../.runtime/node-v${version}-win-arm64/node.exe`,import.meta.url));
test('production launcher disables inherited debug and TLS bypass settings then restores caller state',{skip:process.platform!=='win32'||!runtimeInstalled},()=>{
  // Mock the occupied-port probe to exercise startup without starting/stopping a server.
  const script=String.raw`
    $ErrorActionPreference = 'Stop'
    $global:taskProbeCalled = $false
    function Get-NetTCPConnection {
      param($LocalPort, $State, $ErrorAction)
      if ($env:NODE_ENV -ne 'production' -or $env:NODE_OPTIONS -or $env:NODE_DEBUG -or $env:NODE_DEBUG_NATIVE -or $env:NODE_TLS_REJECT_UNAUTHORIZED) { throw 'Unsafe child process environment.' }
      $global:taskProbeCalled = $true
      return [pscustomobject]@{LocalPort=$LocalPort}
    }
    & .\Start-PsychLab.ps1
    if (-not $global:taskProbeCalled) { throw 'Expected startup environment check.' }
    if ($env:NODE_ENV -ne 'development' -or $env:NODE_OPTIONS -ne '--inspect=0' -or $env:NODE_DEBUG -ne 'http' -or $env:NODE_DEBUG_NATIVE -ne 'http' -or $env:NODE_TLS_REJECT_UNAUTHORIZED -ne '0') { throw 'Caller environment was not restored.' }
    if ($env:FEATHERLESS_API_KEY -ne 'test-only-dummy-key' -or $env:FEATHERLESS_MODEL -ne 'test-only-model') { throw 'Caller credential environment was not restored.' }
  `;
  const env={...process.env,NODE_ENV:'development',NODE_OPTIONS:'--inspect=0',NODE_DEBUG:'http',NODE_DEBUG_NATIVE:'http',NODE_TLS_REJECT_UNAUTHORIZED:'0',FEATHERLESS_API_KEY:'test-only-dummy-key',FEATHERLESS_MODEL:'test-only-model',PSYCHLAB_PORT:'18771'};
  // Windows PowerShell must discover its own modules when tests run under pwsh 7.
  for(const key of Object.keys(env))if(key.toLowerCase()==='psmodulepath')delete env[key];
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
    cwd:live,encoding:'utf8',timeout:20000,windowsHide:true,
    env
  });
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
});
