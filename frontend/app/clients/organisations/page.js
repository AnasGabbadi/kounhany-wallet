'use client';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent,
  Alert, CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useRouter } from 'next/navigation';
import { kpisApi } from '@/lib/api';
import ClientsTable from '@/components/clients/ClientsTable';

export default function OrganisationsPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const { data: clients = [], isLoading } = useSWR(
    'clients', () => kpisApi.clients(), { refreshInterval: 30000 }
  );

  const { data: allBalancesData = [], isLoading: balancesLoading } = useSWR(
    'allBalances', () => kpisApi.allBalances(), { refreshInterval: 60000 }
  );

  const balances = (Array.isArray(allBalancesData) ? allBalancesData : allBalancesData?.data || [])
    .reduce((acc, b) => { acc[b.client_id] = b; return acc; }, {});

  const { data: allScoresData = [], isLoading: scoresLoading } = useSWR(
    'allScores', () => kpisApi.allScores(), { refreshInterval: 300000 }
  );

  const scores = allScoresData.reduce((acc, s) => {
    acc[s.client_id] = s;
    return acc;
  }, {});

  const organisations = clients
    .filter(c => c.client_id?.startsWith('company_'))
    .filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.client_id?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Comptes entreprises</Typography>
        <Typography variant="body2" color="text.secondary">
          {organisations.length} entreprise{organisations.length > 1 ? 's' : ''} — wallets partagés par organisation
        </Typography>
      </Box>

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
              clients={organisations}
              balances={balances}
              balancesLoading={balancesLoading}
              scores={scores}
              scoresLoading={scoresLoading}
              onDetail={(client) => router.push(`/clients/${client.client_id}`)}
              onWallet={(id) => router.push(`/clients/${id}/wallet?from=flottes`)}
              onOrders={(id) => router.push(`/clients/${id}/orders`)}
              showContact={false}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
