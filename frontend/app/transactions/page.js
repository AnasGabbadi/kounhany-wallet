'use client';
import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, TablePagination, Tooltip,
  Button, Avatar, Chip,
} from '@mui/material';
import { clientsApi, walletApi } from '@/lib/api';
import StatusBadge from '@/components/common/StatusBadge';
import TransactionKpis from '@/components/transactions/TransactionKpis';
import TransactionFilters from '@/components/transactions/TransactionFilters';
import TransactionDetailDialog from '@/components/transactions/TransactionDetailDialog';
import ReceiptIcon from '@mui/icons-material/Receipt';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const exportCSV = (transactions) => {
  const headers = ['Client', 'Type', 'Montant', 'Référence', 'Description', 'Statut', 'Date'];
  const rows = transactions.map((tx) => [
    tx.client_name || tx.client_id,
    tx.type,
    tx.amount,
    tx.reference || '',
    tx.description || '',
    tx.status,
    new Date(tx.created_at).toLocaleString('fr-FR'),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const clientsRes = await clientsApi.list();
        const clients = clientsRes.data || [];
        const txAll = (await Promise.all(
          clients.map((c) =>
            walletApi.transactions(c.client_id)
              .then((res) => (res.data || []).map((tx) => ({ ...tx, client_name: c.name })))
              .catch(() => [])
          )
        )).flat();
        txAll.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setTransactions(txAll);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchSearch = !search ||
        tx.client_name?.toLowerCase().includes(search.toLowerCase()) ||
        tx.reference?.toLowerCase().includes(search.toLowerCase()) ||
        tx.description?.toLowerCase().includes(search.toLowerCase());
      const matchType = !typeFilter || tx.type === typeFilter;
      const txDate = new Date(tx.created_at);
      const matchFrom = !dateFrom || txDate >= new Date(dateFrom);
      const matchTo = !dateTo || txDate <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchType && matchFrom && matchTo;
    });
  }, [transactions, search, typeFilter, dateFrom, dateTo]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Transactions</Typography>
        <Typography variant="body2" color="text.secondary">
          {transactions.length} transaction{transactions.length > 1 ? 's' : ''} au total
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <TransactionKpis transactions={filtered} loading={loading} />

      <Card>
        <CardContent sx={{ p: 2, pb: '16px !important' }}>
          <TransactionFilters
            search={search} setSearch={setSearch}
            typeFilter={typeFilter} setTypeFilter={setTypeFilter}
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            onExport={() => exportCSV(filtered)}
            filteredCount={filtered.length}
            totalCount={transactions.length}
          />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#FAC345' }} />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      {['Client', 'Type', 'Montant', 'Description', 'Statut', 'Date', 'Actions'].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginated.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                          Aucune transaction trouvée
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginated.map((tx) => (
                        <TableRow key={tx.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{
                                width: 34, height: 34,
                                bgcolor: '#FAC345', color: '#212529',
                                fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
                              }}>
                                {tx.client_name?.charAt(0).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {tx.client_name || tx.client_id}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>
                                  {tx.client_id}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={tx.type} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {fmt(tx.amount)} MAD
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Tooltip title={tx.description || ''}>
                              <Typography variant="body2" sx={{ maxWidth: 160 }} noWrap>
                                {tx.description || '—'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={tx.status}
                              size="small"
                              sx={{
                                bgcolor: tx.status === 'SUCCESS' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: tx.status === 'SUCCESS' ? '#10B981' : '#EF4444',
                                fontWeight: 700, fontSize: '0.72rem',
                                border: `1px solid ${tx.status === 'SUCCESS' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(tx.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<ReceiptIcon sx={{ fontSize: '14px !important' }} />}
                              onClick={() => setSelectedTx(tx)}
                              sx={{ fontSize: '0.72rem', py: 0.3 }}
                            >
                              Détail
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={(_, p) => setPage(p)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
                rowsPerPageOptions={[8, 15, 25, 50]}
                labelRowsPerPage="Lignes par page"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              />
            </>
          )}
        </CardContent>
      </Card>

      <TransactionDetailDialog
        tx={selectedTx}
        onClose={() => setSelectedTx(null)}
      />
    </Box>
  );
}