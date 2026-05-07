'use client';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent,
  Alert, CircularProgress, TextField, InputAdornment, Snackbar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useRouter } from 'next/navigation';
import { kpisApi } from '@/lib/api';
import ClientsTable from '@/components/clients/ClientsTable';
import ClientDetailDialog from '@/components/clients/ClientDetailDialog';

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const { data: clients = [], isLoading, mutate: mutateClients } = useSWR(
    'clients', () => kpisApi.clients(), { refreshInterval: 30000 }
  );

  const { data: allBalancesData = [], isLoading: balancesLoading } = useSWR(
    'allBalances', () => kpisApi.allBalances(), { refreshInterval: 60000 }
  );

  const balances = (Array.isArray(allBalancesData) ? allBalancesData : allBalancesData?.data || [])
    .reduce((acc, b) => { acc[b.client_id] = b; return acc; }, {});

  const handleCreateWallet = async (client) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/scim/v2/Users`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer scim-secret-token-2024',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
          id: client.scim_id || client.client_id,
          userName: client.email || client.client_id,
          name: { formatted: client.name },
          emails: [{ value: client.email || '', primary: true }],
          active: true,
          groups: [],
        }),
      });
      if (res.status === 201 || res.status === 409) {
        setSuccessMsg(`Wallet créé pour ${client.name}`);
        mutateClients();
      } else {
        setError('Erreur lors de la création du wallet');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = clients.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.client_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Clients</Typography>
        <Typography variant="body2" color="text.secondary">
          {clients.length} client{clients.length > 1 ? 's' : ''} enregistré{clients.length > 1 ? 's' : ''}
          {' '}— synchronisés depuis Authentik
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, pb: '16px !important' }}>
          <TextField
            placeholder="Rechercher par nom, email ou ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            sx={{ width: { xs: '100%', sm: 320 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      <Card sx={{ width: '100%', minHeight: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#FAC345' }} />
            </Box>
          ) : (
            <ClientsTable
              clients={filtered}
              balances={balances}
              balancesLoading={balancesLoading}
              onDetail={(client) => setSelectedClient(client)}
              onWallet={(id) => router.push(`/clients/${id}/wallet`)}
              onOrders={(id) => router.push(`/clients/${id}/orders`)}
              onCreateWallet={handleCreateWallet}
            />
          )}
        </CardContent>
      </Card>

      <ClientDetailDialog
        client={selectedClient}
        balance={selectedClient ? balances[selectedClient.client_id] : null}
        onClose={() => setSelectedClient(null)}
      />

      <Snackbar
        open={!!successMsg}
        autoHideDuration={3000}
        onClose={() => setSuccessMsg(null)}
        message={successMsg}
      />
    </Box>
  );
}