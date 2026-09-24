<#
.SYNOPSIS
  Install a released `atc` (a single binary) from GitHub Releases on Windows. Adapted from atomic-agent.

.EXAMPLE
  irm https://github.com/AtomicBot-ai/atomic-chat-cli/releases/latest/download/install.ps1 | iex

.NOTES
  Environment overrides (mirror install.sh):
    ATC_REPO         owner/repo   (default: AtomicBot-ai/atomic-chat-cli)
    ATC_VERSION      v0.1.0       (optional: pin a tag; default: latest)
    ATC_INSTALL_DIR  path         (default: %LOCALAPPDATA%\atc)
    ATC_NO_PATH      1            (optional: skip the user PATH update)
#>

$ErrorActionPreference = "Stop"
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$Repo = if ($env:ATC_REPO) { $env:ATC_REPO } else { "AtomicBot-ai/atomic-chat-cli" }
$Version = $env:ATC_VERSION
$InstallDir = if ($env:ATC_INSTALL_DIR) { $env:ATC_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "atc" }
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "aarch64" } else { "x86_64" }
$Triple = "$Arch-pc-windows-msvc"

function Fail($msg) { Write-Error $msg; exit 1 }

$Base = "https://github.com/$Repo"
$Release = if ($Version) { "$Base/releases/download/$Version" } else { "$Base/releases/latest/download" }
$Work = Join-Path ([System.IO.Path]::GetTempPath()) ("atc-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Work -Force | Out-Null
try {
  Write-Host "resolving the $(if ($Version) { $Version } else { 'latest' }) release of $Repo ..."
  $Sums = Join-Path $Work "SHA256SUMS"
  Invoke-WebRequest -Uri "$Release/SHA256SUMS" -OutFile $Sums -UseBasicParsing
  $line = Get-Content $Sums | Where-Object { $_ -match "atc-.*-$Triple\.exe$" } | Select-Object -First 1
  if (-not $line) { Fail "no binary for $Triple in this release" }
  $parts = $line.Trim() -split '\s+'
  $Expected = $parts[0].ToLower()
  $Asset = $parts[1].TrimStart('*')

  Write-Host "downloading $Asset ..."
  $Bin = Join-Path $Work $Asset
  Invoke-WebRequest -Uri "$Release/$Asset" -OutFile $Bin -UseBasicParsing
  $Actual = (Get-FileHash -Path $Bin -Algorithm SHA256).Hash.ToLower()
  if ($Actual -ne $Expected) { Fail "checksum mismatch for $Asset`n  expected: $Expected`n  actual:   $Actual" }
  Write-Host "checksum verified"

  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
  $Target = Join-Path $InstallDir "atc.exe"
  # A running atc.exe cannot be overwritten but can be renamed: move it aside, clean up next time.
  Get-ChildItem -Path $InstallDir -File -Filter "atc.exe.old-*" -ErrorAction SilentlyContinue | ForEach-Object {
    try { Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop } catch {}
  }
  if (Test-Path -LiteralPath $Target) {
    try { Copy-Item -LiteralPath $Bin -Destination $Target -Force -ErrorAction Stop }
    catch {
      Move-Item -LiteralPath $Target -Destination ("$Target.old-" + (Get-Date -Format "yyyyMMddHHmmss")) -Force
      Copy-Item -LiteralPath $Bin -Destination $Target -Force
    }
  } else {
    Copy-Item -LiteralPath $Bin -Destination $Target -Force
  }
  Write-Host ""
  Write-Host "installed atc to $Target"
} finally {
  Remove-Item -Path $Work -Recurse -Force -ErrorAction SilentlyContinue
}

$current = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not $current) { $current = "" }
$present = ($current -split ';' | Where-Object { $_.TrimEnd('\') -ieq $InstallDir.TrimEnd('\') }).Count -gt 0
if ($present) {
  Write-Host "PATH already contains $InstallDir"
} elseif ($env:ATC_NO_PATH -eq "1") {
  Write-Host "add $InstallDir to your PATH to run atc from anywhere"
} else {
  $sep = if ($current.Length -gt 0 -and -not $current.EndsWith(';')) { ";" } else { "" }
  [Environment]::SetEnvironmentVariable("Path", "$current$sep$InstallDir", "User")
  $env:Path = "$env:Path;$InstallDir"
  Write-Host "added $InstallDir to the user PATH (open a new terminal elsewhere)"
}
Write-Host ""
Write-Host "next:"
Write-Host "  atc doctor"
Write-Host "  atc serve Qwen/Qwen3-8B-GGUF"
Write-Host "  atc admin"
