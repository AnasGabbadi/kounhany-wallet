'use client';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function WalletStats({ stats }) {
  const items = [
    { label: 'Total rechargé', value: `${fmt(stats?.total_recharged)} MAD`, color: '#10B981' },
    { label: 'Total bloqué', value: `${fmt(stats?.total_blocked)} MAD`, color: '#F59E0B' },
    { label: 'Total confirmé', value: `${fmt(stats?.total_confirmed)} MAD`, color: '#3B82F6' },
    { label: 'Dettes totales', value: `${fmt(stats?.total_debt)} MAD`, color: '#EF4444' },
    { label: 'Paiements ext.', value: `${fmt(stats?.total_ext_payment)} MAD`, color: '#10B981' },
    { label: 'Dette nette', value: `${fmt(stats?.net_debt)} MAD`, color: stats?.net_debt > 0 ? '#EF4444' : '#10B981' },
    { label: 'Transactions', value: fmtN(stats?.total_transactions), color: '#212529' },
    { label: 'Erreurs', value: fmtN(stats?.total_errors), color: stats?.total_errors > 0 ? '#EF4444' : '#10B981' },
  ];

  return (
    <Card>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Statistiques du wallet
        </Typography>
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={6} sm={3} key={item.label}>
              <Box sx={{
                p: 1.5, borderRadius: 2,
                bgcolor: `${item.color}08`,
                border: `1px solid ${item.color}15`,
                textAlign: 'center',
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.3, fontSize: '0.7rem' }}>
                  {item.label}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: item.color, fontSize: '0.82rem' }}>
                  {item.value}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}