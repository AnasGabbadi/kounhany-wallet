'use client';
import { Card, CardContent, Typography, Box, Button, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const LIMIT = 5;

export default function TopClients({ clients }) {
  const router = useRouter();
  const displayed = clients.slice(0, LIMIT);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{
        p: { xs: 2, md: 3 },
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Top clients
          </Typography>
          <Chip
            label={`${clients.length} total`}
            size="small"
            sx={{ bgcolor: 'rgba(250,195,69,0.12)', color: '#E0A820', fontWeight: 700, fontSize: '0.7rem' }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          {displayed.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Aucun client enregistré
              </Typography>
            </Box>
          ) : (
            displayed.map((client, i) => (
              <Box
                key={client.client_id}
                onClick={() => router.push(`/clients/${client.client_id}`)}
                sx={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1.2, borderBottom: '1px solid rgba(0,0,0,0.06)',
                  '&:last-of-type': { borderBottom: 'none' },
                  cursor: 'pointer', borderRadius: 1, px: 0.5,
                  '&:hover': { bgcolor: 'rgba(250,195,69,0.05)' },
                  transition: 'background 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                  <Box sx={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    bgcolor: i === 0 ? '#FAC345' : 'rgba(33,37,41,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: i === 0 ? '#212529' : 'text.secondary',
                    fontWeight: 700, fontSize: '0.75rem',
                  }}>
                    {i + 1}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {client.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {client.total_transactions} op{client.total_transactions > 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {fmt(client.total_volume)} MAD
                  </Typography>
                  {client.total_debt > 0 && (
                    <Typography variant="caption" sx={{ color: '#EF4444', display: 'block' }}>
                      Dette: {fmt(client.total_debt)} MAD
                    </Typography>
                  )}
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Button
          fullWidth
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/clients')}
          sx={{
            mt: 2, borderColor: 'rgba(250,195,69,0.4)',
            color: '#E0A820', fontWeight: 600,
            '&:hover': { borderColor: '#FAC345', bgcolor: 'rgba(250,195,69,0.05)' },
          }}
        >
          Voir tous les clients
        </Button>
      </CardContent>
    </Card>
  );
}