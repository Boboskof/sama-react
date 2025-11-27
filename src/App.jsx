import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Header from './components/Header';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import SearchBar from './components/SearchBar';
import AccessibilityPanel from './components/AccessibilityPanel';
import MonProfil from './pages/stagiaire/MonProfil.jsx';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/stagiaire/Dashboard';
import DashboardFormateur from './pages/formateur/DashboardFormateur';
import FormateurExercises from './pages/formateur/Exercises';
import ExerciseSubmissionReview from './pages/formateur/ExerciseSubmissionReview';
import DashboardAdmin from './pages/admin/DashboardAdmin';
import Formateur from './pages/formateur/Formateur';
import Stagiaires from './pages/formateur/Stagiaires';
import StagiaireDetails from './pages/formateur/StagiaireDetails';
import LogsAudit from './pages/formateur/LogsAudit';
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
import Exercises from './pages/stagiaire/Exercises';
import ExerciseExam from './pages/stagiaire/ExerciseExam';
import ExerciseSubmissionResults from './pages/stagiaire/ExerciseSubmissionResults';
import ExerciseProgression from './pages/stagiaire/ExerciseProgression';
import { AccessibilityProvider } from './contexts/AccessibilityContext';
import userService from './_services/user.service';
import './App.css';

// Composant pour gérer le fond selon la route
const AppContent = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLoaded, setUserLoaded] = useState(false);

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
    } else if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return 'bg-red-50'; // Background pour admin
    } else if (pathname === '/formateur' || pathname.startsWith('/formateur/')) {
      return 'bg-indigo-100'; // Correspond au menu indigo
    } else if (pathname === '/exercises' || pathname.startsWith('/exercises/')) {
      return 'bg-sky-100';
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
    const checkAuth = async () => {
      const isLogged = userService.isLogged();
      setIsAuthenticated(isLogged);
      
      if (isLogged) {
        let user = userService.getUser();
        if (!user) {
          // Charger l'utilisateur si absent
          try {
            user = await userService.getCurrentUser();
            // Attendre un peu pour garantir que l'utilisateur est sauvegardé
            await new Promise(resolve => setTimeout(resolve, 50));
            user = userService.getUser() || user;
          } catch (error) {
            // Continuer même en cas d'erreur
          }
        }
        setUserLoaded(!!user);
      } else {
        setUserLoaded(true);
      }
      
      setLoading(false);
    };

    checkAuth();

    // Écouter les changements de localStorage pour l'authentification
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        const isLogged = userService.isLogged();
        setIsAuthenticated(isLogged);
        // Si l'utilisateur vient d'être sauvegardé, forcer le re-render
        if (e.key === 'user' && isLogged) {
          window.dispatchEvent(new Event('authChange'));
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Écouter les changements de localStorage dans le même onglet
    const handleCustomAuthChange = () => {
      const isLogged = userService.isLogged();
      setIsAuthenticated(isLogged);
      const user = userService.getUser();
      setUserLoaded(isLogged && !!user);
    };

    window.addEventListener('authChange', handleCustomAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authChange', handleCustomAuthChange);
    };
  }, []);

  // Mettre à jour userLoaded quand l'utilisateur change
  useEffect(() => {
    const checkUser = async () => {
      const user = userService.getUser();
      if (user && isAuthenticated) {
        setUserLoaded(true);
      } else if (isAuthenticated && !user) {
        // Si connecté mais utilisateur non chargé, le charger
        try {
          await userService.getCurrentUser();
          const loadedUser = userService.getUser();
          if (loadedUser) {
            setUserLoaded(true);
          }
        } catch (error) {
          // Silencieux si erreur
        }
      }
    };
    
    checkUser();
    
    const handleUserChange = () => {
      checkUser();
    };
    
    window.addEventListener('storage', handleUserChange);
    window.addEventListener('authChange', handleUserChange);
    
    return () => {
      window.removeEventListener('storage', handleUserChange);
      window.removeEventListener('authChange', handleUserChange);
    };
  }, [isAuthenticated]);

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
    if (loading || (isAuthenticated && !userLoaded)) {
      return (
        <div className="min-h-screen">
          <LoadingSpinner message="Chargement..." />
        </div>
      );
    }

    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }

    // Vérifier si l'utilisateur essaie d'accéder à une route admin sans être admin
    if (location.pathname.startsWith('/admin')) {
      const user = userService.getUser();
      if (user) {
        const isAdmin = user.isAdmin === true || user.primaryRole === 'ROLE_ADMIN';
        if (!isAdmin) {
          // Rediriger vers le dashboard approprié selon le rôle
          if (user.isFormateur === true || user.primaryRole === 'ROLE_FORMATEUR') {
            return <Navigate to="/formateur/dashboard" replace />;
          }
          return <Navigate to="/" replace />;
        }
      } else if (userLoaded) {
        return <Navigate to="/login" replace />;
      }
    }

    // Vérifier si l'utilisateur essaie d'accéder à une route formateur sans être formateur/admin
    if (location.pathname.startsWith('/formateur')) {
      const user = userService.getUser();
      if (user) {
        // Ordre IMPORTANT : Admin > Formateur > Stagiaire
        // 1. Vérifier isAdmin en PRIORITÉ
        const isAdmin = user.isAdmin === true || user.primaryRole === 'ROLE_ADMIN';
        // 2. Vérifier isFormateur
        const isFormateur = user.isFormateur === true || user.primaryRole === 'ROLE_FORMATEUR';
        
        // Si ni admin ni formateur, rediriger vers le dashboard stagiaire
        if (!isAdmin && !isFormateur) {
          return <Navigate to="/" replace />;
        }
      } else if (userLoaded) {
        // Si userLoaded est true mais pas d'utilisateur, rediriger vers login
        return <Navigate to="/login" replace />;
      }
      // Sinon, attendre que userLoaded soit true (le spinner est déjà affiché au début)
    }

    return children;
  };

  // Composant pour protéger les routes admin
  const ProtectedAdminRoute = ({ children }) => {
    const user = userService.getUser();
    if (user) {
      const isAdmin = user.isAdmin === true || user.primaryRole === 'ROLE_ADMIN';
      if (!isAdmin) {
        // Rediriger vers le dashboard approprié selon le rôle
        if (user.isFormateur === true || user.primaryRole === 'ROLE_FORMATEUR') {
          return <Navigate to="/formateur/dashboard" replace />;
        }
        return <Navigate to="/" replace />;
      }
    } else if (userLoaded) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // Composant pour déterminer le dashboard selon le rôle (attend que l'utilisateur soit chargé)
  const DashboardRoute = () => {
    const [checkingUser, setCheckingUser] = useState(false);
    const [shouldRedirect, setShouldRedirect] = useState(null);
    
    useEffect(() => {
      const checkUserRole = async () => {
        // Attendre que l'utilisateur soit chargé
        if (!userLoaded && isAuthenticated) {
          return;
        }
        
        let user = userService.getUser();
        
        // Si l'utilisateur n'a pas les données complètes (isFormateur, primaryRole), charger depuis /api/me
        if (user && (user.isFormateur === undefined && user.primaryRole === undefined)) {
          setCheckingUser(true);
          try {
            user = await userService.getCurrentUser();
            if (!user) {
              user = userService.getUser();
            }
          } catch (error) {
            // Silencieux si erreur
          }
          setCheckingUser(false);
        }
        
        // Vérifier le rôle de l'utilisateur - Ordre IMPORTANT : Admin > Formateur > Stagiaire
        if (user) {
          // 1. Vérifier isAdmin en PRIORITÉ (priorité la plus haute)
          if (user.isAdmin === true || user.primaryRole === 'ROLE_ADMIN') {
            setShouldRedirect('/admin/dashboard');
          }
          // 2. Vérifier isFormateur (priorité moyenne)
          else if (user.isFormateur === true || user.primaryRole === 'ROLE_FORMATEUR') {
            setShouldRedirect('/formateur/dashboard');
          }
          // 3. isStagiaire est vérifié implicitement (priorité la plus basse)
          // Si ni admin ni formateur, c'est un stagiaire -> Dashboard stagiaire
          else {
            setShouldRedirect(null);
          }
        }
      };
      
      checkUserRole();
    }, [userLoaded, isAuthenticated]);
    
    // Afficher le spinner pendant le chargement
    if (checkingUser || (!userLoaded && isAuthenticated)) {
      return (
        <div className="min-h-screen">
          <LoadingSpinner message="Chargement..." />
        </div>
      );
    }
    
    // Rediriger si nécessaire
    if (shouldRedirect) {
      return <Navigate to={shouldRedirect} replace />;
    }
    
    return <Dashboard />;
  };

  // Si l'utilisateur n'est pas connecté, afficher seulement la page de connexion
  if (!isAuthenticated && !loading) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Si l'utilisateur est connecté, afficher l'interface complète
  // Attendre que l'utilisateur soit chargé avant d'afficher Header et Navbar
  if (isAuthenticated && !userLoaded) {
    return (
      <div className="min-h-screen">
        <LoadingSpinner message="Chargement..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
        <Header />
        <Navbar />
        {/* Barre de recherche globale sous les menus */}
        <div className="w-full px-4 md:px-6 mt-3">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm p-3">
            <div className="max-w-4xl mx-auto">
              <SearchBar
                placeholder="Rechercher patients, RDV, documents, communications..."
                className="w-full"
              />
            </div>
          </div>
        </div>
        {/* Contenu principal en pleine largeur, chaque page gère sa propre largeur max */}
        <main className="flex-1 w-full px-2 md:px-4 py-6">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardRoute />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/dashboard" element={<ProtectedRoute><ProtectedAdminRoute><DashboardAdmin /></ProtectedAdminRoute></ProtectedRoute>} />
            <Route path="/formateur" element={<ProtectedRoute><Formateur /></ProtectedRoute>} />
            <Route path="/formateur/dashboard" element={<ProtectedRoute><DashboardFormateur /></ProtectedRoute>} />
            <Route path="/formateur/exercises" element={<ProtectedRoute><FormateurExercises /></ProtectedRoute>} />
            <Route path="/formateur/submissions/:submissionId" element={<ProtectedRoute><ExerciseSubmissionReview /></ProtectedRoute>} />
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
            <Route path="/exercises" element={<ProtectedRoute><Exercises /></ProtectedRoute>} />
            <Route path="/exercises/:assignmentId" element={<ProtectedRoute><ExerciseExam /></ProtectedRoute>} />
            <Route path="/exercises/results/:submissionId" element={<ProtectedRoute><ExerciseSubmissionResults /></ProtectedRoute>} />
            <Route path="/exercises/progression" element={<ProtectedRoute><ExerciseProgression /></ProtectedRoute>} />
            <Route path="/mon-profil" element={<ProtectedRoute><MonProfil /></ProtectedRoute>} />
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/politique-de-confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
        <AccessibilityPanel />
      </div>
  );
};

function App() {
  return (
    <AccessibilityProvider>
      <Router>
        <AppContent />
      </Router>
    </AccessibilityProvider>
  );
}

export default App;