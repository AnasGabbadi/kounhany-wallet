# Documentation Technique — Backend Kounhany Wallet

---

## 1. Architecture et décisions techniques

### 1.1 Choix de la stack

**Node.js + Express** pour le backend :
- Compatibilité native avec l'écosystème JavaScript
- Léger et performant pour les APIs REST
- Axios intégré pour les appels HTTP vers Blnk

**Blnk v0.13.5** comme moteur financier :
- Moteur double-entry open source
- Gestion native de l'idempotency via le champ `reference`
- API REST simple à intégrer
- Séparation propre entre la logique métier et la comptabilité

**PostgreSQL 15** avec deux bases séparées :
- `blnk_db` : gérée exclusivement par Blnk (ledgers, balances, transactions)
- `kounhany_db` : gérée par notre backend (clients, wallets, logs)
- Séparation pour éviter tout conflit de schéma

**Redis 7** : requis par Blnk pour la gestion des queues de transactions.

### 1.2 Architecture en couches

```
┌─────────────────────────────────┐
│     Frontend Admin (Next.js)    │  Dashboard, UI admin
├─────────────────────────────────┤
│     Wallet Service (Express)    │  Traduction business → ledger
├─────────────────────────────────┤
│     Blnk Ledger                 │  Moteur double-entry
├─────────────────────────────────┤
│     PostgreSQL + Redis          │  Persistance et cache
└─────────────────────────────────┘
```

Chaque couche a une responsabilité unique. Le backend ne fait jamais d'écritures directes dans `blnk_db` — tout passe par l'API Blnk.

---

## 2. Infrastructure Docker

### 2.1 Services Docker Compose

| Service | Image | Port | Rôle |
|---------|-------|------|------|
| postgres | postgres:15 | 5432 | Base de données principale |
| redis | redis:7-alpine | 6379 | Cache et queues Blnk |
| blnk | jerryenebeli/blnk:v0.13.5 | 5001 | Moteur financier |
| backend | custom (Node.js 20) | 3000 | API Wallet Service |
| frontend | custom (Next.js 15) | 3001 | Dashboard admin |

### 2.2 Initialisation de la base de données

Deux fichiers SQL montés dans `/docker-entrypoint-initdb.d/` de PostgreSQL :
- `00_create_blnk_db.sql` : crée la base `blnk_db` pour Blnk
- `01_init.sql` : crée les tables de notre application

### 2.3 Migrations Blnk

Blnk ne crée pas automatiquement son schéma. La commande suivante est exécutée au démarrage via `command` dans docker-compose :

```bash
blnk migrate up && blnk start
```

Cela applique les 33 migrations officielles de Blnk dans `blnk_db`.

### 2.4 Configuration Blnk

Blnk v0.13.5 ne lit pas le fichier `blnk.json` via volume Docker sur Windows (problème de path Git Bash). La configuration est passée via variables d'environnement :

```yaml
environment:
  BLNK_DATA_SOURCE_DNS: "postgres://kounhany:kounhany2024@postgres:5432/blnk_db?sslmode=disable"
  BLNK_REDIS_DNS: "redis:6379"
  BLNK_SERVER_PORT: "5001"
  BLNK_PROJECT_NAME: "Kounhany Wallet"
```

---

## 3. Modèle de données

### 3.1 Comptes Blnk par client

Chaque client possède 3 comptes dans Blnk, créés automatiquement à l'inscription :

| Compte | Description |
|--------|-------------|
| `Client_{id}_Available` | Solde disponible pour les opérations |
| `Client_{id}_Blocked` | Montant réservé en attente de confirmation |
| `Client_{id}_Receivable` | Créances — montants dus par le client |

### 3.2 Comptes plateforme

Créés une seule fois au démarrage du serveur :

| Compte | Description |
|--------|-------------|
| `Kounhany_Revenue` | Revenus de la plateforme |
| `Kounhany_Fees` | Frais de service |
| `Kounhany_Settlement` | Règlements en attente |

### 3.3 Tables PostgreSQL (kounhany_db)

**`clients`**
```sql
id          SERIAL PRIMARY KEY,
client_id   VARCHAR(100) UNIQUE NOT NULL,
name        VARCHAR(255) NOT NULL,
email       VARCHAR(255),
phone       VARCHAR(50),
scim_id     VARCHAR(100) UNIQUE,
created_at  TIMESTAMP DEFAULT NOW()
```

**`client_wallets`**
```sql
id                    SERIAL PRIMARY KEY,
client_id             VARCHAR(100) REFERENCES clients(client_id),
ledger_id             VARCHAR(100) NOT NULL,
available_balance_id  VARCHAR(100) NOT NULL,
blocked_balance_id    VARCHAR(100) NOT NULL,
receivable_balance_id VARCHAR(100) NOT NULL,
currency              VARCHAR(10) DEFAULT 'MAD',
created_at            TIMESTAMP DEFAULT NOW()
```

**`platform_accounts`**
```sql
id          SERIAL PRIMARY KEY,
account_key VARCHAR(100) UNIQUE NOT NULL,
balance_id  VARCHAR(100) NOT NULL,
ledger_id   VARCHAR(100) NOT NULL,
created_at  TIMESTAMP DEFAULT NOW()
```

**`transaction_logs`**
```sql
id             SERIAL PRIMARY KEY,
client_id      VARCHAR(100),
transaction_id VARCHAR(100),
type           VARCHAR(50),
amount         DECIMAL(15,2),
currency       VARCHAR(10) DEFAULT 'MAD',
reference      VARCHAR(255),
description    TEXT,
status         VARCHAR(20) DEFAULT 'SUCCESS',
error_message  TEXT,
created_at     TIMESTAMP DEFAULT NOW()
```

---

## 4. Transactions double-entry

### 4.1 BLOCK — Réservation

```
Débit  : Client_Available
Crédit : Client_Blocked
```
Validation préalable du solde disponible obligatoire.

### 4.2 CONFIRM — Consommation

```
Débit  : Client_Blocked
Crédit : Client_Receivable
```

### 4.3 PAYMENT — Paiement reçu (Recharge)

```
Débit  : @World (source externe)
Crédit : Client_Available
```

### 4.4 EXTERNAL_DEBT — Dette Dolibarr

```
Débit  : @World
Crédit : Client_Receivable
```

### 4.5 EXTERNAL_PAYMENT — Paiement Dolibarr

```
Débit  : Client_Receivable
Crédit : @World
```

---

## 5. Règles critiques implémentées

### 5.1 Validation automatique avant BLOCK

```javascript
const balance = await blnkService.getBalance(wallet.available_balance_id);
const available = balance.balance / 100;
if (available < amount) {
  throw { status: 422, message: `Solde insuffisant — disponible: ${available} MAD, demandé: ${amount} MAD` };
}
```

### 5.2 Idempotency

Chaque transaction accepte un champ `reference` optionnel. Si une transaction avec la même référence existe déjà dans `transaction_logs`, le système retourne la transaction existante sans en créer une nouvelle.

```javascript
const existing = await pool.query(
  'SELECT * FROM transaction_logs WHERE reference = $1 AND client_id = $2',
  [reference, clientId]
);
if (existing.rows.length > 0) return existing.rows[0];
```

### 5.3 Traçabilité complète

Chaque opération est loguée dans `transaction_logs` avec type, montant, référence, description, statut et message d'erreur éventuel.

### 5.4 Paramètres Blnk obligatoires

Toutes les transactions Blnk incluent :
```javascript
{
  allow_overdraft: true,  // requis par Blnk v0.13.5
  precision: 100,          // montants en centimes
  skip_queue: false,       // file d'attente Redis active
}
```

---

## 6. API Clients et SCIM

### 6.1 Flux de création client

Tous les clients sont créés depuis l'IDP via SCIM — aucune création manuelle.

```
GET  /clients/scim/users   → liste simulée (Phase 3 : appel IDP réel)
POST /clients/from-scim    → crée client + wallet en une requête
```

### 6.2 Vérification des doublons

```javascript
// Doublon scim_id
const existingScim = await pool.query('SELECT * FROM clients WHERE scim_id = $1', [scim_id]);
if (existingScim.rows.length > 0) throw { status: 409, message: 'Ce user SCIM a déjà un wallet créé' };

// Doublon email
const existingEmail = await pool.query('SELECT * FROM clients WHERE email = $1', [email]);
if (existingEmail.rows.length > 0) throw { status: 409, message: 'Un client avec cet email existe déjà' };
```

---

## 7. KPIs et Analytics

### 7.1 Sources de données

| Donnée | Source |
|--------|--------|
| Soldes (available, blocked, receivable) | API Blnk |
| Volumes et comptages | `transaction_logs` (kounhany_db) |
| Top clients | SQL agrégé sur `transaction_logs` |
| Alertes | Calculs SQL (dettes, erreurs, inactivité) |
| État des services | Health checks HTTP + pool.query |

### 7.2 Types de transactions dans la DB

```
PAYMENT          → recharge wallet
BLOCK            → réservation
CONFIRM          → consommation
EXTERNAL_DEBT    → facture Dolibarr
EXTERNAL_PAYMENT → paiement Dolibarr
```

### 7.3 Système d'alertes (catégorisées)

**Financières :**
- Erreurs de transaction dans les 24h
- Dettes nettes > 1000 MAD
- Solde disponible à zéro avec encours actif
- Inactivité > 24h

**Système :**
- Blnk inaccessible
- PostgreSQL inaccessible
- Taux d'erreur > 10% sur la dernière heure

---

## 8. Sécurité

### 8.1 Authentification actuelle

API Key via header `x-api-key`. Toutes les routes sont protégées sauf `/health`.

### 8.2 Endpoint system-info sécurisé

L'endpoint `/kpis/system-info` ne retourne jamais :
- Versions exactes des dépendances (en production)
- URLs internes des services
- Temps de réponse détaillés
- Messages d'erreur internes

```javascript
// Seul ce qui est toujours retourné
{
  environment, version, uptime_human,
  swagger_url,  // null en production
  services: {
    name, status, detail  // "Opérationnel" ou "Connexion échouée"
  }
}
```

### 8.3 Helmet

Protection HTTP via `helmet` — headers de sécurité sur toutes les réponses.

---

## 9. Tests

### 9.1 Structure

```
tests/
├── unit/
│   ├── middlewares.test.js       Auth, error, validate
│   ├── blnk.service.test.js      Appels API Blnk
│   ├── wallet.service.test.js    Logique métier wallet
│   └── platform.service.test.js  Comptes plateforme
└── integration/
    ├── clients.test.js            Routes /clients + /clients/scim
    └── wallet.test.js             Routes /wallet
```

### 9.2 Résultats Phase 1

```
Test Suites : 6 passed
Tests       : 62 passed
Coverage    : 91.84%
```

| Suite | Tests | Statut |
|-------|-------|--------|
| middlewares | 8 | ✅ |
| blnk.service | 10 | ✅ |
| wallet.service | 14 | ✅ |
| platform.service | 4 | ✅ |
| clients (integration) | 10 | ✅ |
| wallet (integration) | 16 | ✅ |

---

## 10. Problèmes rencontrés et solutions

### Blnk ne crée pas son schéma automatiquement

**Problème** : Blnk v0.13.5 démarre sans initialiser ses tables PostgreSQL.

**Solution** : Ajouter `blnk migrate up` avant `blnk start` dans la commande Docker.

### Blnk ne lit pas blnk.json sur Windows

**Problème** : Git Bash sur Windows convertit `/blnk.json` en chemin système.

**Solution** : Passer toute la configuration via variables d'environnement Docker.

### Port 3000 occupé pendant les tests Jest

**Problème** : Jest importe `app.js` qui démarre le serveur causant un conflit de port.

**Solution** : Séparer `app.js` (configuration Express) de `server.js` (démarrage). Les tests importent uniquement `app.js`.

### Types de transactions en français dans la DB

**Problème** : Le seed initial utilisait `description.split(' ')[0]` comme type, donnant `RÉSERVATION`, `RECHARGE` etc.

**Solution** : Passer le type explicitement dans `quickTransaction(clientId, amount, reference, description, source, destination, type)`.

### `this._formatUptime is not a function`

**Problème** : Méthode appelée avec `this` dans un contexte async qui perd la référence.

**Solution** : Définir `formatUptime` comme fonction locale dans `getSystemInfo` au lieu de méthode de l'objet.

---

## 11. Roadmap technique

### Phase 1 — Terminé ✅
- Docker Compose 5 services
- Blnk setup + migrations automatiques
- 8 APIs wallet + 5 APIs clients + 5 APIs KPIs
- Comptes plateforme initialisés au démarrage
- Validation automatique avant BLOCK
- Idempotency sur toutes les transactions
- Logs traçabilité complets
- SCIM simulation + création client depuis IDP
- Swagger documentation
- 62 tests — 91.84% couverture

### Phase 2 — Terminé 🔄
- Dolibarr : création automatique de facture au CONFIRM
X- Flux B2C CMI (paiement immédiat)
- Scoring client (historique, encours, retard, volume)
X- Plafonds de crédit par client

### Phase 3 — Planifié ⏳
- IDP/SCIM réel (Keycloak / Okta / Azure AD)
- Intégration bancaire
- Monitoring avancé (Prometheus, Grafana)
- Optimisation performances