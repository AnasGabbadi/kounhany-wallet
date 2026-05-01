'use client';
import { Card, CardContent, Typography, Box } from '@mui/material';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

const MetricBar = ({ label, value, max, color, unit }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.8 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
          {fmt(value)}{unit}
        </Typography>
      </Box>
      <Box sx={{ position: 'relative', height: 8, bgcolor: `${color}15`, borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${pct}%`, bgcolor: color, borderRadius: 4,
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </Box>
    </Box>
  );
};

export default function TransactionMetrics({ transactions }) {
  const tx = transactions;
  const totalTx = tx?.total || 0;
  const successRate = tx?.success_rate || 100;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2.5 }}>
          Métriques transactionnelles
        </Typography>
        <MetricBar label="Taux de succès" value={successRate} max={100} color="#10B981" unit="%" />
        <MetricBar label="Paiements (PAYMENT)" value={tx?.payments || 0} max={totalTx} color="#FAC345" unit=" ops" />
        <MetricBar label="Blocages (BLOCK)" value={tx?.blocks || 0} max={totalTx} color="#212529" unit=" ops" />
        <MetricBar label="Confirmations (CONFIRM)" value={tx?.confirms || 0} max={totalTx} color="#10B981" unit=" ops" />
        <MetricBar label="Dettes Dolibarr" value={tx?.debts || 0} max={totalTx} color="#EF4444" unit=" ops" />
      </CardContent>
    </Card>
  );
}