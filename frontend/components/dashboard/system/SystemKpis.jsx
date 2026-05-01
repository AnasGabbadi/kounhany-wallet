'use client';
import { Grid } from '@mui/material';
import SpeedIcon from '@mui/icons-material/Speed';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ErrorIcon from '@mui/icons-material/Error';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import KpiCard from '../financier/KpiCard';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

export default function SystemKpis({ overview, alerts, loading }) {
    const tx = overview?.transactions;
    const successRate = tx?.success_rate || 100;
    const errorCount = tx?.errors || 0;
    const totalTx = tx?.total || 0;

    return (
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mb: { xs: 2, md: 4 } }}>
            <Grid item xs={6} md={3}>
                <KpiCard
                    title="Taux de succès"
                    value={`${successRate}%`}
                    subtitle="Transactions réussies"
                    icon={<SpeedIcon fontSize="inherit" />}
                    color="#10B981"
                    loading={loading}
                    trend={successRate < 100 ? -5 : undefined}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <KpiCard
                    title="Total transactions"
                    value={fmt(totalTx)}
                    subtitle="Toutes opérations"
                    icon={<ReceiptIcon fontSize="inherit" />}
                    color="#FAC345"
                    loading={loading}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <KpiCard
                    title="Erreurs"
                    value={fmt(errorCount)}
                    subtitle={errorCount === 0 ? 'Aucune erreur' : 'À investiguer'}
                    icon={<ErrorIcon fontSize="inherit" />}
                    color={errorCount > 0 ? '#EF4444' : '#10B981'}
                    loading={loading}
                    trend={errorCount > 0 ? -100 : 0}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <KpiCard
                    title="Alertes actives"
                    value={alerts.length}
                    subtitle={alerts.length === 0 ? 'Système stable' : 'Attention requise'}
                    icon={<WarningAmberIcon fontSize="inherit" />}
                    color={alerts.length > 0 ? '#F59E0B' : '#10B981'}
                    loading={loading}
                />
            </Grid>
        </Grid>
    );
}