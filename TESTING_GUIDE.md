# 🧪 Guide de test de l'application

## ✅ Problèmes résolus

1. **Erreurs CORS** : Résolues ✅
2. **Erreurs 500** : Résolues ✅  
3. **Authentification** : Système de développement ajouté ✅

## 🚀 Comment tester maintenant

### 1. Démarrer l'application

```bash
# Dans le terminal du frontend
npm run dev
```

### 2. Se connecter en mode développement

1. Ouvrez http://localhost:5173
2. Cliquez sur le bouton **"🔑 Connexion Dev"** en haut à droite
3. Utilisez les identifiants par défaut :
   - **Email** : `admin@example.com`
   - **Mot de passe** : `password`
4. Cliquez sur **"Se connecter (Mode Dev)"**

### 3. Vérifier que tout fonctionne

Après connexion, vous devriez voir :

- ✅ **Header** : Nom d'utilisateur affiché
- ✅ **Dashboard** : Données chargées (même si vides)
- ✅ **Navigation** : Tous les menus fonctionnels
- ✅ **Pas d'erreurs** dans la console

### 4. Tester les différentes pages

- **Dashboard** : `/` - Tableau de bord principal
- **Patients** : `/patients` - Liste des patients
- **Rendez-vous** : `/appointments` - Gestion des RDV
- **Documents** : `/documents` - Gestion des documents
- **Communications** : `/communications` - Gestion des communications

## 🔧 Configuration de l'API

Si vous voulez que l'API retourne de vraies données, vous devez :

### 1. Configurer la base de données

Dans votre API Symfony, créez un fichier `.env.local` :

```env
# Configuration de base
APP_ENV=dev
APP_SECRET=your-secret-key-here

# Configuration de la base de données
DATABASE_URL="mysql://username:password@127.0.0.1:3306/database_name"

# Configuration CORS
CORS_ALLOW_ORIGIN='^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$'

# Configuration par défaut (OBLIGATOIRE)
DEFAULT_URI=http://localhost:8000
```

### 2. Créer des données de test

```bash
# Dans le répertoire de votre API Symfony
php bin/console doctrine:database:create
php bin/console doctrine:migrations:migrate
php bin/console doctrine:fixtures:load
```

### 3. Créer un utilisateur de test

```bash
# Créer un utilisateur avec un token JWT valide
php bin/console app:create-user admin@example.com password
```

## 🐛 Dépannage

### Problème : "JWT Token not found"
- **Solution** : Utilisez le bouton "Connexion Dev" pour vous connecter

### Problème : "Network Error"
- **Solution** : Vérifiez que l'API Symfony est démarrée sur le port 8000

### Problème : "CORS policy"
- **Solution** : L'API doit être configurée avec les bonnes règles CORS

### Problème : "500 Internal Server Error"
- **Solution** : Vérifiez les logs de l'API et la configuration des variables d'environnement

## 📝 Prochaines étapes

1. **Tester l'interface** : Naviguer dans toutes les pages
2. **Configurer l'API** : Mettre en place la base de données
3. **Créer des données** : Ajouter des patients, RDV, etc.
4. **Tester MailHog** : Utiliser le bouton "Test MailHog" dans Communications

## 🎯 Fonctionnalités à tester

- [ ] Connexion/Déconnexion
- [ ] Navigation entre les pages
- [ ] Affichage du dashboard
- [ ] Gestion des patients
- [ ] Gestion des rendez-vous
- [ ] Gestion des documents
- [ ] Gestion des communications
- [ ] Test d'envoi d'emails (MailHog)

## 📞 Support

Si vous rencontrez des problèmes :

1. Vérifiez la console du navigateur (F12)
2. Vérifiez les logs de l'API Symfony
3. Vérifiez que tous les services sont démarrés
4. Consultez le fichier `API_SETUP_GUIDE.md` pour la configuration de l'API




















