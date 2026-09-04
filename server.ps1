# Servidor de teste do Pratique + Pilates (contas, cartão tokenizado, assinatura).
# Uso: powershell -ExecutionPolicy Bypass -File .\server.ps1
# Nunca grava número completo nem CVV.

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$DataDir = Join-Path $Root 'data'
$DbPath = Join-Path $DataDir 'db.json'
$Port = 8780
$Prefix = "http://127.0.0.1:$Port/"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

function New-Id { [guid]::NewGuid().ToString('N').Substring(0, 12) }

function New-Salt {
  $bytes = New-Object byte[] 16
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  [Convert]::ToBase64String($bytes)
}

function Get-PasswordHash([string]$Password, [string]$SaltB64) {
  $salt = [Convert]::FromBase64String($SaltB64)
  $rfc = New-Object System.Security.Cryptography.Rfc2898DeriveBytes(
    $Password, $salt, 80000, [System.Security.Cryptography.HashAlgorithmName]::SHA256
  )
  try { [Convert]::ToBase64String($rfc.GetBytes(32)) }
  finally { $rfc.Dispose() }
}

function Test-Luhn([string]$Digits) {
  $sum = 0
  $alt = $false
  for ($i = $Digits.Length - 1; $i -ge 0; $i--) {
    $n = [int]::Parse($Digits[$i].ToString())
    if ($alt) {
      $n *= 2
      if ($n -gt 9) { $n -= 9 }
    }
    $sum += $n
    $alt = -not $alt
  }
  return ($sum % 10) -eq 0
}

function Get-CardBrand([string]$Digits) {
  if ($Digits.StartsWith('4')) { return 'Visa' }
  if ($Digits -match '^5[1-5]' -or $Digits -match '^2') { return 'Mastercard' }
  if ($Digits.StartsWith('3')) { return 'Amex' }
  return 'Cartão'
}

function Read-Db {
  Get-Content -Path $DbPath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-Db($Db) {
  $json = $Db | ConvertTo-Json -Depth 12
  $tmp = "$DbPath.tmp"
  Set-Content -Path $tmp -Value $json -Encoding UTF8
  Move-Item -Path $tmp -Destination $DbPath -Force
}

function Initialize-Db {
  if (Test-Path $DbPath) { return }
  $salt = New-Salt
  $now = (Get-Date).ToString('o')
  $db = [pscustomobject]@{
    users         = @(
      [pscustomobject]@{
        id = 'u_admin'; name = 'Bia'; email = 'bia@pratiquepilates.com'
        passwordHash = (Get-PasswordHash 'teste123' $salt); salt = $salt
        role = 'admin'; createdAt = $now
      }
      [pscustomobject]@{
        id = 'u_aluno'; name = 'Aluno Teste'; email = 'aluno@teste.com'
        passwordHash = (Get-PasswordHash 'teste123' $salt); salt = $salt
        role = 'aluno'; createdAt = $now
      }
    )
    sessions      = @()
    plans         = @(
      [pscustomobject]@{ id = 'solo'; name = 'Solo mensal'; price = 280; interval = 'mensal'; description = 'Mat pilates em turma de até 6 pessoas.' }
      [pscustomobject]@{ id = 'reformer'; name = 'Reformer mensal'; price = 420; interval = 'mensal'; description = 'Aparelho com molas, até 4 pessoas.' }
      [pscustomobject]@{ id = 'terapeutico'; name = 'Terapêutico mensal'; price = 560; interval = 'mensal'; description = 'Aulas individuais ou em dupla.' }
    )
    cards         = @()
    subscriptions = @()
    payments      = @()
  }
  Write-Db $db
}

function Get-Cookie([System.Net.HttpListenerRequest]$Req, [string]$Name) {
  $header = $Req.Headers['Cookie']
  if (-not $header) { return $null }
  foreach ($part in $header.Split(';')) {
    $kv = $part.Trim().Split('=', 2)
    if ($kv.Count -eq 2 -and $kv[0] -eq $Name) { return $kv[1] }
  }
  $null
}

function Get-UserFromRequest($Db, $Req) {
  $token = Get-Cookie $Req 'session'
  if (-not $token) { return $null }
  $session = @($Db.sessions) | Where-Object { $_.token -eq $token } | Select-Object -First 1
  if (-not $session) { return $null }
  @($Db.users) | Where-Object { $_.id -eq $session.userId } | Select-Object -First 1
}

function Read-Body($Req) {
  if ($Req.ContentLength64 -le 0) { return $null }
  $reader = New-Object System.IO.StreamReader($Req.InputStream, [Text.Encoding]::UTF8)
  try {
    $text = $reader.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    $text | ConvertFrom-Json
  } finally { $reader.Dispose() }
}

function Send-Json($Res, $Status, $Object) {
  $json = $Object | ConvertTo-Json -Depth 12 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $Res.StatusCode = $Status
  $Res.ContentType = 'application/json; charset=utf-8'
  $Res.ContentLength64 = $bytes.Length
  $Res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-File($Res, $Path) {
  $ext = [IO.Path]::GetExtension($Path).ToLower()
  $ctype = switch ($ext) {
    '.html' { 'text/html; charset=utf-8' }
    '.css'  { 'text/css; charset=utf-8' }
    '.js'   { 'text/javascript; charset=utf-8' }
    '.json' { 'application/json; charset=utf-8' }
    '.svg'  { 'image/svg+xml' }
    default { 'application/octet-stream' }
  }
  $bytes = [IO.File]::ReadAllBytes($Path)
  $Res.StatusCode = 200
  $Res.ContentType = $ctype
  $Res.ContentLength64 = $bytes.Length
  $Res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Public-User($User) {
  [pscustomobject]@{ id = $User.id; name = $User.name; email = $User.email; role = $User.role }
}

function Public-Card($Card) {
  [pscustomobject]@{
    id = $Card.id; brand = $Card.brand; last4 = $Card.last4
    expMonth = $Card.expMonth; expYear = $Card.expYear
  }
}

Initialize-Db

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($Prefix)
$listener.Start()
Write-Host "Pratique + Pilates (teste) em $Prefix"
Write-Host "Contas: aluno@teste.com / teste123   bia@pratiquepilates.com / teste123"
Write-Host "Cartão aprovado: 4242 4242 4242 4242   recusado: 4000 0000 0000 0002"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
      $method = $req.HttpMethod.ToUpperInvariant()

      if ($path -eq '/api/register' -and $method -eq 'POST') {
        $body = Read-Body $req
        $name = ([string]$body.name).Trim()
        $email = ([string]$body.email).Trim().ToLowerInvariant()
        $password = [string]$body.password
        if ($name.Length -lt 2 -or $email -notmatch '@' -or $password.Length -lt 6) {
          Send-Json $res 400 @{ error = 'Informe nome, e-mail válido e senha com pelo menos 6 caracteres.' }
        } else {
          $db = Read-Db
          if (@($db.users) | Where-Object { $_.email -eq $email }) {
            Send-Json $res 409 @{ error = 'Este e-mail já está cadastrado.' }
          } else {
            $salt = New-Salt
            $user = [pscustomobject]@{
              id = 'u_' + (New-Id); name = $name; email = $email
              passwordHash = (Get-PasswordHash $password $salt); salt = $salt
              role = 'aluno'; createdAt = (Get-Date).ToString('o')
            }
            $db.users = @($db.users) + $user
            $token = [guid]::NewGuid().ToString('N')
            $db.sessions = @($db.sessions) + [pscustomobject]@{ token = $token; userId = $user.id }
            Write-Db $db
            $res.Headers.Add('Set-Cookie', "session=$token; Path=/; HttpOnly; SameSite=Lax")
            Send-Json $res 201 @{ user = (Public-User $user) }
          }
        }
      }
      elseif ($path -eq '/api/login' -and $method -eq 'POST') {
        $body = Read-Body $req
        $email = ([string]$body.email).Trim().ToLowerInvariant()
        $password = [string]$body.password
        $db = Read-Db
        $user = @($db.users) | Where-Object { $_.email -eq $email } | Select-Object -First 1
        $ok = $false
        if ($user) {
          $ok = (Get-PasswordHash $password $user.salt) -eq $user.passwordHash
        }
        if (-not $ok) {
          Send-Json $res 401 @{ error = 'E-mail ou senha incorretos.' }
        } else {
          $token = [guid]::NewGuid().ToString('N')
          $db.sessions = @($db.sessions) + [pscustomobject]@{ token = $token; userId = $user.id }
          Write-Db $db
          $res.Headers.Add('Set-Cookie', "session=$token; Path=/; HttpOnly; SameSite=Lax")
          Send-Json $res 200 @{ user = (Public-User $user) }
        }
      }
      elseif ($path -eq '/api/logout' -and $method -eq 'POST') {
        $db = Read-Db
        $token = Get-Cookie $req 'session'
        $db.sessions = @(@($db.sessions) | Where-Object { $_.token -ne $token })
        Write-Db $db
        $res.Headers.Add('Set-Cookie', 'session=; Path=/; HttpOnly; Max-Age=0')
        Send-Json $res 200 @{ ok = $true }
      }
      elseif ($path -eq '/api/me' -and $method -eq 'GET') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else { Send-Json $res 200 @{ user = (Public-User $user) } }
      }
      elseif ($path -eq '/api/plans' -and $method -eq 'GET') {
        $db = Read-Db
        Send-Json $res 200 @{ plans = @($db.plans) }
      }
      elseif ($path -eq '/api/cards' -and $method -eq 'GET') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $cards = @($db.cards) | Where-Object { $_.userId -eq $user.id } | ForEach-Object { Public-Card $_ }
          Send-Json $res 200 @{ cards = @($cards) }
        }
      }
      elseif ($path -eq '/api/cards' -and $method -eq 'POST') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $body = Read-Body $req
          $digits = (([string]$body.number) -replace '\D', '')
          $cvv = (([string]$body.cvv) -replace '\D', '')
          $expMonth = [int]($body.expMonth)
          $expYear = [int]($body.expYear)
          $holder = ([string]$body.holder).Trim()
          if ($digits.Length -lt 13 -or $digits.Length -gt 19 -or -not (Test-Luhn $digits)) {
            Send-Json $res 400 @{ error = 'Número de cartão inválido (use um cartão de teste).' }
          } elseif ($cvv.Length -lt 3 -or $cvv.Length -gt 4) {
            Send-Json $res 400 @{ error = 'CVV inválido.' }
          } elseif ($expMonth -lt 1 -or $expMonth -gt 12 -or $expYear -lt 2026) {
            Send-Json $res 400 @{ error = 'Validade inválida.' }
          } elseif ($holder.Length -lt 3) {
            Send-Json $res 400 @{ error = 'Informe o nome impresso no cartão.' }
          } elseif ($digits -eq '4000000000000002') {
            Send-Json $res 402 @{ error = 'Cartão recusado pelo gateway de teste.' }
          } else {
            $card = [pscustomobject]@{
              id = 'card_' + (New-Id)
              userId = $user.id
              token = 'tok_test_' + (New-Id)
              brand = Get-CardBrand $digits
              last4 = $digits.Substring($digits.Length - 4)
              expMonth = $expMonth
              expYear = $expYear
            }
            $db.cards = @($db.cards) + $card
            Write-Db $db
            Send-Json $res 201 @{ card = (Public-Card $card) }
          }
        }
      }
      elseif ($path -match '^/api/cards/([^/]+)$' -and $method -eq 'DELETE') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        $cardId = $Matches[1]
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $sub = @($db.subscriptions) | Where-Object { $_.userId -eq $user.id -and $_.cardId -eq $cardId -and $_.status -eq 'ativa' } | Select-Object -First 1
          if ($sub) {
            Send-Json $res 409 @{ error = 'Cancele a assinatura antes de remover este cartão.' }
          } else {
            $db.cards = @(@($db.cards) | Where-Object { -not ($_.id -eq $cardId -and $_.userId -eq $user.id) })
            Write-Db $db
            Send-Json $res 200 @{ ok = $true }
          }
        }
      }
      elseif ($path -eq '/api/subscription' -and $method -eq 'GET') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $sub = @($db.subscriptions) | Where-Object { $_.userId -eq $user.id } | Sort-Object startedAt -Descending | Select-Object -First 1
          $plan = $null
          $card = $null
          if ($sub) {
            $plan = @($db.plans) | Where-Object { $_.id -eq $sub.planId } | Select-Object -First 1
            $found = @($db.cards) | Where-Object { $_.id -eq $sub.cardId } | Select-Object -First 1
            if ($found) { $card = Public-Card $found }
          }
          $payments = @($db.payments) | Where-Object { $sub -and $_.subscriptionId -eq $sub.id } | Sort-Object createdAt -Descending
          Send-Json $res 200 @{ subscription = $sub; plan = $plan; card = $card; payments = @($payments) }
        }
      }
      elseif ($path -eq '/api/subscribe' -and $method -eq 'POST') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $body = Read-Body $req
          $plan = @($db.plans) | Where-Object { $_.id -eq ([string]$body.planId) } | Select-Object -First 1
          $card = @($db.cards) | Where-Object { $_.id -eq ([string]$body.cardId) -and $_.userId -eq $user.id } | Select-Object -First 1
          $active = @($db.subscriptions) | Where-Object { $_.userId -eq $user.id -and $_.status -eq 'ativa' } | Select-Object -First 1
          if (-not $plan) { Send-Json $res 400 @{ error = 'Plano inválido.' } }
          elseif (-not $card) { Send-Json $res 400 @{ error = 'Cadastre um cartão de teste primeiro.' } }
          elseif ($active) { Send-Json $res 409 @{ error = 'Você já tem uma assinatura ativa.' } }
          else {
            $now = Get-Date
            $sub = [pscustomobject]@{
              id = 'sub_' + (New-Id)
              userId = $user.id
              planId = $plan.id
              cardId = $card.id
              status = 'ativa'
              startedAt = $now.ToString('o')
              nextBillingAt = $now.AddMonths(1).ToString('o')
            }
            $pay = [pscustomobject]@{
              id = 'pay_' + (New-Id)
              subscriptionId = $sub.id
              amount = $plan.price
              status = 'pago'
              method = "$($card.brand) •••• $($card.last4)"
              createdAt = $now.ToString('o')
            }
            $db.subscriptions = @($db.subscriptions) + $sub
            $db.payments = @($db.payments) + $pay
            Write-Db $db
            Send-Json $res 201 @{ subscription = $sub; payment = $pay }
          }
        }
      }
      elseif ($path -eq '/api/subscribe/cancel' -and $method -eq 'POST') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        else {
          $found = $false
          $subs = @($db.subscriptions)
          foreach ($s in $subs) {
            if ($s.userId -eq $user.id -and $s.status -eq 'ativa') {
              $s.status = 'cancelada'
              $s.canceledAt = (Get-Date).ToString('o')
              $found = $true
            }
          }
          if (-not $found) { Send-Json $res 404 @{ error = 'Nenhuma assinatura ativa.' } }
          else {
            $db.subscriptions = $subs
            Write-Db $db
            Send-Json $res 200 @{ ok = $true }
          }
        }
      }
      elseif ($path -eq '/api/admin/subscribers' -and $method -eq 'GET') {
        $db = Read-Db
        $user = Get-UserFromRequest $db $req
        if (-not $user) { Send-Json $res 401 @{ error = 'Faça login.' } }
        elseif ($user.role -ne 'admin') { Send-Json $res 403 @{ error = 'Acesso só para a equipe do estúdio.' } }
        else {
          $rows = foreach ($s in @($db.subscriptions)) {
            $u = @($db.users) | Where-Object { $_.id -eq $s.userId } | Select-Object -First 1
            $p = @($db.plans) | Where-Object { $_.id -eq $s.planId } | Select-Object -First 1
            $c = @($db.cards) | Where-Object { $_.id -eq $s.cardId } | Select-Object -First 1
            [pscustomobject]@{
              id = $s.id; status = $s.status; startedAt = $s.startedAt; nextBillingAt = $s.nextBillingAt
              user = @{ name = $u.name; email = $u.email }
              plan = @{ name = $p.name; price = $p.price }
              card = if ($c) { "$($c.brand) •••• $($c.last4)" } else { '—' }
            }
          }
          Send-Json $res 200 @{ subscribers = @($rows) }
        }
      }
      elseif ($method -eq 'GET') {
        $rel = $path.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
        $rootFull = [IO.Path]::GetFullPath($Root)
        if (-not $rootFull.EndsWith([IO.Path]::DirectorySeparatorChar)) {
          $rootFull += [IO.Path]::DirectorySeparatorChar
        }
        $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
        if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
          Send-Json $res 403 @{ error = 'Caminho inválido.' }
        } elseif (Test-Path $full -PathType Leaf) {
          Send-File $res $full
        } else {
          Send-Json $res 404 @{ error = 'Não encontrado.' }
        }
      }
      else {
        Send-Json $res 404 @{ error = 'Rota não encontrada.' }
      }
    } catch {
      try { Send-Json $res 500 @{ error = 'Erro interno no servidor de teste.' } } catch {}
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
