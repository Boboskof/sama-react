# Prévention des Boucles Infinies - Guide de Bonnes Pratiques

## Problèmes identifiés et corrigés

### 1. Dashboard.jsx ✅ CORRIGÉ
**Problème** : Synchronisation entre React Query et état local causant des boucles
**Solution** :
- Suppression de l'état local `todayAppointments` redondant
- Utilisation directe des données React Query (`todayAppointmentsData`)
- Configuration de React Query avec `refetchOnWindowFocus: false` pour éviter les refetch trop fréquents

### 2. Appointments.jsx ✅ CORRIGÉ
**Problème** : `loadAppointments` dans les dépendances d'un `useEffect` pouvait causer des boucles
**Solution** :
- Suppression de `loadAppointments` des dépendances
- Utilisation directe des dépendances primitives (`filters`, `selectedMedecinId`)
- `loadAppointments` reste mémorisé avec `useCallback`

### 3. Documents.jsx ✅ CORRIGÉ
**Problème** : `loadDocuments` dans les dépendances d'un `useEffect` pouvait causer des boucles
**Solution** :
- Suppression de `loadDocuments` des dépendances
- Utilisation directe des dépendances primitives du callback
- `loadDocuments` reste mémorisé avec `useCallback`

## Règles à suivre pour éviter les boucles infinies

### 1. useEffect - Dépendances
❌ **À ÉVITER** :
```javascript
useEffect(() => {
  loadData();
}, [loadData]); // loadData peut être recréé à chaque render
```

✅ **BON** :
```javascript
// Option 1 : Dépendances primitives
useEffect(() => {
  loadData();
}, [filter1, filter2, userId]); // Dépendances primitives stables

// Option 2 : useCallback avec dépendances stables
const loadData = useCallback(() => {
  // ...
}, [filter1, filter2]);
useEffect(() => {
  loadData();
}, [filter1, filter2]); // Dépendances primitives du callback
```

### 2. Objets et tableaux dans les dépendances
❌ **À ÉVITER** :
```javascript
useEffect(() => {
  // ...
}, [{ filter: value }]); // Nouvel objet à chaque render
```

✅ **BON** :
```javascript
// Option 1 : Utiliser des primitives
useEffect(() => {
  // ...
}, [filterValue]);

// Option 2 : Utiliser useMemo pour stabiliser l'objet
const filters = useMemo(() => ({ filter: value }), [value]);
useEffect(() => {
  // ...
}, [filters]);
```

### 3. React Query - Configuration
❌ **À ÉVITER** :
```javascript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  refetchOnWindowFocus: true, // Peut causer des refetch trop fréquents
});
```

✅ **BON** :
```javascript
useQuery({
  queryKey: ['data'],
  queryFn: fetchData,
  staleTime: 2 * 60 * 1000, // Cache de 2 minutes
  refetchOnWindowFocus: false, // Éviter les refetch automatiques
  refetchOnMount: true,
  refetchOnReconnect: true,
});
```

### 4. setState dans useEffect
❌ **À ÉVITER** :
```javascript
useEffect(() => {
  setState(data); // Si data change à chaque render, boucle infinie
}, [data]);
```

✅ **BON** :
```javascript
// Option 1 : Vérifier avant de setter
useEffect(() => {
  if (data && data !== currentData) {
    setState(data);
  }
}, [data]);

// Option 2 : Utiliser une clé stable
useEffect(() => {
  if (data?.id !== currentData?.id) {
    setState(data);
  }
}, [data?.id]);
```

### 5. Synchronisation état local / React Query
❌ **À ÉVITER** :
```javascript
const { data } = useQuery(...);
const [localData, setLocalData] = useState([]);

useEffect(() => {
  setLocalData(data); // Synchronisation inutile
}, [data]);
```

✅ **BON** :
```javascript
// Utiliser directement les données React Query
const { data } = useQuery(...);
// Pas besoin d'état local si on utilise directement data
```

## Vérifications régulières

1. **Audit des useEffect** : Vérifier que les dépendances sont stables
2. **Audit des useCallback/useMemo** : Vérifier que les dépendances sont correctes
3. **Audit de React Query** : Vérifier la configuration des refetch
4. **Tests** : Surveiller la console pour les warnings "Maximum update depth exceeded"

## Checklist avant commit

- [ ] Pas de `useEffect` avec des fonctions dans les dépendances (sauf si mémorisées)
- [ ] Pas de `useEffect` avec des objets/tableaux créés inline dans les dépendances
- [ ] React Query configuré avec `staleTime` approprié
- [ ] Pas de synchronisation inutile entre état local et React Query
- [ ] Tous les `useCallback`/`useMemo` ont des dépendances correctes




