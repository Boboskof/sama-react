// src/_services/document.service.ts
import Axios from "./caller.service";
import { AxiosUpload, AxiosAuth } from "./caller.service";
import type { AxiosResponse } from "axios";
import type { Document } from "../types/api";
import { unwrapList, safeGetList, safeGetObject, enc, mergePatchHeaders } from './service.utils';

/** GET blob → null si 404 */
async function safeGetBlob(p: Promise<AxiosResponse<Blob>>): Promise<Blob | null> {
  try {
    const { data } = await p;
    return data ?? null;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

const documentService = {
  // ===== Collection / Item REST standards =====
  getDocuments(params: Record<string, any> = {}): Promise<Document[]> {
    // L'endpoint unique /documents renvoie uploaded_by et est filtré côté serveur selon le rôle
    return safeGetList<Document>(Axios.get("/documents", { params }));
  },

  getAllDocuments(): Promise<Document[]> {
    return documentService.getDocuments();
  },

  // Mes documents: implémenté côté front via filtre uploadedBy.id (pas d'appel à /documents/mine)
  async getMyDocuments(userId?: string): Promise<Document[]> {
    const params: Record<string, any> = { "order[uploadedAt]": "desc" };
    if (userId) params["uploadedBy.id"] = userId;
    return documentService.getDocuments(params);
  },

  getOneDocument(id: string | number): Promise<Document> {
    return safeGetObject<Document>(Axios.get(`/documents/${enc(id)}`));
  },

  // Si payload est FormData → AxiosUpload, sinon JSON
  createDocument(payload: FormData | Partial<Document>): Promise<Document> {
    const client = payload instanceof FormData ? AxiosUpload : Axios;
    return client.post("/documents", payload).then(r => r.data as Document);
  },

  updateDocument(id: string | number, payload: Partial<Document>): Promise<Document> {
    return Axios.put(`/documents/${enc(id)}`, payload).then(r => r.data as Document);
  },

  patchDocument(id: string | number, partial: Partial<Document>): Promise<Document> {
    return Axios.patch(`/documents/${enc(id)}`, partial, mergePatchHeaders).then(r => r.data as Document);
  },

  deleteDocument(id: string | number): Promise<any> {
    return Axios.delete(`/documents/${enc(id)}`).then(r => r.data);
  },

  // ===== Filtres pratiques =====
  getPatientDocuments(patientId: string | number, extraParams: Record<string, any> = {}): Promise<Document[]> {
    return documentService.getDocuments({ patient: patientId, ...extraParams });
  },

  getPendingDocuments(extraParams: Record<string, any> = {}): Promise<Document[]> {
    return documentService.getDocuments({ status: "pending", ...extraParams });
  },

  getRecentDocuments(limit = 10): Promise<Document[]> {
    return documentService.getDocuments({ limit, "order[createdAt]": "desc" });
  },

  // ===== Actions métier =====
  async validateDocument(id: string | number): Promise<Document> {
    try {
      const r = await Axios.patch(`/documents/${enc(id)}/validate`);
      return r.data as Document;
    } catch (e: any) {
      if (e?.response?.status === 404) {
        return Axios.patch(`/documents/${enc(id)}`, { status: "validated" }, mergePatchHeaders)
          .then(r => r.data as Document);
      }
      throw e;
    }
  },

  async archiveDocument(id: string | number): Promise<Document> {
    const r = await Axios.post(`/documents/${enc(id)}/archive`);
    return r.data as Document;
  },

  async restoreDocument(id: string | number): Promise<Document> {
    const r = await Axios.post(`/documents/${enc(id)}/restore`);
    return r.data as Document;
  },

  // ===== Download =====
  async downloadDocument(id: string | number): Promise<Blob | null> {
    // Essai 1: endpoint sécurisé API Platform
    const blob = await safeGetBlob(Axios.get(`/documents/${enc(id)}/download`, { responseType: "blob" }));
    if (blob) return blob;
    // Fallback 404 → essayer via chemin statique si fileName existe
    try {
      const meta = await documentService.getOneDocument(id);
      const fileName = (meta as any)?.fileName || (meta as any)?.file_name || '';
      if (!fileName) return null;
      // AxiosAuth base root (sans /api)
      const r = await AxiosAuth.get(`/uploads/documents/${fileName}`, { responseType: 'blob' });
      return r.data ?? null;
    } catch {
      return null;
    }
  },
};

export default documentService;
