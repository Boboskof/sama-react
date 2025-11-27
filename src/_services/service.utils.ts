// src/_services/service.utils.ts
import type { AxiosResponse } from "axios";

/** Déroule une collection (tableau direct ou API Platform Hydra) */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    // Réponse standard JSON: { data: [...] }
    if (Array.isArray((data as any)["data"])) {
      return (data as any)["data"] as T[];
    }
    // Vérifier d'abord hydra:member (format standard)
    if (Array.isArray((data as any)["hydra:member"])) {
      return (data as any)["hydra:member"] as T[];
    }
    // Puis vérifier member (format alternatif)
    if (Array.isArray((data as any)["member"])) {
      return (data as any)["member"] as T[];
    }
  }
  return [];
}

/** Encodage d'identifiant / segment d'URL */
export const enc = (v: unknown) => encodeURIComponent(String(v));

/** Header pour PATCH application/merge-patch+json */
export const mergePatchHeaders = {
  headers: { "Content-Type": "application/merge-patch+json" },
};

/** GET liste → [] si 404 ; accepte Axios.get(...) directement */
export async function safeGetList<T>(p: Promise<AxiosResponse<any>>): Promise<T[]> {
  try {
    const { data } = await p;
    return unwrapList<T>(data);
  } catch (e: any) {
    if (e?.response?.status === 404) return [];
    if (e?.response?.status === 500) {
      console.error('safeGetList 500 response:', e.response?.data);
      if (Array.isArray(e.response?.data)) {
        return e.response.data as T[];
      }
      if (e.response?.data && typeof e.response.data === 'object') {
        const fallback = unwrapList<T>(e.response.data);
        if (fallback.length) return fallback;
      }
    }
    throw e;
  }
}

/** GET objet → {} si 404 ; accepte Axios.get(...) directement */
export async function safeGetObject<T extends object = Record<string, unknown>>(
  p: Promise<AxiosResponse<any>>
): Promise<T> {
  try {
    const { data } = await p;
    if (data && typeof data === 'object' && (data as any).data && typeof (data as any).data === 'object') {
      return ((data as any).data ?? {}) as T;
    }
    return (data ?? {}) as T;
  } catch (e: any) {
    if (e?.response?.status === 404) return {} as T;
    throw e;
  }
}
