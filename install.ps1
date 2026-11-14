# Tales Tales - one-step setup for Windows.
#
# Run it with Win+R (or a PowerShell window):
#   powershell -ExecutionPolicy Bypass -NoExit -Command "irm https://raw.githubusercontent.com/chlalsrb63-collab/mingyu.github.io/main/install.ps1 | iex"
#
# What it does (safe to run again later; it updates instead of reinstalling):
#   1. installs Git and Node.js LTS with winget if they are missing
#   2. downloads (or updates) the project into  Desktop\Tales Tales
#   3. runs npm install in game\
#   4. installs the Claude Code, Codex and Gemini command-line tools
#   5. creates desktop shortcuts to PLAY.bat and AI-TEAM.bat (the .bat files come with the project)
#   6. starts the game at http://localhost:8787
#
# ASCII only on purpose: Windows PowerShell 5.1 misreads UTF-8 without a BOM.

$ErrorActionPreference = 'Stop'
$Repo   = 'https://github.com/chlalsrb63-collab/mingyu.github.io.git'
$Branch = 'main'
$Desktop = [Environment]::GetFolderPath('Desktop')
$Dir    = Join-Path $Desktop 'Tales Tales'
$Game   = Join-Path $Dir 'game'

function Say($m)  { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "   $m" -ForegroundColor Green }
function Warn($m) { Write-Host "   $m" -ForegroundColor Yellow }
function Has($c)  { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Run($exe, [string[]]$argv) {
  & $exe @argv
  if ($LASTEXITCODE -ne 0) { throw "$exe $($argv -join ' ') failed (exit $LASTEXITCODE)" }
}
function Need($cmd, $wingetId, $name, $url) {
  if (Has $cmd) { Ok "$name found"; return }
  Say "Installing $name ..."
  if (Has 'winget') {
    & winget install --id $wingetId -e --silent --accept-package-agreements --accept-source-agreements
    Refresh-Path
  }
  if (-not (Has $cmd)) {
    Warn "Could not install $name automatically."
    Warn "Please install it from $url , then run this setup again."
    throw "missing $name"
  }
  Ok "$name installed"
}

try {
  Write-Host ''
  Write-Host '  TALES TALES  -  local setup' -ForegroundColor Magenta
  Write-Host "  Folder: $Dir"

  # Let npm-installed tools (codex, gemini, claude) run from PowerShell.
  try { Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force -ErrorAction Stop } catch { }

  Say 'Checking tools'
  Refresh-Path
  Need 'git'  'Git.Git'            'Git'     'https://git-scm.com/download/win'
  Need 'node' 'OpenJS.NodeJS.LTS'  'Node.js' 'https://nodejs.org'
  $major = [int]((& node -v).TrimStart('v').Split('.')[0])
  if ($major -lt 20) {
    Say "Node.js $major is too old, updating to LTS ..."
    if (Has 'winget') { & winget install --id OpenJS.NodeJS.LTS -e --silent --accept-package-agreements --accept-source-agreements; Refresh-Path }
    $major = [int]((& node -v).TrimStart('v').Split('.')[0])
    if ($major -lt 20) { Warn 'Please install Node.js 22 LTS from https://nodejs.org and run this again.'; throw 'node too old' }
  }
  Ok "node $(& node -v)"

  Say 'Getting the project'
  if (Test-Path (Join-Path $Dir '.git')) {
    Run 'git' @('-C', $Dir, 'fetch', 'origin', $Branch)
    Run 'git' @('-C', $Dir, 'merge', '--ff-only', "origin/$Branch")
    Ok 'Updated to the latest version'
  } elseif ((Test-Path $Dir) -and @(Get-ChildItem -Force $Dir).Count -gt 0) {
    # The folder exists and has files in it: turn it into the project in place.
    Run 'git' @('-C', $Dir, 'init', '-q')
    & git -C $Dir remote remove origin 2>$null
    Run 'git' @('-C', $Dir, 'remote', 'add', 'origin', $Repo)
    Run 'git' @('-C', $Dir, 'fetch', 'origin', $Branch)
    Run 'git' @('-C', $Dir, 'checkout', '-f', '-B', $Branch, "origin/$Branch")
    Run 'git' @('-C', $Dir, 'branch', "--set-upstream-to=origin/$Branch", $Branch)
    Ok 'Downloaded into the existing folder'
  } else {
    Run 'git' @('clone', '-b', $Branch, $Repo, $Dir)
    Ok 'Downloaded'
  }

  Say 'Installing game packages (npm install, takes a few minutes the first time)'
  Push-Location $Game
  try { Run 'npm.cmd' @('install', '--no-fund', '--no-audit') } finally { Pop-Location }
  Ok 'Packages ready'

  Say 'Installing AI tools (Claude Code, Codex, Gemini CLI)'
  foreach ($pkg in @('@anthropic-ai/claude-code', '@openai/codex', '@google/gemini-cli')) {
    & npm.cmd install -g --no-fund --no-audit $pkg
    if ($LASTEXITCODE -eq 0) { Ok "$pkg installed" } else { Warn "$pkg could not be installed (you can skip it, or retry later: npm i -g $pkg)" }
  }

  Say 'Creating desktop shortcuts'
  try {
    $ws = New-Object -ComObject WScript.Shell
    foreach ($pair in @(@('Tales Tales - PLAY', 'PLAY.bat'), @('Tales Tales - AI TEAM', 'AI-TEAM.bat'))) {
      $lnk = $ws.CreateShortcut((Join-Path $Desktop ($pair[0] + '.lnk')))
      $lnk.TargetPath = Join-Path $Dir $pair[1]
      $lnk.WorkingDirectory = $Dir
      $lnk.Save()
    }
    Ok 'Desktop shortcuts "Tales Tales - PLAY" and "Tales Tales - AI TEAM" created'
  } catch { Warn 'Could not create desktop shortcuts (the .bat files in the folder still work).' }

  Say 'All done!'
  Write-Host "   Project folder : $Dir"
  Write-Host '   Play           : PLAY.bat            (desktop: "Tales Tales - PLAY")'
  Write-Host '   AI team        : AI-TEAM.bat         (Codex + Gemini start their tasks from ai\TASKS.md)'
  Write-Host '   Merge AI work  : AI-MERGE.bat        (Claude reviews, tests and merges)'
  Write-Host '   Update         : UPDATE.bat          Tests: TESTS.bat'
  Write-Host '   Guide          : ai\README.md and docs\LOCAL_SETUP.md'
  Write-Host ''
  Write-Host '   Starting the game now...' -ForegroundColor Green
  Start-Process -FilePath (Join-Path $Dir 'PLAY.bat') -WorkingDirectory $Dir
}
catch {
  Write-Host ''
  Write-Host "Setup stopped: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Copy the red text above and send it to Claude; it can tell you what to do.' -ForegroundColor Red
}
