'use client';
import useSWR from 'swr';
import { Grid, Box, Alert, LinearProgress } from '@mui/material';

import DashboardHeader from '@/components/dashboard/financier/DashboardHeader';
import KpiCard from '@/components/dashboard/financier/KpiCard';
import BalancePieChart from '@/components/dashboard/financier/BalancePieChart';
import VolumeBarChart from '@/components/dashboard/financier/VolumeBarChart';
import TopClients from '@/components/dashboard/financier/TopClients';
import RecentTransactions from '@/components/dashboard/financier/RecentTransactions';
import PeopleIcon from '@mui/icons-material/People';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import api from '@/lib/api';
import { useAlerts } from '@/lib/alerts-context';
import { useEffect } from 'react';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('fr-FR');

// Fetcher SWR — utilise l'instance axios existante
const fetcher = (url) => api.get(url).then(r => r.data);

export default function Dashboard() {
  const { setAlerts } = useAlerts();

  // SWR — cache en mémoire + revalidation arrière-plan
  const { data: overview, isLoading: ovLoading, error: ovError } = useSWR(
    '/kpis/overview?period=all',
    fetcher,
    { refreshInterval: 15000 } // refresh auto toutes les 15s
  );

  const { data: topClients = [], isLoading: topLoading } = useSWR(
    '/kpis/top-clients',
    fetcher,
    { refreshInterval: 60000 }
  );

  const { data: recentTxData, isLoading: txLoading } = useSWR(
    '/kpis/recent-transactions?limit=10',
    fetcher,
    { refreshInterval: 15000 } 
  );

  const { data: alertsData } = useSWR(
    '/kpis/alerts',
    fetcher,
    { refreshInterval: 60000 }
  );

  // Sync alertes dans le context
  useEffect(() => {
    if (alertsData) setAlerts(alertsData);
  }, [alertsData, setAlerts]);

  const recentTx = recentTxData?.data || [];
  const isLoading = ovLoading || txLoading;

  return (
    <Box>
      <DashboardHeader />

      {isLoading && (
        <LinearProgress sx={{
          mb: 3, borderRadius: 2,
          bgcolor: '#FAC34530',
          '& .MuiLinearProgress-bar': { bgcolor: '#FAC345' },
        }} />
      )}
      {ovError && <Alert severity="error" sx={{ mb: 3 }}>{ovError.message}</Alert>}

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
        <Grid item xs={6} md={3}>
          <KpiCard
            title="Clients actifs"
            value={overview ? fmtN(overview.clients.total) : '...'}
            subtitle={`+${overview?.clients.new_this_week || 0} cette semaine`}
            icon={<PeopleIcon fontSize="inherit" />}
            color="#FAC345"
            loading={ovLoading}
            trend={overview?.clients.new_this_week > 0 ? 100 : 0}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            title="Total actifs"
            value={overview ? `${fmt(overview.balances.total_assets)} MAD` : '...'}
            subtitle={`Encours : ${fmt(overview?.balances.total_encours || 0)} MAD`}
            icon={<AccountBalanceWalletIcon fontSize="inherit" />}
            color="#10B981"
            loading={ovLoading}
            trend={overview?.balances.total_assets > 0 ? 12 : 0}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            title="Transactions"
            value={overview ? fmtN(overview.transactions.total) : '...'}
            subtitle={`Succès : ${overview?.transactions.success_rate || 100}%`}
            icon={<ReceiptIcon fontSize="inherit" />}
            color="#3B82F6"
            loading={ovLoading}
            trend={overview?.transactions.success_rate === 100 ? 5 : -10}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <KpiCard
            title="Volume total"
            value={overview ? `${fmt(overview.volumes.total)} MAD` : '...'}
            subtitle={`Rechargements : ${fmt(overview?.volumes.payments || 0)} MAD`}
            icon={<TrendingUpIcon fontSize="inherit" />}
            color="#212529"
            loading={ovLoading}
            trend={overview?.volumes.total > 0 ? 8 : 0}
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
        <Grid item xs={12} md={8}>
          <VolumeBarChart volumes={overview?.volumes} />
        </Grid>
        <Grid item xs={12} md={4}>
          <BalancePieChart balances={overview?.balances} />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={5}>
          <TopClients clients={topClients} />
        </Grid>
        <Grid item xs={12} md={7}>
          <RecentTransactions transactions={recentTx} />
        </Grid>
      </Grid>
    </Box>
  );
}