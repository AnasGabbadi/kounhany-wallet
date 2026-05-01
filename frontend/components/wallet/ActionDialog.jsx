'use client';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Alert, CircularProgress, Typography,
} from '@mui/material';

// ← ACTIONS déplacé ici depuis WalletActions.jsx
export const ACTIONS = [
  { key: 'pay', label: 'Recharger', color: 'success', variant: 'contained', desc: 'Ajouter des fonds au compte disponible' },
  { key: 'block', label: 'Bloquer', color: 'warning', variant: 'contained', desc: 'Réserver un montant du compte disponible' },
  { key: 'confirm', label: 'Confirmer', color: 'primary', variant: 'contained', desc: 'Consommer un montant bloqué' },
  { key: 'external-debt', label: 'Dette Dolibarr', color: 'error', variant: 'outlined', desc: 'Enregistrer une facture externe' },
  { key: 'external-payment', label: 'Paiement ext.', color: 'success', variant: 'outlined', desc: 'Enregistrer un paiement externe' },
];

export default function ActionDialog({ dialog, form, setForm, onClose, onConfirm, loading, error }) {
  const action = ACTIONS.find((a) => a.key === dialog);
  if (!action) return null;

  const needsReference = ['external-debt', 'external-payment'].includes(dialog);

  return (
    <Dialog open={!!dialog} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {action.label}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 400, mt: 0.3 }}>
          {action.desc}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          label="Montant (MAD)"
          type="number"
          fullWidth
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          sx={{ mb: 2 }}
          inputProps={{ min: 0.01, step: 0.01 }}
          autoFocus
        />
        <TextField
          label={needsReference ? 'Référence (obligatoire)' : 'Référence (optionnel)'}
          fullWidth
          required={needsReference}
          value={form.reference}
          onChange={(e) => setForm({ ...form, reference: e.target.value })}
          sx={{ mb: 2 }}
          helperText={needsReference ? 'Ex: DOLIBARR-INV-2024-001' : 'Laissez vide pour générer automatiquement'}
        />
        <TextField
          label="Description (optionnel)"
          fullWidth
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} color="inherit">Annuler</Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
          sx={{ bgcolor: '#FAC345', color: '#212529', '&:hover': { bgcolor: '#E0A820' } }}
        >
          Confirmer
        </Button>
      </DialogActions>
    </Dialog>
  );
}