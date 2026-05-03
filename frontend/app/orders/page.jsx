'use client';
import { useEffect, useState } from 'react';
import {
  Box, Typography, Alert, CircularProgress,
  Card, CardContent, TextField, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Stack,
  Button, Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { ordersApi } from '@/lib/api';
import OrdersStatCards from '@/components/orders/OrdersStatCards';
import OrdersTable from '@/components/orders/OrdersTable';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceSuccess, setInvoiceSuccess] = useState(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getAll({ limit: 200 });
      setOrders(res.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    let result = orders;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.reference?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q) ||
        o.client_id?.toLowerCase().includes(q) ||
        o.client_name?.toLowerCase().includes(q)
      );
    }
    if (filterType) result = result.filter(o => o.order_type === filterType);
    if (filterStatus) result = result.filter(o => o.status === filterStatus);
    setFiltered(result);
  }, [orders, search, filterType, filterStatus]);

  const handleConfirm = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.confirm(orderId);
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.cancel(orderId);
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvoiceLogistique = async () => {
    setInvoicing(true);
    try {
      await ordersApi.invoiceLogistique();
      setInvoiceSuccess('Facturation mensuelle LOGISTIQUE lancée');
      await fetchOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setInvoicing(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <ShoppingBagOutlinedIcon sx={{ color: '#FAC345', fontSize: 24 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Commandes</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {orders.length} commande{orders.length > 1 ? 's' : ''} — tous les clients
          </Typography>
        </Box>

        <Tooltip title="Générer les factures mensuelles pour toutes les missions LOGISTIQUE CONFIRMED">
          <span>
            <Button
              variant="contained"
              startIcon={invoicing
                ? <CircularProgress size={16} sx={{ color: 'white' }} />
                : <ReceiptLongIcon />
              }
              onClick={handleInvoiceLogistique}
              disabled={invoicing}
              sx={{
                bgcolor: '#FAC345', color: '#212529',
                boxShadow: 'none', fontWeight: 700,
                '&:hover': { bgcolor: '#a8832d', boxShadow: 'none' },
              }}
            >
              Facturer LOGISTIQUE
            </Button>
          </span>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {invoiceSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setInvoiceSuccess(null)}>
          {invoiceSuccess}
        </Alert>
      )}

      {/* Stats */}
      <OrdersStatCards orders={orders} />

      {/* Filtres */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, pb: '16px !important' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              placeholder="Rechercher par réf., client, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Type</InputLabel>
              <Select value={filterType} label="Type" onChange={(e) => setFilterType(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="FLEET">Fleet</MenuItem>
                <MenuItem value="LOGISTIQUE">Logistique</MenuItem>
                <MenuItem value="B2C">B2C</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={filterStatus} label="Statut" onChange={(e) => setFilterStatus(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="BLOCKED">Bloqué</MenuItem>
                <MenuItem value="CONFIRMED">Confirmé</MenuItem>
                <MenuItem value="INVOICED">Facturé</MenuItem>
                <MenuItem value="PAID">Payé</MenuItem>
                <MenuItem value="CANCELLED">Annulé</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
          <CircularProgress sx={{ color: '#FAC345' }} />
        </Box>
      ) : (
        <OrdersTable
          orders={filtered}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          actionLoading={actionLoading}
          showClient
        />
      )}
    </Box>
  );
}