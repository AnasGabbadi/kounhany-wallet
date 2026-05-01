'use client';
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';

const items = [
  { label: 'Double-entry Blnk', status: 'Vérifié', ok: true },
  { label: 'Idempotency', status: 'Actif', ok: true },
  { label: 'Logs traçabilité', status: 'Actif', ok: true },
  { label: 'Validation pre-BLOCK', status: 'Actif', ok: true },
  { label: 'Intégration Dolibarr', status: 'Phase 2', ok: null },
];

export default function DataIntegrity() {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Intégrité des données
        </Typography>
        {items.map((item) => (
          <Box key={item.label} sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', py: 1,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            '&:last-child': { borderBottom: 'none' },
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
              {item.label}
            </Typography>
            <Chip
              label={item.status}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: item.ok === true ? 'rgba(16,185,129,0.1)' : item.ok === false ? 'rgba(239,68,68,0.1)' : 'rgba(0,0,0,0.06)',
                color: item.ok === true ? '#10B981' : item.ok === false ? '#EF4444' : '#6B7280',
              }}
            />
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}