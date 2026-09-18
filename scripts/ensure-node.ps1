# IDUN Automated Node.js 24 Environment Bootstrapper for Windows
param(
    [switch]$ForceInstall
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$toolsDir = Join-Path $root ".idun\tools\node"
$toolsNode = Join-Path $toolsDir "node.exe"

function Get-NodeMajorVersion($cmd) {
    try {
        $out = & $cmd -v 2>$null
        if ($out -match '^v?(\d+)\.') {
            return [int]$matches[1]
        }
    } catch {}
    return 0
}

# 1. Check if node is already available on PATH and version >= 24
if (-not $ForceInstall) {
    $systemNodeMajor = Get-NodeMajorVersion "node"
    if ($systemNodeMajor -ge 24) {
        return 0
    }

    # 2. Check if portable Node 24 exists in .idun\tools\node
    if (Test-Path $toolsNode) {
        $localNodeMajor = Get-NodeMajorVersion $toolsNode
        if ($localNodeMajor -ge 24) {
            $env:PATH = "$toolsDir;$env:PATH"
            return 0
        }
    }
}

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "  IDUN: Node.js 24 is required system-wide." -ForegroundColor Cyan
Write-Host "  Automated installer initializing..." -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 3. Attempt winget installation for system-wide Node.js 24 (LTS)
$hasWinget = $false
try {
    $null = & winget --version 2>$null
    $hasWinget = $true
} catch {}

if ($hasWinget) {
    try {
        Write-Host "IDUN: Attempting system-wide installation via winget (OpenJS.NodeJS.LTS)..." -ForegroundColor Yellow
        & winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
        
        # Refresh environment PATH from registry
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:PATH = "$machinePath;$userPath"

        $postWingetMajor = Get-NodeMajorVersion "node"
        if ($postWingetMajor -ge 24) {
            Write-Host "IDUN: Node.js $postWingetMajor installed successfully via winget!" -ForegroundColor Green
            return 0
        }
    } catch {
        Write-Host "IDUN: winget installation encountered an error. Falling back to portable Node.js 24..." -ForegroundColor Yellow
    }
}

# 4. Fallback: Download official portable standalone Node.js 24 from nodejs.org
Write-Host "IDUN: Provisioning standalone Node.js 24 runtime from nodejs.org..." -ForegroundColor Yellow
if (-not (Test-Path $toolsDir)) {
    $null = New-Item -ItemType Directory -Path $toolsDir -Force
}

$zipUrl = "https://nodejs.org/dist/latest-v24.x/node-v24.21.0-win-x64.zip"
$zipPath = Join-Path $toolsDir "node24.zip"

try {
    Write-Host "Downloading $zipUrl..." -ForegroundColor Gray
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    $webClient = New-Object System.Net.WebClient
    $webClient.DownloadFile($zipUrl, $zipPath)

    Write-Host "Extracting Node.js 24 runtime..." -ForegroundColor Gray
    $tempExtract = Join-Path $toolsDir "temp_extract"
    if (Test-Path $tempExtract) { Remove-Item -Path $tempExtract -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force
    Remove-Item -Path $zipPath -Force

    $subfolder = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
    if ($subfolder) {
        Get-ChildItem -Path $subfolder.FullName | Move-Item -Destination $toolsDir -Force
    }
    Remove-Item -Path $tempExtract -Recurse -Force

    $env:PATH = "$toolsDir;$env:PATH"
    $installedMajor = Get-NodeMajorVersion $toolsNode
    if ($installedMajor -ge 24) {
        Write-Host "IDUN: Standalone Node.js 24 successfully provisioned at $toolsDir." -ForegroundColor Green
        return 0
    }
} catch {
    Write-Error "IDUN: Failed to automatically install Node.js 24: $_"
    return 1
}
