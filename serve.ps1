# Servidor do site + API do painel (dados em .\data)
$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot

function Import-DotEnv {
  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { return }
  Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($key, $val, 'Process')
  }
}

Import-DotEnv
$Port = 8780
if ($env:PORT) { $Port = [int]$env:PORT }
$Prefix = "http://127.0.0.1:$Port/"
$DataDir = Join-Path $Root 'data'
$StudioFile = Join-Path $DataDir 'studio.json'
$UsersFile = Join-Path $DataDir 'users.json'
$SecretFile = Join-Path $DataDir 'session.secret'
$CookieName = 'pratique_session'

Add-Type -AssemblyName System.Web.Extensions | Out-Null

function Get-IsoDay([datetime]$d) {
  $d.ToString('yyyy-MM-dd')
}

function New-SeedStudio {
  $today = Get-Date
  $monthStart = Get-IsoDay (Get-Date -Year $today.Year -Month $today.Month -Day 1)
  $lastMonth = Get-IsoDay ((Get-Date -Year $today.Year -Month $today.Month -Day 1).AddMonths(-1).AddDays(11))
  $dow = [int]$today.DayOfWeek
  if ($dow -eq 0) { $dow = 7 }
  $weekStart = $today.Date.AddDays(1 - $dow)

  $studio = @{
    instructors = @(
      @{ id = 'ins_bia'; name = 'Bia'; role = 'Dona e instrutora'; specialties = 'Clássico, reformer e solo' }
      @{ id = 'ins_alex'; name = 'Alex'; role = 'Instrutor'; specialties = 'Reformer, terapêutico e reabilitação' }
    )
    plans = @()
    classPrice = 80
    clients = @(
      @{ id = 'cli_camila'; name = 'Camila Souza'; email = 'camila.souza@email.com'; phone = '(11) 98811-2200'; instructorId = 'ins_bia'; status = 'ativo'; notes = 'Lombar sensível.'; startedAt = '2026-03-10' }
      @{ id = 'cli_pedro'; name = 'Pedro Lima'; email = 'pedro.lima@email.com'; phone = '(11) 97700-4411'; instructorId = 'ins_alex'; status = 'ativo'; notes = 'Corredor.'; startedAt = '2026-01-20' }
      @{ id = 'cli_helena'; name = 'Helena Martins'; email = 'helena.martins@email.com'; phone = '(11) 99123-8877'; instructorId = 'ins_bia'; status = 'ativo'; notes = 'Gestante.'; startedAt = '2026-05-04' }
      @{ id = 'cli_joao'; name = 'João Ribeiro'; email = 'joao.ribeiro@email.com'; phone = '(11) 96544-1122'; instructorId = 'ins_bia'; status = 'ativo'; notes = 'Iniciante.'; startedAt = '2026-07-01' }
      @{ id = 'cli_ana'; name = 'Ana Beatriz Nunes'; email = 'ana.nunes@email.com'; phone = '(11) 98400-3399'; instructorId = 'ins_alex'; status = 'ativo'; notes = 'Pós-cirurgia de joelho.'; startedAt = '2026-04-15' }
      @{ id = 'cli_lucia'; name = 'Lúcia Ferreira'; email = 'lucia.ferreira@email.com'; phone = '(11) 97211-5566'; instructorId = 'ins_bia'; status = 'cancelado'; notes = 'Mudou de cidade.'; startedAt = '2025-11-02'; canceledAt = '2026-08-12'; cancelReason = 'Mudança para o interior' }
    )
    appointments = @(
      @{ id = 'apt_1'; clientId = 'cli_camila'; instructorId = 'ins_bia'; date = (Get-IsoDay $weekStart); time = '07:00'; modality = 'Reformer'; status = 'agendado' }
      @{ id = 'apt_2'; clientId = 'cli_pedro'; instructorId = 'ins_bia'; date = (Get-IsoDay $weekStart); time = '07:00'; modality = 'Reformer'; status = 'agendado' }
      @{ id = 'apt_3'; clientId = 'cli_joao'; instructorId = 'ins_alex'; date = (Get-IsoDay $weekStart); time = '08:00'; modality = 'Solo'; status = 'agendado' }
      @{ id = 'apt_4'; clientId = 'cli_helena'; instructorId = 'ins_bia'; date = (Get-IsoDay $weekStart.AddDays(1)); time = '18:00'; modality = 'Pré-natal'; status = 'agendado' }
      @{ id = 'apt_5'; clientId = 'cli_ana'; instructorId = 'ins_alex'; date = (Get-IsoDay $weekStart.AddDays(1)); time = '08:00'; modality = 'Terapêutico'; status = 'agendado' }
      @{ id = 'apt_6'; clientId = 'cli_camila'; instructorId = 'ins_bia'; date = (Get-IsoDay $weekStart.AddDays(2)); time = '19:00'; modality = 'Reformer'; status = 'agendado' }
      @{ id = 'apt_7'; clientId = 'cli_pedro'; instructorId = 'ins_alex'; date = (Get-IsoDay $weekStart.AddDays(3)); time = '12:00'; modality = 'Reformer'; status = 'agendado' }
      @{ id = 'apt_8'; clientId = 'cli_joao'; instructorId = 'ins_bia'; date = (Get-IsoDay $weekStart.AddDays(4)); time = '18:00'; modality = 'Solo'; status = 'agendado' }
    )
    transactions = @(
      @{ id = 'fin_1'; type = 'receita'; category = 'Aula'; description = 'Aula · Camila Souza'; amount = 80; date = $monthStart; status = 'pago'; clientId = 'cli_camila' }
      @{ id = 'fin_2'; type = 'receita'; category = 'Aula'; description = 'Aula · Pedro Lima'; amount = 80; date = $monthStart; status = 'pago'; clientId = 'cli_pedro' }
      @{ id = 'fin_3'; type = 'receita'; category = 'Aula'; description = 'Aula · Helena Martins'; amount = 80; date = $monthStart; status = 'pendente'; clientId = 'cli_helena' }
      @{ id = 'fin_4'; type = 'receita'; category = 'Aula'; description = 'Aula · João Ribeiro'; amount = 80; date = $monthStart; status = 'atrasado'; clientId = 'cli_joao' }
      @{ id = 'fin_5'; type = 'receita'; category = 'Aula'; description = 'Aula · Ana Beatriz Nunes'; amount = 80; date = $monthStart; status = 'pago'; clientId = 'cli_ana' }
      @{ id = 'fin_6'; type = 'despesa'; category = 'Aluguel'; description = 'Aluguel'; amount = 7800; date = $monthStart; status = 'pago' }
      @{ id = 'fin_7'; type = 'despesa'; category = 'Folha'; description = 'Instrutores'; amount = 4200; date = $monthStart; status = 'pago' }
      @{ id = 'fin_8'; type = 'despesa'; category = 'Material'; description = 'Faixas e bolas'; amount = 340; date = $lastMonth; status = 'pago' }
    )
    modalities = @(
      @{ id = 'mod_solo'; name = 'Solo'; capacity = 6; duration = 50; active = $true }
      @{ id = 'mod_reformer'; name = 'Reformer'; capacity = 4; duration = 50; active = $true }
      @{ id = 'mod_terapeutico'; name = 'Terapêutico'; capacity = 2; duration = 45; active = $true }
      @{ id = 'mod_prenatal'; name = 'Pré-natal'; capacity = 4; duration = 45; active = $true }
    )
    times = @('07:00', '08:00', '09:00', '12:00', '18:00', '19:00')
  }
  return ($studio | ConvertTo-Json -Depth 20 -Compress)
}

function Get-JsSer {
  $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $js.MaxJsonLength = 50MB
  $js
}

function Get-PasswordHash([string]$password, [byte[]]$salt) {
  $derive = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password, $salt, 100000)
  [Convert]::ToBase64String($derive.GetBytes(32))
}

function New-SaltBytes {
  $salt = New-Object byte[] 16
  $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  $rng.GetBytes($salt)
  $rng.Dispose()
  $salt
}

function Get-Secret {
  if ($env:SESSION_SECRET) { return $env:SESSION_SECRET }
  if (-not (Test-Path $SecretFile)) {
    [IO.File]::WriteAllText($SecretFile, [Convert]::ToBase64String((New-SaltBytes)) + [Convert]::ToBase64String((New-SaltBytes)))
  }
  [IO.File]::ReadAllText($SecretFile).Trim()
}

function Test-PublicPath([string]$rel) {
  $norm = $rel.Replace('\', '/').TrimStart('/').ToLowerInvariant()
  if ($norm -eq 'data' -or $norm.StartsWith('data/')) { return $false }
  if ($norm.StartsWith('.env') -or $norm.StartsWith('.git')) { return $false }
  if ($norm.StartsWith('lib/') -or $norm -eq 'lib') { return $false }
  if ($norm.EndsWith('.ps1') -or $norm.EndsWith('.sql')) { return $false }
  if ($norm -eq 'package.json' -or $norm -eq 'package-lock.json' -or $norm -eq 'vercel.json') { return $false }
  if ($norm -eq 'admin.html' -or $norm -eq 'painel') { return $false }
  $true
}

function Get-AccessKey {
  if ($env:ADMIN_ACCESS_KEY) { return $env:ADMIN_ACCESS_KEY.Trim() }
  $keyFile = Join-Path $DataDir 'access.key'
  if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
  if (-not (Test-Path $keyFile)) {
    $raw = [Convert]::ToBase64String((New-SaltBytes)).Replace('+', '').Replace('/', '').Replace('=', '')
    if ($raw.Length -gt 18) { $raw = $raw.Substring(0, 18) }
    [IO.File]::WriteAllText($keyFile, $raw, (New-Object Text.UTF8Encoding $false))
  }
  [IO.File]::ReadAllText($keyFile).Trim()
}

function Test-SecretEqual([string]$a, [string]$b) {
  if ([string]::IsNullOrEmpty($a) -or [string]::IsNullOrEmpty($b)) { return $false }
  $ba = [Text.Encoding]::UTF8.GetBytes($a)
  $bb = [Text.Encoding]::UTF8.GetBytes($b)
  if ($ba.Length -ne $bb.Length) { return $false }
  $diff = 0
  for ($i = 0; $i -lt $ba.Length; $i++) { $diff = $diff -bor ($ba[$i] -bxor $bb[$i]) }
  $diff -eq 0
}

function New-GateToken([string]$accessKey) {
  $exp = (Get-UnixMs) + (30 * 24 * 60 * 60 * 1000)
  $payloadJson = '{"g":1,"x":' + $exp + '}'
  $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payloadJson)).TrimEnd('=').Replace('+','-').Replace('/','_')
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes((Get-Secret) + ':' + $accessKey)
  $sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString('x2') })
  "$payload.$sig"
}

function Test-GateCookie($Req, [string]$accessKey) {
  $token = Get-CookieValue $Req 'pratique_gate'
  if (-not $token -or -not $token.Contains('.')) { return $false }
  $parts = $token.Split('.', 2)
  $payload = $parts[0]
  $sig = $parts[1]
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes((Get-Secret) + ':' + $accessKey)
  $expected = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString('x2') })
  if ($sig -ne $expected) { return $false }
  $pad = 4 - ($payload.Length % 4)
  if ($pad -ne 4) { $payload = $payload + ('=' * $pad) }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-','+').Replace('_','/')))
  $obj = (Get-JsSer).DeserializeObject($json)
  if (-not $obj.ContainsKey('g')) { return $false }
  ([int]$obj['g'] -eq 1) -and ([int64]$obj['x'] -ge (Get-UnixMs))
}

function Send-NotFoundPage($Res) {
  $Res.StatusCode = 404
  $Res.Headers.Add('X-Robots-Tag', 'noindex')
  $notFound = Join-Path $Root '404.html'
  if (Test-Path $notFound) {
    $bytes = [IO.File]::ReadAllBytes($notFound)
    $Res.ContentType = 'text/html; charset=utf-8'
  } else {
    $bytes = [Text.Encoding]::UTF8.GetBytes('Não encontrado.')
    $Res.ContentType = 'text/plain; charset=utf-8'
  }
  $Res.ContentLength64 = $bytes.Length
  $Res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-AdminPage($Req, $Res) {
  $key = Get-AccessKey
  $offered = [string]$Req.QueryString['k']
  if (-not $offered) { $offered = [string]$Req.QueryString['acesso'] }
  $ok = (Test-SecretEqual $offered $key) -or (Test-GateCookie $Req $key)
  if (-not $ok) {
    Send-NotFoundPage $Res
    return
  }
  $admin = Join-Path $Root 'admin.html'
  if (Test-SecretEqual $offered $key) {
    $token = New-GateToken $key
    $Res.Headers.Add('Set-Cookie', "pratique_gate=$([Uri]::EscapeDataString($token)); Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000")
  }
  $Res.Headers.Add('X-Robots-Tag', 'noindex, nofollow')
  $Res.Headers.Add('Cache-Control', 'no-store')
  Send-File $Res $admin
}

function Initialize-Store {
  if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir | Out-Null }
  $email = 'bia@pratiquepilates.com'
  if ($env:ADMIN_EMAIL) { $email = $env:ADMIN_EMAIL.ToLower() }
  $password = $env:ADMIN_PASSWORD
  if (-not (Test-Path $UsersFile)) {
    if (-not $password) {
      throw 'Defina ADMIN_PASSWORD no arquivo .env (não use senha de teste no código).'
    }
    $salt = New-SaltBytes
    $hash = Get-PasswordHash $password $salt
    $saltB64 = [Convert]::ToBase64String($salt)
    $users = @(
      @{ email = $email; name = 'Bia'; role = 'admin'; passwordHash = $hash; salt = $saltB64 }
      @{ email = 'admin@pratiquepilates.com'; name = 'Bia'; role = 'admin'; passwordHash = $hash; salt = $saltB64 }
    )
    [IO.File]::WriteAllText($UsersFile, ($users | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))
  }
  Ensure-AlexUser
  if (-not (Test-Path $StudioFile)) {
    [IO.File]::WriteAllText($StudioFile, (New-SeedStudio), (New-Object Text.UTF8Encoding $false))
  }
}

function Read-BodyText($Req) {
  $ms = New-Object IO.MemoryStream
  $Req.InputStream.CopyTo($ms)
  $bytes = $ms.ToArray()
  if ($bytes.Length -eq 0) { return '' }
  [Text.Encoding]::UTF8.GetString($bytes)
}

function Send-Json($Res, [int]$Status, $Obj, [string]$SetCookie = $null) {
  $json = if ($Obj -is [string]) { $Obj } else { (Get-JsSer).Serialize($Obj) }
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $Res.StatusCode = $Status
  $Res.ContentType = 'application/json; charset=utf-8'
  $Res.ContentLength64 = $bytes.Length
  if ($SetCookie) { $Res.Headers.Add('Set-Cookie', $SetCookie) }
  $Res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Get-CookieValue($Req, [string]$Name) {
  $header = $Req.Headers['Cookie']
  if (-not $header) { return '' }
  foreach ($part in $header.Split(';')) {
    $kv = $part.Trim()
    if ($kv.StartsWith("$Name=")) {
      return [Uri]::UnescapeDataString($kv.Substring($Name.Length + 1))
    }
  }
  ''
}

function Get-UnixMs {
  [int64]((Get-Date).ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds
}

function New-SessionToken([string]$email) {
  $exp = (Get-UnixMs) + (7 * 24 * 60 * 60 * 1000)
  $payloadJson = '{"e":"' + $email.Replace('\','\\').Replace('"','\"') + '","x":' + $exp + '}'
  $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($payloadJson)).TrimEnd('=').Replace('+','-').Replace('/','_')
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes((Get-Secret))
  $sig = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString('x2') })
  "$payload.$sig"
}

function Read-SessionEmail($Req) {
  $token = Get-CookieValue $Req $CookieName
  if (-not $token -or -not $token.Contains('.')) { return $null }
  $parts = $token.Split('.', 2)
  $payload = $parts[0]
  $sig = $parts[1]
  $hmac = New-Object System.Security.Cryptography.HMACSHA256
  $hmac.Key = [Text.Encoding]::UTF8.GetBytes((Get-Secret))
  $expected = -join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payload)) | ForEach-Object { $_.ToString('x2') })
  if ($sig -ne $expected) { return $null }
  $pad = 4 - ($payload.Length % 4)
  if ($pad -ne 4) { $payload = $payload + ('=' * $pad) }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload.Replace('-','+').Replace('_','/')))
  $obj = (Get-JsSer).DeserializeObject($json)
  if (-not $obj.ContainsKey('e')) { return $null }
  $exp = [int64]$obj['x']
  $now = Get-UnixMs
  if ($exp -lt $now) { return $null }
  [string]$obj['e']
}

function Test-IsOwnerInstructor($i) {
  $id = [string]$i['id']
  $name = [string]$i['name']
  $role = [string]$i['role']
  return ($id -eq 'ins_bia') -or ($name -eq 'Bia') -or ($role -match 'Dona')
}

function Test-IsOwnInstructor($i, $auth) {
  $id = [string]$i['id']
  $name = [string]$i['name']
  return ($id -eq 'ins_alex') -or ($name -eq [string]$auth['name'])
}

function Ensure-AlexUser {
  if (-not (Test-Path $UsersFile)) { return }
  $email = 'alex@pratiquepilates.com'
  if ($env:ALEX_EMAIL) { $email = $env:ALEX_EMAIL.ToLower() }
  $password = $env:ALEX_PASSWORD
  $users = (Get-JsSer).DeserializeObject([IO.File]::ReadAllText($UsersFile))
  foreach ($u in $users) {
    if ([string]$u['email'] -eq $email) { return }
  }
  if (-not $password) { return }
  $salt = New-SaltBytes
  $hash = Get-PasswordHash $password $salt
  $list = New-Object System.Collections.ArrayList
  foreach ($u in $users) { [void]$list.Add($u) }
  [void]$list.Add(@{
    email = $email
    name = 'Alex'
    role = 'staff'
    passwordHash = $hash
    salt = [Convert]::ToBase64String($salt)
  })
  [IO.File]::WriteAllText($UsersFile, ($list | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding $false))
}

function Studio-ForClient($auth, [string]$raw) {
  if ([string]$auth['role'] -ne 'staff') { return $raw }
  $obj = (Get-JsSer).DeserializeObject($raw)
  $obj['transactions'] = @()
  return (Get-JsSer).Serialize($obj)
}

function Protect-IncomingStudio($auth, $incoming) {
  if ([string]$auth['role'] -ne 'staff') { return $incoming }
  $current = (Get-JsSer).DeserializeObject([IO.File]::ReadAllText($StudioFile))
  $incoming['transactions'] = $current['transactions']
  $currIns = @($current['instructors'])
  $inIns = @($incoming['instructors'])
  $locked = New-Object System.Collections.ArrayList
  foreach ($prev in $currIns) {
    if (Test-IsOwnerInstructor $prev) {
      [void]$locked.Add($prev)
      continue
    }
    $id = [string]$prev['id']
    $patch = $null
    foreach ($x in $inIns) {
      if ([string]$x['id'] -eq $id) { $patch = $x; break }
    }
    if ((Test-IsOwnInstructor $prev $auth) -and $patch) {
      $prev['name'] = [string]$patch['name']
      $prev['role'] = [string]$patch['role']
      $prev['specialties'] = [string]$patch['specialties']
    }
    [void]$locked.Add($prev)
  }
  $incoming['instructors'] = $locked
  return $incoming
}

function Find-User([string]$email) {
  $key = $email.Trim().ToLower()
  $users = (Get-JsSer).DeserializeObject([IO.File]::ReadAllText($UsersFile))
  foreach ($u in $users) {
    if ([string]$u['email'] -eq $key) { return $u }
  }
  $null
}

function Get-AuthUser($Req) {
  $email = Read-SessionEmail $Req
  if (-not $email) { return $null }
  $u = Find-User $email
  if (-not $u) { return $null }
  @{ name = [string]$u['name']; email = [string]$u['email']; role = [string]$u['role'] }
}

function Send-File($Res, $Path) {
  $ext = [IO.Path]::GetExtension($Path).ToLower()
  $ctype = switch ($ext) {
    '.html' { 'text/html; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.js'   { 'text/javascript; charset=utf-8' }
    '.png'  { 'image/png' }
    '.jpg'  { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.svg'  { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
  $bytes = [IO.File]::ReadAllBytes($Path)
  $Res.StatusCode = 200
  $Res.ContentType = $ctype
  $Res.ContentLength64 = $bytes.Length
  $Res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Handle-Api($Req, $Res) {
  $path = $Req.Url.AbsolutePath.TrimEnd('/')
  $method = $Req.HttpMethod
  $cookieOut = $null

  if ($path -eq '/api/login' -and $method -eq 'POST') {
    $body = (Get-JsSer).DeserializeObject((Read-BodyText $Req))
    $email = ''
    $password = ''
    if ($body) {
      $email = [string]$body['email']
      $password = [string]$body['password']
    }
    $user = Find-User $email
    $ok = $false
    if ($user) {
      $salt = [Convert]::FromBase64String([string]$user['salt'])
      $ok = (Get-PasswordHash $password $salt) -eq [string]$user['passwordHash']
    }
    if (-not $ok) {
      Send-Json $Res 401 @{ error = 'E-mail ou senha incorretos.' }
      return
    }
    $token = New-SessionToken ([string]$user['email'])
    $cookieOut = "$CookieName=$([Uri]::EscapeDataString($token)); Path=/; HttpOnly; SameSite=Lax; Max-Age=604800"
    Send-Json $Res 200 @{ user = @{ name = [string]$user['name']; email = [string]$user['email']; role = [string]$user['role'] } } $cookieOut
    return
  }

  if ($path -eq '/api/logout' -and $method -eq 'POST') {
    Send-Json $Res 200 @{ ok = $true } "$CookieName=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    return
  }

  $auth = Get-AuthUser $Req
  if (-not $auth) {
    Send-Json $Res 401 @{ error = 'Faça login.' }
    return
  }

  if ($path -eq '/api/me' -and $method -eq 'GET') {
    Send-Json $Res 200 @{ user = $auth }
    return
  }

  if ($path -eq '/api/studio' -and $method -eq 'GET') {
    $raw = [IO.File]::ReadAllText($StudioFile)
    $safe = Studio-ForClient $auth $raw
    Send-Json $Res 200 ("{`"studio`":$safe}")
    return
  }

  if ($path -eq '/api/studio' -and $method -eq 'PUT') {
    $parsed = (Get-JsSer).DeserializeObject((Read-BodyText $Req))
    if (-not $parsed -or -not $parsed.ContainsKey('studio')) {
      Send-Json $Res 400 @{ error = 'Dados inválidos.' }
      return
    }
    $studio = Protect-IncomingStudio $auth $parsed['studio']
    $studioJson = (Get-JsSer).Serialize($studio)
    [IO.File]::WriteAllText($StudioFile, $studioJson, (New-Object Text.UTF8Encoding $false))
    Send-Json $Res 200 @{ ok = $true }
    return
  }

  Send-Json $Res 404 @{ error = 'Não encontrado.' }
}

Initialize-Store
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)
try {
  $listener.Start()
} catch {
  Write-Host "A porta $Port está ocupada. Feche o servidor anterior e tente de novo."
  throw
}
Write-Host "Site: ${Prefix}"
Write-Host ("Painel (guarde este link): {0}admin.html?k={1}" -f $Prefix, (Get-AccessKey))

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      $pathNorm = $path.TrimEnd('/').ToLowerInvariant()
      if ($pathNorm -eq '/admin.html' -or $pathNorm -eq '/painel') {
        Handle-AdminPage $req $res
      } elseif ($path.StartsWith('/api/')) {
        Handle-Api $req $res
      } else {
        $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
        $rootFull = [IO.Path]::GetFullPath($Root)
        if (-not $rootFull.EndsWith([IO.Path]::DirectorySeparatorChar)) {
          $rootFull += [IO.Path]::DirectorySeparatorChar
        }
        $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
        if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
          $res.StatusCode = 403
        } elseif (-not (Test-PublicPath $rel)) {
          $res.StatusCode = 404
          $bytes = [Text.Encoding]::UTF8.GetBytes('Não encontrado.')
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } elseif (Test-Path $full -PathType Leaf) {
          Send-File $res $full
        } else {
          $res.StatusCode = 404
          $bytes = [Text.Encoding]::UTF8.GetBytes('Não encontrado.')
          $res.OutputStream.Write($bytes, 0, $bytes.Length)
        }
      }
    } catch {
      try {
        Send-Json $res 500 @{ error = $_.Exception.Message }
      } catch {}
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
