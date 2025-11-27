# Options d'Accessibilité - SAMA

## Vue d'ensemble

L'application SAMA inclut trois options d'accessibilité prioritaires pour améliorer l'expérience utilisateur :

1. **Taille du texte** - Ajustement de la taille de police
2. **Contraste élevé** - Mode haute visibilité
3. **Navigation au clavier** - Support complet de la navigation clavier

## Fonctionnalités

### 1. Taille du texte

Les utilisateurs peuvent choisir parmi 4 tailles de texte :
- **Petit** : 14px (0.875rem)
- **Moyen** : 16px (1rem) - Défaut
- **Grand** : 18px (1.125rem)
- **Très grand** : 20px (1.25rem)

La taille s'applique à tous les éléments de texte de l'application, y compris les titres qui sont ajustés proportionnellement.

### 2. Contraste élevé

Le mode contraste élevé améliore la lisibilité en :
- Forçant des couleurs à fort contraste (noir sur blanc)
- Ajoutant des bordures visibles sur tous les éléments interactifs
- Améliorant la visibilité des liens et boutons
- Respectant les standards WCAG pour le contraste

### 3. Navigation au clavier

La navigation clavier améliorée inclut :
- **Focus visible** : Indicateurs de focus clairs et personnalisables
- **Raccourcis clavier** :
  - `Tab` : Naviguer entre les éléments
  - `Entrée` : Activer un élément
  - `Échap` : Fermer les modales et menus déroulants
- **Taille minimale** : Tous les éléments interactifs respectent la taille minimale recommandée (44x44px)

## Utilisation

### Accéder aux options

1. Cliquez sur le bouton flottant en bas à droite de l'écran (icône d'engrenage)
2. Le panneau d'options s'ouvre avec les trois contrôles
3. Ajustez les options selon vos besoins
4. Les préférences sont sauvegardées automatiquement dans le navigateur

### Persistance

Toutes les préférences sont sauvegardées dans le `localStorage` du navigateur et sont restaurées automatiquement lors de la prochaine visite.

## Structure technique

### Fichiers créés

- `src/contexts/AccessibilityContext.jsx` - Contexte React pour gérer l'état
- `src/components/AccessibilityPanel.jsx` - Composant du panneau de contrôle
- `src/styles/accessibility.css` - Styles CSS pour les options

### Intégration

Le système est intégré dans `App.jsx` via le `AccessibilityProvider` qui enveloppe toute l'application.

## Standards de conformité

Les options d'accessibilité respectent les standards :
- **WCAG 2.1** - Niveau AA (minimum)
- **Section 508** - Standards d'accessibilité fédéraux américains
- **RGAA** - Référentiel Général d'Amélioration de l'Accessibilité (France)

## Améliorations futures possibles

- Mode sombre/clair
- Réduction des animations
- Filtres de couleur pour daltonisme
- Support des lecteurs d'écran amélioré (ARIA)
- Raccourcis clavier personnalisables

## Notes pour les développeurs

### Utiliser le contexte dans vos composants

```jsx
import { useAccessibility } from '../contexts/AccessibilityContext';

const MonComposant = () => {
  const { fontSize, highContrast, keyboardNavigation } = useAccessibility();
  
  // Utiliser les valeurs selon vos besoins
  return <div className={highContrast ? 'high-contrast' : ''}>...</div>;
};
```

### Ajouter des styles conditionnels

Les classes CSS suivantes sont disponibles :
- `.font-size-small`, `.font-size-medium`, `.font-size-large`, `.font-size-extra-large`
- `.high-contrast`
- `.keyboard-navigation`

### Bonnes pratiques

1. Toujours tester la navigation au clavier
2. S'assurer que tous les éléments interactifs ont un focus visible
3. Utiliser des labels explicites pour les formulaires
4. Respecter l'ordre de tabulation logique
5. Tester avec le mode contraste élevé activé








