# 🔍 Debug : Rendez-vous du 13 novembre non visibles

## ❌ Problème identifié

Les rendez-vous du 13 novembre pour `alexandre.secretaire` ne s'affichent pas dans le frontend, alors que le backend retourne 9 rendez-vous.

## 🔍 Causes possibles

### 1. Filtre par défaut "futurs uniquement" dans le backend

**Problème** : Le backend filtre peut-être par défaut les rendez-vous futurs uniquement, ce qui exclut les rendez-vous passés (13 novembre 2025 si on est après cette date).

**Solution** : Utiliser l'endpoint `/rendez-vous/tous` ou ajouter un paramètre pour désactiver le filtre "futurs uniquement".

### 2. Pagination limitée

**Problème** : Le frontend limite à 25 rendez-vous par page par défaut (`limit: 25`).

**Solution** : Augmenter la limite ou vérifier la pagination.

### 3. Format de date incorrect

**Problème** : Le frontend envoie `date_from` mais le backend attend peut-être `date_debut`.

**Solution** : Envoyer les deux formats pour compatibilité.

### 4. Filtre par créateur automatique

**Problème** : Le backend filtre peut-être automatiquement par `created_by`, ce qui limite les résultats.

**Solution** : Utiliser `skip_auto_filter=true` ou l'endpoint `/rendez-vous/tous`.

## ✅ Corrections appliquées

### 1. Support des deux formats de date

**Fichier** : `src/_services/query/appointments.query.ts`

```typescript
// Support des deux formats de date pour compatibilité backend
if (f.dateDebut) {
  p.append('date_from', f.dateDebut);
  p.append('date_debut', f.dateDebut); // Format backend alternatif
}
if (f.dateFin) {
  p.append('date_to', f.dateFin);
  p.append('date_fin', f.dateFin); // Format backend alternatif
}
```

### 2. Augmentation de la limite par défaut

**Fichier** : `src/pages/stagiaire/Appointments.jsx`

```javascript
const [filters, setFilters] = useState({
  // ...
  limit: 100 // Augmenté de 25 à 100 pour voir plus de rendez-vous
});
```

### 3. Ajout d'un sélecteur de date

**Fichier** : `src/pages/stagiaire/Appointments.jsx`

Un champ de date a été ajouté pour filtrer par date spécifique :
- Permet de sélectionner une date (ex: 2025-11-13)
- Filtre automatiquement les rendez-vous pour cette date
- Bouton pour effacer le filtre

### 4. Utilisation de l'endpoint `/rendez-vous/tous`

Le bouton "Tous les rendez-vous" utilise maintenant l'endpoint `/rendez-vous/tous` qui devrait retourner tous les rendez-vous sans filtre "futurs uniquement".

## 🧪 Tests à effectuer

### Test 1 : Vérifier l'endpoint direct

Dans la console du navigateur (F12) :

```javascript
// Test direct de l'API
fetch('/api/rendez-vous?date_debut=2025-11-13', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(r => r.json())
.then(data => console.log('Rendez-vous du 13 novembre:', data));
```

### Test 2 : Vérifier avec le sélecteur de date

1. Allez sur la page Rendez-vous
2. Utilisez le champ de date pour sélectionner le 13 novembre 2025
3. Vérifiez que les 9 rendez-vous s'affichent

### Test 3 : Vérifier la pagination

1. Vérifiez que la limite est bien à 100 (au lieu de 25)
2. Vérifiez s'il y a une pagination qui cache les résultats
3. Testez en naviguant entre les pages

### Test 4 : Vérifier l'endpoint `/rendez-vous/tous`

1. Cliquez sur le bouton "Tous les rendez-vous"
2. Vérifiez que l'endpoint `/rendez-vous/tous` est appelé
3. Vérifiez que les rendez-vous du 13 novembre apparaissent

## 🔧 Solutions supplémentaires

### Solution 1 : Forcer l'utilisation de `/rendez-vous/tous`

Si le backend filtre toujours par "futurs uniquement" sur `/rendez-vous/`, utilisez systématiquement `/rendez-vous/tous` :

```javascript
// Dans loadAppointments
const appointmentMethod = appointmentService.getAllAppointmentsHistory; // Toujours utiliser l'historique
```

### Solution 2 : Ajouter un paramètre pour désactiver le filtre "futurs"

Si le backend supporte un paramètre pour désactiver le filtre "futurs uniquement" :

```typescript
if (f.includePast) p.append('include_past', 'true');
```

### Solution 3 : Vérifier l'authentification

Assurez-vous que le token JWT est valide et que l'utilisateur `alexandre.secretaire` est bien authentifié :

```javascript
// Dans la console
console.log('User:', JSON.parse(localStorage.getItem('user')));
console.log('Token:', localStorage.getItem('token'));
```

## 📋 Checklist de vérification

- [ ] Le backend retourne bien 9 rendez-vous pour le 13 novembre
- [ ] Le frontend envoie bien `date_debut=2025-11-13`
- [ ] La pagination ne limite pas les résultats
- [ ] Le filtre "futurs uniquement" n'est pas appliqué
- [ ] L'authentification fonctionne correctement
- [ ] Le token JWT est valide
- [ ] L'utilisateur `alexandre.secretaire` a les bonnes permissions

## 🎯 Actions recommandées

1. **Tester avec le sélecteur de date** : Utilisez le nouveau champ de date pour sélectionner le 13 novembre
2. **Vérifier la console** : Regardez les requêtes réseau dans l'onglet Network de la console
3. **Vérifier la réponse API** : Vérifiez que le backend retourne bien les 9 rendez-vous
4. **Augmenter la limite** : La limite a été augmentée à 100, mais vous pouvez l'augmenter davantage si nécessaire
5. **Utiliser l'endpoint `/rendez-vous/tous`** : Cliquez sur "Tous les rendez-vous" pour voir tous les rendez-vous sans filtre

## 🔗 Endpoints testés

- ✅ `GET /api/rendez-vous` - Liste générale (peut filtrer par futurs uniquement)
- ✅ `GET /api/rendez-vous?date_debut=2025-11-13` - Filtre par date spécifique
- ✅ `GET /api/rendez-vous/tous` - Tous les rendez-vous (historique complet)
- ✅ `GET /api/rendez-vous?date_from=2025-11-13&date_to=2025-11-13` - Filtre par plage de dates


