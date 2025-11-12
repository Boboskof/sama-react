# 🔍 Vérification du système de communications

## ❌ Problèmes identifiés

### 1. Filtrage automatique par créateur (PROBLÈME PRINCIPAL)

**Localisation** : `src/_services/communication.service.ts` (lignes 64-87)

**Problème** : Le frontend filtre automatiquement les communications par `created_by` pour les stagiaires (non formateurs). Cela signifie que :
- Les stagiaires ne voient QUE leurs propres communications
- Les formateurs voient toutes les communications (comportement correct)

**Code problématique** :
```typescript
// Filtrer par créateur automatiquement pour les stagiaires (non formateur/admin)
try {
  const userRaw = localStorage.getItem('user');
  if (userRaw) {
    const me = JSON.parse(userRaw);
    const roles: string[] = me?.roles || [];
    const isFormateur = roles.includes('ROLE_FORMATEUR') || roles.includes('ROLE_ADMIN');
    if (!isFormateur && me?.id) {
      const uid = String(me.id);
      // Paramètre exact requis par l'API: created_by = UUID
      params.set('created_by', uid);  // ⚠️ Filtre automatique
      // ... autres paramètres de compatibilité
    }
  }
} catch {}
```

**Impact** :
- Si vous êtes stagiaire, vous ne verrez jamais les communications créées par d'autres utilisateurs
- Même avec `GET /api/communications`, le frontend ajoute automatiquement `created_by={VOTRE_ID}`

### 2. Pagination par défaut

**Localisation** : `src/pages/stagiaire/Communications.jsx` (ligne 33)

**Statut** : ✅ Correct
- Limit par défaut : 25 (conforme à l'API)
- Pagination fonctionnelle

### 3. Cache TanStack Query

**Localisation** : `src/hooks/useCommunications.ts` (ligne 11)

**Problème** : Le cache est configuré avec `staleTime: 5 * 60 * 1000` (5 minutes)
- Les données peuvent être mises en cache pendant 5 minutes
- Même après un rechargement, les anciennes données peuvent être affichées

**Code** :
```typescript
export const useCommunications = (filters: UICommFilters = {}) => {
  return useQuery({
    queryKey: ['communications', filters],
    queryFn: () => communicationService.getCommunications(filters),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // ⚠️ Cache de 5 minutes
  });
};
```

## ✅ Solutions proposées

### Solution 1 : Ajouter un paramètre pour désactiver le filtre automatique

**Modification dans `communication.service.ts`** :

```typescript
async getCommunications(filters: UICommFilters = {}): Promise<Communication[]> {
  try {
    const params = buildCommParams(filters);
    
    // NOUVEAU : Permettre de désactiver le filtre automatique
    const skipAutoFilter = filters.skipAutoFilter === true;
    
    // Filtrer par créateur automatiquement pour les stagiaires (non formateur/admin)
    // SAUF si skipAutoFilter est activé
    if (!skipAutoFilter) {
      try {
        const userRaw = localStorage.getItem('user');
        if (userRaw) {
          const me = JSON.parse(userRaw);
          const roles: string[] = me?.roles || [];
          const isFormateur = roles.includes('ROLE_FORMATEUR') || roles.includes('ROLE_ADMIN');
          if (!isFormateur && me?.id) {
            const uid = String(me.id);
            params.set('created_by', uid);
            // ... reste du code
          }
        }
      } catch {}
    }
    
    // ... reste du code
  }
}
```

### Solution 2 : Ajouter un bouton "Voir toutes les communications" pour les formateurs

**Modification dans `Communications.jsx`** :

```jsx
const [showAllCommunications, setShowAllCommunications] = useState(false);

// Dans le JSX
{isFormateur && (
  <button
    onClick={() => {
      setShowAllCommunications(!showAllCommunications);
      setFilters(prev => ({
        ...prev,
        skipAutoFilter: !showAllCommunications,
        page: 1
      }));
    }}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
  >
    {showAllCommunications ? 'Voir mes communications' : 'Voir toutes les communications'}
  </button>
)}
```

### Solution 3 : Réduire le temps de cache ou ajouter un bouton de rafraîchissement

**Modification dans `useCommunications.ts`** :

```typescript
export const useCommunications = (filters: UICommFilters = {}) => {
  return useQuery({
    queryKey: ['communications', filters],
    queryFn: () => communicationService.getCommunications(filters),
    keepPreviousData: true,
    staleTime: 1 * 60 * 1000, // ⚠️ Réduire à 1 minute au lieu de 5
    cacheTime: 5 * 60 * 1000, // Garder en cache 5 minutes
  });
};
```

**Ou ajouter un bouton de rafraîchissement manuel** :

```jsx
const queryClient = useQueryClient();

<button
  onClick={() => {
    queryClient.invalidateQueries({ queryKey: ['communications'] });
  }}
  className="px-4 py-2 bg-green-600 text-white rounded-lg"
>
  🔄 Rafraîchir
</button>
```

### Solution 4 : Ajouter un filtre explicite dans l'UI

**Modification dans `Communications.jsx`** :

```jsx
// Ajouter un filtre "Créateur" dans l'interface
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Filtrer par créateur
  </label>
  <select
    value={filters.createdBy || 'all'}
    onChange={(e) => {
      const value = e.target.value === 'all' ? undefined : e.target.value;
      handleFilterChange('createdBy', value);
    }}
    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-lg"
  >
    <option value="all">Tous les créateurs</option>
    <option value="me">Mes communications uniquement</option>
    {/* Ajouter d'autres utilisateurs si nécessaire */}
  </select>
</div>
```

## 🔧 Test de vérification

### Test 1 : Vérifier le filtre automatique

1. Connectez-vous en tant que stagiaire
2. Ouvrez la console du navigateur (F12)
3. Allez sur la page Communications
4. Vérifiez la requête réseau : elle doit contenir `created_by={VOTRE_ID}`

### Test 2 : Vérifier la pagination

1. Créez plus de 25 communications
2. Vérifiez que la pagination s'affiche
3. Testez la navigation entre les pages

### Test 3 : Vérifier le cache

1. Chargez la page Communications
2. Créez une nouvelle communication dans un autre onglet
3. Revenez sur la page Communications
4. La nouvelle communication peut ne pas apparaître immédiatement (cache)

## 📋 Checklist de vérification

- [ ] Le filtre automatique par `created_by` est-il nécessaire pour les stagiaires ?
- [ ] Les formateurs doivent-ils voir toutes les communications ?
- [ ] Y a-t-il un besoin de voir les communications d'autres utilisateurs ?
- [ ] Le cache de 5 minutes est-il acceptable ?
- [ ] Faut-il ajouter un bouton de rafraîchissement manuel ?

## 🎯 Recommandations

1. **Pour les stagiaires** : Garder le filtre automatique par défaut (sécurité)
2. **Pour les formateurs** : Voir toutes les communications par défaut
3. **Optionnel** : Ajouter un bouton "Voir toutes" pour les stagiaires (avec permission)
4. **Cache** : Réduire à 1-2 minutes ou ajouter un bouton de rafraîchissement
5. **UI** : Ajouter un filtre explicite "Créateur" dans l'interface

## 🔗 Endpoints API testés

- ✅ `GET /api/communications` - Retourne 25 communications par défaut
- ✅ `GET /api/communications?type=RAPPEL_RDV` - Filtre par type
- ✅ `GET /api/communications?created_by={UUID}` - Filtre par créateur
- ✅ `GET /api/communications?page=2&limit=25` - Pagination


