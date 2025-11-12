import React, { useState } from 'react';
import ErrorMessage from './ErrorMessage';

const CATEGORY_OPTIONS = [
  { value: 'GENERAL', label: 'Général', description: 'Note générale sans catégorie spécifique' },
  { value: 'FEEDBACK', label: 'Retour sur le travail', description: 'Commentaires, encouragements, suggestions d\'amélioration' },
  { value: 'ALERTE', label: 'Alerte', description: 'Avertissement ou problème à signaler' },
  { value: 'INFORMATION', label: 'Information', description: 'Information factuelle ou annonce' }
];

const IMPORTANCE_OPTIONS = [
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Attention' },
  { value: 'URGENT', label: 'Urgent' }
];

const NoteForm = ({ stagiaireId, stagiaireName, onSubmit, onCancel, loading = false }) => {
  const [formData, setFormData] = useState({
    contenu: '',
    categorie: 'GENERAL',
    importance: 'INFO'
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.contenu.trim()) {
      setError('Le contenu de la note est requis');
      return;
    }

    try {
      await onSubmit({
        contenu: formData.contenu.trim(),
        categorie: formData.categorie,
        importance: formData.importance
      });
      // Réinitialiser le formulaire après succès
      setFormData({
        contenu: '',
        categorie: 'GENERAL',
        importance: 'INFO'
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Erreur lors de la création de la note');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {stagiaireName ? `Nouvelle note pour ${stagiaireName}` : 'Nouvelle note'}
      </h3>

      {error && <ErrorMessage message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Contenu */}
        <div>
          <label htmlFor="contenu" className="block text-sm font-medium text-gray-700 mb-1">
            Contenu <span className="text-red-500">*</span>
          </label>
          <textarea
            id="contenu"
            name="contenu"
            value={formData.contenu}
            onChange={handleChange}
            required
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Saisissez le contenu de la note..."
          />
        </div>

        {/* Catégorie et Importance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="categorie" className="block text-sm font-medium text-gray-700 mb-1">
              Catégorie
            </label>
            <select
              id="categorie"
              name="categorie"
              value={formData.categorie}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              title={CATEGORY_OPTIONS.find(opt => opt.value === formData.categorie)?.description}
            >
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value} title={opt.description}>
                  {opt.label}
                </option>
              ))}
            </select>
            {formData.categorie && (
              <p className="mt-1 text-xs text-gray-500">
                {CATEGORY_OPTIONS.find(opt => opt.value === formData.categorie)?.description}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="importance" className="block text-sm font-medium text-gray-700 mb-1">
              Importance
            </label>
            <select
              id="importance"
              name="importance"
              value={formData.importance}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              {IMPORTANCE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !formData.contenu.trim()}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Envoi...' : 'Créer la note'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NoteForm;

