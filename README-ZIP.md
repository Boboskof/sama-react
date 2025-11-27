# Scripts de création de ZIP pour le backend Symfony

Ces scripts permettent de créer un ZIP nettoyé du projet Symfony backend pour le partage.

## ✅ Contenu inclus dans le ZIP

- `config/` - Configuration Symfony
- `src/` - Code source de l'application
- `templates/` - Templates Twig (si utilisé)
- `public/` - Point d'entrée public et assets
- `migrations/` - Migrations de la base de données
- `composer.json` et `composer.lock`
- `symfony.lock` (si présent)
- `.env.example` - Fichier d'environnement avec secrets masqués
- `README.md` - Documentation du projet

## ❌ Contenu exclu (non inclus dans le ZIP)

- `vendor/` - Dépendances (à réinstaller avec `composer install`)
- `var/` - Cache et logs Symfony
- `.git/` - Historique Git
- Dossiers IDE (`.idea/`, `.vscode/`, etc.)
- `node_modules/` - Si présent (pour Webpack Encore/Vite)

## 📋 Utilisation

### Sur Linux/Mac (Bash)

```bash
# Rendre le script exécutable
chmod +x create-backend-zip.sh

# Exécuter depuis le dossier racine du projet Symfony
./create-backend-zip.sh

# Ou avec un nom personnalisé
./create-backend-zip.sh mon-projet-backend
```

### Sur Windows (PowerShell)

```powershell
# Exécuter depuis le dossier racine du projet Symfony
.\create-backend-zip.ps1

# Ou avec un nom personnalisé
.\create-backend-zip.ps1 mon-projet-backend
```

## 🔐 Sécurité

Le script crée automatiquement un fichier `.env.example` à partir de votre `.env` en masquant :
- Mots de passe
- Clés secrètes (APP_SECRET, JWT_SECRET_KEY, etc.)
- URLs de base de données avec credentials
- Tokens et clés API
- Toute variable contenant PASSWORD, SECRET, KEY, TOKEN dans son nom

## 📦 Résultat

Le script génère un fichier ZIP avec le format :
```
sama-backend-YYYYMMDD-HHMMSS.zip
```

Ce ZIP contient uniquement le code source et la configuration nécessaire, sans les dépendances ni les fichiers générés.

## ⚠️ Important

- Le ZIP ne contient **PAS** les dépendances. Il faudra exécuter `composer install` après extraction.
- Les secrets dans `.env.example` sont masqués. Il faudra les remplir manuellement.
- Le dossier `var/` n'est pas inclus (cache/logs). Il sera recréé automatiquement.

## 🔄 Récupération du projet

Après extraction du ZIP, pour restaurer le projet complet :

```bash
# 1. Installer les dépendances
composer install

# 2. Copier et configurer l'environnement
cp .env.example .env
# Éditer .env avec vos propres valeurs

# 3. Créer la base de données
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
```

