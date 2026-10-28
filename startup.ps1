param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2
  if ($response.Content.Contains('MARBLE ATELIER')) { exit 0 }
  throw "The requested port is serving another project. Set APP_PORT to a free port."
} catch {
  if ($_.Exception.Message -like '*another project*') { throw }
}
$logDir = Join-Path $PSScriptRoot '.grok'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$nodePath = (Get-Command node.exe).Source
$npmCli = Join-Path (Split-Path (Get-Command npm.cmd).Source) 'node_modules/npm/bin/npm-cli.js'
$npmArgs = @('"' + $npmCli + '"')
$npmArgs += @('run', 'dev', '--', '--port', "$Port")
Start-Process -FilePath $nodePath -ArgumentList $npmArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'dev-server-win.log') -RedirectStandardError (Join-Path $logDir 'dev-server-win-error.log') | Out-Null
