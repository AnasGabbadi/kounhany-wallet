'use client';
import { Grid, Card, CardContent, Box, Typography, Divider } from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import BlockIcon from '@mui/icons-material/Block';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

const AccountCard = ({ title, balance, creditBalance, debitBalance, color, icon }) => (
  <Card sx={{ height: '100%', border: `1px solid ${color}25`, bgcolor: `${color}05` }}>
    <CardContent sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="caption" sx={{
            color: 'text.secondary', fontWeight: 600,
            textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: 0.5,
          }}>
            {title}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, color, mt: 0.5 }}>
            {fmt(balance)} MAD
          </Typography>
        </Box>
        <Box sx={{
          width: 40, height: 40, borderRadius: 2,
          bgcolor: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </Box>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary">Crédits</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981' }}>
            +{fmt(creditBalance)} MAD
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary">Débits</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#EF4444' }}>
            -{fmt(debitBalance)} MAD
          </Typography>
        </Box>
      </Box>
    </CardContent>
  </Card>
);

export default function AccountCards({ accounts }) {
  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} md={4}>
        <AccountCard
          title="Disponible"
          balance={accounts?.available.balance}
          creditBalance={accounts?.available.credit_balance}
          debitBalance={accounts?.available.debit_balance}
          color="#10B981"
          icon={<AccountBalanceWalletIcon />}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <AccountCard
          title="Bloqué"
          balance={accounts?.blocked.balance}
          creditBalance={accounts?.blocked.credit_balance}
          debitBalance={accounts?.blocked.debit_balance}
          color="#F59E0B"
          icon={<BlockIcon />}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <AccountCard
          title="Créances"
          balance={accounts?.receivable.balance}
          creditBalance={accounts?.receivable.credit_balance}
          debitBalance={accounts?.receivable.debit_balance}
          color="#EF4444"
          icon={<TrendingUpIcon />}
        />
      </Grid>
    </Grid>
  );
}