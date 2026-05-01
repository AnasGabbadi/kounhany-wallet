'use client';
import { Card, CardContent, Typography, Box } from '@mui/material';
import ApiIcon from '@mui/icons-material/Api';

export default function SystemInfo({ systemInfo }) {
  const items = [
    { label: 'Environnement', value: systemInfo?.environment },
    { label: 'Version', value: systemInfo?.version },
    { label: 'Uptime', value: systemInfo?.uptime_human },
  ].filter((item) => item.value);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Informations système
        </Typography>

        {items.map((item) => (
          <Box key={item.label} sx={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', py: 0.9,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            '&:last-child': { borderBottom: !systemInfo?.swagger_url ? 'none' : '1px solid rgba(0,0,0,0.05)' },
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
              {item.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace' }}>
              {item.value}
            </Typography>
          </Box>
        ))}

        {systemInfo?.swagger_url && (
          <Box sx={{
            mt: 2, p: 1.5, borderRadius: 2,
            bgcolor: 'rgba(59,130,246,0.05)',
            border: '1px solid rgba(59,130,246,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ApiIcon sx={{ fontSize: 16, color: '#3B82F6' }} />
              <Typography variant="caption" sx={{ color: '#3B82F6', fontWeight: 600 }}>
                Documentation API
              </Typography>
            </Box>
            <Typography
              variant="caption"
              component="a"
              href={systemInfo.swagger_url}
              target="_blank"
              sx={{
                color: '#3B82F6', fontWeight: 700,
                textDecoration: 'none', fontFamily: 'monospace', fontSize: '0.68rem',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Ouvrir →
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}