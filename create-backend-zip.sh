#!/bin/bash

# Script pour créer un ZIP du projet Symfony backend
# Usage: ./create-backend-zip.sh [nom-du-projet]

PROJECT_NAME="${1:-sama-backend}"
ZIP_NAME="${PROJECT_NAME}-$(date +%Y%m%d-%H%M%S).zip"
TEMP_DIR="temp-zip-${PROJECT_NAME}"

echo "📦 Création du ZIP du backend Symfony..."
echo "Nom du projet: ${PROJECT_NAME}"
echo "Nom du ZIP: ${ZIP_NAME}"

# Créer un dossier temporaire
mkdir -p "${TEMP_DIR}"

# Copier les dossiers à inclure
echo "📁 Copie des dossiers..."

if [ -d "config" ]; then
    cp -r config "${TEMP_DIR}/"
    echo "  ✅ config/"
fi

if [ -d "src" ]; then
    cp -r src "${TEMP_DIR}/"
    echo "  ✅ src/"
fi

if [ -d "templates" ]; then
    cp -r templates "${TEMP_DIR}/"
    echo "  ✅ templates/"
fi

if [ -d "public" ]; then
    cp -r public "${TEMP_DIR}/"
    echo "  ✅ public/"
fi

if [ -d "migrations" ]; then
    cp -r migrations "${TEMP_DIR}/"
    echo "  ✅ migrations/"
fi

# Copier les fichiers à inclure
echo "📄 Copie des fichiers..."

if [ -f "composer.json" ]; then
    cp composer.json "${TEMP_DIR}/"
    echo "  ✅ composer.json"
fi

if [ -f "composer.lock" ]; then
    cp composer.lock "${TEMP_DIR}/"
    echo "  ✅ composer.lock"
fi

if [ -f "symfony.lock" ]; then
    cp symfony.lock "${TEMP_DIR}/"
    echo "  ✅ symfony.lock"
fi

# Créer un .env.example à partir de .env (en masquant les secrets)
if [ -f ".env" ]; then
    echo "🔐 Création de .env.example (secrets masqués)..."
    
    # Copier .env et masquer les valeurs sensibles
    sed -E 's/(APP_SECRET|DATABASE_URL|MAILER_DSN|MESSENGER_TRANSPORT_DSN|JWT_SECRET_KEY|JWT_PUBLIC_KEY)=.*/\1=***MASKED***/g' .env > "${TEMP_DIR}/.env.example"
    
    # Masquer aussi d'autres clés potentielles
    sed -i.bak -E 's/(.*PASSWORD.*|.*PASS.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*API.*KEY.*)=.*/\1=***MASKED***/gi' "${TEMP_DIR}/.env.example" 2>/dev/null || \
    sed -i '' -E 's/(.*PASSWORD.*|.*PASS.*|.*SECRET.*|.*KEY.*|.*TOKEN.*|.*API.*KEY.*)=.*/\1=***MASKED***/gi' "${TEMP_DIR}/.env.example" 2>/dev/null
    
    rm -f "${TEMP_DIR}/.env.example.bak" 2>/dev/null
    echo "  ✅ .env.example"
fi

# Créer un README.md si absent
if [ ! -f "README.md" ]; then
    echo "📝 Création d'un README.md..."
    cat > "${TEMP_DIR}/README.md" << 'EOF'
# Projet Symfony - SAMA Backend

## Installation

1. Installer les dépendances :
```bash
composer install
```

2. Configurer l'environnement :
```bash
cp .env.example .env
# Éditer .env avec vos propres valeurs
```

3. Créer la base de données :
```bash
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
```

4. Charger les fixtures (si disponibles) :
```bash
php bin/console doctrine:fixtures:load
```

## Structure

- `config/` : Configuration Symfony
- `src/` : Code source de l'application
- `templates/` : Templates Twig (si utilisé)
- `public/` : Point d'entrée public
- `migrations/` : Migrations de la base de données

## Développement

```bash
symfony serve
```

## Notes

Ce fichier est une version nettoyée du projet. Les secrets et informations sensibles ont été masqués dans `.env.example`.
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

