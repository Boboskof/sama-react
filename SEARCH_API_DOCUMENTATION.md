# 🔍 Documentation API de Recherche - MVP

## 📋 Paramètres acceptés (scalaires uniquement)

Le contrôleur de recherche accepte **uniquement** les paramètres suivants, tous scalaires :

### Paramètres de base
- `q` (string) - Terme de recherche (requis, min 2 caractères)
- `page` (number) - Numéro de page (défaut: 1)
- `per_page` (number) - Nombre d'éléments par page (défaut: 10, max: 50)

### Filtres par entité
- `type` (string) - Type de communication/document
- `statut` (string) - Statut du rendez-vous/communication
- `canal` (string) - Canal de communication
- `patient_id` (string) - ID du patient (UUID)

### Filtres de période
- `date_from` (string) - Date de début (format ISO 8601)
- `date_to` (string) - Date de fin (format ISO 8601)

## 🚫 Paramètres NON acceptés

- ❌ `limit` / `offset` (utiliser `page` / `per_page`)
- ❌ `categories[]` (array)
- ❌ `type[]` / `statut[]` / `canal[]` (arrays)
- ❌ `patient` (utiliser `patient_id`)
- ❌ `dateDebut` / `dateFin` (utiliser `date_from` / `date_to`)

## 📡 Endpoints

### 1. Recherche globale
```
GET /api/search?q=terme&page=1&per_page=10&type=RAPPEL_RDV&statut=ENVOYE&patient_id=uuid&date_from=2024-01-01&date_to=2024-12-31
```

### 2. Recherche rapide
```
GET /api/search/quick?q=terme&per_page=5
```

### 3. Recherche par catégorie
```
GET /api/search/patients?q=terme&page=1&per_page=25&patient_id=uuid
GET /api/search/rendez_vous?q=terme&page=1&per_page=25&statut=CONFIRME&date_from=2024-01-01
GET /api/search/documents?q=terme&page=1&per_page=25&type=CARTE_VITALE&patient_id=uuid
GET /api/search/communications?q=terme&page=1&per_page=25&type=RAPPEL_RDV&statut=ENVOYE&canal=EMAIL
```

## 📤 Format de réponse

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "patient|rendez_vous|document|communication",
      "title": "Titre du résultat",
      "subtitle": "Sous-titre optionnel",
      "metadata": {
        "patient_name": "Nom du patient",
        "patient_id": "uuid",
        "created_at": "2024-01-01T00:00:00Z",
        "statut": "ENVOYE",
        "canal": "EMAIL"
      }
    }
  ],
  "total": 42,
  "has_more": true,
  "page": 1,
  "per_page": 10
}
```

## 🔧 Implémentation Backend

### Exemple de contrôleur Symfony

```php
<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/search')]
class SearchController extends AbstractController
{
    #[Route('', methods: ['GET'])]
    public function search(Request $request): JsonResponse
    {
        // Validation des paramètres scalaires uniquement
        $query = $request->query->get('q');
        $page = (int) $request->query->get('page', 1);
        $perPage = min((int) $request->query->get('per_page', 10), 50);
        
        // Filtres scalaires uniquement
        $filters = [
            'type' => $request->query->get('type'),
            'statut' => $request->query->get('statut'),
            'canal' => $request->query->get('canal'),
            'patient_id' => $request->query->get('patient_id'),
            'date_from' => $request->query->get('date_from'),
            'date_to' => $request->query->get('date_to'),
        ];
        
        // Nettoyer les valeurs vides
        $filters = array_filter($filters, fn($value) => $value !== null && $value !== '');
        
        // Validation
        if (empty($query) || strlen($query) < 2) {
            return new JsonResponse(['error' => 'Query must be at least 2 characters'], 400);
        }
        
        // Logique de recherche...
        $results = $this->searchService->search($query, $filters, $page, $perPage);
        
        return new JsonResponse([
            'data' => $results['items'],
            'total' => $results['total'],
            'has_more' => $results['has_more'],
            'page' => $page,
            'per_page' => $perPage
        ]);
    }
}
```

## ✅ Validation Frontend

Le frontend garantit que :

1. **Aucun tableau n'est envoyé** - conversion automatique en valeur unique
2. **Noms de paramètres corrects** - mapping strict (`patient_id`, `date_from`, `date_to`)
3. **Valeurs vides supprimées** - `undefined` au lieu de chaînes vides
4. **Pagination cohérente** - `page`/`per_page` au lieu de `limit`/`offset`

## 🎯 Avantages du MVP

- ✅ **Simplicité** - Paramètres scalaires uniquement
- ✅ **Performance** - Pas de parsing de tableaux complexes
- ✅ **Maintenance** - Code backend plus simple
- ✅ **Debugging** - URLs lisibles et testables
- ✅ **Évolutivité** - Facile d'ajouter de nouveaux filtres scalaires
