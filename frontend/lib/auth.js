const AUTHENTIK_URL = process.env.NEXT_PUBLIC_AUTHENTIK_URL;
const CLIENT_ID = process.env.NEXT_PUBLIC_AUTHENTIK_CLIENT_ID;
const REDIRECT_URI = process.env.NEXT_PUBLIC_AUTHENTIK_REDIRECT_URI;
const APP_SLUG = process.env.NEXT_PUBLIC_AUTHENTIK_APP_SLUG;

export const authService = {

  login() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email groups offline_access',
      state: crypto.randomUUID(),
    });
    window.location.href = `${AUTHENTIK_URL}/application/o/authorize/?${params.toString()}`;
  },

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

  logout() {
    localStorage.removeItem('kounhany_access_token');
    localStorage.removeItem('kounhany_id_token');
    localStorage.removeItem('kounhany_refresh_token');
    localStorage.removeItem('kounhany_user');
    // Redirect direct — Authentik end-session crashe (JSON.parse bug sur sa page flow)
    window.location.href = '/login';
  },

  isAuthenticated() {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('kounhany_access_token');
    if (!token) return false;

    try {
      const decoded = this._decodeToken(token);
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        // Token expiré — si refresh_token dispo, on reste connecté
        // l'interceptor axios va refresh au prochain appel API
        const refreshToken = localStorage.getItem('kounhany_refresh_token');
        if (!refreshToken) {
          this.logout();
          return false;
        }
        return true; // refresh_token dispo → pas de logout immédiat
      }
    } catch {}

    return true;
  },

  getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('kounhany_access_token');
  },

  getUser() {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('kounhany_user') || 'null');
    } catch { return null; }
  },

  _decodeToken(token) {
    try {
      const base64 = token.split('.')[1];
      const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch { return {}; }
  },
};  