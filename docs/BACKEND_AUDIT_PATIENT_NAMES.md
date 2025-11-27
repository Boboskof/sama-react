# Audit Logs - Noms de Patients dans les Messages

## ✅ Situation Actuelle (Backend Mis à Jour)

Le backend inclut maintenant **automatiquement le nom du patient** dans tous les messages d'audit pour toutes les entités liées à un patient. **Tous les formats sont maintenant cohérents** et les anciens logs sont régénérés automatiquement à l'affichage.

## Entités avec Nom du Patient Inclus

Toutes les entités suivantes incluent maintenant le nom du patient dans leurs messages d'audit avec un **format uniforme et cohérent** :

1. **Patient** (`App\Entity\Patient`)
   - **CREATE** : `"Le stagiaire {user} a créé le patient \"{nom_patient}\" à {date}."`
   - **UPDATE** : `"Le stagiaire {user} a modifié le patient \"{nom_patient}\" : {détails}."`
   - Exemple CREATE : `"Le stagiaire Pierre Martin a créé le patient \"Jacques Marion\" à 17/11/2025 14:35."`
   - Exemple UPDATE : `"Le stagiaire Pierre Martin a modifié le patient \"Jacques Marion\" : organismeSecu: null → RATP."`

2. **Document** (`App\Entity\Document`)
   - Format : `"{user} a créé/modifié/supprimé un document pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé un document pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

3. **Communication** (`App\Entity\Communication`)
   - Format : `"{user} a créé/modifié/supprimé une communication pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé une communication pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

4. **RendezVous** (`App\Entity\RendezVous`)
   - Format : `"{user} a créé/modifié/supprimé un rendez-vous pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé un rendez-vous pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

5. **Couverture** (`App\Entity\Couverture`)
   - Format : `"{user} a créé/modifié/supprimé une couverture pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé une couverture pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

6. **Hospitalisation** (`App\Entity\Hospitalisation`)
   - **CREATE** : `"{user} a créé une hospitalisation pour le patient \"{nom_patient}\" (statut {statut}) à {date}."`
   - **UPDATE** : `"{user} a modifié une hospitalisation pour le patient \"{nom_patient}\" : {détails}."`
   - **Transition de statut** : `"{user} a fait passer l'hospitalisation pour le patient \"{nom_patient}\" de {ancien_statut} → {nouveau_statut} à {date}."`
   - Exemple CREATE : `"Pierre Martin a créé une hospitalisation pour le patient \"Jacques Marion\" (statut PROPOSEE) à 17/11/2025 11:31."`
   - Exemple Transition : `"Pierre Martin a fait passer l'hospitalisation pour le patient \"Jacques Marion\" de PROPOSEE → PLANIFIEE à 17/11/2025 11:32."`

## Format Uniforme des Messages

Tous les messages suivent maintenant un **format uniforme et cohérent** :

### Pour les entités liées à un patient (Document, Communication, RendezVous, Couverture, Hospitalisation)

```
{user} a {action} {entité} pour le patient "{nom}" à {date}.
```

### Pour l'entité Patient elle-même

```
Le stagiaire {user} a {action} le patient "{nom}" à {date}.
```

Où :
- `{user}` : Nom complet de l'utilisateur (prénom + nom) - disponible dans `user.full_name`
- `{action}` : Action effectuée (créé, modifié, supprimé)
- `{entité}` : Type d'entité (document, communication, rendez-vous, couverture, hospitalisation, patient)
- `{nom}` : Nom complet du patient (prénom + nom) - toujours entre guillemets `"Nom Patient"`
- `{date}` : Date et heure de l'action (format DD/MM/YYYY HH:MM)

**Important** : Le nom du patient est **toujours** dans une phrase séparée avec `pour le patient "Nom"` et **jamais** après l'ID sous la forme `(#ID – Nom)`.

## Métadonnées Disponibles

Le champ `payload.metadata` contient également les informations du patient :

```json
{
  "payload": {
    "metadata": {
      "patient_id": "019a4a9b-4b04-7563-852a-bdd3e2d2550a",
      "patient_name": "Jacques Marion",
      "ip_address": "127.0.0.1",
      "user_agent": "...",
      "request_uri": "/api/documents",
      "http_method": "POST"
    }
  }
}
```

## Gestion des Cas Limites

### Patient Non Disponible
Si le patient n'est pas disponible (relation nullable ou supprimée), le message affichera :
- `pour le patient #{patient_id}` si seul l'ID est disponible
- Le message sera généré sans mention du patient si aucune information n'est disponible

## Frontend

### Nouveaux Logs
Les nouveaux logs créés après la mise à jour du backend incluent automatiquement le nom du patient dans le champ `message`. Le frontend peut afficher directement ce message sans traitement supplémentaire.

### Anciens Logs - Régénération Automatique
**Les anciens logs sont automatiquement régénérés à l'affichage** grâce à `AuditMessageBuilder`. Le contrôleur détecte les messages au format générique et les régénère avec le nouveau format incluant le nom du patient.

**Aucune action requise côté frontend** - les messages sont toujours au format correct.

### Régénération Manuelle (Optionnel)
Si vous souhaitez mettre à jour les messages stockés en base de données, vous pouvez utiliser la commande :

```bash
# Mode dry-run pour voir les changements sans les appliquer
php bin/console app:audit:regenerate-messages --dry-run --limit 100

# Appliquer les changements
php bin/console app:audit:regenerate-messages --limit 100

# Forcer la régénération même si un message existe déjà
php bin/console app:audit:regenerate-messages --force --limit 100

# Filtrer par type d'entité
php bin/console app:audit:regenerate-messages --entity-type "App\\Entity\\Document" --limit 50
```

### Format de l'Objet User dans la Réponse API

Tous les endpoints retournent maintenant l'objet `user` avec le champ `full_name` :

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "prenom": "...",
    "nom": "...",
    "full_name": "Prénom Nom"  // ✅ Toujours présent
  }
}
```

Le frontend doit utiliser `user.full_name` en priorité pour afficher le nom de l'utilisateur.

## Notes Importantes

1. **Régénération Automatique** : Les anciens logs sont automatiquement régénérés à l'affichage avec le nouveau format. Les messages stockés en base ne sont pas modifiés, mais sont régénérés à la volée par `AuditMessageBuilder`.

2. **Format Cohérent** : Tous les messages suivent maintenant un format uniforme :
   - Le nom du patient est **toujours** dans une phrase séparée : `pour le patient "Nom"`
   - **Plus jamais** de format avec le nom après l'ID : `(#ID – Nom)`
   - Format identique pour toutes les entités (Patient, Document, RendezVous, Couverture, Communication, Hospitalisation)

3. **Performance** : L'extraction du patient se fait automatiquement lors de la création du log, sans impact sur les performances. La régénération à l'affichage est également optimisée.

4. **Patient Nullable** : Pour les entités où le patient est nullable (ex: Communication), le message sera généré sans mention du patient si celui-ci n'est pas défini.

5. **Full Name dans User** : Tous les endpoints retournent maintenant `user.full_name` pour un affichage cohérent des noms d'utilisateurs.

## Référence Backend

Pour plus de détails sur l'implémentation backend, voir :
- `docs/FRONTEND_AUDIT_MESSAGES_PATIENT.md` (dans le projet Symfony)
## ✅ Situation Actuelle (Backend Mis à Jour)

Le backend inclut maintenant **automatiquement le nom du patient** dans tous les messages d'audit pour toutes les entités liées à un patient. **Tous les formats sont maintenant cohérents** et les anciens logs sont régénérés automatiquement à l'affichage.

## Entités avec Nom du Patient Inclus

Toutes les entités suivantes incluent maintenant le nom du patient dans leurs messages d'audit avec un **format uniforme et cohérent** :

1. **Patient** (`App\Entity\Patient`)
   - **CREATE** : `"Le stagiaire {user} a créé le patient \"{nom_patient}\" à {date}."`
   - **UPDATE** : `"Le stagiaire {user} a modifié le patient \"{nom_patient}\" : {détails}."`
   - Exemple CREATE : `"Le stagiaire Pierre Martin a créé le patient \"Jacques Marion\" à 17/11/2025 14:35."`
   - Exemple UPDATE : `"Le stagiaire Pierre Martin a modifié le patient \"Jacques Marion\" : organismeSecu: null → RATP."`

2. **Document** (`App\Entity\Document`)
   - Format : `"{user} a créé/modifié/supprimé un document pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé un document pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

3. **Communication** (`App\Entity\Communication`)
   - Format : `"{user} a créé/modifié/supprimé une communication pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé une communication pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

4. **RendezVous** (`App\Entity\RendezVous`)
   - Format : `"{user} a créé/modifié/supprimé un rendez-vous pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé un rendez-vous pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

5. **Couverture** (`App\Entity\Couverture`)
   - Format : `"{user} a créé/modifié/supprimé une couverture pour le patient \"{nom_patient}\" à {date}."`
   - Exemple : `"Pierre Martin a créé une couverture pour le patient \"Jacques Marion\" à 17/11/2025 14:35."`

6. **Hospitalisation** (`App\Entity\Hospitalisation`)
   - **CREATE** : `"{user} a créé une hospitalisation pour le patient \"{nom_patient}\" (statut {statut}) à {date}."`
   - **UPDATE** : `"{user} a modifié une hospitalisation pour le patient \"{nom_patient}\" : {détails}."`
   - **Transition de statut** : `"{user} a fait passer l'hospitalisation pour le patient \"{nom_patient}\" de {ancien_statut} → {nouveau_statut} à {date}."`
   - Exemple CREATE : `"Pierre Martin a créé une hospitalisation pour le patient \"Jacques Marion\" (statut PROPOSEE) à 17/11/2025 11:31."`
   - Exemple Transition : `"Pierre Martin a fait passer l'hospitalisation pour le patient \"Jacques Marion\" de PROPOSEE → PLANIFIEE à 17/11/2025 11:32."`

## Format Uniforme des Messages

Tous les messages suivent maintenant un **format uniforme et cohérent** :

### Pour les entités liées à un patient (Document, Communication, RendezVous, Couverture, Hospitalisation)

```
{user} a {action} {entité} pour le patient "{nom}" à {date}.
```

### Pour l'entité Patient elle-même

```
Le stagiaire {user} a {action} le patient "{nom}" à {date}.
```

Où :
- `{user}` : Nom complet de l'utilisateur (prénom + nom) - disponible dans `user.full_name`
- `{action}` : Action effectuée (créé, modifié, supprimé)
- `{entité}` : Type d'entité (document, communication, rendez-vous, couverture, hospitalisation, patient)
- `{nom}` : Nom complet du patient (prénom + nom) - toujours entre guillemets `"Nom Patient"`
- `{date}` : Date et heure de l'action (format DD/MM/YYYY HH:MM)

**Important** : Le nom du patient est **toujours** dans une phrase séparée avec `pour le patient "Nom"` et **jamais** après l'ID sous la forme `(#ID – Nom)`.

## Métadonnées Disponibles

Le champ `payload.metadata` contient également les informations du patient :

```json
{
  "payload": {
    "metadata": {
      "patient_id": "019a4a9b-4b04-7563-852a-bdd3e2d2550a",
      "patient_name": "Jacques Marion",
      "ip_address": "127.0.0.1",
      "user_agent": "...",
      "request_uri": "/api/documents",
      "http_method": "POST"
    }
  }
}
```

## Gestion des Cas Limites

### Patient Non Disponible
Si le patient n'est pas disponible (relation nullable ou supprimée), le message affichera :
- `pour le patient #{patient_id}` si seul l'ID est disponible
- Le message sera généré sans mention du patient si aucune information n'est disponible

## Frontend

### Nouveaux Logs
Les nouveaux logs créés après la mise à jour du backend incluent automatiquement le nom du patient dans le champ `message`. Le frontend peut afficher directement ce message sans traitement supplémentaire.

### Anciens Logs - Régénération Automatique
**Les anciens logs sont automatiquement régénérés à l'affichage** grâce à `AuditMessageBuilder`. Le contrôleur détecte les messages au format générique et les régénère avec le nouveau format incluant le nom du patient.

**Aucune action requise côté frontend** - les messages sont toujours au format correct.

### Régénération Manuelle (Optionnel)
Si vous souhaitez mettre à jour les messages stockés en base de données, vous pouvez utiliser la commande :

```bash
# Mode dry-run pour voir les changements sans les appliquer
php bin/console app:audit:regenerate-messages --dry-run --limit 100

# Appliquer les changements
php bin/console app:audit:regenerate-messages --limit 100

# Forcer la régénération même si un message existe déjà
php bin/console app:audit:regenerate-messages --force --limit 100

# Filtrer par type d'entité
php bin/console app:audit:regenerate-messages --entity-type "App\\Entity\\Document" --limit 50
```

### Format de l'Objet User dans la Réponse API

Tous les endpoints retournent maintenant l'objet `user` avec le champ `full_name` :

```json
{
  "user": {
    "id": "...",
    "email": "...",
    "prenom": "...",
    "nom": "...",
    "full_name": "Prénom Nom"  // ✅ Toujours présent
  }
}
```

Le frontend doit utiliser `user.full_name` en priorité pour afficher le nom de l'utilisateur.

## Notes Importantes

1. **Régénération Automatique** : Les anciens logs sont automatiquement régénérés à l'affichage avec le nouveau format. Les messages stockés en base ne sont pas modifiés, mais sont régénérés à la volée par `AuditMessageBuilder`.

2. **Format Cohérent** : Tous les messages suivent maintenant un format uniforme :
   - Le nom du patient est **toujours** dans une phrase séparée : `pour le patient "Nom"`
   - **Plus jamais** de format avec le nom après l'ID : `(#ID – Nom)`
   - Format identique pour toutes les entités (Patient, Document, RendezVous, Couverture, Communication, Hospitalisation)

3. **Performance** : L'extraction du patient se fait automatiquement lors de la création du log, sans impact sur les performances. La régénération à l'affichage est également optimisée.

4. **Patient Nullable** : Pour les entités où le patient est nullable (ex: Communication), le message sera généré sans mention du patient si celui-ci n'est pas défini.

5. **Full Name dans User** : Tous les endpoints retournent maintenant `user.full_name` pour un affichage cohérent des noms d'utilisateurs.

## Référence Backend

Pour plus de détails sur l'implémentation backend, voir :
- `docs/FRONTEND_AUDIT_MESSAGES_PATIENT.md` (dans le projet Symfony)