// src/_services/caller.service.ts
import axios, { AxiosInstance, AxiosError } from "axios";

// 1) Base URL unique
// - En dev: passe par le proxy Vite (évite CORS) → "/api"
//   OU utilise l'URL absolue si VITE_API_URL est définie (pour tester CORS)
// - En prod: utilise l'URL complète fournie par VITE_API_URL
const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
// Si VITE_API_URL est définie, l'utiliser (même en dev, pour tester CORS)
// Sinon, en dev utiliser le proxy Vite, en prod l'URL par défaut
const baseURLRaw = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL
  : (isDev ? "/api" : "http://localhost:8000/api");
// Force un trailing slash pour éviter les redirections 301 (ex: /api/communications/)
const baseURL = (String(baseURLRaw).endsWith('/') ? String(baseURLRaw) : String(baseURLRaw) + '/');
// Racine API (sans /api) pour les endpoints d'auth
// Si on est en mode proxy (baseURL qui commence par "/"), on passe aussi par le proxy "/auth"
const rootBaseURL = baseURL.startsWith("/") ? "/auth" : baseURL.replace(/\/?api$/, "");

// 2) Instance JSON par défaut (API sous /api)
// Toujours envoyer les cookies (session Symfony) et autoriser les JWT côté client
axios.defaults.withCredentials = true;

const Axios: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000, // Augmenté à 30s pour éviter les timeouts sur les requêtes lourdes
  headers: {
    Accept: "application/ld+json, application/json",
  },
  withCredentials: true,
});

// Instance dédiée auth (root, sans /api)
export const AxiosAuth: AxiosInstance = axios.create({
  baseURL: rootBaseURL,
  timeout: 30000, // Augmenté à 30s pour cohérence
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
});

// 3) Instance dédiée aux uploads (laisser Axios gérer le Content-Type)
// Pas de headers personnalisés pour éviter les preflight CORS inutiles
export const AxiosUpload: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true,
});

// --- Utils
const isAuthRoute = (url: string): boolean =>
  url.includes("/login") || url.includes("/login_check");

// 4) Intercepteurs communs
function attachAuthInterceptor(instance: AxiosInstance): void {
  instance.interceptors.request.use((request) => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        request.headers = request.headers ?? {};
        request.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      // Erreur silencieuse lors de la récupération du token
    }
    return request;
  });

  instance.interceptors.response.use(
    (response) => {
      
      return response;
    },
    (error: AxiosError) => {
      const status = error.response?.status;
      const url = (error.config?.url as string) ?? "";
      const silent = (error.config as any)?.silent === true || ((error.config?.headers as any)?.['X-Silent-Errors'] === '1');

      

      // Affichage spécial pour les violations API Platform (400)
      

      const authEndpoint = isAuthRoute(url);
      

      // Ne déconnecte QUE sur 401 (pas sur 403/404/5xx/timeout)
      const shouldAutoLogout = status === 401 && !authEndpoint;

      if (shouldAutoLogout) {
        try {
          // Appeler l'endpoint de déconnexion pour logger l'événement dans l'audit
          // Faire l'appel de manière non-bloquante (sans await) pour ne pas bloquer l'intercepteur
          const token = localStorage.getItem("token");
          if (token) {
            // Appel asynchrone non-bloquant - ne pas attendre la réponse
            axios.post(
              baseURL + 'token/logout',
              {},
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                validateStatus: () => true, // Ne pas déclencher d'erreur même si 401/403
                timeout: 2000 // Timeout court pour ne pas bloquer la déconnexion
              }
            ).catch(() => {
              // Ignorer les erreurs - on continue la déconnexion de toute façon
            });
          }
          
          // Toujours nettoyer le token et l'utilisateur immédiatement
          // (ne pas attendre la réponse de l'API de logout)
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.dispatchEvent(new CustomEvent("authChange"));
          if (typeof window !== 'undefined' && window.location) {
            window.location.href = '/login';
          }
        } catch {
          // no-op
        }
      }

      return Promise.reject(error);
    }
  );
}

// Empêche d'attacher 2x les intercepteurs (module unique)
let interceptorsAttached = (globalThis as any).__SAMA_AXIOS_INTERCEPTORS_ATTACHED__ || false;
if (!interceptorsAttached) {
  attachAuthInterceptor(Axios);
  attachAuthInterceptor(AxiosUpload);
  attachAuthInterceptor(AxiosAuth);
  (globalThis as any).__SAMA_AXIOS_INTERCEPTORS_ATTACHED__ = true;
}

// 5) (optionnel) Alerte au démarrage sur la baseURL utilisée
 

export default Axios;