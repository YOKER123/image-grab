<#
  push-to-github.ps1
  ---------------------------------------------------------------
  One-click publishing for the ImageGrab project:
    1. verify GitHub token
    2. create repository (if not exists)
    3. push local commits to branch main
    4. enable GitHub Pages  (branch: main, folder: /docs)
    5. print the live site URL
  ---------------------------------------------------------------
  Usage (PowerShell, inside the project folder):
    powershell -ExecutionPolicy Bypass -File .\push-to-github.ps1

  The token is only used for this run and is NOT written into
  .git/config, so it will not leak into the repository.
#>

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$Owner = 'YOKER123'
$Repo  = 'image-grab'
$Desc  = 'Chrome extension: grab all product images on e-commerce detail pages and batch download them as PNG'

Write-Host ''
Write-Host '=== ImageGrab  ->  GitHub ===' -ForegroundColor Cyan
Write-Host ''

# ---------- 1. token ----------
$token = $env:GH_TOKEN
if (-not $token) {
    $token = Read-Host 'Paste your GitHub token (classic, scope: repo)'
}
if (-not $token) {
    Write-Host 'No token provided, abort.' -ForegroundColor Red
    exit 1
}

$headers = @{
    Authorization = "Bearer $token"
    Accept        = 'application/vnd.github+json'
    'User-Agent'  = 'imagegrab-push-script'
}

# ---------- 2. verify token ----------
Write-Host '[1/5] Verifying token ...'
try {
    $me = Invoke-RestMethod -Uri 'https://api.github.com/user' -Headers $headers -Method Get
} catch {
    Write-Host ('      Token check failed: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host '      Make sure the token has the "repo" scope and is not expired.' -ForegroundColor Yellow
    exit 1
}
Write-Host ('      Logged in as: ' + $me.login) -ForegroundColor Green

# ---------- 3. create repository ----------
Write-Host '[2/5] Creating repository (skipped if it already exists) ...'
$body = @{
    name        = $Repo
    description = $Desc
    private     = $false
    has_issues  = $true
    has_wiki    = $false
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod -Method Post -Uri 'https://api.github.com/user/repos' `
        -Headers $headers -Body $body -ContentType 'application/json' | Out-Null
    Write-Host '      Repository created.' -ForegroundColor Green
} catch {
    Write-Host ('      ' + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host '      If it already exists, this is fine - continuing.' -ForegroundColor Yellow
}

$remoteUrl = 'https://github.com/' + $Owner + '/' + $Repo + '.git'
git remote remove origin *> $null
git remote add origin $remoteUrl

# ---------- 4. push ----------
Write-Host '[3/5] Pushing commits to main ...'
$pushUrl = 'https://' + $Owner + ':' + $token + '@github.com/' + $Owner + '/' + $Repo + '.git'
git -c credential.helper= push $pushUrl 'HEAD:refs/heads/main'
if ($LASTEXITCODE -ne 0) {
    Write-Host '      Push failed, see the error above.' -ForegroundColor Red
    exit 1
}
Write-Host '      Pushed successfully.' -ForegroundColor Green

Write-Host '[4/5] Setting upstream branch ...'
git fetch origin *> $null
git branch --set-upstream-to=origin/main main *> $null
Write-Host '      Done.' -ForegroundColor Green

# ---------- 5. enable GitHub Pages ----------
Write-Host '[5/5] Enabling GitHub Pages (branch main, folder /docs) ...'
$pagesBody = @{ source = @{ branch = 'main'; path = '/docs' } } | ConvertTo-Json -Depth 5
$pagesUrl  = 'https://api.github.com/repos/' + $Owner + '/' + $Repo + '/pages'

try {
    $pages = Invoke-RestMethod -Method Post -Uri $pagesUrl -Headers $headers `
        -Body $pagesBody -ContentType 'application/json'
    Write-Host ('      Pages enabled: ' + $pages.html_url) -ForegroundColor Green
} catch {
    Write-Host ('      ' + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host '      If Pages is already enabled, this is fine.' -ForegroundColor Yellow
    Write-Host '      Manual fallback: repo -> Settings -> Pages -> Source: main, folder /docs' -ForegroundColor Yellow
}

$siteUrl = 'https://' + $Owner.ToLower() + '.github.io/' + $Repo + '/'

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ' ALL DONE' -ForegroundColor Cyan
Write-Host (' Repository : ' + $remoteUrl)
Write-Host (' Live site  : ' + $siteUrl) -ForegroundColor Green
Write-Host ' The site usually needs 1-2 minutes to go live.' -ForegroundColor Yellow
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host ' SECURITY: revoke the token you just used ->' -ForegroundColor Yellow
Write-Host ' https://github.com/settings/tokens' -ForegroundColor Yellow
Write-Host ''
