# Script PowerShell pour creer un zip avec les fichiers cles du projet
# Front-end React + Vite

$ErrorActionPreference = "Stop"

# Nom du fichier zip avec timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$zipName = "sama-front-export_$timestamp.zip"
$tempDir = "temp-zip-export"

Write-Host "Creation du zip d'export..." -ForegroundColor Cyan

# Nettoyer le dossier temporaire s'il existe
if (Test-Path $tempDir) {
    Remove-Item -Path $tempDir -Recurse -Force
}

# Creer le dossier temporaire
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Host "Copie des fichiers front-end..." -ForegroundColor Yellow

# Fichiers de configuration racine
$rootFiles = @(
    "package.json",
    "vite.config.js",
    "tsconfig.json",
    "eslint.config.js",
    "README.md",
    ".env.example"
)

foreach ($file in $rootFiles) {
    if (Test-Path $file) {
        Copy-Item -Path $file -Destination $tempDir -Force
        Write-Host "  OK: $file" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: $file non trouve" -ForegroundColor Yellow
    }
}

# Dossier src (pages, components, services, etc.)
if (Test-Path "src") {
    Copy-Item -Path "src" -Destination $tempDir -Recurse -Force
    Write-Host "  OK: src/ (tout le contenu)" -ForegroundColor Green
}

# Autres fichiers de documentation
$docsFiles = Get-ChildItem -Path "." -Filter "*.md" -File | Where-Object { $_.Name -ne "README.md" }
foreach ($file in $docsFiles) {
    Copy-Item -Path $file.FullName -Destination $tempDir -Force
    Write-Host "  OK: $($file.Name)" -ForegroundColor Green
}

# Scripts utiles
if (Test-Path "docker-compose.yml") {
    Copy-Item -Path "docker-compose.yml" -Destination $tempDir -Force
    Write-Host "  OK: docker-compose.yml" -ForegroundColor Green
}

# Nettoyer les fichiers .env reels s'ils existent (securite)
Get-ChildItem -Path $tempDir -Filter ".env" -Recurse -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Path $tempDir -Filter ".env.local" -Recurse -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Compression du zip..." -ForegroundColor Yellow

# Supprimer l'ancien zip s'il existe
if (Test-Path $zipName) {
    Remove-Item -Path $zipName -Force
}

# Creer le zip
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipName -Force

# Nettoyer le dossier temporaire
Remove-Item -Path $tempDir -Recurse -Force

$zipSize = (Get-Item $zipName).Length / 1MB
$zipSizeRounded = [math]::Round($zipSize, 2)
Write-Host ""
Write-Host "Zip cree avec succes: $zipName ($zipSizeRounded MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Fichiers inclus:" -ForegroundColor Cyan
Write-Host "  - Configuration (package.json, vite.config.js, tsconfig.json, eslint.config.js)" -ForegroundColor White
Write-Host "  - Dossier src/ complet (pages, components, services, hooks, utils, types)" -ForegroundColor White
Write-Host "  - .env.example (avec valeurs factices)" -ForegroundColor White
Write-Host "  - Documentation (*.md)" -ForegroundColor White
Write-Host "  - Autres fichiers de configuration" -ForegroundColor White

