# Script PowerShell pour créer un ZIP du projet React frontend
# Usage: .\create-frontend-zip.ps1 [nom-du-projet]

param(
    [string]$ProjectName = "sama-frontend"
)

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ZipName = "$ProjectName-$Timestamp.zip"
$TempDir = "temp-zip-$ProjectName"

Write-Host "📦 Création du ZIP du frontend React..." -ForegroundColor Cyan
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
    param([string]$Source, [string]$Destination, [string]$DisplayName)
    if (Test-Path $Source) {
        Copy-Item -Path $Source -Destination $Destination
        $name = if ($DisplayName) { $DisplayName } else { $Source }
        Write-Host "  ✅ $name" -ForegroundColor Green
        return $true
    }
    return $false
}

# Copier les dossiers à inclure
Write-Host "📁 Copie des dossiers..." -ForegroundColor Yellow

Copy-IfExists -Source "src" -Destination $TempDir
Copy-IfExists -Source "public" -Destination $TempDir

# Copier les fichiers de configuration à inclure
Write-Host "📄 Copie des fichiers de configuration..." -ForegroundColor Yellow

# Fichiers de base
Copy-File-IfExists -Source "package.json" -Destination $TempDir
Copy-File-IfExists -Source "package-lock.json" -Destination $TempDir
Copy-File-IfExists -Source "yarn.lock" -Destination $TempDir
Copy-File-IfExists -Source "pnpm-lock.yaml" -Destination $TempDir

# Configs Vite
Copy-File-IfExists -Source "vite.config.js" -Destination $TempDir
Copy-File-IfExists -Source "vite.config.ts" -Destination $TempDir
Copy-File-IfExists -Source "vite.config.mjs" -Destination $TempDir

# Configs Webpack
Copy-File-IfExists -Source "webpack.config.js" -Destination $TempDir
Copy-File-IfExists -Source "webpack.config.ts" -Destination $TempDir

# TypeScript
Copy-File-IfExists -Source "tsconfig.json" -Destination $TempDir

# Autres configs utiles
$configFiles = @(
    ".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs",
    ".prettierrc", ".prettierrc.js", ".prettierrc.json",
    "tailwind.config.js", "tailwind.config.ts",
    "postcss.config.js", "postcss.config.json",
    ".babelrc", "babel.config.js", "babel.config.json"
)

foreach ($config in $configFiles) {
    Copy-File-IfExists -Source $config -Destination $TempDir
}

# .env.example
if (Test-Path ".env.example") {
    Copy-File-IfExists -Source ".env.example" -Destination $TempDir
}

# Créer .env.example à partir de .env si nécessaire
if (Test-Path ".env" -And -not (Test-Path "$TempDir\.env.example")) {
    Write-Host "⚠️  .env trouvé - création de .env.example avec secrets masqués..." -ForegroundColor Yellow
    
    $envContent = Get-Content ".env" -Raw
    
    # Masquer les valeurs sensibles
    $patterns = @(
        '(?i)(.*API.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*PASSWORD.*|.*PASS.*)\s*=\s*[^\r\n]+'
    )
    
    foreach ($pattern in $patterns) {
        $envContent = $envContent -replace $pattern, '$1=***MASKED***'
    }
    
    $envContent | Set-Content -Path "$TempDir\.env.example"
    Write-Host "  ✅ .env.example créé" -ForegroundColor Green
}

# Créer un README.md si absent
if (-not (Test-Path "README.md")) {
    Write-Host "📝 Création d'un README.md..." -ForegroundColor Yellow
    
    $readmeContent = @"
# Projet React - SAMA Frontend

## Installation

1. Installer les dépendances :
```bash
npm install
# ou
yarn install
# ou
pnpm install
```

2. Configurer l'environnement (si nécessaire) :
```bash
cp .env.example .env
# Éditer .env avec vos propres valeurs
```

## Développement

### Démarrer le serveur de développement

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

### Build de production

```bash
npm run build
# ou
yarn build
# ou
pnpm build
```

### Prévisualiser le build de production

```bash
npm run preview
# ou
yarn preview
# ou
pnpm preview
```

## Structure

- src/ : Code source de l'application React
- public/ : Fichiers statiques (index.html, assets de base)
- package.json : Dépendances et scripts du projet

## Technologies utilisées

- React
- React Router (pour la navigation)
- Axios (pour les appels API)
- Tailwind CSS (pour le styling)

## Notes

Ce fichier est une version nettoyée du projet. Les dépendances (node_modules/) ne sont pas incluses et doivent être installées avec npm install (ou yarn/pnpm).
"@
    
    $readmeContent | Set-Content -Path "$TempDir\README.md"
    Write-Host "  ✅ README.md créé" -ForegroundColor Green
} elseif (Test-Path "README.md") {
    Copy-File-IfExists -Source "README.md" -Destination $TempDir
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
Write-Host ""
Write-Host "📋 Contenu inclus :" -ForegroundColor Cyan
Write-Host "  - src/ (code source)"
Write-Host "  - public/ (fichiers statiques)"
Write-Host "  - package.json et locks"
Write-Host "  - Fichiers de configuration (vite, webpack, tsconfig, etc.)"
Write-Host "  - README.md"
Write-Host ""
Write-Host "❌ Contenu exclu :" -ForegroundColor Yellow
Write-Host "  - node_modules/ (à installer avec npm install)"
Write-Host "  - dist/ et build/ (fichiers de build)"
Write-Host "  - .git/ et dossiers IDE"

