'use client';
import { use, useEffect, useState } from 'react';
import {
  Box, Alert, CircularProgress, ToggleButtonGroup,
  ToggleButton, Chip,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useRouter } from 'next/navigation';
import { clientsApi, walletApi } from '@/lib/api';
import WalletHeader from '@/components/wallet/WalletHeader';
import AccountCards from '@/components/wallet/AccountCards';
import WalletStats from '@/components/wallet/WalletStats';
import TransactionTable from '@/components/wallet/TransactionTable';
import ActionDialog from '@/components/wallet/ActionDialog';
import WalletInvoices from '@/components/wallet/WalletInvoices';
import { dolibarrApi } from '@/lib/api';

export default function WalletPage({ params }) {
  const { id: clientId } = use(params);
  const router = useRouter();

  const [client, setClient] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('apercu');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ amount: '', reference: '', description: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [invoicesCount, setInvoicesCount] = useState(0);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientRes, walletRes, invoicesRes] = await Promise.all([
        clientsApi.getOne(clientId),
        clientsApi.getWallet(clientId),
        dolibarrApi.clientInvoices(clientId).catch(() => ({ data: { invoices: [] } })),
      ]);
      setClient(clientRes.data);
      setWalletData(walletRes.data);
      setInvoicesCount(invoicesRes.data.invoices?.length || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleAction = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setActionError('Montant invalide');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const data = {
        client_id: clientId,
        amount: Number(form.amount),
        reference: form.reference || undefined,
        description: form.description || undefined,
      };
      if (dialog === 'block') await walletApi.block(data);
      else if (dialog === 'confirm') await walletApi.confirm(data);
      else if (dialog === 'pay') await walletApi.pay(data);
      else if (dialog === 'unblock') await walletApi.unblock(data);
      else if (dialog === 'external-debt') await walletApi.externalDebt({ ...data, reference: form.reference });
      else if (dialog === 'external-payment') await walletApi.externalPayment({ ...data, reference: form.reference });

      setActionSuccess('Opération effectuée avec succès');
      setDialog(null);
      setForm({ amount: '', reference: '', description: '' });
      await fetchData();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openAction = (key) => {
    setDialog(key);
    setActionError(null);
    setForm({ amount: '', reference: '', description: '' });
  };

  const closeDialog = () => {
    setDialog(null);
    setActionError(null);
    setForm({ amount: '', reference: '', description: '' });
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
      <CircularProgress sx={{ color: '#FAC345' }} />
    </Box>
  );

  if (error) return <Alert severity="error">{error}</Alert>;

  const wallet = walletData?.wallet;
  const stats = walletData?.stats;
  const transactions = walletData?.transactions || [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <WalletHeader client={client} wallet={wallet} clientId={clientId} router={router} />

        {/* Toggle switch comme Dashboard */}
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, val) => val && setView(val)}
          size="small"
          sx={{
            bgcolor: 'rgba(0,0,0,0.04)',
            borderRadius: 2,
            p: 0.5,
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: '8px !important',
              px: 2, py: 0.8,
              fontWeight: 600,
              fontSize: '0.82rem',
              color: 'text.secondary',
              gap: 0.8,
              '&.Mui-selected': {
                bgcolor: 'white',
                color: '#212529',
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
              },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' },
            },
          }}
        >
          <ToggleButton value="apercu">
            <AccountBalanceWalletIcon sx={{ fontSize: 16 }} />
            Aperçu
          </ToggleButton>
          <ToggleButton value="transactions">
            <ReceiptIcon sx={{ fontSize: 16 }} />
            Transactions
            <Chip
              label={transactions.length}
              size="small"
              sx={{ ml: 0.5, height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.08)', color: 'text.secondary' }}
            />
          </ToggleButton>
          <ToggleButton value="factures">
            <ReceiptLongIcon sx={{ fontSize: 16 }} />
            Factures
            <Chip
              label={invoicesCount}
              size="small"
              sx={{ ml: 0.5, height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.08)', color: 'text.secondary' }}
            />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Aperçu — 3 cards + stats */}
      {view === 'apercu' && (
        <Box>
          <AccountCards accounts={wallet?.accounts} />
          <WalletStats stats={stats} />
        </Box>
      )}

      {/* Transactions */}
      {view === 'transactions' && (
        <Box sx={{
          flex: 1,
          minHeight: 'calc(100vh - 200px)',
        }}>
          <TransactionTable transactions={transactions} onAction={openAction} />
        </Box>
      )}

      {/* Factures Dolibarr */}
      {view === 'factures' && (
        <WalletInvoices clientId={clientId} />
      )}

      <ActionDialog
        dialog={dialog}
        form={form}
        setForm={setForm}
        onClose={closeDialog}
        onConfirm={handleAction}
        loading={actionLoading}
        error={actionError}
      />
    </Box>
  );
}