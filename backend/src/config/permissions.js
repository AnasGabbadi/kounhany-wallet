const PERMISSION_DEFINITIONS = [
  // ── Commandes ────────────────────────────────────────────────────────────────
  { key: 'orders.view',              label: 'Voir les commandes',               module: 'Commandes',     default: true  },
  { key: 'orders.confirm',           label: 'Confirmer une commande',           module: 'Commandes',     default: true  },
  { key: 'orders.cancel',            label: 'Annuler une commande',             module: 'Commandes',     default: true  },
  { key: 'orders.fleet_confirm',     label: 'Confirmer une commande Fleet',     module: 'Commandes',     default: true  },
  { key: 'orders.fleet_cancel',      label: 'Annuler une commande Fleet',       module: 'Commandes',     default: true  },

  // ── Wallet ───────────────────────────────────────────────────────────────────
  { key: 'wallet.block',             label: 'Bloquer un montant',               module: 'Wallet',        default: false },
  { key: 'wallet.confirm',           label: 'Confirmer un montant bloqué',      module: 'Wallet',        default: false },
  { key: 'wallet.pay',               label: 'Enregistrer un paiement',          module: 'Wallet',        default: false },
  { key: 'wallet.external_debt',     label: 'Enregistrer une dette externe',    module: 'Wallet',        default: false },
  { key: 'wallet.external_payment',  label: 'Enregistrer un paiement externe',  module: 'Wallet',        default: false },

  // ── Facturation ──────────────────────────────────────────────────────────────
  { key: 'facturation.view',         label: 'Voir la facturation',              module: 'Facturation',   default: true  },
  { key: 'facturation.create',       label: 'Créer une planification',          module: 'Facturation',   default: false },
  { key: 'facturation.edit',         label: 'Modifier une planification',       module: 'Facturation',   default: false },
  { key: 'facturation.delete',       label: 'Supprimer une planification',      module: 'Facturation',   default: false },
  { key: 'facturation.run',          label: 'Exécuter une planification',       module: 'Facturation',   default: false },

  // ── Clients ──────────────────────────────────────────────────────────────────
  { key: 'clients.view',             label: 'Voir les clients',                 module: 'Clients',       default: true  },
  { key: 'clients.delete',           label: 'Supprimer un client',              module: 'Clients',       default: false },

  // ── Prestataires ─────────────────────────────────────────────────────────────
  { key: 'prestataires.view',          label: 'Voir les prestataires',          module: 'Prestataires',  default: true  },
  { key: 'prestataires.wallet_actions', label: 'Actions wallet prestataires',   module: 'Prestataires',  default: false },

  // ── Transactions ─────────────────────────────────────────────────────────────
  { key: 'transactions.view',        label: 'Voir les transactions',            module: 'Transactions',  default: true  },
  { key: 'transactions.export',      label: 'Exporter les transactions CSV',    module: 'Transactions',  default: true  },

  // ── Dolibarr ─────────────────────────────────────────────────────────────────
  { key: 'dolibarr.sync',            label: 'Synchroniser Dolibarr',            module: 'Dolibarr',      default: false },

  // ── Utilisateurs ─────────────────────────────────────────────────────────────
  { key: 'users.view',               label: 'Voir les utilisateurs IDP',        module: 'Utilisateurs',  default: false },
];

const PERMISSION_KEYS = PERMISSION_DEFINITIONS.map(p => p.key);

module.exports = { PERMISSION_DEFINITIONS, PERMISSION_KEYS };
