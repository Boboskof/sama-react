# Configuration MailHog pour les tests d'emails

## 🚀 Démarrage rapide

### Option 1: Script automatique (recommandé)
```bash
# Windows PowerShell
.\start-dev.ps1

# Linux/Mac
./start-dev.sh
```

### Option 2: Manuel
```bash
# 1. Démarrer MailHog
docker-compose up -d mailhog

# 2. Vérifier que MailHog est accessible
# Ouvrir http://localhost:8025 dans votre navigateur

# 3. Démarrer votre API avec la configuration MailHog
# (ajustez selon votre configuration)

# 4. Démarrer le frontend
npm run dev
```

## 📧 Utilisation

### 1. Interface MailHog
- **URL**: http://localhost:8025
- **Fonctionnalités**:
  - Voir tous les emails envoyés
  - Prévisualiser le contenu HTML
  - Télécharger les emails
  - Rechercher dans les emails

### 2. Test depuis l'interface
1. Allez sur la page Communications
2. Cliquez sur le bouton "📧 Test MailHog"
3. Vérifiez les emails dans l'interface MailHog

### 3. Configuration API
Votre API doit être configurée pour utiliser MailHog :

```env
MAILER_DSN=smtp://localhost:1025
MAILER_HOST=localhost
MAILER_PORT=1025
MAILER_USERNAME=
MAILER_PASSWORD=
MAILER_ENCRYPTION=null
```

## 🔧 Types d'emails de test

Le bouton de test envoie automatiquement :
- **Rappel de RDV**: Email de rappel de rendez-vous
- **Confirmation RDV**: Email de confirmation
- **Annulation RDV**: Email d'annulation

## 🐛 Dépannage

### MailHog ne démarre pas
```bash
# Vérifier que Docker est démarré
docker --version

# Vérifier les ports libres
netstat -an | findstr :8025
netstat -an | findstr :1025

# Redémarrer MailHog
docker-compose down
docker-compose up -d mailhog
```

### Emails ne s'affichent pas
1. Vérifiez que votre API utilise la bonne configuration SMTP
2. Vérifiez les logs de l'API
3. Vérifiez que MailHog est accessible sur http://localhost:8025

### Ports occupés
Si les ports 8025 ou 1025 sont occupés, modifiez le fichier `docker-compose.yml` :
```yaml
ports:
  - "1026:1025"  # Port SMTP
  - "8026:8025"  # Interface web
```

## 📝 Notes importantes

- MailHog ne stocke les emails que temporairement
- Les emails sont perdus au redémarrage de MailHog
- Pour la production, utilisez un vrai service SMTP
- MailHog est uniquement pour le développement




















