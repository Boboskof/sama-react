import React from 'react';

const CATEGORY_META = {
  GENERAL: { label: 'Général', color: 'bg-gray-100 text-gray-800 border-gray-300', bgColor: '#f5f5f5', description: 'Note générale' },
  FEEDBACK: { label: 'Retour sur le travail', color: 'bg-blue-100 text-blue-800 border-blue-300', bgColor: '#e3f2fd', description: 'Commentaires et suggestions' },
  ALERTE: { label: 'Alerte', color: 'bg-orange-100 text-orange-800 border-orange-300', bgColor: '#fff3e0', description: 'Avertissement ou problème' },
  INFORMATION: { label: 'Information', color: 'bg-green-100 text-green-800 border-green-300', bgColor: '#e8f5e8', description: 'Information factuelle' }
};

const IMPORTANCE_META = {
  INFO: { label: 'Info', color: 'bg-blue-100 text-blue-800 border-blue-300', bgColor: '#e3f2fd' },
  WARNING: { label: 'Attention', color: 'bg-orange-100 text-orange-800 border-orange-300', bgColor: '#fff3e0' },
  URGENT: { label: 'Urgent', color: 'bg-red-100 text-red-800 border-red-300', bgColor: '#ffebee' }
};

const formatDate = (dateString) => {
  if (!dateString) return 'Date inconnue';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const NotesList = ({ notes = [], onDelete, canDelete = false, loading = false }) => {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        <p className="mt-2 text-gray-600">Chargement des notes...</p>
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-lg">Aucune note disponible</p>
        <p className="text-sm mt-2">Vos notes du formateur apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => {
        const categoryMeta = CATEGORY_META[note.categorie] || CATEGORY_META.GENERAL;
        const importanceMeta = IMPORTANCE_META[note.importance] || IMPORTANCE_META.INFO;
        const formateurName = note.formateur 
          ? `${note.formateur.prenom || ''} ${note.formateur.nom || ''}`.trim() 
          : 'Formateur';

        return (
          <div
            key={note.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* En-tête avec badges */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryMeta.color}`}>
                    {categoryMeta.label}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${importanceMeta.color}`}>
                    {importanceMeta.label}
                  </span>
                </div>

                {/* Contenu */}
                <p className="text-gray-800 mb-3 whitespace-pre-wrap">{note.contenu}</p>

                {/* Pied de note */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-4">
                    <span>
                      <span className="font-medium">Par:</span> {formateurName}
                    </span>
                    <span>
                      <span className="font-medium">Le:</span> {formatDate(note.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bouton supprimer (formateur uniquement) */}
              {canDelete && onDelete && (
                <button
                  onClick={() => onDelete(note.id)}
                  className="ml-4 text-red-600 hover:text-red-800 transition-colors"
                  title="Supprimer la note"
                >
                  <span className="material-symbols-rounded text-xl">delete</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default NotesList;

