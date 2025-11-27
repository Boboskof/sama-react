import React, { useEffect, useState } from 'react';
import userService from '../../_services/user.service';

const MonProfil = () => {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const u = await userService.getCurrentUser();
        setMe(u);
      } catch (e) {
        setError("Impossible de charger votre profil");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePwdChange = (e) => {
    const { name, value } = e.target;
    setPwdForm((p) => ({ ...p, [name]: value }));
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });
    if (!pwdForm.currentPassword || !pwdForm.newPassword) {
      setPwdMsg({ type: 'error', text: 'Champs requis manquants' });
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmNewPassword) {
      setPwdMsg({ type: 'error', text: 'La confirmation ne correspond pas' });
      return;
    }
    try {
      setPwdLoading(true);
      await userService.updateMyPassword({ currentPassword: pwdForm.currentPassword, newPassword: pwdForm.newPassword });
      setPwdMsg({ type: 'success', text: 'Mot de passe mis à jour' });
      setPwdForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (e) {
      setPwdMsg({ type: 'error', text: "Échec de la mise à jour du mot de passe" });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 flex items-center justify-center">
        <div className="text-gray-600">Chargement…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 flex items-center justify-center">
        <div className="bg-red-100 text-red-800 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-[95%] md:w-[90%] lg:w-[80%] mx-auto px-2 md:px-4 py-6 bg-orange-100">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-orange-800 mb-4">Mon profil</h1>
          {me ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Prénom</div>
                <div className="font-medium">{me.prenom || me.firstName || '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Nom</div>
                <div className="font-medium">{me.nom || me.lastName || '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Email</div>
                <div className="font-medium">{me.email || '—'}</div>
              </div>
              <div>
                <div className="text-gray-500">Rôle</div>
                <div className="font-medium">{Array.isArray(me.roles) ? me.roles.join(', ') : '—'}</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-600">Aucune donnée utilisateur</div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Changer mon mot de passe</h2>
          {pwdMsg.text && (
            <div className={`${pwdMsg.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-3 py-2 rounded text-sm mb-3`}>{pwdMsg.text}</div>
          )}
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Mot de passe actuel</label>
              <input type="password" name="currentPassword" value={pwdForm.currentPassword} onChange={handlePwdChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Nouveau mot de passe</label>
                <input type="password" name="newPassword" value={pwdForm.newPassword} onChange={handlePwdChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Confirmer</label>
                <input type="password" name="confirmNewPassword" value={pwdForm.confirmNewPassword} onChange={handlePwdChange} className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={pwdLoading} className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50">{pwdLoading ? 'Mise à jour…' : 'Mettre à jour'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MonProfil;

