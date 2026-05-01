kounhany-wallet/
│
├── backend/                        ← Node.js + Express
│   ├── src/
│   │   ├── config/
│   │   │   ├── blnk.js             ← config connexion Blnk
│   │   │   └── db.js               ← config PostgreSQL
│   │   ├── routes/
│   │   │   ├── wallet.routes.js    ← toutes les routes API
│   │   │   └── clients.routes.js
│   │   ├── controllers/
│   │   │   ├── wallet.controller.js
│   │   │   └── clients.controller.js
│   │   ├── services/
│   │   │   ├── blnk.service.js     ← logique appels Blnk
│   │   │   └── wallet.service.js   ← logique métier
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.js
│   │   │   └── error.middleware.js
│   │   └── app.js
│   ├── .env
│   └── package.json
│
├── frontend/                       ← Next.js 14
│   ├── app/
│   │   ├── layout.js
│   │   ├── page.js                 ← dashboard principal
│   │   ├── clients/
│   │   │   ├── page.js             ← liste clients
│   │   │   └── [id]/page.js        ← détail client
│   │   └── transactions/
│   │       └── page.js             ← historique
│   ├── components/
│   │   ├── WalletCard.jsx
│   │   ├── TransactionTable.jsx
│   │   └── BalanceChart.jsx
│   └── package.json
│
└── docker-compose.yml              ← Blnk + Postgres + Backend

Tâches dans l'ordre — Phase 1
Tâche 1 — Docker Compose (1 jour)
C'est la base de tout. Tu crées un docker-compose.yml qui lance ensemble : Blnk, PostgreSQL, et ton backend. Blnk a besoin de Postgres pour stocker ses données, donc ils doivent être dans le même réseau Docker.

Tâche 2 — Initialiser le backend Node.js (1 jour)
Créer le projet Express avec les dépendances : express, axios (pour appeler Blnk), pg (PostgreSQL), dotenv, joi (validation), express-async-errors. Configurer les fichiers .env, app.js, et les middlewares de base (CORS, JSON, gestion d'erreurs).

Tâche 3 — Service Blnk (2 jours)
C'est le fichier le plus important du backend. blnk.service.js contient toutes les fonctions qui appellent l'API Blnk : créer un ledger, créer un compte client (Available, Blocked, Receivable), créer une transaction. Tu dois bien comprendre comment Blnk fonctionne avant de coder ceci.

Tâche 4 — Créer les comptes clients automatiquement (1 jour)
Quand un nouveau client est enregistré, ton backend doit automatiquement créer ses 3 comptes dans Blnk. C'est le point d'entrée de toute la logique wallet.

Tâche 5 — Implémenter les routes API (2–3 jours)
Dans l'ordre de priorité :

POST /wallet/check-available → vérifier le solde
POST /wallet/block → BLOCK transaction dans Blnk
POST /wallet/confirm → CONFIRM transaction
POST /wallet/pay → enregistrer paiement
GET /wallet/balance/:clientId → retourner soldes
GET /wallet/transactions/:clientId → historique

Tâche 6 — Idempotency (1 jour)
Ajouter un champ idempotency_key dans chaque requête de transaction. Blnk supporte ça nativement — tu dois l'utiliser pour éviter les doublons en cas de retry.
Tâche 7 — Frontend Next.js (3–4 jours)
Créer le dashboard admin avec 3 pages principales :

Page d'accueil : KPIs globaux (total encours, transactions du jour, nombre de clients actifs)
Page clients : liste avec solde Available / Blocked / Receivable par client, boutons Block / Confirm / Pay
Page transactions : tableau paginé avec filtre par client, type, date


Plan de correction avant le frontend
Il faut corriger 5 points dans cet ordre :
1. Créer les comptes plateforme au démarrage dans wallet.service.js
2. Ajouter POST /wallet/external-debt et POST /wallet/external-payment
3. Ajouter la validation automatique dans le BLOCK
4. Renforcer l'idempotency
5. Ajouter les logs financiers

Dashboard      ← déjà fait
Clients        ← déjà fait
Transactions   ← déjà fait
──────────────
Opérations     ← NOUVEAU — formulaire pour toutes les opérations wallet
Rapports       ← NOUVEAU — export et stats par période
Paramètres     ← NOUVEAU — config système

❌ Ce qui manque — Non conforme
1. B2C (CMI) — Phase 2
Le cahier demande un flux B2C avec paiement immédiat CMI. Pas encore développé.
2. Dolibarr complet — Phase 2
Le cahier demande la création automatique de facture Dolibarr quand un CONFIRM est fait. On a juste external-debt et external-payment manuels.
3. Scoring client — Phase 2
Pas encore développé.
4. Score dans le dashboard
Le cahier dit "afficher le score" dans le dashboard — pas encore fait.
5. PAYMENT (client paie)
Le cahier dit Debit: Cash/Bank → Credit: Client_Receivable. Notre implémentation utilise @World → Client_Available ce qui est légèrement différent.


docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

🔄 Ajouter un système de queue (ex: BullMQ)

Ce que le CDC demande pour Dolibarr
Section 9 — Intégration Dolibarr
Le CDC définit deux flux :
Flux 1 — Kounhany → Dolibarr
Quand un CONFIRM est fait → créer automatiquement une facture dans Dolibarr
Flux 2 — Dolibarr → Kounhany
Facture créée dans Dolibarr → enregistrer une EXTERNAL_DEBT chez nous
Paiement reçu dans Dolibarr → enregistrer un EXTERNAL_PAYMENT chez nous

Les APIs Dolibarr à utiliser
Dolibarr a une API REST native. Voici exactement ce dont on a besoin :
Pour créer une facture (Flux 1) :
POST /api/index.php/invoices
Appelée automatiquement quand un CONFIRM est effectué dans notre wallet.
Pour récupérer les factures (Flux 2) :
GET /api/index.php/invoices
GET /api/index.php/invoices/{id}
Pour synchroniser les factures créées dans Dolibarr vers notre transaction_logs.
Pour récupérer les paiements (Flux 2) :
GET /api/index.php/payments
Pour savoir quand une facture est payée et déclencher un EXTERNAL_PAYMENT.

Ce qu'on doit développer concrètement
Côté backend :
services/
└── dolibarr.service.js     ← NOUVEAU
    ├── createInvoice()     → POST /invoices
    ├── getInvoices()       → GET /invoices
    └── getPayments()       → GET /payments
Flux 1 — Auto à chaque CONFIRM :
javascript// Dans wallet.service.js — méthode confirm()
await walletService.confirm(data);
await dolibarrService.createInvoice({ client_id, amount, description });
// → crée la facture dans Dolibarr automatiquement
Flux 2 — Webhook ou polling :
Option A — Webhook : Dolibarr appelle notre endpoint quand une facture est payée
Option B — Polling : On interroge Dolibarr toutes les X minutes

Variables d'environnement à ajouter
envDOLIBARR_URL=https://dolibarr.kounhany.ma
DOLIBARR_API_KEY=votre_api_key_dolibarr
DOLIBARR_POLLING_INTERVAL=300000  # 5 minutes


docker exec kounhany_dolibarr sh -c "cat > /var/www/html/conf/conf.php << 'EOF'
<?php
\$dolibarr_main_url_root='http://localhost:8888';
\$dolibarr_main_document_root='/var/www/html';
\$dolibarr_main_url_root_alt='/custom';
\$dolibarr_main_document_root_alt='/var/www/html/custom';
\$dolibarr_main_data_root='/var/www/documents';
\$dolibarr_main_db_host='postgres';
\$dolibarr_main_db_port='5432';
\$dolibarr_main_db_name='dolibarr_db';
\$dolibarr_main_db_prefix='llx_';
\$dolibarr_main_db_user='kounhany';
\$dolibarr_main_db_pass='kounhany2024';
\$dolibarr_main_db_type='pgsql';
\$dolibarr_main_authentication='dolibarr';
\$dolibarr_main_prod='1';
\$dolibarr_main_instance_unique_id='kounhany_wallet_dolibarr';
EOF"


docker-compose -f docker-compose.yml -f docker-compose.dev.yml down
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d frontend backend

docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d


Plan de travail immédiat
Étape 1 — Configurer Authentik (interface admin)
1. Créer les groupes : Fleet, Logistique, B2C
2. Créer une application SCIM → pointe vers notre backend
3. Créer un utilisateur test → assigner groupe Fleet
Étape 2 — Développer SCIM dans backend
POST /scim/v2/Users   → créer client + wallet
GET  /scim/v2/Users   → lister clients
PUT  /scim/v2/Users/:id → mettre à jour
DELETE /scim/v2/Users/:id → désactiver
Étape 3 — Tester flux complet
Admin crée user dans Authentik
        ↓
Authentik push SCIM → backend
        ↓
Client + wallet créés automatiquement
        ↓
Vérifier dans notre dashboard


# 1. Recharger les wallets de test
curl -X POST http://localhost:3000/wallet/pay \
  -H "x-api-key: kounhany-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_fleet_001","amount":10000,"reference":"RECHARGE-TEST-001"}'

# 2. FLEET — Créer commande (→ BLOCK auto)
curl -X POST http://localhost:3000/orders \
  -H "x-api-key: kounhany-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_fleet_001","order_type":"FLEET","amount":1500,"description":"Vidange + pneus","reference":"CMD-FLEET-001"}'

# 3. FLEET — Confirmer (→ CONFIRM + facture Dolibarr)
curl -X POST http://localhost:3000/orders/1/confirm \
  -H "x-api-key: kounhany-secret-2024"

# 4. LOGISTIQUE — CONFIRM direct
curl -X POST http://localhost:3000/orders \
  -H "x-api-key: kounhany-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_logistique_001","order_type":"LOGISTIQUE","amount":800,"description":"Mission Casablanca → Rabat","reference":"CMD-LOGI-001"}'

# 5. B2C — Paiement immédiat
curl -X POST http://localhost:3000/orders \
  -H "x-api-key: kounhany-secret-2024" \
  -H "Content-Type: application/json" \
  -d '{"clientId":"client_b2c_001","order_type":"B2C","amount":500,"description":"Paiement service","reference":"CMD-B2C-001"}'

# 6. Vérifier les soldes
curl http://localhost:3000/wallet/balance/client_fleet_001 \
  -H "x-api-key: kounhany-secret-2024"









1. Format du client_id universel

UUID Authentik ? → "550e8400-e29b-41d4-a716-446655440000"

mais les systeme fleet et logistique et b2c il sont pas des systeme IDP alors il sont pas etre modifier a utiliser IDP authentic alors en va cree 3 user sure notre IDP pour les 3 cas pour gere les cas metier

2. FLEET — qui confirme ?

Quand le service maintenance est terminé :

Option B → Admin confirme via notre dashboard

3. LOGISTIQUE — fin de mois

Le cron de facturation mensuelle :

Option A → Automatique le 1er de chaque mois

4. B2C CMI

Tu as la documentation CMI ?

Non → on simule avec un endpoint mock

5. Metadata par type

Pour LOGISTIQUE — quels champs dans la commande ?
j'ais pas des info sur sa