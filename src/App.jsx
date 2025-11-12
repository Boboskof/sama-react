import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import DevLogin from './components/DevLogin';
import SearchBar from './components/SearchBar';
import MonProfil from './pages/stagiaire/MonProfil.jsx';
import Login from './pages/Login';
import Dashboard from './pages/stagiaire/Dashboard';
import DashboardFormateur from './pages/formateur/DashboardFormateur';
import Formateur from './pages/formateur/Formateur';
import Stagiaires from './pages/formateur/Stagiaires';
import StagiaireDetails from './pages/formateur/StagiaireDetails';
import LogsAudit from './pages/stagiaire/LogsAudit';
import Patients from './pages/stagiaire/Patients';
import PatientSingle from './pages/stagiaire/PatientSingle';
import NouveauPatient from './pages/stagiaire/NouveauPatient';
import ModifierPatient from './pages/stagiaire/ModifierPatient';
import Appointments from './pages/stagiaire/Appointments';
import Documents from './pages/stagiaire/Documents';
import Communications from './pages/stagiaire/Communications';
import HospitalisationsList from './pages/stagiaire/hospitalisations/Liste';
import HospitalisationsAll from './pages/stagiaire/hospitalisations/All';
import HospitalisationWizard from './pages/stagiaire/hospitalisations/Wizard';
import HospitalisationDetail from './pages/stagiaire/hospitalisations/Detail';
import MentionsLegales from './pages/MentionsLegales';
import PolitiqueConfidentialite from './pages/PolitiqueConfidentialite';
import userService from './_services/user.service';
import './App.css';

// Composant pour gérer le fond selon la route
const AppContent = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fonction pour obtenir la classe de fond selon la route
  const getBackgroundClass = (pathname) => {
    if (pathname === '/patients' || pathname.startsWith('/patients/')) {
      return 'bg-orange-100'; // Correspond au menu orange
    } else if (
      pathname === '/appointments' || pathname.startsWith('/appointments/')
      ) {
      return 'bg-pink-100'; // RDV classiques et RDV simplifiés
      
    } else if (pathname === '/documents' || pathname.startsWith('/documents/')) {
      return 'bg-green-100'; // Correspond au menu vert
    } else if (pathname === '/hospitalisations' || pathname.startsWith('/hospitalisations/')) {
      return 'bg-indigo-100';
    } else if (
      pathname === '/communications' || pathname.startsWith('/communications/')) {

      return 'bg-purple-100'; // Correspond au menu violet
    } else if (pathname === '/formateur' || pathname.startsWith('/formateur/')) {
      return 'bg-indigo-100'; // Correspond au menu indigo
    } else {
      return 'bg-blue-100'; // Dashboard par défaut - correspond au menu bleu
    }
  };

  const backgroundClass = getBackgroundClass(location.pathname);

  useEffect(() => {
    // Nettoyer les tokens expirés au démarrage
    const cleanupExpiredTokens = () => {
      const token = localStorage.getItem('token');
      if (token) {
        // Vérifier si le token est expiré et le nettoyer si nécessaire
        userService.isLogged(); // Cette fonction nettoie automatiquement les tokens expirés
      }
    };

    // Nettoyer d'abord, puis vérifier l'authentification
    cleanupExpiredTokens();
    
    // Vérifier l'authentification au chargement
    const checkAuth = () => {
      const isLogged = userService.isLogged();
      setIsAuthenticated(isLogged);
      setLoading(false);
    };

    checkAuth();

    // Écouter les changements de localStorage pour l'authentification
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        const isLogged = userService.isLogged();
        setIsAuthenticated(isLogged);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les changements de localStorage dans le même onglet
    const handleCustomAuthChange = () => {
      const isLogged = userService.isLogged();
      setIsAuthenticated(isLogged);
    };

    window.addEventListener('authChange', handleCustomAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleCustomAuthChange);
    };
  }, []);

  // Appliquer la classe de fond au body
  useEffect(() => {
    // Nettoyer les classes existantes et appliquer la nouvelle
    document.body.className = '';
    document.body.classList.add(backgroundClass);
    
    return () => {
      document.body.className = '';
    };
  }, [backgroundClass]);

  // Composant pour protéger les routes
  const ProtectedRoute = ({ children }) => {
    if (loading) {
      return (
        <div className="min-h-screen">
          <LoadingSpinner message="Chargement..." />
        </div>
      );
    }

    return isAuthenticated ? children : <Navigate to="/login" replace />;
  };

  // Si l'utilisateur n'est pas connecté, afficher seulement la page de connexion
  if (!isAuthenticated && !loading) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Si l'utilisateur est connecté, afficher l'interface complète
  return (
    <div className="min-h-screen flex flex-col">
        <DevLogin />
        <Header />
        <Navbar />
        {/* Barre de recherche globale sous les menus */}
        <div className="w-full px-6 mt-3">
          <div className="max-w-screen-xl mx-auto">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm p-3">
              <div className="max-w-2xl mx-auto">
                <SearchBar
                  placeholder="Rechercher patients, RDV, documents, communications..."
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
        <main className="flex-1 max-w-screen-xl mx-auto p-6 w-full">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  {userService.isFormateur && userService.isFormateur() ? <Formateur /> : <Dashboard />}
                </ProtectedRoute>
              }
            />
            <Route path="/formateur" element={<ProtectedRoute><Formateur /></ProtectedRoute>} />
            <Route path="/formateur/dashboard" element={<ProtectedRoute><DashboardFormateur /></ProtectedRoute>} />
            <Route path="/formateur/stagiaires" element={<ProtectedRoute><Stagiaires /></ProtectedRoute>} />
            <Route path="/formateur/stagiaires/:stagiaireId" element={<ProtectedRoute><StagiaireDetails /></ProtectedRoute>} />
            <Route path="/formateur/logs" element={<ProtectedRoute><LogsAudit /></ProtectedRoute>} />
            <Route path="/patients" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/patients/:id" element={<ProtectedRoute><PatientSingle /></ProtectedRoute>} />
            <Route path="/patients/:id/hospitalisations" element={<ProtectedRoute><HospitalisationsList /></ProtectedRoute>} />
            <Route path="/patients/:id/hospitalisations/nouveau" element={<ProtectedRoute><HospitalisationWizard /></ProtectedRoute>} />
            <Route path="/patients/:id/hospitalisations/:hid" element={<ProtectedRoute><HospitalisationDetail /></ProtectedRoute>} />
            <Route path="/hospitalisations" element={<ProtectedRoute><HospitalisationsAll /></ProtectedRoute>} />
            <Route path="/patients/nouveau" element={<ProtectedRoute><NouveauPatient /></ProtectedRoute>} />
            <Route path="/patients/:id/modifier" element={<ProtectedRoute><ModifierPatient /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
            <Route path="/communications" element={<ProtectedRoute><Communications /></ProtectedRoute>} />
            <Route path="/mon-profil" element={<ProtectedRoute><MonProfil /></ProtectedRoute>} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App
