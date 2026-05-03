'use client';
import { use, useEffect, useState } from 'react';
import { Box, Alert, CircularProgress, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { useRouter } from 'next/navigation';
import { clientsApi, ordersApi } from '@/lib/api';
import OrdersStatCards from '@/components/orders/OrdersStatCards';
import OrdersTable from '@/components/orders/OrdersTable';

export default function ClientOrdersPage({ params }) {
  const { id: clientId } = use(params);
  const router = useRouter();

  const [client, setClient] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [clientRes, ordersRes] = await Promise.all([
        clientsApi.getOne(clientId),
        ordersApi.getByClient(clientId, { limit: 100 }),
      ]);
      setClient(clientRes.data);
      setOrders(ordersRes.orders || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [clientId]);

  const handleConfirm = async (orderId) => {
    setActionLoading(orderId);
    try {
      await ordersApi.confirm(orderId);
      await fetchData();
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
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
      <CircularProgress sx={{ color: '#FAC345' }} />
    </Box>
  );

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/clients')}
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        >
          Retour
        </Button>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Commandes — {client?.name}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {orders.length} commande{orders.length > 1 ? 's' : ''} · {client?.client_id}
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <OrdersStatCards orders={orders} />

      {/* Table */}
      <OrdersTable
        orders={orders}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        actionLoading={actionLoading}
      />
    </Box>
  );
}