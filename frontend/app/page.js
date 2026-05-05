'use client';
import { useEffect, useState } from 'react';
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
import api, { clientsApi, walletApi } from '@/lib/api';
import { useAlerts } from '@/lib/alerts-context';


const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });
const fmtN = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [topClients, setTopClients] = useState([]);
  const [recentTx, setRecentTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { setAlerts } = useAlerts();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [ovRes, topRes, alertsRes, clientsRes] = await Promise.all([
          api.get('/kpis/overview?period=all'),
          api.get('/kpis/top-clients'),
          api.get('/kpis/alerts'),
          clientsApi.list(),
        ]);

        setOverview(ovRes.data);
        setTopClients(topRes.data);
        setAlerts(alertsRes.data);

        const clients = clientsRes.data || [];
        const txAll = await Promise.all(
          clients.map((c) =>
            walletApi.transactions(c.client_id)
              .then((r) => (r.data || []).map((tx) => ({ ...tx, client_name: c.name })))
              .catch(() => [])
          )
        );
        const flat = txAll.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecentTx(flat.slice(0, 10));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  return (
    <Box>
      <DashboardHeader />

      {loading && (
        <LinearProgress sx={{
          mb: 3, borderRadius: 2,
          bgcolor: '#FAC34530',
          '& .MuiLinearProgress-bar': { bgcolor: '#FAC345' },
        }} />
      )}
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
        <Grid item xs={6} md={3}>
          <KpiCard
            title="Clients actifs"
            value={overview ? fmtN(overview.clients.total) : '...'}
            subtitle={`+${overview?.clients.new_this_week || 0} cette semaine`}
            icon={<PeopleIcon fontSize="inherit" />}
            color="#FAC345"
            loading={loading}
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
            loading={loading}
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
            loading={loading}
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
            loading={loading}
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