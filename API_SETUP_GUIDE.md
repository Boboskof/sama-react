# 🚨 Guide de résolution des problèmes API

## Problème actuel
Votre API Symfony retourne des erreurs 500 (Internal Server Error) car il manque la variable d'environnement `DEFAULT_URI`.

## Solution 1: Configuration de l'API Symfony

### 1. Créer le fichier `.env.local` dans votre projet API Symfony

```bash
# Dans le répertoire de votre API Symfony (pas le frontend)
# Créer un fichier .env.local avec le contenu suivant :

# Configuration de base
APP_ENV=dev
APP_SECRET=your-secret-key-here

# Configuration de la base de données
DATABASE_URL="mysql://username:password@127.0.0.1:3306/database_name"

# Configuration CORS
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'

# Configuration par défaut (OBLIGATOIRE)
DEFAULT_URI=http://localhost:8000

# Configuration MailHog
MAILER_DSN=smtp://localhost:1025
```

### 2. Vérifier la configuration CORS

Dans votre API Symfony, assurez-vous d'avoir le bundle CORS installé :

```bash
composer require nelmio/cors-bundle
```

### 3. Configuration CORS dans `config/packages/nelmio_cors.yaml`

```yaml
nelmio_cors:
    defaults:
        origin_regex: true
        allow_origin: ['^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$']
        allow_methods: ['GET', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE']
        allow_headers: ['Content-Type', 'Authorization', 'X-Requested-With']
        expose_headers: ['Link']
        max_age: 3600
    paths:
        '^/api/':
            allow_origin: ['^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$']
            allow_headers: ['X-Custom-Auth', 'Content-Type', 'Authorization']
            allow_methods: ['POST', 'PUT', 'GET', 'DELETE', 'OPTIONS']
            max_age: 3600
```

## Solution 2: Vérification rapide

### 1. Tester l'API directement

```bash
# Test simple de l'API
curl -X GET http://localhost:8000/api/me
```

### 2. Vérifier les logs Symfony

```bash
# Dans le répertoire de votre API Symfony
tail -f var/log/dev.log
```

## Solution 3: Configuration alternative (si vous n'avez pas accès à l'API)

Si vous ne pouvez pas modifier l'API, vous pouvez configurer un proxy de développement dans Vite :

### 1. Modifier `vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

### 2. Modifier l'URL de base dans vos services

Dans `src/_services/caller.service.ts`, changez :

```typescript
// Au lieu de
baseURL: 'http://localhost:8000/api'

// Utilisez
baseURL: '/api'
```

## Solution 4: Mode développement temporaire

Pour tester rapidement, vous pouvez désactiver CORS dans votre navigateur (⚠️ **UNIQUEMENT pour le développement**) :

### Chrome
```bash
# Lancer Chrome avec CORS désactivé
chrome.exe --user-data-dir="C:/Chrome dev session" --disable-web-security --disable-features=VizDisplayCompositor
```

### Firefox
1. Aller dans `about:config`
2. Rechercher `security.fileuri.strict_origin_policy`
3. Mettre à `false`

## Vérification finale

Une fois la configuration corrigée, vous devriez voir :

1. ✅ Pas d'erreurs CORS dans la console
2. ✅ Réponses 200 au lieu de 500
3. ✅ Données chargées dans le dashboard

## Commandes utiles

```bash
# Redémarrer l'API Symfony
php bin/console cache:clear
php -S localhost:8000 -t public

# Vérifier les services
php bin/console debug:router | grep api

# Tester une route spécifique
curl -H "Accept: application/json" http://localhost:8000/api/me
```

## Prochaines étapes

1. Corriger la configuration de l'API Symfony
2. Redémarrer l'API
3. Tester avec le frontend
4. Configurer MailHog si nécessaire




















