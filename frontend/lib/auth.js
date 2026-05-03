const AUTHENTIK_URL = process.env.NEXT_PUBLIC_AUTHENTIK_URL;
const CLIENT_ID = process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_AUTHENTIK_REDIRECT_URI;
const APP_SLUG = process.env.NEXT_PUBLIC_AUTHENTIK_APP_SLUG;

export const authService = {

  // Rediriger vers Authentik pour le login
  login() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: crypto.randomUUID(),
    });

    const authUrl = `${AUTHENTIK_URL}/application/o/authorize/?${params.toString()}`;
    window.location.href = authUrl;
  },

  // Échanger le code via notre backend (qui a le secret)
async exchangeCode(code) {
  console.log('[Auth] Début exchangeCode, code:', code?.substring(0, 10));
  
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  console.log('[Auth] Réponse status:', res.status);

  if (!res.ok) throw new Error('Échec échange code');
  const { data } = await res.json();

  console.log('[Auth] Token reçu:', data?.access_token?.substring(0, 20));

  localStorage.setItem('kounhany_access_token', data.access_token);
  localStorage.setItem('kounhany_id_token', data.id_token || '');
  localStorage.setItem('kounhany_refresh_token', data.refresh_token || '');

  const user = this._decodeToken(data.access_token);
  localStorage.setItem('kounhany_user', JSON.stringify(user));

  return data;
},

  // Logout — révoke le token et redirige vers Authentik
  logout() {
    const idToken = localStorage.getItem('kounhany_id_token');
    localStorage.removeItem('kounhany_access_token');
    localStorage.removeItem('kounhany_id_token');
    localStorage.removeItem('kounhany_refresh_token');
    localStorage.removeItem('kounhany_user');

    // Logout Authentik
    const params = new URLSearchParams({
      id_token_hint: idToken || '',
      post_logout_redirect_uri: `${process.env.NEXT_PUBLIC_API_URL_FRONTEND}/login`,
    });
    window.location.href = `${AUTHENTIK_URL}/application/o/${APP_SLUG}/end-session/?${params.toString()}`;
  },

  // Vérifier si authentifié
  isAuthenticated() {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('kounhany_access_token');
    if (!token) return false;

    // Vérifier expiration
    try {
      const decoded = this._decodeToken(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        this.logout();
        return false;
      }
    } catch { }

    return true;
  },

  // Récupérer le token pour les appels API
  getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kounhany_access_token');
  },

  // Récupérer les infos user
  getUser() {
    if (typeof window === 'undefined') return null;
    try {
      const user = localStorage.getItem('kounhany_user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  // Décoder un JWT sans vérification (côté client)
  _decodeToken(token) {
    try {
      const base64 = token.split('.')[1];
      const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return {};
    }
  },
};