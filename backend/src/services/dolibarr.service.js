const axios = require('axios');
const pool = require('../config/db');

const dolibarrApi = axios.create({
  baseURL: `${process.env.DOLIBARR_URL}/api/index.php`,
  headers: {
    'DOLAPIKEY': process.env.DOLIBARR_API_KEY,
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
    'Accept-Charset': 'utf-8',
  },
  timeout: 5000,
  responseEncoding: 'utf8',
});

const dolibarrService = {

  async ping() {
    const res = await dolibarrApi.get('/status');
    return res.data;
  },

  async createInvoice({ clientId, clientName, amount, description, reference }) {
    const socid = await this._getOrCreateThirdParty(clientId, clientName);

    const now = Math.floor(Date.now() / 1000);
    const dueDate = now + (30 * 24 * 60 * 60); // +30 jours

    const invoice = {
      socid: String(socid),
      type: 0,
      ref_client: reference,
      date: now,
      date_echeance: dueDate,
      entity: parseInt(process.env.DOLIBARR_ENTITY) || 1,
      lines: [{
        desc: description || 'Consommation wallet Kounhany',
        qty: 1,
        subprice: amount,
        tva_tx: 0,
        product_type: 1,
      }],
    };

    const res = await dolibarrApi.post('/invoices', invoice);
    const invoiceId = res.data;  // ← ajouter cette ligne
    console.log(`[Dolibarr] Facture créée — ID: ${invoiceId} pour client ${clientId}`);
    try {
      await dolibarrApi.post(`/invoices/${invoiceId}/validate`, {
        idwarehouse: 0,
      });
      console.log(`[Dolibarr] Facture ${invoiceId} validée`);
    } catch (err) {
      console.error(`[Dolibarr] Erreur validation facture ${invoiceId}:`, err.message);
    }

    return invoiceId;
  },

  async getInvoice(invoiceId) {
    const res = await dolibarrApi.get(`/invoices/${invoiceId}`);
    return res.data;
  },

  async getUnpaidInvoices() {
    try {
      const res = await dolibarrApi.get('/invoices', {
        params: {
          sortfield: 't.rowid',
          sortorder: 'DESC',
          limit: 100,
          status: 'unpaid',
        },
      });

      let invoices = res.data || [];
      if (!Array.isArray(invoices)) {
        invoices = Object.values(invoices);
      }
      return invoices;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 501) {
        return [];
      }
      throw err;
    }
  },

  async getRecentPayments(sinceTimestamp) {
    try {
      const res = await dolibarrApi.get('/payments', {
        params: {
          sortfield: 't.rowid',
          sortorder: 'DESC',
          limit: 100,
        },
      });

      let payments = res.data || [];
      if (!Array.isArray(payments)) {
        payments = Object.values(payments);
      }

      return payments.filter(p => parseInt(p.datepaye) >= Math.floor(sinceTimestamp / 1000));
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 501) {
        console.log('[Dolibarr Sync] Endpoint payments non disponible — sync désactivé');
        return [];
      }
      throw err;
    }
  },

  async getClientInvoices(socid) {
    try {
      const res = await dolibarrApi.get('/invoices', {
        params: {
          sortfield: 't.rowid',
          sortorder: 'DESC',
          limit: 100,
          thirdparty_ids: socid,
        },
      });

      let invoices = res.data || [];
      if (!Array.isArray(invoices)) {
        invoices = Object.values(invoices);
      }

      return invoices.map(inv => ({
        id: inv.id,
        ref: inv.ref,
        ref_client: inv.ref_client,
        date: inv.date,
        date_echeance: inv.date_echeance || inv.date_lim_reglement || null,
        total_ht: parseFloat(inv.total_ht || 0),
        total_ttc: parseFloat(inv.total_ttc || 0),
        status: inv.statut === '2' ? 'paid' : inv.statut === '1' ? 'unpaid' : 'draft',
        lines: inv.lines || [],
      }));
    } catch (err) {
      if (err.response?.status === 404) return [];
      throw err;
    }
  },

  async _getOrCreateThirdParty(clientId, clientName) {
    // Chercher si le tiers existe déjà via ref_ext
    try {
      const res = await dolibarrApi.get('/thirdparties', {
        params: {
          sqlfilters: `(t.ref_ext:=:'${clientId}')`,
          limit: 1,
        },
      });
      if (res.data && res.data.length > 0) {
        console.log(`[Dolibarr] Tiers existant trouvé — ID: ${res.data[0].id}`);
        return res.data[0].id;
      }
    } catch { }

    // Créer le tiers
    const res = await dolibarrApi.post('/thirdparties', {
      name: clientName,
      ref_ext: clientId,
      client: '1',
      status: '1',
      entity: parseInt(process.env.DOLIBARR_ENTITY) || 1,
    });
    console.log(`[Dolibarr] Tiers créé — ID: ${res.data} pour client ${clientId}`);
    return res.data;
  },

  async getPaidInvoices() {
    try {
      const res = await dolibarrApi.get('/invoices', {
        params: {
          sortfield: 't.rowid',
          sortorder: 'DESC',
          limit: 100,
        },
      });

      let invoices = res.data || [];
      if (!Array.isArray(invoices)) invoices = Object.values(invoices);

      // Filtrer uniquement les factures payées (statut=2, paye=1)
      return invoices.filter(inv => inv.statut === '2' && inv.paye === '1');
    } catch (err) {
      if (err.response?.status === 404) return [];
      throw err;
    }
  },
};

module.exports = dolibarrService;