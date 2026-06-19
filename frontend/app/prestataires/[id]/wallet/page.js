'use client';
import useSWR from 'swr';
import { use, useState } from 'react';
import {
  Box, Alert, CircularProgress, ToggleButtonGroup,
  ToggleButton, Chip, Button, Typography,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GarageIcon from '@mui/icons-material/Garage';
import BuildIcon from '@mui/icons-material/Build';
import { prestatairesApi, walletApi, dolibarrApi } from '@/lib/api';
import AccountCards from '@/components/wallet/AccountCards';
import WalletStats from '@/components/wallet/WalletStats';
import TransactionTable from '@/components/wallet/TransactionTable';
import WalletInvoices from '@/components/wallet/WalletInvoices';
import ActionDialog from '@/components/wallet/ActionDialog';
import { PRESTA_TYPES, usePrestaNavigation } from '@/hooks/usePrestaNavigation';

export default function PrestaWalletPage({ params }) {
  const { id } = use(params);
  const { currentType, goBack } = usePrestaNavigation();
  const [view, setView] = useState('apercu');
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ amount: '', reference: '', description: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: prestataire } = useSWR(
    `presta-${id}`,
    () => prestatairesApi.getOne(id),
    { refreshInterval: 60000 }
  );

  const { data: walletData, isLoading, error, mutate } = useSWR(
    `presta-wallet-${id}`,
    () => prestatairesApi.getWallet(id),
    { refreshInterval: 30000 }
  );

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

  const handleAction = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setActionError('Montant invalide');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const data = {
        client_id: id,
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
      await mutate();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
      <CircularProgress sx={{ color: '#FAC345' }} />
    </Box>
  );

  if (error) return <Alert severity="error">{error.message}</Alert>;

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions || [];
  const prestataireName = prestataire?.name || prestataire?.data?.name || id;

  // Icône dynamique selon le type courant
  const PrestaIcon = currentType === PRESTA_TYPES.pieces ? BuildIcon : GarageIcon;

  const stats = {
    total_recharged: transactions.filter(t => t.type === 'PAYMENT').reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    total_blocked: transactions.filter(t => t.type === 'BLOCK').reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    total_confirmed: transactions.filter(t => t.type === 'CONFIRM').reduce((s, t) => s + parseFloat(t.amount || 0), 0),
    total_collected: 0,
    total_ext_payment: 0,
    net_receivable: wallet?.accounts?.receivable?.balance || 0,
    total_transactions: transactions.length,
    total_errors: transactions.filter(t => t.status !== 'SUCCESS').length,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {/* ✅ goBack — lit currentType depuis ?from= dans l'URL */}
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={goBack}
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            Retour
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Wallet — {prestataireName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Devise : {wallet?.currency} · Créé le{' '}
                {wallet?.created_at ? new Date(wallet.created_at).toLocaleDateString('fr-FR') : '—'}
              </Typography>
            </Box>
          </Box>
        </Box>

        <ToggleButtonGroup
          value={view} exclusive onChange={(_, val) => val && setView(val)} size="small"
          sx={{
            bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 2, p: 0.5,
            '& .MuiToggleButton-root': {
              border: 'none', borderRadius: '8px !important',
              px: 2, py: 0.8, fontWeight: 600, fontSize: '0.82rem',
              color: 'text.secondary', gap: 0.8,
              '&.Mui-selected': { bgcolor: 'white', color: '#212529', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
              '&:hover': { bgcolor: 'rgba(255,255,255,0.6)' },
            },
          }}
        >
          <ToggleButton value="apercu">
            <AccountBalanceWalletIcon sx={{ fontSize: 16 }} />Aperçu
          </ToggleButton>
          <ToggleButton value="transactions">
            <ReceiptIcon sx={{ fontSize: 16 }} />Transactions
            <Chip label={transactions.length} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.08)', color: 'text.secondary' }} />
          </ToggleButton>
          <ToggleButton value="factures">
            <ReceiptLongIcon sx={{ fontSize: 16 }} />Factures
            <Chip label={invoicesCount} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.62rem', fontWeight: 700, bgcolor: 'rgba(0,0,0,0.08)', color: 'text.secondary' }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {actionSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {view === 'apercu' && (
        <Box>
          <AccountCards accounts={wallet?.accounts} />
          <WalletStats stats={stats} />
        </Box>
      )}

      {view === 'transactions' && (
        <Box sx={{ flex: 1, minHeight: 'calc(100vh - 200px)' }}>
          <TransactionTable transactions={transactions} onAction={openAction} />
        </Box>
      )}

      {view === 'factures' && (
        <WalletInvoices
          clientId={id}
          fetchFn={(prestataireId) => {
            const getPrestaId = (rawId) => {
              if (rawId.startsWith('garage_')) return rawId.replace('garage_', 'prestataire_');
              if (rawId.startsWith('provider_')) return rawId.replace('provider_', 'prestataire_');
              return rawId;
            };
            return dolibarrApi.supplierInvoices(getPrestaId(prestataireId));
          }}
          onCountChange={setInvoicesCount}
        />
      )}

      <ActionDialog
        dialog={dialog} form={form} setForm={setForm}
        onClose={closeDialog} onConfirm={handleAction}
        loading={actionLoading} error={actionError}
      />
    </Box>
  );
}