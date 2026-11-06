$ErrorActionPreference = 'Stop'
$frontendPath = Split-Path -Parent $PSScriptRoot
$auditPath = Join-Path $env:TEMP 'networth-twilio-audit'
New-Item -ItemType Directory -Force -Path $auditPath | Out-Null
Push-Location -LiteralPath $auditPath
try {
    railway link --project 325bab1a-8ede-4c26-a00f-1183ed99846c --environment production --service cef79ba4-7f7b-497a-8df9-7d3609a63e15 --json | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Railway connection failed' }
    $workflowVariables = railway variables --json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot load messaging configuration' }
} finally { Pop-Location }
$keys = @('TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_VERIFY_SERVICE_SID','TWILIO_WHATSAPP_NUMBER','ADMIN_WHATSAPP_NUMBER','TWILIO_CONTENT_SID_WELCOME','TWILIO_CONTENT_SID_LEAD_ALERT','TWILIO_CONTENT_SID_RECOMMENDATIONS')
$previous = @{}
try {
    foreach ($key in $keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        if (-not $workflowVariables.$key) { throw "Missing messaging setting: $key" }
        [Environment]::SetEnvironmentVariable($key, $workflowVariables.$key, 'Process')
    }
    Push-Location -LiteralPath $frontendPath
    try { node node_modules/vite/bin/vite.js --config vite.sandbox.config.mjs } finally { Pop-Location }
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
