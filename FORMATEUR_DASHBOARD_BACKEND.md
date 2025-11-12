# Guide Backend – Données réelles pour le Tableau de bord Formateur

Ce document décrit précisément ce que le frontend attend pour alimenter le tableau de bord formateur avec de vraies données. Il référence les endpoints utilisés et les formes de réponses attendues afin d’éviter les erreurs (redirects, 404) et de garantir un rendu complet.

## 1) Endpoints consommés par le tableau de bord

Le composant `DashboardFormateur.jsx` charge en parallèle:
- `GET /api/formateur/dashboard` (regroupe les KPIs du tableau de bord)
- `GET /api/audit/statistics/period?period=day` (statistiques d’audit par période)

Endpoints formateur déjà disponibles/utilisés ailleurs (utile pour cohérence des données):
- `GET /api/formateur/patients?page=1&per_page=25`
- `GET /api/formateur/rendez-vous?page=1&per_page=25`
- `GET /api/formateur/communications?page=1&per_page=25`

Important: le proxy Vite route vers `/api/…` en dev. Conserver les trailing slashes uniquement quand nécessaire côté back; le front envoie sans slash final pour ces endpoints.

## 2) Schéma attendu – GET /api/formateur/dashboard

Réponse JSON attendue (tous les champs sont requis; mettez des tableaux vides si pas de données):

```
{
  "totalStagiaires": number,
  "totalPatients": number,
  "totalActions": number,
  "activiteAujourdhui": number,
  "topStagiaires": [
    {
      "stagiaire": {
        "id": string,
        "prenom": string,
        "nom": string,
        "email": string,
        "derniereActivite"?: string,
        "nbPatients"?: number,
        "nbActions"?: number,
        "roles"?: string[]
      },
      "nbActions": number,
      "derniereActivite": string,      // ISO 8601
      "progression": number            // 0..100
    }
  ],
  "alertes": [
    {
      "id": string,
      "type": "error" | "warning" | "info",
      "titre": string,
      "description": string,
      "stagiaire_id"?: string,
      "created_at": string,            // ISO 8601
      "lu": boolean
    }
  ],
  "evolutionActivite": [               // pour le graphique d’évolution
    { "date": string, "valeur": number }
  ],
  "repartitionActions": [              // pour le graphique de répartition
    { "label": string, "valeur": number, "couleur": string }
  ]
}
```

Notes d’implémentation côté back:
- Tous les tableaux doivent exister, même vides (évite les `.length` sur `undefined`).
- Les dates doivent être au format ISO 8601.
- `topStagiaires` est un ranking par activité (nombre d’actions auditées récents, par ex.).
- `progression` peut être un pourcentage de variation sur N jours (ex: J vs J-7). Valeur 0 si non calculé.

## 3) Statistiques d’audit – GET /api/audit/statistics/period?period=day

Le front consomme ce retour sous la forme suivante (clés lues):

```
{
  "total_actions_today"?: number,
  "active_users_today"?: number,
  "most_common_action"?: string
}
```

- Les clés sont optionnelles côté front, mais il est préférable de les renvoyer.
- Si vous avez un autre format, ajoutez ces alias dans la réponse.

## 4) Cohérence des autres pages formateur (patients, RDV, communications)

Ces listes existent pour la vue formateur et doivent renvoyer de vraies données cohérentes:

- `GET /api/formateur/patients?page&per_page` → patients créés par des utilisateurs dont `primary_role = ROLE_STAGIAIRE`.
  - Réponse acceptée: `{ data: [...], total?, page?, total_pages? }` OU Hydra `{ "hydra:member": [...] }` OU tableau simple `[...]`.

- `GET /api/formateur/rendez-vous?page&per_page` → RDV créés par des stagiaires.
  - Champs date acceptés: `start_at` (snake) ou `startAt` (camel). Garder ISO 8601.
  - Patient peut être objet ou IRI, mais objet recommandé.

- `GET /api/formateur/communications?page&per_page` → communications créées par des stagiaires.
  - Champs clés: `id`, `patient_id`, `type`, `canal`, `sujet`, `contenu`, `statut`, `createdAt`.

## 5) Recommandations d’implémentation backend

- Performances: calculez les agrégats du dashboard côté SQL (COUNT, GROUP BY, fenêtres) ou via une table matérialisée/cron si nécessaire.
- Sécurité: les endpoints `/api/formateur/*` doivent exiger `ROLE_FORMATEUR` (ou équivalent) et filtrer selon vos règles métier.
- Traçabilité: alimentez les métriques `totalActions`, `activiteAujourdhui`, `topStagiaires` depuis les logs d’audit (si disponibles) pour une vue fidèle.
- Dates: pour `evolutionActivite`, renvoyez les 7 derniers jours triés ascendant (ou descendant mais cohérent), même si valeurs = 0.
- Couleurs: pour `repartitionActions.couleur`, renvoyez un hex/connu (ex: `#4f46e5`) ou une classe connue si vous préférez, mais un hex est simple.

## 6) Exemples de réponses minimales

Dashboard (exemple minimal viable):
```
{
  "totalStagiaires": 4,
  "totalPatients": 27,
  "totalActions": 915,
  "activiteAujourdhui": 23,
  "topStagiaires": [
    {
      "stagiaire": {
        "id": "u1",
        "prenom": "Alice",
        "nom": "Martin",
        "email": "alice@example.com"
      },
      "nbActions": 120,
      "derniereActivite": "2025-10-29T09:42:00Z",
      "progression": 12
    }
  ],
  "alertes": [
    {
      "id": "a1",
      "type": "warning",
      "titre": "Taux d’échec élevé",
      "description": "Plus de 5 communications en échec ce matin",
      "created_at": "2025-10-29T08:10:00Z",
      "lu": false
    }
  ],
  "evolutionActivite": [
    { "date": "2025-10-23", "valeur": 15 },
    { "date": "2025-10-24", "valeur": 21 },
    { "date": "2025-10-25", "valeur": 19 },
    { "date": "2025-10-26", "valeur": 25 },
    { "date": "2025-10-27", "valeur": 18 },
    { "date": "2025-10-28", "valeur": 24 },
    { "date": "2025-10-29", "valeur": 23 }
  ],
  "repartitionActions": [
    { "label": "CREATE", "valeur": 450, "couleur": "#10b981" },
    { "label": "UPDATE", "valeur": 380, "couleur": "#3b82f6" },
    { "label": "DELETE", "valeur": 85,  "couleur": "#ef4444" }
  ]
}
```

Audit period (jour):
```
{
  "total_actions_today": 23,
  "active_users_today": 3,
  "most_common_action": "UPDATE"
}
```

## 7) Points de contrôle rapides (checklist)

- [ ] `/api/formateur/dashboard` renvoie tous les champs listés, mêmes vides
- [ ] Dates au format ISO 8601
- [ ] `topStagiaires[*].stagiaire` object complet (id, prenom, nom, email)
- [ ] `alertes[*].created_at` ISO et `type` ∈ {error, warning, info}
- [ ] `/api/audit/statistics/period?period=day` expose les 3 clés lues
- [ ] Les endpoints `/api/formateur/*` renvoient des listes paginées stables

Avec ces contrats respectés, le tableau de bord formateur affichera des données réelles de manière fiable et sans erreurs côté frontend.

















