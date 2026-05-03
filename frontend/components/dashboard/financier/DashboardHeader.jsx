'use client';
import { Box, Typography } from '@mui/material';

export default function DashboardHeader() {
  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: { xs: 'flex-start', sm: 'center' },
      flexDirection: { xs: 'column', sm: 'row' },
      gap: 2, mb: 4,
    }}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Dashboard financier
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric',
          })}
        </Typography>
      </Box>
    </Box>
  );
}