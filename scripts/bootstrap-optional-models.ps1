# Download managed Hub pins, verify them, sync LocalAI YAML, and create
# Stable Diffusion WebUI hard links under Stable-diffusion/.
#
# Default npm entry: npm run models:bootstrap-optional -> bootstrap-optional-models.sh
# Use this PowerShell twin when bash is unavailable:
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1 -Starters
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1 -All
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1 chat-qwen2.5-7b,sdxl-base
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1 -LinksOnly
#   powershell -NoProfile -File scripts/bootstrap-optional-models.ps1 -ForceLinks
#
# Bash default: scripts/bootstrap-optional-models.sh
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Alias,
  [switch]$Starters,
  [switch]$Optional,
  [switch]$All,
  [switch]$LinksOnly,
  [switch]$ForceLinks,
  [switch]$SkipSync
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$StarterList = @("chat-qwen2.5-3b", "embed-nomic-v1.5", "sd15-starter")
$OptionalList = @(
  "chat-qwen2.5-7b",
  "chat-qwen2.5-coder-7b",
  "sdxl-base",
  "stt-whisper-base",
  "tts-piper-en-us"
)

$aliases = [System.Collections.Generic.List[string]]::new()
function Add-Aliases([string[]]$items) {
  foreach ($item in $items) {
    if ([string]::IsNullOrWhiteSpace($item)) { continue }
    foreach ($part in ($item -split ",")) {
      $name = $part.Trim()
      if (-not $name) { continue }
      if (-not $aliases.Contains($name)) { [void]$aliases.Add($name) }
    }
  }
}

if ($Starters) { Add-Aliases $StarterList }
if ($Optional) { Add-Aliases $OptionalList }
if ($All) {
  Add-Aliases $StarterList
  Add-Aliases $OptionalList
}
if ($Alias) { Add-Aliases $Alias }
if ($aliases.Count -eq 0 -and -not $LinksOnly) { Add-Aliases $OptionalList }

$modelsRoot = node --input-type=module -e @"
import { readFileSync } from 'node:fs';
import { hostPath } from './scripts/paths.mjs';
const storage = JSON.parse(readFileSync('./config/storage.json', 'utf8'));
process.stdout.write(hostPath(storage.roots.models));
"@
if (-not $modelsRoot) { throw "Could not resolve models root from config/storage.json" }

Write-Host "Models root: $modelsRoot"
New-Item -ItemType Directory -Force -Path (Join-Path $modelsRoot "Stable-diffusion") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $modelsRoot "checkpoints") | Out-Null

function New-WebUiHardLink {
  param([string]$Source, [string]$Target)
  if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "Skip link (missing source): $Source"
    return
  }
  $parent = Split-Path -Parent $Target
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  if (Test-Path -LiteralPath $Target) {
    if ($ForceLinks) {
      Remove-Item -LiteralPath $Target -Force
    } else {
      Write-Host "Skip link (exists): $Target"
      return
    }
  }
  New-Item -ItemType HardLink -Path $Target -Target $Source | Out-Null
  Write-Host "Hard-linked: $Target -> $Source"
}

function Set-WebUiLinks {
  New-WebUiHardLink `
    -Source (Join-Path $modelsRoot "checkpoints\v1-5-pruned-emaonly-fp16.safetensors") `
    -Target (Join-Path $modelsRoot "Stable-diffusion\v1-5-pruned-emaonly-fp16.safetensors")
  New-WebUiHardLink `
    -Source (Join-Path $modelsRoot "checkpoints\sd_xl_base_1.0.safetensors") `
    -Target (Join-Path $modelsRoot "Stable-diffusion\sd_xl_base_1.0.safetensors")
}

if (-not $LinksOnly) {
  foreach ($name in $aliases) {
    Write-Host ""
    Write-Host "=== download $name ==="
    npm run models -- download $name
    if ($LASTEXITCODE -ne 0) { throw "download failed for $name" }
    Write-Host "=== verify $name ==="
    npm run models -- verify $name
    if ($LASTEXITCODE -ne 0) { throw "verify failed for $name" }
  }
  if (-not $SkipSync) {
    Write-Host ""
    Write-Host "=== sync-localai ==="
    npm run models -- sync-localai
    if ($LASTEXITCODE -ne 0) { throw "sync-localai failed" }
  }
}

Write-Host ""
Write-Host "=== WebUI hard links ==="
Set-WebUiLinks

Write-Host ""
Write-Host "Done. Re-check with: npm run models -- recommendations media"
