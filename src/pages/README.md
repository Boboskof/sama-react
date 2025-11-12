# Organisation des Pages

Cette structure organise les pages par rôle et fonctionnalité pour une meilleure maintenabilité.

## Structure

```
src/pages/
├── Login.jsx         # Page de connexion (partagée)
├── stagiaire/        # Pages pour les stagiaires
│   ├── Dashboard.jsx
│   ├── Patients.jsx
│   ├── PatientSingle.jsx
│   ├── NouveauPatient.jsx
│   ├── Appointments.jsx
│   ├── Documents.jsx
│   ├── Communications.jsx
│   └── LogsAudit.jsx
└── formateur/        # Pages spécifiques aux formateurs
    ├── DashboardFormateur.jsx
    ├── Formateur.jsx
    ├── Stagiaires.jsx
    ├── StagiaireDetails.jsx
    └── TestFormateur.jsx
```

## Utilisation

### Import direct
```javascript
import Login from './pages/Login';
import Dashboard from './pages/stagiaire/Dashboard';
import DashboardFormateur from './pages/formateur/DashboardFormateur';
```

## Règles d'organisation

- **Login.jsx** : Page de connexion partagée entre tous les rôles
- **stagiaire/** : Pages pour les stagiaires (patients, rendez-vous, documents, etc.)
- **formateur/** : Pages spécifiques à la gestion des formateurs (dashboard formateur, gestion des stagiaires)

Cette organisation facilite :
- La maintenance du code
- La compréhension des fonctionnalités par rôle
- L'ajout de nouvelles pages
- La séparation des responsabilités
