param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  [Parameter(Mandatory = $true)][string]$PublishableKey
)

$ErrorActionPreference = 'Stop'
$serviceRoleKey = $env:MIZUWATCH_TEST_SERVICE_ROLE_KEY
if (-not $serviceRoleKey) {
  throw 'MIZUWATCH_TEST_SERVICE_ROLE_KEY is required'
}

$baseUrl = "https://$ProjectRef.supabase.co"
$deviceId = [guid]::NewGuid().ToString()
$vehicleCode = 'INT_' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$tokenBytes = [byte[]]::new(32)
[Security.Cryptography.RandomNumberGenerator]::Fill($tokenBytes)
$deviceToken = [Convert]::ToHexString($tokenBytes).ToLowerInvariant()
$tokenHash = [Security.Cryptography.SHA256]::HashData(
  [Text.Encoding]::UTF8.GetBytes($deviceToken)
)
$tokenHashHex = [Convert]::ToHexString($tokenHash).ToLowerInvariant()
$testPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24)) + 'aA1!'
$testEmail = "mizuwatch-integration-$([guid]::NewGuid().ToString('N'))@example.com"
$authUserId = $null

function New-UuidV7Like {
  $hex = [guid]::NewGuid().ToString('N').ToCharArray()
  $hex[12] = '7'
  $value = -join $hex
  return "$($value.Substring(0,8))-$($value.Substring(8,4))-$($value.Substring(12,4))-$($value.Substring(16,4))-$($value.Substring(20,12))"
}

function Invoke-LinkedSql([string]$Sql) {
  $singleLineSql = ($Sql -replace '\r?\n', ' ').Trim()
  $result = & npx supabase db query --linked $singleLineSql --agent no --output-format text 2>&1
  if ($LASTEXITCODE -ne 0) { throw ($result -join [Environment]::NewLine) }
  return $result
}

try {
  $adminHeaders = @{
    apikey = $serviceRoleKey
    Authorization = "Bearer $serviceRoleKey"
    'Content-Type' = 'application/json'
  }
  $newUser = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/v1/admin/users" -Headers $adminHeaders -Body (@{
    email = $testEmail
    password = $testPassword
    email_confirm = $true
  } | ConvertTo-Json)
  $authUserId = $newUser.id
  if (-not $authUserId) { throw 'Auth test user was not created' }

  Invoke-LinkedSql @"
insert into public.devices (id, vehicle_code, display_name)
values ('$deviceId', '$vehicleCode', 'Hosted integration test');
insert into private.device_credentials (device_id, token_hash)
values ('$deviceId', decode('$tokenHashHex', 'hex'));
insert into public.user_device_access (user_id, device_id, role)
values ('$authUserId', '$deviceId', 'viewer');
"@ | Out-Null

  $messageId = New-UuidV7Like
  $batchId = New-UuidV7Like
  $observedAt = [DateTimeOffset]::UtcNow.ToString('o')
  $batchBody = @{
    schemaVersion = 1
    batchId = $batchId
    readings = @(@{
      messageId = $messageId
      observedAt = $observedAt
      latitude = 35.681236
      longitude = 139.767125
      waterTemperature = 24.8
      airPressure = 1012.4
      airTemperature = 28.4
      humidity = 61.2
    })
  } | ConvertTo-Json -Depth 5
  $deviceHeaders = @{ Authorization = "Bearer $deviceToken"; 'Content-Type' = 'application/json' }
  $first = Invoke-RestMethod -Method Post -Uri "$baseUrl/functions/v1/device-telemetry-v1" -Headers $deviceHeaders -Body $batchBody
  $second = Invoke-RestMethod -Method Post -Uri "$baseUrl/functions/v1/device-telemetry-v1" -Headers $deviceHeaders -Body $batchBody
  if ($first.accepted -ne 1 -or $first.duplicate -ne 0) { throw 'First ingestion was not accepted exactly once' }
  if ($second.accepted -ne 0 -or $second.duplicate -ne 1) { throw 'Duplicate ingestion was not detected' }

  $session = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/v1/token?grant_type=password" -Headers @{
    apikey = $PublishableKey
    'Content-Type' = 'application/json'
  } -Body (@{ email = $testEmail; password = $testPassword } | ConvertTo-Json)
  if (-not $session.access_token) { throw 'Auth session was not issued' }

  $from = [Uri]::EscapeDataString([DateTimeOffset]::UtcNow.AddHours(-1).ToString('o'))
  $to = [Uri]::EscapeDataString([DateTimeOffset]::UtcNow.AddMinutes(1).ToString('o'))
  $tracks = Invoke-RestMethod -Method Get -Uri "$baseUrl/functions/v1/tracks-v1?from=$from&to=$to&vehicleId=$vehicleCode" -Headers @{
    Authorization = "Bearer $($session.access_token)"
    apikey = $PublishableKey
    Origin = 'http://localhost:4000'
  }
  $track = $tracks.data.$vehicleCode
  if ($null -eq $track -or @($track).Count -ne 1) { throw 'Authorized tracks response did not contain the ingested reading' }
  if ($track[0].vehicleId -ne $vehicleCode) { throw 'Tracks response vehicle id did not match' }

  Write-Output "PASS project=$ProjectRef vehicle=$vehicleCode accepted=1 duplicate=1 tracks=1 rls=authorized"
}
finally {
  if ($deviceId) {
    try {
      Invoke-LinkedSql "delete from public.telemetry_readings where device_id = '$deviceId'; delete from public.devices where id = '$deviceId';" | Out-Null
    } catch { Write-Warning $_ }
  }
  if ($authUserId) {
    try { Invoke-RestMethod -Method Delete -Uri "$baseUrl/auth/v1/admin/users/$authUserId" -Headers $adminHeaders | Out-Null } catch { Write-Warning $_ }
  }
  $deviceToken = $null
  $testPassword = $null
}
