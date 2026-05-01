'use client';
import {
    Card, CardContent, Typography, Box, Chip, Table,
    TableBody, TableCell, TableContainer, TableHead,
    TableRow, Button, CircularProgress, Alert, TablePagination,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useEffect, useState } from 'react';
import { dolibarrApi } from '@/lib/api';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 });

const statusConfig = {
    unpaid: { label: 'Non payée', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
    paid: { label: 'Payée', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
    draft: { label: 'Brouillon', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

export default function WalletInvoices({ clientId, onCountChange }) {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(15);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await dolibarrApi.clientInvoices(clientId);
            const data = res.data.invoices || [];
            setInvoices(data);
            onCountChange?.(data.length); // ← ajouter
        } catch (err) {
            setError('Impossible de charger les factures Dolibarr');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            await dolibarrApi.sync();
            await fetchInvoices();
        } catch { }
        finally { setSyncing(false); }
    };

    useEffect(() => { fetchInvoices(); }, [clientId]);

    const paginated = invoices.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Card sx={{
            width: '100%',
            minHeight: 'calc(100vh - 220px)',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <CardContent sx={{
                p: 3,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                '&:last-child': { pb: 2 },
            }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <ReceiptLongIcon sx={{ color: '#FAC345' }} />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Factures Dolibarr
                        </Typography>
                        <Chip
                            label={`${invoices.length} facture${invoices.length > 1 ? 's' : ''}`}
                            size="small"
                            sx={{ bgcolor: 'rgba(250,195,69,0.12)', color: '#E0A820', fontWeight: 700, fontSize: '0.7rem' }}
                        />
                    </Box>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={syncing ? <CircularProgress size={14} /> : <RefreshIcon />}
                        onClick={handleSync}
                        disabled={syncing}
                        sx={{ borderColor: '#FAC345', color: '#E0A820', '&:hover': { borderColor: '#E0A820', bgcolor: 'rgba(250,195,69,0.05)' } }}
                    >
                        Synchroniser
                    </Button>
                </Box>

                {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
                        <CircularProgress sx={{ color: '#FAC345' }} />
                    </Box>
                ) : (
                    <>
                        {/* Tableau hauteur fixe */}
                        <TableContainer sx={{ flex: 1 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        {['Référence', 'Description', 'Montant HT', 'Montant TTC', 'Échéance', 'Statut'].map((h) => (
                                            <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem' }}>
                                                {h}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginated.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ border: 'none' }}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                                                    <ReceiptLongIcon sx={{ fontSize: 48, color: 'rgba(0,0,0,0.1)', mb: 1 }} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        Aucune facture Dolibarr
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginated.map((inv) => {
                                            const status = statusConfig[inv.status] || statusConfig.draft;
                                            return (
                                                <TableRow key={inv.id} hover>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                            {inv.ref}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                                                            {inv.lines?.[0]?.desc || inv.ref_client || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                            {fmt(inv.total_ht)} MAD
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#212529' }}>
                                                            {fmt(inv.total_ttc)} MAD
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {inv.date_echeance
                                                                ? new Date(
                                                                    String(inv.date_echeance).length === 10
                                                                        ? inv.date_echeance * 1000
                                                                        : inv.date_echeance
                                                                ).toLocaleDateString('fr-FR')
                                                                : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={status.label}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: status.bg,
                                                                color: status.color,
                                                                fontWeight: 700,
                                                                fontSize: '0.68rem',
                                                                border: `1px solid ${status.color}30`,
                                                            }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Pagination */}
                        <TablePagination
                            component="div"
                            count={invoices.length}
                            page={page}
                            onPageChange={(_, p) => setPage(p)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                            rowsPerPageOptions={[10, 25, 50]}
                            labelRowsPerPage="Lignes"
                            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}