# Documentation Technique — Frontend Kounhany Wallet

---

## 1. Architecture et décisions techniques

### 1.1 Choix de la stack

**Next.js 15 (App Router)** :
- Server-side rendering pour les pages statiques
- Routing basé sur le système de fichiers
- `use(params)` pour les paramètres dynamiques (Next.js 15)

**Material UI v5** :
- Composants riches et accessibles
- Système de thème centralisé
- Compatible avec Next.js App Router via `ThemeProvider`

**Recharts** :
- Graphiques React natifs
- `ResponsiveContainer` pour l'adaptation mobile
- AreaChart, BarChart, PieChart

**Axios** :
- Instance centralisée dans `lib/api.js`
- Headers d'authentification injectés automatiquement

### 1.2 Architecture des composants

```
app/                    → Pages et layouts (routing uniquement)
components/
  ├── layout/           → Sidebar, TopBar, PageLoader
  ├── common/           → StatusBadge (réutilisable partout)
  ├── dashboard/        → Composants dashboard financier
  │   └── system/       → Composants dashboard système
  ├── clients/          → Table, dialogs clients
  ├── wallet/           → Composants page wallet
  └── transactions/     → KPIs, filtres, dialog transactions
lib/
  ├── api.js            → Toutes les fonctions API
  ├── auth.js           → Service authentification
  └── alerts-context.js → Contexte global alertes
theme/
  └── theme.js          → Thème MUI centralisé
```

---

## 2. Thème et charte graphique

### 2.1 Couleurs

```javascript
// theme/theme.js
const theme = createTheme({
  palette: {
    primary: { main: '#FAC345' },    // Jaune Kounhany
    secondary: { main: '#212529' },  // Noir
    success: { main: '#10B981' },    // Vert — Disponible
    warning: { main: '#F59E0B' },    // Orange — Bloqué
    error: { main: '#EF4444' },      // Rouge — Créances/Erreurs
    info: { main: '#3B82F6' },       // Bleu — Info
  },
});
```

### 2.2 Police

DM Sans chargée via Google Fonts dans `app/layout.js`.

### 2.3 Conventions de style

- Cartes avec `borderRadius: 2` (8px)
- Espacement interne des cards : `p: { xs: 2, md: 3 }`
- Chips de statut : `bgcolor: ${color}12`, `border: 1px solid ${color}25`
- Hover sur lignes de tableau : `bgcolor: rgba(250,195,69,0.05)`

---

## 3. Gestion de l'état

### 3.1 État local (useState)

Utilisé pour :
- Données de page (clients, transactions, wallet)
- États UI (loading, error, dialogs ouverts)
- Filtres et pagination

### 3.2 Contexte global (AlertsContext)

```javascript
// lib/alerts-context.js
const AlertsContext = createContext({
  alerts: [],           // toutes les alertes
  financialAlerts: [],  // filtrées par category === 'financial'
  systemAlerts: [],     // filtrées par category === 'system'
  setAlerts: () => {},
  markAllRead: () => {},
  unreadCount: 0,
});
```

Les alertes lues sont persistées en localStorage via des clés générées depuis le contenu de l'alerte :
```javascript
const alertKey = (alert) => `${alert.type}_${alert.category}_${alert.message}_${alert.client_id || 'none'}`;
```

---

## 4. Authentification

### 4.1 AuthGuard

```javascript
// components/AuthGuard.jsx
// Vérifie localStorage au montage (useEffect)
// Redirige vers /login si non authentifié
// Retourne null avant le montage pour éviter l'hydration mismatch
```

### 4.2 Problème d'hydratation Next.js

Next.js génère le HTML côté serveur où `localStorage` n'existe pas. Solution systématique :

```javascript
const [mounted, setMounted] = useState(false);
const [user, setUser] = useState(null);

useEffect(() => {
  setMounted(true);
  setUser(authService.getUser());
}, []);

if (!mounted) return null;
```

Appliqué dans : `AuthGuard`, `Sidebar`, `TopBar`.

---

## 5. Appels API

### 5.1 Instance Axios centralisée

```javascript
// lib/api.js
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'kounhany-secret-2024' },
});
```

### 5.2 API disponibles

```javascript
export const clientsApi = {
  list: () => api.get('/clients'),
  getOne: (id) => api.get(`/clients/${id}`),
  getWallet: (id) => api.get(`/clients/${id}/wallet`),
  getScimUsers: () => api.get('/clients/scim/users'),
  createFromScim: (data) => api.post('/clients/from-scim', data),
};

export const walletApi = {
  balance: (clientId) => api.get(`/wallet/balance/${clientId}`),
  transactions: (clientId) => api.get(`/wallet/transactions/${clientId}`),
  checkAvailable: (data) => api.post('/wallet/check-available', data),
  block: (data) => api.post('/wallet/block', data),
  confirm: (data) => api.post('/wallet/confirm', data),
  pay: (data) => api.post('/wallet/pay', data),
  externalDebt: (data) => api.post('/wallet/external-debt', data),
  externalPayment: (data) => api.post('/wallet/external-payment', data),
};
```

---

## 6. Pages et composants clés

### 6.1 Dashboard (`app/page.js`)

Toggle via `useState('financial' | 'system')`.

**Financial** : Charge overview, trend, topClients, alerts, recent transactions en parallèle avec `Promise.all`. Les alertes sont stockées dans le contexte global `useAlerts().setAlerts`.

**System** : Composant `SystemDashboard` autonome avec auto-refresh 30s via `setInterval`.

### 6.2 Liste clients (`app/clients/page.js`)

Chargement en deux étapes :
1. Fetch liste clients (bloquant)
2. Fetch balances en parallèle (non bloquant — Skeleton pendant le chargement)

```javascript
// Étape 1 : liste
const list = await clientsApi.list();
setClients(list);
setLoading(false);  // ← affiche le tableau immédiatement

// Étape 2 : balances en parallèle
const balanceResults = await Promise.all(list.map(c => walletApi.balance(c.client_id)));
setBalances(balanceMap);
setBalancesLoading(false);  // ← remplace les Skeleton
```

### 6.3 Page wallet (`app/clients/[id]/wallet/page.js`)

Paramètres Next.js 15 :
```javascript
import { use } from 'react';
const { id: clientId } = use(params);  // obligatoire Next.js 15
```

Actions wallet via dialog `ActionDialog` :
- Formulaire : montant (requis), référence (optionnel auto-généré), description (optionnel)
- Après succès : `fetchData()` pour rafraîchir les soldes

### 6.4 Transactions (`app/transactions/page.js`)

Filtrage avec `useMemo` pour les performances :
```javascript
const filtered = useMemo(() => {
  return transactions.filter((tx) => {
    const matchSearch = ..., matchType = ..., matchFrom = ..., matchTo = ...;
    return matchSearch && matchType && matchFrom && matchTo;
  });
}, [transactions, search, typeFilter, dateFrom, dateTo]);
```

Export CSV :
```javascript
const exportCSV = (transactions) => {
  const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  // déclenche le téléchargement
};
```

---

## 7. Composants réutilisables

### 7.1 StatusBadge

```javascript
// components/common/StatusBadge.jsx
const statusConfig = {
  PAYMENT:          { label: 'Recharge',      color: '#3B82F6' },
  BLOCK:            { label: 'Réservation',   color: '#F59E0B' },
  CONFIRM:          { label: 'Confirmation',  color: '#10B981' },
  EXTERNAL_DEBT:    { label: 'Facture',       color: '#EF4444' },
  EXTERNAL_PAYMENT: { label: 'Paiement ext.', color: '#10B981' },
  SUCCESS:          { label: 'Succès',        color: '#10B981' },
  ERROR:            { label: 'Erreur',        color: '#EF4444' },
};
```

### 7.2 KpiCard

Props : `title`, `value`, `subtitle`, `icon`, `color`, `loading`, `trend`

`trend` : nombre positif → flèche verte ↑, négatif → flèche rouge ↓, `undefined` → rien affiché.

### 7.3 PageLoader

Barre de progression jaune fine en haut de page au changement de route :
```javascript
useEffect(() => {
  setLoading(true);
  const timer = setTimeout(() => setLoading(false), 400);
  return () => clearTimeout(timer);
}, [pathname]);
```

---

## 8. Notifications (TopBar)

### 8.1 Flux

```
fetchAlerts() → setAlerts(data) → AlertsContext
     ↓
TopBar lit useAlerts()
     ↓
Badge = unreadCount (alertes non lues)
     ↓
Clic icône → markAllRead() → sauve dans localStorage
```

### 8.2 Persistance localStorage

```javascript
const STORAGE_KEY = 'kounhany_read_alerts';
const alertKey = (alert) => `${alert.type}_${alert.category}_${alert.message}_${alert.client_id || 'none'}`;
// Clé unique par alerte → résiste au refresh
```

### 8.3 Onglets

- **Toutes** : toutes les alertes
- **Financier** : `alert.category === 'financial'`
- **Système** : `alert.category === 'system'`

---

## 9. SCIM Dialog (`AddWalletDialog`)

### 9.1 Étapes

**Étape 1 — Sélection** :
- Fetch `GET /clients/scim/users` au montage
- Filtre les users avec `has_wallet: true` (déjà créés)
- Filtre les users inactifs (`active: false`)
- Recherche par nom, email, département

**Étape 2 — Confirmation** :
- Affiche les infos du user sélectionné
- Explique ce qui sera créé (3 comptes Blnk)
- `POST /clients/from-scim` → crée client + wallet

### 9.2 Anti-doublon

Le backend vérifie `scim_id` ET `email` avant création. Retourne 409 si doublon.

---

## 10. Problèmes rencontrés et solutions

### Hydratation Next.js

**Problème** : Mismatch HTML serveur/client à cause de `localStorage`.

**Solution** : Pattern `mounted` + `useEffect` systématique dans tous les composants qui lisent localStorage.

### params.id Next.js 15

**Problème** : `params.id` donne un warning car `params` est maintenant une Promise.

**Solution** : `const { id } = use(params)` dans tous les composants de page dynamique.

### Pagination et recherche

**Problème** : La page ne revient pas à 0 quand le filtre change.

**Solution** : `useEffect(() => { setPage(0); }, [clients])` dans `ClientsTable`.

### Soldes chargés en deux temps

**Problème** : Attendre tous les soldes bloque l'affichage de la liste.

**Solution** : Afficher la liste immédiatement avec `Skeleton` sur les colonnes soldes, puis remplacer par les vraies valeurs.

---

## 11. Roadmap technique

### Phase 1 — Terminé ✅
- Next.js 15 App Router
- Dashboard Financier + Système avec toggle
- Clients : liste, soldes inline, SCIM dialog, pagination
- Wallet : 3 comptes, stats, actions, historique
- Transactions : filtres, pagination, export CSV
- Notifications : contexte global, onglets, persistance
- Auth basique + hydratation fix
- PageLoader entre routes

### Phase 2 — Planifié 🔄
- UI Dolibarr (liste factures, création automatique)
- B2C CMI (formulaire paiement immédiat)
- Dashboard scoring client
- Graphique encours dans le temps

### Phase 3 — Planifié ⏳
- IDP/SCIM réel → remplacer simulation
- Page Paramètres système
- Optimisation performances (SWR/React Query)