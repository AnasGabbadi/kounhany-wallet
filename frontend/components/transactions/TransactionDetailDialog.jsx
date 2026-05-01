'use client';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Chip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StatusBadge from '@/components/common/StatusBadge';
import { useRouter } from 'next/navigation';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

export default function TransactionDetailDialog({ tx, onClose }) {
  const router = useRouter();

  if (!tx) return null;

  const rows = [
    { label: 'ID Transaction', value: tx.transaction_id, mono: true },
    { label: 'Client', value: tx.client_name || tx.client_id },
    { label: 'Type', value: <StatusBadge status={tx.type} /> },
    { label: 'Montant', value: `${fmt(tx.amount)} MAD`, bold: true },
    { label: 'Statut', value: (
      <Chip
        label={tx.status}
        size="small"
        sx={{
          bgcolor: tx.status === 'SUCCESS' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: tx.status === 'SUCCESS' ? '#10B981' : '#EF4444',
          fontWeight: 700, fontSize: '0.72rem',
        }}
      />
    )},
    { label: 'Référence', value: tx.reference, mono: true },
    { label: 'Description', value: tx.description || '—' },
    { label: 'Date', value: new Date(tx.created_at).toLocaleString('fr-FR') },
    { label: 'Erreur', value: tx.error_message || '—', hidden: !tx.error_message },
  ].filter((r) => !r.hidden);

  return (
    <Dialog
      open={!!tx}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Détail de la transaction
          </Typography>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0, color: 'text.secondary', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0 }}>
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(250,195,69,0.06)', border: '1px solid rgba(250,195,69,0.2)', mb: 2.5, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Montant
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#212529' }}>
            {fmt(tx.amount)} MAD
          </Typography>
          <StatusBadge status={tx.type} />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {rows.map((row) => (
          <Box key={row.label} sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', py: 1,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            '&:last-child': { borderBottom: 'none' },
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
              {row.label}
            </Typography>
            {typeof row.value === 'string' ? (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: row.bold ? 700 : 500,
                  fontFamily: row.mono ? 'monospace' : 'inherit',
                  fontSize: row.mono ? '0.75rem' : 'inherit',
                  textAlign: 'right', maxWidth: 280, wordBreak: 'break-all',
                }}
              >
                {row.value}
              </Typography>
            ) : row.value}
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Fermer</Button>
        <Button
          variant="outlined"
          onClick={() => { router.push(`/clients/${tx.client_id}/wallet`); onClose(); }}
          sx={{ borderColor: '#FAC345', color: '#E0A820', fontWeight: 600 }}
        >
          Voir le wallet client
        </Button>
      </DialogActions>
    </Dialog>
  );
}