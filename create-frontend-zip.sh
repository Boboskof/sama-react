#!/bin/bash

# Script pour créer un ZIP du projet React frontend
# Usage: ./create-frontend-zip.sh [nom-du-projet]

PROJECT_NAME="${1:-sama-frontend}"
ZIP_NAME="${PROJECT_NAME}-$(date +%Y%m%d-%H%M%S).zip"
TEMP_DIR="temp-zip-${PROJECT_NAME}"

echo "📦 Création du ZIP du frontend React..."
echo "Nom du projet: ${PROJECT_NAME}"
echo "Nom du ZIP: ${ZIP_NAME}"

# Créer un dossier temporaire
mkdir -p "${TEMP_DIR}"

# Copier les dossiers à inclure
echo "📁 Copie des dossiers..."

if [ -d "src" ]; then
    cp -r src "${TEMP_DIR}/"
    echo "  ✅ src/"
fi

if [ -d "public" ]; then
    cp -r public "${TEMP_DIR}/"
    echo "  ✅ public/"
fi

# Copier les fichiers de configuration à inclure
echo "📄 Copie des fichiers de configuration..."

# Fichiers de base
if [ -f "package.json" ]; then
    cp package.json "${TEMP_DIR}/"
    echo "  ✅ package.json"
fi

if [ -f "package-lock.json" ]; then
    cp package-lock.json "${TEMP_DIR}/"
    echo "  ✅ package-lock.json"
fi

if [ -f "yarn.lock" ]; then
    cp yarn.lock "${TEMP_DIR}/"
    echo "  ✅ yarn.lock"
fi

if [ -f "pnpm-lock.yaml" ]; then
    cp pnpm-lock.yaml "${TEMP_DIR}/"
    echo "  ✅ pnpm-lock.yaml"
fi

# Configs Vite
if [ -f "vite.config.js" ]; then
    cp vite.config.js "${TEMP_DIR}/"
    echo "  ✅ vite.config.js"
fi

if [ -f "vite.config.ts" ]; then
    cp vite.config.ts "${TEMP_DIR}/"
    echo "  ✅ vite.config.ts"
fi

if [ -f "vite.config.mjs" ]; then
    cp vite.config.mjs "${TEMP_DIR}/"
    echo "  ✅ vite.config.mjs"
fi

# Configs Webpack
if [ -f "webpack.config.js" ]; then
    cp webpack.config.js "${TEMP_DIR}/"
    echo "  ✅ webpack.config.js"
fi

if [ -f "webpack.config.ts" ]; then
    cp webpack.config.ts "${TEMP_DIR}/"
    echo "  ✅ webpack.config.ts"
fi

# TypeScript
if [ -f "tsconfig.json" ]; then
    cp tsconfig.json "${TEMP_DIR}/"
    echo "  ✅ tsconfig.json"
fi

# Autres configs utiles
if [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.cjs" ]; then
    cp .eslintrc* "${TEMP_DIR}/" 2>/dev/null || true
    echo "  ✅ .eslintrc*"
fi

if [ -f ".prettierrc" ] || [ -f ".prettierrc.js" ] || [ -f ".prettierrc.json" ]; then
    cp .prettierrc* "${TEMP_DIR}/" 2>/dev/null || true
    echo "  ✅ .prettierrc*"
fi

if [ -f "tailwind.config.js" ] || [ -f "tailwind.config.ts" ]; then
    cp tailwind.config.* "${TEMP_DIR}/" 2>/dev/null || true
    echo "  ✅ tailwind.config.*"
fi

if [ -f "postcss.config.js" ] || [ -f "postcss.config.json" ]; then
    cp postcss.config.* "${TEMP_DIR}/" 2>/dev/null || true
    echo "  ✅ postcss.config.*"
fi

if [ -f ".babelrc" ] || [ -f "babel.config.js" ] || [ -f "babel.config.json" ]; then
    cp .babelrc babel.config.* "${TEMP_DIR}/" 2>/dev/null || true
    echo "  ✅ babel.config.*"
fi

if [ -f ".env.example" ]; then
    cp .env.example "${TEMP_DIR}/"
    echo "  ✅ .env.example"
fi

if [ -f ".env" ]; then
    echo "⚠️  .env trouvé - création de .env.example avec secrets masqués..."
    sed -E 's/(.*API.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*PASSWORD.*|.*PASS.*)=.*/\1=***MASKED***/gi' .env > "${TEMP_DIR}/.env.example" 2>/dev/null || \
    sed -i '' -E 's/(.*API.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*PASSWORD.*|.*PASS.*)=.*/\1=***MASKED***/gi' .env > "${TEMP_DIR}/.env.example" 2>/dev/null
    echo "  ✅ .env.example créé"
fi

# Créer un README.md si absent
if [ ! -f "README.md" ] || [ ! -f "${TEMP_DIR}/README.md" ]; then
    echo "📝 Création d'un README.md..."
    cat > "${TEMP_DIR}/README.md" << 'EOF'
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

- `src/` : Code source de l'application React
- `public/` : Fichiers statiques (index.html, assets de base)
- `package.json` : Dépendances et scripts du projet

## Technologies utilisées

- React
- React Router (pour la navigation)
- Axios (pour les appels API)
- Tailwind CSS (pour le styling)

## Notes

Ce fichier est une version nettoyée du projet. Les dépendances (`node_modules/`) ne sont pas incluses et doivent être installées avec `npm install` (ou yarn/pnpm).
EOF
    echo "  ✅ README.md créé"
fi

# Créer le ZIP
echo "🗜️  Création du ZIP..."
cd "${TEMP_DIR}"
zip -r "../${ZIP_NAME}" . -q
cd ..

# Nettoyer
echo "🧹 Nettoyage..."
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ ZIP créé avec succès : ${ZIP_NAME}"
echo "📊 Taille du fichier : $(du -h "${ZIP_NAME}" | cut -f1)"
echo ""
echo "📋 Contenu inclus :"
echo "  - src/ (code source)"
echo "  - public/ (fichiers statiques)"
echo "  - package.json et locks"
echo "  - Fichiers de configuration (vite, webpack, tsconfig, etc.)"
echo "  - README.md"
echo ""
echo "❌ Contenu exclu :"
echo "  - node_modules/ (à installer avec npm install)"
echo "  - dist/ et build/ (fichiers de build)"
echo "  - .git/ et dossiers IDE"

