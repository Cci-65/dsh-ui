# install.ps1 - Direct installer for DeepSeek Harness (@local/dsh-ui)
# 与 install.py 行为对齐：自毁守卫、null 安全 profile、junction 失败回退、
# package.json 备份+原子写入、安装后拉起 bridge。
# v1.2.0 起 model-strength-picker 已并入本插件，安装时清理其旧注册。
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspaceDir = $scriptDir
$dshHome = Join-Path $env:USERPROFILE ".dsh"
$pluginRoot = Join-Path $dshHome "plugin"
$userDshPluginDir = Join-Path $pluginRoot "dsh-ui"
$oldUserPluginDir = Join-Path $pluginRoot "dsh-antigravity-composer"
# 已并入的 model-strength-picker（v1.2.0）
$absorbedPluginId = "@local/model-strength-picker"
$absorbedRowId = "model-strength-picker"
$absorbedUserPluginDir = Join-Path $pluginRoot "model-strength-picker"

$profileDesktopDir = Join-Path $dshHome "profiles\desktop"
$localAt = Join-Path $profileDesktopDir "node_modules\@local"
$nodeModulesLocal = Join-Path $localAt "dsh-ui"
$oldNodeModulesLocal = Join-Path $localAt "dsh-antigravity-composer"
$absorbedNodeModulesLocal = Join-Path $localAt "model-strength-picker"

# 自毁守卫：在已安装目录内运行本脚本时，跳过"先删再拷"（源即目标）
$runningInPlace = $false
try {
    $runningInPlace = ([System.IO.Path]::GetFullPath($workspaceDir).TrimEnd('\') -ieq `
                       [System.IO.Path]::GetFullPath($userDshPluginDir).TrimEnd('\'))
} catch {
    $runningInPlace = $false
}

Write-Host "===> Installing @local/dsh-ui into DeepSeek Harness..." -ForegroundColor Cyan
if ($runningInPlace) {
    Write-Host "[INFO] install.ps1 is running from the installed plugin directory; skipping self sync." -ForegroundColor Yellow
}

# 0. Clean legacy files
if (Test-Path $oldNodeModulesLocal) {
    cmd /c rmdir "$oldNodeModulesLocal" 2>$null
    if (Test-Path $oldNodeModulesLocal) {
        Remove-Item -Recurse -Force $oldNodeModulesLocal
    }
    Write-Host "[OK] Cleaned legacy junction at $oldNodeModulesLocal" -ForegroundColor Green
}
if (Test-Path $oldUserPluginDir) {
    Remove-Item -Recurse -Force $oldUserPluginDir
    Write-Host "[OK] Cleaned legacy plugin directory at $oldUserPluginDir" -ForegroundColor Green
}

# 0b. Clean up absorbed @local/model-strength-picker installation（已并入本插件）
if (Test-Path $absorbedNodeModulesLocal) {
    cmd /c rmdir "$absorbedNodeModulesLocal" 2>$null
    if (Test-Path $absorbedNodeModulesLocal) {
        Remove-Item -Recurse -Force $absorbedNodeModulesLocal
    }
    Write-Host "[OK] Removed absorbed-plugin junction at $absorbedNodeModulesLocal" -ForegroundColor Green
}
if (Test-Path $absorbedUserPluginDir) {
    # 保留备份：移入 plugin 目录下的 .absorbed-backup，而不是直接删除。
    $backupRoot = Join-Path $pluginRoot ".absorbed-backup"
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $dest = Join-Path $backupRoot "model-strength-picker"
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    try {
        Move-Item -Force $absorbedUserPluginDir $dest
        Write-Host "[OK] Moved absorbed plugin directory to $dest" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] Could not move absorbed plugin dir: $_" -ForegroundColor Yellow
    }
}

# 1. Ensure target plugin directory
if (-not (Test-Path $pluginRoot)) {
    New-Item -ItemType Directory -Force -Path $pluginRoot | Out-Null
}

# 2. Copy/Link files to ~/.dsh/plugin/dsh-ui（in-place 运行时跳过）
if (-not $runningInPlace) {
    if (Test-Path $userDshPluginDir) {
        Remove-Item -Recurse -Force $userDshPluginDir
    }
    Copy-Item -Recurse -Force -Path $workspaceDir -Destination $userDshPluginDir
    Write-Host "[OK] Synced plugin package to $userDshPluginDir" -ForegroundColor Green
}

# 3. Create junction in node_modules/@local（失败回退为目录拷贝，与 py 版对齐）
$localDir = Join-Path $profileDesktopDir "node_modules\@local"
if (-not (Test-Path $localDir)) {
    New-Item -ItemType Directory -Force -Path $localDir | Out-Null
}
if (Test-Path $nodeModulesLocal) {
    cmd /c rmdir "$nodeModulesLocal" 2>$null
    if (Test-Path $nodeModulesLocal) {
        Remove-Item -Recurse -Force $nodeModulesLocal
    }
}
cmd /c mklink /J "$nodeModulesLocal" "$userDshPluginDir" | Out-Null
if (Test-Path $nodeModulesLocal) {
    Write-Host "[OK] Created junction at $nodeModulesLocal" -ForegroundColor Green
} else {
    Write-Host "[WARN] Junction creation failed, falling back to directory copy..." -ForegroundColor Yellow
    Copy-Item -Recurse -Force -Path $userDshPluginDir -Destination $nodeModulesLocal
    Write-Host "[OK] Copied files to $nodeModulesLocal" -ForegroundColor Green
}

# 4. Update profile package.json（结构 null 安全；先备份 .bak，再临时文件原子替换）
$pkgPath = Join-Path $profileDesktopDir "package.json"
if (Test-Path $pkgPath) {
    $content = Get-Content -Path $pkgPath -Raw -Encoding UTF8
    $json = ConvertFrom-Json $content

    # 补齐可能缺失的结构（旧版在精简 profile 上会直接报错）
    if (-not $json.dsh) {
        $json | Add-Member -NotePropertyName "dsh" -NotePropertyValue ([pscustomobject]@{})
    }
    if (-not $json.dsh.profile) {
        $json.dsh | Add-Member -NotePropertyName "profile" -NotePropertyValue ([pscustomobject]@{})
    }
    if (-not ($json.dsh.profile.PSObject.Properties.Name -contains "bundles")) {
        $json.dsh.profile | Add-Member -NotePropertyName "bundles" -NotePropertyValue @()
    }
    if (-not $json.dependencies) {
        $json | Add-Member -NotePropertyName "dependencies" -NotePropertyValue ([pscustomobject]@{})
    }

    # Clean old bundle & add new bundle
    $bundles = @($json.dsh.profile.bundles | Where-Object { $_ -ne "@local/dsh-antigravity-composer" })
    $bundles = @($bundles | Where-Object { $_ -ne $absorbedPluginId })
    if ($bundles -notcontains "@local/dsh-ui") {
        $bundles += "@local/dsh-ui"
    }
    $json.dsh.profile.bundles = $bundles

    # Remove old dependency if present
    if ($json.dependencies."@local/dsh-antigravity-composer") {
        $json.dependencies.PSObject.Properties.Remove("@local/dsh-antigravity-composer")
    }
    # Remove absorbed dependency if present
    if ($json.dependencies.$absorbedPluginId) {
        $json.dependencies.PSObject.Properties.Remove($absorbedPluginId)
    }

    # Add new dependency
    if (-not $json.dependencies."@local/dsh-ui") {
        $json.dependencies | Add-Member -NotePropertyName "@local/dsh-ui" -NotePropertyValue ("link:" + ($userDshPluginDir -replace '\\', '/')) -Force
    }

    $bakPath = "$pkgPath.bak"
    try {
        Copy-Item -Force $pkgPath $bakPath
    } catch {
        Write-Host "[WARN] Could not create backup $bakPath : $_" -ForegroundColor Yellow
    }

    $tmpPath = Join-Path $profileDesktopDir ("package." + [guid]::NewGuid().ToString("N") + ".tmp")
    try {
        $newJson = $json | ConvertTo-Json -Depth 10
        Set-Content -Path $tmpPath -Value $newJson -Encoding UTF8
        Move-Item -Force $tmpPath $pkgPath
    } catch {
        if (Test-Path $tmpPath) { Remove-Item -Force $tmpPath }
        throw
    }
    Write-Host "[OK] Registered bundle @local/dsh-ui in $pkgPath (backup: $bakPath)" -ForegroundColor Green
}

# 5. Update cordis.patch.yml（entry 与 py 版一致，含 name 行）
# 删除顶层一个 `- id: <rowId>` 行及其缩进属性行（含其后紧跟的一个空行）。
function Remove-PatchRow([string]$text, [string]$rowId) {
    $lines = $text -split "`r?`n"
    $out = New-Object System.Collections.Generic.List[string]
    $i = 0
    while ($i -lt $lines.Count) {
        if ($lines[$i] -match ("^-\s+id:\s+['`"]?" + [regex]::Escape($rowId) + "['`"]?\s*$")) {
            $i++
            while ($i -lt $lines.Count -and ($lines[$i].StartsWith("  ") -or $lines[$i].StartsWith("`t"))) {
                $i++
            }
            if ($i -lt $lines.Count -and $lines[$i].Trim() -eq "") { $i++ }
            continue
        }
        $out.Add($lines[$i])
        $i++
    }
    return ($out -join "`n")
}
$patchPath = Join-Path $profileDesktopDir "cordis.patch.yml"
if (Test-Path $patchPath) {
    $patchContent = Get-Content -Path $patchPath -Raw -Encoding UTF8
    $patchChanged = $false
    $absorbedRowRe = "^-\s+id:\s+['`"]?" + [regex]::Escape($absorbedRowId) + "['`"]?\s*$"
    if ([regex]::IsMatch($patchContent, $absorbedRowRe, [System.Text.RegularExpressions.RegexOptions]::Multiline)) {
        $patchContent = Remove-PatchRow $patchContent $absorbedRowId
        $patchChanged = $true
        Write-Host "[OK] Removed absorbed plugin row $absorbedRowId from $patchPath" -ForegroundColor Green
    }
    if ($patchContent -match "dsh-antigravity-composer") {
        $patchContent = $patchContent -replace "id: dsh-antigravity-composer", "id: dsh-ui"
        $patchChanged = $true
        Write-Host "[OK] Migrated dsh-antigravity-composer -> dsh-ui in $patchPath" -ForegroundColor Green
    } elseif ($patchContent -notmatch "dsh-ui") {
        $entry = @"

- id: dsh-ui
  name: "@local/dsh-ui"
  disabled: false
  config: {}
"@
        Add-Content -Path $patchPath -Value $entry -Encoding UTF8
        Write-Host "[OK] Enabled plugin patch dsh-ui in $patchPath" -ForegroundColor Green
    } else {
        Write-Host "[OK] Plugin patch dsh-ui already present in $patchPath" -ForegroundColor Green
    }
    if ($patchChanged) {
        Set-Content -Path $patchPath -Value $patchContent -Encoding UTF8 -NoNewline
    }
}

# 6. Ensure bridge service is running（与 py 版对齐；宿主加载插件时也会自启，先到先得）
function Test-BridgeRunning([int]$port = 19389) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(500)
        if ($ok -and $client.Connected) {
            $client.EndConnect($iar)
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

if (-not (Test-BridgeRunning)) {
    $bridgeScript = Join-Path $userDshPluginDir "bridge.mjs"
    if (Test-Path $bridgeScript) {
        $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
        if ($nodeExe) {
            Start-Process -FilePath $nodeExe -ArgumentList "`"$bridgeScript`"" -WorkingDirectory $userDshPluginDir -WindowStyle Hidden
            Write-Host "[OK] Started DSH-UI bridge background service on port 19389" -ForegroundColor Green
        } else {
            Write-Host "[WARN] node not found on PATH; bridge will start when the host loads the plugin." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[OK] DSH-UI bridge is already running on port 19389" -ForegroundColor Green
}

Write-Host "===> DeepSeek Harness Plugin @local/dsh-ui Installed Successfully!" -ForegroundColor Cyan
