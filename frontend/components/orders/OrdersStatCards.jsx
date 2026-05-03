'use client';
import { Grid, Card, CardContent, Box, Typography, Skeleton } from '@mui/material';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PaymentIcon from '@mui/icons-material/Payment';
import CancelIcon from '@mui/icons-material/Cancel';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('fr-FR');

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
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          bgcolor: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, flexShrink: 0,
        }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function OrdersStatCards({ orders = [], loading = false }) {
  const calcAmount = (status) =>
    orders.filter(o => o.status === status).reduce((s, o) => s + parseFloat(o.amount || 0), 0);

  const total = orders.length;
  const totalAmount = orders.reduce((s, o) => s + parseFloat(o.amount || 0), 0);
  const blocked = orders.filter(o => o.status === 'BLOCKED').length;
  const confirmed = orders.filter(o => o.status === 'CONFIRMED').length;
  const paid = orders.filter(o => o.status === 'PAID').length;
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length;

  return (
    <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: 3 }}>
      <Grid item xs={6} md={2.4}>
        <KpiBox
          title="Total commandes"
          value={fmtN(total)}
          subtitle={`${fmt(totalAmount)} MAD`}
          color="#FAC345"
          icon={<ShoppingBagOutlinedIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <KpiBox
          title="Bloquées"
          value={fmtN(blocked)}
          subtitle={`${fmt(calcAmount('BLOCKED'))} MAD`}
          color="#F59E0B"
          icon={<BlockIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <KpiBox
          title="Confirmées"
          value={fmtN(confirmed)}
          subtitle={`${fmt(calcAmount('CONFIRMED'))} MAD`}
          color="#3B82F6"
          icon={<CheckCircleIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <KpiBox
          title="Payées"
          value={fmtN(paid)}
          subtitle={`${fmt(calcAmount('PAID'))} MAD`}
          color="#10B981"
          icon={<PaymentIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
      <Grid item xs={6} md={2.4}>
        <KpiBox
          title="Annulées"
          value={fmtN(cancelled)}
          subtitle={`${fmt(calcAmount('CANCELLED'))} MAD`}
          color={cancelled > 0 ? '#EF4444' : '#10B981'}
          icon={<CancelIcon fontSize="small" />}
          loading={loading}
        />
      </Grid>
    </Grid>
  );
}