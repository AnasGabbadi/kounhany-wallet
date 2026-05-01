'use client';
import { Box, Typography, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function WalletHeader({ client, wallet, clientId, router }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push(`/clients`)}
        sx={{ color: 'text.secondary', flexShrink: 0 }}
      >
        Retour
      </Button>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Wallet — {client?.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Devise : {wallet?.currency} · Créé le {wallet?.created_at ? new Date(wallet.created_at).toLocaleDateString('fr-FR') : '—'}
        </Typography>
      </Box>
    </Box>
  );
}