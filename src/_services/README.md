# Services API - Documentation

Ce dossier contient tous les services pour communiquer avec l'API backend Symfony.

## Structure des services

### 1. `caller.service.jsx` - Système d'appel centralisé
- Configuration de base pour tous les appels API
- Intercepteurs pour la gestion automatique des tokens JWT
- Gestion des erreurs d'authentification (401)

### 2. `user.service.jsx` - Gestion des utilisateurs et authentification
- **Authentification** : `login()`, `register()`, `logout()`
- **Gestion des tokens** : `saveToken()`, `getToken()`, `isLogged()`
- **Gestion des utilisateurs** : `getAllUsers()`, `getOneUser()`, `updateUser()`, `deleteUser()`
- **Profil utilisateur** : `getMe()`, `updateMe()`, `updateMyPassword()`
- **Rôles** : `hasRole()`, `isAdmin()`, `isStagiaire()`

### 3. `appointment.service.jsx` - Gestion des rendez-vous
- **CRUD** : `getAllAppointments()`, `getOneAppointment()`, `createAppointment()`, `updateAppointment()`, `deleteAppointment()`
- **Filtres** : `getTodayAppointments()`, `getUpcomingAppointments()`
- **Actions** : `confirmAppointment()`, `cancelAppointment()`

### 4. `patient.service.jsx` - Gestion des patients
- **CRUD** : `getAllPatients()`, `getOnePatient()`, `createPatient()`, `updatePatient()`, `deletePatient()`
- **Recherche** : `searchPatients()`

### 5. `document.service.jsx` - Gestion des documents médicaux
- **CRUD** : `getAllDocuments()`, `getOneDocument()`, `createDocument()`, `updateDocument()`, `deleteDocument()`
- **Filtres** : `getPatientDocuments()`, `getPendingDocuments()`
- **Actions** : `downloadDocument()`, `validateDocument()`

### 6. `audit.service.jsx` - Journal d'audit
- **Logs** : `getAuditLog()`, `getRecentActivities()`
- **Statistiques** : `getStagiaireStats()`

### 7. `communication.service.jsx` - Gestion des communications
- **CRUD** : `getAllCommunications()`, `getOneCommunication()`, `createCommunication()`, `updateCommunication()`, `deleteCommunication()`
- **Filtres** : `getPatientCommunications()`, `getUnreadCommunications()`, `getRecentCommunications()`
- **Actions** : `markAsRead()`, `markAsUnread()`, `replyToCommunication()`, `archiveCommunication()`


## Utilisation

### Import simple
```javascript
import userService from './_services/user.service';
```

### Import centralisé
```javascript
import { userService, appointmentService } from './_services';
```

### Exemple d'utilisation dans un composant
```javascript
import userService from './_services/user.service';

const Login = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: ""
  });

  const onSubmit = (e) => {
    e.preventDefault();
    userService.login(credentials)
      .then(res => {
        console.log(res.data);
        // Redirection après connexion
        window.location.href = "/";
      })
      .catch(error => {
        console.log(error);
        setErr(error.response?.data?.message);
      });
  };

  return (
    // JSX du formulaire
  );
};
```

## Gestion des tokens

Les tokens JWT sont automatiquement gérés par les intercepteurs :

- **Avant envoi de la requête** : Si utilisateur connecté → ajoute automatiquement le token JWT dans les headers
- **Après la réponse** :
  - Si 200 OK → on laisse passer
  - Si 401 Unauthorized → déconnexion + redirection vers /login
  - Sinon → on transmet l'erreur

## Structure finale du dossier

```
_services/
├── caller.service.jsx      # Système d'appel centralisé
├── user.service.jsx        # Gestion utilisateurs & auth
├── appointment.service.jsx # Gestion rendez-vous
├── patient.service.jsx     # Gestion patients
├── document.service.jsx    # Gestion documents
├── audit.service.jsx       # Journal d'audit
├── communication.service.jsx # Gestion communications
├── index.js               # Export centralisé
└── README.md              # Documentation
```

## Endpoints backend

Les services sont configurés pour communiquer avec les endpoints suivants :
- Base URL : `/api` (proxy Vite configuré)
- Authentification : `/login_check`
- Utilisateurs : `/users/*`
- Rendez-vous : `/rendez-vous/*`
- Patients : `/patients/*`
- Documents : `/documents/*`
- Communications : `/communications/*`
- Audit : `/audit/*`
