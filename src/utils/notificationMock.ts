type NotifMode = 'mock' | 'noop' | 'api';

export function getNotificationMode(): NotifMode {
  const raw = (import.meta as any)?.env?.VITE_NOTIF_MODE as string | undefined;
  console.log("🔍 VITE_NOTIF_MODE raw value:", raw);
  console.log("🔍 import.meta.env:", import.meta.env);
  
  // Force le mode API pour les vrais appels
  if (raw === 'mock' || raw === 'noop' || raw === 'api') {
    console.log("✅ Mode détecté depuis .env:", raw);
    return raw;
  }
  
  // Force mock temporairement pour voir les emails dans MailHog
  console.log("🔧 Mode forcé à 'mock' pour les tests MailHog");
  return 'mock';
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


