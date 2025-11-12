# 🗺️ Guide des Mappers de Requêtes - Frontend

## 📋 Vue d'ensemble

Ce guide explique l'utilisation des mappers centralisés pour convertir les filtres UI en paramètres de requête backend, simplifiant la gestion des filtres dans l'application.

## 🎯 Avantages

- ✅ **Séparation claire** : UI filters vs Backend params
- ✅ **Réutilisabilité** : Même logique partout
- ✅ **Maintenance** : Un seul endroit pour modifier la logique
- ✅ **Type safety** : TypeScript pour tous les filtres
- ✅ **Consistance** : Même structure partout

## 📁 Structure des fichiers

```
src/_services/query/
├── index.ts                 # Export centralisé
├── communications.query.ts  # Mapper communications
├── patients.query.ts        # Mapper patients
├── appointments.query.ts    # Mapper rendez-vous
└── documents.query.ts       # Mapper documents
```

## 🔧 Utilisation

### 1. Types de filtres UI

Chaque entité a son propre type de filtres UI :

```typescript
// Communications
export type UICommFilters = {
  type?: string[];         // ex: ['RAPPEL_RDV']
  statut?: string[];       // ex: ['EN_ATTENTE', 'ECHEC']
  canal?: string[];        // ex: ['SMS']
  patientId?: string|number;
  dateDebut?: string;      // YYYY-MM-DD
  dateFin?: string;        // YYYY-MM-DD
  page?: number;
  limit?: number;
};

// Patients
export type UIPatientFilters = {
  search?: string;
  genre?: string;
  ville?: string;
  page?: number;
  limit?: number;
};

// Rendez-vous
export type UIAppointmentFilters = {
  search?: string;
  statut?: string[];
  medecin?: string;
  patientId?: string|number;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  limit?: number;
};

// Documents
export type UIDocumentFilters = {
  search?: string;
  type?: string[];
  statut?: string[];
  patientId?: string|number;
  dateDebut?: string;
  dateFin?: string;
  page?: number;
  limit?: number;
};
```

### 2. Fonctions de mapping

Chaque mapper convertit les filtres UI en paramètres URL :

```typescript
// Exemple pour les communications
export function buildCommParams(f: UICommFilters): URLSearchParams {
  const p = new URLSearchParams();

  // Normalisation des noms
  if (f.patientId) p.append('patient_id', String(f.patientId));
  if (f.dateDebut) p.append('date_from', f.dateDebut);
  if (f.dateFin) p.append('date_to', f.dateFin);

  // Tableaux → type[]=A&type[]=B
  (f.type ?? []).forEach(v => p.append('type[]', v));
  (f.statut ?? []).forEach(v => p.append('statut[]', v));
  (f.canal ?? []).forEach(v => p.append('canal[]', v));

  p.append('page', String(f.page ?? 1));
  p.append('per_page', String(f.limit ?? 25));
  return p;
}
```

### 3. Utilisation dans les services

```typescript
// communication.service.ts
import { buildCommParams, UICommFilters } from "./query/communications.query";

async function getCommunications(filters: UICommFilters) {
  const params = buildCommParams(filters);
  return await safeGetList(Axios.get(`/communications?${params.toString()}`));
}
```

### 4. Utilisation dans les composants

```typescript
// Communications.jsx
import { UICommFilters } from "../../_services/query/communications.query";

const Communications = () => {
  // État unique avec structure claire
  const [filters, setFilters] = useState<UICommFilters>({
    type: [],
    statut: [],
    canal: [],
    patientId: undefined,
    dateDebut: undefined,
    dateFin: undefined,
    page: 1,
    limit: 25
  });

  // Boutons rapides
  const handleQuickFilter = (statut: string) => {
    setFilters(f => ({ ...f, statut: [statut] }));
  };

  // Chargement des données
  const loadData = useCallback(async () => {
    const data = await communicationService.getCommunications(filters);
    setCommunications(data);
  }, [filters]);

  // useEffect se déclenche automatiquement quand filters change
  useEffect(() => {
    loadData();
  }, [loadData]);
};
```

## 🚀 Avec TanStack Query (Recommandé)

### Installation

```bash
npm install @tanstack/react-query
```

### Configuration

```typescript
// main.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Votre app */}
    </QueryClientProvider>
  );
}
```

### Hooks personnalisés

```typescript
// hooks/useCommunications.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useCommunications = (filters: UICommFilters = {}) => {
  return useQuery({
    queryKey: ['communications', filters],
    queryFn: () => communicationService.getCommunications(filters),
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

### Utilisation dans les composants

```typescript
// CommunicationsWithQuery.jsx
const CommunicationsWithQuery = () => {
  const [filters, setFilters] = useState<UICommFilters>({...});

  const { 
    data: communications = [], 
    isLoading, 
    error 
  } = useCommunications(filters);

  // Plus besoin de useEffect, de useState pour loading, etc.
  // TanStack Query gère tout automatiquement !
};
```

## 🎨 Boutons rapides

Exemple d'implémentation des boutons rapides :

```typescript
// Boutons rapides pour les filtres
<div className="flex flex-wrap gap-2">
  <button
    onClick={() => setFilters(f => ({ ...f, statut: ['ENVOYE'] }))}
    className={`px-3 py-1 rounded-full text-sm ${
      filters.statut?.includes('ENVOYE') 
        ? 'bg-green-100 text-green-800 border border-green-300' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    Envoyées
  </button>
  
  <button
    onClick={() => setFilters(f => ({ ...f, statut: [], type: [], canal: [] }))}
    className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
  >
    Tous
  </button>
</div>
```

## 📊 Avantages de TanStack Query

- ✅ **Cache automatique** : Évite les requêtes inutiles
- ✅ **Synchronisation** : Mise à jour automatique des données
- ✅ **Gestion d'état** : Plus besoin de useState pour loading/error
- ✅ **Optimistic updates** : Mise à jour immédiate de l'UI
- ✅ **Retry automatique** : En cas d'erreur réseau
- ✅ **Background refetch** : Rechargement en arrière-plan

## 🔄 Migration

### Avant (ancien système)

```typescript
const [filters, setFilters] = useState({
  dateDebut: null,
  dateFin: null,
  periode: '7j',
  type: [],
  canal: [],
  statut: [],
  patient: null,
  patientNom: '',
  creePar: null,
  recherche: ''
});

// Logique complexe de mapping dans le composant
const params = new URLSearchParams();
if (filters.dateDebut) params.append('dateDebut', filters.dateDebut);
// ... 50+ lignes de mapping
```

### Après (nouveau système)

```typescript
const [filters, setFilters] = useState<UICommFilters>({
  type: [],
  statut: [],
  canal: [],
  patientId: undefined,
  dateDebut: undefined,
  dateFin: undefined,
  page: 1,
  limit: 25
});

// Mapping centralisé et réutilisable
const data = await communicationService.getCommunications(filters);
```

## 🎯 Résultat

- **90% moins de code** dans les composants
- **Logique centralisée** et réutilisable
- **Type safety** complet
- **Maintenance simplifiée**
- **Performance optimisée** avec TanStack Query

Le système est maintenant prêt pour une maintenance et une évolution faciles ! 🚀
