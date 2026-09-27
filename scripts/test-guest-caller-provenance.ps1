param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^https://')]
  [string]$StagingSupabaseUrl,
  [switch]$ConfirmStaging,
  [switch]$ConfirmPreReleaseProject,
  [switch]$TrustedIngress,
  [int]$ExpectedCallerLimit = 20
)

$ErrorActionPreference = 'Stop'
if (-not ($ConfirmStaging -or $ConfirmPreReleaseProject)) {
  throw 'Explicit staging or user-authorized pre-release project confirmation is required.'
}
$anonKey = [Environment]::GetEnvironmentVariable('SUPABASE_ANON_KEY')
if ([string]::IsNullOrWhiteSpace($anonKey)) {
  throw 'Set SUPABASE_ANON_KEY in the process environment; do not pass it on the command line.'
}
$path = if ($TrustedIngress) { '/functions/v1/guest-room-access' } else { '/rest/v1/rpc/join_room_as_guest' }
$target = [Uri]::new($StagingSupabaseUrl.TrimEnd('/') + $path)
if ($target.Host -in @('localhost', '127.0.0.1')) {
  throw 'This probe requires an explicitly named hosted staging target.'
}
if ($ExpectedCallerLimit -lt 1 -or $ExpectedCallerLimit -gt 100) {
  throw 'ExpectedCallerLimit must be between 1 and 100.'
}

$outcomes = [System.Collections.Generic.List[string]]::new()
for ($attempt = 1; $attempt -le ($ExpectedCallerLimit + 2); $attempt++) {
  $randomCode = 'PROBE-' + [Guid]::NewGuid().ToString('N')
  $arguments = @{
    join_code = $randomCode
    guest_name = 'Probe'
    guest_token = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
  }
  $body = if ($TrustedIngress) {
    @{ operation = 'join_room_as_guest'; args = $arguments } | ConvertTo-Json -Compress
  } else { $arguments | ConvertTo-Json -Compress }
  $headers = @{
    apikey = $anonKey
    'X-Forwarded-For' = "198.51.100.$(($attempt % 200) + 1)"
    'X-Real-IP' = "198.51.100.$(($attempt % 200) + 1)"
    'X-Dong-Guest-Caller' = "198.51.100.$(($attempt % 200) + 1)"
  }
  if ($anonKey.StartsWith('ey')) { $headers.Authorization = "Bearer $anonKey" }
  try {
    $result = Invoke-RestMethod -Method Post -Uri $target -Headers $headers -ContentType 'application/json' -Body $body -TimeoutSec 20
    $outcomes.Add([string]$result.code)
  } catch {
    # Never print the exception: HTTP libraries may embed headers/body.
    $outcomes.Add('transport_error')
  }
}

$limitedAt = 0
for ($i = 0; $i -lt $outcomes.Count; $i++) {
  if ($outcomes[$i] -eq 'rate_limited') { $limitedAt = $i + 1; break }
}
[pscustomobject]@{
  Probe = 'guest-caller-provenance'
  Origin = 'single hosted network; network diversity is not asserted'
  Attempts = $outcomes.Count
  FirstRateLimitedAttempt = if ($limitedAt) { $limitedAt } else { 'none' }
  ResponseCodes = ($outcomes -join ',')
  Assessment = if ($limitedAt -le $ExpectedCallerLimit -and $limitedAt -gt 0) {
    'inconclusive: prior traffic or configured threshold may have limited earlier'
  } elseif ($limitedAt -eq ($ExpectedCallerLimit + 1)) {
    'consistent with trusted caller identity; still compare two origins and gateway logs'
  } else {
    'FAIL OR INCONCLUSIVE: forged forwarding may bypass caller quota; stop release'
  }
}
