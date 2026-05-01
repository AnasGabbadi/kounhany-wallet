'use client';
import { Chip } from '@mui/material';

const statusConfig = {
  QUEUED:           { label: 'En attente',    color: 'warning' },
  APPLIED:          { label: 'Appliqué',      color: 'success' },
  SUCCESS:          { label: 'Succès',        color: 'success' },
  ERROR:            { label: 'Erreur',        color: 'error'   },
  BLOCK:            { label: 'Réservation',   color: 'warning' },
  CONFIRM:          { label: 'Confirmation',  color: 'success' },
  PAYMENT:          { label: 'Recharge',      color: 'info'    },
  EXTERNAL_DEBT:    { label: 'Facture',       color: 'error'   },
  EXTERNAL_PAYMENT: { label: 'Paiement ext.', color: 'success' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, color: 'default' };
  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
      sx={{ fontWeight: 600, fontSize: '0.75rem' }}
    />
  );
}