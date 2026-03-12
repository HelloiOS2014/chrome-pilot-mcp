# Chrome Pilot MCP Windows 部署脚本
# 支持全局安装和项目级安装
#
# 用法:
#   .\deploy.ps1              # 交互式选择
#   .\deploy.ps1 -Global      # 直接全局安装
#   .\deploy.ps1 -Project "C:\path\to\project"  # 直接项目安装
#   .\deploy.ps1 -Force       # 覆盖已有配置

param(
    [switch]$Global,
    [string]$Project,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$InstallDir = "$env:APPDATA\chrome-pilot-mcp"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$ClaudeSettings = "$env:USERPROFILE\.claude.json"
$ClaudeProjectsDir = "$env:USERPROFILE\.claude\projects"

# 确定安装模式
$Mode = ""
$TargetProject = ""

if ($Global) {
    $Mode = "global"
} elseif ($Project) {
    $Mode = "project"
    $TargetProject = $Project
}

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Chrome Pilot MCP Deploy" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# ============================================================
# [1/5] Check environment
# ============================================================
Write-Host "[1/5] Checking environment..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Error: Node.js not found. Please install it first." -ForegroundColor Red
    exit 1
}

# ============================================================
# [2/5] Build
# ============================================================
Write-Host ""
Write-Host "[2/5] Building project..." -ForegroundColor Yellow
Push-Location $ProjectDir
npm install --silent
npm run build --silent
Pop-Location
Write-Host "  Build successful" -ForegroundColor Green

# ============================================================
# [3/5] Install to global directory
# ============================================================
Write-Host ""
Write-Host "[3/5] Installing to global directory..." -ForegroundColor Yellow
if (!(Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Copy-Item -Path "$ProjectDir\dist" -Destination "$InstallDir\" -Recurse -Force
Copy-Item -Path "$ProjectDir\package.json" -Destination "$InstallDir\" -Force
if (Test-Path "$ProjectDir\node_modules") {
    Copy-Item -Path "$ProjectDir\node_modules" -Destination "$InstallDir\" -Recurse -Force
}

Write-Host "  Install dir: $InstallDir" -ForegroundColor Green
Write-Host "  Installation complete" -ForegroundColor Green

# ============================================================
# [4/5] Choose install mode
# ============================================================
Write-Host ""
Write-Host "[4/5] Choose install mode..." -ForegroundColor Yellow

if ($Mode -eq "") {
    Write-Host ""
    Write-Host "  Select installation mode:" -ForegroundColor White
    Write-Host "    1) Global (write to ~/.claude.json, available to all projects)" -ForegroundColor Cyan
    Write-Host "    2) Project-level (write to project's .mcp.json)" -ForegroundColor Cyan
    Write-Host ""
    $choice = Read-Host "  >"

    switch ($choice) {
        "1" {
            $Mode = "global"
        }
        "2" {
            $Mode = "project"
            # Scan ~/.claude/projects/ for project paths
            $projectPaths = @()
            if (Test-Path $ClaudeProjectsDir) {
                Get-ChildItem -Path $ClaudeProjectsDir -Directory | Sort-Object Name | ForEach-Object {
                    $dirName = $_.Name
                    # Convert - to \ for Windows paths (e.g., -Users-panghu -> \Users\panghu)
                    $projPath = $dirName -replace '-', '\'
                    # Also try / separator
                    $projPathUnix = $dirName -replace '-', '/'
                    if (Test-Path $projPath) {
                        $projectPaths += $projPath
                    } elseif (Test-Path $projPathUnix) {
                        $projectPaths += $projPathUnix
                    }
                }
            }

            if ($projectPaths.Count -eq 0) {
                Write-Host "  Error: No known project paths found" -ForegroundColor Red
                Write-Host "  Use -Project <path> to specify manually" -ForegroundColor Yellow
                exit 1
            }

            Write-Host ""
            Write-Host "  Discovered projects:" -ForegroundColor White
            for ($i = 0; $i -lt $projectPaths.Count; $i++) {
                Write-Host "    $($i+1)) $($projectPaths[$i])" -ForegroundColor Cyan
            }
            Write-Host ""
            $projChoice = Read-Host "  >"
            $projIndex = [int]$projChoice - 1

            if ($projIndex -lt 0 -or $projIndex -ge $projectPaths.Count) {
                Write-Host "  Error: Invalid selection" -ForegroundColor Red
                exit 1
            }

            $TargetProject = $projectPaths[$projIndex]
        }
        default {
            Write-Host "  Error: Invalid selection, enter 1 or 2" -ForegroundColor Red
            exit 1
        }
    }
}

# Validate project path
if ($Mode -eq "project") {
    if (!(Test-Path $TargetProject)) {
        Write-Host "  Error: Project directory not found: $TargetProject" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Mode: Project-level" -ForegroundColor Green
    Write-Host "  Target: $TargetProject\.mcp.json" -ForegroundColor Green
} else {
    Write-Host "  Mode: Global" -ForegroundColor Green
    Write-Host "  Target: ~/.claude.json" -ForegroundColor Green
}

# ============================================================
# [5/5] Write config
# ============================================================
Write-Host ""
Write-Host "[5/5] Writing config..." -ForegroundColor Yellow

$forceStr = if ($Force) { "true" } else { "false" }
$installDirEscaped = $InstallDir -replace '\\', '\\\\'

if ($Mode -eq "global") {
    # ---- Global install ----
    if (Test-Path $ClaudeSettings) {
        $backupFile = "${ClaudeSettings}.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $ClaudeSettings $backupFile
        Write-Host "  Backup: $backupFile" -ForegroundColor Green

        $updateResult = node -e @"
const fs = require('fs');
try {
    const settings = JSON.parse(fs.readFileSync('$($ClaudeSettings -replace '\\', '\\\\')', 'utf8'));
    if (!settings.mcpServers) settings.mcpServers = {};
    const existed = 'chrome-pilot' in settings.mcpServers;
    if (existed && !$forceStr) {
        console.log('exists');
    } else {
        settings.mcpServers['chrome-pilot'] = {
            type: 'stdio',
            command: 'node',
            args: ['$installDirEscaped\\\\dist\\\\index.js'],
            env: {}
        };
        fs.writeFileSync('$($ClaudeSettings -replace '\\', '\\\\')', JSON.stringify(settings, null, 2));
        console.log(existed ? 'updated' : 'added');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
"@

        switch ($updateResult) {
            "added"   { Write-Host "  Added chrome-pilot to mcpServers" -ForegroundColor Green }
            "updated" { Write-Host "  Updated chrome-pilot config" -ForegroundColor Green }
            "exists"  { Write-Host "  chrome-pilot already exists, skipped (use -Force to overwrite)" -ForegroundColor Yellow }
            default   {
                Write-Host "  Update failed: $updateResult" -ForegroundColor Red
                Copy-Item $backupFile $ClaudeSettings -Force
                Write-Host "  Restored backup" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  Claude settings file not found, skipping auto-config" -ForegroundColor Yellow
    }
} else {
    # ---- Project-level install ----
    $mcpJson = Join-Path $TargetProject ".mcp.json"
    $mcpJsonEscaped = $mcpJson -replace '\\', '\\\\'

    if (Test-Path $mcpJson) {
        $backupFile = "${mcpJson}.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $mcpJson $backupFile
        Write-Host "  Backup: $backupFile" -ForegroundColor Green
    }

    $updateResult = node -e @"
const fs = require('fs');
const path = '$mcpJsonEscaped';
try {
    let config = {};
    if (fs.existsSync(path)) {
        config = JSON.parse(fs.readFileSync(path, 'utf8'));
    }
    if (!config.mcpServers) config.mcpServers = {};
    const existed = 'chrome-pilot' in config.mcpServers;
    if (existed && !$forceStr) {
        console.log('exists');
    } else {
        config.mcpServers['chrome-pilot'] = {
            command: 'node',
            args: ['$installDirEscaped\\\\dist\\\\index.js']
        };
        fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
        console.log(existed ? 'updated' : 'added');
    }
} catch (err) {
    console.log('error:' + err.message);
    process.exit(1);
}
"@

    switch ($updateResult) {
        "added"   { Write-Host "  Added chrome-pilot to $mcpJson" -ForegroundColor Green }
        "updated" { Write-Host "  Updated chrome-pilot config" -ForegroundColor Green }
        "exists"  { Write-Host "  chrome-pilot already exists, skipped (use -Force to overwrite)" -ForegroundColor Yellow }
        default   {
            Write-Host "  Update failed: $updateResult" -ForegroundColor Red
            if (Test-Path $backupFile) {
                Copy-Item $backupFile $mcpJson -Force
                Write-Host "  Restored backup" -ForegroundColor Green
            }
        }
    }
}

# ============================================================
# Output
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Install dir: $InstallDir" -ForegroundColor Blue
if ($Mode -eq "project") {
    Write-Host "Config file: $TargetProject\.mcp.json" -ForegroundColor Blue
} else {
    Write-Host "Config file: ~/.claude.json" -ForegroundColor Blue
}
Write-Host ""
Write-Host "Prerequisites:" -ForegroundColor Blue
Write-Host "  1. Chrome >= 144" -ForegroundColor White
Write-Host "  2. Open chrome://inspect/#remote-debugging and enable" -ForegroundColor White
Write-Host ""
Write-Host "Restart Claude Code to take effect" -ForegroundColor Blue
