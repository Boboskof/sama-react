// src/_services/user.service.ts
import Axios from "./caller.service";
import { unwrapList, enc } from './service.utils';

/* ===================== Utils ===================== */

// Decode Base64URL -> UTF-8 string (navigateur uniquement, sans Buffer)
function base64UrlToUtf8(b64url: string): string {
  // Base64URL -> Base64
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";

  // atob -> binary string
  const bin = atob(b64);

  // binary -> Uint8Array
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i) & 0xff;

  // Uint8Array -> UTF-8
  return new TextDecoder("utf-8").decode(bytes);
}

// Parse le JWT en JSON (retourne null en cas d’échec)
function parseJwt(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadPart = parts[1] as string; // défini si length === 3
    const json = base64UrlToUtf8(payloadPart);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 15): boolean {
  const payload = parseJwt(token);
  if (!payload?.exp) return false; // si pas d'exp, on laisse le back décider
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now + skewSeconds;
}


/* ===================== Storage ===================== */

const STORAGE_TOKEN = "token";
const STORAGE_USER = "user";

function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN);
}
function setStoredToken(t: string) {
  localStorage.setItem(STORAGE_TOKEN, t);
}
function clearStoredToken() {
  localStorage.removeItem(STORAGE_TOKEN);
}

function getStoredUser(): any | null {
  try {
    const s = localStorage.getItem(STORAGE_USER);
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    localStorage.removeItem(STORAGE_USER);
    return null;
  }
}
function setStoredUser(u: any) {
  localStorage.setItem(STORAGE_USER, JSON.stringify(u));
}
function clearStoredUser() {
  localStorage.removeItem(STORAGE_USER);
}

function dispatchAuthChange() {
  window.dispatchEvent(new CustomEvent("authChange"));
}

/* ============= Single-flight pour /me ============= */

let inflightMe: Promise<any> | null = null;

/* ===================== Service ===================== */

const userService = {
  /* ---------- AUTH ---------- */
  login: async (credentials: { email: string; password: string }) => {
    try {
      // Le backend attend { email, password }
      const payload = {
        email: credentials.email,
        password: credentials.password,
      };

      const resp = await Axios.post("/login_check", payload, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });

      const token: string | undefined = resp?.data?.token;
      if (token) {
        setStoredToken(token);
      }

      // Si le back renvoie déjà l'utilisateur
      const inlineUser = resp?.data?.user;
      if (inlineUser) {
        setStoredUser(inlineUser);
        dispatchAuthChange();
        return resp;
      }

      // Sinon on récupère via /me (single-flight)
      await userService.getCurrentUser();
      return resp;
    } catch (error) {
      console.error("❌ Erreur de connexion:", error);
      throw error;
    }
  },

  register: (credentials: Record<string, any>) =>
    Axios.post("/auth/register", credentials),

  logout: () => {
    clearStoredToken();
    clearStoredUser();
    dispatchAuthChange();
  },

  /* ---------- TOKEN / SESSION ---------- */
  saveToken: (token: string) => {
    setStoredToken(token);
  },

  getToken: (): string | null => getStoredToken(),

  isLogged: (): boolean => {
    const token = getStoredToken();
    const hasToken = !!token;
    const expired = token ? isJwtExpired(token) : true;
    const user = getStoredUser();
    const hasUser = !!user;

    // Vérification d'authentification effectuée

    if (!hasToken || expired) {
      if (expired && token) {
      // Log de debug supprimé pour la production
        clearStoredToken();
        clearStoredUser();
      }
      return false;
    }
    return true;
  },

  saveUser: (user: any) => {
    setStoredUser(user);
    // Données utilisateur sauvegardées
    dispatchAuthChange();
  },

  getUser: (): any | null => getStoredUser(),

  getCurrentUser: async (): Promise<any | null> => {
    if (inflightMe) return inflightMe;

    inflightMe = Axios.get("/me", { headers: { 'X-Silent-Errors': '1' } })
      .then((response) => {
        const u = response?.data ?? null;
        if (u) userService.saveUser(u);
        return u;
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (status === 401) {
          return null; // silencieux si non authentifié
        }
        return null;
      })
      .finally(() => {
        inflightMe = null;
      });

    return inflightMe;
  },

  /* ---------- USERS CRUD / LIST ---------- */
  getAllUsers: async (params: Record<string, any> = {}) => {
    const resp = await Axios.get("/users", {
      params,
      headers: { Accept: "application/ld+json, application/json" },
    });
    return { data: unwrapList(resp?.data) };
  },

  getAllStagiaires: async () => {
    // Si le back expose plutôt /users?role=ROLE_STAGIAIRE, préfère ce filtre.
    const resp = await Axios.get("/users/stagiaires", {
      headers: { Accept: "application/json" },
    });
    const payload = resp?.data;
    if (Array.isArray(payload)) return { data: payload };
    if (Array.isArray(payload?.data)) return { data: payload.data };
    return { data: [] };
  },

  getOneUser: (id: string | number) => Axios.get(`/users/${enc(id)}`),
  updateUser: (id: string | number, payload: any) =>
    Axios.put(`/users/${enc(id)}`, payload),
  deleteUser: (id: string | number) => Axios.delete(`/users/${enc(id)}`),

  /* ---------- ME helpers (selon back) ---------- */
  updateMe: (payload: any) =>
    Axios.patch("/me", payload, {
      headers: { "Content-Type": "application/merge-patch+json" },
    }),

  updateMyPassword: (payload: any) => Axios.patch("/users/updatemypass", payload),

  getMe: () => Axios.get("/me"),

  /* ---------- ROLES ---------- */
  hasRole: (role: string): boolean => {
    const u = getStoredUser();
    const roles: string[] = Array.isArray(u?.roles) ? u.roles : [];
    return roles.includes(role);
  },
  isAdmin: (): boolean => userService.hasRole("ROLE_ADMIN"),
  isFormateur: (): boolean => userService.hasRole("ROLE_FORMATEUR"),
  isStagiaire: (): boolean => userService.hasRole("ROLE_STAGIAIRE"),
};

export default userService;
