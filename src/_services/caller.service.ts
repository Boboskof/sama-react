// src/_services/caller.service.ts
import axios, { AxiosInstance, AxiosError } from "axios";

// 1) Base URL unique
// - En dev: passe par le proxy Vite (évite CORS) → "/api"
// - En prod: utilise l'URL complète fournie par VITE_API_URL
const baseURLRaw =
  (import.meta as any)?.env?.VITE_API_URL ??
  ((import.meta as any)?.env?.DEV ? "/api" : "http://localhost:8000/api");
// Force un trailing slash pour éviter les redirections 301 (ex: /api/communications/)
const baseURL = (String(baseURLRaw).endsWith('/') ? String(baseURLRaw) : String(baseURLRaw) + '/');
// Racine API (sans /api) pour les endpoints d'auth
// Si on est en mode proxy (baseURL qui commence par "/"), on passe aussi par le proxy "/auth"
const rootBaseURL = baseURL.startsWith("/") ? "/auth" : baseURL.replace(/\/?api$/, "");

// 2) Instance JSON par défaut (API sous /api)
const DEBUG = !!(import.meta as any)?.env?.DEV;
// Toujours envoyer les cookies (session Symfony) et autoriser les JWT côté client
axios.defaults.withCredentials = true;

const Axios: AxiosInstance = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/ld+json",
    Accept: "application/ld+json, application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
});

// Instance dédiée auth (root, sans /api)
export const AxiosAuth: AxiosInstance = axios.create({
  baseURL: rootBaseURL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  withCredentials: true,
});

// 3) Instance dédiée aux uploads (laisser Axios gérer le Content-Type)
export const AxiosUpload: AxiosInstance = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
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
      if (import.meta.env.DEV) {
      }
      if (token) {
        request.headers = request.headers ?? {};
        // AxiosHeaders est compatible avec une assignation clé/valeur
        (request.headers as any).Authorization = `Bearer ${token}`;
        if (import.meta.env.DEV) {
        }
      } else {
      // Log de debug supprimé pour la production
      }
    } catch (error) {
      console.error("❌ Erreur lors de la récupération du token:", error);
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
      if (DEBUG && !silent) console.error("❌ Erreur interceptée:", status, "pour l'URL:", url);

      

      // Affichage spécial pour les violations API Platform (400)
      

      const authEndpoint = isAuthRoute(url);
      

      // Ne déconnecte QUE sur 401 (pas sur 403/404/5xx/timeout)
      const shouldAutoLogout = status === 401 && !authEndpoint;

      if (shouldAutoLogout) {
        // Log de debug supprimé pour la production
        try {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.dispatchEvent(new CustomEvent("authChange"));
        } catch {
          // no-op
        }
        // Redirection vers /login
        try {
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
