import React from 'react';

/**
 * Composant pour afficher des messages d'erreur clairs aux utilisateurs
 * @param {string} message - Message d'erreur à afficher
 * @param {string} title - Titre optionnel (par défaut: "Erreur")
 * @param {boolean} dismissible - Si true, affiche un bouton pour fermer
 * @param {function} onDismiss - Callback appelé quand l'erreur est fermée
 * @param {string} className - Classes CSS additionnelles
 */
const ErrorMessage = ({ 
  message, 
  title = "Erreur", 
  dismissible = false, 
  onDismiss,
  className = "" 
}) => {
  if (!message) return null;

  const getErrorMessage = (err) => {
    // Si c'est une chaîne, on la retourne telle quelle
    if (typeof err === 'string') return err;
    
    // Si c'est un objet d'erreur Axios
    if (err?.response) {
      const status = err.response.status;
      const data = err.response.data;
      
      // Messages spécifiques selon le code HTTP
      switch (status) {
        case 400:
          return data?.message || data?.violations?.[0]?.message || "Les données fournies sont invalides.";
        case 401:
          return "Vous n'êtes pas autorisé à effectuer cette action. Veuillez vous reconnecter.";
        case 403:
          return "Vous n'avez pas les permissions nécessaires pour effectuer cette action.";
        case 404:
          return "La ressource demandée est introuvable.";
        case 409:
          return data?.message || "Un conflit est survenu. Cette ressource existe peut-être déjà.";
        case 422:
          return data?.message || data?.violations?.[0]?.message || "Les données fournies ne sont pas valides.";
        case 500:
          return "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
        case 502:
        case 503:
          return "Le serveur est temporairement indisponible. Veuillez réessayer dans quelques instants.";
        case 504:
          return "Le serveur met trop de temps à répondre. Veuillez réessayer.";
        default:
          return data?.message || `Erreur ${status}: Une erreur est survenue.`;
      }
    }
    
    // Erreur réseau
    if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error')) {
      return "Impossible de se connecter au serveur. Vérifiez votre connexion internet.";
    }
    
    // Timeout
    if (err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')) {
      return "La requête a expiré. Veuillez réessayer.";
    }
    
    // Message générique
    return err?.message || "Une erreur inattendue est survenue. Veuillez réessayer.";
  };

  const errorMessage = getErrorMessage(message);

  return (
    <div className={`bg-red-50 border-l-4 border-red-500 p-4 rounded-lg ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="material-symbols-rounded text-red-500 text-xl">error</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-semibold text-red-800 mb-1">{title}</h3>
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
        {dismissible && onDismiss && (
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="inline-flex text-red-400 hover:text-red-600 focus:outline-none"
            >
              <span className="material-symbols-rounded text-xl">close</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;

















