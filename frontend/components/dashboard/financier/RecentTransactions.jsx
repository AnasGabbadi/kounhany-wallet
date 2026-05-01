'use client';
import { Card, CardContent, Typography, Box, Button, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useRouter } from 'next/navigation';
import StatusBadge from '@/components/common/StatusBadge';

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 0 });

const LIMIT = 5;

export default function RecentTransactions({ transactions }) {
  const router = useRouter();
  const displayed = transactions.slice(0, LIMIT);

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
            Transactions récentes
          </Typography>
          <Chip
            label={`${transactions.length} total`}
            size="small"
            sx={{ bgcolor: 'rgba(33,37,41,0.08)', color: 'text.secondary', fontWeight: 700, fontSize: '0.7rem' }}
          />
        </Box>

        <Box sx={{ flex: 1 }}>
          {displayed.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                Aucune transaction
              </Typography>
            </Box>
          ) : (
            displayed.map((tx) => (
              <Box key={tx.id} sx={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', py: 1.2,
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                '&:last-of-type': { borderBottom: 'none' },
              }}>
                <Box sx={{ minWidth: 0, mr: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3, flexWrap: 'wrap' }}>
                    <StatusBadge status={tx.type} />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {tx.client_name}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {tx.description || tx.reference?.slice(0, 28)}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {fmt(tx.amount)} MAD
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(tx.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Button
          fullWidth
          variant="outlined"
          endIcon={<ArrowForwardIcon />}
          onClick={() => router.push('/transactions')}
          sx={{
            mt: 2, borderColor: 'rgba(33,37,41,0.2)',
            color: 'text.secondary', fontWeight: 600,
            '&:hover': { borderColor: '#212529', bgcolor: 'rgba(33,37,41,0.04)' },
          }}
        >
          Voir toutes les transactions
        </Button>
      </CardContent>
    </Card>
  );
}