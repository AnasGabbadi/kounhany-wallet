'use client';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, Chip, Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useRouter } from 'next/navigation';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

const STATUS_CONFIG = {
  BLOCKED:   { label: 'Bloqué',     bg: 'rgba(245,158,11,0.1)',  color: '#F59E0B' },
  CONFIRMED: { label: 'Confirmé',   bg: 'rgba(59,130,246,0.1)',  color: '#3B82F6' },
  INVOICED:  { label: 'Facturé',    bg: 'rgba(139,92,246,0.1)',  color: '#8B5CF6' },
  CANCELLED: { label: 'Annulé',     bg: 'rgba(239,68,68,0.1)',   color: '#EF4444' },
  PAID:      { label: 'Payé',       bg: 'rgba(16,185,129,0.1)',  color: '#10B981' },
  PENDING:   { label: 'En attente', bg: 'rgba(107,114,128,0.1)', color: '#6B7280' },
};

const TYPE_CONFIG = {
  FLEET:      { label: 'Fleet',      bg: '#FAC34515', color: '#B8860B' },
  LOGISTIQUE: { label: 'Logistique', bg: '#3B82F615', color: '#3B82F6' },
  B2C:        { label: 'B2C',        bg: '#10B98115', color: '#10B981' },
};

export default function OrderDetailDialog({ order, onClose }) {
  const router = useRouter();

  if (!order) return null;

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const type = TYPE_CONFIG[order.order_type] || {};

  const rows = [
    { label: 'ID Commande', value: `#${order.id}`, mono: true },
    { label: 'Client', value: order.client_name || order.client_id },
    { label: 'Type', value: (
      <Chip label={type.label || order.order_type} size="small"
        sx={{ bgcolor: type.bg, color: type.color, fontWeight: 700, fontSize: '0.72rem' }} />
    )},
    { label: 'Montant', value: `${fmt(order.amount)} MAD`, bold: true },
    { label: 'Statut', value: (
      <Chip label={status.label} size="small"
        sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.72rem' }} />
    )},
    { label: 'Référence', value: order.reference, mono: true },
    { label: 'Description', value: order.description || '—' },
    { label: 'Créée le', value: new Date(order.created_at).toLocaleString('fr-FR') },
    { label: 'Confirmée le', value: order.confirmed_at ? new Date(order.confirmed_at).toLocaleString('fr-FR') : '—' },
    { label: 'Annulée le', value: order.cancelled_at ? new Date(order.cancelled_at).toLocaleString('fr-FR') : null, hidden: !order.cancelled_at },
    { label: 'Facture Dolibarr', value: order.dolibarr_invoice_id || '—' },
    { label: 'Transaction Blnk', value: order.blnk_transaction_id || '—', mono: true },
  ].filter((r) => !r.hidden);

  return (
    <Dialog
      open={!!order}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Détail de la commande
          </Typography>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0, color: 'text.secondary', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0 }}>
        {/* Montant hero */}
        <Box sx={{
          p: 2, borderRadius: 2,
          bgcolor: 'rgba(250,195,69,0.06)',
          border: '1px solid rgba(250,195,69,0.2)',
          mb: 2.5, textAlign: 'center',
        }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Montant
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#212529', mb: 0.8 }}>
            {fmt(order.amount)} MAD
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Chip label={type.label || order.order_type} size="small"
              sx={{ bgcolor: type.bg, color: type.color, fontWeight: 700, fontSize: '0.72rem' }} />
            <Chip label={status.label} size="small"
              sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.72rem' }} />
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {rows.map((row) => (
          <Box key={row.label} sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', py: 1,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            '&:last-child': { borderBottom: 'none' },
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 130 }}>
              {row.label}
            </Typography>
            {typeof row.value === 'string' ? (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: row.bold ? 700 : 500,
                  fontFamily: row.mono ? 'monospace' : 'inherit',
                  fontSize: row.mono ? '0.72rem' : 'inherit',
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
          onClick={() => { router.push(`/clients/${order.client_id}/wallet`); onClose(); }}
          sx={{ borderColor: '#FAC345', color: '#E0A820', fontWeight: 600 }}
        >
          Voir le wallet
        </Button>
        <Button
          variant="contained"
          onClick={() => { router.push(`/clients/${order.client_id}/orders`); onClose(); }}
          sx={{ bgcolor: '#212529', color: '#FAC345', fontWeight: 600, boxShadow: 'none', '&:hover': { bgcolor: '#4e3f1b', boxShadow: 'none' } }}
        >
          Voir les commandes
        </Button>
      </DialogActions>
    </Dialog>
  );
}