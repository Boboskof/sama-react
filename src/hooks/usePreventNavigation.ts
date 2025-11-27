import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function usePreventNavigation(isActive: boolean, message?: string) {
  const location = useLocation();
  const hasPushedState = useRef(false);

  useEffect(() => {
    if (!isActive) {
      // Nettoyer si désactivé
      if (hasPushedState.current) {
        hasPushedState.current = false;
      }
      return;
    }

    const warningMessage = message || 
      'Vous êtes en train de faire un exercice. Êtes-vous sûr de vouloir quitter ? Votre progression sera sauvegardée.';

    // Empêcher le rafraîchissement (F5, Ctrl+R)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = warningMessage;
      return warningMessage;
    };

    // Empêcher la navigation interne (bouton précédent)
    const handlePopState = (e: PopStateEvent) => {
      // Empêcher la navigation en arrière
      window.history.pushState(null, '', location.pathname);
      
      // Afficher un avertissement
      if (window.confirm(warningMessage)) {
        // Si l'utilisateur confirme, on peut permettre la navigation
        // Mais on reste sur la page quand même
        return;
      }
      
      // Empêcher en repoussant l'état
      window.history.pushState(null, '', location.pathname);
    };

    // Ajouter un état dans l'historique pour bloquer le bouton précédent
    if (!hasPushedState.current) {
      window.history.pushState(null, '', location.pathname);
      hasPushedState.current = true;
    }

    // Empêcher les raccourcis clavier (F5, Ctrl+R, Ctrl+W)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Empêcher F5
      if (e.key === 'F5') {
        e.preventDefault();
        return false;
      }
      
      // Empêcher Ctrl+R, Ctrl+Shift+R
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        return false;
      }
      
      // Empêcher Ctrl+W (fermer l'onglet) - attention, peut être gênant
      // On peut commenter cette partie si nécessaire
      // if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      //   e.preventDefault();
      //   return false;
      // }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, message, location.pathname]);
}

