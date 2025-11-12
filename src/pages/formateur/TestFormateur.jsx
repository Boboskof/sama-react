import React, { useState, useEffect } from 'react';
import formateurService from '../../_services/formateur.service';
import userService from '../../_services/user.service';

const TestFormateur = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    const results = {};

    try {
      // Test 1: Vérifier le rôle formateur
      results.isFormateur = userService.isFormateur();
      if (import.meta.env.DEV) {
        console.log('✅ Test isFormateur:', results.isFormateur);
      }

      // Test 2: Récupérer les stagiaires
      try {
        const stagiaires = await formateurService.getAllStagiaires();
        results.stagiaires = { success: true, count: stagiaires.length, data: stagiaires };
        if (import.meta.env.DEV) {
          console.log('✅ Test stagiaires:', results.stagiaires);
        }
      } catch (error) {
        results.stagiaires = { success: false, error: error.message };
        console.error('❌ Test stagiaires:', error);
      }

      // Test 3: Récupérer le dashboard
      try {
        const dashboard = await formateurService.getDashboardData();
        results.dashboard = { success: true, data: dashboard };
        if (import.meta.env.DEV) {
          console.log('✅ Test dashboard:', results.dashboard);
        }
      } catch (error) {
        results.dashboard = { success: false, error: error.message };
        console.error('❌ Test dashboard:', error);
      }

      // Test 4: Récupérer les logs d'audit
      try {
        const logs = await formateurService.getLogsAudit({ limit: 10 });
        results.logs = { success: true, count: logs.logs.length, data: logs };
        if (import.meta.env.DEV) {
          console.log('✅ Test logs:', results.logs);
        }
      } catch (error) {
        results.logs = { success: false, error: error.message };
        console.error('❌ Test logs:', error);
      }

      // Test 5: Récupérer les alertes
      try {
        const alertes = await formateurService.getAlertes();
        results.alertes = { success: true, count: alertes.length, data: alertes };
        console.log('✅ Test alertes:', results.alertes);
      } catch (error) {
        results.alertes = { success: false, error: error.message };
        console.error('❌ Test alertes:', error);
      }

    } catch (error) {
      console.error('❌ Erreur générale:', error);
      results.general = { success: false, error: error.message };
    }

    setTestResults(results);
    setLoading(false);
  };

  return (
    <div className="space-y-6 bg-indigo-100 min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Test Formateur</h1>
          
          <div className="mb-6">
            <button
              onClick={runTests}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Tests en cours...' : 'Lancer les tests'}
            </button>
          </div>

          {Object.keys(testResults).length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Résultats des tests</h2>
              
              {Object.entries(testResults).map(([testName, result]) => (
                <div key={testName} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 capitalize">
                      {testName.replace(/([A-Z])/g, ' $1').trim()}
                    </h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {result.success ? '✅ Succès' : '❌ Échec'}
                    </span>
                  </div>
                  
                  {result.success ? (
                    <div className="text-sm text-gray-600">
                      {result.count !== undefined && <p>Nombre: {result.count}</p>}
                      {result.data && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            Voir les données
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-red-600">
                      <p>Erreur: {result.error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestFormateur;
