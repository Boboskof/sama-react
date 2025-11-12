import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import hospitalisationService from '../../../_services/hospitalisation.service';

const Detail = () => {
  const { id, hid } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await hospitalisationService.list(id);
        const array = Array.isArray(list)
          ? list
          : list && typeof list === 'object'
            ? Object.values(list)
            : [];
        const found = array.find(h => h && String(h.id) === String(hid));
        setItem(found || null);
      } finally { setLoading(false); }
    })();
  }, [id, hid]);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="text-center py-6">
        <div className="bg-indigo-200 rounded-lg shadow p-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-indigo-800">Détail hospitalisation</h1>
          <p className="text-indigo-700 text-sm">Patient #{id} — Hosp #{hid}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <p className="text-gray-600">Chargement…</p>
        ) : !item ? (
          <p className="text-gray-600">Introuvable.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">info</span>
              <span className="font-medium">Statut:</span> {item.statut}
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">apartment</span>
              <span className="font-medium">Unité:</span> {item.uniteService || '—'}
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-indigo-600">event</span>
              <span className="font-medium">Dates prévues:</span> {item.plannedAdmissionDate || '—'} {item.plannedDischargeDate ? `→ ${item.plannedDischargeDate}` : ''}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Link to={`/patients/${id}/hospitalisations`} className="px-4 py-2 rounded border">Retour à la liste</Link>
      </div>
    </div>
  );
};

export default Detail;







