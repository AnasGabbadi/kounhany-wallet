'use client';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Avatar, Chip, Divider, Button,
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CloseIcon from '@mui/icons-material/Close';
import { useRouter } from 'next/navigation';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

export default function ClientDetailDialog({ client, balance, onClose }) {
  const router = useRouter();
  const encours = balance ? Number(balance.blocked) + Number(balance.receivable) : 0;

  return (
    <Dialog
      open={!!client}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Informations client
          </Typography>
          <Button size="small" onClick={onClose} sx={{ minWidth: 0, color: 'text.secondary', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 0 }}>
        {client && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: '#FAC345', color: '#212529', fontSize: '1.6rem', fontWeight: 700 }}>
                {client.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{client.name}</Typography>
                <Chip
                  label={client.client_id}
                  size="small"
                  sx={{ mt: 0.3, bgcolor: 'rgba(0,0,0,0.06)', fontSize: '0.68rem', fontFamily: 'monospace' }}
                />
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5 }} />

            {[
              { icon: <EmailIcon fontSize="small" />, label: 'Email', value: client.email || '—' },
              { icon: <PhoneIcon fontSize="small" />, label: 'Téléphone', value: client.phone || '—' },
              { icon: <CalendarTodayIcon fontSize="small" />, label: 'Créé le', value: client.created_at ? new Date(client.created_at).toLocaleDateString('fr-FR') : '—' },
            ].map((item) => (
              <Box key={item.label} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                mb: 1.5, p: 1.5, borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.05)',
              }}>
                <Box sx={{ color: 'text.secondary', flexShrink: 0 }}>{item.icon}</Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem' }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                </Box>
              </Box>
            ))}

            <Divider sx={{ my: 2.5 }} />

            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>
              Soldes du wallet
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                { label: 'Disponible', value: balance?.available || 0, color: '#10B981' },
                { label: 'Bloqué', value: balance?.blocked || 0, color: '#F59E0B' },
                { label: 'Créances', value: balance?.receivable || 0, color: '#EF4444' },
              ].map((item) => (
                <Box key={item.label} sx={{
                  flex: 1, minWidth: 100, p: 1.5, borderRadius: 2,
                  bgcolor: `${item.color}08`, border: `1px solid ${item.color}20`, textAlign: 'center',
                }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.68rem', mb: 0.3 }}>
                    {item.label}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>
                    {fmt(item.value)} MAD
                  </Typography>
                </Box>
              ))}
            </Box>

            {encours > 0 && (
              <Box sx={{
                mt: 1.5, p: 1.5, borderRadius: 2,
                bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <Typography variant="body2" color="text.secondary">Encours total</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#EF4444' }}>
                  {fmt(encours)} MAD
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Fermer</Button>
        <Button
          variant="contained"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={() => { router.push(`/clients/${client.client_id}/wallet`); onClose(); }}
          sx={{ bgcolor: '#FAC345', color: '#212529', fontWeight: 700, '&:hover': { bgcolor: '#E0A820' } }}
        >
          Gérer le wallet
        </Button>
      </DialogActions>
    </Dialog>
  );
}