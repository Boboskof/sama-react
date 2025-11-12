// Utilitaires pour l'authentification en mode développement

// Créer un token JWT simulé pour le développement
export function createMockJWT() {
  // Header
  const header = {
    "alg": "HS256",
    "typ": "JWT"
  };

  // Payload (données utilisateur simulées)
  const payload = {
    "sub": "1", // ID utilisateur
    "iat": Math.floor(Date.now() / 1000), // Issued at
    "exp": Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Expires in 24h
    "roles": ["ROLE_USER"],
    "email": "admin@example.com",
    "nom": "Admin",
    "prenom": "Utilisateur"
  };

  // Encoder en base64url
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  // Signature simulée (en développement, on ne vérifie pas vraiment)
  const signature = "mock-signature-for-development";
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Fonction utilitaire pour encoder en base64url
function base64UrlEncode(str) {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Données utilisateur simulées
export const mockUser = {
  id: 1,
  email: "admin@example.com",
  nom: "Admin",
  prenom: "Utilisateur",
  roles: ["ROLE_USER"],
  isFormateur: false
};

// Configuration pour le mode développement
export const devConfig = {
  enableMockAuth: process.env.NODE_ENV === 'development',
  mockToken: createMockJWT(),
  mockUser: mockUser
};




















