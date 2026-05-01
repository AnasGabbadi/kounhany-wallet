'use client';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function OperationsBreakdown({ transactions }) {
  const tx = transactions;
  const totalTx = tx?.total || 0;

  const items = [
    { label: 'Paiements', value: tx?.payments || 0, color: '#FAC345' },
    { label: 'Blocages', value: tx?.blocks || 0, color: '#212529' },
    { label: 'Confirmations', value: tx?.confirms || 0, color: '#10B981' },
    { label: 'Dettes', value: tx?.debts || 0, color: '#EF4444' },
    { label: 'Paiements ext.', value: tx?.ext_payments || 0, color: '#3B82F6' },
  ];

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Répartition des opérations
        </Typography>
        {items.map((item) => (
          <Box key={item.label} sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', py: 1,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            '&:last-child': { borderBottom: 'none' },
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                {item.label}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmt(item.value)}</Typography>
              <Chip
                label={`${totalTx > 0 ? ((item.value / totalTx) * 100).toFixed(0) : 0}%`}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, bgcolor: `${item.color}15`, color: item.color }}
              />
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}