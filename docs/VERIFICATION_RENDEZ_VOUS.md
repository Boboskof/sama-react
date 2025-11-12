# 🔍 Vérification du système de rendez-vous

## ❌ Problèmes identifiés

### 1. Pas de filtre automatique par créateur dans le frontend

**Localisation** : `src/_services/appointment.service.ts`

**Statut** : ✅ Le frontend n'ajoute PAS automatiquement de filtre `created_by`
- Contrairement aux communications, le service des rendez-vous ne filtre pas automatiquement par créateur
- Le problème vient donc du **backend** (PlanningService) qui limite aux rendez-vous créés par l'utilisateur connecté

**Code vérifié** :
```typescript
getAppointments: async (params: Record<string, any> = {}): Promise<RendezVous[]> => {
  try {
    const response = await Axios.get("/rendez-vous/", { params: normalizeApptParams(params) });
    // Pas de filtre created_by ajouté automatiquement
    // ...
  }
}
```

### 2. Filtres par date possibles

**Localisation** : `src/pages/stagiaire/Appointments.jsx` (lignes 243-261)

**Problème potentiel** : Des filtres par date peuvent être appliqués côté client qui cachent certains rendez-vous

**Code** :
```javascript
// Filtrage par dates
if (filters.dateDebut) {
  const dateDebut = new Date(filters.dateDebut);
  dateDebut.setHours(0, 0, 0, 0);
  list = list.filter(appt => {
    const apptDate = new Date(appt.startAt || appt.start_at || appt.dateTime);
    apptDate.setHours(0, 0, 0, 0);
    return apptDate >= dateDebut; // ⚠️ Peut cacher les rendez-vous passés
  });
}
```

### 3. Endpoints différents selon le contexte

**Localisation** : `src/_services/appointment.service.ts`

**Problème** : Plusieurs endpoints sont utilisés selon le contexte :
- `/rendez-vous/` - Liste générale (peut être filtrée par le backend)
- `/rendez-vous/futurs` - Rendez-vous futurs uniquement
- `/rendez-vous/tous` - Tous les rendez-vous (historique complet)
- `/formateur/rendez-vous` - Pour les formateurs uniquement

**Impact** : Si le backend filtre par `created_by` sur `/rendez-vous/`, les stagiaires ne verront que leurs propres rendez-vous.

## ✅ Solutions proposées

### Solution 1 : Ajouter un paramètre pour désactiver le filtre backend

**Modification dans `appointments.query.ts`** :

```typescript
export type UIAppointmentFilters = {
  search?: string;
  statut?: string[];
  medecin?: string;
  patientId?: string|number;
  dateDebut?: string;      // YYYY-MM-DD
  dateFin?: string;        // YYYY-MM-DD
  page?: number;
  limit?: number;
  skipAutoFilter?: boolean; // NOUVEAU : Désactive le filtre automatique par created_by côté backend
  createdBy?: string;      // NOUVEAU : Filtrer explicitement par créateur (UUID)
};
```

**Modification dans `buildAppointmentParams`** :

```typescript
export function buildAppointmentParams(f: UIAppointmentFilters): URLSearchParams {
  const p = new URLSearchParams();

  if (f.search) p.append('q', f.search);
  if (f.medecin) p.append('medecin', f.medecin);
  if (f.patientId) p.append('patient_id', String(f.patientId));
  if (f.dateDebut) p.append('date_from', f.dateDebut);
  if (f.dateFin) p.append('date_to', f.dateFin);
  
  // NOUVEAU : Paramètres pour gérer le filtre créateur
  if (f.skipAutoFilter) p.append('skip_auto_filter', 'true');
  if (f.createdBy) p.append('created_by', String(f.createdBy));

  // tableaux → statut[]=A&statut[]=B
  (f.statut ?? []).forEach(v => p.append('statut[]', v));

  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
```

### Solution 2 : Utiliser l'endpoint `/rendez-vous/tous` pour voir tous les rendez-vous

**Modification dans `Appointments.jsx`** :

```javascript
const loadAppointments = useCallback(async () => {
  try {
    setLoading(true);
    const apiFilters = {
      ...filters,
      medecin: selectedMedecinId || filters.medecin,
    };
    
    // NOUVEAU : Utiliser getAllAppointmentsHistory pour voir tous les rendez-vous
    // au lieu de getAllAppointments qui peut être filtré par le backend
    const [data, statusAgg] = await Promise.all([
      appointmentService.getAllAppointmentsHistory(apiFilters), // Changé ici
      appointmentService.getRendezVousStatus().catch(() => null)
    ]);
    // ... reste du code
  }
}, [filters, selectedMedecinId]);
```

### Solution 3 : Ajouter un bouton "Voir tous les rendez-vous" dans l'interface

**Modification dans `Appointments.jsx`** :

```jsx
const [showAllAppointments, setShowAllAppointments] = useState(false);

// Dans le JSX, ajouter un bouton
<div className="mb-4 flex justify-between items-center">
  <h2 className="text-lg font-semibold">Rendez-vous</h2>
  <button
    onClick={() => {
      setShowAllAppointments(!showAllAppointments);
      // Utiliser getAllAppointmentsHistory si showAllAppointments est true
    }}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
  >
    {showAllAppointments ? 'Voir mes rendez-vous' : 'Voir tous les rendez-vous'}
  </button>
</div>
```

### Solution 4 : Vérifier les filtres par date

**Modification dans `Appointments.jsx`** :

```javascript
// S'assurer que les filtres par date ne sont pas appliqués par défaut
const [filters, setFilters] = useState({
  statut: [],
  medecin: undefined,
  patientId: undefined,
  dateDebut: undefined, // ⚠️ Vérifier qu'il n'y a pas de valeur par défaut
  dateFin: undefined,   // ⚠️ Vérifier qu'il n'y a pas de valeur par défaut
  page: 1,
  limit: 25
});
```

## 🔧 Test de vérification

### Test 1 : Vérifier le filtre backend

1. Connectez-vous en tant que stagiaire
2. Ouvrez la console du navigateur (F12)
3. Allez sur la page Rendez-vous
4. Vérifiez la requête réseau : `GET /api/rendez-vous/`
5. Vérifiez si le backend retourne uniquement vos rendez-vous ou tous les rendez-vous

### Test 2 : Vérifier les filtres par date

1. Vérifiez que les filtres `dateDebut` et `dateFin` sont `undefined` par défaut
2. Testez avec des dates pour voir si certains rendez-vous sont cachés
3. Vérifiez que les rendez-vous passés sont bien affichés si aucun filtre n'est appliqué

### Test 3 : Tester l'endpoint `/rendez-vous/tous`

1. Testez directement l'endpoint : `GET /api/rendez-vous/tous`
2. Vérifiez s'il retourne tous les rendez-vous ou seulement ceux créés par l'utilisateur

## 📋 Checklist de vérification

- [ ] Le backend filtre-t-il automatiquement par `created_by` sur `/rendez-vous/` ?
- [ ] L'endpoint `/rendez-vous/tous` retourne-t-il tous les rendez-vous ?
- [ ] Y a-t-il des filtres par date appliqués par défaut dans le frontend ?
- [ ] Les formateurs voient-ils tous les rendez-vous ?
- [ ] Les stagiaires doivent-ils voir tous les rendez-vous ou seulement les leurs ?

## 🎯 Recommandations

1. **Pour les stagiaires** : 
   - Par défaut, voir uniquement leurs propres rendez-vous (sécurité)
   - Option pour voir tous les rendez-vous si nécessaire

2. **Pour les formateurs** : 
   - Voir tous les rendez-vous par défaut
   - Option pour filtrer par créateur si nécessaire

3. **Backend** : 
   - Implémenter un paramètre `skip_auto_filter` ou `all=true` pour désactiver le filtre automatique
   - Ou créer un endpoint dédié `/rendez-vous/all` pour voir tous les rendez-vous

4. **Frontend** : 
   - Ajouter un bouton "Voir tous les rendez-vous" pour les stagiaires
   - Utiliser `/rendez-vous/tous` si disponible
   - Vérifier que les filtres par date ne sont pas appliqués par défaut

## 🔗 Endpoints API testés

- ✅ `GET /api/rendez-vous/` - Liste générale (peut être filtrée par le backend)
- ✅ `GET /api/rendez-vous?date_debut=2025-11-13` - Filtre par date
- ✅ `GET /api/rendez-vous/futurs` - Rendez-vous futurs uniquement
- ✅ `GET /api/rendez-vous/tous` - Tous les rendez-vous (historique complet)
- ✅ `GET /api/formateur/rendez-vous` - Pour les formateurs uniquement

## 📝 Notes importantes

1. **Le problème principal vient du backend** : Le PlanningService limite aux rendez-vous créés par l'utilisateur connecté
2. **Le frontend n'ajoute pas de filtre automatique** : Contrairement aux communications
3. **Les communications ont un champ `rendez_vous`** : Pour lier une communication à un rendez-vous
4. **Plusieurs endpoints disponibles** : Choisir le bon selon le besoin (futurs, tous, formateur)


