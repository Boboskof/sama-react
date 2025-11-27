# Scripts de création de ZIP pour le frontend React

Ces scripts permettent de créer un ZIP nettoyé du projet React frontend pour le partage.

## ✅ Contenu inclus dans le ZIP

### Dossiers
- `src/` - Tout le code applicatif React
- `public/` - index.html, assets de base

### Fichiers de configuration
- `package.json` et `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml`
- `vite.config.*` / `webpack.config.*` - Configuration du bundler
- `tsconfig.json` - Configuration TypeScript (si utilisé)
- `.eslintrc*` - Configuration ESLint
- `.prettierrc*` - Configuration Prettier
- `tailwind.config.*` - Configuration Tailwind CSS (si utilisé)
- `postcss.config.*` - Configuration PostCSS (si utilisé)
- `babel.config.*` - Configuration Babel (si utilisé)
- `.env.example` - Variables d'environnement avec secrets masqués
- `README.md` - Documentation du projet

## ❌ Contenu exclu (non inclus dans le ZIP)

- `node_modules/` - Dépendances (à réinstaller avec `npm install`)
- `dist/` et `build/` - Fichiers de build (sauf si vous voulez spécifiquement inclure le build)
- `.git/` - Historique Git
- Dossiers IDE (`.idea/`, `.vscode/`, etc.)
- Fichiers temporaires et cache

## 📋 Utilisation

### Sur Linux/Mac (Bash)

```bash
# Rendre le script exécutable
chmod +x create-frontend-zip.sh

# Exécuter depuis le dossier racine du projet React
./create-frontend-zip.sh

# Ou avec un nom personnalisé
./create-frontend-zip.sh mon-projet-frontend
```

### Sur Windows (PowerShell)

```powershell
# Exécuter depuis le dossier racine du projet React
.\create-frontend-zip.ps1

# Ou avec un nom personnalisé
.\create-frontend-zip.ps1 mon-projet-frontend
```

## 🔐 Sécurité

Le script crée automatiquement un fichier `.env.example` à partir de votre `.env` (si présent) en masquant :
- Variables API
- Clés secrètes
- Tokens
- Mots de passe
- Toute variable contenant API, SECRET, KEY, TOKEN, PASSWORD dans son nom

## 📦 Résultat

Le script génère un fichier ZIP avec le format :
```
sama-frontend-YYYYMMDD-HHMMSS.zip
```

Ce ZIP contient uniquement le code source et la configuration nécessaire, sans les dépendances ni les fichiers générés.

## ⚠️ Important

- Le ZIP ne contient **PAS** les dépendances. Il faudra exécuter `npm install` (ou `yarn install` / `pnpm install`) après extraction.
- Les secrets dans `.env.example` sont masqués. Il faudra les remplir manuellement.
- Le dossier `dist/` ou `build/` n'est pas inclus par défaut. Le projet devra être rebuild après installation.

## 🔄 Récupération du projet

Après extraction du ZIP, pour restaurer le projet complet :

```bash
# 1. Installer les dépendances
npm install
# ou
yarn install
# ou
pnpm install

# 2. Configurer l'environnement (si nécessaire)
cp .env.example .env
# Éditer .env avec vos propres valeurs

# 3. Démarrer le serveur de développement
npm run dev
# ou
yarn dev
# ou
pnpm dev
```

## 🎯 Notes supplémentaires

- Le script détecte automatiquement quel gestionnaire de paquets vous utilisez (npm, yarn, pnpm) en fonction des fichiers de lock présents
- Tous les fichiers de configuration courants sont inclus automatiquement
- Le README.md est créé automatiquement si absent, avec des instructions d'installation et de développement

