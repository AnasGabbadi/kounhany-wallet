-- ============================================================
-- Kounhany Wallet — Schéma complet DB
-- ============================================================

-- ─── CLIENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  scim_id VARCHAR(100) UNIQUE,
  client_type VARCHAR(20) DEFAULT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── WALLETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_wallets (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100) UNIQUE NOT NULL REFERENCES clients(client_id),
  ledger_id VARCHAR(255) NOT NULL,
  available_balance_id VARCHAR(255) NOT NULL,
  blocked_balance_id VARCHAR(255) NOT NULL,
  receivable_balance_id VARCHAR(255) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MAD',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── COMPTES PLATEFORME ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_accounts (
  id SERIAL PRIMARY KEY,
  account_key VARCHAR(50) UNIQUE NOT NULL,
  balance_id VARCHAR(255) NOT NULL,
  ledger_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── LOGS TRANSACTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_logs (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100),
  transaction_id VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MAD',
  reference VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'SUCCESS',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── ORDERS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  client_id VARCHAR(100) NOT NULL REFERENCES clients(client_id),
  order_type VARCHAR(20) NOT NULL
    CHECK (order_type IN ('FLEET', 'LOGISTIQUE', 'B2C')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description TEXT,
  reference VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'BLOCKED', 'CONFIRMED', 'INVOICED', 'CANCELLED', 'PAID')),
  metadata JSONB DEFAULT '{}',
  blnk_transaction_id VARCHAR(255),
  dolibarr_invoice_id VARCHAR(255),
  confirmed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ─── INDEX ORDERS ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_client_id  ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_type       ON orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_reference  ON orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ─── MIGRATIONS CLIENTS ───────────────────────────────────────
ALTER TABLE clients ALTER COLUMN client_type DROP DEFAULT;
ALTER TABLE clients ALTER COLUMN client_type TYPE VARCHAR(20);
DO $$ BEGIN
  ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_client_id VARCHAR(100) NULL;
CREATE INDEX IF NOT EXISTS idx_clients_company_client_id ON clients(company_client_id);

-- ─── MIGRATIONS ORDERS ────────────────────────────────────────
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NULL;
COMMENT ON COLUMN orders.created_by IS 'Email ou nom du membre qui a créé la commande';
CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by);

-- ─── PRESTATAIRES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prestataires (
  id SERIAL PRIMARY KEY,
  prestataire_id VARCHAR(100) UNIQUE NOT NULL,
  garage_uuid UUID NULL,                          -- NULL pour les Providers pièces
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  type VARCHAR(20) DEFAULT 'GARAGE'
    CHECK (type IN ('GARAGE', 'PROVIDER', 'TRANSPORTEUR')),       -- GARAGE ou PROVIDER
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestataire_wallets (
  id SERIAL PRIMARY KEY,
  prestataire_id VARCHAR(100) UNIQUE NOT NULL REFERENCES prestataires(prestataire_id),
  ledger_id VARCHAR(255) NOT NULL,
  available_balance_id VARCHAR(255) NOT NULL,
  blocked_balance_id VARCHAR(255) NOT NULL,
  receivable_balance_id VARCHAR(255) NOT NULL,
  currency VARCHAR(10) DEFAULT 'MAD',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prestataire_orders (
  id SERIAL PRIMARY KEY,
  prestataire_id VARCHAR(100) NOT NULL REFERENCES prestataires(prestataire_id),
  maintenance_ref VARCHAR(255),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  reference VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'CONFIRMED'
    CHECK (status IN ('CONFIRMED', 'PAID', 'CANCELLED')),
  dolibarr_invoice_id VARCHAR(255),
  blnk_transaction_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prestataire_orders_prestataire_id ON prestataire_orders(prestataire_id);
CREATE INDEX IF NOT EXISTS idx_prestataire_orders_reference ON prestataire_orders(reference);
CREATE INDEX IF NOT EXISTS idx_prestataire_orders_status ON prestataire_orders(status);

-- ─── MIGRATIONS PRESTATAIRES (sur DB existante) ───────────────
ALTER TABLE prestataires ALTER COLUMN garage_uuid DROP NOT NULL;
ALTER TABLE prestataires ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'GARAGE'
  CHECK (type IN ('GARAGE', 'PROVIDER', 'TRANSPORTEUR'));

-- ─── SCIM GROUP CACHE ─────────────────────────────────────────
-- Mapping groupId (Authentik) → displayName, persisté pour survivre aux restarts
-- du backend (sinon getGroup() retourne 404 pour les groupes ignorés/parents
-- après un restart, et Authentik recrée des doublons).
CREATE TABLE IF NOT EXISTS scim_group_cache (
  group_id VARCHAR(100) PRIMARY KEY,
  group_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);