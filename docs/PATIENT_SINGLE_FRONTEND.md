## Page Patient (Single) – Guide Front-End

Objectif: afficher une fiche patient complète avec ses blocs, en gérant proprement les états vides et les erreurs.

### Données visées
- patient: objet (peut être vide `{}`)
- couvertures: liste `[]`
- documents: liste `[]`
- hospitalisations: liste `[]`
- rdv: liste `[]`

Payload agrégé attendu côté UI:
```json
{
  "patient": {},
  "couvertures": [],
  "documents": [],
  "hospis": [],
  "rdvs": []
}
```

### Endpoints (via Vite proxy)
- GET `/api/patients/{id}` → objet patient (prioritaire)
- GET `/api/patients/show/{id}` → objet patient (fallback)
- GET `/api/couvertures?patient.id={id}` → Hydra collection
- GET `/api/documents?patient.id={id}&order[uploadedAt]=desc&limit=50` → Hydra collection
- GET `/api/hospitalisations?patient.id={id}` → Hydra collection
- GET `/api/rendez-vous/tous?patient.id={id}&order[startAt]=desc&limit=50` → collection (selon impl.)

Toujours appeler des URLs relatives commençant par `/api/...` (Vite proxy vers `http://localhost:8000`).

### Vite proxy (dev)
```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
      '/auth': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    },
  },
})
```
Redémarrer Vite après modification.

### HTTP (Axios)
- baseURL en dev: `'/api'`
- JWT: ajouter `Authorization: Bearer <token>` via interceptor
- Cookies de session (si utilisés): `withCredentials: true`

```ts
// services/http.ts
import axios from 'axios'
export const http = axios.create({ baseURL: '/api', withCredentials: true })
http.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) { cfg.headers = cfg.headers ?? {}; cfg.headers.Authorization = `Bearer ${t}` }
  return cfg
})
```

### Services
```ts
// Patient: tente /patients/:id puis /patients/show/:id
export async function fetchPatient(id: string) {
  const r1 = await http.get(`/patients/${id}`); const d1 = r1?.data?.data ?? r1?.data
  if (d1 && typeof d1 === 'object' && (d1.id || d1['@id'])) return d1
  const r2 = await http.get(`/patients/show/${id}`); const d2 = r2?.data?.data ?? r2?.data
  return d2 && typeof d2 === 'object' ? d2 : {}
}

export const fetchCouvertures = (pid: string) =>
  http.get(`/couvertures`, { params: { 'patient.id': pid } }).then(r => r.data)

export const fetchDocuments = (pid: string) =>
  http.get(`/documents`, { params: { 'patient.id': pid, 'order[uploadedAt]': 'desc', limit: 50 } }).then(r => r.data)

export const fetchHospis = (pid: string) =>
  http.get(`/hospitalisations`, { params: { 'patient.id': pid } }).then(r => r.data)

export const fetchRdvs = (pid: string) =>
  http.get(`/rendez-vous/tous`, { params: { 'patient.id': pid, 'order[startAt]': 'desc', limit: 50 } }).then(r => r.data)
```

### Helpers Hydra et résumé
```ts
type Hydra<T> = { 'hydra:member': T[] }

export function extractList<T = any>(data: any): T[] {
  if (data && Array.isArray(data['hydra:member'])) return data['hydra:member'] as T[]
  if (Array.isArray(data)) return data as T[]
  return []
}

export function summarize(list: any[]) {
  const first = list[0] ?? {}
  return { count: list.length, firstKeys: Object.keys(first) }
}
```

### Chargement (ex: React Query)
```tsx
import { useParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { fetchPatient, fetchCouvertures, fetchDocuments, fetchHospis, fetchRdvs, extractList, summarize } from './services'

export default function PatientSingle() {
  const { id = '' } = useParams()
  const [pQ, cQ, dQ, hQ, rQ] = useQueries({
    queries: [
      { queryKey: ['patient', id], queryFn: () => fetchPatient(id), enabled: !!id },
      { queryKey: ['couvertures', id], queryFn: () => fetchCouvertures(id), enabled: !!id },
      { queryKey: ['documents', id], queryFn: () => fetchDocuments(id), enabled: !!id },
      { queryKey: ['hospis', id], queryFn: () => fetchHospis(id), enabled: !!id },
      { queryKey: ['rdvs', id], queryFn: () => fetchRdvs(id), enabled: !!id },
    ],
  })

  if ([pQ, cQ, dQ, hQ, rQ].some(q => q.isLoading)) return <div>Chargement…</div>
  if ([pQ, cQ, dQ, hQ, rQ].some(q => q.isError)) return <div>Erreur lors du chargement</div>

  const patient = pQ.data ?? {}
  const couvertures = extractList(cQ.data)
  const documents = extractList(dQ.data)
  const hospis = extractList(hQ.data)
  const rdvs = extractList(rQ.data)

  const sC = summarize(couvertures)
  const sD = summarize(documents)
  const sH = summarize(hospis)
  const sR = summarize(rdvs)

  return (
    <div>
      <h1>{[patient?.prenom, patient?.nom].filter(Boolean).join(' ') || 'Patient'}</h1>
      {/* sections … */}
    </div>
  )
}
```

### Debug (DEV)
```tsx
{import.meta.env.DEV && (
  <details>
    <summary>Debug données</summary>
    <div>patient: {JSON.stringify({ id: patient?.id, prenom: patient?.prenom, nom: patient?.nom, genre: patient?.genre })}</div>
    <div>couvertures: {JSON.stringify({ count: couvertures.length, firstKeys: Object.keys(couvertures[0] || {}) })}</div>
    <div>documents: {JSON.stringify({ count: documents.length, firstKeys: Object.keys(documents[0] || {}) })}</div>
    <div>hospitalisations: {JSON.stringify({ count: hospis.length, firstKeys: Object.keys(hospis[0] || {}) })}</div>
    <div>rdv: {JSON.stringify({ count: rdvs.length, firstKeys: Object.keys(rdvs[0] || {}) })}</div>
  </details>
)}
```

### Bonnes pratiques
- baseURL `'/api'` (Vite proxy)
- Toujours envoyer le Bearer si JWT
- Le “single” lit un objet (pas `hydra:member`)
- Gérer les enveloppes `{data}`/`{patient}` si présentes
- Afficher des états vides clairs et utiliser des valeurs de repli `—`








