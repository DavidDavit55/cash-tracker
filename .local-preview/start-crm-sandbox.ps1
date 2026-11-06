$ErrorActionPreference = 'Stop'
$previousSandboxPort = $env:CRM_SANDBOX_PORT
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  $env:CRM_SANDBOX_PORT = '5209'
  node .local-preview/report-history-server.mjs
} finally {
  $env:CRM_SANDBOX_PORT = $previousSandboxPort
  Pop-Location
}
