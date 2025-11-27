# API de Réinitialisation de Mot de Passe

## Vue d'ensemble

Cette documentation décrit les endpoints API pour la réinitialisation de mot de passe. Le système permet aux utilisateurs de demander une réinitialisation de leur mot de passe via email et de définir un nouveau mot de passe avec un token sécurisé.

## Endpoints

### 1. Demander une réinitialisation de mot de passe

**Endpoint** : `POST /api/password/forgot`

**Description** : Envoie un email avec un lien de réinitialisation à l'utilisateur.

**Authentification** : Non requise (endpoint public)

**Corps de la requête** :
```json
{
  "email": "user@example.com"
}
```

**Réponse de succès (200)** :
```json
{
  "message": "Si cette adresse email existe dans notre système, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe."
}
```

**Réponses d'erreur** :

- **400 Bad Request** - Email manquant ou invalide :
```json
{
  "error": "L'adresse email est requise"
}
```
ou
```json
{
  "error": "Format d'email invalide"
}
```

**Notes importantes** :
- Pour des raisons de sécurité, cette endpoint retourne **toujours un succès**, même si l'email n'existe pas dans le système.
- Cela empêche les attaquants de découvrir quels emails sont enregistrés dans la base de données.
- L'email contient un lien avec un token valide pendant **24 heures**.

---

### 2. Vérifier la validité d'un token

**Endpoint** : `GET /api/password/verify/{token}`

**Description** : Vérifie si un token de réinitialisation est valide (sans le consommer).

**Authentification** : Non requise (endpoint public)

**Paramètres d'URL** :
- `token` : Le token de réinitialisation à vérifier

**Réponse de succès (200)** :
```json
{
  "valid": true,
  "message": "Token valide"
}
```

**Réponse d'erreur (400)** :
```json
{
  "valid": false,
  "error": "Token invalide ou expiré"
}
```

**Cas d'utilisation** :
- Vérifier côté frontend si le token est encore valide avant d'afficher le formulaire de réinitialisation.
- Afficher un message d'erreur si le token est expiré ou invalide.

---

### 3. Réinitialiser le mot de passe

**Endpoint** : `POST /api/password/reset`

**Description** : Réinitialise le mot de passe avec un token valide.

**Authentification** : Non requise (endpoint public)

**Corps de la requête** :
```json
{
  "token": "abc123def456...",
  "password": "nouveauMotDePasse123"
}
```

**Réponse de succès (200)** :
```json
{
  "message": "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."
}
```

**Réponses d'erreur** :

- **400 Bad Request** - Token manquant :
```json
{
  "error": "Le token est requis"
}
```

- **400 Bad Request** - Mot de passe manquant :
```json
{
  "error": "Le nouveau mot de passe est requis"
}
```

- **400 Bad Request** - Mot de passe trop court :
```json
{
  "error": "Le mot de passe doit contenir au moins 6 caractères"
}
```

- **400 Bad Request** - Token invalide ou expiré :
```json
{
  "error": "Token invalide ou expiré"
}
```

**Notes importantes** :
- Le token est **consommé** après utilisation (marqué comme utilisé).
- Tous les autres tokens actifs de l'utilisateur sont invalidés après une réinitialisation réussie.
- Le token expire après **24 heures**.

---

## Flux d'utilisation

### Étape 1 : Demander la réinitialisation

L'utilisateur saisit son email sur la page "Mot de passe oublié" :

```javascript
const response = await fetch('http://localhost:8000/api/password/forgot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

const data = await response.json();
// Toujours afficher le message de succès, même si l'email n'existe pas
console.log(data.message);
```

### Étape 2 : Recevoir l'email

L'utilisateur reçoit un email avec un lien contenant le token :
```
http://localhost:5173/reset-password?token=abc123def456...
```

### Étape 3 : Vérifier le token (optionnel)

Avant d'afficher le formulaire, vérifier que le token est valide :

```javascript
const token = new URLSearchParams(window.location.search).get('token');

const response = await fetch(`http://localhost:8000/api/password/verify/${token}`, {
  method: 'GET'
});

const data = await response.json();

if (!data.valid) {
  // Afficher un message d'erreur
  console.error(data.error);
} else {
  // Afficher le formulaire de réinitialisation
}
```

### Étape 4 : Réinitialiser le mot de passe

L'utilisateur saisit son nouveau mot de passe :

```javascript
const response = await fetch('http://localhost:8000/api/password/reset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: token,
    password: 'nouveauMotDePasse123'
  })
});

const data = await response.json();

if (response.ok) {
  // Rediriger vers la page de connexion
  window.location.href = '/login';
} else {
  // Afficher l'erreur
  console.error(data.error);
}
```

---

## Exemple d'implémentation React

### Composant ForgotPassword.jsx

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('http://localhost:8000/api/password/forgot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password">
      <h1>Mot de passe oublié</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Envoi...' : 'Envoyer'}
        </button>
      </form>
      <button onClick={() => navigate('/login')}>
        Retour à la connexion
      </button>
    </div>
  );
};

export default ForgotPassword;
```

### Composant ResetPassword.jsx

```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Vérifier la validité du token au chargement
    const verifyToken = async () => {
      if (!token) {
        setTokenValid(false);
        setError('Token manquant');
        return;
      }

      try {
        const response = await fetch(`http://localhost:8000/api/password/verify/${token}`, {
          method: 'GET',
        });

        const data = await response.json();
        setTokenValid(data.valid);

        if (!data.valid) {
          setError(data.error || 'Token invalide ou expiré');
        }
      } catch (err) {
        setTokenValid(false);
        setError('Impossible de vérifier le token');
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/password/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Rediriger vers la page de connexion avec un message de succès
        navigate('/login', { state: { message: data.message } });
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch (err) {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === null) {
    return <div>Vérification du token...</div>;
  }

  if (!tokenValid) {
    return (
      <div className="reset-password">
        <h1>Token invalide</h1>
        <p>{error}</p>
        <button onClick={() => navigate('/forgot-password')}>
          Demander un nouveau lien
        </button>
      </div>
    );
  }

  return (
    <div className="reset-password">
      <h1>Réinitialiser votre mot de passe</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">Nouveau mot de passe</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirmer le mot de passe</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Réinitialisation...' : 'Réinitialiser'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
```

---

## Configuration requise

### Variables d'environnement

Le backend nécessite les variables d'environnement suivantes :

```env
# URL du frontend (pour les liens dans les emails)
FRONTEND_URL=http://localhost:5173

# Configuration du mailer (DSN)
MAILER_DSN=smtp://user:pass@smtp.example.com:587
# Ou pour le développement local (sans envoi réel)
MAILER_DSN=null://null
```

### Migration de base de données

Avant d'utiliser l'API, exécutez la migration pour créer la table `password_reset_tokens` :

```bash
php bin/console doctrine:migrations:migrate
```

---

## Sécurité

1. **Tokens sécurisés** : Les tokens sont générés avec `random_bytes(32)` (64 caractères hexadécimaux).
2. **Expiration** : Les tokens expirent après 24 heures.
3. **Usage unique** : Les tokens sont marqués comme utilisés après réinitialisation.
4. **Invalidation** : Tous les tokens actifs d'un utilisateur sont invalidés après une réinitialisation réussie.
5. **Pas de révélation d'email** : L'endpoint de demande retourne toujours un succès, même si l'email n'existe pas.

---

## Gestion des erreurs

### Erreurs réseau

```javascript
try {
  const response = await fetch('...');
  // ...
} catch (err) {
  if (err.name === 'TypeError' && err.message.includes('fetch')) {
    // Erreur réseau
    console.error('Impossible de se connecter au serveur');
  }
}
```

### Erreurs HTTP

```javascript
if (!response.ok) {
  const data = await response.json();
  // Afficher data.error à l'utilisateur
  console.error(data.error);
}
```

---

## Notes importantes

1. **URL du frontend** : Assurez-vous que la variable `FRONTEND_URL` est correctement configurée dans le `.env` du backend.
2. **Configuration email** : Pour le développement, vous pouvez utiliser `MAILER_DSN=null://null` pour désactiver l'envoi réel d'emails (les emails seront loggés dans les logs Symfony).
3. **Nettoyage des tokens** : Les tokens expirés peuvent être nettoyés automatiquement via une commande cron (optionnel).
4. **CORS** : Assurez-vous que les headers CORS sont correctement configurés pour permettre les requêtes depuis le frontend.

