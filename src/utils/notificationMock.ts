type NotifMode = 'mock' | 'noop' | 'api';

export function getNotificationMode(): NotifMode {
  const raw = (import.meta as any)?.env?.VITE_NOTIF_MODE as string | undefined;
  
  // Si une variable d'environnement est définie, l'utiliser
  if (raw === 'mock' || raw === 'noop' || raw === 'api') {
    return raw;
  }
  
  // Par défaut, utiliser l'API réelle en production
  // En développement, on peut utiliser 'mock' pour tester sans envoyer de vrais emails
  return import.meta.env.PROD ? 'api' : 'api';
}

export type SimulatedResult = {
  success: boolean;
  errorMessage?: string;
  sentAt?: string;
};

export async function simulateSend(
  payload: Record<string, any>,
  opts?: { minDelayMs?: number; maxDelayMs?: number; failureRate?: number }
): Promise<SimulatedResult> {
  const { minDelayMs = 300, maxDelayMs = 800, failureRate = 0.05 } = opts || {};
  const delay = minDelayMs + Math.floor(Math.random() * Math.max(0, maxDelayMs - minDelayMs));
  await new Promise((r) => setTimeout(r, delay));

  const success = Math.random() >= failureRate;

  // Historiser dans localStorage pour une page de démo
  try {
    const key = 'simulatedNotifications';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      date: new Date().toISOString(),
      success,
      payload,
      errorMessage: success ? undefined : 'Echec simulé (mock)',
    };
    existing.unshift(entry);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 200)));
  } catch {
    // ignorer
  }

  return {
    success,
    errorMessage: success ? undefined : 'Echec simulé (mock)',
    sentAt: success ? new Date().toISOString() : undefined,
  };
}


