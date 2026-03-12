param(
    [switch]$DryRun
)

# ------------------------------------------------------------
# Normalize-Repo.ps1  (PS 5.1 compatible)
# Purpose:
#  - Normalize repo structure for SWA + React(Vite) + Functions
#  - Create /docs and /integration/sql
#  - Move root /sql -> /integration/sql
#  - Consolidate doc artifacts into /docs
#  - Ensure .gitignore excludes build artifacts and local folders
#
# Run:
#   .\Normalize-Repo.ps1 -DryRun   # preview
#   .\Normalize-Repo.ps1           # execute
# ------------------------------------------------------------

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Ok($msg)   { Write-Host "[ OK ] $msg" -ForegroundColor Green }

function Assert-RepoRoot {
    if (-not (Test-Path ".git")) {
        throw "This does not look like the repo root (missing .git). Open PowerShell in the repo root and run again."
    }
}

function Ensure-Dir($path) {
    if (-not (Test-Path $path)) {
        if ($DryRun) { Write-Info "Would create directory: $path" }
        else {
            New-Item -ItemType Directory -Path $path | Out-Null
            Write-Ok "Created directory: $path"
        }
    } else {
        Write-Info "Directory exists: $path"
    }
}

function Move-Path($source, $dest) {
    if (-not (Test-Path $source)) {
        Write-Info "Skip (not found): $source"
        return
    }

    # If dest exists, merge contents
    if (Test-Path $dest) {
        Write-Warn "Destination exists, will merge contents: $source -> $dest"
        $items = Get-ChildItem -LiteralPath $source -Force
        foreach ($item in $items) {
            $target = Join-Path $dest $item.Name
            if ($DryRun) { Write-Info "Would move: $($item.FullName) -> $target" }
            else {
                Move-Item -LiteralPath $item.FullName -Destination $target -Force
                Write-Ok "Moved: $($item.Name) -> $dest"
            }
        }

        if (-not $DryRun) {
            $remaining = Get-ChildItem -LiteralPath $source -Force -ErrorAction SilentlyContinue
            if (-not $remaining) {
                Remove-Item -LiteralPath $source -Force
                Write-Ok "Removed empty folder: $source"
            } else {
                Write-Warn "Folder not empty, left as-is: $source"
            }
        }
        return
    }

    if ($DryRun) { Write-Info "Would move: $source -> $dest" }
    else {
        $parent = Split-Path -Parent $dest
        if ($parent -and -not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent | Out-Null
        }
        Move-Item -LiteralPath $source -Destination $dest -Force
        Write-Ok "Moved: $source -> $dest"
    }
}

function Ensure-GitIgnoreEntry($entry, $gitIgnorePath) {
    if (-not (Test-Path $gitIgnorePath)) {
        if ($DryRun) { Write-Info "Would create $gitIgnorePath" }
        else {
            New-Item -ItemType File -Path $gitIgnorePath | Out-Null
            Write-Ok "Created $gitIgnorePath"
        }
    }

    $content = ""
    if (Test-Path $gitIgnorePath) {
        $content = Get-Content -LiteralPath $gitIgnorePath -Raw
    }

    # Handle blank lines safely
    if ([string]::IsNullOrWhiteSpace($entry)) {
        if ($DryRun) { Write-Info "Would append blank line to .gitignore (if needed)" }
        else {
            # Only add if file doesn't already end with a blank line
            if (-not ($content -match "(\r?\n)\s*(\r?\n)\s*$")) {
                Add-Content -LiteralPath $gitIgnorePath -Value ""
                Write-Ok "Appended blank line to .gitignore"
            } else {
                Write-Info ".gitignore already ends with blank line"
            }
        }
        return
    }

    $escaped = [regex]::Escape($entry)
    $pattern = "(?m)^(?:$escaped)$"

    if ($content -notmatch $pattern) {
        if ($DryRun) { Write-Info "Would append to .gitignore: $entry" }
        else {
            Add-Content -LiteralPath $gitIgnorePath -Value $entry
            Write-Ok "Appended to .gitignore: $entry"
        }
    } else {
        Write-Info ".gitignore already contains: $entry"
    }
}

function Move-DocArtifactsToDocs {
    Ensure-Dir "docs"

    # Patterns (can overlap). We'll dedupe using a Hashtable keyed by FullName
    $patterns = @(
        "checkpoint*.md",
        "*Documentation*Package*",
        "PEG*Documentation*Package*",
        "PEG_Portal_PoC_Documentation_Package*"
    )

    $found = @{}  # FullName -> FileInfo/DirectoryInfo

    foreach ($pat in $patterns) {
        $items = Get-ChildItem -Path "." -Filter $pat -Force -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            if ($item.Name -ieq "README.md") { continue }  # keep root README
            if (-not $found.ContainsKey($item.FullName)) {
                $found[$item.FullName] = $item
            }
        }
    }

    foreach ($key in $found.Keys) {
        $item = $found[$key]
        $target = Join-Path "docs" $item.Name

        if ($DryRun) { Write-Info "Would move doc artifact: $($item.FullName) -> $target" }
        else {
            Move-Item -LiteralPath $item.FullName -Destination $target -Force
            Write-Ok "Moved doc artifact: $($item.Name) -> docs\"
        }
    }
}

function Move-SqlToIntegration {
    Ensure-Dir "integration"
    Ensure-Dir "integration\sql"

    if (Test-Path "sql") {
        Move-Path "sql" "integration\sql"
    } else {
        Write-Info "No root 'sql' folder found. Skip."
    }
}

function Create-IntegrationSubFolders {
    Ensure-Dir "integration\logicapps"
    Ensure-Dir "integration\mappings"
}

function Add-StandardGitIgnores {
    $gitIgnorePath = ".gitignore"

    $entries = @(
        "",
        "# --- build artifacts ---",
        "dist/",
        "build/",
        ".local_publish/",
        "publish/",
        "",
        "# --- dependencies ---",
        "node_modules/",
        "",
        "# --- env files ---",
        ".env",
        ".env.*",
        "",
        "# --- OS / tooling ---",
        ".DS_Store",
        "Thumbs.db",
        "",
        "# --- editor/tooling ---",
        ".vscode/",
        "",
        "# --- Azure SWA local tooling ---",
        ".swa/",
        ".azure/"
    )

    foreach ($e in $entries) {
        Ensure-GitIgnoreEntry $e $gitIgnorePath
    }
}

function Summary {
    Write-Host ""
    Write-Host "=================================================" -ForegroundColor DarkGray
    Write-Host ("DRY RUN: " + ($DryRun.IsPresent)) -ForegroundColor DarkGray
    Write-Host "Completed normalization steps." -ForegroundColor DarkGray
    Write-Host "Next:" -ForegroundColor DarkGray
    Write-Host "  1) Review changes: git status" -ForegroundColor DarkGray
    Write-Host "  2) If correct: git add . ; git commit -m `"Normalize repo structure`"" -ForegroundColor DarkGray
    Write-Host "=================================================" -ForegroundColor DarkGray
    Write-Host ""
}

# ------------------- MAIN -------------------
Assert-RepoRoot

Write-Info "Starting repo normalization in: $(Get-Location)"
if ($DryRun) { Write-Warn "DryRun enabled: no changes will be made." }

Ensure-Dir "docs"
Ensure-Dir "integration"
Create-IntegrationSubFolders
Ensure-Dir "integration\sql"

Move-SqlToIntegration
Move-DocArtifactsToDocs
Add-StandardGitIgnores

Summary