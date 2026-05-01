'use client';
import { useEffect, useState } from 'react';
import { Grid, Box, LinearProgress } from '@mui/material';
import axios from 'axios';
import { useAlerts } from '@/lib/alerts-context';
import SystemKpis from './SystemKpis';
import ServicesStatus from './ServicesStatus';
import TransactionMetrics from './TransactionMetrics';
import OperationsBreakdown from './OperationsBreakdown';
import DataIntegrity from './DataIntegrity';
import SystemInfo from './SystemInfo';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  headers: { 'x-api-key': process.env.NEXT_PUBLIC_API_KEY || 'kounhany-secret-2024' },
});

export default function SystemDashboard() {
  const [overview, setOverview] = useState(null);
  const [systemInfo, setSystemInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { alerts: globalAlerts } = useAlerts();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ovRes, sysRes] = await Promise.all([
        api.get('/kpis/overview?period=all'),
        api.get('/kpis/system-info'),
      ]);
      setOverview(ovRes.data.data);
      setSystemInfo(sysRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box>
      {loading && (
        <LinearProgress sx={{
          mb: 3, borderRadius: 2,
          bgcolor: '#FAC34530',
          '& .MuiLinearProgress-bar': { bgcolor: '#FAC345' },
        }} />
      )}

      <SystemKpis overview={overview} alerts={globalAlerts} loading={loading} />

      <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 3 } }}>
        <Grid item xs={12} md={6}>
          <ServicesStatus systemInfo={systemInfo} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TransactionMetrics transactions={overview?.transactions} />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 2, md: 3 }}>
        <Grid item xs={12} md={4}>
          <OperationsBreakdown transactions={overview?.transactions} />
        </Grid>
        <Grid item xs={12} md={4}>
          <DataIntegrity />
        </Grid>
        <Grid item xs={12} md={4}>
          <SystemInfo systemInfo={systemInfo} />
        </Grid>
      </Grid>
    </Box>
  );
}