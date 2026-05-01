'use client';
import { Grid, Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const KpiBox = ({ title, value, subtitle, color, icon, loading }) => (
  <Card>
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
            {title}
          </Typography>
          {loading ? (
            <Skeleton width={100} height={32} />
          ) : (
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mt: 0.3, fontSize: { xs: '1.1rem', md: '1.4rem' } }}>
              {value}
            </Typography>
          )}
          {subtitle && (
            <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function TransactionKpis({ transactions, loading }) {
  const total = transactions.length;
  const volume = transactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const errors = transactions.filter((tx) => tx.status === 'ERROR').length;
  const successRate = total > 0 ? ((total - errors) / total * 100).toFixed(1) : 100;

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 3 }}>
      <Grid item xs={6} md={3}>
        <KpiBox
          title="Total transactions"
          value={fmt(total)}
          subtitle="Toutes opérations"
          color="#FAC345"
          icon={<ReceiptIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <KpiBox
          title="Volume total"
          value={`${fmt(volume)} MAD`}
          subtitle="Montant cumulé"
          color="#3B82F6"
          icon={<TrendingUpIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <KpiBox
          title="Taux de succès"
          value={`${successRate}%`}
          subtitle={`${total - errors} réussies`}
          color="#10B981"
          icon={<CheckCircleIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <KpiBox
          title="Erreurs"
          value={fmt(errors)}
          subtitle={errors === 0 ? 'Aucune erreur' : 'À vérifier'}
          color={errors > 0 ? '#EF4444' : '#10B981'}
          icon={<ErrorIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}