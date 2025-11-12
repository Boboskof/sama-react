import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import hospitalisationService from '../../../_services/hospitalisation.service';

const Liste = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await hospitalisationService.list(id);
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        setError("Impossible de charger les hospitalisations");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="space-y-6 min-h-screen p-6">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shadow-sm">
              <span className="material-symbols-rounded text-indigo-600 text-2xl">local_hospital</span>
            </div>
            <h1 className="text-2xl font-bold text-indigo-800">Hospitalisations</h1>
          </div>
          <p className="text-indigo-700 text-sm">Patient #{id}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Link to={`/patients/${id}/hospitalisations/nouveau`} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
          <span className="material-symbols-rounded text-white text-base">add</span>
          Nouvelle hospitalisation
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Liste</h3>
        </div>
        {error && <div className="px-6 py-3 bg-red-50 text-red-700 border-b border-red-200">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-indigo-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-indigo-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Chargement…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-6 text-center text-gray-500">Aucune hospitalisation</td></tr>
              ) : (
                items.map(h => (
                  <tr key={h.id} className="hover:bg-indigo-50/40">
                    <td className="px-6 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {h.statut}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{h.uniteService || '—'}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {h.plannedAdmissionDate ? h.plannedAdmissionDate : '—'}
                      {h.plannedDischargeDate ? ` → ${h.plannedDischargeDate}` : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-right">
                      <Link to={`/patients/${id}/hospitalisations/${h.id}`} className="text-indigo-600 hover:text-indigo-800 text-sm">Voir</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Liste;










