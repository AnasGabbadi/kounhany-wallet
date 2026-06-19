'use client';
import useSWR from 'swr';
import { useState } from 'react';
import {
  Box, Typography, Card, CardContent,
  CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import { prestatairesApi, kpisApi } from '@/lib/api';
import PrestatairesTable from '@/components/prestataires/PrestatairesTable';
import { PRESTA_TYPES, usePrestaNavigation } from '@/hooks/usePrestaNavigation';

export default function PiecesPage() {
  const [search, setSearch] = useState('');
  const { goToWallet } = usePrestaNavigation();
  const type = PRESTA_TYPES.pieces;

  const { data: prestataires = [], isLoading } = useSWR(
    'prestataires',
    () => prestatairesApi.list(),
    { refreshInterval: 30000 }
  );

  const { data: allBalancesData = [], isLoading: balancesLoading } = useSWR(
    'allBalances',
    () => kpisApi.allBalances(),
    { refreshInterval: 60000 }
  );

  const balances = (Array.isArray(allBalancesData) ? allBalancesData : allBalancesData?.data || [])
    .reduce((acc, b) => { acc[b.client_id] = b; return acc; }, {});

  const filtered = prestataires
    .filter(type.filter)
    .filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.prestataire_id?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Fournisseurs pièces</Typography>
          <Typography variant="body2" color="text.secondary">
            {filtered.length} fournisseur{filtered.length > 1 ? 's' : ''} — pièces de rechange
          </Typography>
        </Box>
      </Box>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 2, pb: '16px !important' }}>
          <TextField
            placeholder="Rechercher par nom ou ID..."
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
            <PrestatairesTable
              prestataires={filtered}
              balances={balances}
              balancesLoading={balancesLoading}
              onWallet={(id) => goToWallet(id, 'pieces')}
            />
          )}
        </CardContent>
      </Card>
    </Box>
  );
}