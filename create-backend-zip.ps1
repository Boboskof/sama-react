# Script PowerShell pour créer un ZIP du projet Symfony backend
# Usage: .\create-backend-zip.ps1 [nom-du-projet]

param(
    [string]$ProjectName = "sama-backend"
)

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ZipName = "$ProjectName-$Timestamp.zip"
$TempDir = "temp-zip-$ProjectName"

Write-Host "📦 Création du ZIP du backend Symfony..." -ForegroundColor Cyan
Write-Host "Nom du projet: $ProjectName"
Write-Host "Nom du ZIP: $ZipName"

# Créer un dossier temporaire
if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
}
New-Item -ItemType Directory -Path $TempDir | Out-Null

# Fonction pour copier un dossier s'il existe
function Copy-IfExists {
    param([string]$Source, [string]$Destination)
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $Destination -Recurse
        Write-Host "  ✅ $Source/" -ForegroundColor Green
        return $true
    }
    return $false
}

# Fonction pour copier un fichier s'il existe
function Copy-File-IfExists {
    param([string]$Source, [string]$Destination)
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $Destination
        Write-Host "  ✅ $Source" -ForegroundColor Green
        return $true
    }
    return $false
}

# Copier les dossiers à inclure
Write-Host "📁 Copie des dossiers..." -ForegroundColor Yellow

$Folders = @("config", "src", "templates", "public", "migrations")
foreach ($folder in $Folders) {
    Copy-IfExists -Source $folder -Destination $TempDir
}

# Copier les fichiers à inclure
Write-Host "📄 Copie des fichiers..." -ForegroundColor Yellow

$Files = @("composer.json", "composer.lock", "symfony.lock")
foreach ($file in $Files) {
    Copy-File-IfExists -Source $file -Destination $TempDir
}

# Créer un .env.example à partir de .env (en masquant les secrets)
if (Test-Path ".env") {
    Write-Host "🔐 Création de .env.example (secrets masqués)..." -ForegroundColor Yellow
    
    $envContent = Get-Content ".env" -Raw
    
    # Masquer les valeurs sensibles
    $patterns = @(
        '(APP_SECRET|DATABASE_URL|MAILER_DSN|MESSENGER_TRANSPORT_DSN|JWT_SECRET_KEY|JWT_PUBLIC_KEY)\s*=\s*[^\r\n]+',
        '(?i)(.*PASSWORD.*|.*PASS.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*API.*KEY.*)\s*=\s*[^\r\n]+'
    )
    
    foreach ($pattern in $patterns) {
        $envContent = $envContent -replace $pattern, '$1=***MASKED***'
    }
    
    $envContent | Set-Content -Path "$TempDir\.env.example"
    Write-Host "  ✅ .env.example" -ForegroundColor Green
}

# Créer un README.md si absent
if (-not (Test-Path "README.md")) {
    Write-Host "📝 Création d'un README.md..." -ForegroundColor Yellow
    
    $readmeContent = @"
# Projet Symfony - SAMA Backend

## Installation

1. Installer les dépendances :
``````bash
composer install
``````

2. Configurer l'environnement :
``````bash
cp .env.example .env
# Éditer .env avec vos propres valeurs
``````

3. Créer la base de données :
``````bash
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
``````

4. Charger les fixtures (si disponibles) :
``````bash
php bin/console doctrine:fixtures:load
``````

## Structure

- `config/` : Configuration Symfony
- `src/` : Code source de l'application
- `templates/` : Templates Twig (si utilisé)
- `public/` : Point d'entrée public
- `migrations/` : Migrations de la base de données

## Développement

``````bash
symfony serve
``````

## Notes

Ce fichier est une version nettoyée du projet. Les secrets et informations sensibles ont été masqués dans `.env.example`.
"@
    
    $readmeContent | Set-Content -Path "$TempDir\README.md"
    Write-Host "  ✅ README.md créé" -ForegroundColor Green
}

# Créer le ZIP
Write-Host "🗜️  Création du ZIP..." -ForegroundColor Yellow

Compress-Archive -Path "$TempDir\*" -DestinationPath $ZipName -Force

# Nettoyer
Write-Host "🧹 Nettoyage..." -ForegroundColor Yellow
Remove-Item $TempDir -Recurse -Force

$ZipSize = (Get-Item $ZipName).Length / 1MB

Write-Host ""
Write-Host "✅ ZIP créé avec succès : $ZipName" -ForegroundColor Green
Write-Host "📊 Taille du fichier : $([math]::Round($ZipSize, 2)) MB" -ForegroundColor Green

